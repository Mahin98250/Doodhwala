import Link from "next/link";
"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import WorkspaceFrame from "@/components/workspace-frame";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser";

interface ProviderProfile {
  id?: string; display_name?: string; owner_name?: string; phone?: string; primary_milk_type?: string;
  area_name?: string; city?: string; pin_code?: string; service_radius_km?: number; delivery_from?: string | null; delivery_to?: string | null;
  is_active?: boolean; accepting_orders?: boolean; verification_status?: string;
}
interface Product {
  id: string; name: string; milk_type: string; price_per_litre: number; unit_label: string;
  stock: boolean; daily_available: boolean; is_active: boolean;
}
interface SellerOrder {
  id: string; status: string; total?: number; payment_method?: string; payment_status?: string; created_at?: string;
  customer_note?: string; delivery_recipient_name?: string; delivery_area_name?: string; delivery_city?: string;
  order_items?: Array<{ product_name_snapshot?: string; quantity?: number; line_total?: number }>;
}
interface Notice { kind: "error" | "success" | "info"; text: string; }
const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const emptyProfile = {
  display_name: "", owner_name: "", phone: "", primary_milk_type: "cow", area_name: "", city: "Ahmedabad",
  pin_code: "", service_radius_km: "5", delivery_from: "05:00", delivery_to: "09:00",
};
const emptyProduct = { id: "", name: "", milk_type: "cow", price_per_litre: "", unit_label: "1 L", stock: true, daily_available: true, is_active: true };

