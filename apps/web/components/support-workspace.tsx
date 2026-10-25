"use client";
import Link from "next/link";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import WorkspaceFrame from "@/components/workspace-frame";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser";

interface Ticket { id: string; category?: string; subject: string; status?: string; priority?: string; created_at?: string; updated_at?: string; }
type Notice = { kind: "error" | "success" | "info"; text: string } | null;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function SupportWorkspace() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [signedIn, setSignedIn] = useState(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("order");
  const [orderId, setOrderId] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const supabase = getBrowserSupabaseClient();
    if (!supabase) { setNotice({ kind: "error", text: "Supabase is not configured." }); return; }
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) { setSignedIn(false); return; }
    setSignedIn(true);
    const result = await supabase.from("support_tickets").select("id,category,subject,status,priority,created_at,updated_at").eq("customer_id", data.user.id).order("created_at", { ascending: false }).limit(25);
    if (result.error) { setNotice({ kind: "error", text: "Ticket history could not be loaded: " + result.error.message }); return; }
    setTickets((result.data ?? []) as Ticket[]);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice(null);
    try {
      const supabase = getBrowserSupabaseClient();
      if (!supabase) throw new Error("Supabase is not configured.");
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error("Sign in before sending a support request.");
      if (subject.trim().length < 3 || description.trim().length < 5) throw new Error("Add a short subject and a few details.");
      const cleanOrder = orderId.trim();
      if (cleanOrder && !UUID.test(cleanOrder)) throw new Error("Order ID should be a full UUID, or leave this field blank.");
      const result = await supabase.rpc("create_support_ticket", {
        p_subject: subject.trim().slice(0, 160),
        p_description: description.trim().slice(0, 4000),
        p_category: category,
        p_order_id: cleanOrder || null,
      });
      if (result.error) throw result.error;
      const ticket = Array.isArray(result.data) ? result.data[0] : result.data;
      setSubject(""); setDescription(""); setOrderId("");
      setNotice({ kind: "success", text: ticket?.id ? "Support request recorded. Reference: " + ticket.id : "Support request recorded. Keep a note of your subject for follow-up." });
      await load();
    } catch (error) { setNotice({ kind: "error", text: String((error as { message?: string })?.message ?? error) }); }
    finally { setBusy(false); }
  }

  if (!signedIn) return <WorkspaceFrame title="Customer support" description="Send a request about an order or your Doodhwala account."><section className="workspace-card workspace-empty"><h2>Sign in to contact support</h2><p>Ticket history is private to your account.</p><Link className="workspace-button workspace-button-primary" href="/auth/sign-in?return=%2Fsupport">Sign in</Link></section>{notice && <p className="workspace-notice error">{notice.text}</p>}</WorkspaceFrame>;

  return (
    <WorkspaceFrame title="How can we help?" description="Send a support request and keep your ticket history in one place.">
      {notice && <p className={"workspace-notice " + notice.kind} role={notice.kind === "error" ? "alert" : "status"}>{notice.text}</p>}
      <div className="workspace-grid-two">
        <section className="workspace-card">
          <p className="workspace-eyebrow">SUPPORT REQUEST</p><h2>Tell us what happened</h2>
          <form className="workspace-form" onSubmit={submit}>
            <label>Topic<select value={category} onChange={(e) => setCategory(e.target.value)}><option value="order">Order or delivery</option><option value="payment">Payment or refund</option><option value="subscription">Milk subscription</option><option value="account">Account and privacy</option><option value="provider">Seller issue</option><option value="other">Other</option></select></label>
            <label>Short subject<input required minLength={3} maxLength={160} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="What do you need help with?" /></label>
            <label>Details<textarea rows={6} required minLength={5} maxLength={4000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Include dates or what you already tried. Do not share passwords or OTPs." /></label>
            <label>Order UUID (optional)<input value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="Paste the full order ID if relevant" /></label>
            <button className="workspace-button workspace-button-primary" disabled={busy}>{busy ? "Sending…" : "Send support request"}</button>
          </form>
          <p className="workspace-muted">Doodhwala support will never need your password, OTP or complete payment credentials.</p>
        </section>
        <section className="workspace-card">
          <div className="workspace-section-head"><div><p className="workspace-eyebrow">YOUR HISTORY</p><h2>Recent tickets</h2></div><button className="workspace-button workspace-button-secondary workspace-small-button" onClick={() => void load()}>Refresh</button></div>
          {!tickets.length ? <div className="workspace-empty-inline"><strong>No requests yet.</strong><p>When you send a support request, its current status will appear here.</p></div> : <div className="workspace-list">{tickets.map((ticket)=><article className="workspace-list-row" key={ticket.id}><div className="workspace-list-main"><strong>{ticket.subject}</strong><span>{ticket.category || "General"} · {ticket.created_at ? new Date(ticket.created_at).toLocaleString("en-IN") : ""}</span><small>Reference: {ticket.id}</small></div><span className={"workspace-status status-" + String(ticket.status || "open")}>{ticket.status || "open"}</span></article>)}</div>}
        </section>
      </div>
    </WorkspaceFrame>
  );
}
