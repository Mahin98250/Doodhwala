const STORAGE_KEY="doodhwala-provider-v1";
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function newUuid(){
 if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();
 const bytes=new Uint8Array(16);
 if(globalThis.crypto?.getRandomValues)globalThis.crypto.getRandomValues(bytes);
 else for(let i=0;i<bytes.length;i++)bytes[i]=Math.floor(Math.random()*256);
 bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const hex=Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
 return hex.slice(0,8)+"-"+hex.slice(8,12)+"-"+hex.slice(12,16)+"-"+hex.slice(16,20)+"-"+hex.slice(20);
}
function normalizeProductIds(){
 const seen=new Set(),products=Array.isArray(provider.products)?provider.products:[];
 let changed=false;
 provider.products=products.map(p=>{
   const next={...p};
   if(!UUID_RE.test(String(next.id||""))||seen.has(String(next.id||""))){next.id=newUuid();changed=true}
   seen.add(next.id);
   return next;
 });
 if(changed)save();
}

const defaultProvider={providerName:"",ownerName:"",phone:"",type:"cow",area:"",city:"Ahmedabad",pin:"",radius:"5",from:"06:00",to:"09:00",maxOpenOrders:"25",maxDailyLitres:"250",acceptanceTimeoutMinutes:"10",acceptingOrders:true,products:[]};
let provider=Object.assign({},defaultProvider,window.DoodhwalaResilience?.readObjectStorage(STORAGE_KEY,{})||{});
let currentStep=1;
normalizeProductIds();
const $=id=>document.getElementById(id);
async function getCurrentLocation(){
 return await new Promise(function(resolve){if(!navigator.geolocation){resolve(null);return}navigator.geolocation.getCurrentPosition(function(pos){resolve({latitude:pos.coords.latitude,longitude:pos.coords.longitude})},function(){resolve(null)},{enableHighAccuracy:false,timeout:7000,maximumAge:600000})})
}
async function loadProviderBackendState(){
 if(!window.Doodhwala?.configured)return {ok:false,reason:"not_configured"};
 const {data:userData,error:userError}=await Doodhwala.supabase.auth.getUser();
 if(userError||!userData?.user)return {ok:false,reason:"not_signed_in"};
 const {data,error}=await Doodhwala.supabase.rpc("provider_get_dashboard");
 if(error)return {ok:false,reason:error.message||"backend_unavailable"};
 const p=data?.provider||{},a=data?.service_area||null,products=data?.products||[],metrics=data?.metrics||{};
 provider.backendProviderId=p.id||provider.backendProviderId;
 provider.providerName=p.display_name||"";
 provider.ownerName=p.owner_name||"";
 provider.phone=p.phone||"";
 provider.type=p.primary_milk_type||"cow";
 provider.area=p.area_name||"";
 provider.city=p.city||"";
 provider.pin=p.pin_code||"";
 provider.radius=String(p.service_radius_km??5);
 provider.from=p.delivery_from||"06:00";
 provider.to=p.delivery_to||"09:00";
 provider.maxOpenOrders=String(p.max_open_orders??25);
 provider.maxDailyLitres=String(p.max_daily_litres??250);
 provider.acceptanceTimeoutMinutes=String(p.acceptance_timeout_minutes??10);
 provider.acceptingOrders=p.accepting_orders!==false;
 provider.verificationStatus=data?.verification_status||"pending";
 if(a?.latitude!=null&&a?.longitude!=null){provider.latitude=Number(a.latitude);provider.longitude=Number(a.longitude)}
 provider.products=products.map(m=>({
   id:m.id,name:m.name,price:Number(m.price_per_litre||0),type:m.milk_type||provider.type,
   stock:Boolean(m.stock),days:Boolean(m.daily_available),unit:m.unit_label||"1 L",isActive:m.is_active!==false
 }));
 provider.metrics=metrics;
 save();
 renderStoreStatus();
 return {ok:true};
}
async function syncProviderBackend(){
 if(!window.Doodhwala?.configured)return {ok:false,reason:"not_configured"};
 const {data:userData}=await Doodhwala.supabase.auth.getUser();const user=userData?.user;
 if(!user)return {ok:false,reason:"not_signed_in"};
 const payload={display_name:provider.providerName||"Local milk provider",owner_name:provider.ownerName||"Provider",phone:provider.phone||"",primary_milk_type:provider.type||"mixed",area_name:provider.area||"Local area",city:provider.city||"Ahmedabad",pin_code:provider.pin||"000000",service_radius_km:Number(provider.radius||5),delivery_from:provider.from||null,delivery_to:provider.to||null,max_open_orders:Number(provider.maxOpenOrders||25),max_daily_litres:Number(provider.maxDailyLitres||250),acceptance_timeout_minutes:Number(provider.acceptanceTimeoutMinutes||10)};
 if(!/^\d{6}$/.test(payload.pin_code)){return {ok:false,reason:"invalid_pin"}}
 const up=await Doodhwala.supabase.rpc("provider_upsert_own_profile",{p_display_name:payload.display_name,p_owner_name:payload.owner_name,p_phone:payload.phone,p_primary_milk_type:payload.primary_milk_type,p_area_name:payload.area_name,p_city:payload.city,p_pin_code:payload.pin_code,p_service_radius_km:payload.service_radius_km,p_delivery_from:payload.delivery_from,p_delivery_to:payload.delivery_to,p_max_open_orders:payload.max_open_orders,p_max_daily_litres:payload.max_daily_litres,p_acceptance_timeout_minutes:payload.acceptance_timeout_minutes});
 if(up.error)throw up.error;
 provider.backendProviderId=up.data.id;
 let coords=provider.latitude&&provider.longitude?{latitude:provider.latitude,longitude:provider.longitude}:await getCurrentLocation();
 if(coords){provider.latitude=coords.latitude;provider.longitude=coords.longitude;const area=await Doodhwala.supabase.from("provider_service_areas").upsert({provider_id:provider.backendProviderId,label:provider.area||"Local route",latitude:coords.latitude,longitude:coords.longitude,service_radius_km:Number(provider.radius||5)},{onConflict:"provider_id"});if(area.error)throw area.error}
 for(const p of provider.products){const row={id:p.id,provider_id:provider.backendProviderId,name:p.name,milk_type:p.type||provider.type||"mixed",price_per_litre:Number(p.price||0),unit_label:p.unit||"1 L",stock:Boolean(p.stock),daily_available:Boolean(p.days),is_active:p.isActive!==false};const result=await Doodhwala.supabase.from("milk_products").upsert(row,{onConflict:"id"});if(result.error)throw result.error}
 save();
 return {ok:true,hasLocation:Boolean(coords)};
}
async function syncDeleteProduct(id){
 if(!window.Doodhwala?.configured||!provider.backendProviderId)return;
 const {data:userData}=await Doodhwala.supabase.auth.getUser();if(!userData?.user)return;
 await Doodhwala.supabase.from("milk_products").delete().eq("id",id).eq("provider_id",provider.backendProviderId);
}

const onboarding=$("onboarding"),dashboard=$("dashboard"),toastEl=$("toast");
function save(){if(window.DoodhwalaResilience)window.DoodhwalaResilience.writeStorage(STORAGE_KEY,provider);else try{localStorage.setItem(STORAGE_KEY,JSON.stringify(provider))}catch(_){}}
function toast(message){toastEl.textContent=message;toastEl.classList.add("show");clearTimeout(window.__providerToast);window.__providerToast=setTimeout(()=>toastEl.classList.remove("show"),1800)}async function refreshStoreStatus(){
 if(!window.Doodhwala?.configured)return;
 try{
  const {data:userData}=await Doodhwala.supabase.auth.getUser();const user=userData?.user;if(!user)return;
  const {data,error}=await Doodhwala.supabase.rpc("provider_get_own_profile");
  if(error||!data)return;
  provider.backendProviderId=data.id;provider.acceptingOrders=data.accepting_orders!==false;save();renderStoreStatus();
 }catch(err){console.warn("Store status load failed",err)}
}
function renderStoreStatus(){
 const b=$("providerStoreToggle");if(!b)return;
 b.hidden=!provider.backendProviderId;
 const live=provider.acceptingOrders!==false;
 b.textContent=live?"● Store live":"Ⅱ Store paused";
 b.classList.toggle("paused",!live);
 b.setAttribute("aria-pressed",String(live));
 b.title=live?"Pause new customer orders":"Resume new customer orders";
}
async function toggleStoreStatus(){
 if(!window.Doodhwala?.configured||!provider.backendProviderId){toast("Sign in to control live order intake.");return}
 const next=provider.acceptingOrders===false;
 const b=$("providerStoreToggle");if(b){b.disabled=true;b.textContent=next?"Resuming…":"Pausing…"}
 try{
  const {data:userData}=await Doodhwala.supabase.auth.getUser();const user=userData?.user;if(!user)throw new Error("Please sign in again.");
  const {error}=await Doodhwala.supabase.rpc("provider_set_store_status",{p_provider_id:provider.backendProviderId,p_accepting_orders:next});
  if(error)throw error;
  provider.acceptingOrders=next;save();renderStoreStatus();toast(next?"Store is live — new orders enabled":"Store paused — no new orders will be accepted");
 }catch(err){toast(err.message||"Could not change store status");renderStoreStatus()}
 finally{if(b)b.disabled=false}
}

