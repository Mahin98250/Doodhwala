const sup=()=>window.Doodhwala?.supabase;
const PROVIDER_ID=new URLSearchParams(location.search).get("provider");
const LOCATION_KEY="doodhwala-customer-location-v1";
let store=null;

const $=id=>document.getElementById(id);
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function money(v){return "₹"+Number(v||0).toLocaleString("en-IN",{maximumFractionDigits:2})}
function milkEmoji(type){
 const label=type==="cow"?"COW":type==="buffalo"?"BUFFALO":type==="a2"?"A2":"FRESH";
 const size=label==="BUFFALO"?5.3:6.7;
 return `<svg class="milk-type-art" viewBox="0 0 64 66" role="img" aria-label="${label.toLowerCase()} milk"><rect x="4" y="4" width="56" height="58" rx="16" fill="#f7fbf7" stroke="#d8e7db"/><path d="M26 12h12v7l5 7v24c0 3-2 5-5 5H26c-3 0-5-2-5-5V26l5-7Z" fill="#fff" stroke="#17603f" stroke-width="1.7" stroke-linejoin="round"/><path d="M26 19h12M23 29h18" fill="none" stroke="#17603f" stroke-width="1.7" stroke-linecap="round"/><path d="M32 32c-3 4-5 7-5 10a5 5 0 0 0 10 0c0-3-2-6-5-10Z" fill="#17603f"/><path d="M31 41c1-3 3-4 5-4" fill="none" stroke="#e7bd62" stroke-width="1.6" stroke-linecap="round"/><text x="32" y="59" text-anchor="middle" fill="#3a5b46" font-size="${size}" font-weight="800" font-family="Arial,sans-serif" letter-spacing=".5">${label}</text></svg>`;
}
function readLocation(){try{const v=JSON.parse(localStorage.getItem(LOCATION_KEY)||"null");if(v&&Number.isFinite(+v.latitude)&&Number.isFinite(+v.longitude))return{latitude:+v.latitude,longitude:+v.longitude};}catch(_){}return null}
function locationLabel(){return readLocation()?"Near you":"Choose location"}
function setLocationLabel(){ $("marketLocationLabel").textContent=locationLabel(); }
function toast(message){let t=document.querySelector(".market-toast");if(!t){t=document.createElement("div");t.className="market-toast";t.style.cssText="position:fixed;left:50%;bottom:96px;transform:translate(-50%,15px);z-index:10000;background:#17221a;color:#fff;border-radius:999px;padding:11px 14px;font-size:10px;opacity:0;transition:.2s;pointer-events:none";document.body.append(t)}t.textContent=message;t.style.opacity=1;t.style.transform="translate(-50%,0)";clearTimeout(window.__marketToast);window.__marketToast=setTimeout(()=>{t.style.opacity=0;t.style.transform="translate(-50%,15px)"},1800)}
function cart(){try{return JSON.parse(localStorage.getItem("doodhwala-cart")||"{}")}catch(_){return{}}}
function saveCart(c){localStorage.setItem("doodhwala-cart",JSON.stringify(c));window.dispatchEvent(new Event("doodhwala:cart-updated"))}
function addProduct(product){
 const c=cart(),key=store.provider_id+":"+product.id;
 c[key]??={key,provider:store.provider_name,milk:product.name,price:money(product.price_per_litre)+" / L",unitPrice:Number(product.price_per_litre),qty:0,emoji:milkEmoji(product.milk_type),providerId:store.provider_id,productId:product.id};
 c[key].qty+=1;saveCart(c);toast(product.name+" added to cart");
}
function serviceText(){
 if(store.is_serviceable===true){
   $("servicePill").className="service-pill";
   $("serviceLabel").textContent="Delivers to you";
   $("serviceDistance").textContent=store.distance_km==null?"Service area confirmed":store.distance_km+" km away";
   $("serviceHeadline").textContent="You're inside the delivery zone.";
   $("serviceCopy").textContent="This provider can serve the delivery location currently saved on your device.";
 }else if(store.is_serviceable===false){
   $("servicePill").className="service-pill";
   $("serviceLabel").textContent="Outside delivery zone";
   $("serviceDistance").textContent=(store.distance_km??"—")+" km away · "+store.service_radius_km+" km radius";
   $("serviceHeadline").textContent="Not available at this location.";
   $("serviceCopy").textContent="Change your delivery pin to discover providers who can reach you.";
 }else{
   $("servicePill").className="service-pill";
   $("serviceLabel").textContent="Set your location";
   $("serviceDistance").textContent="Delivery zone: "+store.service_radius_km+" km";
   $("serviceHeadline").textContent="Check delivery before ordering.";
   $("serviceCopy").textContent="Choose your delivery location to see whether this provider can serve your home.";
 }
}
let storeMap=null;
function renderStoreMap(){
 const el=$("storeMap");if(!el||!window.L||!store?.latitude||!store?.longitude)return;
 if(storeMap)storeMap.remove();
 storeMap=L.map(el,{zoomControl:true,attributionControl:true}).setView([Number(store.latitude),Number(store.longitude)],13);
 L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"&copy; OpenStreetMap contributors"}).addTo(storeMap);
 const providerPoint=[Number(store.latitude),Number(store.longitude)];
 L.marker(providerPoint,{title:store.provider_name}).addTo(storeMap).bindPopup("<b>"+esc(store.provider_name)+"</b><br>Provider service point");
 L.circle(providerPoint,{radius:Number(store.service_radius_km||5)*1000,weight:1,fillOpacity:.08}).addTo(storeMap);
 const pos=readLocation();
 if(pos){
   L.circleMarker([pos.latitude,pos.longitude],{radius:7,weight:3,fillOpacity:1}).addTo(storeMap).bindPopup("<b>Your delivery pin</b>");
   const group=L.featureGroup([L.marker(providerPoint),L.marker([pos.latitude,pos.longitude])]);
   storeMap.fitBounds(group.getBounds(),{padding:[25,25],maxZoom:14});
   $("mapZoneTitle").textContent=store.is_serviceable===true?"✓ You are inside this zone":store.is_serviceable===false?"Outside this zone":"Delivery zone";
   $("mapZoneCopy").textContent=store.distance_km==null?"Set location to check distance":store.distance_km+" km from you · "+store.service_radius_km+" km radius";
 }else{
   $("mapZoneTitle").textContent="Provider service zone";
   $("mapZoneCopy").textContent=(store.service_radius_km||5)+" km delivery radius · set your location to check serviceability";
 }
}
function render(){
 $("storeContent").classList.remove("hidden");
 $("crumbProvider").textContent=store.provider_name;
 $("storeName").textContent=store.provider_name||"Local milk provider";
 $("storeSub").textContent=[store.area_name,store.city].filter(Boolean).join(" · ")||"Nearby";
 $("storeEmoji").innerHTML=milkEmoji(store.milk_type);
 $("storeDescription").textContent=store.description||"Fresh local milk from an independent provider.";
 $("storeMeta").innerHTML=[
   "★ "+Number(store.rating_avg||0).toFixed(1)+" rating",
   (store.milk_type||"mixed")+" milk",
   store.delivery_from&&store.delivery_to ? "Delivery "+String(store.delivery_from).slice(0,5)+"–"+String(store.delivery_to).slice(0,5) : "Local delivery",
   (store.service_radius_km||5)+" km service zone"
 ].map(x=>"<span>"+esc(x)+"</span>").join("");
 const products=Array.isArray(store.products)?store.products:[];
 $("productCount").textContent=products.length+" product"+(products.length===1?"":"s");
 $("productGrid").innerHTML=products.length?products.map(p=>{
   const daily=p.daily_available;
   return '<article class="product-card"><a class="product-icon" href="/Doodhwala/product.html?provider='+encodeURIComponent(store.provider_id)+'&product='+encodeURIComponent(p.id)+'" aria-label="View '+esc(p.name)+'">'+milkEmoji(p.milk_type)+'</a><div><h3>'+esc(p.name)+'</h3><div class="product-type">'+esc(p.milk_type||"milk")+' · '+esc(p.unit_label||"1 L")+'</div><div class="product-price">'+money(p.price_per_litre)+' <span class="product-unit">/ L</span></div><div class="product-actions">'+(store.is_serviceable===false?'<button class="secondary" type="button" disabled>Outside zone</button>':'<button class="primary" type="button" data-add="'+esc(p.id)+'">Add</button>')+'<a class="secondary" href="/Doodhwala/product.html?provider='+encodeURIComponent(store.provider_id)+'&product='+encodeURIComponent(p.id)+'">Details</a></div>'+(daily?'<div style="font-size:8px;color:#17603f;margin-top:7px;font-weight:800">↻ Available for daily plan</div>':"")+'</div></article>'
 }).join(""):'<div class="market-empty"><div class="market-empty-icon">'+milkEmoji(store.milk_type)+'</div><h3>No milk products are live yet.</h3><p>This provider has not published an active in-stock product.</p></div>';
 $("productGrid").querySelectorAll("[data-add]").forEach(b=>b.onclick=()=>{const p=products.find(x=>x.id===b.dataset.add);if(p)addProduct(p)});
 serviceText();
 renderStoreMap();
}
async function load(){
 setLocationLabel();
 if(!PROVIDER_ID){$("storeState").innerHTML='<div class="market-empty"><h3>Provider not found</h3><p>Return to Explore and choose a local provider.</p><a class="primary" href="/Doodhwala/?view=providers">Explore providers →</a></div>';return}
 if(!window.Doodhwala?.configured){$("storeState").innerHTML='<div class="market-empty"><h3>Marketplace backend is unavailable.</h3><p>Please try again when the connection is restored.</p></div>';return}
 const pos=readLocation();
 const milkTransition=window.DoodhwalaMilkTransition;
 milkTransition?.showLoading("Loading this local provider…");
 try{
  $("storeState").innerHTML='<div class="market-empty"><div style="font-size:28px">⌖</div><h3>Loading provider…</h3><p>Getting live catalogue and delivery availability.</p></div>';
  const {data,error}=await sup().rpc("get_provider_storefront",{p_provider_id:PROVIDER_ID,p_latitude:pos?.latitude??null,p_longitude:pos?.longitude??null});
  if(error||!data?.[0]){
   $("storeState").innerHTML='<div class="market-empty"><h3>Provider unavailable</h3><p>'+esc(error?.message||"This provider is not currently available.")+'</p><a class="primary" href="/Doodhwala/?view=providers">Back to Explore →</a></div>';
   return;
  }
  store=data[0];
  $("storeState").innerHTML="";
  render();
 }catch(error){
  console.warn("Provider storefront load failed",error);
  $("storeState").innerHTML='<div class="market-empty"><h3>Could not load this provider</h3><p>'+esc(error?.message||"Check your connection and try again.")+'</p><a class="primary" href="/Doodhwala/store.html?provider='+encodeURIComponent(PROVIDER_ID)+'">Try again →</a></div>';
 }finally{
  milkTransition?.hideLoading();
 }
}
$("storeChangeLocation").onclick=()=>location.href="/Doodhwala/?openLocation=1";
load();