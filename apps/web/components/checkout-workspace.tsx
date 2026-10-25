"use client";
import Link from "next/link";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import WorkspaceFrame from "@/components/workspace-frame";
import { clearProviderCheckoutKey, cartEntries, cartSubtotal, groupCartByProvider, idempotencyKeyForProvider, readCart, writeCart, type Cart, type CartItem } from "@/lib/commerce/cart";

// Keep the promo UI fail-closed until preview_promo_code and create_order_with_promo
// are present in the reviewed staging schema and their redemption limits are tested.
const PROMO_CHECKOUT_ENABLED = false;
import { getBrowserSupabaseClient } from "@/lib/supabase/browser";

interface Address {
  id: string;
  recipient_name: string;
  phone: string;
  address_line: string;
  area_name: string;
  city: string;
  pin_code: string;
  is_default: boolean;
  latitude?: number | null;
  longitude?: number | null;
}
type AddressForm = Omit<Address, "id" | "is_default" | "latitude" | "longitude"> & { is_default: boolean; id?: string };
interface Coordinates { latitude: number; longitude: number; }
type Notice = { kind: "error" | "success" | "info"; text: string } | null;
const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const emptyAddress: AddressForm = { recipient_name: "", phone: "", address_line: "", area_name: "", city: "Ahmedabad", pin_code: "", is_default: true };

function errText(error: unknown): string {
  const message = String((error as { message?: string })?.message ?? "Something went wrong.");
  const known: Record<string, string> = {
    customer_order_payment_controls_not_ready: "Checkout is temporarily paused while payment controls are verified.",
    outside_provider_service_area: "One seller does not deliver to this address. Update the address or choose a nearby seller.",
    delivery_location_required: "Add a valid delivery address before placing the order.",
    idempotency_key_reuse_conflict: "This checkout changed after it started. Return to the cart and start a fresh checkout.",
  };
  for (const [key, value] of Object.entries(known)) if (message.includes(key)) return value;
  return message.replace(/_/g, " ");
}

