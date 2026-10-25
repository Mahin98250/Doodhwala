const sup=()=>window.Doodhwala?.supabase;
const params=new URLSearchParams(location.search);
const providerId=params.get("provider"), productId=params.get("product");
const LOCATION_KEY="doodhwala-customer-location-v1";
let store=null,product=null,qty=1;
const $=id=>document.getElementById(id);
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function money(v){return "₹"+Number(v||0).toLocaleString("en-IN",{maximumFractionDigits:2})}
let productToast=null,productToastTimer=null;
function toast(message){
 if(!productToast){
   productToast=document.createElement("div");
   productToast.setAttribute("role","status");
   productToast.setAttribute("aria-live","polite");
   productToast.style.cssText="position:fixed;left:50%;bottom:calc(92px + env(safe-area-inset-bottom,0px));z-index:10000;transform:translateX(-50%);max-width:calc(100vw - 28px);background:#17221a;color:#fff;padding:11px 15px;border-radius:999px;font-size:12px;box-shadow:0 8px 24px rgba(0,0,0,.18)";
   document.body.append(productToast);
 }
 productToast.textContent=message;
 clearTimeout(productToastTimer);
 productToastTimer=setTimeout(()=>{productToast?.remove();productToast=null},2200);
}
function milkIcon(type){
 const label=type==="cow"?"COW":type==="buffalo"?"BUFFALO":type==="a2"?"A2":"FRESH";
 const size=label==="BUFFALO"?5.3:6.7;
 return `<svg class="milk-type-art" viewBox="0 0 64 66" role="img" aria-label="${label.toLowerCase()} milk"><rect x="4" y="4" width="56" height="58" rx="16" fill="#f7fbf7" stroke="#d8e7db"/><path d="M26 12h12v7l5 7v24c0 3-2 5-5 5H26c-3 0-5-2-5-5V26l5-7Z" fill="#fff" stroke="#17603f" stroke-width="1.7" stroke-linejoin="round"/><path d="M26 19h12M23 29h18" fill="none" stroke="#17603f" stroke-width="1.7" stroke-linecap="round"/><path d="M32 32c-3 4-5 7-5 10a5 5 0 0 0 10 0c0-3-2-6-5-10Z" fill="#17603f"/><path d="M31 41c1-3 3-4 5-4" fill="none" stroke="#e7bd62" stroke-width="1.6" stroke-linecap="round"/><text x="32" y="59" text-anchor="middle" fill="#3a5b46" font-size="${size}" font-weight="800" font-family="Arial,sans-serif" letter-spacing=".5">${label}</text></svg>`;
}
function readLocation(){try{const v=JSON.parse(localStorage.getItem(LOCATION_KEY)||"null");if(v&&Number.isFinite(+v.latitude)&&Number.isFinite(+v.longitude))return{latitude:+v.latitude,longitude:+v.longitude}}catch(_){}return null}
function setLocationLabel(){$("marketLocationLabel").textContent=readLocation()?"Near you":"Choose location"}
function setState(title,copy,link){const content=$("productContent");if(content)content.classList.add("hidden");const button=$("addToCart");if(button){button.disabled=true;button.textContent="Unavailable"}const state=$("productState");if(state)state.innerHTML='<div class="market-empty"><h3>'+esc(title)+'</h3><p>'+esc(copy)+'</p>'+(link?'<a class="primary" href="'+link[0]+'">'+esc(link[1])+'</a>':"")+'</div>'}
function cart(){try{return JSON.parse(localStorage.getItem("doodhwala-cart")||"{}")}catch(_){return{}}}
function saveCart(c){try{localStorage.setItem("doodhwala-cart",JSON.stringify(c));window.dispatchEvent(new Event("doodhwala:cart-updated"));return true}catch(error){try{console.warn("Could not persist product cart",error)}catch(_){}return false}}
function add(){
 if(!store||!product){setState("Product not ready","Reload the page or return to the live catalogue.",["/Doodhwala/?view=providers","Explore providers →"]);return}
 const unitPrice=Number(product.price_per_litre);
 if(!Number.isFinite(unitPrice)||unitPrice<=0){toast("This product has no valid price yet and cannot be added");return}
 if(store.is_serviceable===false){toast("This seller cannot deliver to your selected location");return}
 const c=cart(),key=store.provider_id+":"+product.id;
 c[key]??={key,provider:store.provider_name||"Local seller",milk:product.name,price:money(unitPrice)+" / L",unitPrice,qty:0,providerId:store.provider_id,productId:product.id};
 c[key].qty=Math.min(100,Math.max(0,Number(c[key].qty)||0)+qty);
 if(!saveCart(c)){toast("Could not save your cart on this device. Check browser storage.");return}
 const t=document.createElement("div");t.textContent=qty+" × "+product.name+" added to cart";t.style.cssText="position:fixed;left:50%;bottom:96px;z-index:10000;transform:translateX(-50%);background:#17221a;color:#fff;padding:11px 15px;border-radius:999px;font-size:10px";document.body.append(t);setTimeout(()=>t.remove(),1800);
}
function render(){
 if(!store||!product){$("productContent")?.classList.add("hidden");const button=$("addToCart");if(button)button.disabled=true;return}
 const unitPrice=Number(product.price_per_litre);
 const priceValid=Number.isFinite(unitPrice)&&unitPrice>0;
 $("productContent")?.classList.remove("hidden");$("productState").innerHTML="";
 $("productEmoji").innerHTML=milkIcon(product.milk_type||"mixed");
 $("productName").textContent=product.name||"Milk";
 $("productCrumb").textContent=product.name||"Milk";
 $("productLead").textContent=(product.milk_type||"milk").toUpperCase()+" · "+(product.unit_label||"1 L")+" · Fresh catalogue item from "+(store.provider_name||"local seller")+".";
 $("productPrice").textContent=priceValid?money(unitPrice):"Price unavailable";$("productUnit").textContent=priceValid?"/ litre":"";
 $("buyTotal").textContent=priceValid?money(unitPrice*qty):"Unavailable";
 $("quantity").textContent=String(qty);
 $("providerLink").textContent=store.provider_name||"Local seller";
 $("providerLink").href="/Doodhwala/store.html?provider="+encodeURIComponent(store.provider_id);
 $("productBack").href="/Doodhwala/store.html?provider="+encodeURIComponent(store.provider_id);
 $("detailProvider").textContent=store.provider_name||"Local provider";
 $("detailType").textContent=product.milk_type||"Milk";
 $("detailWindow").textContent=store.delivery_from&&store.delivery_to?String(store.delivery_from).slice(0,5)+"–"+String(store.delivery_to).slice(0,5):"Local route";
 $("detailRadius").textContent=(store.service_radius_km||5)+" km";
 $("planLink").href="/Doodhwala/plans.html?provider="+encodeURIComponent(store.provider_id)+"&product="+encodeURIComponent(product.id);
 const addButton=$("addToCart");
 addButton.disabled=!priceValid||store.is_serviceable===false;
 addButton.textContent=!priceValid?"Price unavailable":store.is_serviceable===false?"Unavailable here":"Add to cart";
 const box=$("locationService");
 if(store.is_serviceable===true){box.className="location-service-card good";$("locationServiceTitle").textContent="✓ Delivery available";$("locationServiceCopy").textContent=store.distance_km==null?"Inside the provider's delivery zone.":store.distance_km+" km from you · inside "+store.service_radius_km+" km provider zone."}
 else if(store.is_serviceable===false){box.className="location-service-card bad";$("locationServiceTitle").textContent="Outside this provider's zone";$("locationServiceCopy").textContent="You're "+store.distance_km+" km away, while this provider serves up to "+store.service_radius_km+" km. Change your location to find a closer provider."}
 else {box.className="location-service-card";$("locationServiceTitle").textContent="Check delivery availability";$("locationServiceCopy").textContent="Choose a delivery location to see if this provider serves you."}
}
async function load(){
 setLocationLabel();
 $("addToCart").disabled=true;
 $("minus").disabled=true;
 $("plus").disabled=true;
 if(!providerId||!productId){setState("Milk not found","Choose a product from a local provider.",["/Doodhwala/?view=providers","Explore providers →"]);return}
 if(!window.Doodhwala?.configured){setState("Marketplace unavailable","Supabase is not configured. Check the connection or return to the catalogue.");return}
 const pos=readLocation();
 const milkTransition=window.DoodhwalaMilkTransition;
 milkTransition?.showLoading("Loading this milk…");
 try{
   const client=sup();
   if(!client||typeof client.rpc!=="function"){setState("Marketplace unavailable","The marketplace client did not initialise. Reload this page to try again.");return}
   const {data,error}=await client.rpc("get_provider_storefront",{p_provider_id:providerId,p_latitude:pos?.latitude??null,p_longitude:pos?.longitude??null});
   const row=Array.isArray(data)?data[0]:data;
   if(error||!row||typeof row!=="object"){setState("Product unavailable",error?.message||"This provider is not currently available.",["/Doodhwala/?view=providers","Back to Explore →"]);return}
   store=row;
   const products=Array.isArray(store.products)?store.products:[];
   product=products.find(p=>p&&String(p.id)===String(productId))||null;
   if(!product){setState("Product not available","This milk is no longer active or in stock.",["/Doodhwala/store.html?provider="+encodeURIComponent(providerId),"Back to provider →"]);return}
   $("minus").disabled=false;
   $("plus").disabled=false;
   render();
 }catch(error){
   console.error("Product detail load failed",error);
   setState("Could not load this product","Check your connection and try again. No order or cart changes were made.",["/Doodhwala/product.html?provider="+encodeURIComponent(providerId)+"&product="+encodeURIComponent(productId),"Try again →"]);
 }finally{
   milkTransition?.hideLoading();
 }
}
$("minus").onclick=()=>{if(!store||!product)return;qty=Math.max(1,qty-1);render()};
$("plus").onclick=()=>{if(!store||!product)return;qty=Math.min(100,qty+1);render()};
$("addToCart").onclick=add;
$("addToCart").disabled=true;
load();