function initials(name){return(name||"P").trim().split(/\s+/).map(x=>x[0]).slice(0,2).join("").toUpperCase()}
function setStep(step){currentStep=step;document.querySelectorAll(".onboard-step").forEach(s=>s.classList.toggle("active",Number(s.dataset.step)===step));document.querySelectorAll("[data-step-indicator]").forEach(s=>s.classList.toggle("active",Number(s.dataset.stepIndicator)<=step))}
function requiredForStep(step){
 if(step===1&&!($("providerName").value.trim()&&$("ownerName").value.trim()&&/^\d{10}$/.test($("phone").value.replace(/\D/g,""))&&$("providerType").value)){toast("Complete all provider details first");return false}
 if(step===2&&(!$("baseArea").value.trim()||! /^\d{6}$/.test($("pincode").value.trim()))){toast("Enter a locality and valid 6-digit PIN");return false}
 return true
}
function readOnboarding(){provider.providerName=$("providerName").value.trim();provider.ownerName=$("ownerName").value.trim();provider.phone=$("phone").value.replace(/\D/g,"");provider.type=$("providerType").value;provider.area=$("baseArea").value.trim();provider.city=$("city").value.trim();provider.pin=$("pincode").value.trim();provider.radius=$("radius").value;provider.from=$("fromTime").value;provider.to=$("toTime").value}
document.querySelectorAll(".next-step").forEach(btn=>btn.onclick=()=>{if(!requiredForStep(currentStep))return;readOnboarding();setStep(Number(btn.dataset.next))});
document.querySelectorAll("[data-back]").forEach(btn=>btn.onclick=()=>setStep(Number(btn.dataset.back)));
$("finishOnboarding").onclick=()=>{
 readOnboarding();const name=$("firstMilkName").value.trim()||"Fresh milk",price=Number($("firstMilkPrice").value);
 if(!price||price<=0){toast("Enter a valid milk price");return}
 provider.products=[{id:newUuid(),name,price,stock:$("firstMilkStock").value==="in",days:$("firstMilkDays").value==="yes",type:provider.type,unit:"1 L"}];
 save();onboarding.classList.add("hidden");dashboard.classList.remove("hidden");hydrateDashboard();syncProviderBackend().then(function(result){if(result.ok){$("providerMode").textContent=result.hasLocation?"CONNECTED • PENDING VERIFICATION":"CONNECTED • ADD LOCATION";$("providerAuthLink").textContent="Account";$("providerAuthLink").href="/Doodhwala/provider/";toast(result.hasLocation?"Provider saved — pending verification":"Provider saved; location still needed")}else if(result.reason==="not_signed_in"){toast("Demo saved. Sign in to publish your provider")}}).catch(function(err){console.error(err);toast("Provider saved locally; backend sync failed")})
};
function profilePercent(){const fields=[provider.providerName,provider.ownerName,provider.phone,provider.type,provider.area,provider.city,provider.pin,provider.radius,provider.from,provider.to];return Math.round(fields.filter(Boolean).length/fields.length*100)}
async function loadProviderUpiSettings(){if(!window.Doodhwala?.configured)return;const {data:userData}=await Doodhwala.supabase.auth.getUser();if(!userData?.user)return;const {data,error}=await Doodhwala.supabase.rpc("provider_get_direct_upi_settings");if(error){const s=$("providerUpiState");if(s)s.textContent="Could not load saved UPI settings.";return}if(!data)return;$("providerUpiId").value=data.upi_id||"";$("providerUpiPayee").value=data.payee_name||"";$("providerUpiEnabled").checked=data.enabled===true;$("providerUpiState").textContent=data.enabled?"Direct UPI is enabled. Customers will be told that you manually verify receipt.":"UPI details saved but direct UPI is disabled."}
$("saveProviderUpi")?.addEventListener("click",async function(){const button=$("saveProviderUpi"),state=$("providerUpiState"),upiId=$("providerUpiId").value.trim(),payee=$("providerUpiPayee").value.trim(),enabled=$("providerUpiEnabled").checked;if(!upiId||!payee){state.textContent="Enter the UPI ID and exact payee name from your bank/UPI app.";return}button.disabled=true;button.textContent="Saving…";state.textContent="Saving securely…";try{const {error}=await Doodhwala.supabase.rpc("provider_save_direct_upi",{p_upi_id:upiId,p_payee_name:payee,p_enabled:enabled});if(error)throw error;state.textContent=enabled?"UPI details saved and enabled. Verify the displayed payee name before accepting payments.":"UPI details saved; direct UPI remains disabled.";toast("Direct UPI settings saved")}catch(error){state.textContent=String(error?.message||"Could not save UPI details.")}finally{button.disabled=false;button.textContent="Save UPI details"}});

