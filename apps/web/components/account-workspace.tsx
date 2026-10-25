"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import WorkspaceFrame from "@/components/workspace-frame";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser";
import { readCart } from "@/lib/commerce/cart";

interface Address {
  id: string;
  label?: string | null;
  recipient_name?: string | null;
  phone?: string | null;
  address_line?: string | null;
  area_name?: string | null;
  city?: string | null;
  pin_code?: string | null;
  is_default?: boolean | null;
}
interface SavedItem { id: string; providerId: string; name: string; providerName: string; savedAt: number; }
const SAVED_KEY = "doodhwala-saved-items-v1";
const FAVORITES_KEY = "doodhwala-favorites";
const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
function readSavedProviders(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(FAVORITES_KEY) ?? "[]");
    return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === "string" && UUID_PATTERN.test(id)))].slice(0, 100) : [];
  } catch { return []; }
}
type Notice = { kind: "error" | "success"; text: string } | null;

function readSaved(): SavedItem[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(SAVED_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((item) => item && typeof item.id === "string" && typeof item.providerId === "string").slice(0, 100);
  } catch { return []; }
}
function saveSaved(items: SavedItem[]) {
  try { window.localStorage.setItem(SAVED_KEY, JSON.stringify(items.slice(0, 100))); } catch { /* Browser storage is optional. */ }
}

