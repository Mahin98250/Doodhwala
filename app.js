const LOCATION_KEY="doodhwala-customer-location-v1";
let providers=[];
const DISCOVERY_PAGE_SIZE=24;
const DISCOVERY_FETCH_SIZE=DISCOVERY_PAGE_SIZE+1;
let discoveryOffset=0;
let discoveryHasMore=false;
let discoveryLoadingMore=false;
let discoveryCoordinates={latitude:null,longitude:null};
let discoveryRequestId=0;
let discoveryUsingLegacyRpc=false;
let activeFilter="all";
let query="";
let browseMode="all";
let sortMode="closest";
let onlyServiceable=false;
let comparedProviderIds=[];
let dataState="loading";
let favorites=[];
let cart={};

try{favorites=JSON.parse(localStorage.getItem("doodhwala-favorites")||"[]")}catch(_){favorites=[]}
try{cart=JSON.parse(localStorage.getItem("doodhwala-cart")||"{}")}catch(_){cart={}}

const $=id=>document.getElementById(id);
const grid=$("providersGrid"),cartCount=$("cartCount"),mobileCartCount=$("mobileCartCount"),cartItems=$("cartItems"),empty=$("empty"),summary=$("summary");
function installDiscoveryStyles(){
 if(document.getElementById("doodhwalaDiscoveryStyles"))return;
 const style=document.createElement("style");style.id="doodhwalaDiscoveryStyles";
 style.textContent=".discover-toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px;padding:8px 0}.discover-toolbar span{font-size:9px;color:var(--muted)}.discover-toolbar select{height:34px;border:1px solid var(--line);border-radius:10px;background:#fff;padding:0 10px;font-size:9px;color:var(--ink);outline:0}.provider-live{cursor:default}.provider-live .cover{cursor:pointer}.provider-distance{position:absolute;right:10px;top:10px;padding:5px 8px;border-radius:999px;background:rgba(255,255,255,.94);border:1px solid rgba(226,232,225,.9);font-size:7px;font-weight:800}.service-good{color:#17603f}.service-bad{color:#a3483e}.service-neutral{color:#6f7c73}.service-warning{margin-top:9px;padding:8px 9px;background:#fff4ef;border:1px solid #f0ddd7;border-radius:10px;color:#a3483e;font-size:8px}.milk-open{flex:1;min-width:0;border:0;background:transparent;text-align:left;padding:0;cursor:pointer;color:inherit}.store-link{border:0;background:transparent;color:var(--green);font-size:8px;font-weight:900;padding:3px;cursor:pointer}.no-results .primary{margin-top:8px}.empty-actions{display:flex;justify-content:center;flex-wrap:wrap;gap:8px;margin-top:13px}.empty-actions button{min-height:39px;padding:9px 12px;border:1px solid var(--line);border-radius:11px;background:#fff;color:var(--ink);font-size:10px;font-weight:800}.empty-actions button.primary{border-color:transparent;background:var(--green);color:#fff}.no-results[role=status]{text-align:center}@media(max-width:760px){.discover-toolbar{padding-top:8px}.discover-toolbar select{height:36px}.provider-distance{font-size:6.5px}.empty-actions{gap:7px}.empty-actions button{flex:1;min-width:125px}}";
 style.textContent += ".discovery-load-more{grid-column:1/-1;display:flex;flex-direction:column;align-items:center;gap:8px;padding:18px}.discovery-load-more button{min-height:42px;padding:10px 18px;border:1px solid var(--line);border-radius:999px;background:#fff;color:var(--green);font-size:11px;font-weight:800;cursor:pointer}.discovery-load-more button:disabled{opacity:.65;cursor:wait}.discovery-load-more p{margin:0;color:var(--muted);font-size:10px}";
 document.head.appendChild(style);
}
installDiscoveryStyles();

