import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const localFiles=new Set();
function walk(dir){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(entry.name==="."||entry.name===".."||entry.name===".git") continue;
    const full=path.join(dir,entry.name);
    if(entry.isDirectory()) walk(full);
    else localFiles.add("/"+path.relative(root,full).replaceAll(path.sep,"/"));
  }
}
walk(root);

function resolveSitePath(urlPath){
  const clean=urlPath.split(/[?#]/)[0];
  if(clean==="/Dudh-Wallah/"||clean==="/Dudh-Wallah") return "/index.html";
  if(clean.startsWith("/Dudh-Wallah/")) return clean.slice("/Dudh-Wallah".length);
  return clean;
}

const htmlFiles=[...localFiles].filter(x=>x.endsWith(".html"));
const errors=[];
let refs=0;
const refRe=/(?:src|href)=["']([^"']+)["']/gi;

for(const file of htmlFiles){
  const text=fs.readFileSync(path.join(root,file.slice(1)),"utf8");
  let m;
  while((m=refRe.exec(text))){
    const ref=m[1];
    if(!ref.startsWith("/")||ref.startsWith("//")||ref.startsWith("http://")||ref.startsWith("https://")||ref.startsWith("#")) continue;
    refs++;
    const resolved=resolveSitePath(ref);
    if(!localFiles.has(resolved)) errors.push(file+" -> missing "+ref);
  }
}

if(localFiles.has("/sw.js")){
  const sw=fs.readFileSync(path.join(root,"sw.js"),"utf8");
  const match=sw.match(/const ASSETS=\[(.*?)\];/s);
  if(!match) errors.push("sw.js -> ASSETS list not found");
  else{
    const assets=[...match[1].matchAll(/["']([^"']+)["']/g)].map(x=>x[1]);
    for(const asset of assets){
      const resolved=resolveSitePath(asset);
      if(!localFiles.has(resolved)) errors.push("sw.js -> cached asset missing "+asset);
    }
  }
}else errors.push("required runtime file missing /sw.js");

for(const file of ["/app.js","/auth.js","/checkout.js","/provider.js","/orders.js","/plans.js","/admin.js","/store.js","/product.js","/customer-nav.js","/location.js","/provider-location.js","/supabase-client.js","/supabase-config.js","/pwa-register.js","/session-controls.js"]){
  if(!localFiles.has(file)) errors.push("required runtime file missing "+file);
}



const sessionControlsPath=path.join(root,"session-controls.js");
if(localFiles.has("/session-controls.js")){
  const sessionControlsText=fs.readFileSync(sessionControlsPath,"utf8");
  for(const contract of ['auth.signOut({ scope: "local" })',"Sign out","onAuthStateChange"])
    if(!sessionControlsText.includes(contract)) errors.push("session-controls.js -> missing session/sign-out contract "+contract);
}else errors.push("required runtime file missing /session-controls.js");
for(const file of ["/index.html","/auth.html","/checkout.html","/orders.html","/plans.html","/store.html","/product.html"]){
  if(!localFiles.has(file)) continue;
  const html=fs.readFileSync(path.join(root,file.slice(1)),"utf8");
  if(!html.includes('/Dudh-Wallah/session-controls.js?v=20261011.1')) errors.push(file+" -> customer sign-out control missing or cache version stale");
}
const profileRegexMigration="/supabase/migrations/20261011151730_fix_customer_profile_phone_regex.sql";
if(localFiles.has(profileRegexMigration)){
  const migration=fs.readFileSync(path.join(root,profileRegexMigration.slice(1)),"utf8");
  if(!(migration.includes("v_phone !~ ") && migration.includes("[+]?[0-9]{10,15}"))) errors.push("profile regex migration -> PostgreSQL-safe phone validation missing");
}else errors.push("profile regex migration missing");

const pwaRegisterPath=path.join(root,"pwa-register.js");
if(localFiles.has("/pwa-register.js")){
  const pwaRegisterText=fs.readFileSync(pwaRegisterPath,"utf8");
  if(!pwaRegisterText.includes("serviceWorker.register")) errors.push("pwa-register.js -> service worker registration call missing");
  if(!pwaRegisterText.includes('/Dudh-Wallah/sw.js')) errors.push("pwa-register.js -> project-scoped service worker path missing");
}else errors.push("required runtime file missing /pwa-register.js");
for(const file of htmlFiles){
  const html=fs.readFileSync(path.join(root,file.slice(1)),"utf8");
  if(!html.includes("/Dudh-Wallah/pwa-register.js")) errors.push(file+" -> PWA registration script missing");
}

const providerJsPath=path.join(root,"provider.js");
if(fs.existsSync(providerJsPath)){
  const providerJs=fs.readFileSync(providerJsPath,"utf8");
  for(const contract of [
    "provider_get_dashboard",
    "provider_set_store_status",
    "provider_upsert_product",
    "provider_delete_product",
    "provider_get_subscriptions",
    "setupProviderOrderRealtime",
    "function startProviderOrderFeed()",
    "window.__providerOrderQueueFallbackTimer",
    "window.__providerKnownOrderIds",
    "Provider order feed bootstrap failed",
    "setupProviderSubscriptionRealtime",
    "acceptance_window_expired"
  ]) if(!providerJs.includes(contract)) errors.push("provider.js -> missing Phase 2 contract "+contract);
}

if(localFiles.has("/provider.js")){
  const providerText=fs.readFileSync(path.join(root,"provider.js"),"utf8");
  const bootText=providerText.slice(providerText.indexOf("async function bootProvider()"));
  if((bootText.match(/startProviderOrderFeed\(\);/g)||[]).length<2) errors.push("provider.js -> live and recovered provider boot paths must start the order feed");
}
const providerHtmlPath=path.join(root,"provider.html");
if(fs.existsSync(providerHtmlPath)){
  const providerHtml=fs.readFileSync(providerHtmlPath,"utf8");
  if(!providerHtml.includes('data-view="subscriptions"')) errors.push("provider.html -> subscriptions navigation missing");
  if(!providerHtml.includes('id="view-subscriptions"')) errors.push("provider.html -> subscriptions view missing");
  if(!providerHtml.includes("provider.js?v=")) errors.push("provider.html -> provider bundle cache bust missing");
  if(!providerHtml.includes("/Dudh-Wallah/provider.js?v=20261012.1")) errors.push("provider.html -> provider feed runtime cache version stale");
}
if(localFiles.has("/sw.js")){
  const swText=fs.readFileSync(path.join(root,"sw.js"),"utf8");
  if(!swText.includes("/Dudh-Wallah/provider.js?v=")) errors.push("sw.js -> versioned provider bundle missing from cache assets");
  if(!swText.includes("/Dudh-Wallah/provider.js?v=20261012.1")) errors.push("sw.js -> latest provider feed runtime missing from precache");
  if(!swText.includes("/Dudh-Wallah/auth.js?v=20261012.1")) errors.push("sw.js -> latest password recovery runtime missing from precache");
  if(!swText.includes('const CACHE="doodhwala-v67"')) errors.push("sw.js -> provider order feed cache revision missing");
}

const provider10xPath=path.join(root,"provider-10x.js");
if(fs.existsSync(provider10xPath)){
  const provider10x=fs.readFileSync(provider10xPath,"utf8");
  for(const contract of [
    "milkCommittedToday",
    "milkDeliveredToday",
    "if(error)throw error;",
    'data-shop-action="${esc(a.action)}"'
  ]) if(!provider10x.includes(contract)) errors.push("provider-10x.js -> missing reliability contract "+contract);
}
const customer10xPath=path.join(root,"customer-10x.js");
if(fs.existsSync(customer10xPath)){
  const customer10x=fs.readFileSync(customer10xPath,"utf8");
  for(const contract of ["milk_products","daily_available","unavailable item(s) skipped"]) if(!customer10x.includes(contract)) errors.push("customer-10x.js -> missing reorder safety contract "+contract);
}
const adminIntelPath=path.join(root,"admin-intelligence.js");
if(fs.existsSync(adminIntelPath)){
  const adminIntel=fs.readFileSync(adminIntelPath,"utf8");
  if(!adminIntel.includes("Latest seven dates in the selected overview range")) errors.push("admin-intelligence.js -> GMV range label must match selected range");
  if(!adminIntel.includes("loaded admin index")) errors.push("admin-intelligence.js -> bounded customer index must be disclosed");
}
const adminJsPath=path.join(root,"admin.js");
if(localFiles.has("/admin.js")){
  const adminJs=fs.readFileSync(adminJsPath,"utf8");
  for(const required of [
    "function adminRealtimeCacheKeys(table)",
    'table:"profiles"',
    'table:"subscription_deliveries"',
    "refreshAdminIndex(indexKeys)",
    "function refreshAdminSearch()",
    'const keys=Object.keys(ADMIN_INDEX_JOBS)'
  ]) if(!adminJs.includes(required)) errors.push("admin live sync -> missing integration contract "+required);
}
const adminHtmlPath=path.join(root,"admin.html");
if(localFiles.has("/admin.html")&&!fs.readFileSync(adminHtmlPath,"utf8").includes("/Dudh-Wallah/admin.js?v=20261012.1")) errors.push("admin.html -> admin live-sync bundle cache version stale");
if(localFiles.has("/sw.js")){
  const swText=fs.readFileSync(path.join(root,"sw.js"),"utf8");
  if(!swText.includes('const CACHE="doodhwala-v67"')) errors.push("sw.js -> admin live-sync cache revision stale");
  if(!swText.includes("/Dudh-Wallah/admin.js?v=20261012.1")) errors.push("sw.js -> latest admin bundle missing from precache");
}
const adminRealtimeMigration="/supabase/migrations/20261012082403_doodhwala_admin_realtime_data_sync.sql";
if(!localFiles.has(adminRealtimeMigration)) errors.push("admin live-sync migration missing");
else{
  const sql=fs.readFileSync(path.join(root,adminRealtimeMigration.slice(1)),"utf8");
  for(const table of ["profiles","milk_products","provider_service_areas"])
    if(!sql.includes("'"+table+"'")) errors.push("admin live-sync migration -> missing realtime publication for "+table);
  if(!sql.includes("private.is_current_user_admin()")) errors.push("admin live-sync migration -> realtime select policy must be owner-only");
}
const resiliencePath=path.join(root,"resilience.js");
if(!localFiles.has("/resilience.js")) errors.push("required runtime file missing /resilience.js");
else{
  const resilienceText=fs.readFileSync(resiliencePath,"utf8");
  for(const contract of ["unhandledrejection","network_failure","storage_parse_error","retryRead","showRecoveryNotice","client-error-report","doodhwala-error-report-queue-v1","persistPending","response.status >= 500"])
    if(!resilienceText.includes(contract)) errors.push("resilience.js -> missing reliability contract "+contract);
}
if(fs.existsSync(path.join(root,"auth.js"))&&!fs.readFileSync(path.join(root,"auth.js"),"utf8").includes('new URL(value,PRODUCTION_ORIGIN+"/auth.html")')) errors.push("auth.js -> safe relative return-path normalization missing");
if(fs.existsSync(path.join(root,"checkout.js"))&&fs.readFileSync(path.join(root,"checkout.js"),"utf8").includes('let cart=JSON.parse(localStorage.getItem(CART_KEY)')) errors.push("checkout.js -> unguarded cart storage parse");
if(fs.existsSync(path.join(root,"provider.js"))&&fs.readFileSync(path.join(root,"provider.js"),"utf8").includes('JSON.parse(localStorage.getItem(STORAGE_KEY)')) errors.push("provider.js -> unguarded provider storage parse");
if(fs.existsSync(path.join(root,"checkout.js"))&&!fs.readFileSync(path.join(root,"checkout.js"),"utf8").includes("readObjectStorage")) errors.push("checkout.js -> safe cart storage recovery missing");
if(localFiles.has("/checkout.js")){
  const checkoutText=fs.readFileSync(path.join(root,"checkout.js"),"utf8");
  for(const contract of ["let savedAddressId=null;","from(\"addresses\").update(row)",".eq(\"user_id\",sessionUser.id)","validCoordinates(latitude,longitude)","let placingOrder=false;","We couldn't finish checkout because of a connection problem.","Retry remaining orders →"])
    if(!checkoutText.includes(contract)) errors.push("checkout.js -> missing P0 checkout reliability contract "+contract);
}
if(localFiles.has("/orders.js")){
  const ordersText=fs.readFileSync(path.join(root,"orders.js"),"utf8");
  for(const contract of ["async function loadOrders(options={})","window.__ordersFallbackTimer","},60000);","Connection interrupted. Your orders are saved; we'll retry automatically."])
    if(!ordersText.includes(contract)) errors.push("orders.js -> missing P0 order refresh fallback contract "+contract);
}
if(localFiles.has("/checkout.html")){
  const checkoutHtml=fs.readFileSync(path.join(root,"checkout.html"),"utf8");
  if(!checkoutHtml.includes('href="/Dudh-Wallah/orders.html">Track my order')) errors.push("checkout.html -> order success must link directly to order tracking");
  if(!checkoutHtml.includes('/Dudh-Wallah/checkout.js?v=20261011.4')) errors.push("checkout.html -> checkout runtime cache version stale");
}
if(localFiles.has("/sw.js")){
  const swP0=fs.readFileSync(path.join(root,"sw.js"),"utf8");
  if(!swP0.includes('const CACHE="doodhwala-v67"')) errors.push("sw.js -> P0 checkout cache revision missing");
  if(!swP0.includes('/Dudh-Wallah/checkout.js?v=20261011.4')) errors.push("sw.js -> latest checkout runtime missing from precache");
}

if(fs.existsSync(path.join(root,"provider.js"))&&!fs.readFileSync(path.join(root,"provider.js"),"utf8").includes("readObjectStorage")) errors.push("provider.js -> safe provider storage recovery missing");
if(fs.existsSync(path.join(root,"admin.js"))){
  const adminText=fs.readFileSync(path.join(root,"admin.js"),"utf8");
  if(!adminText.includes("admin_list_client_error_reports")) errors.push("admin.js -> System Health RPC missing");
  if(!adminText.includes('section==="health"')) errors.push("admin.js -> System Health route missing");
}
if(fs.existsSync(path.join(root,"admin.html"))){
  const adminHtml=fs.readFileSync(path.join(root,"admin.html"),"utf8");
  if(!adminHtml.includes('data-section="health"')) errors.push("admin.html -> System Health navigation missing");
  if(!adminHtml.includes('admin.js?v=20261012.1')) errors.push("admin.html -> admin runtime cache version stale");
}
for(const file of htmlFiles){
  const htmlText=fs.readFileSync(path.join(root,file.slice(1)),"utf8");
  if(!htmlText.includes('/Dudh-Wallah/resilience.js?v=20261011.1')) errors.push(file+" -> resilience bootstrap missing or cache version stale");
}
if(localFiles.has("/sw.js")){
  const swCheck=fs.readFileSync(path.join(root,"sw.js"),"utf8");
  const swMatch=swCheck.match(/const ASSETS=\[(.*?)\];/s);
  const cached=new Set(swMatch?[...swMatch[1].matchAll(/["']([^"']+)["']/g)].map(x=>x[1].split(/[?#]/)[0]):[]);
  for(const file of htmlFiles){
    const htmlText=fs.readFileSync(path.join(root,file.slice(1)),"utf8");
    let scriptMatch;const scripts=/<script[^>]+src=["']([^"']+)["']/gi;
    while((scriptMatch=scripts.exec(htmlText))){
      const src=scriptMatch[1];
      if(src.startsWith("/Dudh-Wallah/")&&/\.js(?:\?|$)/.test(src)&&!cached.has(src.split(/[?#]/)[0]))
        errors.push(file+" -> local script missing from PWA precache: "+src);
    }
  }
}


for(const file of ["/index.html","/auth.html","/checkout.html","/orders.html","/plans.html","/store.html","/product.html","/provider.html","/admin.html"]){
  if(!localFiles.has(file)) continue;
  const html=fs.readFileSync(path.join(root,file.slice(1)),"utf8");
  if(!html.includes('resilience.js?v=20261011.1')) errors.push(file+" -> resilience runtime must be cache-busted and loaded");
}
for(const [file,expected] of [["/checkout.html","return=%2FDudh-Wallah%2Fcheckout.html"],["/orders.html","return=%2FDudh-Wallah%2Forders.html"],["/plans.html","return=%2FDudh-Wallah%2Fplans.html"]]){
  if(localFiles.has(file)){
    const html=fs.readFileSync(path.join(root,file.slice(1)),"utf8");
    if(!html.includes(expected)) errors.push(file+" -> sign-in must return to its original page");
  }
}

if(errors.length){
  console.error("Doodhwala site contract validation failed:");
  for(const e of errors) console.error(" - "+e);
  process.exit(1);
}
console.log("Doodhwala site contract validation passed: "+htmlFiles.length+" HTML files, "+refs+" local asset references checked.");