function hydrateDashboard(){
 loadProviderUpiSettings().catch(function(err){console.warn("Seller UPI settings unavailable",err)});
 $("profileAvatar").textContent=initials(provider.ownerName||provider.providerName);$("sideProviderName").textContent=provider.providerName||"Provider";$("sideProviderArea").textContent=(provider.area||"Local seller")+" · "+(provider.city||"Ahmedabad");$("topProviderName").textContent=provider.providerName||"Provider dashboard";
 $("kpiProducts").textContent=provider.products.length;$("kpiActive").textContent=provider.products.filter(p=>p.stock).length;$("kpiRadius").textContent=(provider.radius||0)+" km";
 const m=provider.metrics||{};$("kpiOpenOrders").textContent=Number(m.open_orders||0);$("kpiSalesToday").textContent=orderMoney(m.sales_today||0);const pct=profilePercent();$("kpiProfile").textContent=pct+"%";$("profileProgress").textContent=pct+"%";$("readinessTime").textContent=(provider.from||"06:00")+" – "+(provider.to||"09:00");$("readinessArea").textContent=provider.area?provider.area+", "+provider.city:"Not set";$("readinessAvailability").textContent=provider.products.filter(p=>p.stock).length+" of "+provider.products.length+" active";$("readinessCapacity").textContent=(provider.maxDailyLitres||250)+" L/day · "+(provider.maxOpenOrders||25)+" open orders";
 renderChecklist();renderProducts();fillService();fillProfile();if(window.Doodhwala?.configured)loadProviderRoute(routeDate).catch(function(err){console.error(err)})
}
function renderChecklist(){
 const items=[["Provider identity",Boolean(provider.providerName&&provider.ownerName&&provider.phone),"Edit profile","profile"],["Delivery locality",Boolean(provider.area&&provider.city&&provider.pin),"Edit area","service"],["First milk product",provider.products.length>0,"Manage catalogue","products"],["Availability",provider.products.some(p=>p.stock),"Set stock","products"]];
 $("checklist").innerHTML=items.map((x,i)=>'<button class="check-row '+(x[1]?"done":"")+'" data-check-view="'+x[3]+'"><span>'+(x[1]?"✓":i+1)+'</span><div><b>'+x[0]+'</b><small>'+(x[1]?"Complete":x[2])+'</small></div></button>').join("");
 $("checklist").querySelectorAll("[data-check-view]").forEach(b=>b.onclick=()=>showView(b.dataset.checkView))
}
function showView(view){document.querySelectorAll(".provider-view").forEach(v=>v.classList.toggle("active",v.id==="view-"+view));document.querySelectorAll("[data-view]").forEach(b=>{const active=b.dataset.view===view;b.classList.toggle("active",active);if(b.closest(".provider-mobile-nav")){if(active)b.setAttribute("aria-current","page");else b.removeAttribute("aria-current")}});if(view==="orders")loadProviderOrders();if(view==="route")loadProviderRoute(routeDate);if(view==="subscriptions")loadProviderSubscriptions();if(view==="billing")window.loadProviderBilling?.()}
async function setupProviderSubscriptionRealtime(user){
 if(!window.Doodhwala?.configured||!user||window.__doodhwalaProviderSubscriptionChannel)return;
 const refresh=function(){
  clearTimeout(window.__providerSubscriptionRealtimeRefresh);
  window.__providerSubscriptionRealtimeRefresh=setTimeout(function(){
   if(document.visibilityState!=="hidden")loadProviderSubscriptions().catch(function(err){console.warn("Subscription refresh failed",err)});
  },350);
 };
 const channel=Doodhwala.supabase.channel("provider-subscriptions-"+user.id)
  .on("postgres_changes",{event:"*",schema:"public",table:"milk_subscriptions"},refresh)
  .on("postgres_changes",{event:"*",schema:"public",table:"subscription_deliveries"},refresh);
 window.__doodhwalaProviderSubscriptionChannel=channel;
 channel.subscribe(function(status){
  if(status==="SUBSCRIBED"){window.__providerSubscriptionReconnectAttempt=0;return}
  if(!["CHANNEL_ERROR","TIMED_OUT","CLOSED"].includes(status))return;
  const attempt=Math.min(6,Number(window.__providerSubscriptionReconnectAttempt||0)+1);
  window.__providerSubscriptionReconnectAttempt=attempt;
  clearTimeout(window.__providerSubscriptionReconnectTimer);
  const delay=Math.min(30000,1000*Math.pow(2,attempt-1));
  window.__providerSubscriptionReconnectTimer=setTimeout(function(){
   const stale=window.__doodhwalaProviderSubscriptionChannel;
   window.__doodhwalaProviderSubscriptionChannel=null;
   try{if(stale)Doodhwala.supabase.removeChannel(stale)}catch(_){}
   setupProviderSubscriptionRealtime(user);
   if(document.visibilityState!=="hidden")loadProviderSubscriptions().catch(function(err){console.warn("Subscription reconnect refresh failed",err)});
  },delay);
 });
}
async function loadProviderSubscriptions(){
 const state=$("providerSubscriptionState"),list=$("providerSubscriptions");if(!state||!list)return;
 if(!window.Doodhwala?.configured){state.textContent="Supabase is not configured.";list.innerHTML="";return}
 const {data:userData}=await Doodhwala.supabase.auth.getUser(),user=userData?.user;
 if(!user){state.textContent="Sign in to view recurring customers.";list.innerHTML="";return}
 await setupProviderSubscriptionRealtime(user);
 const {data,error}=await Doodhwala.supabase.rpc("provider_get_subscriptions",{p_limit:100});
 if(error){state.textContent=error.message;list.innerHTML="";return}
 const rows=data||[];
 const active=rows.filter(s=>s.status==="active").length;
 const paused=rows.filter(s=>s.status==="paused").length;
 const litres=rows.filter(s=>s.status==="active").reduce((sum,s)=>sum+Number(s.quantity_litres||0),0);
 state.textContent=rows.length?rows.length+" subscription"+(rows.length===1?"":"s")+" · "+active+" active · "+litres.toLocaleString("en-IN",{maximumFractionDigits:2})+" L per scheduled delivery":"No recurring subscriptions yet";
 if(!rows.length){list.innerHTML='<div class="order-empty"><b>No recurring customers yet.</b><span>When customers start milk plans with your provider, their schedules will appear here automatically.</span></div>';return}
 list.innerHTML=rows.map(function(s){
  const days=Array.isArray(s.days_of_week)?s.days_of_week.join(", "):"—";
  return '<article class="provider-subscription"><div class="provider-sub-head"><div><b>'+escapeHtml(s.customer_name||"Customer")+'</b><span>'+escapeHtml(s.customer_phone||"")+'</span></div><span class="order-status '+escapeHtml(s.status)+'">'+escapeHtml(String(s.status||"").replace("_"," "))+'</span></div><div class="provider-sub-grid"><div><small>Milk</small><b>'+escapeHtml(s.product_name||"Milk")+'</b></div><div><small>Quantity</small><b>'+Number(s.quantity_litres||0)+' L</b></div><div><small>Price</small><b>'+orderMoney(s.price_per_litre)+'/L</b></div><div><small>Delivery time</small><b>'+escapeHtml(String(s.delivery_time||"—"))+'</b></div></div><div class="provider-sub-meta"><span>Days: '+escapeHtml(days)+'</span><span>'+dateText(s.start_date)+' → '+dateText(s.end_date)+'</span><span>'+Number(s.pending_deliveries||0)+' pending deliveries</span></div></article>'
 }).join("");
}
document.querySelectorAll("[data-view]").forEach(btn=>btn.onclick=()=>showView(btn.dataset.view));
document.querySelectorAll("[data-view-jump]").forEach(btn=>btn.onclick=()=>showView(btn.dataset.viewJump));
async function persistProductToBackend(product){
  if(!window.Doodhwala?.configured||!provider.backendProviderId)return {ok:false,reason:"not_connected"};
  const {data,error}=await Doodhwala.supabase.rpc("provider_upsert_product",{
    p_provider_id:provider.backendProviderId,p_product_id:product.id||null,p_name:product.name,
    p_milk_type:product.type||provider.type||"mixed",p_price_per_litre:Number(product.price||0),
    p_unit_label:product.unit||"1 L",p_stock:Boolean(product.stock),p_daily_available:Boolean(product.days),
    p_is_active:product.isActive!==false
  });
  if(error)throw error;
  return {ok:true,data};
}
async function refreshProviderProducts(){
 if(!window.Doodhwala?.configured||!provider.backendProviderId)return false;
 const {data,error}=await Doodhwala.supabase.from("milk_products").select("id,name,milk_type,price_per_litre,unit_label,stock,daily_available,is_active").eq("provider_id",provider.backendProviderId).order("created_at",{ascending:false});
 if(error)throw error;
 provider.products=(data||[]).map(m=>({id:m.id,name:m.name,price:Number(m.price_per_litre||0),type:m.milk_type,stock:Boolean(m.stock),days:Boolean(m.daily_available),unit:m.unit_label||"1 L",isActive:m.is_active!==false}));
 save();renderProducts();return true;
}
async function removeProductFromBackend(id){
 if(!window.Doodhwala?.configured||!provider.backendProviderId)return {ok:false,reason:"not_connected"};
 const {data,error}=await Doodhwala.supabase.rpc("provider_delete_product",{p_product_id:id});
 if(error)throw error;return {ok:true,data};
}
function providerMilkIcon(type){
 const label=type==="cow"?"COW":type==="buffalo"?"BUFFALO":type==="a2"?"A2":"FRESH";
 const size=label==="BUFFALO"?5.3:6.7;
 return `<svg class="milk-type-art" viewBox="0 0 64 66" role="img" aria-label="${label.toLowerCase()} milk"><rect x="4" y="4" width="56" height="58" rx="16" fill="#f7fbf7" stroke="#d8e7db"/><path d="M26 12h12v7l5 7v24c0 3-2 5-5 5H26c-3 0-5-2-5-5V26l5-7Z" fill="#fff" stroke="#17603f" stroke-width="1.7" stroke-linejoin="round"/><path d="M26 19h12M23 29h18" fill="none" stroke="#17603f" stroke-width="1.7" stroke-linecap="round"/><path d="M32 32c-3 4-5 7-5 10a5 5 0 0 0 10 0c0-3-2-6-5-10Z" fill="#17603f"/><text x="32" y="59" text-anchor="middle" fill="#3a5b46" font-size="${size}" font-weight="800" font-family="Arial,sans-serif" letter-spacing=".5">${label}</text></svg>`;
}
function renderProducts(){
 const term=($("productSearch")?.value||"").toLowerCase().trim(),stockFilter=$("stockFilter")?.value||"all";
 const list=provider.products.filter(p=>(!term||p.name.toLowerCase().includes(term))&&(stockFilter==="all"||(stockFilter==="in"&&p.stock)||(stockFilter==="out"&&!p.stock)));
 if(!list.length){$("productTable").innerHTML='<div class="empty-provider-state"><div class="provider-empty-icon">'+providerMilkIcon("mixed")+'</div><h3>No products match</h3><p>Add a milk product or change your filters.</p><button class="secondary" id="emptyAdd">+ Add milk</button></div>';$("emptyAdd")?.addEventListener("click",openProductEditor);return}
 $("productTable").innerHTML=list.map(function(p){return '<article class="product-row"><div class="product-thumb">'+providerMilkIcon(p.type)+'</div><div><strong>'+escapeHtml(p.name)+'</strong><small>'+escapeHtml(p.unit||"1 L")+' · '+(p.days?"Daily availability":"Flexible availability")+'</small></div><div class="price desktop-only"><strong>₹'+p.price+'</strong><small>per litre</small></div><div class="availability desktop-only"><span class="stock '+(p.stock?"in":"out")+'">'+(p.stock?"In stock":"Unavailable")+'</span></div><div><span class="stock '+(p.stock?"in":"out")+'">'+(p.stock?"Live":"Off")+'</span></div><div class="row-actions"><button data-edit="'+p.id+'">Edit</button><button data-toggle="'+p.id+'">'+(p.stock?"Pause":"Activate")+'</button><button class="danger" data-delete="'+p.id+'">Delete</button></div></article>'}).join("");
 $("productTable").querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>openProductEditor(b.dataset.edit));$("productTable").querySelectorAll("[data-toggle]").forEach(b=>b.onclick=()=>toggleProduct(b.dataset.toggle));$("productTable").querySelectorAll("[data-delete]").forEach(b=>b.onclick=()=>deleteProduct(b.dataset.delete))
}
function escapeHtml(str){return String(str).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function openProductEditor(id){
 const existing=id?provider.products.find(p=>p.id===id):null,modal=document.createElement("div");modal.className="product-modal";
 modal.innerHTML='<div class="product-modal-card"><div class="modal-top"><div><span class="eyebrow">'+(existing?"EDIT PRODUCT":"NEW PRODUCT")+'</span><h2>'+(existing?"Update milk details":"Add a milk product")+'</h2></div><button data-close>×</button></div><div class="form-grid"><label>Milk name<input id="mName" value="'+escapeHtml(existing?.name||"")+'" placeholder="Fresh cow milk"></label><label>Price per litre<input id="mPrice" inputmode="decimal" value="'+(existing?.price||"")+'" placeholder="68"></label><label>Milk type<select id="mType"><option value="cow">Cow milk</option><option value="buffalo">Buffalo milk</option><option value="a2">A2 milk</option><option value="mixed">Mixed</option></select></label><label>Availability<select id="mStock"><option value="true">In stock</option><option value="false">Unavailable</option></select></label></div><div class="modal-option-row"><label><input id="mDays" type="checkbox" '+(existing?.days!==false?"checked":"")+'> Available every day</label></div><div class="modal-actions"><button class="secondary" data-close>Cancel</button><button class="provider-primary" id="saveProductModal">'+(existing?"Save changes":"Add product")+' →</button></div></div>';
 document.body.append(modal);
 if(existing){$("mType").value=existing.type||"cow";$("mStock").value=String(existing.stock)}
 const close=()=>modal.remove();modal.querySelectorAll("[data-close]").forEach(x=>x.onclick=close);
 $("saveProductModal").onclick=async()=>{
  const name=$("mName").value.trim(),price=Number($("mPrice").value);
  if(!name||!price||price<=0){toast("Enter a product name and valid price");return}
  const product={id:existing?.id||newUuid(),name,price,type:$("#mType").value,stock:$("#mStock").value==="true",days:$("#mDays").checked,unit:"1 L",isActive:existing?existing.isActive!==false:true};;
  const button=$("saveProductModal");button.disabled=true;
  try{
    if(provider.backendProviderId){
      await persistProductToBackend(product);
      await refreshProviderProducts();
      toast(existing?"Product updated":"Milk added to catalogue");
    }else{
      if(existing)Object.assign(existing,product);else provider.products.push(product);
      save();renderProducts();hydrateDashboard();toast("Saved locally. Sign in to publish this product.");
    }
    close();
  }catch(error){toast(error.message||"Unable to save product.");button.disabled=false;}
 };
}
async function toggleProduct(id){
 const p=provider.products.find(x=>x.id===id);if(!p)return;
 if(provider.backendProviderId){
  p.stock=!p.stock;
  try{await persistProductToBackend(p);await refreshProviderProducts();toast(p.stock?"Product activated":"Product paused");}
  catch(error){p.stock=!p.stock;save();toast(error.message||"Unable to update product.")}
 }else{p.stock=!p.stock;save();renderProducts();hydrateDashboard();toast(p.stock?"Product activated":"Product paused");}
}
async function deleteProduct(id){
 const p=provider.products.find(x=>x.id===id);if(!p)return;if(!confirm("Delete "+p.name+" from your catalogue?"))return;
 try{
  if(provider.backendProviderId){await removeProductFromBackend(id);await refreshProviderProducts();}
  else{provider.products=provider.products.filter(x=>x.id!==id);save();renderProducts();hydrateDashboard();}
  toast("Product deleted");
 }catch(error){toast(error.message||"Unable to delete product.")}
}
$("addProduct").onclick=()=>openProductEditor();$("productSearch").oninput=renderProducts;$("stockFilter").onchange=renderProducts;

function fillService(){$("dashBaseArea").value=provider.area||"";$("dashCity").value=provider.city||"";$("dashPin").value=provider.pin||"";$("dashRadius").value=provider.radius||"5";$("dashFrom").value=provider.from||"06:00";$("dashTo").value=provider.to||"09:00";$("maxDailyLitres").value=provider.maxDailyLitres||"250";$("maxOpenOrders").value=provider.maxOpenOrders||"25";$("acceptanceTimeout").value=provider.acceptanceTimeoutMinutes||"10";$("mapSummary").textContent=(provider.area||"Locality")+", "+(provider.radius||"5")+" km radius";window.dispatchEvent(new Event("doodhwala:provider-service-updated"))}
$("saveService").onclick=()=>{if(!$("dashBaseArea").value.trim()||!/^\d{6}$/.test($("dashPin").value.trim())){toast("Enter locality and valid 6-digit PIN");return}provider.area=$("dashBaseArea").value.trim();provider.city=$("dashCity").value.trim()||"Ahmedabad";provider.pin=$("dashPin").value.trim();provider.radius=$("dashRadius").value;provider.from=$("dashFrom").value;provider.to=$("dashTo").value;save();hydrateDashboard();syncProviderBackend().then(function(r){toast(r.ok?(r.hasLocation?"Delivery area saved":"Area saved; location permission needed"):"Saved locally")}).catch(function(err){console.error(err);toast("Area saved locally; backend sync failed")})};
function fillProfile(){$("dashProviderName").value=provider.providerName||"";$("dashOwnerName").value=provider.ownerName||"";$("dashPhone").value=provider.phone||"";$("dashType").value=provider.type||"cow";const v=provider.verificationStatus||"pending";$("trustProfile").textContent=profilePercent()===100?"Complete":"Pending";$("providerVerificationStatus").textContent=v==="approved"?"Approved":v==="rejected"?"Rejected":"Pending review"}
$("saveProfile").onclick=()=>{const name=$("dashProviderName").value.trim(),owner=$("dashOwnerName").value.trim(),phone=$("dashPhone").value.replace(/\D/g,"");if(!name||!owner||!/^\d{10}$/.test(phone)){toast("Enter provider name, owner and valid mobile");return}provider.providerName=name;provider.ownerName=owner;provider.phone=phone;provider.type=$("dashType").value;save();hydrateDashboard();syncProviderBackend().then(function(r){$("providerMode").textContent=r.ok?(r.hasLocation?"CONNECTED • PENDING VERIFICATION":"CONNECTED • ADD LOCATION"):("LOCAL DEMO");toast(r.ok?"Provider profile saved":"Provider profile saved locally")}).catch(function(err){console.error(err);toast("Profile saved locally; backend sync failed")})};

function orderStatusLabel(status){const labels={placed:"New order",accepted:"Accepted",preparing:"Packing",ready:"Ready",out_for_delivery:"Out for delivery",delivered:"Delivered",rejected:"Declined",cancelled:"Cancelled"};return labels[status]||String(status||"placed").replace(/_/g," ")}
function orderMoney(value){return "₹"+Number(value||0).toLocaleString("en-IN",{maximumFractionDigits:2})}
function orderTime(value){try{return new Intl.DateTimeFormat("en-IN",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value))}catch(e){return value||""}}
function localIsoDate(d=new Date()){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");return y+"-"+m+"-"+day}
function addIsoDate(s,n){const d=new Date(s+"T00:00:00");d.setDate(d.getDate()+n);return localIsoDate(d)}
function routeDateText(s){if(s===localIsoDate())return "Today";try{return new Intl.DateTimeFormat("en-IN",{weekday:"long",day:"numeric",month:"short",year:"numeric"}).format(new Date(s+"T00:00:00"))}catch(e){return s}}
function routeClock(v){try{return new Intl.DateTimeFormat("en-IN",{timeZone:"Asia/Kolkata",hour:"numeric",minute:"2-digit"}).format(new Date(v))}catch(e){return String(v||"").slice(11,16)}}
function routeDeliveryLabel(d){if(d.delivery_status==="delivered"||d.order_status==="delivered")return["Delivered","done"];if(d.delivery_status==="materialized"&&d.order_status)return[orderStatusLabel(d.order_status),"live"];if(d.delivery_status==="materialized")return["Order created","live"];return["Scheduled","warn"]}
function routeSummary(rows){const active=rows.filter(r=>r.delivery_status==="scheduled"||r.delivery_status==="materialized"||r.delivery_status==="delivered");const litres=active.reduce((sum,r)=>sum+Number(r.quantity_litres||0),0);const customers=new Set(active.map(r=>r.customer_id)).size;const orders=active.filter(r=>r.order_id).length;return {active,litres,customers,orders}}
let routeDate=localIsoDate();

function setupProviderRouteRealtime(user,providerId){
 if(!window.Doodhwala?.configured||!user||window.__doodhwalaProviderRouteChannel)return;
 const refresh=()=>{
   clearTimeout(window.__providerRouteRealtimeRefresh);
   window.__providerRouteRealtimeRefresh=setTimeout(function(){
     if(document.visibilityState!=="hidden")loadProviderRoute(routeDate).catch(function(err){console.warn("Provider route realtime refresh failed",err)});
   },350);
 };
 const channel=Doodhwala.supabase.channel("provider-route-"+user.id)
   .on("postgres_changes",{event:"*",schema:"public",table:"orders",filter:"provider_owner_id=eq."+user.id},refresh)
   .on("postgres_changes",{event:"*",schema:"public",table:"subscription_deliveries"},refresh);
 if(providerId){
   channel.on("postgres_changes",{event:"*",schema:"public",table:"milk_subscriptions",filter:"provider_id=eq."+providerId},refresh);
 }
 window.__doodhwalaProviderRouteChannel=channel;
 channel.subscribe(function(status){
   if(status==="SUBSCRIBED"){
     window.__providerRouteReconnectAttempt=0;
     return;
   }
   if(!["CHANNEL_ERROR","TIMED_OUT","CLOSED"].includes(status))return;
   const attempt=Math.min(6,Number(window.__providerRouteReconnectAttempt||0)+1);
   window.__providerRouteReconnectAttempt=attempt;
   clearTimeout(window.__providerRouteReconnectTimer);
   const delay=Math.min(30000,1000*Math.pow(2,attempt-1));
   window.__providerRouteReconnectTimer=setTimeout(function(){
     const stale=window.__doodhwalaProviderRouteChannel;
     window.__doodhwalaProviderRouteChannel=null;
     try{ if(stale)Doodhwala.supabase.removeChannel(stale); }catch(_){}
     setupProviderRouteRealtime(user,providerId);
     loadProviderRoute(routeDate).catch(function(err){console.warn("Provider route reconnect refresh failed",err)});
   },delay);
 });
}

async function loadProviderDispatchBoard(dateValue=routeDate){
 const state=$("dispatchSummary"),list=$("dispatchList");if(!state||!list)return;
 if(!window.Doodhwala?.configured){state.textContent="Dispatch backend unavailable.";list.innerHTML="";return}
 const r=await Doodhwala.supabase.rpc("get_provider_dispatch_board",{p_delivery_date:dateValue||localIsoDate()});
 if(r.error){state.textContent=r.error.message;list.innerHTML="";return}
 const rows=r.data||[],active=rows.filter(x=>["placed","accepted","preparing","ready","out_for_delivery"].includes(x.status));
 const late=active.filter(x=>x.late_after_at&&Date.now()>new Date(x.late_after_at).getTime()).length;
 const litres=active.reduce((s,x)=>s+Number(x.litres||0),0);
 state.textContent=active.length+" active stop"+(active.length===1?"":"s")+" · "+litres.toLocaleString("en-IN",{maximumFractionDigits:2})+" L"+(late?" · "+late+" late":"");
 if(!active.length){list.innerHTML='<div class="dispatch-empty"><b>No active deliveries for '+escapeHtml(routeDateText(dateValue||localIsoDate()).toLowerCase())+'.</b><span>Orders appear here as customers place them and providers accept them.</span></div>';return}
 list.innerHTML=active.map(function(o,idx){
   const lateNow=o.late_after_at&&Date.now()>new Date(o.late_after_at).getTime();
   const promiseLabel=o.estimated_delivery_min_minutes&&o.estimated_delivery_max_minutes?o.estimated_delivery_min_minutes+"–"+o.estimated_delivery_max_minutes+" min":"Awaiting ETA";
   return '<article class="dispatch-item '+(lateNow?'late':'')+'"><div class="dispatch-rank">'+String(idx+1).padStart(2,"0")+'</div><div class="dispatch-main"><div class="dispatch-top"><b>'+escapeHtml(o.customer_name||"Customer")+'</b><span class="order-status '+escapeHtml(o.status)+'">'+escapeHtml(orderStatusLabel(o.status))+'</span></div><div class="dispatch-location">'+escapeHtml([o.area_name,o.city,o.pin_code].filter(Boolean).join(", ")||o.address_line||"Address unavailable")+'</div><div class="dispatch-meta"><span>'+escapeHtml(Number(o.litres||0).toLocaleString("en-IN",{maximumFractionDigits:2}))+' L</span><span>'+escapeHtml(o.is_subscription?"Recurring":"One-time")+'</span>'+(o.distance_km!=null?'<span>'+escapeHtml(Number(o.distance_km).toFixed(1))+' km</span>':"")+'<span>'+escapeHtml(promiseLabel)+'</span>'+(lateNow?'<strong>Late</strong>':"")+'</div></div><div class="dispatch-contact">'+(o.customer_phone?'<a href="tel:'+encodeURIComponent(o.customer_phone)+'">☎</a>':"")+'</div></article>'
 }).join("");
}
async function loadProviderRoute(dateValue=routeDate){
 const state=$("routeSummary"),list=$("routeList"),kpis=$("routeKpis"),dateEl=$("routeDate");if(!state||!list)return;
 routeDate=dateValue||localIsoDate();if(dateEl)dateEl.textContent=routeDateText(routeDate);
 if(!window.Doodhwala?.configured){state.textContent="Connect Supabase to load the live route.";kpis.innerHTML="";list.innerHTML='<div class="route-empty"><b>Route data is not connected.</b><p>Sign in and publish the provider profile to see recurring deliveries here.</p></div>';return}
 const auth=await Doodhwala.supabase.auth.getUser(),user=auth.data?.user;if(!user){state.textContent="Sign in to manage the live route.";kpis.innerHTML="";list.innerHTML='<div class="route-empty"><b>Provider account required.</b><p>Sign in to load your recurring customer route.</p></div>';return}
 let routeProviderId=provider.backendProviderId||null;
 if(!routeProviderId){
   const profile=await Doodhwala.supabase.rpc("provider_get_own_profile");
   if(!profile.error&&profile.data?.id){routeProviderId=profile.data.id;provider.backendProviderId=routeProviderId;save()}
 }
 setupProviderRouteRealtime(user,routeProviderId);
 const r=await Doodhwala.supabase.rpc("get_provider_delivery_route",{p_delivery_date:routeDate});if(r.error){state.textContent=r.error.message;kpis.innerHTML="";list.innerHTML="";return}
 const rows=r.data||[],s=routeSummary(rows);state.textContent=s.active.length?(s.active.length+" recurring delivery"+(s.active.length===1?"":" deliveries")+" scheduled"):"No recurring deliveries scheduled";
 kpis.innerHTML='<div class="route-kpi"><small>CUSTOMERS</small><b>'+s.customers+'</b></div><div class="route-kpi"><small>TOTAL LITRES</small><b>'+Number(s.litres).toLocaleString("en-IN",{maximumFractionDigits:2})+' L</b></div><div class="route-kpi"><small>DELIVERIES</small><b>'+s.active.length+'</b></div><div class="route-kpi"><small>ORDERS CREATED</small><b>'+s.orders+'</b></div>';
 loadProviderDispatchBoard(routeDate).catch(function(err){console.warn("Dispatch board failed",err)});
 if(!s.active.length){list.innerHTML='<div class="route-empty"><b>No recurring milk run for '+routeDateText(routeDate).toLowerCase()+'.</b><p>When customers have an active daily plan for this date, each stop will appear here automatically.</p></div>';return}
 list.innerHTML=s.active.map(function(d){const status=routeDeliveryLabel(d);const location=[d.area_name,d.city,d.pin_code].filter(Boolean).join(", ");return '<article class="route-item"><div class="route-time">'+escapeHtml(routeClock(d.scheduled_for))+'<small>DELIVERY SLOT</small></div><div class="route-customer"><b>'+escapeHtml(d.customer_name||"Customer")+'</b><span>'+escapeHtml(location||d.address_line||"Address unavailable")+'</span><div class="route-meta"><span class="route-chip">'+escapeHtml(d.product_name||"Milk")+'</span><span class="route-chip">'+escapeHtml(d.address_line||"Address")+'</span><span class="route-chip '+status[1]+'">'+escapeHtml(status[0])+'</span></div>'+(d.customer_phone?'<a class="route-contact" href="tel:'+encodeURIComponent(d.customer_phone)+'">☎ '+escapeHtml(d.customer_phone)+'</a>':"")+'</div><div class="route-quantity"><b>'+Number(d.quantity_litres).toLocaleString("en-IN",{maximumFractionDigits:2})+' L</b><small>'+escapeHtml(d.milk_type||"Milk")+'</small></div></article>'}).join("");
}
$("refreshDispatch")?.addEventListener("click",function(){loadProviderDispatchBoard(routeDate)});
["routePrev","routeNext","routeToday"].forEach(function(id){$(id)?.addEventListener("click",function(){if(id==="routePrev")routeDate=addIsoDate(routeDate,-1);else if(id==="routeNext")routeDate=addIsoDate(routeDate,1);else routeDate=localIsoDate();loadProviderRoute(routeDate)})});

function countdownText(target){
 const ms=new Date(target).getTime()-Date.now();
 if(!Number.isFinite(ms))return "";
 const min=Math.max(0,Math.floor(ms/60000)),sec=Math.max(0,Math.floor((ms%60000)/1000));
 return min+"m "+String(sec).padStart(2,"0")+"s";
}
function orderDeadline(createdAt,timeoutMinutes){
 const t=new Date(createdAt).getTime()+Math.max(1,Number(timeoutMinutes||10))*60000;
 const left=t-Date.now();
 if(left<=0)return {label:"Response window expired",urgent:true,deadline:t};
 const seconds=Math.floor(left/1000),mins=Math.floor(seconds/60),secs=seconds%60;
 return {label:"Respond within "+mins+"m "+String(secs).padStart(2,"0")+"s",urgent:mins<2,deadline:t};
}
function refreshOrderDeadlines(){
 document.querySelectorAll("[data-order-deadline]").forEach(function(el){
   const d=orderDeadline(el.dataset.orderCreated,el.dataset.orderTimeout);
   el.textContent=d.label;
   el.classList.toggle("urgent",d.urgent);
 });
}
function orderProgressMarkup(status,reason){
 if(status==="rejected"||status==="cancelled"){
  const title=status==="rejected"?"Order declined":"Order cancelled";
  return '<div class="order-progress-terminal" role="status"><b>'+title+'</b>'+(reason?'<span>'+escapeHtml(reason)+'</span>':"")+'</div>';
 }
 const steps=[["placed","New"],["accepted","Accepted"],["preparing","Packing"],["ready","Ready"],["out_for_delivery","On route"],["delivered","Delivered"]];
 const current=steps.findIndex(function(step){return step[0]===status});
 return '<ol class="order-progress" aria-label="Order progress">'+steps.map(function(step,index){
  const state=index<current?"done":index===current?"current":"upcoming";
  return '<li class="order-progress-step '+state+'"'+(index===current?' aria-current="step"':"")+'><span class="order-progress-dot" aria-hidden="true">'+(index<current?"✓":String(index+1))+'</span><b>'+step[1]+'</b></li>';
 }).join("")+'</ol>';
}
function orderActions(order){
 if(order.payment_method==="selection_pending")return '<span class="payment-choice-pending">Waiting for customer payment choice…</span>';
 const actions=[],s=order.status;
 if(s==="placed")actions.push(["accepted","Accept order","primary-action"],["rejected","Decline order","danger-action"]);
 else if(s==="accepted")actions.push(["preparing","Start packing","primary-action"],["cancelled","Cancel order","danger-action"]);
 else if(s==="preparing")actions.push(["ready","Mark ready","primary-action"],["cancelled","Cancel order","danger-action"]);
 else if(s==="ready")actions.push(["out_for_delivery","Start delivery","primary-action"],["cancelled","Cancel order","danger-action"]);
 else if(s==="out_for_delivery")actions.push(["delivered","Mark delivered","primary-action"]);
 return actions.map(function(action){return '<button type="button" class="'+action[2]+'" data-order-status="'+action[0]+'" data-order-id="'+escapeHtml(order.id)+'" aria-label="'+action[1]+' for order '+escapeHtml(order.id)+'">'+action[1]+'</button>'}).join("");
}
function providerOrderStatusError(message){
 const value=String(message||"");
 if(value.includes("invalid_order_status_transition"))return "This order has already changed. Refresh to see its latest status.";
 if(value.includes("reason_required"))return "Please add a short reason before continuing.";
 if(value.includes("acceptance_window_expired"))return "The response time has passed. Refresh the queue to see the latest status.";
 if(value.includes("provider_not_approved"))return "Your seller profile still needs approval before orders can be managed.";
 if(value.includes("order_not_found"))return "This order is no longer available. Refresh the queue.";
 return "We couldn’t update this order. Refresh the queue and try again.";
}
let orderReasonReturnFocus=null;
function closeOrderReasonDialog(){
 const modal=document.querySelector(".order-reason-modal");
 if(!modal)return;
 modal.remove();
 document.removeEventListener("keydown",handleOrderReasonKeydown);
 const trigger=orderReasonReturnFocus;orderReasonReturnFocus=null;
 if(trigger&&trigger.isConnected)trigger.focus();
}
function handleOrderReasonKeydown(event){if(event.key==="Escape")closeOrderReasonDialog()}
function openOrderReasonDialog(button,status){
 closeOrderReasonDialog();
 const rejecting=status==="rejected",modal=document.createElement("div");
 orderReasonReturnFocus=button;
 modal.className="order-reason-modal";
 modal.innerHTML='<section class="order-reason-card" role="dialog" aria-modal="true" aria-labelledby="orderReasonTitle" aria-describedby="orderReasonDescription"><div class="order-reason-head"><div><span class="eyebrow">ORDER UPDATE</span><h2 id="orderReasonTitle">'+(rejecting?"Decline this order?":"Cancel this order?")+'</h2><p id="orderReasonDescription">'+(rejecting?"Tell the customer why you can’t accept this order.":"Explain why this accepted order needs to be cancelled.")+'</p></div><button type="button" class="order-reason-close" data-order-reason-close aria-label="Close dialog">×</button></div><label class="order-reason-label" for="orderReasonText">Reason for the customer <span>Required</span><textarea id="orderReasonText" maxlength="300" rows="4" placeholder="'+(rejecting?"For example, milk is unavailable today.":"For example, an unexpected delivery issue.")+'"></textarea></label><div class="order-reason-foot"><span>Keep it short and helpful.</span><span id="orderReasonLength">0 / 300</span></div><p id="orderReasonError" class="order-reason-error" role="alert"></p><div class="order-reason-actions"><button type="button" class="secondary" data-order-reason-close>Keep order</button><button type="button" id="submitOrderReason" class="danger-action">'+(rejecting?"Decline order":"Cancel order")+'</button></div></section>';
 document.body.append(modal);
 modal.querySelectorAll("[data-order-reason-close]").forEach(function(closeButton){closeButton.onclick=closeOrderReasonDialog});
 modal.addEventListener("click",function(event){if(event.target===modal)closeOrderReasonDialog()});
 document.addEventListener("keydown",handleOrderReasonKeydown);
 const field=modal.querySelector("#orderReasonText"),counter=modal.querySelector("#orderReasonLength"),error=modal.querySelector("#orderReasonError"),submit=modal.querySelector("#submitOrderReason");
 field.addEventListener("input",function(){counter.textContent=field.value.length+" / 300";error.textContent=""});
 field.focus();
 submit.onclick=async function(){
  const reason=field.value.trim().slice(0,300);
  if(!reason){error.textContent="Add a short reason so the customer knows what happened.";field.focus();return}
  submit.disabled=true;submit.textContent=rejecting?"Declining…":"Cancelling…";
  const ok=await submitProviderOrderStatus(button,status,reason,{modal:modal,submitButton:submit,errorElement:error});
  if(!ok&&document.body.contains(modal)){submit.disabled=false;submit.textContent=rejecting?"Decline order":"Cancel order"}
 };
}
async function submitProviderOrderStatus(button,status,reason,dialog){
 const card=button.closest(".provider-order");
 if(card)card.querySelectorAll("[data-order-status]").forEach(function(action){action.disabled=true});
 if(dialog?.submitButton)dialog.submitButton.disabled=true;
 let confirmed=false;
 try{
  const result=await Doodhwala.supabase.rpc("provider_update_order_status",{p_order_id:button.dataset.orderId,p_new_status:status,p_reason:reason||null});
  if(result.error){
   console.warn("Provider order status update rejected",result.error);
   const message=providerOrderStatusError(result.error.message);
   if(dialog?.errorElement)dialog.errorElement.textContent=message;else toast(message);
   try{await loadProviderOrders()}catch(refreshError){console.warn("Could not refresh provider orders after rejection",refreshError)}
   return false;
  }
  confirmed=true;
  if(dialog?.modal)closeOrderReasonDialog();
  const success=({accepted:"Order accepted",preparing:"Order moved to packing",ready:"Order ready for delivery",out_for_delivery:"Order marked out for delivery",delivered:"Order marked delivered",rejected:"Order declined",cancelled:"Order cancelled"})[status]||"Order updated";
  toast(success);
  try{await loadProviderOrders()}catch(refreshError){console.warn("Order updated but refresh failed",refreshError);toast("Order updated. Tap Refresh to reload the queue.")}
  return true;
 }catch(error){
  console.warn("Provider order status update failed",error);
  const message=confirmed?"Order updated. Tap Refresh to reload the queue.":"We couldn’t confirm this change. Refresh the queue before retrying.";
  if(dialog?.errorElement)dialog.errorElement.textContent=message;else toast(message);
  return false;
 }finally{
  if(card&&card.isConnected)card.querySelectorAll("[data-order-status]").forEach(function(action){action.disabled=false});
  if(dialog?.submitButton&&dialog.submitButton.isConnected)dialog.submitButton.disabled=false;
 }
}
function updateOrderFilterCounts(orders){
 const filter=$("orderFilter");if(!filter)return;
 const active=orders.filter(function(order){return ["placed","accepted","preparing","ready","out_for_delivery"].includes(order.status)}).length;
 const counts={all:orders.length,action:orders.filter(function(order){return order.status==="placed"}).length,active:active,completed:orders.filter(function(order){return ["delivered","rejected","cancelled"].includes(order.status)}).length};
 Array.from(filter.options).forEach(function(option){
  if(!option.dataset.baseLabel)option.dataset.baseLabel=option.textContent.replace(/\s+\(\d+\)$/,"");
  option.textContent=option.dataset.baseLabel+" ("+(counts[option.value]??0)+")";
 });
}

function renderOrderKpis(orders){
 const k=$("providerOrderKpis");if(!k)return;
 const action=orders.filter(o=>o.status==="placed").length;
 const active=orders.filter(o=>["accepted","preparing","ready","out_for_delivery"].includes(o.status)).length;
 const delivered=orders.filter(o=>o.status==="delivered" && new Date(o.created_at).toDateString()===new Date().toDateString()).length;
 const litres=orders.reduce((sum,o)=>(o.status==="delivered" && new Date(o.created_at).toDateString()===new Date().toDateString())?
   sum+(o.order_items||[]).reduce((s,i)=>s+Number(i.quantity||0),0):sum,0);
 k.innerHTML='<div class="order-kpi"><small>NEEDS ACTION</small><b>'+action+'</b><span>New orders</span></div>'+
   '<div class="order-kpi"><small>ACTIVE</small><b>'+active+'</b><span>In delivery flow</span></div>'+
   '<div class="order-kpi"><small>DELIVERED TODAY</small><b>'+delivered+'</b><span>Completed orders</span></div>'+
   '<div class="order-kpi"><small>MILK TODAY</small><b>'+litres.toLocaleString("en-IN",{maximumFractionDigits:2})+' L</b><span>Delivered quantity</span></div>';
}
function filterProviderOrders(orders){
 const mode=$("orderFilter")?.value||"all";
 if(mode==="action")return orders.filter(o=>o.status==="placed");
 if(mode==="active")return orders.filter(o=>["placed","accepted","preparing","ready","out_for_delivery"].includes(o.status));
 if(mode==="completed")return orders.filter(o=>["delivered","rejected","cancelled"].includes(o.status));
 return orders;
}
function startProviderOrderFeed(){
 if(!window.Doodhwala?.configured||window.__providerOrderFeedStarted)return;
 window.__providerOrderFeedStarted=true;
 loadProviderOrders().catch(function(err){console.warn("Provider order feed bootstrap failed",err)});
 clearInterval(window.__providerOrderQueueFallbackTimer);
 window.__providerOrderQueueFallbackTimer=setInterval(function(){
  if(document.visibilityState==="hidden"||!dashboard||dashboard.classList.contains("hidden"))return;
  loadProviderOrders().catch(function(err){console.warn("Provider order queue fallback refresh failed",err)});
 },45000);
}

async function setupProviderOrderRealtime(user){
 if(!window.Doodhwala?.configured||!user||window.__doodhwalaProviderOrdersChannel)return;
 const channel=Doodhwala.supabase.channel("provider-orders-"+user.id)
  .on("postgres_changes",{event:"*",schema:"public",table:"orders",filter:"provider_owner_id=eq."+user.id},function(payload){
   clearTimeout(window.__providerRealtimeRefresh);window.__providerRealtimeRefresh=setTimeout(loadProviderOrders,250);
  });
 window.__doodhwalaProviderOrdersChannel=channel;
 channel.subscribe(function(status){
  if(status==="SUBSCRIBED"){window.__providerOrdersReconnectAttempt=0;return}
  if(!["CHANNEL_ERROR","TIMED_OUT","CLOSED"].includes(status))return;
  const attempt=Math.min(6,Number(window.__providerOrdersReconnectAttempt||0)+1);
  window.__providerOrdersReconnectAttempt=attempt;
  clearTimeout(window.__providerOrdersReconnectTimer);
  const delay=Math.min(30000,1000*Math.pow(2,attempt-1));
  window.__providerOrdersReconnectTimer=setTimeout(function(){
   const stale=window.__doodhwalaProviderOrdersChannel;
   window.__doodhwalaProviderOrdersChannel=null;
   try{if(stale)Doodhwala.supabase.removeChannel(stale)}catch(_){}
   setupProviderOrderRealtime(user);
   loadProviderOrders().catch(function(err){console.warn("Provider orders reconnect refresh failed",err)});
  },delay);
 });
}

async function loadProviderOrders(){
 const state=$("providerOrderState"),list=$("providerOrders");if(!state||!list)return;
 if(!window.Doodhwala?.configured){state.textContent="Supabase is not configured.";list.innerHTML="";return}
 const {data:userData}=await Doodhwala.supabase.auth.getUser(),user=userData?.user;
 if(!user){state.textContent="Sign in to manage live orders.";list.innerHTML="";return}
 const profile=await Doodhwala.supabase.rpc("provider_get_own_profile");
 if(profile.error){state.textContent=profile.error.message==="provider_not_found"?"Complete provider onboarding first.":profile.error.message;list.innerHTML="";return}
 if(!profile.data){state.textContent="Complete provider onboarding first.";list.innerHTML="";return}
await setupProviderOrderRealtime(user)
 const result=await Doodhwala.supabase.from("orders").select("id,status,status_reason,subtotal,delivery_fee,total,customer_note,created_at,acceptance_deadline_at,estimated_delivery_min_minutes,estimated_delivery_max_minutes,promised_delivery_at,late_after_at,delivery_recipient_name,delivery_phone,delivery_address_line,delivery_area_name,delivery_city,delivery_pin_code,payment_method,payment_status,payment_reference,payment_confirmed_at,order_items(product_name_snapshot,quantity,unit_price,line_total)").eq("provider_id",profile.data.id).order("created_at",{ascending:false}).limit(50);
 if(result.error){state.textContent=result.error.message;list.innerHTML="";return}
 const orders=result.data||[];
 updateOrderFilterCounts(orders);
 const previousIds=window.__providerKnownOrderIds;
 const currentIds=new Set(orders.map(function(order){return String(order.id)}));
 if(previousIds){
  const newlyPlaced=orders.filter(function(order){return order.status==="placed"&&!previousIds.has(String(order.id))});
  if(newlyPlaced.length){
   toast(newlyPlaced.length===1?"New customer order received":newlyPlaced.length+" new customer orders received");
   try{navigator.vibrate?.([120,60,120])}catch(_){}
  }
 }
 window.__providerKnownOrderIds=currentIds;
 renderOrderKpis(orders);
 const filteredOrders=filterProviderOrders(orders);
 const actionCount=orders.filter(o=>o.status==="placed").length;
 state.textContent=orders.length
   ? orders.length+" order"+(orders.length===1?"":"s")+" in your queue"+(actionCount?" · "+actionCount+" need"+(actionCount===1?"s":"")+" your response":"")
   : "No live orders yet";
 if(!filteredOrders.length){list.innerHTML='<div class="order-empty"><b>'+(orders.length?"No orders match this filter.":"Your order queue is clear.")+'</b>'+(orders.length?"Try another queue filter.":"New customer orders will appear here automatically after checkout.")+'</div>';return}
 list.innerHTML=filteredOrders.map(function(o){
  const deadline=o.status==="placed"&&o.acceptance_deadline_at
    ?{label:(new Date(o.acceptance_deadline_at).getTime()>Date.now()?"Respond within ":"Response window expired · ")+countdownText(o.acceptance_deadline_at),
      urgent:new Date(o.acceptance_deadline_at).getTime()-Date.now()<120000,
      deadline:new Date(o.acceptance_deadline_at).getTime()}
    :o.status==="placed"
      ?orderDeadline(o.created_at,profile.data.acceptance_timeout_minutes)
      :null;
  const promise=o.promised_delivery_at
    ?'<div class="provider-promise '+(o.status==="delivered"?"done":"")+'"><span>⌖ Customer promise</span><b>'+
      escapeHtml((o.estimated_delivery_min_minutes&&o.estimated_delivery_max_minutes)
        ?o.estimated_delivery_min_minutes+"–"+o.estimated_delivery_max_minutes+" min · "+orderTime(o.promised_delivery_at)
        :orderTime(o.promised_delivery_at))+
      '</b></div>'
    :"";
  const paymentLabel=({unpaid:"Waiting for customer payment choice",payment_pending_verification:"UPI payment awaiting seller verification",paid_direct_to_seller:"Seller marked UPI payment received",cash_on_delivery:"Cash due on delivery",paid_cod:"Cash collection confirmed",unpaid:"Waiting for customer payment choice"})[o.payment_status]||String(o.payment_status||"Payment status unavailable").replace(/_/g," ");const paymentPanel='<div class="provider-payment-panel"><b>Payment · '+escapeHtml(o.payment_method==="direct_upi"?"Direct seller UPI":"Cash on Delivery")+'</b><span>'+escapeHtml(paymentLabel)+'</span>'+(o.payment_method==="direct_upi"&&o.payment_status==="payment_pending_verification"?'<button class="secondary" data-confirm-direct-upi="'+escapeHtml(o.id)+'">Confirm receipt in bank app</button>':"")+(o.payment_method==="cod"&&o.payment_status==="cash_on_delivery"&&o.status==="delivered"?'<button class="secondary" data-confirm-cod="'+escapeHtml(o.id)+'">Confirm cash collected</button>':"")+'</div>';return '<article class="provider-order"><div class="provider-order-head"><div><div class="provider-order-id">Order '+escapeHtml(o.id)+'</div><div class="provider-order-time">'+escapeHtml(orderTime(o.created_at))+'</div></div><div class="order-head-status"><span class="order-status '+escapeHtml(o.status)+'">'+escapeHtml(orderStatusLabel(o.status))+'</span>'+(deadline?'<span class="order-deadline'+(deadline.urgent?' urgent':'')+'" data-order-deadline data-order-created="'+escapeHtml(o.acceptance_deadline_at||o.created_at)+'" data-order-timeout="'+escapeHtml(profile.data.acceptance_timeout_minutes)+'">'+escapeHtml(deadline.label)+'</span>':"")+'</div></div>'+orderProgressMarkup(o.status,o.status_reason)+'<div class="provider-order-grid"><div class="order-panel"><small>Customer</small><b>'+escapeHtml(o.delivery_recipient_name||"Customer")+'</b><span>'+escapeHtml(o.delivery_phone||"No phone")+'</span></div><div class="order-panel"><small>Delivery</small><b>'+escapeHtml(o.delivery_address_line||"Address unavailable")+'</b><span>'+escapeHtml([o.delivery_area_name,o.delivery_city,o.delivery_pin_code].filter(Boolean).join(", "))+'</span></div></div><div class="order-items">'+(o.order_items||[]).map(function(i){return '<div class="order-item"><span>'+escapeHtml(i.product_name_snapshot)+' × '+i.quantity+'</span><b>'+orderMoney(i.line_total)+'</b></div>'}).join("")+'</div>'+promise+paymentPanel+'<div class="provider-order-head" style="margin-top:14px"><b>Total '+orderMoney(o.total)+'</b><span>'+escapeHtml(o.customer_note||"No customer note")+'</span></div><div class="order-actions">'+orderActions(o)+'</div></article>'
}).join("");
 list.querySelectorAll("[data-confirm-direct-upi]").forEach(function(button){button.onclick=async function(){const ref=(prompt("Enter the UPI transaction reference / UTR from your bank or UPI app (6–120 letters/numbers, /, _ or -; never enter a PIN or OTP):")||"").trim().slice(0,120);if(!/^[A-Za-z0-9/_-]{6,120}$/.test(ref)){toast("A valid transaction reference is required. Nothing was confirmed.");return}if(!confirm("Confirm only after personally checking your bank/UPI app and verifying this exact amount was received. This is a seller attestation, not an independent bank verification."))return;button.disabled=true;const r=await Doodhwala.supabase.rpc("provider_confirm_direct_upi_payment",{p_order_id:button.dataset.confirmDirectUpi,p_reference:ref});if(r.error){const message=String(r.error.message||"");toast(message.includes("payment_reference_already_used")?"This transaction reference is already recorded for another order. Check the bank statement and enter the correct reference.":(message||"Could not confirm receipt"));button.disabled=false;return}toast("Seller attestation recorded with the transaction reference; bank settlement is not independently verified.");loadProviderOrders()}});list.querySelectorAll("[data-confirm-cod]").forEach(function(button){button.onclick=async function(){if(!confirm("Confirm you collected the full cash amount for this delivered order?"))return;button.disabled=true;const r=await Doodhwala.supabase.rpc("provider_confirm_cod_collected",{p_order_id:button.dataset.confirmCod});if(r.error){toast(r.error.message||"Could not confirm cash");button.disabled=false;return}toast("Cash collection recorded.");loadProviderOrders()}});
 list.querySelectorAll("[data-order-status]").forEach(function(button){
  button.onclick=function(){
   const status=button.dataset.orderStatus;
   if(status==="rejected"||status==="cancelled"){openOrderReasonDialog(button,status);return}
   submitProviderOrderStatus(button,status,null).catch(function(error){console.warn("Order status action failed",error);toast("We couldn’t update this order. Refresh the queue and try again.")});
  };
 });

}
$("refreshSubscriptions")?.addEventListener("click",loadProviderSubscriptions);
$("orderFilter")?.addEventListener("change",loadProviderOrders);
$("refreshOrders")?.addEventListener("click",loadProviderOrders);
clearInterval(window.__providerDeadlineTimer);window.__providerDeadlineTimer=setInterval(refreshOrderDeadlines,1000);
async function signOutProvider(event){
 if(event){event.preventDefault();event.stopPropagation();}
 const buttons=[$("providerSignout"),$("providerTopSignout")].filter(Boolean);
 buttons.forEach(function(button){button.disabled=true;button.setAttribute("aria-busy","true");button.textContent="Signing out…";});
 $("providerMode").textContent="SIGNING OUT";
 try{
   if(window.Doodhwala?.configured){
     const result=await Doodhwala.supabase.auth.signOut({scope:"local"});
     if(result?.error) console.warn("Local sign-out warning",result.error);
   }
 }catch(err){console.warn("Local sign-out failed",err)}
 $("providerMode").textContent="LOCAL SETUP";
 $("providerAuthLink").textContent="Sign in";
 $("providerAuthLink").href="/Doodhwala/auth/?return=/Doodhwala/provider/";
 toast("Signed out. Opening customer marketplace…");
 setTimeout(function(){window.location.replace("/Doodhwala/?signedout=1")},350);
}
$("providerStoreToggle")?.addEventListener("click",toggleStoreStatus);
$("providerSignout")?.addEventListener("click",signOutProvider);
$("providerTopSignout")?.addEventListener("click",signOutProvider);
$("mobileProfile").onclick=()=>showView("profile");
$("resetProvider").onclick=()=>{if(!confirm("Reset the Phase 2 demo provider and return to onboarding?"))return;localStorage.removeItem(STORAGE_KEY);location.reload()};
async function bootProvider(){
 try{
  if(window.Doodhwala?.configured){
    const live=await loadProviderBackendState();
    if(live.ok){
      onboarding.classList.add("hidden");dashboard.classList.remove("hidden");
      hydrateDashboard();renderStoreStatus();
      $("providerAuthLink").textContent="Account";$("providerAuthLink").href="/Doodhwala/provider/";
      const v=provider.verificationStatus||"pending";
      $("providerMode").textContent=v==="approved"?"CONNECTED • APPROVED":v==="rejected"?"CONNECTED • REJECTED":"CONNECTED • PENDING";
      startProviderOrderFeed();
      return;
    }
  }
 }catch(err){console.warn("Provider bootstrap failed",err)}
 if(provider.providerName){
   onboarding.classList.add("hidden");dashboard.classList.remove("hidden");
   hydrateDashboard();renderStoreStatus();
   if(window.Doodhwala?.configured){
     const auth=await Doodhwala.supabase.auth.getUser();
     if(auth.data?.user){
       $("providerAuthLink").textContent="Account";
       $("providerAuthLink").href="/Doodhwala/provider/";
       try{
         const res=await syncProviderBackend();
         if(res.ok){
           await loadProviderBackendState();
           const v=provider.verificationStatus||"pending";
           $("providerMode").textContent=v==="approved"?"CONNECTED • APPROVED":v==="rejected"?"CONNECTED • REJECTED":(res.hasLocation?"CONNECTED • PENDING":"CONNECTED • ADD LOCATION");
           hydrateDashboard();
           startProviderOrderFeed();
         }else if(res.reason==="not_signed_in"){
           $("providerMode").textContent="LOCAL DEMO";
         }
       }catch(err){console.warn("Provider backend sync failed",err);$("providerMode").textContent="LOCAL DEMO"}
     }
   }
 }else{
   $("providerName").value="";$("ownerName").value="";$("phone").value="";$("providerType").value="";
 }
}
bootProvider();
document.addEventListener("visibilitychange",function(){
 if(document.visibilityState==="visible"&&dashboard&&!dashboard.classList.contains("hidden")){
   loadProviderRoute(routeDate).catch(function(err){console.warn("Provider route resume refresh failed",err)});
   if(document.getElementById("view-subscriptions")?.classList.contains("active"))loadProviderSubscriptions().catch(function(err){console.warn("Provider subscription resume refresh failed",err)});
   if(document.getElementById("view-orders")?.classList.contains("active"))loadProviderOrders().catch(function(err){console.warn("Provider order resume refresh failed",err)});
   if(document.getElementById("view-billing")?.classList.contains("active"))window.loadProviderBilling?.().catch(function(err){console.warn("Provider billing resume refresh failed",err)});
 }
});
window.addEventListener("keydown",e=>{if(e.key==="Escape"){const modal=document.querySelector(".product-modal");if(modal)modal.remove()}});