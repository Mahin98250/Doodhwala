import { StatusBar } from "expo-status-bar";
import * as Location from "expo-location";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { ActivityIndicator, Linking, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { isSupabaseConfigured, supabase } from "./lib/supabase";

type MilkType = "cow" | "buffalo" | "a2" | "mixed" | "other";
type MilkFilter = "all" | "cow" | "buffalo" | "a2";
type Product = { id: string; name: string; milkType: MilkType; price: number | null; available: boolean; unit: string };
type Provider = { id: string; name: string; area: string; city: string; description: string; milkType: MilkType; rating: number | null; distance: number | null; serviceable: boolean | null; products: Product[] };
const filters: { label: string; value: MilkFilter }[] = [{ label: "All milk", value: "all" }, { label: "Cow", value: "cow" }, { label: "Buffalo", value: "buffalo" }, { label: "A2", value: "a2" }];
const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
function rec(v: unknown): Record<string, unknown> | null { return v !== null && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : null; }
function str(v: unknown, fallback = ""): string { return typeof v === "string" || typeof v === "number" ? String(v).trim().slice(0, 160) || fallback : fallback; }
function num(v: unknown): number | null { if (v === null || v === undefined || v === "") return null; const n = typeof v === "number" ? v : Number(v); return Number.isFinite(n) ? n : null; }
function milk(v: unknown): MilkType { const s = str(v).toLowerCase(); return s === "cow" || s === "buffalo" || s === "a2" || s === "mixed" ? s : "other"; }
function normalize(v: unknown): Provider | null {
  const r = rec(v); if (!r) return null;
  const id = str(r.provider_id), name = str(r.provider_name); if (!id || !name) return null;
  const products = (Array.isArray(r.products) ? r.products : []).map((v): Product | null => {
    const p = rec(v); if (!p) return null; const pid = str(p.id), pname = str(p.name); if (!pid || !pname) return null;
    const price = num(p.price_per_litre);
    return { id: pid, name: pname, milkType: milk(p.milk_type ?? r.milk_type), price: price !== null && price > 0 ? price : null, available: p.daily_available === true, unit: str(p.unit_label, "1 L") };
  }).filter((p): p is Product => p !== null);
  const rating = num(r.rating_avg), distance = num(r.distance_km);
  return { id, name, area: str(r.area_name, "Local area"), city: str(r.city), description: str(r.description, "Fresh local milk from an independent provider."), milkType: milk(r.milk_type), rating: rating !== null && rating >= 0 && rating <= 5 ? rating : null, distance: distance !== null && distance >= 0 ? distance : null, serviceable: typeof r.is_serviceable === "boolean" ? r.is_serviceable : null, products };
}
function distanceLabel(n: number | null): string { return n === null ? "Distance unavailable" : n < 1 ? `${Math.max(100, Math.round(n * 1000))} m away` : `${n.toFixed(n < 10 ? 1 : 0)} km away`; }

export default function App() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "not-configured">("loading");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<MilkFilter>("all");
  const [locationShared, setLocationShared] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [authMode, setAuthMode] = useState<"sign-in" | "sign-up" | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [savedProviders, setSavedProviders] = useState<string[]>([]);
  const [showSavedOnly, setShowSavedOnly] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let mounted = true;
    void client.auth.getSession().then(({ data }) => { if (mounted) setSession(data.session); });
    const { data: listener } = client.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      if (event === "PASSWORD_RECOVERY") { setRecoveryMode(true); setAuthMode(null); setAuthMessage("Choose a new password to finish account recovery."); }
      if (event === "SIGNED_OUT") setRecoveryMode(false);
    });
    const handleRecoveryUrl = async (incomingUrl: string | null) => {
      if (!incomingUrl || !incomingUrl.startsWith("doodhwala://")) return;
      try {
        const parsed = new URL(incomingUrl);
        if (!parsed.pathname.endsWith("/reset-password") && parsed.host !== "auth") return;
        const hash = new URLSearchParams(parsed.hash.replace(/^#/, ""));
        const query = parsed.searchParams;
        const accessToken = hash.get("access_token") ?? query.get("access_token");
        const refreshToken = hash.get("refresh_token") ?? query.get("refresh_token");
        if (accessToken && refreshToken) {
          const { error } = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (error) throw error;
          if (mounted) { setRecoveryMode(true); setAuthMode(null); setAuthMessage("Choose a new password to finish account recovery."); }
        } else if (mounted) setAuthMessage("This recovery link is incomplete or expired. Request a new password reset email.");
      } catch {
        if (mounted) setAuthMessage("Could not open the recovery link. Request a new password reset email.");
      }
    };
    void Linking.getInitialURL().then(handleRecoveryUrl);
    const urlListener = Linking.addEventListener("url", ({ url }) => { void handleRecoveryUrl(url); });
    return () => { mounted = false; listener.subscription.unsubscribe(); urlListener.remove(); };
  }, []);

  const submitAuth = async () => {
    if (!supabase || !authMode) { setAuthMessage("Connect the staging Supabase configuration first."); return; }
    const email = authEmail.trim().toLowerCase();
    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) { setAuthMessage("Enter a valid email address."); return; }
    if (authPassword.length < 8) { setAuthMessage("Use a password with at least 8 characters."); return; }
    setAuthBusy(true); setAuthMessage("");
    try {
      if (authMode === "sign-in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: authPassword });
        if (error) throw error;
        setAuthMessage("You’re signed in. Your account permissions are still enforced by the backend.");
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password: authPassword });
        if (error) throw error;
        setAuthMessage(data.session ? "Account created and signed in." : "Account request created. Check your email to confirm before signing in.");
      }
      setAuthPassword("");
      setAuthMode(null);
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message.slice(0, 180) : "Authentication failed. Please try again.");
    } finally { setAuthBusy(false); }
  };

  const requestPasswordReset = async () => {
    if (!supabase) { setAuthMessage("Connect the staging Supabase configuration first."); return; }
    const email = authEmail.trim().toLowerCase();
    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) { setAuthMessage("Enter your account email address first."); return; }
    setAuthBusy(true); setAuthMessage("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: "doodhwala://auth/reset-password" });
      if (error) throw error;
      setAuthMessage("If password recovery is enabled, a reset link will arrive by email. Open it on this device to choose a new password.");
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message.slice(0, 180) : "Could not request a reset email. Please try again.");
    } finally { setAuthBusy(false); }
  };

  const updateRecoveredPassword = async () => {
    if (!supabase) return;
    if (authPassword.length < 8) { setAuthMessage("Use a new password with at least 8 characters."); return; }
    setAuthBusy(true); setAuthMessage("");
    try {
      const { error } = await supabase.auth.updateUser({ password: authPassword });
      if (error) throw error;
      setAuthPassword(""); setRecoveryMode(false); setAuthMessage("Password updated. Your account is ready to use.");
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message.slice(0, 180) : "Could not update your password. Request a new recovery link.");
    } finally { setAuthBusy(false); }
  };

  const signOut = async () => {
    if (!supabase) return;
    setAuthBusy(true);
    const { error } = await supabase.auth.signOut();
    setAuthMessage(error ? "Could not sign out. Please try again." : "You’re signed out.");
    setAuthBusy(false);
  };

  const loadProviders = useCallback(async (coords?: { latitude: number; longitude: number } | null) => {
    if (!supabase) { setStatus("not-configured"); setProviders([]); setMessage("Connect a staging Supabase project to load real sellers. No demo sellers are shown."); return; }
    setStatus("loading"); setMessage("");
    try {
      const { data, error } = await supabase.rpc("find_nearby_providers_v2", { p_latitude: coords?.latitude ?? null, p_longitude: coords?.longitude ?? null, p_max_km: 20 });
      if (error) throw error;
      const rows = (Array.isArray(data) ? data : []).map(normalize).filter((p): p is Provider => p !== null);
      setProviders(rows); setStatus("ready");
      if (!rows.length) setMessage("No public sellers were returned. Try again later or share your delivery location.");
    } catch { setStatus("error"); setMessage("We couldn’t load sellers. Check your connection and try again."); }
  }, []);

  useEffect(() => { void loadProviders(null); }, [loadProviders]);
  const visible = useMemo(() => providers.filter((p) => {
    const productMatch = filter === "all" || (p.products.length ? p.products.some((item) => item.milkType === filter) : p.milkType === filter);
    return productMatch && (!showSavedOnly || savedProviders.includes(p.id)) && [p.name, p.area, p.city, ...p.products.map((item) => item.name)].join(" ").toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
  }), [providers, filter, search, showSavedOnly, savedProviders]);

  const useLocation = async () => {
    setMessage("Requesting location permission…");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") { setLocationShared(false); setMessage("Location wasn’t shared. You can still browse without it."); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocationShared(true);
      await loadProviders({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    } catch { setMessage("Could not access location. You can still browse without sharing it."); }
  };
  const clearLocation = async () => { setLocationShared(false); await loadProviders(null); };

  return <SafeAreaView style={s.safe}>
    <StatusBar style="dark" />
    <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={s.topbar}><View style={s.logo}><Text style={s.logoText}>D</Text></View><View style={s.brand}><Text style={s.brandName}>Doodhwala</Text><Text style={s.tagline}>Local milk, nearby.</Text></View><View style={s.badge}><View style={s.dot}/><Text style={s.badgeText}>LOCAL FIRST</Text></View></View>
      <View style={s.authCard}>
        {recoveryMode ? <>
          <Text style={s.authTitle}>Choose a new password</Text>
          <Text style={s.authSub}>Use a password you have not used before.</Text>
          <TextInput accessibilityLabel="New password" autoCapitalize="none" autoComplete="new-password" secureTextEntry placeholder="New password (8+ characters)" placeholderTextColor="#879488" value={authPassword} onChangeText={setAuthPassword} style={[s.authInput,{marginTop:14}]}/>
          <Pressable accessibilityRole="button" disabled={authBusy} onPress={() => void updateRecoveredPassword()} style={[s.authSubmit,authBusy && s.authDisabled]}><Text style={s.authSubmitText}>{authBusy ? "Updating…" : "Update password"}</Text></Pressable>
        </> : session ? <><View style={s.authHead}><View style={s.authCopy}><Text style={s.authTitle}>Your account</Text><Text style={s.authSub}>{session.user.email ?? "Signed-in account"}</Text></View><Pressable accessibilityRole="button" disabled={authBusy} onPress={() => void signOut()} style={s.authButton}><Text style={s.authButtonText}>{authBusy ? "Please wait…" : "Sign out"}</Text></Pressable></View><Text style={s.authHint}>Sign-in confirms identity only. Seller, admin and owner permissions must be verified by the backend.</Text></> : <>
          <View style={s.authHead}><View style={s.authCopy}><Text style={s.authTitle}>Your Doodhwala account</Text><Text style={s.authSub}>Sign in to prepare for orders and saved details.</Text></View><Pressable accessibilityRole="button" onPress={() => { setAuthMode(authMode ? null : "sign-in"); setAuthMessage(""); }} style={s.authButton}><Text style={s.authButtonText}>{authMode ? "Close" : "Sign in"}</Text></Pressable></View>
          {authMode && <><View style={s.authModes}><Pressable accessibilityRole="button" onPress={() => { setAuthMode("sign-in"); setAuthMessage(""); }} style={[s.authMode, authMode === "sign-in" && s.authModeActive]}><Text style={[s.authModeText, authMode === "sign-in" && s.authModeTextActive]}>Sign in</Text></Pressable><Pressable accessibilityRole="button" onPress={() => { setAuthMode("sign-up"); setAuthMessage(""); }} style={[s.authMode, authMode === "sign-up" && s.authModeActive]}><Text style={[s.authModeText, authMode === "sign-up" && s.authModeTextActive]}>Create account</Text></Pressable></View>
          <TextInput accessibilityLabel="Email address" autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="Email address" placeholderTextColor="#879488" value={authEmail} onChangeText={setAuthEmail} style={s.authInput}/>
          <TextInput accessibilityLabel="Password" autoCapitalize="none" autoComplete={authMode === "sign-up" ? "new-password" : "current-password"} secureTextEntry placeholder="Password (8+ characters)" placeholderTextColor="#879488" value={authPassword} onChangeText={setAuthPassword} style={s.authInput}/>
          <Pressable accessibilityRole="button" disabled={authBusy} onPress={() => void submitAuth()} style={[s.authSubmit, authBusy && s.authDisabled]}><Text style={s.authSubmitText}>{authBusy ? "Please wait…" : authMode === "sign-up" ? "Create account" : "Sign in securely"}</Text></Pressable>
          {authMode === "sign-in" && <Pressable accessibilityRole="button" disabled={authBusy} onPress={() => void requestPasswordReset()} style={s.resetButton}><Text style={s.resetText}>Forgot password?</Text></Pressable>}
          <Text style={s.authHint}>Uses Supabase Auth with the configured staging project. Email confirmation may be required by project settings.</Text></>}
        </>}
        {!!authMessage && <Text accessibilityRole="text" style={s.authMessage}>{authMessage}</Text>}
      </View>
      <View style={s.hero}>
        <Text style={s.eyebrow}>FRESH · LOCAL · DIRECT</Text>
        <Text style={s.title}>Your neighbourhood’s milk,{"\n"}<Text style={s.titleAccent}>one tap away.</Text></Text>
        <Text style={s.description}>Discover independent milk sellers near your home. Compare options and choose what works for your family.</Text>
        <View style={s.pills}><Text style={s.pill}>✓ Independent sellers</Text><Text style={s.pill}>✓ Clear prices</Text></View>
        <View style={s.art}><View style={s.sun}/><View style={s.hillBack}/><View style={s.hillFront}/><View style={s.cap}/><View style={s.neck}/><View style={s.bottle}><Text style={s.flower}>✳</Text><Text style={s.bottleLabel}>FRESH{"\n"}DAILY</Text></View><View style={s.caption}><Text style={s.captionStrong}>Closer to home</Text><Text style={s.captionSmall}>Supporting local milk sellers</Text></View></View>
      </View>
      <View style={s.section}><Text style={s.eyebrow}>THE LOCAL CATALOGUE</Text><Text style={s.sectionTitle}>Find your kind of milk</Text><Text style={s.sectionSub}>Real sellers from Doodhwala’s existing catalogue.</Text></View>
      <TextInput accessibilityLabel="Search sellers and milk products" placeholder="Search seller, area or milk…" placeholderTextColor="#879488" value={search} onChangeText={setSearch} returnKeyType="search" style={s.search}/>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>{filters.map((f) => <Pressable key={f.value} onPress={() => setFilter(f.value)} accessibilityRole="button" accessibilityState={{ selected: filter === f.value }} style={[s.filter, filter === f.value && s.filterActive]}><Text style={[s.filterText, filter === f.value && s.filterTextActive]}>{f.label}</Text></Pressable>)}</ScrollView>
      <View style={s.location}><View style={s.locationCopy}><Text style={s.locationTitle}>Delivery location</Text><Text style={s.locationSub}>{locationShared ? "Using your location for this search" : "Location not shared"}</Text></View><Pressable accessibilityRole="button" onPress={locationShared ? clearLocation : useLocation} style={s.locationButton}><Text style={s.locationButtonText}>{locationShared ? "Clear" : "Use location"}</Text></Pressable></View>
      <Text style={s.privacy}>Your location is requested only after you tap the button and is used for this nearby search.</Text>
      <View style={s.resultsHead}><View><Text style={s.resultsTitle}>{showSavedOnly ? "Saved sellers" : "Nearby sellers"}</Text>{status === "ready" && <Text style={s.count}>{visible.length} found · {savedProviders.length} saved</Text>}</View><Pressable accessibilityRole="button" accessibilityState={{ selected: showSavedOnly }} onPress={() => setShowSavedOnly((v) => !v)} style={[s.savedToggle, showSavedOnly && s.savedToggleActive]}><Text style={[s.savedToggleText, showSavedOnly && s.savedToggleTextActive]}>{showSavedOnly ? "♥ Saved" : "♡ Saved"}</Text></Pressable></View>
      {status === "loading" && <View style={s.state}><ActivityIndicator color="#2f7548" size="large"/><Text style={s.stateText}>Finding local milk sellers…</Text></View>}
      {(status === "error" || status === "not-configured" || (status === "ready" && visible.length === 0)) && <View style={s.state}><Text style={s.stateTitle}>{status === "not-configured" ? "Backend not connected yet" : status === "error" ? "Couldn’t load sellers" : "No sellers match this search"}</Text><Text style={s.stateText}>{message || "Try another search or milk type."}</Text><Pressable accessibilityRole="button" onPress={() => void loadProviders(null)} style={s.retry}><Text style={s.retryText}>Try again</Text></Pressable></View>}
      {status === "ready" && visible.map((p) => {
        const products = p.products.filter((item) => filter === "all" || item.milkType === filter);
        const prices = products.map((item) => item.price).filter((v): v is number => v !== null);
        return <View key={p.id} style={s.provider}>
          <View style={s.providerHead}><View style={s.avatar}><Text style={s.avatarText}>{p.name.slice(0, 1).toUpperCase()}</Text></View><View style={s.providerCopy}><Text style={s.providerName}>{p.name}</Text><Text style={s.area}>{[p.area, p.city].filter(Boolean).join(", ")}</Text></View>{p.rating !== null && <View style={s.rating}><Text style={s.ratingText}>★ {p.rating.toFixed(1)}</Text></View>}<Pressable accessibilityRole="button" accessibilityLabel={savedProviders.includes(p.id) ? `Remove ${p.name} from saved sellers` : `Save ${p.name}`} accessibilityState={{ selected: savedProviders.includes(p.id) }} onPress={() => setSavedProviders((current) => current.includes(p.id) ? current.filter((id) => id !== p.id) : [...current, p.id])} style={s.heartButton}><Text style={[s.heartText, savedProviders.includes(p.id) && s.heartTextActive]}>{savedProviders.includes(p.id) ? "♥" : "♡"}</Text></Pressable>}</View>
          <Text style={s.providerDescription}>{p.description}</Text>
          <View style={s.meta}><Text style={s.metaText}>{distanceLabel(p.distance)}</Text><Text style={s.metaText}>{p.serviceable === true ? "Serves your area" : p.serviceable === false ? "Coverage not confirmed" : "Check delivery coverage"}</Text></View>
          {products.length ? products.slice(0, 4).map((item) => <View key={item.id} style={s.product}><View style={s.productDot}/><View style={s.productCopy}><Text style={s.productName}>{item.name}</Text><Text style={s.productUnit}>{item.available ? "Available daily" : "Availability varies"} · {item.unit}</Text></View><Text style={s.price}>{item.price === null ? "Price on request" : `${money.format(item.price)}/L`}</Text></View>) : <Text style={s.noProducts}>No products match this milk filter.</Text>}
          {prices.length > 0 && <Text style={s.fromPrice}>From {money.format(Math.min(...prices))} per litre</Text>}
        </View>;
      })}
      <View style={s.notice}><Text style={s.noticeTitle}>{isSupabaseConfigured ? "Existing catalogue connection" : "Staging setup needed"}</Text><Text style={s.noticeText}>{isSupabaseConfigured ? "Seller data uses the existing nearby-provider RPC. Ordering and payments remain disabled until end-to-end staging verification." : "Add the public Supabase URL and publishable/anon key locally. Never put service-role secrets in a mobile app."}</Text></View>
      <View style={s.footer}><Text style={s.footerBrand}>Doodhwala</Text><Text style={s.footerText}>Built around neighbourhoods, powered by local sellers.</Text><Text style={s.footerMeta}>Website · Android · iOS</Text></View>
    </ScrollView>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:"#f8faf5"},page:{paddingHorizontal:22,paddingTop:12,paddingBottom:36,maxWidth:620,width:"100%",alignSelf:"center"},
  topbar:{flexDirection:"row",alignItems:"center",marginBottom:25},logo:{width:42,height:42,borderRadius:15,backgroundColor:"#1f6b43",alignItems:"center",justifyContent:"center"},logoText:{color:"#fff",fontSize:23,fontWeight:"800"},brand:{marginLeft:10},brandName:{color:"#183a29",fontSize:18,fontWeight:"800",letterSpacing:-.5},tagline:{color:"#738276",fontSize:11,marginTop:2},badge:{marginLeft:"auto",flexDirection:"row",alignItems:"center",gap:6,backgroundColor:"#eaf3e7",paddingHorizontal:10,paddingVertical:8,borderRadius:20},dot:{width:6,height:6,borderRadius:3,backgroundColor:"#3d8c55"},badgeText:{color:"#356848",fontSize:9,fontWeight:"800",letterSpacing:.7},
  hero:{backgroundColor:"#edf5e8",borderRadius:28,padding:22,overflow:"hidden"},eyebrow:{color:"#4c805b",fontSize:10,fontWeight:"800",letterSpacing:1.5,marginBottom:10},title:{color:"#183a29",fontSize:32,lineHeight:37,fontWeight:"800",letterSpacing:-1.1},titleAccent:{color:"#4c8a53",fontStyle:"italic"},description:{color:"#607565",fontSize:14,lineHeight:21,marginTop:14},pills:{flexDirection:"row",flexWrap:"wrap",gap:8,marginTop:16},pill:{color:"#315e40",backgroundColor:"#fff",borderRadius:18,paddingHorizontal:10,paddingVertical:7,fontSize:10,fontWeight:"700"},
  art:{height:170,backgroundColor:"#dcebd1",borderRadius:20,marginTop:22,overflow:"hidden",alignItems:"center",justifyContent:"flex-end"},sun:{position:"absolute",width:68,height:68,borderRadius:34,backgroundColor:"#f8e6a9",top:18,right:26},hillBack:{position:"absolute",width:300,height:130,borderRadius:100,backgroundColor:"#b9d6a9",bottom:-70,left:-50,transform:[{rotate:"-8deg"}]},hillFront:{position:"absolute",width:350,height:100,borderRadius:100,backgroundColor:"#8fbd82",bottom:-65,right:-80,transform:[{rotate:"8deg"}]},cap:{position:"absolute",width:35,height:13,borderTopLeftRadius:5,borderTopRightRadius:5,backgroundColor:"#39754d",bottom:112,zIndex:2},neck:{position:"absolute",width:30,height:24,backgroundColor:"#fffdf7",bottom:91,zIndex:1},bottle:{position:"absolute",width:76,height:90,bottom:13,backgroundColor:"#fffdf7",borderRadius:18,borderWidth:2,borderColor:"#d2dfcc",alignItems:"center",justifyContent:"center",zIndex:1},flower:{fontSize:24,color:"#4c8a53"},bottleLabel:{color:"#3f6e4c",textAlign:"center",fontSize:9,fontWeight:"900",letterSpacing:1,marginTop:3},caption:{position:"absolute",bottom:12,left:12,backgroundColor:"rgba(255,255,255,0.9)",borderRadius:13,paddingHorizontal:12,paddingVertical:9,zIndex:3},captionStrong:{color:"#244c31",fontSize:11,fontWeight:"800"},captionSmall:{color:"#728375",fontSize:9,marginTop:2},
  section:{marginTop:28,marginBottom:14},sectionTitle:{color:"#183a29",fontSize:23,fontWeight:"800",letterSpacing:-.7},sectionSub:{color:"#738276",fontSize:12,marginTop:6},search:{backgroundColor:"#fff",borderWidth:1,borderColor:"#e2e9df",borderRadius:15,paddingHorizontal:15,paddingVertical:13,color:"#243f2e",fontSize:14},filters:{gap:8,paddingVertical:14},filter:{borderRadius:20,borderWidth:1,borderColor:"#dce6d9",backgroundColor:"#fff",paddingHorizontal:15,paddingVertical:9},filterActive:{backgroundColor:"#286d43",borderColor:"#286d43"},filterText:{color:"#506b58",fontSize:12,fontWeight:"700"},filterTextActive:{color:"#fff"},
  location:{flexDirection:"row",alignItems:"center",backgroundColor:"#edf5e8",borderRadius:17,padding:14,gap:10},locationCopy:{flex:1},locationTitle:{color:"#244a30",fontSize:13,fontWeight:"800"},locationSub:{color:"#6d806f",fontSize:11,marginTop:4},locationButton:{backgroundColor:"#fff",borderRadius:12,paddingHorizontal:12,paddingVertical:10},locationButtonText:{color:"#2f7548",fontSize:11,fontWeight:"800"},privacy:{color:"#829083",fontSize:10,lineHeight:15,marginTop:8},
  resultsHead:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:26,marginBottom:12},savedToggle:{borderRadius:12,borderWidth:1,borderColor:"#dce6d9",backgroundColor:"#fff",paddingHorizontal:12,paddingVertical:9},savedToggleActive:{backgroundColor:"#286d43",borderColor:"#286d43"},savedToggleText:{color:"#45684f",fontSize:11,fontWeight:"800"},savedToggleTextActive:{color:"#fff"},heartButton:{width:34,height:34,alignItems:"center",justifyContent:"center",borderRadius:12,backgroundColor:"#f4f7f1"},heartText:{fontSize:21,color:"#78907b"},heartTextActive:{color:"#d14e5b"},resultsTitle:{color:"#183a29",fontSize:20,fontWeight:"800",letterSpacing:-.5},count:{color:"#718074",fontSize:12},state:{alignItems:"center",backgroundColor:"#fff",borderWidth:1,borderColor:"#e5ece1",borderRadius:18,padding:22,gap:10},stateTitle:{color:"#244a30",fontSize:15,fontWeight:"800",textAlign:"center"},stateText:{color:"#728174",fontSize:12,lineHeight:18,textAlign:"center"},retry:{backgroundColor:"#286d43",borderRadius:12,paddingHorizontal:18,paddingVertical:11,marginTop:4},retryText:{color:"#fff",fontSize:12,fontWeight:"800"},
  provider:{backgroundColor:"#fff",borderRadius:20,borderWidth:1,borderColor:"#e4ebe1",padding:16,marginBottom:12},providerHead:{flexDirection:"row",alignItems:"center",gap:10},avatar:{width:42,height:42,borderRadius:14,backgroundColor:"#eaf3e6",alignItems:"center",justifyContent:"center"},avatarText:{color:"#2f7548",fontSize:18,fontWeight:"900"},providerCopy:{flex:1},providerName:{color:"#244a30",fontSize:15,fontWeight:"800"},area:{color:"#7b887e",fontSize:11,marginTop:4},rating:{backgroundColor:"#fff4d9",borderRadius:10,paddingHorizontal:8,paddingVertical:6},ratingText:{color:"#7c5a17",fontSize:11,fontWeight:"800"},providerDescription:{color:"#6b796d",fontSize:12,lineHeight:18,marginTop:12},meta:{flexDirection:"row",flexWrap:"wrap",gap:8,marginTop:12},metaText:{color:"#3c6b49",backgroundColor:"#f0f6ed",borderRadius:9,paddingHorizontal:8,paddingVertical:6,fontSize:10,fontWeight:"700"},product:{flexDirection:"row",alignItems:"center",paddingVertical:10,gap:8,borderTopWidth:1,borderTopColor:"#edf1eb",marginTop:6},productDot:{width:7,height:7,borderRadius:4,backgroundColor:"#6aa56e"},productCopy:{flex:1},productName:{color:"#314d38",fontSize:12,fontWeight:"700"},productUnit:{color:"#899489",fontSize:10,marginTop:3},price:{color:"#285f3b",fontSize:11,fontWeight:"800",textAlign:"right"},noProducts:{color:"#899489",fontSize:11,marginTop:12},fromPrice:{color:"#2f7548",fontSize:11,fontWeight:"800",marginTop:10},
  authCard:{backgroundColor:"#fff",borderRadius:18,borderWidth:1,borderColor:"#e4ebe1",padding:15,marginBottom:18},authHead:{flexDirection:"row",alignItems:"center",gap:12},authCopy:{flex:1},authTitle:{color:"#244a30",fontSize:14,fontWeight:"800"},authSub:{color:"#778578",fontSize:11,lineHeight:16,marginTop:4},authButton:{backgroundColor:"#edf5e8",borderRadius:12,paddingHorizontal:13,paddingVertical:10},authButtonText:{color:"#2f7548",fontSize:11,fontWeight:"800"},authModes:{flexDirection:"row",gap:8,marginTop:14,marginBottom:12},authMode:{flex:1,alignItems:"center",borderRadius:11,borderWidth:1,borderColor:"#dce6d9",paddingVertical:10},authModeActive:{backgroundColor:"#286d43",borderColor:"#286d43"},authModeText:{color:"#506b58",fontSize:11,fontWeight:"700"},authModeTextActive:{color:"#fff"},authInput:{backgroundColor:"#fbfcfa",borderWidth:1,borderColor:"#e2e9df",borderRadius:12,paddingHorizontal:13,paddingVertical:12,color:"#243f2e",fontSize:13,marginBottom:9},authSubmit:{backgroundColor:"#286d43",borderRadius:12,alignItems:"center",paddingVertical:13,marginTop:2},authDisabled:{opacity:.6},authSubmitText:{color:"#fff",fontSize:12,fontWeight:"800"},authHint:{color:"#829083",fontSize:10,lineHeight:15,marginTop:9},authMessage:{color:"#3c6b49",fontSize:11,lineHeight:16,marginTop:10},resetButton:{alignSelf:"flex-start",paddingVertical:10,paddingHorizontal:2},resetText:{color:"#2f7548",fontSize:11,fontWeight:"800"},
  notice:{marginTop:22,backgroundColor:"#f0f4ed",borderRadius:18,padding:16,borderWidth:1,borderColor:"#e0e9dc"},noticeTitle:{color:"#2d5839",fontSize:13,fontWeight:"800"},noticeText:{color:"#66766a",fontSize:12,lineHeight:18,marginTop:7},footer:{alignItems:"center",paddingTop:28,gap:7},footerBrand:{color:"#2e6943",fontSize:16,fontWeight:"900"},footerText:{color:"#7b887e",textAlign:"center",fontSize:11},footerMeta:{color:"#9aa49b",fontSize:10,marginTop:4}
});