export default function SellerWorkspace({ initialSection = "dashboard" }: { initialSection?: "dashboard" | "products" | "deliveries" }) {
  const [profile, setProfile] = useState<ProviderProfile | null>(null);
  const [sellerMetrics, setSellerMetrics] = useState<Record<string, unknown>>({});
  const [profileForm, setProfileForm] = useState(emptyProfile);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [subscriptions, setSubscriptions] = useState<Record<string, unknown>[]>([]);
  const [routeRows, setRouteRows] = useState<Record<string, unknown>[]>([]);
  const [dispatchRows, setDispatchRows] = useState<Record<string, unknown>[]>([]);
  const [productForm, setProductForm] = useState(emptyProduct);
  const [upiId, setUpiId] = useState("");
  const [upiPayee, setUpiPayee] = useState("");
  const [upiEnabled, setUpiEnabled] = useState(false);
  const [routeDate, setRouteDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [orderFilter, setOrderFilter] = useState<"needs-action" | "all" | "preparing" | "delivery">("needs-action");
  const [onboardingStep, setOnboardingStep] = useState<1 | 2>(1);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = getBrowserSupabaseClient();
    if (!supabase) { setNotice({ kind: "error", text: "Supabase is not configured in this environment." }); setLoading(false); return; }
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setAuthorized(false); setLoading(false); return; }
    setAuthorized(true);
    try {
      const own = await supabase.rpc("provider_get_own_profile");
      if (own.error && !String(own.error.message).includes("provider_not_found")) throw own.error;
      const p = own.data as ProviderProfile | null;
      setProfile(p);
      if (p) setProfileForm({
        display_name: p.display_name ?? "", owner_name: p.owner_name ?? "", phone: p.phone ?? "",
        primary_milk_type: p.primary_milk_type ?? "cow", area_name: p.area_name ?? "", city: p.city ?? "Ahmedabad",
        pin_code: p.pin_code ?? "", service_radius_km: String(p.service_radius_km ?? 5),
        delivery_from: String(p.delivery_from ?? "05:00").slice(0,5), delivery_to: String(p.delivery_to ?? "09:00").slice(0,5),
      });
      if (!p?.id) { setLoading(false); return; }
      const [dashboard, productResult, orderResult, subs, route, dispatch, upi] = await Promise.all([
        supabase.rpc("provider_get_dashboard"),
        supabase.from("milk_products").select("id,name,milk_type,price_per_litre,unit_label,stock,daily_available,is_active").eq("provider_id", p.id).order("created_at", { ascending: false }),
        supabase.from("orders").select("id,status,total,payment_method,payment_status,created_at,customer_note,delivery_recipient_name,delivery_area_name,delivery_city,order_items(product_name_snapshot,quantity,line_total)").eq("provider_id", p.id).order("created_at", { ascending: false }).limit(100),
        supabase.rpc("provider_get_subscriptions", { p_limit: 100 }),
        supabase.rpc("get_provider_delivery_route", { p_delivery_date: routeDate }),
        supabase.rpc("get_provider_dispatch_board", { p_delivery_date: routeDate }),
        supabase.rpc("provider_get_direct_upi_settings"),
      ]);
      if (dashboard.error) setNotice({ kind: "error", text: "Profile loaded, but dashboard metrics were not available: " + dashboard.error.message });
      else setSellerMetrics(((dashboard.data as { metrics?: Record<string, unknown> } | null)?.metrics ?? {}));
      if (productResult.error || orderResult.error) throw productResult.error ?? orderResult.error;
      setProducts((productResult.data ?? []) as Product[]);
      setOrders((orderResult.data ?? []) as unknown as SellerOrder[]);
      if (!subs.error) setSubscriptions((subs.data ?? []) as Record<string, unknown>[]);
      if (!route.error) setRouteRows((route.data ?? []) as Record<string, unknown>[]);
      if (!dispatch.error) setDispatchRows((dispatch.data ?? []) as Record<string, unknown>[]);
      if (!upi.error && upi.data) {
        const settings = upi.data as { upi_id?: string; payee_name?: string; enabled?: boolean };
        setUpiId(settings.upi_id ?? ""); setUpiPayee(settings.payee_name ?? ""); setUpiEnabled(Boolean(settings.enabled));
      }
    } catch (error) {
      setNotice({ kind: "error", text: String((error as { message?: string })?.message ?? error) });
    } finally { setLoading(false); }
  }, [routeDate]);

  useEffect(() => { void load(); }, [load]);

  function profileField(name: keyof typeof emptyProfile, value: string) { setProfileForm((old) => ({ ...old, [name]: value })); }

  const statusLabel = (status: string) => status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

  const visibleOrders = orders.filter((order) => {
    if (orderFilter === "all") return true;
    if (orderFilter === "preparing") return ["accepted", "preparing"].includes(order.status);
    if (orderFilter === "delivery") return ["out_for_delivery"].includes(order.status);
    return ["pending", "placed", "confirmed", "new"].includes(order.status);
  });

  async function setServiceLocation() {
    if (!profile?.id) return;
    if (!navigator.geolocation) {
      setNotice({ kind: "error", text: "This browser does not provide location access. Try another browser or contact support to set the service area." });
      return;
    }
    setBusy(true); setNotice(null);
    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const supabase = getBrowserSupabaseClient();
        if (!supabase) throw new Error("Supabase is not configured.");
        const result = await supabase.from("provider_service_areas").upsert({
          provider_id: profile.id,
          label: profile.area_name || "Local route",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          service_radius_km: Number(profile.service_radius_km ?? 5),
        }, { onConflict: "provider_id" });
        if (result.error) throw result.error;
        setNotice({ kind: "success", text: "Service-area location saved. Nearby discovery can now calculate distance using this location." });
      } catch (error) {
        setNotice({ kind: "error", text: String((error as { message?: string })?.message ?? error) });
      } finally { setBusy(false); }
    }, () => {
      setNotice({ kind: "error", text: "Location permission was not granted. No coordinates were saved." });
      setBusy(false);
    }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 });
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice(null);
    try {
      const supabase = getBrowserSupabaseClient();
      if (!supabase) throw new Error("Supabase is not configured.");
      if (!/^\d{6}$/.test(profileForm.pin_code)) throw new Error("Enter a six-digit business PIN code.");
      if (!profileForm.display_name.trim() || !profileForm.owner_name.trim() || !profileForm.area_name.trim() || !profileForm.city.trim()) throw new Error("Complete the business name, owner, locality and city.");
      const result = await supabase.rpc("provider_upsert_own_profile", {
        p_display_name: profileForm.display_name.trim(), p_owner_name: profileForm.owner_name.trim(),
        p_phone: profileForm.phone.replace(/\D/g, ""), p_primary_milk_type: profileForm.primary_milk_type,
        p_area_name: profileForm.area_name.trim(), p_city: profileForm.city.trim(), p_pin_code: profileForm.pin_code,
        p_service_radius_km: Number(profileForm.service_radius_km), p_delivery_from: profileForm.delivery_from || null,
        p_delivery_to: profileForm.delivery_to || null, p_max_open_orders: 25, p_max_daily_litres: 250,
        p_acceptance_timeout_minutes: 10,
      });
      if (result.error) throw result.error;
      setNotice({ kind: "success", text: "Seller profile saved. Verification and publishing status remain controlled by marketplace policy." });
      await load();
    } catch (error) { setNotice({ kind: "error", text: String((error as { message?: string })?.message ?? error) }); }
    finally { setBusy(false); }
  }

  async function toggleStore() {
    if (!profile?.id) return;
    setBusy(true); setNotice(null);
    try {
      const supabase = getBrowserSupabaseClient();
      if (!supabase) throw new Error("Supabase is not configured.");
      const next = profile.accepting_orders === false;
      const result = await supabase.rpc("provider_set_store_status", { p_provider_id: profile.id, p_accepting_orders: next });
      if (result.error) throw result.error;
      setNotice({ kind: "success", text: next ? "Store is accepting orders." : "Store paused; new customer orders should not be offered." });
      await load();
    } catch (error) { setNotice({ kind: "error", text: String((error as { message?: string })?.message ?? error) }); }
    finally { setBusy(false); }
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice(null);
    try {
      if (!profile?.id) throw new Error("Complete seller onboarding first.");
      const price = Number(productForm.price_per_litre);
      if (!productForm.name.trim() || !Number.isFinite(price) || price <= 0 || price > 100000) throw new Error("Enter a product name and a valid price per litre.");
      const supabase = getBrowserSupabaseClient();
      if (!supabase) throw new Error("Supabase is not configured.");
      const result = await supabase.rpc("provider_upsert_product", {
        p_provider_id: profile.id, p_product_id: productForm.id || null, p_name: productForm.name.trim(),
        p_milk_type: productForm.milk_type, p_price_per_litre: price, p_unit_label: productForm.unit_label,
        p_stock: productForm.stock, p_daily_available: productForm.daily_available, p_is_active: productForm.is_active,
      });
      if (result.error) throw result.error;
      setProductForm(emptyProduct);
      setNotice({ kind: "success", text: "Product saved." });
      await load();
    } catch (error) { setNotice({ kind: "error", text: String((error as { message?: string })?.message ?? error) }); }
    finally { setBusy(false); }
  }

  async function quickToggleStock(product: Product) {
    setBusy(true); setNotice(null);
    try {
      const supabase = getBrowserSupabaseClient();
      if (!supabase) throw new Error("Supabase is not configured.");
      const result = await supabase.rpc("provider_upsert_product", {
        p_provider_id: profile?.id, p_product_id: product.id, p_name: product.name,
        p_milk_type: product.milk_type, p_price_per_litre: Number(product.price_per_litre),
        p_unit_label: product.unit_label || "1 L", p_stock: !product.stock,
        p_daily_available: product.daily_available, p_is_active: product.is_active,
      });
      if (result.error) throw result.error;
      setProducts((current) => current.map((item) => item.id === product.id ? { ...item, stock: !product.stock } : item));
      setNotice({ kind: "success", text: product.stock ? product.name + " marked out of stock." : product.name + " marked in stock." });
    } catch (error) { setNotice({ kind: "error", text: String((error as { message?: string })?.message ?? error) }); }
    finally { setBusy(false); }
  }

  async function deleteProduct(id: string) {
    if (!window.confirm("Remove this product from your seller catalogue?")) return;
    setBusy(true);
    try {
      const supabase = getBrowserSupabaseClient();
      if (!supabase) throw new Error("Supabase is not configured.");
      const result = await supabase.rpc("provider_delete_product", { p_product_id: id });
      if (result.error) throw result.error;
      setNotice({ kind: "success", text: "Product removed from the catalogue." });
      await load();
    } catch (error) { setNotice({ kind: "error", text: String((error as { message?: string })?.message ?? error) }); }
    finally { setBusy(false); }
  }

  function editProduct(product: Product) {
    setProductForm({ id: product.id, name: product.name, milk_type: product.milk_type, price_per_litre: String(product.price_per_litre), unit_label: product.unit_label || "1 L", stock: product.stock, daily_available: product.daily_available, is_active: product.is_active });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveUpi(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice(null);
    try {
      if (upiEnabled && (!/^[\w.-]{2,256}@[A-Za-z]{2,64}$/.test(upiId.trim()) || upiPayee.trim().length < 2)) throw new Error("Enter a valid UPI ID and the payee name shown in your UPI app.");
      const supabase = getBrowserSupabaseClient();
      if (!supabase) throw new Error("Supabase is not configured.");
      const result = await supabase.rpc("provider_save_direct_upi", { p_upi_id: upiId.trim(), p_payee_name: upiPayee.trim(), p_enabled: upiEnabled });
      if (result.error) throw result.error;
      setNotice({ kind: "success", text: "Direct UPI settings saved. Test the payee name before taking customer payments." });
      await load();
    } catch (error) { setNotice({ kind: "error", text: String((error as { message?: string })?.message ?? error) }); }
    finally { setBusy(false); }
  }

  async function updateStatus(orderId: string, status: string) {
    let reason: string | null = null;
    if (["rejected", "cancelled"].includes(status)) {
      reason = (window.prompt("Reason for " + status + ":") ?? "").trim().slice(0, 300);
      if (!reason) return;
    }
    setBusy(true); setNotice(null);
    try {
      const supabase = getBrowserSupabaseClient();
      if (!supabase) throw new Error("Supabase is not configured.");
      const result = await supabase.rpc("provider_update_order_status", { p_order_id: orderId, p_new_status: status, p_reason: reason });
      if (result.error) throw result.error;
      setNotice({ kind: "success", text: "Order status updated." });
      await load();
    } catch (error) { setNotice({ kind: "error", text: String((error as { message?: string })?.message ?? error) }); }
    finally { setBusy(false); }
  }

  async function confirmPayment(orderId: string) {
    const reference = (window.prompt("Enter the transaction reference you verified with your bank/UPI app:") ?? "").trim().slice(0, 100);
    if (!reference) return;
    setBusy(true);
    try {
      const supabase = getBrowserSupabaseClient();
      if (!supabase) throw new Error("Supabase is not configured.");
      const result = await supabase.rpc("provider_confirm_direct_upi_payment", { p_order_id: orderId, p_reference: reference });
      if (result.error) throw result.error;
      setNotice({ kind: "success", text: "Direct UPI receipt was recorded. Keep the evidence for reconciliation." });
      await load();
    } catch (error) { setNotice({ kind: "error", text: String((error as { message?: string })?.message ?? error) }); }
    finally { setBusy(false); }
  }

  async function confirmCod(orderId: string) {
    if (!window.confirm("Confirm that cash was actually collected for this order?")) return;
    setBusy(true);
    try {
      const supabase = getBrowserSupabaseClient();
      if (!supabase) throw new Error("Supabase is not configured.");
      const result = await supabase.rpc("provider_confirm_cod_collected", { p_order_id: orderId });
      if (result.error) throw result.error;
      setNotice({ kind: "success", text: "Cash collection recorded." });
      await load();
    } catch (error) { setNotice({ kind: "error", text: String((error as { message?: string })?.message ?? error) }); }
    finally { setBusy(false); }
  }

  if (!authorized) return <WorkspaceFrame title="Seller workspace" description="Seller tools require a signed-in provider account."><section className="workspace-card workspace-empty"><h2>Seller sign-in required</h2><p>Sign in with the account linked to your independent milk business.</p><Link href="/auth/sign-in?return=%2Fseller" className="workspace-button workspace-button-primary">Sign in</Link></section>{notice && <p className="workspace-notice error">{notice.text}</p>}</WorkspaceFrame>;

  if (loading) return <WorkspaceFrame title="Seller workspace" description="Loading your seller data from Supabase."><section className="workspace-card"><p>Loading profile, products and order queue…</p></section></WorkspaceFrame>;

  return (
    <WorkspaceFrame title="Seller command centre" eyebrow="INDEPENDENT PROVIDER TOOLS" description="Manage your own store, live catalogue, direct payments, customer orders and delivery route.">
      {notice && <p className={"workspace-notice " + notice.kind} role={notice.kind === "error" ? "alert" : "status"}>{notice.text}</p>}
      <div className="workspace-subnav"><Link className={initialSection === "dashboard" ? "active" : ""} href="/seller">Overview</Link><Link className={initialSection === "products" ? "active" : ""} href="/seller/products">Products</Link><Link className={initialSection === "deliveries" ? "active" : ""} href="/seller/deliveries">Dispatch &amp; delivery</Link></div>
      {!profile?.id ? <section className="workspace-card">
        <p className="workspace-eyebrow">SELLER ONBOARDING</p><h2>Set up your local milk business</h2>
        <p className="workspace-muted">Only real independent/local providers belong on Doodhwala. Approval and activation are still governed by the marketplace.</p>
        <div className="seller-onboarding-progress" aria-label={"Step " + onboardingStep + " of 2"}>
          <div className="seller-onboarding-step"><span className={onboardingStep === 1 ? "current" : "complete"}>{onboardingStep === 1 ? "1" : "✓"}</span><div><strong>Business details</strong><small>Who you are and what you sell</small></div></div>
          <div className={"seller-onboarding-line " + (onboardingStep === 2 ? "complete" : "")} />
          <div className="seller-onboarding-step"><span className={onboardingStep === 2 ? "current" : ""}>2</span><div><strong>Delivery area</strong><small>Where and when you deliver</small></div></div>
        </div>
        <form className="workspace-form" onSubmit={saveProfile}>
          {onboardingStep === 1 ? <>
            <div className="seller-onboarding-fields"><label>Business name<input required autoComplete="organization" value={profileForm.display_name} onChange={(e) => profileField("display_name", e.target.value)} placeholder="e.g. Patel Dairy" /></label><label>Owner name<input required autoComplete="name" value={profileForm.owner_name} onChange={(e) => profileField("owner_name", e.target.value)} placeholder="Your full name" /></label></div>
            <label>Phone number<input required type="tel" inputMode="tel" autoComplete="tel" value={profileForm.phone} onChange={(e) => profileField("phone", e.target.value)} placeholder="Number customers can reach you on" /></label>
            <label>What kind of milk do you sell?<select value={profileForm.primary_milk_type} onChange={(e) => profileField("primary_milk_type", e.target.value)}><option value="cow">Cow milk</option><option value="buffalo">Buffalo milk</option><option value="a2">A2 milk</option><option value="mixed">A mix of milk types</option></select></label>
            <div className="seller-onboarding-actions"><span>Step 1 of 2 · About 1 minute</span><button type="button" className="workspace-button workspace-button-primary" onClick={() => { if (!profileForm.display_name.trim() || !profileForm.owner_name.trim() || !profileForm.phone.trim()) { setNotice({ kind: "error", text: "Add your business name, owner name and phone number to continue." }); return; } setNotice(null); setOnboardingStep(2); }}>Continue to delivery area →</button></div>
          </> : <>
            <p className="workspace-muted seller-onboarding-hint">Set the area you can reliably serve. Your business will still follow Doodhwala’s verification and publishing rules.</p>
            <div className="workspace-grid-two"><label>Area or locality<input required autoComplete="address-level3" value={profileForm.area_name} onChange={(e) => profileField("area_name", e.target.value)} placeholder="e.g. Satellite" /></label><label>City<input required autoComplete="address-level2" value={profileForm.city} onChange={(e) => profileField("city", e.target.value)} /></label></div>
            <div className="workspace-grid-two"><label>PIN code<input required maxLength={6} inputMode="numeric" autoComplete="postal-code" value={profileForm.pin_code} onChange={(e) => profileField("pin_code", e.target.value.replace(/\D/g, ""))} placeholder="6 digits" /></label><label>Delivery radius (km)<input required min="1" max="100" type="number" value={profileForm.service_radius_km} onChange={(e) => profileField("service_radius_km", e.target.value)} /></label></div>
            <div className="workspace-grid-two"><label>Start delivering<input type="time" value={profileForm.delivery_from} onChange={(e) => profileField("delivery_from", e.target.value)} /></label><label>Finish delivering<input type="time" value={profileForm.delivery_to} onChange={(e) => profileField("delivery_to", e.target.value)} /></label></div>
            <div className="seller-onboarding-actions"><button type="button" className="workspace-button workspace-button-secondary" onClick={() => { setNotice(null); setOnboardingStep(1); }}>← Back</button><button className="workspace-button workspace-button-primary" disabled={busy}>{busy ? "Saving your details…" : "Save business details"}</button></div>
          </>}
        </form>
      </section> : <>
        {initialSection === "dashboard" && <section className="workspace-card seller-today-card">
          <div className="seller-today-head"><div><p className="workspace-eyebrow">YOUR DAILY WORKSPACE</p><h2>Today at a glance</h2><p className="workspace-muted">The next task first. Keep your store and deliveries moving.</p></div><span className={"seller-store-pill " + (profile.accepting_orders === false ? "paused" : "open")}>{profile.accepting_orders === false ? "Store paused" : "Store open"}</span></div>
          <div className="seller-today-stats"><div><strong>{orders.filter((o) => ["pending","placed","confirmed","new"].includes(o.status)).length}</strong><span>Need your decision</span></div><div><strong>{orders.filter((o) => ["accepted","preparing"].includes(o.status)).length}</strong><span>Being prepared</span></div><div><strong>{orders.filter((o) => o.status === "out_for_delivery").length}</strong><span>Out for delivery</span></div></div>
          <div className="seller-today-actions"><Link className="workspace-button workspace-button-primary" href="/seller/deliveries">Open order queue →</Link><Link className="workspace-button workspace-button-secondary" href="/seller/products">Update milk &amp; prices</Link><button type="button" className="workspace-button workspace-button-secondary" disabled={busy} onClick={() => void toggleStore()}>{busy ? "Please wait…" : profile.accepting_orders === false ? "Resume new orders" : "Pause new orders"}</button></div>
        </section>}
        <div className="workspace-metric-grid">
          <article className="workspace-metric"><small>STORE STATUS</small><strong>{profile.accepting_orders === false ? "Paused" : "Accepting orders"}</strong><span>Verification: {profile.verification_status ?? "pending"}</span><button className="workspace-text-button" disabled={busy} onClick={() => void toggleStore()}>{profile.accepting_orders === false ? "Resume orders" : "Pause new orders"}</button></article>
          <article className="workspace-metric"><small>PRODUCTS</small><strong>{products.length}</strong><span>{products.filter((p) => p.is_active && p.stock).length} active and in stock</span><Link href="/seller/products">Manage products →</Link></article>
          <article className="workspace-metric"><small>ORDER QUEUE</small><strong>{orders.filter((o) => !["delivered","cancelled","rejected"].includes(o.status)).length}</strong><span>Current orders for your provider profile</span><Link href="/seller/deliveries">Open dispatch →</Link></article>
        </div>
        {initialSection === "products" && <section className="workspace-card">
          <p className="workspace-eyebrow">CATALOGUE MANAGEMENT</p><h2>{productForm.id ? "Edit product" : "Add a product"}</h2>
          <form className="workspace-form" onSubmit={saveProduct}>
            <label>Product name<input required value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} /></label>
            <div className="workspace-grid-two"><label>Milk type<select value={productForm.milk_type} onChange={(e) => setProductForm({ ...productForm, milk_type: e.target.value })}><option value="cow">Cow</option><option value="buffalo">Buffalo</option><option value="a2">A2</option><option value="mixed">Mixed</option><option value="other">Other</option></select></label><label>Price per litre (₹)<input type="number" min="0.01" step="0.01" required value={productForm.price_per_litre} onChange={(e) => setProductForm({ ...productForm, price_per_litre: e.target.value })} /></label></div>
            <label>Unit label<input required maxLength={40} value={productForm.unit_label} onChange={(e) => setProductForm({ ...productForm, unit_label: e.target.value })} /></label>
            <div className="workspace-grid-two"><label className="workspace-checkbox"><input type="checkbox" checked={productForm.stock} onChange={(e) => setProductForm({ ...productForm, stock: e.target.checked })} /> In stock</label><label className="workspace-checkbox"><input type="checkbox" checked={productForm.daily_available} onChange={(e) => setProductForm({ ...productForm, daily_available: e.target.checked })} /> Daily plan available</label></div>
            <label className="workspace-checkbox"><input type="checkbox" checked={productForm.is_active} onChange={(e) => setProductForm({ ...productForm, is_active: e.target.checked })} /> Active listing</label>
            <div className="workspace-actions"><button className="workspace-button workspace-button-primary" disabled={busy}>{busy ? "Saving…" : "Save product"}</button>{productForm.id && <button className="workspace-button workspace-button-secondary" type="button" onClick={() => setProductForm(emptyProduct)}>Cancel edit</button>}</div>
          </form>
          <div className="workspace-list">{products.map((p) => <article className="workspace-list-row" key={p.id}><div className="workspace-item-icon">✳</div><div className="workspace-list-main"><strong>{p.name}</strong><span>{p.milk_type} · {money.format(Number(p.price_per_litre))}/L · {p.unit_label}</span><small>{p.is_active ? "Active" : "Hidden"} · {p.stock ? "In stock" : "Out of stock"} · {p.daily_available ? "Daily delivery" : "No daily plan"}</small></div><div className="workspace-row-actions"><button className="workspace-text-button" onClick={() => editProduct(p)}>Edit</button><button className="workspace-text-button danger" disabled={busy} onClick={() => void deleteProduct(p.id)}>Delete</button></div></article>)}</div>
        </section>}
        {initialSection === "deliveries" && <>
          <section className="workspace-card"><p className="workspace-eyebrow">YOUR NEXT TASK</p><h2>Order queue</h2><p className="workspace-muted">Start with orders that need a decision. Accept or reject new requests, then update each order as you prepare and deliver it.</p><div className="workspace-inline-form"><label>Delivery date<input type="date" value={routeDate} onChange={(e) => setRouteDate(e.target.value)} /></label><button className="workspace-button workspace-button-secondary" onClick={() => void load()} disabled={loading || busy}>{loading ? "Refreshing…" : "Refresh orders"}</button></div><div className="workspace-subnav workspace-order-filters" aria-label="Filter order queue"><button type="button" className={orderFilter === "needs-action" ? "active" : ""} onClick={() => setOrderFilter("needs-action")}>Needs action</button><button type="button" className={orderFilter === "preparing" ? "active" : ""} onClick={() => setOrderFilter("preparing")}>Preparing</button><button type="button" className={orderFilter === "delivery" ? "active" : ""} onClick={() => setOrderFilter("delivery")}>Out for delivery</button><button type="button" className={orderFilter === "all" ? "active" : ""} onClick={() => setOrderFilter("all")}>All orders</button></div><p className="workspace-muted">{visibleOrders.length} order{visibleOrders.length === 1 ? "" : "s"} shown · {orders.filter((o) => !["delivered","cancelled","rejected"].includes(o.status)).length} active</p>
            {!orders.length ? <p className="workspace-muted">No customer orders yet. New orders from your customers will appear here.</p> : !visibleOrders.length ? <p className="workspace-muted">Nothing in this queue right now. Try another filter or refresh orders.</p> : <div className="workspace-list">{visibleOrders.map((order) => <article className="workspace-list-row" key={order.id}><div className="workspace-list-main"><strong>Order {order.id.slice(0,8).toUpperCase()} · {money.format(Number(order.total ?? 0))}</strong><span>{statusLabel(order.status)} · {order.delivery_recipient_name || "Customer"} · {[order.delivery_area_name,order.delivery_city].filter(Boolean).join(", ")}</span><small>{order.order_items?.map((i) => (i.product_name_snapshot || "Milk") + " × " + i.quantity).join(" · ")}{order.customer_note ? " · Note: " + order.customer_note : ""}</small></div><div className="workspace-row-actions">{["pending","placed","confirmed","new"].includes(order.status) && <button type="button" className="workspace-button workspace-button-primary workspace-order-quick-action" disabled={busy} onClick={() => void updateStatus(order.id, "accepted")}>Accept order</button>}{order.status === "accepted" && <button type="button" className="workspace-button workspace-button-primary workspace-order-quick-action" disabled={busy} onClick={() => void updateStatus(order.id, "preparing")}>Start preparing</button>}{order.status === "preparing" && <button type="button" className="workspace-button workspace-button-primary workspace-order-quick-action" disabled={busy} onClick={() => void updateStatus(order.id, "out_for_delivery")}>Out for delivery</button>}{order.status === "out_for_delivery" && <button type="button" className="workspace-button workspace-button-primary workspace-order-quick-action" disabled={busy} onClick={() => void updateStatus(order.id, "delivered")}>Mark delivered</button>}<select aria-label={"More status actions for order " + order.id} defaultValue="" onChange={(e) => { const v = e.target.value; if (v) void updateStatus(order.id, v); e.target.value = ""; }}><option value="">Update status…</option><option value="accepted">Accept</option><option value="rejected">Reject</option><option value="preparing">Preparing</option><option value="out_for_delivery">Out for delivery</option><option value="delivered">Delivered</option><option value="cancelled">Cancel</option></select>{order.payment_method === "direct_upi" && order.payment_status === "payment_pending_verification" && <button className="workspace-text-button" disabled={busy} onClick={() => void confirmPayment(order.id)}>Confirm UPI received</button>}{order.payment_method === "cod" && order.payment_status !== "paid_cod" && <button className="workspace-text-button" disabled={busy} onClick={() => void confirmCod(order.id)}>Confirm COD collected</button>}</div></article>)}</div>}
          </section>
          <section className="workspace-card"><p className="workspace-eyebrow">RECURRING ROUTE</p><h2>Today's delivery plan</h2>{routeRows.length ? <div className="workspace-list">{routeRows.map((row, index) => <div className="workspace-list-row" key={String(row.id ?? row.subscription_id ?? index)}><div className="workspace-list-main"><strong>{String(row.customer_name ?? row.recipient_name ?? row.product_name ?? "Scheduled stop")}</strong><span>{String(row.area_name ?? row.address_line ?? "")} · {String(row.quantity_litres ?? "")} L · {String(row.status ?? "")}</span></div></div>)}</div> : <p className="workspace-muted">No recurring-route rows were returned for this date.</p>}</section>
          <section className="workspace-card"><p className="workspace-eyebrow">DISPATCH INTELLIGENCE</p><h2>Prepared delivery board</h2>{dispatchRows.length ? <div className="workspace-list">{dispatchRows.map((row,index)=><div className="workspace-list-row" key={String(row.id ?? row.order_id ?? index)}><div className="workspace-list-main"><strong>{String(row.customer_name ?? row.recipient_name ?? row.order_id ?? "Dispatch item")}</strong><span>{String(row.status ?? "")} · {String(row.estimated_delivery_min_minutes ?? "")}{row.estimated_delivery_max_minutes ? "–" + String(row.estimated_delivery_max_minutes) + " min" : ""}</span></div></div>)}</div> : <p className="workspace-muted">No dispatch-board rows were returned for this date.</p>}</section>
        </>}
        {initialSection === "dashboard" && <>
          <div className="workspace-metric-grid">
            <article className="workspace-metric"><small>OPEN ORDERS</small><strong>{String(sellerMetrics.open_orders ?? 0)}</strong><span>Orders requiring provider action</span><Link href="/seller/deliveries">Open queue →</Link></article>
            <article className="workspace-metric"><small>SALES TODAY</small><strong>{money.format(Number(sellerMetrics.sales_today ?? 0))}</strong><span>Reported by the provider dashboard RPC</span></article>
            <article className="workspace-metric"><small>PRODUCTS IN STOCK</small><strong>{products.filter((p) => p.stock && p.is_active).length}</strong><span>Current live seller catalogue</span></article>
          </div>
          <section className="workspace-card"><p className="workspace-eyebrow">DELIVERY COVERAGE</p><h2>Set your business location</h2><p className="workspace-muted">Share the dairy/base location only when you press the button. This enables distance-based provider discovery; the browser will ask you to grant permission.</p><button type="button" className="workspace-button workspace-button-secondary" disabled={busy} onClick={() => void setServiceLocation()}>Use this device location for service area</button></section>
          <section className="workspace-card"><p className="workspace-eyebrow">PAYMENT SETTINGS</p><h2>Direct seller UPI</h2><p className="workspace-muted">Payments go directly to your UPI/bank account. Doodhwala does not hold these funds.</p><form className="workspace-form" onSubmit={saveUpi}><label>UPI ID<input value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="seller@upi" /></label><label>Payee name shown in the UPI app<input value={upiPayee} onChange={(e) => setUpiPayee(e.target.value)} /></label><label className="workspace-checkbox"><input type="checkbox" checked={upiEnabled} onChange={(e) => setUpiEnabled(e.target.checked)} /> Enable direct UPI for eligible orders</label><button className="workspace-button workspace-button-primary" disabled={busy}>Save payment settings</button></form></section>
          <section className="workspace-card"><div className="workspace-section-head"><div><p className="workspace-eyebrow">QUICK STOCK</p><h2>Milk available today</h2><p className="workspace-muted">Mark a product out of stock in one tap. Price and delivery plan stay unchanged.</p></div><Link className="workspace-inline-link" href="/seller/products">Edit prices →</Link></div>{products.slice(0,6).map((p)=><div className="workspace-summary-item seller-stock-row" key={p.id}><span><strong>{p.name}</strong><small>{money.format(Number(p.price_per_litre))}/L · {p.is_active?"Active":"Hidden"} · {p.stock?"In stock":"Out of stock"}</small></span><button type="button" className={"seller-stock-toggle " + (p.stock ? "in-stock" : "out-stock")} disabled={busy || !p.is_active} onClick={() => void quickToggleStock(p)}>{busy ? "Saving…" : p.stock ? "Mark sold out" : "Restock"}</button></div>)}<Link className="workspace-inline-link" href="/seller/products">Manage the full catalogue →</Link></section>
          <section className="workspace-card"><p className="workspace-eyebrow">SUBSCRIBER OPERATIONS</p><h2>Recurring customers</h2>{subscriptions.length ? <div className="workspace-list">{subscriptions.slice(0,15).map((s,index)=><div className="workspace-list-row" key={String(s.id ?? index)}><div className="workspace-list-main"><strong>{String(s.customer_name ?? s.product_name ?? "Milk subscription")}</strong><span>{String(s.status ?? "active")} · {String(s.quantity_litres ?? "")} L · {String(s.delivery_time ?? "")}</span></div></div>)}</div> : <p className="workspace-muted">No subscription rows available.</p>}</section>
        </>}
      </>}
    </WorkspaceFrame>
  );
}