function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function money(value){return "₹"+Number(value||0).toLocaleString("en-IN",{maximumFractionDigits:2})}
function milkEmoji(type){
 const label=type==="cow"?"COW":type==="buffalo"?"BUFFALO":type==="a2"?"A2":"FRESH";
 const size=label==="BUFFALO"?5.3:6.7;
 return `<svg class="milk-type-art" viewBox="0 0 64 66" role="img" aria-label="${label.toLowerCase()} milk"><rect x="4" y="4" width="56" height="58" rx="16" fill="#f7fbf7" stroke="#d8e7db"/><path d="M26 12h12v7l5 7v24c0 3-2 5-5 5H26c-3 0-5-2-5-5V26l5-7Z" fill="#fff" stroke="#17603f" stroke-width="1.7" stroke-linejoin="round"/><path d="M26 19h12M23 29h18" fill="none" stroke="#17603f" stroke-width="1.7" stroke-linecap="round"/><path d="M32 32c-3 4-5 7-5 10a5 5 0 0 0 10 0c0-3-2-6-5-10Z" fill="#17603f"/><path d="M31 41c1-3 3-4 5-4" fill="none" stroke="#e7bd62" stroke-width="1.6" stroke-linecap="round"/><text x="32" y="59" text-anchor="middle" fill="#3a5b46" font-size="${size}" font-weight="800" font-family="Arial,sans-serif" letter-spacing=".5">${label}</text></svg>`;
}
function formatDistance(km){if(km==null||!Number.isFinite(Number(km)))return "Set location";const n=Number(km);return n<1?Math.max(100,Math.round(n*1000))+" m":n.toFixed(n<10?1:0)+" km"}
function readLocation(){try{const value=JSON.parse(localStorage.getItem(LOCATION_KEY)||"null");if(value&&Number.isFinite(+value.latitude)&&Number.isFinite(+value.longitude))return{latitude:+value.latitude,longitude:+value.longitude};}catch(_){}return null}
function toast(message){let t=document.querySelector(".toast");if(!t){t=document.createElement("div");t.className="toast";t.setAttribute("role","status");t.setAttribute("aria-live","polite");t.setAttribute("aria-atomic","true");t.style.cssText="position:fixed;left:50%;bottom:92px;transform:translate(-50%,15px);background:#17221a;color:#fff;padding:11px 15px;border-radius:999px;font-size:10px;opacity:0;transition:.2s;z-index:10000;pointer-events:none"}t.textContent=message;t.style.opacity="1";t.style.transform="translate(-50%,0)";clearTimeout(window.__toast);window.__toast=setTimeout(()=>{t.style.opacity="0";t.style.transform="translate(-50%,15px)"},2200)}
function savedLocationLabel(){return readLocation()?"Near you":"Choose location"}

function filtered(){
 const q=query.toLowerCase().trim();
 const list=providers.filter(p=>{
   const typeOk=activeFilter==="all"||(activeFilter==="subscription"?p.subscription:p.type===activeFilter);
   const savedOk=browseMode!=="saved"||favorites.includes(p.id);
   const deliveryOk=!onlyServiceable||p.isServiceable===true;
   const text=[p.name,p.area,p.tag,p.city||""].concat((p.milks||[]).flat()).join(" ").toLowerCase();
   return typeOk&&savedOk&&deliveryOk&&(!q||text.includes(q));
 });
 list.sort((a,b)=>{
   if(sortMode==="rating") return Number(b.rating||0)-Number(a.rating||0);
   if(sortMode==="price"){
     const pa=Math.min(...(a.milks||[]).map(m=>Number(String(m[1]).replace(/[^0-9.]/g,""))||Infinity));
     const pb=Math.min(...(b.milks||[]).map(m=>Number(String(m[1]).replace(/[^0-9.]/g,""))||Infinity));
     return pa-pb;
   }
   const da=a.distanceKm==null?Infinity:Number(a.distanceKm),db=b.distanceKm==null?Infinity:Number(b.distanceKm);
   return da-db;
 });
 return list;
}

function providerCardSummary(p){
 const prices=(Array.isArray(p.productPrices)?p.productPrices:[])
  .map(value=>Number(value))
  .filter(value=>Number.isFinite(value)&&value>0);
 const rating=p.rating==null?null:Number(p.rating);
 const serviceable=p.isServiceable;
 return {
  startingPrice:prices.length?Math.min(...prices):null,
  ratingLabel:Number.isFinite(rating)&&rating>0?"★ "+rating.toFixed(1):"No ratings yet",
  optionCount:Array.isArray(p.milks)?p.milks.length:0,
  serviceState:serviceable===true?"available":serviceable===false?"unavailable":"unknown",
  serviceLabel:serviceable===true?"Can deliver here":serviceable===false?"Outside delivery zone":"Choose a location to check delivery"
 };
}

