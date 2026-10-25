import Link from "next/link";
"use client";

import { useCallback, useEffect, useState } from "react";
import WorkspaceFrame from "@/components/workspace-frame";
import { addCartItem, readCart, writeCart, type Cart } from "@/lib/commerce/cart";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser";

interface OrderItem {
  product_id?: string | null;
  product_name_snapshot?: string | null;
  quantity?: number | null;
  unit_price?: number | null;
  line_total?: number | null;
}
interface OrderRow {
  id: string;
  status: string;
  subtotal?: number | null;
  delivery_fee?: number | null;
  total?: number | null;
  customer_note?: string | null;
  created_at?: string | null;
  provider_id?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  payment_reference?: string | null;
  provider_profiles?: { display_name?: string | null; area_name?: string | null; city?: string | null } | null;
  order_items?: OrderItem[];
  order_ratings?: Array<{ stars?: number; comment?: string | null }>;
}
interface TimelineEvent { order_id: string; from_status?: string | null; to_status?: string | null; reason?: string | null; created_at?: string | null; }
type Notice = { kind: "error" | "success" | "info"; text: string } | null;
const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

export default function OrdersWorkspace({ orderId }: { orderId?: string }) {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [notice, setNotice] = useState<Notice>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [paymentLink, setPaymentLink] = useState<{ orderId: string; url: string; payee: string } | null>(null);

  const load = useCallback(async () => {
    setNotice(null);
    const supabase = getBrowserSupabaseClient();
    if (!supabase) { setNotice({ kind: "error", text: "Supabase is not configured for this environment." }); return; }
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) { setSignedIn(false); return; }
    setSignedIn(true);
    let query = supabase.from("orders").select("id,status,subtotal,delivery_fee,total,customer_note,created_at,provider_id,payment_method,payment_status,payment_reference,provider_profiles(display_name,area_name,city),order_items(product_id,product_name_snapshot,quantity,unit_price,line_total),order_ratings(stars,comment)").eq("customer_id", userData.user.id).order("created_at", { ascending: false }).limit(50);
    if (orderId) query = query.eq("id", orderId) as typeof query;
    const result = await query;
    if (result.error) { setNotice({ kind: "error", text: "We couldn’t load your orders: " + result.error.message }); return; }
    const rows = (result.data ?? []) as unknown as OrderRow[];
    setOrders(rows);
    const ids = rows.map((order) => order.id);
    if (!ids.length) { setEvents([]); return; }
    const timeline = await supabase.from("order_status_events").select("order_id,from_status,to_status,reason,created_at").in("order_id", ids).order("created_at", { ascending: true });
    if (!timeline.error) setEvents((timeline.data ?? []) as TimelineEvent[]);
  }, [orderId]);

  useEffect(() => { void load(); }, [load]);

  async function cancelOrder(id: string) {
    const reason = window.prompt("Why are you cancelling this order?")?.trim().slice(0, 300) ?? "";
    if (!reason) return;
    setBusyId(id); setNotice(null);
    try {
      const supabase = getBrowserSupabaseClient();
      if (!supabase) throw new Error("Supabase is not configured.");
      const { error } = await supabase.rpc("customer_cancel_order", { p_order_id: id, p_reason: reason });
      if (error) throw error;
      setNotice({ kind: "success", text: "Cancellation request completed." });
      await load();
    } catch (error) { setNotice({ kind: "error", text: String((error as { message?: string })?.message ?? error) }); }
    finally { setBusyId(""); }
  }

  async function rateOrder(id: string) {
    const answer = window.prompt("Rate this seller from 1 to 5 stars:");
    if (answer === null) return;
    const stars = Number(answer.trim());
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
      setNotice({ kind: "error", text: "Enter a whole-number rating from 1 to 5." });
      return;
    }
    const comment = (window.prompt("Optional feedback for the seller (max 500 characters):") ?? "").trim().slice(0, 500);
    setBusyId(id); setNotice(null);
    try {
      const supabase = getBrowserSupabaseClient();
      if (!supabase) throw new Error("Supabase is not configured.");
      const { error } = await supabase.rpc("submit_order_rating", { p_order_id: id, p_stars: stars, p_comment: comment || null });
      if (error) throw error;
      setNotice({ kind: "success", text: "Thanks — your rating was saved." });
      await load();
    } catch (error) { setNotice({ kind: "error", text: String((error as { message?: string })?.message ?? error) }); }
    finally { setBusyId(""); }
  }

  async function getDirectUpi(id: string) {
    setBusyId(id); setNotice(null);
    try {
      const supabase = getBrowserSupabaseClient();
      if (!supabase) throw new Error("Supabase is not configured.");
      const { data, error } = await supabase.rpc("customer_get_order_direct_upi", { p_order_id: id });
      if (error) throw error;
      if (!data?.upi_id || !data?.payee_name) throw new Error("Seller UPI details are not available for this order.");
      const amount = Number(data.amount);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("The payable amount could not be verified. Contact the seller before paying.");
      const params = new URLSearchParams({ pa: String(data.upi_id), pn: String(data.payee_name), am: amount.toFixed(2), cu: "INR", tn: "Doodhwala order " + id.slice(0, 8) });
      setPaymentLink({ orderId: id, url: "upi://pay?" + params.toString(), payee: String(data.payee_name) });
      setNotice({ kind: "info", text: "Check the payee name and amount in your UPI app. The seller must confirm receipt; do not treat a launched UPI app as payment confirmation." });
    } catch (error) { setNotice({ kind: "error", text: String((error as { message?: string })?.message ?? error) }); }
    finally { setBusyId(""); }
  }

  function reorder(order: OrderRow) {
    let cart: Cart = readCart();
    let added = 0;
    for (const item of order.order_items ?? []) {
      if (!item.product_id || !order.provider_id) continue;
      const quantity = Number(item.quantity);
      const price = Number(item.unit_price);
      if (quantity <= 0 || !Number.isFinite(quantity) || !Number.isFinite(price) || price < 0) continue;
      cart = addCartItem(cart, {
        productId: item.product_id, providerId: order.provider_id,
        milk: String(item.product_name_snapshot ?? "Milk"),
        provider: String(order.provider_profiles?.display_name ?? "Local seller"),
        unitPrice: price, qty: quantity,
      });
      added += 1;
    }
    writeCart(cart);
    if (added) window.location.assign("/cart");
    else setNotice({ kind: "error", text: "This order no longer exposes valid product references for reorder. Browse the live catalogue instead." });
  }

  if (!signedIn) return (
    <WorkspaceFrame title={orderId ? "Order details" : "Your orders"} description="Sign in to see order status, delivery updates and payment instructions.">
      <section className="workspace-card workspace-empty"><h2>Your order history is private</h2><p>Sign in to continue.</p><Link className="workspace-button workspace-button-primary" href={"/auth/sign-in?return=" + encodeURIComponent(orderId ? "/orders/" + orderId : "/orders")}>Sign in</Link></section>
      {notice && <p className="workspace-notice error">{notice.text}</p>}
    </WorkspaceFrame>
  );

  return (
    <WorkspaceFrame title={orderId ? "Order details" : "Your orders"} description="Follow each seller order and review delivery and payment status.">
      {notice && <p className={"workspace-notice " + notice.kind} role={notice.kind === "error" ? "alert" : "status"}>{notice.text}</p>}
      {paymentLink && <section className="workspace-card workspace-payment-link"><p className="workspace-eyebrow">DIRECT SELLER UPI</p><h2>Pay {paymentLink.payee}</h2><p>Verify payee and amount inside your UPI app before authorizing.</p><Link className="workspace-button workspace-button-primary" href={paymentLink.url}>Open UPI app</Link><button className="workspace-button workspace-button-secondary" onClick={() => setPaymentLink(null)}>Close payment instructions</button></section>}
      <div className="workspace-section-head"><div><p className="workspace-eyebrow">ORDER HISTORY</p><h2>{orders.length} order{orders.length === 1 ? "" : "s"}</h2></div><button className="workspace-button workspace-button-secondary workspace-small-button" onClick={() => void load()}>Refresh</button></div>
      {!orders.length ? <section className="workspace-card workspace-empty"><h2>No orders found</h2><p>Your completed and active orders will appear here.</p><Link href="/providers" className="workspace-button workspace-button-primary">Find local milk</Link></section> : <div className="workspace-order-list">
        {orders.map((order) => {
          const supplier = order.provider_profiles ?? {};
          const history = events.filter((event) => event.order_id === order.id);
          const canCancel = ["placed", "accepted"].includes(String(order.status).toLowerCase());
          const canPay = order.payment_method === "direct_upi" && order.payment_status === "payment_pending_verification";
          const rating = Array.isArray(order.order_ratings) ? order.order_ratings[0] : undefined;
          return <article className="workspace-card workspace-order-card" key={order.id}>
            <div className="workspace-order-head"><div><p className="workspace-eyebrow">ORDER {order.id.slice(0, 8).toUpperCase()}</p><h2>{supplier.display_name || "Local milk seller"}</h2><p>{[supplier.area_name, supplier.city].filter(Boolean).join(" · ") || "Independent provider"}</p></div><span className={"workspace-status status-" + String(order.status).toLowerCase()}>{order.status.replace(/_/g, " ")}</span></div>
            <div className="workspace-summary-lines">{(order.order_items ?? []).map((item, index) => <div className="workspace-summary-item" key={String(item.product_id ?? index)}><span><strong>{item.product_name_snapshot || "Milk"}</strong><small>{Number(item.quantity || 0)} L</small></span><b>{money.format(Number(item.line_total ?? 0))}</b></div>)}</div>
            <div className="workspace-summary-line"><span>Payment</span><strong>{order.payment_method === "direct_upi" ? "Direct seller UPI" : order.payment_method === "cod" ? "Cash on Delivery" : order.payment_method || "Pending"}</strong></div>
            <div className="workspace-summary-line"><span>Payment status</span><strong>{String(order.payment_status ?? "unavailable").replace(/_/g, " ")}</strong></div>
            <div className="workspace-summary-line workspace-summary-total"><span>Total</span><strong>{money.format(Number(order.total ?? 0))}</strong></div>
            {order.customer_note && <p className="workspace-muted">Note: {order.customer_note}</p>}
            {history.length > 0 && <details className="workspace-timeline"><summary>Delivery timeline ({history.length})</summary><ol>{history.map((event, index) => <li key={event.created_at + ":" + index}><strong>{event.to_status || "Updated"}</strong><span>{event.reason || event.from_status || "Order status updated"}</span><time>{event.created_at ? new Date(event.created_at).toLocaleString("en-IN") : ""}</time></li>)}</ol></details>}
            <div className="workspace-row-actions">
              <Link href={"/orders/" + encodeURIComponent(order.id)} className="workspace-inline-link">Details</Link>
              <button className="workspace-text-button" onClick={() => reorder(order)}>Reorder</button>
              {canPay && <button className="workspace-text-button" disabled={busyId === order.id} onClick={() => void getDirectUpi(order.id)}>{busyId === order.id ? "Checking…" : "Pay with UPI"}</button>}
              {canCancel && <button className="workspace-text-button danger" disabled={busyId === order.id} onClick={() => void cancelOrder(order.id)}>{busyId === order.id ? "Working…" : "Cancel order"}</button>}
              {String(order.status).toLowerCase() === "delivered" && !rating && <button className="workspace-text-button" disabled={busyId === order.id} onClick={() => void rateOrder(order.id)}>Rate seller</button>}
              {rating && <span className="workspace-muted">Rated {rating.stars}/5</span>}
            </div>
          </article>;
        })}
      </div>}
    </WorkspaceFrame>
  );
}
