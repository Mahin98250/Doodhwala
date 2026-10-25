import Link from "next/link";
"use client";

import { useCallback, useEffect, useState } from "react";
import WorkspaceFrame from "@/components/workspace-frame";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser";

type Section = "overview" | "orders" | "support" | "providers" | "customers" | "subscriptions" | "products" | "health" | "audit" | "settings";
type Row = Record<string, unknown>;
type Notice = { kind: "error" | "success" | "info"; text: string } | null;
const sections: Array<{ id: Section; label: string }> = [
  { id: "overview", label: "Overview" }, { id: "orders", label: "Orders" }, { id: "support", label: "Support inbox" },
  { id: "providers", label: "Providers" }, { id: "customers", label: "Customers" }, { id: "subscriptions", label: "Subscriptions" },
  { id: "products", label: "Products" }, { id: "health", label: "System health" }, { id: "audit", label: "Audit log" }, { id: "settings", label: "Owner settings" },
];
const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const str = (value: unknown, fallback = "—") => value === null || value === undefined || value === "" ? fallback : String(value);
const dateText = (value: unknown) => value ? new Date(String(value)).toLocaleString("en-IN") : "—";

export default function OwnerWorkspace({ initialSection = "overview" }: { initialSection?: Section }) {
  const [authorized, setAuthorized] = useState(false);
  const [checked, setChecked] = useState(false);
  const [section, setSection] = useState<Section>(initialSection);
  const [rows, setRows] = useState<Row[]>([]);
  const [overview, setOverview] = useState<Row | null>(null);
  const [detail, setDetail] = useState<Row | null>(null);
  const [detailType, setDetailType] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [from, setFrom] = useState(() => new Date(Date.now() - 29 * 86400000).toISOString().slice(0,10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0,10));
  const [filter, setFilter] = useState("all");

  const call = useCallback(async (name: string, args: Record<string, unknown> = {}) => {
    const supabase = getBrowserSupabaseClient();
    if (!supabase) throw new Error("Supabase is not configured.");
    const result = await (supabase as any).rpc(name, args);
    if (result.error) throw result.error;
    return result.data;
  }, []);

  const loadSection = useCallback(async (next: Section) => {
    setSection(next); setDetail(null); setDetailType(""); setNotice(null); setRows([]);
    try {
      if (next === "overview") {
        const data = await call("get_admin_overview", { p_from: from, p_to: to });
        setOverview((data ?? {}) as Row);
        return;
      }
      if (next === "orders") setRows((await call("admin_list_orders", { p_limit: 100 }) ?? []) as Row[]);
      else if (next === "providers") setRows((await call("admin_list_providers", { p_limit: 150 }) ?? []) as Row[]);
      else if (next === "customers") setRows((await call("admin_list_customers", { p_limit: 150 }) ?? []) as Row[]);
      else if (next === "subscriptions") setRows((await call("admin_list_subscriptions", { p_limit: 150 }) ?? []) as Row[]);
      else if (next === "products") setRows((await call("admin_list_products", { p_limit: 200 }) ?? []) as Row[]);
      else if (next === "support") setRows((await call("admin_list_support_tickets", { p_limit: 150, p_status: filter === "all" ? null : filter }) ?? []) as Row[]);
      else if (next === "audit") setRows((await call("admin_list_audit_log", { p_limit: 100 }) ?? []) as Row[]);
      else if (next === "health") {
        const reports = await call("admin_list_client_error_reports", { p_limit: 100 });
        setRows(Array.isArray(reports) ? reports as Row[] : []);
      } else if (next === "settings") {
        const supabase = getBrowserSupabaseClient();
        const { data } = await supabase!.auth.getUser();
        setRows([{ current_user: data.user?.email ?? data.user?.id, session_provider: data.user?.app_metadata?.provider ?? "Supabase Auth", checked_at: new Date().toISOString() }]);
      }
    } catch (error) {
      setNotice({ kind: "error", text: String((error as { message?: string })?.message ?? error) });
    }
  }, [call, filter, from, to]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const supabase = getBrowserSupabaseClient();
      if (!supabase) { setChecked(true); setNotice({ kind: "error", text: "Supabase is not configured in this environment." }); return; }
      const { data } = await supabase.auth.getUser();
      if (!data.user) { if (active) { setAuthorized(false); setChecked(true); } return; }
      const gate = await supabase.rpc("is_current_user_admin");
      if (active) {
        setAuthorized(!gate.error && gate.data === true);
        setChecked(true);
        if (gate.error) setNotice({ kind: "error", text: "Could not verify owner access: " + gate.error.message });
        else if (gate.data !== true) setNotice({ kind: "error", text: "Owner access required. Sign in with an account on the private admin allow-list." });
      }
    })().catch((error) => { if (active) { setNotice({ kind: "error", text: String((error as { message?: string })?.message ?? error) }); setChecked(true); } });
    return () => { active = false; };
  }, []);

  useEffect(() => { if (authorized) void loadSection(section); }, [authorized, section, loadSection]);

  async function refresh() { await loadSection(section); }

  async function details(type: string, id: string) {
    setBusy(true); setNotice(null);
    try {
      const map: Record<string, string> = { provider: "admin_get_provider_detail", order: "admin_get_order_detail", customer: "admin_get_customer_detail", subscription: "admin_get_subscription_detail" };
      const parameter: Record<string, string> = { provider: "p_provider_id", order: "p_order_id", customer: "p_customer_id", subscription: "p_subscription_id" };
      const result = await call(map[type], { [parameter[type]]: id });
      setDetail((result ?? {}) as Row); setDetailType(type);
    } catch (error) { setNotice({ kind: "error", text: String((error as { message?: string })?.message ?? error) }); }
    finally { setBusy(false); }
  }

  async function action(name: string, args: Record<string, unknown>, success: string) {
    setBusy(true); setNotice(null);
    try {
      await call(name, args);
      setNotice({ kind: "success", text: success });
      if (detailType === "provider" && detail && typeof detail.provider === "object" && detail.provider) {
        const p = detail.provider as Row;
        if (p.id) await details("provider", String(p.id));
        else await refresh();
      } else await refresh();
    } catch (error) { setNotice({ kind: "error", text: String((error as { message?: string })?.message ?? error) }); }
    finally { setBusy(false); }
  }

  async function signOut() {
    const supabase = getBrowserSupabaseClient();
    if (supabase) await supabase.auth.signOut();
    window.location.replace("/");
  }

  function openDetail(type: string, row: Row) {
    const id = String(row.id ?? row.order_id ?? row.provider_id ?? row.customer_id ?? row.subscription_id ?? "");
    if (id) void details(type, id);
    else setNotice({ kind: "error", text: "This row did not include a record ID." });
  }

  if (!checked) return <WorkspaceFrame title="Owner control" description="Verifying privileged access with Supabase."><section className="workspace-card"><p>Checking owner permissions…</p></section></WorkspaceFrame>;
  if (!authorized) return <WorkspaceFrame title="Owner control" description="The admin area is restricted to authorised owner accounts."><section className="workspace-card workspace-empty"><h2>Owner access required</h2><p>Authentication alone does not grant admin access. The private admin-role RPC must approve this account.</p><Link className="workspace-button workspace-button-primary" href="/auth/sign-in?return=%2Fowner">Sign in</Link><button className="workspace-button workspace-button-secondary" onClick={() => void signOut()}>Sign out</button></section>{notice && <p className="workspace-notice error">{notice.text}</p>}</WorkspaceFrame>;

  const metricCards = overview ? [
    ["Gross sales", money.format(Number((overview as any).gross_sales ?? (overview as any).total_sales ?? 0)), "Reported by the backend overview RPC"],
    ["Orders", str((overview as any).order_count ?? (overview as any).total_orders ?? 0), "Current report range"],
    ["Providers", str((overview as any).provider_count ?? 0), "Independent local sellers"],
    ["Customers", str((overview as any).customer_count ?? 0), "Customer accounts"],
  ] : [];

  const sectionUsesFilter = ["orders", "providers", "products", "subscriptions", "support"].includes(section);
  const visibleRows = !sectionUsesFilter || filter === "all" ? rows : rows.filter((row) => {
    const value = section === "products"
      ? String(row.is_active !== false)
      : String(row.status ?? row.verification_status ?? row.priority ?? "");
    return value.toLowerCase() === filter;
  });

  return (
    <WorkspaceFrame title="Owner control centre" eyebrow="PRIVATE BUSINESS OPERATIONS" description="Monitor marketplace health and manage moderation, orders, support and seller controls. All privileged mutations use existing backend RPCs.">
      {notice && <p className={"workspace-notice " + notice.kind} role={notice.kind === "error" ? "alert" : "status"}>{notice.text}</p>}
      <div className="workspace-owner-layout">
        <nav className="workspace-owner-nav" aria-label="Owner sections">{sections.map((item) => <button type="button" key={item.id} className={section === item.id ? "active" : ""} onClick={() => setSection(item.id)}>{item.label}<span>→</span></button>)}<button type="button" onClick={() => void signOut()}>Sign out <span>↗</span></button></nav>
        <div className="workspace-owner-main">
          <div className="workspace-section-head"><div><p className="workspace-eyebrow">CONTROL ROOM</p><h2>{sections.find((item) => item.id === section)?.label}</h2></div><button className="workspace-button workspace-button-secondary workspace-small-button" onClick={() => void refresh()} disabled={busy}>Refresh</button></div>
          {section === "overview" && <>
            <section className="workspace-card"><div className="workspace-inline-form"><label>From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label><label>To<input type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} /></label><button className="workspace-button workspace-button-primary" onClick={() => void loadSection("overview")}>Update report</button></div></section>
            <div className="workspace-metric-grid">{metricCards.map(([label,value,caption])=><article className="workspace-metric" key={label}><small>{label}</small><strong>{value}</strong><span>{caption}</span></article>)}</div>
            <section className="workspace-card"><p className="workspace-eyebrow">DAILY SALES</p><h2>Sales trend from trusted report data</h2>{Array.isArray((overview as any)?.daily_sales) && (overview as any).daily_sales.length ? <div className="workspace-bars">{(overview as any).daily_sales.slice(-30).map((day: Row,index:number,all:Row[])=>{const max=Math.max(1,...all.map((r)=>Number(r.sales)||0));return <div className="workspace-bar-col" key={String(day.day ?? day.date ?? index)} title={String(day.date ?? day.day ?? "")+" · "+money.format(Number(day.sales ?? 0))}><div className="workspace-bar" style={{height: Math.max(3,Number(day.sales||0)/max*100)+"%"}}/><small>{String(day.date ?? day.day ?? "").slice(-2)}</small></div>})}</div> : <p className="workspace-muted">The report returned no daily sales series for this date range.</p>}</section>
            <section className="workspace-card"><p className="workspace-eyebrow">PROVIDER PERFORMANCE</p><h2>Top sellers by reported sales</h2>{Array.isArray((overview as any)?.provider_sales) && (overview as any).provider_sales.length ? <div className="workspace-list">{(overview as any).provider_sales.slice(0,10).map((p:Row,index:number)=><div className="workspace-list-row" key={String(p.provider_id??p.id??index)}><div className="workspace-list-main"><strong>{str(p.display_name ?? p.provider_name ?? p.name)}</strong><span>{str(p.area_name ?? p.city)}</span></div><b>{money.format(Number(p.sales ?? p.total_sales ?? 0))}</b></div>)}</div> : <p className="workspace-muted">No provider sales data was returned.</p>}</section>
          </>}
          {section !== "overview" && !detail && <>
            {(section === "support" || section === "orders" || section === "providers" || section === "products" || section === "subscriptions") && <div className="workspace-inline-form"><label>Filter<select value={filter} onChange={(e) => { setFilter(e.target.value); }}><option value="all">All</option>{(section === "providers" ? ["pending","approved","rejected"] : section === "support" ? ["open","in_progress","resolved","closed"] : section === "orders" ? ["placed","accepted","preparing","out_for_delivery","delivered","cancelled","rejected"] : section === "subscriptions" ? ["active","paused","cancelled","completed"] : ["true","false"]).map((v)=><option value={v} key={v}>{v.replace(/_/g," ")}</option>)}</select></label><span className="workspace-muted">{visibleRows.length} row(s)</span></div>}
            {section === "settings" && <section className="workspace-card"><p className="workspace-eyebrow">SECURITY</p><h2>Owner session</h2><p className="workspace-muted">The browser checks owner eligibility for interface access, but each privileged operation still depends on backend authorization. Never grant access from client state alone.</p></section>}
            {!visibleRows.length ? <section className="workspace-card workspace-empty-inline"><strong>No records returned.</strong><p>This can mean there are no matching records or the backend role/RPC is unavailable. Refresh or review the system health section.</p></section> : <div className="workspace-card workspace-table-wrap"><table className="workspace-table"><thead><tr>{(section==="providers"?["Seller","Status","Area","Orders"]:section==="orders"?["Order","Status","Customer","Total"]:section==="support"?["Ticket","Status","Priority","Subject"]:section==="customers"?["Customer","Email","Orders","Joined"]:section==="subscriptions"?["Subscription","Status","Customer","Product"]:section==="products"?["Product","Seller","Status","Price"]:section==="audit"?["Event","Actor","Time","Record"]:section==="health"?["Issue","Severity","Route","Time"]:["Key","Value"]).map((h)=><th key={h}>{h}</th>)}<th>Actions</th></tr></thead>
              <tbody>{visibleRows.map((row,index)=>{
                const id=String(row.id ?? row.order_id ?? row.provider_id ?? row.customer_id ?? row.subscription_id ?? index);
                const type = section==="providers"?"provider":section==="orders"?"order":section==="customers"?"customer":section==="subscriptions"?"subscription":"";
                return <tr key={id}>
                  {section==="providers" && <><td><strong>{str(row.display_name ?? row.provider_name)}</strong><small>{str(row.owner_name)}</small></td><td>{str(row.verification_status ?? row.status)}</td><td>{str(row.area_name ?? row.city)}</td><td>{str(row.order_count, "0")}</td></>}
                  {section==="orders" && <><td>{id.slice(0,8)}</td><td>{str(row.status)}</td><td>{str(row.customer_name ?? row.delivery_recipient_name)}</td><td>{money.format(Number(row.total ?? 0))}</td></>}
                  {section==="support" && <><td>{id.slice(0,8)}</td><td>{str(row.status)}</td><td>{str(row.priority)}</td><td>{str(row.subject)}</td></>}
                  {section==="customers" && <><td>{str(row.full_name ?? row.name)}</td><td>{str(row.email ?? row.phone)}</td><td>{str(row.order_count,"0")}</td><td>{dateText(row.created_at)}</td></>}
                  {section==="subscriptions" && <><td>{id.slice(0,8)}</td><td>{str(row.status)}</td><td>{str(row.customer_name)}</td><td>{str(row.product_name)}</td></>}
                  {section==="products" && <><td>{str(row.name ?? row.product_name)}</td><td>{str(row.provider_name)}</td><td>{row.is_active===false?"Hidden":"Active"} · {row.stock===false?"Out of stock":"In stock"}</td><td>{money.format(Number(row.price_per_litre ?? 0))}</td></>}
                  {section==="audit" && <><td>{str(row.action ?? row.event_type ?? row.event)}</td><td>{str(row.actor_email ?? row.actor_id)}</td><td>{dateText(row.created_at)}</td><td>{str(row.entity_type ?? row.record_type)} {str(row.entity_id ?? row.record_id,"")}</td></>}
                  {section==="health" && <><td>{str(row.message ?? row.error_message ?? row.error_code)}</td><td>{str(row.severity ?? row.level)}</td><td>{str(row.route ?? row.path)}</td><td>{dateText(row.created_at ?? row.reported_at)}</td></>}
                  {section==="settings" && <><td>{str(row.current_user)}</td><td>{str(row.session_provider)}</td></>}
                  <td><div className="workspace-row-actions">
                    {type && <button className="workspace-text-button" onClick={()=>openDetail(type,row)}>Details</button>}
                    {section==="providers" && <><button className="workspace-text-button" disabled={busy} onClick={()=>void action("admin_set_provider_review",{p_provider_id:id,p_status:"approved",p_notes:"Approved by owner",p_is_active:true},"Provider approved.")}>Approve</button><button className="workspace-text-button danger" disabled={busy} onClick={()=>{const notes=window.prompt("Reason for rejection?")?.trim();if(notes)void action("admin_set_provider_review",{p_provider_id:id,p_status:"rejected",p_notes:notes.slice(0,500),p_is_active:false},"Provider review updated.");}}>Reject</button><button className="workspace-text-button" disabled={busy} onClick={()=>void action("admin_set_provider_controls",{p_provider_id:id,p_is_active:row.is_active!==false,p_accepting_orders:row.accepting_orders===false,p_max_open_orders:Number(row.max_open_orders??25),p_max_daily_litres:Number(row.max_daily_litres??250),p_acceptance_timeout_minutes:Number(row.acceptance_timeout_minutes??10)},"Provider controls updated.")}>Toggle orders</button><button className="workspace-text-button" disabled={busy} onClick={()=>{const label=window.prompt("Service-area label:",String(row.area_name??row.city??"Local route"));if(label===null)return;const latitude=Number(window.prompt("Service-area latitude:"));const longitude=Number(window.prompt("Service-area longitude:"));const radius=Number(window.prompt("Service radius in km:",String(row.service_radius_km??5)));if(!Number.isFinite(latitude)||latitude < -90||latitude>90||!Number.isFinite(longitude)||longitude < -180||longitude>180||!Number.isFinite(radius)||radius<=0||radius>100){setNotice({kind:"error",text:"Enter valid latitude, longitude and radius values."});return}void action("admin_set_provider_service_area",{p_provider_id:id,p_label:label.slice(0,100),p_latitude:latitude,p_longitude:longitude,p_service_radius_km:radius},"Provider service area updated.")}}>Set service area</button></>}
                    {section==="products" && <><button className="workspace-text-button" disabled={busy} onClick={()=>void action("admin_set_product_state",{p_product_id:id,p_is_active:row.is_active!==false,p_stock:row.stock===false,p_daily_available:row.daily_available!==false},"Product stock status toggled.")}>Toggle stock</button><button className="workspace-text-button" disabled={busy} onClick={()=>void action("admin_set_product_state",{p_product_id:id,p_is_active:row.is_active===false,p_stock:row.stock!==false,p_daily_available:row.daily_available!==false},"Product visibility toggled.")}>Toggle listing</button></>}
                    {section==="support" && <><select aria-label={"Change status for ticket "+id} defaultValue={str(row.status,"open")} onChange={(e)=>void action("admin_update_support_ticket",{p_ticket_id:id,p_status:e.target.value,p_priority:str(row.priority,"normal")},"Ticket status updated.")}><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select><select aria-label={"Change priority for ticket "+id} defaultValue={str(row.priority,"normal")} onChange={(e)=>void action("admin_update_support_ticket",{p_ticket_id:id,p_status:str(row.status,"open"),p_priority:e.target.value},"Ticket priority updated.")}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></>}
                  </div></td>
                </tr>;
              })}</tbody></table></div>}
          </>}
          {detail && <section className="workspace-card"><div className="workspace-section-head"><div><p className="workspace-eyebrow">RESTRICTED RECORD DETAIL</p><h2>{detailType.replace(/_/g," ")} detail</h2></div><button className="workspace-button workspace-button-secondary workspace-small-button" onClick={()=>{setDetail(null);setDetailType("");}}>Back to list</button></div><pre className="workspace-json">{JSON.stringify(detail,null,2)}</pre><p className="workspace-muted">Detail fields come from the existing privileged RPC. Use the actions in the relevant list for supported state changes.</p></section>}
        </div>
      </div>
    </WorkspaceFrame>
  );
}