function render(){
 syncDeliveryFilterControl();
 renderCompareDock();
 const list=filtered();
 const meta=$("resultMeta");
 if(meta){
   if(dataState==="loading")meta.textContent="Finding local providers…";
   else if(dataState==="error")meta.textContent="Marketplace connection unavailable";
   else if(browseMode==="saved")meta.textContent=list.length+" saved provider"+(list.length===1?"":"s");
   else if(readLocation()){const deliverable=list.filter(p=>p.isServiceable===true).length;meta.textContent=deliverable+" provider"+(deliverable===1?"":"s")+" can deliver here"+(list.length>deliverable?" · "+list.length+" nearby":"");}
   else if(browseMode!=="saved"&&!query.trim()&&activeFilter==="all"&&!onlyServiceable)meta.textContent=list.length?list.length+" local provider"+(list.length===1?"":"s")+" · set location":"Choose a location";
   else meta.textContent=list.length+" local provider"+(list.length===1?"":"s")+" · set a location to check delivery";
 }
 if(!grid)return;
 grid.setAttribute("aria-busy",dataState==="loading"?"true":"false");
 if(dataState==="loading"){
   grid.innerHTML=Array.from({length:3},()=>'<article class="provider provider-skeleton"><div class="cover"></div><div class="provider-body"><div class="skeleton-line long"></div><div class="skeleton-line short"></div><div class="skeleton-box"></div></div></article>').join("");
   return;
 }
 if(dataState==="error"){
   grid.innerHTML='<div class="no-results no-results-error" role="status"><div class="discovery-empty-icon" aria-hidden="true">↻</div><div class="discovery-empty-copy"><h3>We could not load the marketplace.</h3><p>Check your connection and try again. Doodhwala will not show fake provider data when the live backend is unavailable.</p></div><button class="primary discovery-empty-cta" id="retryProviders" type="button">Try again →</button></div>';
   $("retryProviders")?.addEventListener("click",()=>loadRemoteProvidersFromSaved());
   return;
 }
 if(!list.length){
   const hasSearch=Boolean(query.trim()),hasTypeFilter=activeFilter!=="all",hasDeliveryFilter=onlyServiceable;
   if(hasSearch||hasTypeFilter||hasDeliveryFilter){
     const filterNames={cow:"Cow milk",buffalo:"Buffalo milk",a2:"A2 milk",subscription:"Daily plans"};
     const detail=hasDeliveryFilter&&!hasSearch&&!hasTypeFilter?"No sellers are currently marked as able to deliver to this location.":hasSearch?'No providers match “'+escapeHtml(query.trim())+'”.':"No providers match the current selection.";
     const hints=[];
     if(hasTypeFilter)hints.push('Selected filter: '+escapeHtml(filterNames[activeFilter]||activeFilter)+'.');
     if(hasDeliveryFilter)hints.push("Try another delivery location, or turn off the delivery-only filter.");
     if(!hints.length)hints.push("Try a different name, milk type, product or area.");
     const actions=(hasSearch?'<button type="button" id="clearDiscoverySearch">Clear search</button>':"")+(hasTypeFilter?'<button type="button" id="clearDiscoveryFilter" class="primary">Show all milk types</button>':"")+(hasDeliveryFilter?'<button type="button" id="clearDeliveryFilter">Show nearby sellers</button>':"");
     grid.innerHTML='<div class="no-results" role="status" aria-live="polite"><div style="font-size:32px">⌕</div><h3>No matching providers</h3><p>'+detail+" "+hints.join(" ")+'</p><div class="empty-actions">'+actions+'</div></div>';
     $("clearDiscoverySearch")?.addEventListener("click",()=>{query="";const input=$("search");if(input)input.value="";render();input?.focus()});
     $("clearDiscoveryFilter")?.addEventListener("click",()=>filter("all"));
     $("clearDeliveryFilter")?.addEventListener("click",()=>{onlyServiceable=false;render()});
     appendLoadMoreControl();
     return;
   }
   if(browseMode==="saved"){grid.innerHTML='<div class="no-results"><div style="font-size:32px">♡</div><h3>No saved providers yet</h3><p>Tap the heart on a provider to save it for later.</p></div>';appendLoadMoreControl();return}
   const hasLocation=!!readLocation();
   const emptyTitle=hasLocation?"No providers serve this location yet.":"Choose your delivery location";
   const emptyCopy=hasLocation?"No independent providers currently match this delivery area. Try another location to check nearby sellers.":"Set a delivery location to discover independent milk sellers and check who can deliver to you.";
   const emptyAction=hasLocation?"Change delivery location →":"Choose delivery location →";
   const emptyIcon=hasLocation?milkEmoji("mixed"):'<svg viewBox="0 0 24 24" focusable="false"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>';
   grid.innerHTML='<div class="no-results '+(hasLocation?"no-results-location-set":"no-results-location")+'" role="status"><div class="discovery-empty-icon" aria-hidden="true">'+emptyIcon+'</div><div class="discovery-empty-copy"><h3>'+emptyTitle+'</h3><p>'+emptyCopy+'</p></div><button class="primary discovery-empty-cta" id="setLocationInline" type="button">'+emptyAction+'</button><small class="discovery-empty-note">'+(hasLocation?"You can choose a different area at any time.":"Use your current location or move the pin on the map.")+'</small></div>';
   $("setLocationInline")?.addEventListener("click",()=>window.DoodhwalaLocation?.open?.());
   return;
 }
 grid.innerHTML=list.map(p=>{
   const saved=favorites.includes(p.id);
   const summary=providerCardSummary(p);
   const areaLabel=[p.area,p.city].filter(Boolean).filter((value,index,array)=>array.indexOf(value)===index).join(" · ");
   const locationBadge=p.distanceKm!=null?formatDistance(p.distanceKm):(p.isServiceable===true?"Can deliver":p.isServiceable===false?"Outside zone":"Set location");
   const badgeClass=p.isServiceable===false?"service-bad":(p.isServiceable===true?"service-good":"service-neutral");
   const startingPrice=summary.startingPrice===null?"Price unavailable":money(summary.startingPrice)+'<span> / L</span>';
   const optionLabel=summary.optionCount+" milk option"+(summary.optionCount===1?"":"s");
   const deliveryLabel=p.delivery&&p.delivery!=="Local route"?"Delivery "+p.delivery:"Delivery details in store";
   return '<article class="provider provider-live" data-provider-card="'+escapeHtml(p.id)+'">'+
     '<div class="cover" data-store="'+escapeHtml(p.id)+'"><span>'+escapeHtml(p.tag)+'</span><div class="provider-emoji">'+milkEmoji(p.type)+'</div><div class="provider-distance '+badgeClass+'">⌖ '+escapeHtml(locationBadge)+'</div></div>'+
     '<div class="provider-body"><div class="name-row"><div class="provider-identity"><div class="provider-name">'+escapeHtml(p.name)+'</div><div class="meta">'+escapeHtml(areaLabel||"Local provider")+'</div></div><div class="provider-actions"><button class="save-provider'+(saved?" saved":"")+'" data-save="'+escapeHtml(p.id)+'" aria-label="'+(saved?"Remove from saved":"Save provider")+'">'+(saved?"♥":"♡")+'</button></div></div>'+
     '<div class="provider-price-summary">'+
       '<div class="provider-price-block"><small>Starting price</small><strong>'+startingPrice+'</strong></div>'+
       '<div class="provider-card-facts"><span class="provider-rating">'+escapeHtml(summary.ratingLabel)+'</span><span class="provider-option-count">'+escapeHtml(optionLabel)+'</span></div>'+
       '<span class="provider-service-chip service-'+summary.serviceState+'">'+escapeHtml(summary.serviceLabel)+'</span>'+
     '</div>'+
     '<div class="milk">'+(p.milks||[]).map((m,i)=>{const pid=p.productIds?.[i];return '<div class="milk-row"><button class="milk-open" data-product="'+escapeHtml(pid||"")+'" data-provider="'+escapeHtml(p.providerId||p.id)+'"><strong>'+escapeHtml(m[0])+'</strong><small>'+escapeHtml(m[1])+'</small></button><div class="milk-actions">'+(pid&&p.isServiceable!==false&&Number.isFinite(Number(p.productPrices?.[i]))&&Number(p.productPrices[i])>0?'<button class="add" data-add="'+escapeHtml(p.id+":"+i)+'">Add</button>':"")+(pid&&p.subscription&&p.productDailyAvailable?.[i]&&p.isServiceable!==false?'<button class="plan-add" data-plan="'+escapeHtml(p.providerId)+'" data-product="'+escapeHtml(pid)+'">Plan</button>':"")+'</div></div>'}).join("")+'</div>'+
     '<div class="provider-foot"><span>'+escapeHtml(deliveryLabel)+'</span><div class="provider-foot-actions"><button type="button" class="compare-provider" data-compare="'+escapeHtml(p.id)+'" aria-pressed="'+(comparedProviderIds.includes(p.id)?"true":"false")+'">'+(comparedProviderIds.includes(p.id)?"✓ Added":"Compare")+'</button><button class="store-link" data-store="'+escapeHtml(p.providerId||p.id)+'">View store →</button></div></div></div></article>';
 }).join("");
 appendLoadMoreControl();
 grid.querySelectorAll("[data-add]").forEach(b=>b.onclick=()=>add(b.dataset.add));
 grid.querySelectorAll("[data-save]").forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();toggleFavorite(b.dataset.save)});
 grid.querySelectorAll("[data-compare]").forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();toggleCompare(b.dataset.compare)});
 grid.querySelectorAll("[data-store]").forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();location.href="/Doodhwala/store/?provider="+encodeURIComponent(b.dataset.store)});
 grid.querySelectorAll("[data-product]").forEach(b=>b.onclick=e=>{if(b.dataset.product){e.preventDefault();e.stopPropagation();location.href="/Doodhwala/product/?provider="+encodeURIComponent(b.dataset.provider)+"&product="+encodeURIComponent(b.dataset.product)}});
}