export default function CheckoutWorkspace() {
  const [cart, setCart] = useState<Cart>({});
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressForm, setAddressForm] = useState<AddressForm>(emptyAddress);
  const [addressId, setAddressId] = useState("");
  const [deliveryCoordinates, setDeliveryCoordinates] = useState<Coordinates | null>(null);
  const [locationMessage, setLocationMessage] = useState("Delivery coordinates not set");
  const [locationBusy, setLocationBusy] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promo, setPromo] = useState<{ code: string; discount: number; label: string } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "direct_upi">("cod");
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [orderIds, setOrderIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    setCart(readCart());
    const supabase = getBrowserSupabaseClient();
    if (!supabase) { setNotice({ kind: "error", text: "Supabase is not configured for this environment yet." }); return; }
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) { setSignedIn(false); return; }
    setSignedIn(true);
    const result = await supabase.from("addresses").select("id,recipient_name,phone,address_line,area_name,city,pin_code,is_default,latitude,longitude").eq("user_id", data.user.id).order("is_default", { ascending: false }).limit(20);
    if (result.error) { setNotice({ kind: "error", text: "Unable to verify your saved delivery address: " + result.error.message }); return; }
    const rows = (result.data ?? []) as Address[];
    setAddresses(rows);
    if (rows.length) {
      const primary = rows.find((row) => row.is_default) ?? rows[0];
      setAddressId(primary.id);
      setAddressForm({ ...primary, is_default: primary.is_default });
      if (primary.latitude !== null && primary.latitude !== undefined && primary.longitude !== null && primary.longitude !== undefined) {
        setDeliveryCoordinates({ latitude: Number(primary.latitude), longitude: Number(primary.longitude) });
        setLocationMessage("Delivery coordinates saved for this address");
      } else {
        setDeliveryCoordinates(null);
        setLocationMessage("Delivery coordinates not set");
      }
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function patchAddress<K extends keyof AddressForm>(key: K, value: AddressForm[K]) {
    setAddressForm((old) => ({ ...old, [key]: value }));
  }

  function shareDeliveryLocation() {
    setNotice(null);
    if (!navigator.geolocation) {
      setNotice({ kind: "error", text: "This browser does not support location sharing. You can still save an address, but delivery coverage cannot be confirmed until coordinates are added." });
      return;
    }
    setLocationBusy(true);
    navigator.geolocation.getCurrentPosition(async (position) => {
      const coordinates: Coordinates = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      setDeliveryCoordinates(coordinates);
      try {
        const supabase = getBrowserSupabaseClient();
        if (!supabase) throw new Error("Supabase is not configured.");
        if (addressId) {
          const { data: userData } = await supabase.auth.getUser();
          if (!userData.user) throw new Error("Sign in again to update this delivery address.");
          const result = await supabase.from("addresses").update(coordinates).eq("id", addressId).eq("user_id", userData.user.id).select("id,recipient_name,phone,address_line,area_name,city,pin_code,is_default,latitude,longitude").single();
          if (result.error) throw result.error;
          const updated = result.data as Address;
          setAddresses((old) => old.map((address) => address.id === updated.id ? updated : address));
          setLocationMessage("Location saved to the selected delivery address");
          setNotice({ kind: "success", text: "Delivery coordinates saved. The server will use this location to validate seller coverage." });
        } else {
          setNotice({ kind: "info", text: "Location captured for this form. Save the address to store the coordinates before placing an order." });
        }
        setLocationMessage("Location captured for this delivery address");
      } catch (error) {
        setNotice({ kind: "error", text: String((error as { message?: string })?.message ?? error) });
      } finally { setLocationBusy(false); }
    }, () => {
      setNotice({ kind: "error", text: "Location permission was not granted. No coordinates were saved." });
      setLocationBusy(false);
    }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 });
  }

  async function saveAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const supabase = getBrowserSupabaseClient();
      if (!supabase) throw new Error("Supabase is not configured.");
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error("Sign in to save a delivery address.");
      const phone = addressForm.phone.replace(/\D/g, "");
      if (!/^\d{10}$/.test(phone) || !/^\d{6}$/.test(addressForm.pin_code)) throw new Error("Enter a 10-digit phone number and a 6-digit PIN code.");
      if (![addressForm.recipient_name, addressForm.address_line, addressForm.area_name, addressForm.city].every((value) => value.trim())) throw new Error("Complete the recipient, address, area and city fields.");
      if (addressForm.is_default) {
        const clear = await supabase.from("addresses").update({ is_default: false }).eq("user_id", data.user.id);
        if (clear.error) throw clear.error;
      }
      const row = {
        user_id: data.user.id, label: "Home", recipient_name: addressForm.recipient_name.trim(), phone,
        address_line: addressForm.address_line.trim(), area_name: addressForm.area_name.trim(),
        city: addressForm.city.trim(), pin_code: addressForm.pin_code, is_default: addressForm.is_default,
        latitude: deliveryCoordinates?.latitude ?? null, longitude: deliveryCoordinates?.longitude ?? null,
      };
      const result = addressId
        ? await supabase.from("addresses").update(row).eq("id", addressId).eq("user_id", data.user.id).select("id,recipient_name,phone,address_line,area_name,city,pin_code,is_default,latitude,longitude").single()
        : await supabase.from("addresses").insert(row).select("id,recipient_name,phone,address_line,area_name,city,pin_code,is_default,latitude,longitude").single();
      if (result.error) throw result.error;
      const saved = result.data as Address;
      setAddressId(saved.id);
      setAddressForm({ ...saved, is_default: saved.is_default });
      setAddresses((old) => [
        ...(saved.is_default ? old.map((address) => ({ ...address, is_default: false })) : old.filter((address) => address.id !== saved.id)),
      ].filter((address) => address.id !== saved.id).concat(saved));
      setLocationMessage(saved.latitude != null && saved.longitude != null ? "Delivery coordinates saved for this address" : "Delivery coordinates not set");
      setNotice({ kind: "success", text: "Delivery address saved and linked to your account." });
    } catch (error) { setNotice({ kind: "error", text: errText(error) }); }
    finally { setBusy(false); }
  }

  async function applyPromo() {
    if (!PROMO_CHECKOUT_ENABLED) {
      setPromo(null);
      setNotice({ kind: "error", text: "Promo codes are temporarily unavailable while server-side validation is completed. You can still place your order at the displayed price." });
      return;
    }
    setBusy(true);
    setNotice(null);
    setPromo(null);
    try {
      const groups = groupCartByProvider(cart);
      if (groups.length !== 1) throw new Error("Promo codes are supported only for a single-seller cart.");
      if (!promoCode.trim()) throw new Error("Enter a promo code.");
      const supabase = getBrowserSupabaseClient();
      if (!supabase) throw new Error("Supabase is not configured.");
      const { data, error } = await supabase.rpc("preview_promo_code", {
        p_promo_code: promoCode.trim().toUpperCase(),
        p_subtotal: cartSubtotal(cart),
      });
      if (error) throw error;
      if (data?.valid === false) throw new Error(data.reason || "Promo code is not applicable.");
      const discount = Number(data?.discount_amount ?? data?.discount ?? 0);
      if (!Number.isFinite(discount) || discount < 0) throw new Error("Promo preview returned an invalid discount.");
      setPromo({ code: String(data?.code ?? promoCode.trim().toUpperCase()), discount, label: String(data?.discount_label ?? "Offer applied") });
      setNotice({ kind: "success", text: String(data?.discount_label ?? "Promo code validated. Final discount is confirmed at order creation.") });
    } catch (error) { setNotice({ kind: "error", text: errText(error) }); }
    finally { setBusy(false); }
  }

  async function placeOrders() {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const supabase = getBrowserSupabaseClient();
      if (!supabase) throw new Error("Supabase is not configured.");
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) throw new Error("Sign in before placing an order.");
      const freshCart = readCart();
      const entries = cartEntries(freshCart);
      const groups = groupCartByProvider(freshCart);
      if (!entries.length || !groups.length) throw new Error("Your cart is empty or no longer contains valid live product IDs.");
      if (!addressId) throw new Error("Save or select a delivery address first.");
      const selectedAddress = addresses.find((address) => address.id === addressId);
      if (!selectedAddress || selectedAddress.latitude == null || selectedAddress.longitude == null) {
        throw new Error("Share your delivery location and save it to the selected address before ordering. The server needs coordinates to check seller coverage.");
      }
      if (promo && groups.length !== 1) throw new Error("A promo code can only be used for a single-seller cart.");

      const readiness = await supabase.rpc("customer_order_payment_controls_ready");
      if (readiness.error || readiness.data?.ready !== true) throw new Error("Checkout is paused until the secure payment controls are ready.");
      if (paymentMethod === "direct_upi") {
        for (const [providerId] of groups) {
          const checked = await supabase.rpc("customer_check_provider_direct_upi", { p_provider_id: providerId });
          if (checked.error || checked.data !== true) throw new Error("Direct UPI is not configured for every seller in this cart. Choose COD or ask the seller to set up UPI.");
        }
      }

      const created: string[] = [];
      const failures: string[] = [];
      for (const [providerId, items] of groups) {
        const payload = items.map((item: CartItem) => ({ product_id: item.productId, quantity: item.qty }));
        const key = idempotencyKeyForProvider(providerId);
        const rpcName = promo && groups.length === 1 ? "create_order_with_promo" : "create_order";
        const args: Record<string, unknown> = {
          p_provider_id: providerId, p_address_id: addressId, p_items: payload,
          p_customer_note: note.trim() || null, p_idempotency_key: key,
        };
        if (rpcName === "create_order_with_promo") args.p_promo_code = promo?.code;
        const result = await supabase.rpc(rpcName, args as never);
        if (result.error) { failures.push(errText(result.error)); continue; }
        const orderId = String(result.data ?? "");
        if (!orderId) { failures.push("Order creation returned no order ID."); continue; }
        const payment = await supabase.rpc("customer_set_order_payment_method", { p_order_id: orderId, p_method: paymentMethod });
        if (payment.error) { failures.push("Order " + orderId + " was created, but payment selection failed: " + errText(payment.error)); continue; }
        created.push(orderId);
        const next = Object.fromEntries(Object.entries(freshCart).filter(([, item]) => item.providerId !== providerId)) as Cart;
        Object.assign(freshCart, next);
        for (const keyName of Object.keys(freshCart)) if (freshCart[keyName]?.providerId === providerId) delete freshCart[keyName];
        clearProviderCheckoutKey(providerId);
      }
      writeCart(freshCart);
      setCart(freshCart);
      setOrderIds(created);
      if (failures.length) {
        setNotice({ kind: "error", text: (created.length ? "Some orders were placed safely. " : "") + failures.join(" ") + " Retry the remaining cart items; each seller order uses a persisted idempotency key." });
      } else {
        setNotice({ kind: "success", text: "Your order" + (created.length === 1 ? " was" : "s were") + " created. Payment method: " + (paymentMethod === "cod" ? "Cash on Delivery." : "direct seller UPI; the seller verifies receipt.") });
        setPromo(null);
      }
    } catch (error) { setNotice({ kind: "error", text: errText(error) }); }
    finally { setBusy(false); }
  }

  const entries = cartEntries(cart);
  const subtotal = cartSubtotal(cart);
  const total = Math.max(0, subtotal - (promo?.discount ?? 0));
  if (!signedIn) return (
    <WorkspaceFrame title="Secure checkout" description="Sign in to connect your order to your private delivery address.">
      <section className="workspace-card workspace-empty"><h2>Your order is saved in this browser</h2><p>Sign in to select a delivery address and finish checkout.</p><Link className="workspace-button workspace-button-primary" href="/auth/sign-in?return=%2Fcheckout">Sign in to continue</Link><Link className="workspace-inline-link" href="/cart">← Back to cart</Link></section>
      {notice && <p className="workspace-notice error">{notice.text}</p>}
    </WorkspaceFrame>
  );

  return (
    <WorkspaceFrame title="Secure checkout" eyebrow="CHECKOUT" description="Your order is grouped by seller. Final prices and eligibility are checked by the backend at order creation.">
      {notice && <p className={"workspace-notice " + notice.kind} role={notice.kind === "error" ? "alert" : "status"}>{notice.text}</p>}
      {orderIds.length > 0 && <section className="workspace-card"><p className="workspace-eyebrow">ORDER CREATED</p><h2>Order reference{orderIds.length > 1 ? "s" : ""}</h2><div className="workspace-list">{orderIds.map((id) => <div className="workspace-list-row" key={id}><div className="workspace-list-main"><strong>{id}</strong><span>Keep this reference for tracking and payment follow-up.</span></div><Link href={"/orders/" + encodeURIComponent(id)}>View order →</Link></div>)}</div><Link className="workspace-button workspace-button-secondary" href="/orders">Open all orders</Link></section>}
      <div className="workspace-checkout-grid">
        <div className="workspace-column">
          <section className="workspace-card">
            <div className="workspace-section-head"><div><p className="workspace-eyebrow">DELIVERY DETAILS</p><h2>Where should we deliver?</h2></div></div>
            {addresses.length > 0 && <label>Saved address<select value={addressId} onChange={(e) => { setAddressId(e.target.value); const selected = addresses.find((item) => item.id === e.target.value); if (selected) { setAddressForm({ ...selected, is_default: selected.is_default }); setDeliveryCoordinates(selected.latitude != null && selected.longitude != null ? { latitude: Number(selected.latitude), longitude: Number(selected.longitude) } : null); setLocationMessage(selected.latitude != null && selected.longitude != null ? "Delivery coordinates saved for this address" : "Delivery coordinates not set"); } else { setDeliveryCoordinates(null); setLocationMessage("Delivery coordinates not set"); } }}><option value="">Choose address</option>{addresses.map((a) => <option value={a.id} key={a.id}>{a.recipient_name} · {a.address_line}, {a.area_name}</option>)}</select></label>}
            <div className="workspace-location-panel">
              <div><strong>Delivery coverage</strong><span>{locationMessage}</span></div>
              <button type="button" className="workspace-button workspace-button-secondary" disabled={locationBusy || busy} onClick={shareDeliveryLocation}>{locationBusy ? "Getting location…" : "Share current location"}</button>
              <p className="workspace-muted">Your coordinates are requested only after you press this button. They are saved to the selected address to let the backend check delivery radius.</p>
            </div>
            <form className="workspace-form" onSubmit={saveAddress}>
              <div className="workspace-grid-two"><label>Recipient name<input required value={addressForm.recipient_name} onChange={(e) => patchAddress("recipient_name", e.target.value)} /></label><label>Phone<input required inputMode="tel" value={addressForm.phone} onChange={(e) => patchAddress("phone", e.target.value)} /></label></div>
              <label>Address line<input required value={addressForm.address_line} onChange={(e) => patchAddress("address_line", e.target.value)} /></label>
              <div className="workspace-grid-two"><label>Area / locality<input required value={addressForm.area_name} onChange={(e) => patchAddress("area_name", e.target.value)} /></label><label>City<input required value={addressForm.city} onChange={(e) => patchAddress("city", e.target.value)} /></label></div>
              <label>PIN code<input required maxLength={6} inputMode="numeric" value={addressForm.pin_code} onChange={(e) => patchAddress("pin_code", e.target.value.replace(/\D/g, ""))} /></label>
              <label className="workspace-checkbox"><input type="checkbox" checked={addressForm.is_default} onChange={(e) => patchAddress("is_default", e.target.checked)} /> Make this the default address</label>
              <button className="workspace-button workspace-button-secondary" disabled={busy}>{busy ? "Saving…" : addressId ? "Update selected address" : "Save address"}</button>
            </form>
          </section>
          <section className="workspace-card">
            <p className="workspace-eyebrow">PROMO CODE</p><h2>Offers coming soon</h2>
            <div className="workspace-inline-form"><input maxLength={40} value={promoCode} onChange={(e) => setPromoCode(e.target.value.toUpperCase())} placeholder="Promo codes temporarily unavailable" disabled={!PROMO_CHECKOUT_ENABLED || busy} /><button className="workspace-button workspace-button-secondary" onClick={() => void applyPromo()} disabled={!PROMO_CHECKOUT_ENABLED || busy}>Apply</button></div>
            <p className="workspace-muted">Promo discounts are disabled until server-side validation, redemption limits, and final order totals are implemented and tested. Your order will use the displayed price without a promo discount.</p>
          </section>
          <section className="workspace-card">
            <p className="workspace-eyebrow">DELIVERY NOTE</p><h2>Anything the seller should know?</h2><textarea rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Gate instructions, delivery preference…" />
          </section>
        </div>
        <aside className="workspace-card workspace-order-summary">
          <p className="workspace-eyebrow">YOUR ORDER</p><h2>{entries.length} item{entries.length === 1 ? "" : "s"}</h2>
          {!entries.length ? <div className="workspace-empty-inline"><p>Your cart is empty.</p><Link href="/providers">Explore local milk →</Link></div> : entries.map((item) => <div className="workspace-summary-item" key={item.providerId + ":" + item.productId}><span><strong>{item.milk}</strong><small>{item.provider} · {item.qty} L</small></span><b>{money.format(item.unitPrice * item.qty)}</b></div>)}
          <div className="workspace-summary-line"><span>Indicative subtotal</span><strong>{money.format(subtotal)}</strong></div>
          <div className="workspace-summary-line"><span>Promo discount</span><strong>{PROMO_CHECKOUT_ENABLED ? `−${money.format(promo?.discount ?? 0)}` : "Unavailable"}</strong></div>
          <div className="workspace-summary-line workspace-summary-total"><span>Estimated total</span><strong>{money.format(total)}</strong></div>
          <fieldset className="workspace-payment-options"><legend>Payment method</legend>
            <label><input type="radio" name="paymentMethod" value="cod" checked={paymentMethod === "cod"} onChange={() => setPaymentMethod("cod")} /><span><strong>Cash on Delivery</strong><small>Pay your seller on delivery.</small></span></label>
            <label><input type="radio" name="paymentMethod" value="direct_upi" checked={paymentMethod === "direct_upi"} onChange={() => setPaymentMethod("direct_upi")} /><span><strong>Direct seller UPI</strong><small>Payment goes directly to seller; seller confirms receipt.</small></span></label>
          </fieldset>
          <button className="workspace-button workspace-button-primary workspace-full-button" onClick={() => void placeOrders()} disabled={busy || !entries.length || !addressId}>{busy ? "Verifying & placing…" : "Place order securely →"}</button>
          <p className="workspace-muted">Doodhwala does not collect seller payments in this direct-UPI/COD flow. Do not mark a UPI payment as paid until the seller confirms receipt.</p>
        </aside>
      </div>
    </WorkspaceFrame>
  );
}
