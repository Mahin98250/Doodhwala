"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import WorkspaceFrame from "@/components/workspace-frame";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser";

type AuthMode = "signin" | "signup" | "reset";
type Notice = { kind: "error" | "success" | "info"; text: string } | null;

function safeReturnPath(): string {
  if (typeof window === "undefined") return "/";
  const value = new URLSearchParams(window.location.search).get("return") || "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f]/.test(value)) return "/";
  try {
    const target = new URL(value, window.location.origin);
    if (target.origin !== window.location.origin) return "/";
    return target.pathname + target.search + target.hash;
  } catch { return "/"; }
}

function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return "+91" + digits;
  if (digits.length === 12 && digits.startsWith("91")) return "+" + digits;
  return value.trim();
}

function errorText(error: unknown): string {
  const message = String((error as { message?: string })?.message ?? "Something went wrong.");
  if (/invalid login credentials/i.test(message)) return "Email or password is incorrect.";
  if (/already registered|already been registered/i.test(message)) return "An account already exists with this email. Try signing in or resetting the password.";
  if (/redirect.*url|not allowed/i.test(message)) return "Authentication is not configured to allow this preview URL yet. Add this URL to the Supabase Auth redirect allow-list.";
  return message;
}

export default function AuthWorkspace({ initialMode = "signin" }: { initialMode?: AuthMode }) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [usePhone, setUsePhone] = useState(false);
  const [recoverySession, setRecoverySession] = useState(false);
  const [profileRequired, setProfileRequired] = useState(false);
  const [profilePhone, setProfilePhone] = useState("");
  const [address, setAddress] = useState("");
  const [area, setArea] = useState("");
  const [city, setCity] = useState("Ahmedabad");
  const [pin, setPin] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const routedUserId = useRef("");

  useEffect(() => {
    const supabase = getBrowserSupabaseClient();
    if (!supabase) return;
    let active = true;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      const hash = window.location.hash;
      const params = new URLSearchParams(window.location.search);
      const recovery = params.get("type") === "recovery" || /type=recovery/.test(hash);
      const user = data.session?.user;
      setRecoverySession(Boolean(recovery && user));
      if (user && params.get("oauth") !== "google" && !recovery) {
        setNotice({ kind: "info", text: "You’re signed in. Checking your account…" });
        routedUserId.current = user.id;
        await routeAfterAuth(supabase, user.id);
      } else if (recovery) {
        setMode("reset");
      }
    })().catch((error) => setNotice({ kind: "error", text: errorText(error) }));
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active || !session?.user) return;
      if (event === "PASSWORD_RECOVERY") {
        setRecoverySession(true);
        setMode("reset");
        return;
      }
      if (event === "SIGNED_IN" && routedUserId.current !== session.user.id) {
        // Do not await Supabase operations inside its auth-state callback.
        routedUserId.current = session.user.id;
        window.setTimeout(() => {
          if (active) void routeAfterAuth(supabase, session.user.id).catch((error) => {
            setNotice({ kind: "error", text: errorText(error) });
          });
        }, 0);
      }
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("oauth") !== "google") return;
    const handle = window.setTimeout(() => { void googleSignIn(); }, 0);
    return () => window.clearTimeout(handle);
  }, []);

  async function routeAfterAuth(supabase: NonNullable<ReturnType<typeof getBrowserSupabaseClient>>, userId: string) {
    const returnPath = safeReturnPath();
    const { data: isAdmin } = await supabase.rpc("is_current_user_admin");
    if (isAdmin === true) {
      window.location.replace("/owner");
      return;
    }
    const { data: profile, error } = await supabase.from("profiles").select("full_name,phone").eq("id", userId).maybeSingle();
    if (error) throw error;
    if (!profile || !String(profile.full_name ?? "").trim() || !String(profile.phone ?? "").trim()) {
      setProfileRequired(true);
      setProfilePhone(String(profile?.phone ?? ""));
      setName(String(profile?.full_name ?? ""));
      setNotice({ kind: "info", text: "Complete your profile so local sellers can deliver to the right person." });
      return;
    }
    window.location.replace(returnPath);
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const supabase = getBrowserSupabaseClient();
      if (!supabase) throw new Error("Supabase is not configured for this environment yet.");
      if (mode === "reset") {
        if (!recoverySession) {
          if (!email.trim()) throw new Error("Enter the email address linked to your account.");
          const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
            redirectTo: window.location.origin + "/auth/reset-password?return=" + encodeURIComponent(safeReturnPath()),
          });
          if (error) throw error;
          setNotice({ kind: "success", text: "Password reset link sent. Open the email on this device to choose a new password." });
          return;
        }
        if (password.length < 8) throw new Error("Use at least 8 characters for your new password.");
        if (password !== confirmPassword) throw new Error("The passwords do not match.");
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        await supabase.auth.signOut({ scope: "local" });
        setRecoverySession(false);
        setMode("signin");
        setPassword("");
        setConfirmPassword("");
        setNotice({ kind: "success", text: "Password updated. Sign in with your new password." });
        return;
      }

      if (mode === "signup") {
        if (name.trim().length < 2) throw new Error("Enter your full name.");
        if (password.length < 8) throw new Error("Use a password with at least 8 characters.");
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: name.trim() },
            emailRedirectTo: window.location.origin + "/auth/sign-in?return=" + encodeURIComponent(safeReturnPath()),
          },
        });
        if (error) throw error;
        if (data.session?.user) {
          setNotice({ kind: "success", text: "Account created. Checking required profile details…" });
          await routeAfterAuth(supabase, data.session.user.id);
        } else {
          setNotice({ kind: "success", text: "Account created. Check your email to verify it, then sign in here." });
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        if (data.user) await routeAfterAuth(supabase, data.user.id);
      }
    } catch (error) {
      setNotice({ kind: "error", text: errorText(error) });
    } finally { setBusy(false); }
  }

  async function googleSignIn() {
    setBusy(true);
    setNotice(null);
    try {
      const supabase = getBrowserSupabaseClient();
      if (!supabase) throw new Error("Supabase is not configured for this environment yet.");
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin + "/auth/sign-in?return=" + encodeURIComponent(safeReturnPath()),
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) throw error;
    } catch (error) {
      setNotice({ kind: "error", text: errorText(error) });
      setBusy(false);
    }
  }

  async function sendOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const supabase = getBrowserSupabaseClient();
      if (!supabase) throw new Error("Supabase is not configured for this environment yet.");
      const normalized = normalizePhone(phone);
      if (!/^\+[1-9]\d{7,14}$/.test(normalized)) throw new Error("Enter a valid phone number with country code, for example +91 98765 43210.");
      const { error } = await supabase.auth.signInWithOtp({ phone: normalized });
      if (error) throw error;
      setPhone(normalized);
      setOtpSent(true);
      setNotice({ kind: "success", text: "OTP requested. SMS delivery must be enabled in Supabase Auth." });
    } catch (error) { setNotice({ kind: "error", text: errorText(error) }); }
    finally { setBusy(false); }
  }

  async function verifyOtp() {
    setBusy(true);
    setNotice(null);
    try {
      const supabase = getBrowserSupabaseClient();
      if (!supabase) throw new Error("Supabase is not configured for this environment yet.");
      const { data, error } = await supabase.auth.verifyOtp({ phone: normalizePhone(phone), token: otp.trim(), type: "sms" });
      if (error) throw error;
      if (data.user) await routeAfterAuth(supabase, data.user.id);
    } catch (error) { setNotice({ kind: "error", text: errorText(error) }); }
    finally { setBusy(false); }
  }

  async function completeProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const supabase = getBrowserSupabaseClient();
      if (!supabase) throw new Error("Supabase is not configured for this environment yet.");
      const normalized = normalizePhone(profilePhone);
      if (name.trim().length < 2) throw new Error("Enter your full name.");
      if (!/^\+[1-9]\d{7,14}$/.test(normalized)) throw new Error("Enter a valid phone number with country code.");
      const anyAddress = Boolean(address.trim() || area.trim() || city.trim() || pin.trim());
      if (anyAddress && (!address.trim() || !area.trim() || !city.trim() || !/^\d{6}$/.test(pin.trim()))) {
        throw new Error("Complete the address, locality, city and six-digit PIN, or leave the address fields blank.");
      }
      const { error } = await supabase.rpc("complete_current_customer_profile", {
        p_full_name: name.trim(),
        p_phone: normalized,
        p_address_line: address.trim() || null,
        p_area_name: area.trim() || null,
        p_city: city.trim() || null,
        p_pin_code: pin.trim() || null,
      });
      if (error) throw error;
      setNotice({ kind: "success", text: "Profile completed. Taking you back to your destination…" });
      window.location.replace(safeReturnPath());
    } catch (error) { setNotice({ kind: "error", text: errorText(error) }); }
    finally { setBusy(false); }
  }

  const title = profileRequired ? "Finish your account" : mode === "signup" ? "Create your account" : mode === "reset" ? recoverySession ? "Choose a new password" : "Reset your password" : "Welcome back";
  const description = profileRequired ? "A little profile information helps providers complete reliable deliveries." : mode === "signup" ? "Create one account for orders, addresses and milk plans." : mode === "reset" ? recoverySession ? "Use a new password you have not used before." : "We’ll email a secure link to reset your password." : "Sign in to manage orders, local milk plans and saved items.";

  return (
    <WorkspaceFrame title={title} eyebrow="YOUR DOODHWALA ACCOUNT" description={description} compact>
      {profileRequired ? (
        <form className="workspace-card workspace-form" onSubmit={completeProfile}>
          <div className="workspace-grid-two">
            <label>Full name<input required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label>Phone number<input required autoComplete="tel" inputMode="tel" value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)} placeholder="+91 98765 43210" /></label>
            <label className="workspace-field-wide">Home address (optional)<input autoComplete="street-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="House / flat / street" /></label>
            <label>Area / locality<input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Bhadaj" /></label>
            <label>City<input value={city} onChange={(e) => setCity(e.target.value)} /></label>
            <label>PIN code<input inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} /></label>
          </div>
          <button className="workspace-button workspace-button-primary" disabled={busy}>{busy ? "Saving…" : "Save profile & continue"}</button>
        </form>
      ) : (
        <div className="workspace-auth-layout">
          <section className="workspace-card workspace-form">
            {mode !== "reset" && <div className="workspace-tabs" role="tablist" aria-label="Account actions">
              <button type="button" aria-selected={mode === "signin"} className={mode === "signin" ? "selected" : ""} onClick={() => { setMode("signin"); setNotice(null); }}>Sign in</button>
              <button type="button" aria-selected={mode === "signup"} className={mode === "signup" ? "selected" : ""} onClick={() => { setMode("signup"); setNotice(null); }}>Create account</button>
            </div>}
            {!usePhone ? (
              <form onSubmit={submitAuth} className="workspace-form">
                {mode === "signup" && <label>Full name<input required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></label>}
                <label>Email address<input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></label>
                {(mode !== "reset" || recoverySession) && <label>{recoverySession ? "New password" : "Password"}<input required type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></label>}
                {mode === "reset" && recoverySession && <label>Confirm new password<input required type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></label>}
                <button className="workspace-button workspace-button-primary" disabled={busy}>{busy ? "Please wait…" : mode === "signup" ? "Create account" : mode === "reset" ? recoverySession ? "Update password" : "Send reset link" : "Sign in"}</button>
              </form>
            ) : (
              <div className="workspace-form">
                <form onSubmit={sendOtp} className="workspace-form">
                  <label>Phone number<input required type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" /></label>
                  <button className="workspace-button workspace-button-primary" disabled={busy}>{busy ? "Please wait…" : otpSent ? "Send a new OTP" : "Send OTP"}</button>
                </form>
                {otpSent && <div className="workspace-form otp-form"><label>Six-digit OTP<input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} /></label><button className="workspace-button workspace-button-primary" onClick={() => void verifyOtp()} disabled={busy || otp.length < 4}>{busy ? "Verifying…" : "Verify OTP"}</button></div>}
              </div>
            )}
            {mode === "signin" && !usePhone && <button className="workspace-link-button" type="button" onClick={() => { setMode("reset"); setNotice(null); }}>Forgot password?</button>}
            <div className="workspace-divider"><span>or continue with</span></div>
            <button className="workspace-button workspace-button-secondary" type="button" onClick={() => void googleSignIn()} disabled={busy}>Continue with Google</button>
            <button className="workspace-link-button" type="button" onClick={() => { setUsePhone((value) => !value); setNotice(null); }}>{usePhone ? "Use email and password" : "Use phone + OTP"}</button>
          </section>
          <aside className="workspace-card workspace-auth-note">
            <p className="workspace-eyebrow">SAFE BY DESIGN</p>
            <h2>Your account stays yours.</h2>
            <p>Sessions use Supabase Auth. Order, address and role access remain governed by backend permissions and row-level security.</p>
            <a href="/legal#privacy">Read privacy information</a>
          </aside>
        </div>
      )}
      {notice && <p className={"workspace-notice " + notice.kind} role={notice.kind === "error" ? "alert" : "status"}>{notice.text}</p>}
      <p className="workspace-muted">Google redirect URLs and phone SMS/OTP must be enabled for the preview origin in Supabase Auth before those providers can complete sign-in.</p>
    </WorkspaceFrame>
  );
}