function add(key){
 const parts=key.split(":"),providerKey=parts[0],index=Number(parts[1]),p=providers.find(x=>x.id===providerKey),m=p?.milks?.[index];
 if(!p||!m||p.isServiceable===false)return;
 const productId=p.productIds?.[index]||null;
 const unitPrice=Number(p.productPrices?.[index]);
 if(!productId){toast("Product is no longer available in the live catalogue");return}
 if(!Number.isFinite(unitPrice)||unitPrice<=0){toast("This product has no valid price yet and cannot be added");return}
 const itemKey=p.providerId+":"+productId;
 cart[itemKey]??={key:itemKey,provider:p.name,milk:m[0],price:money(unitPrice)+" / L",unitPrice,qty:0,emoji:milkEmoji(p.type),providerId:p.providerId,productId};
 cart[itemKey].qty+=1;const persisted=saveCart();updateCart();toast(persisted?m[0]+" added":"Added, but this device could not save your cart. Keep this tab open.");
}
function saveCart(){const persisted=writeLocalState("doodhwala-cart",cart);window.dispatchEvent(new Event("doodhwala:cart-updated"));return persisted}
function writeLocalState(key,value){if(window.DoodhwalaResilience?.writeStorage)return window.DoodhwalaResilience.writeStorage(key,value);try{localStorage.setItem(key,JSON.stringify(value));return true}catch(_){return false}}
function entries(){return Object.values(cart).filter(x=>Number(x.qty)>0)}
function updateCart(){
 const list=entries(),count=list.reduce((sum,x)=>sum+Number(x.qty||0),0);
 if(cartCount){cartCount.textContent=count;cartCount.style.display=count?"grid":"none"}
 if(mobileCartCount){mobileCartCount.textContent=count;mobileCartCount.style.display=count?"grid":"none"}
 if(!cartItems)return;
 empty.style.display=list.length?"none":"block";summary.style.display=list.length?"block":"none";
 cartItems.innerHTML=list.map(x=>'<div class="cart-line"><div class="thumb">'+milkEmoji(x.productId?null:null)+'</div><div><h4>'+escapeHtml(x.milk)+'</h4><p>'+escapeHtml(x.provider)+' · '+money(x.unitPrice)+' / L</p></div><div class="qty"><button data-qty="'+escapeHtml(x.key)+':-1">−</button><b>'+x.qty+'</b><button data-qty="'+escapeHtml(x.key)+':1">+</button></div></div>').join("");
 const total=list.reduce((sum,x)=>sum+(Number(x.unitPrice)||0)*Number(x.qty||0),0);
 $("total").textContent=money(total);
 cartItems.querySelectorAll("[data-qty]").forEach(b=>b.onclick=()=>qty(b.dataset.qty));
}
function qty(value){const i=value.lastIndexOf(":");const key=value.slice(0,i),delta=Number(value.slice(i+1));if(!cart[key])return;cart[key].qty=Math.max(0,Number(cart[key].qty)+delta);if(!cart[key].qty)delete cart[key];const persisted=saveCart();updateCart();if(!persisted)toast("Cart updated temporarily; browser storage is unavailable.")}
function toggleFavorite(id){const i=favorites.indexOf(id),removing=i>=0;if(removing)favorites.splice(i,1);else favorites.push(id);const persisted=writeLocalState("doodhwala-favorites",favorites);render();toast(!persisted?"Updated for this session, but could not save on this device.":(removing?"Removed from saved":"Provider saved"))}

