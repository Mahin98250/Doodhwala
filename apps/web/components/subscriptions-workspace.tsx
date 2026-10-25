"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import WorkspaceFrame from "@/components/workspace-frame";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser";

interface Address { id: string; label?: string | null; recipient_name?: string | null; address_line?: string | null; area_name?: string | null; city?: string | null; pin_code?: string | null; }
interface Product { id: string; name: string; milk_type: string; price_per_litre: number; unit_label?: string | null; provider_id: string; daily_available: boolean; stock: boolean; is_active: boolean; provider_profiles?: { display_name?: string; area_name?: string; city?: string; is_active?: boolean } | null; }
interface Plan {
  id: string; status: string; quantity_litres: number; price_per_litre: number; delivery_time: string; start_date: string; end_date: string;
  days_of_week?: number[] | null; cutoff_minutes?: number | null; customer_note?: string | null; paused_until?: string | null;
  provider_id: string; product_id: string; address_id: string; provider_profiles?: { display_name?: string; area_name?: string; city?: string; delivery_from?: string; delivery_to?: string } | null;
  milk_products?: { name?: string; milk_type?: string } | null; addresses?: { label?: string; address_line?: string; area_name?: string; city?: string; pin_code?: string } | null;
}
interface Delivery { id: string; subscription_id: string; scheduled_for?: string | null; delivery_date?: string | null; quantity_litres: number; unit_price: number; status: string; order_id?: string | null; }
type Notice = { kind: "error" | "success" | "info"; text: string } | null;
const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const DAYS = [{n:0,label:"Sun"},{n:1,label:"Mon"},{n:2,label:"Tue"},{n:3,label:"Wed"},{n:4,label:"Thu"},{n:5,label:"Fri"},{n:6,label:"Sat"}];
const plusDays = (amount: number) => { const d = new Date(); d.setDate(d.getDate() + amount); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0"); };

export default function SubscriptionsWorkspace({ subscriptionId }: { subscriptionId?: string }) {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [productId, setProductId] = useState("");
  const [addressId, setAddressId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [time, setTime] = useState("06:30");
  const [start, setStart] = useState(plusDays(1));
  const [end, setEnd] = useState(plusDays(30));
  const [note, setNote] = useState("");
  const [days, setDays] = useState<number[]>([1,2,3,4,5,6]);
  const [edit, setEdit] = useState<Record<string, { quantity: string; time: string; addressId: string; expanded: boolean }>>({});
  const [pauseUntil, setPauseUntil] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  const load = useCallback(async () => {
    const supabase = getBrowserSupabaseClient();
    if (!supabase) { setNotice({ kind: "error", text: "Supabase is not configured." }); return; }
    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData.user) { setSignedIn(false); return; }
    setSignedIn(true);
    const [addressResult, productResult, planResult] = await Promise.all([
      supabase.from("addresses").select("id,label,recipient_name,address_line,area_name,city,pin_code").eq("user_id", userData.user.id).order("is_default", { ascending: false }),
      supabase.from("milk_products").select("id,name,milk_type,price_per_litre,unit_label,stock,daily_available,is_active,provider_id,provider_profiles(display_name,area_name,city,is_active)").eq("is_active", true).eq("stock", true).eq("daily_available", true).order("created_at", { ascending: false }).limit(150),
      supabase.from("milk_subscriptions").select("id,status,quantity_litres,price_per_litre,delivery_time,start_date,end_date,days_of_week,cutoff_minutes,customer_note,paused_until,provider_id,product_id,address_id,provider_profiles(display_name,area_name,city,delivery_from,delivery_to),milk_products(name,milk_type),addresses(label,address_line,area_name,city,pin_code)").eq("customer_id", userData.user.id).order("created_at", { ascending: false }).limit(100),
    ]);
    if (addressResult.error || productResult.error || planResult.error) {
      setNotice({ kind: "error", text: [addressResult.error, productResult.error, planResult.error].find(Boolean)?.message ?? "Unable to load your subscriptions." });
      return;
    }
    const nextAddresses = (addressResult.data ?? []) as Address[];
    const nextProducts = ((productResult.data ?? []) as unknown as Product[]).filter((item) => item.provider_profiles?.is_active !== false);
    const nextPlans = (planResult.data ?? []) as unknown as Plan[];
    setAddresses(nextAddresses); setProducts(nextProducts); setPlans(nextPlans);
    if (!addressId && nextAddresses.length) setAddressId(nextAddresses[0].id);
    if (!productId) {
      const params = new URLSearchParams(window.location.search);
      const requested = params.get("product");
      setProductId(requested && nextProducts.some((p) => p.id === requested) ? requested : nextProducts[0]?.id ?? "");
    }
    const ids = nextPlans.map((plan) => plan.id);
    if (ids.length) {
      const result = await supabase.from("subscription_deliveries").select("id,subscription_id,scheduled_for,delivery_date,quantity_litres,unit_price,status,order_id").in("subscription_id", ids).order("scheduled_for", { ascending: true }).limit(400);
      if (!result.error) setDeliveries((result.data ?? []) as Delivery[]);
    } else setDeliveries([]);
    setEdit((old) => {
      const next = { ...old };
      for (const p of nextPlans) if (!next[p.id]) next[p.id] = { quantity: String(p.quantity_litres), time: String(p.delivery_time ?? "06:30").slice(0,5), addressId: p.address_id, expanded: false };
      return next;
    });
  }, [addressId, productId]);

  useEffect(() => { void load(); }, [load]);

  const selectedProduct = useMemo(() => products.find((product) => product.id === productId) ?? null, [products, productId]);
  const deliveryCount = useMemo(() => {
    if (!start || !end || end < start || !days.length) return 0;
    let total = 0;
    const date = new Date(start + "T12:00:00");
    const last = new Date(end + "T12:00:00");
    while (date <= last && total < 1000) { if (days.includes(date.getDay())) total += 1; date.setDate(date.getDate() + 1); }
    return total;
  }, [start, end, days]);

  async function createPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice(null);
    try {
      const supabase = getBrowserSupabaseClient();
      if (!supabase) throw new Error("Supabase is not configured.");
      if (!productId || !addressId) throw new Error("Choose an available product and a saved delivery address.");
      if (!days.length || end < start || !time) throw new Error("Check the dates, time and at least one delivery day.");
      const q = Number(quantity);
      if (!Number.isFinite(q) || q < 0.5 || q > 20) throw new Error("Choose a daily quantity between 0.5 and 20 litres.");
      const result = await supabase.rpc("create_milk_subscription", {
        p_provider_id: selectedProduct?.provider_id,
        p_product_id: productId,
        p_address_id: addressId,
        p_quantity_litres: q,
        p_delivery_time: time + ":00",
        p_start_date: start,
        p_end_date: end,
        p_days_of_week: days,
        p_customer_note: note.trim().slice(0, 500) || null,
        p_cutoff_minutes: 120,
      });
      if (result.error) throw result.error;
      setNotice({ kind: "success", text: "Milk subscription created. The provider and database schedule remain authoritative." });
      await load();
    } catch (error) { setNotice({ kind: "error", text: String((error as { message?: string })?.message ?? error) }); }
    finally { setBusy(false); }
  }

  async function act(id: string, action: "pause" | "resume" | "cancel" | "skip") {
    setBusy(true); setNotice(null);
    try {
      const supabase = getBrowserSupabaseClient();
      if (!supabase) throw new Error("Supabase is not configured.");
      let result;
      if (action === "pause") {
        const value = pauseUntil[id]?.trim() || null;
        if (value && value < plusDays(0)) throw new Error("Pause date cannot be in the past.");
        result = await supabase.rpc("pause_milk_subscription", { p_subscription_id: id, p_until_date: value });
      } else if (action === "resume") result = await supabase.rpc("resume_milk_subscription", { p_subscription_id: id });
      else if (action === "cancel") result = await supabase.rpc("cancel_milk_subscription", { p_subscription_id: id });
      else {
        const delivery = deliveries.find((item) => item.id === id);
        if (!delivery) throw new Error("Delivery is no longer available. Refresh and try again.");
        result = await supabase.rpc("skip_milk_delivery", { p_delivery_id: delivery.id, p_reason: "Customer skipped" });
      }
      if (result.error) throw result.error;
      setNotice({ kind: "success", text: action === "skip" ? "Delivery skip recorded." : "Subscription " + action + " request completed." });
      await load();
    } catch (error) { setNotice({ kind: "error", text: String((error as { message?: string })?.message ?? error) }); }
    finally { setBusy(false); }
  }

  async function savePlan(event: FormEvent<HTMLFormElement>, plan: Plan) {
    event.preventDefault(); setBusy(true); setNotice(null);
    try {
      const values = edit[plan.id];
      if (!values?.addressId || !values.time) throw new Error("Choose a delivery address and time.");
      const q = Number(values.quantity);
      if (!Number.isFinite(q) || q < 0.5 || q > 20) throw new Error("Choose a quantity between 0.5 and 20 litres.");
      const supabase = getBrowserSupabaseClient();
      if (!supabase) throw new Error("Supabase is not configured.");
      const result = await supabase.rpc("update_milk_subscription", { p_subscription_id: plan.id, p_quantity_litres: q, p_delivery_time: values.time + ":00", p_address_id: values.addressId });
      if (result.error) throw result.error;
      setNotice({ kind: "success", text: "Subscription updated." });
      await load();
    } catch (error) { setNotice({ kind: "error", text: String((error as { message?: string })?.message ?? error) }); }
    finally { setBusy(false); }
  }

  if (!signedIn) return <WorkspaceFrame title={subscriptionId ? "Subscription details" : "Milk subscriptions"} description="Create, pause or skip recurring local milk deliveries."><section className="workspace-card workspace-empty"><h2>Sign in to manage milk plans</h2><a className="workspace-button workspace-button-primary" href="/auth/sign-in?return=%2Fsubscriptions">Sign in</a></section></WorkspaceFrame>;

  return (
    <WorkspaceFrame title={subscriptionId ? "Subscription details" : "Daily milk plans"} description="Set a schedule once, and manage pauses, skipped deliveries and changes from the same place.">
      {notice && <p className={"workspace-notice " + notice.kind} role={notice.kind === "error" ? "alert" : "status"}>{notice.text}</p>}
      {subscriptionId && <p className="workspace-muted">Viewing subscription {subscriptionId}. To protect account privacy, details below are loaded only from your own subscriptions.</p>}
      <section className="workspace-card">
        <p className="workspace-eyebrow">NEW SUBSCRIPTION</p><h2>Set your recurring delivery</h2>
        {!addresses.length && <p className="workspace-notice info">Add a delivery address in <a href="/account">your account</a> before creating a plan.</p>}
        {!products.length && <p className="workspace-muted">No live products currently advertise daily availability. Try later or choose another product from the catalogue.</p>}
        <form className="workspace-form" onSubmit={createPlan}>
          <label>Milk product<select required value={productId} onChange={(e) => setProductId(e.target.value)}><option value="">Choose milk</option>{products.map((p) => <option value={p.id} key={p.id}>{p.name} · {p.provider_profiles?.display_name ?? "Local seller"} · {money.format(Number(p.price_per_litre))}/L</option>)}</select></label>
          <div className="workspace-grid-two"><label>Daily quantity<select value={quantity} onChange={(e) => setQuantity(e.target.value)}>{["0.5","1","1.5","2","3","4","5","8","10","15","20"].map((v) => <option key={v} value={v}>{v} litres</option>)}</select></label><label>Delivery time<input required type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label></div>
          <div className="workspace-grid-two"><label>Start date<input type="date" required min={plusDays(0)} value={start} onChange={(e) => setStart(e.target.value)} /></label><label>End date<input type="date" required min={start} value={end} onChange={(e) => setEnd(e.target.value)} /></label></div>
          <label>Delivery address<select required value={addressId} onChange={(e) => setAddressId(e.target.value)}><option value="">Choose address</option>{addresses.map((a) => <option key={a.id} value={a.id}>{a.recipient_name || a.label || "Home"} · {a.address_line}, {a.area_name}</option>)}</select></label>
          <div><strong>Delivery days</strong><div className="workspace-day-picker">{DAYS.map((day) => <label className="workspace-day" key={day.n}><input type="checkbox" checked={days.includes(day.n)} onChange={(e) => setDays((old) => e.target.checked ? [...old, day.n].sort() : old.filter((n) => n !== day.n))} />{day.label}</label>)}</div></div>
          <label>Delivery note (optional)<textarea maxLength={500} rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></label>
          <div className="workspace-summary-line"><span>Estimated deliveries</span><strong>{deliveryCount}</strong></div>
          <div className="workspace-summary-line"><span>Indicative plan value</span><strong>{selectedProduct ? money.format(deliveryCount * Number(quantity) * Number(selectedProduct.price_per_litre)) : money.format(0)}</strong></div>
          <button className="workspace-button workspace-button-primary" disabled={busy || !addresses.length || !products.length}>{busy ? "Creating plan…" : "Start milk plan →"}</button>
          <p className="workspace-muted">This total is an estimate. Database-enforced schedule, provider capacity, prices and cutoffs determine actual deliveries.</p>
        </form>
      </section>
      <div className="workspace-section-head"><div><p className="workspace-eyebrow">YOUR ROUTINES</p><h2>{plans.filter((p) => !subscriptionId || p.id === subscriptionId).length} subscription(s)</h2></div><button className="workspace-button workspace-button-secondary workspace-small-button" onClick={() => void load()}>Refresh</button></div>
      {!plans.filter((p) => !subscriptionId || p.id === subscriptionId).length ? <section className="workspace-card workspace-empty-inline"><strong>No milk plans yet.</strong><p>Your scheduled deliveries will appear here.</p></section> : <div className="workspace-list">
        {plans.filter((p) => !subscriptionId || p.id === subscriptionId).map((plan) => {
          const values = edit[plan.id] ?? { quantity: String(plan.quantity_litres), time: String(plan.delivery_time).slice(0,5), addressId: plan.address_id, expanded: false };
          const deliveriesForPlan = deliveries.filter((d) => d.subscription_id === plan.id);
          return <article className="workspace-card workspace-plan-card" key={plan.id}>
            <div className="workspace-order-head"><div><p className="workspace-eyebrow">MILK ROUTINE</p><h2>{plan.milk_products?.name || "Milk"} · {plan.quantity_litres} L</h2><p>{plan.provider_profiles?.display_name || "Local seller"} · {plan.delivery_time}</p></div><span className={"workspace-status status-" + plan.status}>{plan.status.replace(/_/g, " ")}</span></div>
            <div className="workspace-summary-line"><span>Schedule</span><strong>{plan.start_date} – {plan.end_date}</strong></div>
            <div className="workspace-summary-line"><span>Price locked in plan</span><strong>{money.format(Number(plan.price_per_litre || 0))} / L</strong></div>
            <div className="workspace-summary-line"><span>Delivery address</span><strong>{[plan.addresses?.address_line, plan.addresses?.area_name, plan.addresses?.city, plan.addresses?.pin_code].filter(Boolean).join(", ") || "Saved address"}</strong></div>
            <div className="workspace-row-actions">
              <button className="workspace-text-button" onClick={() => setEdit((old) => ({ ...old, [plan.id]: { ...values, expanded: !values.expanded } }))}>{values.expanded ? "Close edit" : "Edit plan"}</button>
              {plan.status === "active" && <><label className="workspace-pause-date">Pause until<input type="date" min={plusDays(0)} value={pauseUntil[plan.id] ?? ""} onChange={(e) => setPauseUntil((old) => ({ ...old, [plan.id]: e.target.value }))} /></label><button className="workspace-text-button" disabled={busy} onClick={() => void act(plan.id, "pause")}>Pause</button></>}
              {plan.status === "paused" && <button className="workspace-text-button" disabled={busy} onClick={() => void act(plan.id, "resume")}>Resume</button>}
              {["active","paused"].includes(plan.status) && <button className="workspace-text-button danger" disabled={busy} onClick={() => { if (window.confirm("Cancel this milk subscription?")) void act(plan.id, "cancel"); }}>Cancel</button>}
            </div>
            {values.expanded && <form className="workspace-form workspace-plan-edit" onSubmit={(event) => void savePlan(event, plan)}>
              <div className="workspace-grid-two"><label>Daily quantity (L)<input type="number" min="0.5" max="20" step="0.5" value={values.quantity} onChange={(e) => setEdit((old) => ({ ...old, [plan.id]: { ...values, quantity: e.target.value } }))} /></label><label>Delivery time<input type="time" required value={values.time} onChange={(e) => setEdit((old) => ({ ...old, [plan.id]: { ...values, time: e.target.value } }))} /></label></div>
              <label>Address<select required value={values.addressId} onChange={(e) => setEdit((old) => ({ ...old, [plan.id]: { ...values, addressId: e.target.value } }))}>{addresses.map((a) => <option key={a.id} value={a.id}>{a.address_line}, {a.area_name}</option>)}</select></label>
              <button className="workspace-button workspace-button-primary" disabled={busy}>Save changes</button>
            </form>}
            {deliveriesForPlan.length > 0 && <details className="workspace-timeline"><summary>Upcoming / recent deliveries ({deliveriesForPlan.length})</summary><div className="workspace-list">{deliveriesForPlan.map((delivery) => <div className="workspace-list-row" key={delivery.id}><div className="workspace-list-main"><strong>{delivery.delivery_date || delivery.scheduled_for || "Scheduled delivery"}</strong><span>{delivery.status} · {delivery.quantity_litres} L · {money.format(Number(delivery.unit_price || 0))}/L</span></div>{["scheduled","pending","created"].includes(delivery.status.toLowerCase()) && plan.status === "active" && <button className="workspace-text-button" disabled={busy} onClick={() => void act(delivery.id, "skip")}>Skip delivery</button>}</div>)}</div></details>}
          </article>;
        })}
      </div>}
    </WorkspaceFrame>
  );
}