export default function AccountWorkspace() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [saved, setSaved] = useState<SavedItem[]>([]);
  const [savedProviders, setSavedProviders] = useState<string[]>([]);
  const [cartCount, setCartCount] = useState(0);
  const [newAddress, setNewAddress] = useState({ recipient_name: "", phone: "", address_line: "", area_name: "", city: "Ahmedabad", pin_code: "", is_default: false });
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  const load = useCallback(async () => {
    setNotice(null);
    const supabase = getBrowserSupabaseClient();
    if (!supabase) { setNotice({ kind: "error", text: "Supabase is not configured for this environment." }); return; }
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) { setSignedIn(false); return; }
    setSignedIn(true);
    setEmail(data.user.email ?? "");
    const profile = await supabase.from("profiles").select("full_name,phone").eq("id", data.user.id).maybeSingle();
    if (profile.error) { setNotice({ kind: "error", text: profile.error.message }); return; }
    setFullName(profile.data?.full_name ?? String(data.user.user_metadata?.full_name ?? ""));
    setPhone(profile.data?.phone ?? data.user.phone ?? "");
    const result = await supabase.from("addresses").select("id,label,recipient_name,phone,address_line,area_name,city,pin_code,is_default").eq("user_id", data.user.id).order("is_default", { ascending: false });
    if (result.error) { setNotice({ kind: "error", text: "Profile loaded, but saved addresses could not be fetched: " + result.error.message }); return; }
    setAddresses((result.data ?? []) as Address[]);
    setSaved(readSaved());
    setSavedProviders(readSavedProviders());
    setCartCount(Object.keys(readCart()).length);
  }, []);

  useEffect(() => {
    setSaved(readSaved());
    setSavedProviders(readSavedProviders());
    setCartCount(Object.keys(readCart()).length);
    void load();
  }, [load]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const supabase = getBrowserSupabaseClient();
      if (!supabase) throw new Error("Supabase is not configured.");
      const normalizedPhone = phone.trim();
      if (fullName.trim().length < 2) throw new Error("Enter your full name.");
      if (!/^\+?[0-9 ()-]{8,20}$/.test(normalizedPhone)) throw new Error("Enter a valid phone number.");
      const { error } = await supabase.rpc("complete_current_customer_profile", {
        p_full_name: fullName.trim(),
        p_phone: normalizedPhone,
        p_address_line: null,
        p_area_name: null,
        p_city: null,
        p_pin_code: null,
      });
      if (error) throw error;
      setNotice({ kind: "success", text: "Profile saved." });
      await load();
    } catch (error) { setNotice({ kind: "error", text: String((error as { message?: string })?.message ?? error) }); }
    finally { setBusy(false); }
  }

  async function addAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const supabase = getBrowserSupabaseClient();
      if (!supabase) throw new Error("Supabase is not configured.");
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error("Please sign in again.");
      if (!/^\d{10}$/.test(newAddress.phone.replace(/\D/g, "")) || !/^\d{6}$/.test(newAddress.pin_code)) throw new Error("Use a 10-digit phone number and a six-digit PIN code.");
      if (![newAddress.recipient_name, newAddress.address_line, newAddress.area_name, newAddress.city].every((v) => v.trim())) throw new Error("Complete the recipient, street, area and city fields.");
      const row = {
        user_id: data.user.id, label: "Home", recipient_name: newAddress.recipient_name.trim(),
        phone: newAddress.phone.replace(/\D/g, ""), address_line: newAddress.address_line.trim(),
        area_name: newAddress.area_name.trim(), city: newAddress.city.trim(), pin_code: newAddress.pin_code,
        latitude: null, longitude: null, is_default: newAddress.is_default || addresses.length === 0,
      };
      if (row.is_default) {
        const clear = await supabase.from("addresses").update({ is_default: false }).eq("user_id", data.user.id);
        if (clear.error) throw clear.error;
      }
      const result = await supabase.from("addresses").insert(row).select("id,label,recipient_name,phone,address_line,area_name,city,pin_code,is_default").single();
      if (result.error) throw result.error;
      setNewAddress({ recipient_name: "", phone: "", address_line: "", area_name: "", city: "Ahmedabad", pin_code: "", is_default: false });
      setNotice({ kind: "success", text: "Delivery address saved." });
      await load();
    } catch (error) { setNotice({ kind: "error", text: String((error as { message?: string })?.message ?? error) }); }
    finally { setBusy(false); }
  }

  async function makeDefault(id: string) {
    setBusy(true);
    try {
      const supabase = getBrowserSupabaseClient();
      if (!supabase) throw new Error("Supabase is not configured.");
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error("Please sign in again.");
      const clear = await supabase.from("addresses").update({ is_default: false }).eq("user_id", data.user.id);
      if (clear.error) throw clear.error;
      const result = await supabase.from("addresses").update({ is_default: true }).eq("id", id).eq("user_id", data.user.id);
      if (result.error) throw result.error;
      setNotice({ kind: "success", text: "Default address updated." });
      await load();
    } catch (error) { setNotice({ kind: "error", text: String((error as { message?: string })?.message ?? error) }); }
    finally { setBusy(false); }
  }

  async function signOut() {
    const supabase = getBrowserSupabaseClient();
    if (supabase) await supabase.auth.signOut();
    window.location.replace("/");
  }

  function removeSaved(id: string) {
    const next = saved.filter((item) => item.id !== id);
    setSaved(next);
    saveSaved(next);
  }

  if (!signedIn) return (
    <WorkspaceFrame title="Your account" description="Sign in to manage your profile, delivery addresses and private orders.">
      <section className="workspace-card workspace-empty"><h2>Sign in to continue</h2><p>Keep your addresses, orders and local milk routines in one place.</p><a className="workspace-button workspace-button-primary" href="/auth/sign-in?return=%2Faccount">Sign in / Create account</a></section>
      {notice && <p className="workspace-notice error">{notice.text}</p>}
    </WorkspaceFrame>
  );

  return (
    <WorkspaceFrame title="Account & saved items" description="Manage your delivery details and keep your favourite local products close.">
      {notice && <p className={"workspace-notice " + notice.kind} role="status">{notice.text}</p>}
      <div className="workspace-metric-grid">
        <article className="workspace-metric"><small>EMAIL</small><strong>{email || "Phone sign-in account"}</strong><span>Verified through Supabase Auth as configured.</span></article>
        <article className="workspace-metric"><small>DELIVERY ADDRESSES</small><strong>{addresses.length}</strong><span>Your addresses are private to your account.</span></article>
        <article className="workspace-metric"><small>CART ITEMS</small><strong>{cartCount}</strong><a href="/cart">Review cart →</a></article>
      </div>
      <div className="workspace-grid-two workspace-account-grid">
        <section className="workspace-card">
          <div className="workspace-section-head"><div><p className="workspace-eyebrow">PROFILE</p><h2>Your details</h2></div><button className="workspace-button workspace-button-secondary workspace-small-button" onClick={() => void signOut()}>Sign out</button></div>
          <form className="workspace-form" onSubmit={saveProfile}>
            <label>Full name<input value={fullName} onChange={(e) => setFullName(e.target.value)} required /></label>
            <label>Phone number<input value={phone} onChange={(e) => setPhone(e.target.value)} required /></label>
            <button className="workspace-button workspace-button-primary" disabled={busy}>{busy ? "Saving…" : "Save profile"}</button>
          </form>
        </section>
        <section className="workspace-card">
          <p className="workspace-eyebrow">ADDRESS BOOK</p><h2>Add delivery address</h2>
          <form className="workspace-form" onSubmit={addAddress}>
            <label>Recipient name<input value={newAddress.recipient_name} onChange={(e) => setNewAddress({ ...newAddress, recipient_name: e.target.value })} required /></label>
            <label>Phone<input inputMode="tel" value={newAddress.phone} onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })} required /></label>
            <label>Address line<input value={newAddress.address_line} onChange={(e) => setNewAddress({ ...newAddress, address_line: e.target.value })} required /></label>
            <div className="workspace-grid-two"><label>Area<input value={newAddress.area_name} onChange={(e) => setNewAddress({ ...newAddress, area_name: e.target.value })} required /></label><label>City<input value={newAddress.city} onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })} required /></label></div>
            <label>PIN code<input inputMode="numeric" maxLength={6} value={newAddress.pin_code} onChange={(e) => setNewAddress({ ...newAddress, pin_code: e.target.value.replace(/\D/g, "") })} required /></label>
            <label className="workspace-checkbox"><input type="checkbox" checked={newAddress.is_default} onChange={(e) => setNewAddress({ ...newAddress, is_default: e.target.checked })} /> Make this my default address</label>
            <button className="workspace-button workspace-button-primary" disabled={busy}>{busy ? "Saving…" : "Save address"}</button>
          </form>
        </section>
      </div>
      <section className="workspace-card">
        <div className="workspace-section-head"><div><p className="workspace-eyebrow">SAVED ITEMS</p><h2>Products you’ve saved</h2></div><a className="workspace-inline-link" href="/providers">Find more milk →</a></div>
        {!saved.length ? <div className="workspace-empty-inline"><strong>No saved products yet.</strong><p>Save an item from its product page and it will appear here on this device.</p></div> : <div className="workspace-list">
          {saved.map((item) => <article className="workspace-list-row" key={item.id + ":" + item.providerId}>
            <div className="workspace-item-icon">✳</div><div className="workspace-list-main"><strong>{item.name}</strong><span>{item.providerName}</span><small>Saved locally on this device</small></div>
            <div className="workspace-row-actions"><a href={"/products/" + encodeURIComponent(item.id) + "?provider=" + encodeURIComponent(item.providerId)}>View item</a><button className="workspace-text-button" onClick={() => removeSaved(item.id)}>Remove</button></div>
          </article>)}
        </div>}
      </section>
      <section className="workspace-card">
        <div className="workspace-section-head"><div><p className="workspace-eyebrow">SAVED SELLERS</p><h2>Favourite local providers</h2></div><a className="workspace-inline-link" href="/providers">Discover sellers →</a></div>
        {!savedProviders.length ? <div className="workspace-empty-inline"><strong>No saved sellers yet.</strong><p>Provider favourites from the existing Doodhwala browser storage appear here on this device.</p></div> : <div className="workspace-list">
          {savedProviders.map((providerId) => <article className="workspace-list-row" key={providerId}>
            <div className="workspace-item-icon">♥</div>
            <div className="workspace-list-main"><strong>Saved local seller</strong><span>Provider reference: {providerId}</span><small>Saved on this device</small></div>
            <div className="workspace-row-actions"><a href={"/stores/" + encodeURIComponent(providerId)}>Open seller</a><button className="workspace-text-button danger" onClick={() => {
              const next = savedProviders.filter((id) => id !== providerId);
              setSavedProviders(next);
              try { window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(next)); } catch {}
            }}>Remove</button></div>
          </article>)}
        </div>}
      </section>
    </WorkspaceFrame>
  );
}