function filter(v){activeFilter=v;document.querySelectorAll("#chips button").forEach(b=>b.classList.toggle("active",b.dataset.filter===v));document.querySelectorAll(".quick button").forEach(b=>b.classList.toggle("selected",b.dataset.filter===v));render()}

function syncDeliveryFilterControl(){
 const button=$("deliverableOnly");
 if(!button)return;
 button.setAttribute("aria-pressed",onlyServiceable?"true":"false");
 button.classList.toggle("is-active",onlyServiceable);
 const label=button.querySelector("[data-delivery-filter-label]");
 if(label)label.textContent=onlyServiceable?"Showing deliverable":"Can deliver here";
}
function toggleDeliveryFilter(){
 if(!readLocation()){
   toast("Choose a delivery location first");
   window.DoodhwalaLocation?.open?.();
   return;
 }
 onlyServiceable=!onlyServiceable;
 render();
}
function selectedForComparison(){
 return comparedProviderIds.map(id=>providers.find(p=>String(p.id)===String(id))).filter(Boolean).slice(0,3);
}
function renderCompareDock(){
 const dock=$("compareDock");
 if(!dock)return;
 const selected=selectedForComparison();
 dock.hidden=selected.length===0;
 const title=$("compareDockTitle"),names=$("compareDockNames"),open=$("openCompare");
 if(title)title.textContent=selected.length===1?"Select one more seller":"Compare "+selected.length+" local sellers";
 if(names)names.textContent=selected.map(p=>p.name).join(" · ");
 if(open){open.disabled=selected.length<2;open.textContent=selected.length<2?"Add one more":"Compare now";}
}
function toggleCompare(id){
 const provider=providers.find(p=>String(p.id)===String(id));
 if(!provider){toast("This seller is no longer in the current catalogue");return}
 const existing=comparedProviderIds.findIndex(value=>String(value)===String(id));
 if(existing>=0){comparedProviderIds.splice(existing,1);render();toast("Seller removed from comparison");return}
 if(comparedProviderIds.length>=3){toast("Compare up to 3 sellers at a time");return}
 comparedProviderIds.push(id);
 render();
 toast(comparedProviderIds.length===1?"Seller added · choose one more to compare":"Seller added to comparison");
}
function compareCellProvider(p){
 const delivery=p.isServiceable===true
  ?'<span class="compare-status is-good">✓ Can deliver</span>'
  :p.isServiceable===false
   ?'<span class="compare-status is-bad">Outside area</span>'
   :'<span class="compare-status is-neutral">Set location to check</span>';
 const milk=(p.milks||[]).length
  ?p.milks.map(m=>'<div class="compare-milk"><b>'+escapeHtml(m[0])+'</b><span>'+escapeHtml(m[1])+'</span></div>').join("")
  :'<span class="compare-muted">No active products listed</span>';
 const distance=p.distanceKm==null?'<span class="compare-muted">Set location</span>':escapeHtml(formatDistance(p.distanceKm));
 const daily=p.subscription?'<span class="compare-status is-good">Available</span>':'<span class="compare-muted">Not listed</span>';
 return {name:escapeHtml(p.name||"Local seller"),rating:escapeHtml(providerCardSummary(p).ratingLabel),area:escapeHtml([p.area,p.city].filter(Boolean).join(", ")||"Local area"),milk,distance,delivery,window:escapeHtml(p.delivery||"Local route"),daily,store:escapeHtml(p.providerId||p.id)};
}
function openCompareDialog(){
 const selected=selectedForComparison(),overlay=$("compareDialog"),content=$("compareContent");
 if(selected.length<2){toast("Choose at least 2 sellers to compare");return}
 if(!overlay||!content)return;
 const rows=selected.map(compareCellProvider);
 const columns=rows.map(p=>'<th scope="col"><span class="compare-seller-name">'+p.name+'</span><small>Independent seller</small></th>').join("");
 const body=[["Rating",p=>p.rating],["Milk & price",p=>p.milk],["Delivery area",p=>p.area],["Distance",p=>p.distance],["Delivery availability",p=>p.delivery],["Delivery window",p=>p.window],["Daily plan",p=>p.daily]];
 content.innerHTML='<div class="compare-table-wrap"><table class="compare-table"><thead><tr><th scope="col">Compare</th>'+columns+'</tr></thead><tbody>'+body.map(([label,get])=>'<tr><th scope="row">'+label+'</th>'+rows.map(p=>'<td>'+get(p)+'</td>').join("")+'</tr>').join("")+'<tr><th scope="row">Open seller</th>'+rows.map(p=>'<td><button type="button" class="primary compare-open-store" data-compare-store="'+p.store+'">View store →</button></td>').join("")+'</tr></tbody></table></div><p class="compare-footnote">Prices and availability reflect the current catalogue. Confirm the final order total and delivery details at checkout.</p>';
 content.querySelectorAll("[data-compare-store]").forEach(button=>button.addEventListener("click",()=>{location.href="/Doodhwala/store/?provider="+encodeURIComponent(button.dataset.compareStore)}));
 overlay.hidden=false;overlay.setAttribute("aria-hidden","false");document.body.classList.add("compare-open");$("closeCompare")?.focus();
}
function closeCompareDialog(){
 const overlay=$("compareDialog");
 if(!overlay||overlay.hidden)return;
 overlay.hidden=true;overlay.setAttribute("aria-hidden","true");document.body.classList.remove("compare-open");$("openCompare")?.focus();
}
function clearComparison(closeDialog=false){
 comparedProviderIds=[];render();if(closeDialog)closeCompareDialog();toast("Comparison cleared");
}
function navigateHomeView(destination){
 if(destination==="plans"||destination==="orders"){
  const url="/Doodhwala/"+(destination==="plans"?"plans/":"orders/");
  if(window.DoodhwalaMilkTransition&&typeof window.DoodhwalaMilkTransition.navigate==="function")window.DoodhwalaMilkTransition.navigate(url);
  else window.location.href=url;
  return;
 }
 if(destination==="providers"){browseMode="all";activeFilter=activeFilter||"all";render();$("providers")?.scrollIntoView({behavior:"smooth",block:"start"})}
 if(destination==="saved"){browseMode="saved";render();$("providers")?.scrollIntoView({behavior:"smooth",block:"start"})}
 if(destination==="home"){browseMode="all";render();window.scrollTo({top:0,behavior:"smooth"})}
}
window.__doodhwalaNavigate=navigateHomeView;

document.querySelectorAll("#chips button").forEach(b=>b.onclick=()=>filter(b.dataset.filter));
document.querySelectorAll(".quick button").forEach(b=>b.onclick=()=>{filter(b.dataset.filter);$("providers")?.scrollIntoView({behavior:"smooth"})});
$("search")?.addEventListener("input",e=>{query=e.target.value;render()});
$("providerSort")?.addEventListener("change",e=>{sortMode=e.target.value;const hint=$("discoveryHint");if(hint)hint.textContent=sortMode==="rating"?"Highest rated providers first":sortMode==="price"?"Lowest milk price first":"Closest providers first";loadRemoteProvidersFromSaved()});
$("deliverableOnly")?.addEventListener("click",toggleDeliveryFilter);
$("openCompare")?.addEventListener("click",openCompareDialog);
$("closeCompare")?.addEventListener("click",closeCompareDialog);
$("closeCompareFooter")?.addEventListener("click",closeCompareDialog);
$("clearCompare")?.addEventListener("click",()=>clearComparison());
$("clearCompareInside")?.addEventListener("click",()=>clearComparison(true));
$("compareDialog")?.addEventListener("click",event=>{if(event.target.id==="compareDialog")closeCompareDialog()});
document.addEventListener("keydown",event=>{
 const overlay=$("compareDialog");
 if(!overlay||overlay.hidden)return;
 if(event.key==="Escape"){closeCompareDialog();return}
 if(event.key!=="Tab")return;
 const focusable=overlay.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])');
 if(!focusable.length)return;
 const first=focusable[0],last=focusable[focusable.length-1];
 if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
 else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
});
$("explore")?.addEventListener("click",()=>navigateHomeView("providers"));
$("filterButton")?.addEventListener("click",()=>$("chips")?.scrollIntoView({behavior:"smooth",block:"center"}));

function openCart(){document.body.classList.add("drawer-open")}
function closeCart(){document.body.classList.remove("drawer-open")}
window.openCart=openCart;window.closeCart=closeCart;
$("openCart")?.addEventListener("click",openCart);$("openCartMobile")?.addEventListener("click",openCart);$("closeCart")?.addEventListener("click",closeCart);$("backdrop")?.addEventListener("click",closeCart);
$("how")?.addEventListener("click",()=>document.body.classList.add("modal-open"));$("closeModal")?.addEventListener("click",()=>document.body.classList.remove("modal-open"));$("modalBackdrop")?.addEventListener("click",e=>{if(e.target.id==="modalBackdrop")document.body.classList.remove("modal-open")});
$("checkout")?.addEventListener("click",()=>{if(!entries().length){toast("Your cart is empty");return}location.href="/Doodhwala/checkout/"});
["locationBtn","locationTop","locationHero"].forEach(id=>{const el=$(id);if(el)el.addEventListener("click",()=>window.DoodhwalaLocation?.open?.())});
document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>navigateHomeView(b.dataset.go)));

function mapRemoteProvider(row){
 const products=Array.isArray(row.products)?row.products:[];
 return {
   id:row.provider_id,providerId:row.provider_id,name:row.provider_name,area:(row.area_name||"Local area"),city:row.city,
   tag:(row.milk_type||"mixed")+" milk",type:row.milk_type||"mixed",emoji:milkEmoji(row.milk_type),
   rating:row.rating_avg==null||!Number.isFinite(Number(row.rating_avg))||Number(row.rating_avg)<=0?null:Number(row.rating_avg),
   delivery:row.delivery_from&&row.delivery_to?String(row.delivery_from).slice(0,5)+"–"+String(row.delivery_to).slice(0,5):"Local route",
   latitude:Number(row.latitude),longitude:Number(row.longitude),
   distanceKm:row.distance_km==null?null:Number(row.distance_km),serviceRadiusKm:row.service_radius_km==null?null:Number(row.service_radius_km),
   isServiceable:row.is_serviceable==null?null:Boolean(row.is_serviceable),
   subscription:products.some(p=>p.daily_available),productDailyAvailable:products.map(p=>Boolean(p.daily_available)),
   productIds:products.map(p=>p.id),productPrices:products.map(p=>Number(p.price_per_litre)),milks:products.map(p=>[p.name,Number.isFinite(Number(p.price_per_litre))&&Number(p.price_per_litre)>0?money(p.price_per_litre)+" / L":"Price unavailable"])
 };
}
function isMissingDiscoveryV3(error){
 const code=String(error?.code||"");
 const message=String(error?.message||"");
 return code==="PGRST202"||code==="42883"||(/find_nearby_providers_v3/i.test(message)&&/schema cache|could not find|does not exist|not found/i.test(message));
}
function appendLoadMoreControl(){
 if(!grid||!discoveryHasMore||discoveryUsingLegacyRpc)return;
 const wrapper=document.createElement("div");
 wrapper.className="discovery-load-more";
 const button=document.createElement("button");
 button.type="button";
 button.disabled=discoveryLoadingMore;
 button.textContent=discoveryLoadingMore?"Loading more local sellers…":"Load more local sellers";
 button.addEventListener("click",loadMoreProviders);
 const caption=document.createElement("p");
 caption.textContent="Showing "+providers.length+" providers so far";
 wrapper.append(button,caption);
 grid.appendChild(wrapper);
}
async function loadRemoteProviders(lat=null,lng=null){
 const requestId=++discoveryRequestId;
 discoveryCoordinates={
   latitude:lat==null?null:Number(lat),
   longitude:lng==null?null:Number(lng)
 };
 discoveryOffset=0;discoveryHasMore=false;discoveryLoadingMore=false;discoveryUsingLegacyRpc=false;
 const milkTransition=window.DoodhwalaMilkTransition;
 milkTransition?.showLoading("Finding fresh milk nearby…");
 try{
  if(!window.Doodhwala?.configured){dataState="error";providers=[];render();return}
  dataState="loading";providers=[];render();
  let data,error,usedLegacyRpc=false;
  const result=await window.Doodhwala.supabase.rpc("find_nearby_providers_v3",{
   p_latitude:discoveryCoordinates.latitude,
   p_longitude:discoveryCoordinates.longitude,
   p_max_km:20,
   p_sort:sortMode,
   p_limit:DISCOVERY_FETCH_SIZE,
   p_offset:0
  });
  if(result.error){
   if(!isMissingDiscoveryV3(result.error))throw result.error;
   // Compatibility while the additive SQL migration rolls out. Old clients and
   // deployments without v3 continue to use the existing, unchanged RPC.
   const legacy=await window.Doodhwala.supabase.rpc("find_nearby_providers_v2",{
    p_latitude:discoveryCoordinates.latitude,
    p_longitude:discoveryCoordinates.longitude,
    p_max_km:20
   });
   if(legacy.error)throw legacy.error;
   data=legacy.data;error=null;usedLegacyRpc=true;
  }else{data=result.data;error=result.error}
  if(error)throw error;
  if(requestId!==discoveryRequestId)return;
  discoveryUsingLegacyRpc=usedLegacyRpc;
  const rows=Array.isArray(data)?data:[];
  if(usedLegacyRpc){
   providers=rows.map(mapRemoteProvider);
   discoveryOffset=providers.length;
   discoveryHasMore=false;
  }else{
   const firstPage=rows.slice(0,DISCOVERY_PAGE_SIZE);
   providers=firstPage.map(mapRemoteProvider);
   discoveryOffset=firstPage.length;
   discoveryHasMore=rows.length>DISCOVERY_PAGE_SIZE&&discoveryOffset<5000;
  }
  window.providers=providers;dataState="ready";render();window.dispatchEvent(new Event("doodhwala:providers-updated"));
 }catch(error){
  if(requestId===discoveryRequestId)throw error;
 }finally{
  milkTransition?.hideLoading();
 }
}
async function loadMoreProviders(){
 if(discoveryLoadingMore||!discoveryHasMore||discoveryOffset>=5000||discoveryUsingLegacyRpc||!window.Doodhwala?.configured)return;
 const requestId=discoveryRequestId;
 discoveryLoadingMore=true;render();
 try{
  const {data,error}=await window.Doodhwala.supabase.rpc("find_nearby_providers_v3",{
   p_latitude:discoveryCoordinates.latitude,
   p_longitude:discoveryCoordinates.longitude,
   p_max_km:20,
   p_sort:sortMode,
   p_limit:DISCOVERY_FETCH_SIZE,
   p_offset:discoveryOffset
  });
  if(error)throw error;
  if(requestId!==discoveryRequestId)return;
  const rows=Array.isArray(data)?data:[];
  const page=rows.slice(0,DISCOVERY_PAGE_SIZE).map(mapRemoteProvider);
  const existing=new Set(providers.map(provider=>String(provider.id)));
  page.forEach(provider=>{if(!existing.has(String(provider.id))){providers.push(provider);existing.add(String(provider.id))}});
  discoveryOffset+=rows.length>DISCOVERY_PAGE_SIZE?DISCOVERY_PAGE_SIZE:Math.min(rows.length,DISCOVERY_PAGE_SIZE);
  discoveryHasMore=rows.length>DISCOVERY_PAGE_SIZE&&discoveryOffset<5000;
  window.providers=providers;
  window.dispatchEvent(new Event("doodhwala:providers-updated"));
 }catch(error){
  console.error("Could not load more Doodhwala providers",error);
  toast("Could not load more sellers. Please try again.");
 }finally{
  if(requestId===discoveryRequestId){discoveryLoadingMore=false;render()}
 }
}
async function loadRemoteProvidersFromSaved(){
 const pos=readLocation();
 try{await loadRemoteProviders(pos?.latitude??null,pos?.longitude??null)}
 catch(error){console.error(error);dataState="error";render()}
}
window.loadRemoteProviders=loadRemoteProviders;
window.loadRemoteProvidersFromSaved=loadRemoteProvidersFromSaved;

function initialView(){
 const q=new URLSearchParams(location.search);
 if(q.get("view")==="saved"){browseMode="saved"}
 else if(q.get("view")==="providers"){browseMode="all"}
 if(q.get("cart")==="1")setTimeout(openCart,120);
 if(q.get("openLocation")==="1")setTimeout(()=>window.DoodhwalaLocation?.open?.(),250);
}
updateCart();render();initialView();loadRemoteProvidersFromSaved();
