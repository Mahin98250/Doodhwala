const CART_KEY="doodhwala-cart";
const CHECKOUT_KEYS_KEY="doodhwala-checkout-idempotency-v1";
const CHECKOUT_PROGRESS_KEY="doodhwala-checkout-progress-v1";
let cart=window.DoodhwalaResilience?.readObjectStorage(CART_KEY,{})||{};
let checkoutKeys=window.DoodhwalaResilience?.readObjectStorage(CHECKOUT_KEYS_KEY,{})||{};
let checkoutProgress=window.DoodhwalaResilience?.readObjectStorage(CHECKOUT_PROGRESS_KEY,null)||null;
const $=id=>document.getElementById(id);
let sessionUser=null;
let savedAddressId=null;
let appliedPromo=null;
const LOCATION_KEY="doodhwala-customer-location-v1";
function validCoordinates(latitude,longitude){return Number.isFinite(latitude)&&Number.isFinite(longitude)&&latitude>=-90&&latitude<=90&&longitude>=-180&&longitude<=180}
function readCustomerLocation(){try{const v=JSON.parse(localStorage.getItem(LOCATION_KEY)||"null");const latitude=Number(v?.latitude),longitude=Number(v?.longitude);if(v&&validCoordinates(latitude,longitude))return{latitude,longitude,accuracy:Number(v.accuracy)||null,savedAt:v.savedAt||null};}catch(_){}return null}
function syncCheckoutLocation(){const pos=readCustomerLocation();const state=$("checkoutLocationState"),lat=$("addressLatitude"),lng=$("addressLongitude");if(pos){lat.value=pos.latitude;lng.value=pos.longitude;state.textContent="Pinned delivery location is ready";state.style.color="#17603f";return}const latitude=lat.value===""?NaN:Number(lat.value),longitude=lng.value===""?NaN:Number(lng.value);const hasSavedPin=validCoordinates(latitude,longitude);state.textContent=hasSavedPin?"Saved delivery coordinates are ready":"No exact location selected — set it from the location picker";state.style.color=hasSavedPin?"#17603f":"";if(!hasSavedPin){lat.value="";lng.value=""}}


function money(n){return "₹"+Number(n||0).toLocaleString("en-IN",{maximumFractionDigits:2})}
function showError(message){$("checkoutState").textContent=message;$("checkoutState").style.color="#a44c3e"}
function friendlyOrderError(message){const m=String(message||"");const map={provider_order_capacity_full:"This provider is handling the maximum number of active orders right now. Please try another local provider.",provider_daily_capacity_full:"This provider has reached today's milk capacity. Please choose another local provider or try again later.",provider_unavailable:"This provider is no longer available for ordering.",product_unavailable:"One of the selected milk products is no longer available. Refresh the shop and try again.",invalid_cart_quantity:"The selected quantity is not valid.",delivery_location_required:"Set your delivery location before ordering from this provider.",outside_provider_service_area:"This address is outside the provider's delivery area. Choose another nearby provider or address.",idempotency_key_reuse_conflict:"This checkout request changed after it started. Return to the shop and start a fresh checkout."};return map[m]||m.replace(/^.*?:/,"").replace(/_/g," ")||"Could not place the order."}
function cartEntries(){return Object.values(cart).filter(x=>x.qty>0)}
function grouped(){const groups=new Map();for(const item of cartEntries()){if(!item.providerId||!item.productId)continue;const key=item.providerId;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(item)}return [...groups.entries()]}
function checkoutMilkIcon(){return '<svg viewBox="0 0 64 66" aria-hidden="true"><rect x="4" y="4" width="56" height="58" rx="16" fill="#f7fbf7" stroke="#d8e7db"/><path d="M26 12h12v7l5 7v24c0 3-2 5-5 5H26c-3 0-5-2-5-5V26l5-7Z" fill="#fff" stroke="#17603f" stroke-width="1.7"/><path d="M32 32c-3 4-5 7-5 10a5 5 0 0 0 10 0c0-3-2-6-5-10Z" fill="#17603f"/></svg>'}
function renderItems(){const entries=cartEntries();if(!entries.length){$("checkoutItems").innerHTML='<div class="empty-provider-state"><div class="checkout-empty-icon">'+checkoutMilkIcon()+'</div><h3>Your cart is empty</h3><p>Choose milk from a local provider first.</p><a class="primary checkout-cta" href="/Doodhwala/">Back to shop →</a></div>';return}const valid=entries.filter(x=>x.providerId&&x.productId);const invalid=entries.length-valid.length;if(invalid){$("checkoutState").textContent="Your cart contains older demo items. Please add the milk again after the backend is connected.";$("checkoutState").style.color="#a46a22"}$("providerCount").textContent=grouped().length+" provider"+(grouped().length===1?"":"s");$("checkoutItems").innerHTML=valid.map(x=>'<div class="checkout-line"><div class="checkout-thumb">'+checkoutMilkIcon()+'</div><div><h4>'+escapeHtml(x.milk)+'</h4><p>'+escapeHtml(x.provider)+" · "+money(x.unitPrice||0)+" / L · "+x.qty+" L"+'</p></div><b>'+money((x.unitPrice||0)*x.qty)+'</b></div>').join("");const subtotal=valid.reduce((s,x)=>s+(Number(x.unitPrice)||0)*x.qty,0);$("checkoutSubtotal").textContent=money(subtotal);const discount=Number(appliedPromo?.discount_amount||0);const discountRow=$("checkoutDiscountRow");if(discountRow){discountRow.hidden=discount<=0;$("checkoutDiscount").textContent="−"+money(discount)}$("checkoutTotal").textContent=money(Math.max(0,subtotal-discount))}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
async function load(){
 if(!window.Doodhwala?.configured||!window.Doodhwala?.supabase){
  $("checkoutState").textContent="Supabase credentials are not configured yet. The checkout UI is ready, but real orders are disabled.";
  $("checkoutState").style.color="#a46a22";
  return;
 }
 const milkTransition=window.DoodhwalaMilkTransition;
 milkTransition?.showLoading("Preparing your checkout…");
 try{
  const {data,error}=await Doodhwala.supabase.auth.getUser();
  if(error||!data?.user){
   $("checkoutState").textContent="Sign in to continue to checkout";
   $("authGate").classList.remove("hidden");
   renderItems();
   return;
  }
  sessionUser=data.user;
  $("checkoutState").textContent="Signed in as "+(data.user.email||"customer");
  $("checkoutForm").classList.remove("hidden");
  const {data:addresses}=await Doodhwala.supabase.from("addresses").select("*").order("is_default",{ascending:false}).limit(1);
  if(addresses?.[0])fillAddress(addresses[0]);
  renderItems();
 }catch(error){
  console.error("Checkout initialization failed",error);
  showError("We couldn't prepare checkout. Check your connection and try again.");
 }finally{
  milkTransition?.hideLoading();
 }
}
function fillAddress(a){savedAddressId=a.id||null;$("recipient").value=a.recipient_name||sessionUser?.user_metadata?.full_name||"";$("addressPhone").value=a.phone||"";$("addressLine").value=a.address_line||"";$("addressArea").value=a.area_name||"";$("addressCity").value=a.city||"Ahmedabad";$("addressPin").value=a.pin_code||"";$("defaultAddress").checked=Boolean(a.is_default);$("addressLatitude").value=a.latitude??"";$("addressLongitude").value=a.longitude??"";syncCheckoutLocation()}
$("addressForm").onsubmit=async e=>{
 e.preventDefault();if(!Doodhwala.configured||!sessionUser)return;
 const pos=readCustomerLocation();
 const fieldLatitude=$("addressLatitude").value===""?NaN:Number($("addressLatitude").value);
 const fieldLongitude=$("addressLongitude").value===""?NaN:Number($("addressLongitude").value);
 const hasFieldCoordinates=validCoordinates(fieldLatitude,fieldLongitude);
 const row={user_id:sessionUser.id,label:"Home",recipient_name:$("recipient").value.trim(),phone:$("addressPhone").value.replace(/\D/g,""),address_line:$("addressLine").value.trim(),area_name:$("addressArea").value.trim(),city:$("addressCity").value.trim(),pin_code:$("addressPin").value.trim(),latitude:hasFieldCoordinates?fieldLatitude:(pos?.latitude??null),longitude:hasFieldCoordinates?fieldLongitude:(pos?.longitude??null),is_default:$("defaultAddress").checked};
 if(!/^\d{10}$/.test(row.phone)||!/^\d{6}$/.test(row.pin_code)){showError("Enter a valid 10-digit phone and 6-digit PIN.");return}
 const submitButton=$("addressForm").querySelector('button[type="submit"]');
 if(submitButton){submitButton.disabled=true;submitButton.textContent="Saving…"}
 try{
  const result=savedAddressId
    ?await Doodhwala.supabase.from("addresses").update(row).eq("id",savedAddressId).eq("user_id",sessionUser.id).select().single()
    :await Doodhwala.supabase.from("addresses").insert(row).select().single();
  if(result.error)throw result.error;
  if(!result.data?.id)throw new Error("Address could not be confirmed. Please try again.");
  savedAddressId=result.data.id;window.__addressId=savedAddressId;
  $("checkoutState").textContent="Address saved. Ready to place the order.";$("checkoutState").style.color="";
 }catch(error){showError(String(error?.message||"").toLowerCase().includes("duplicate")?"This default address conflicts with another saved address. Change the default selection and retry.":(error?.message||"Could not save your address. Check your connection and retry."))}
 finally{if(submitButton){submitButton.disabled=false;submitButton.textContent="Save address"}}
};

async function applyPromo(){
 const input=$("promoCode"),state=$("promoState"),button=$("applyPromo");if(!input||!state||!button)return;
 const code=input.value.trim().toUpperCase();if(!code){appliedPromo=null;state.textContent="Enter a promo code.";state.style.color="#a44c3e";renderItems();return}
 const groups=grouped();if(groups.length!==1){appliedPromo=null;state.textContent="Promo codes are available when the cart contains one provider.";state.style.color="#a44c3e";renderItems();return}
 const subtotal=cartEntries().filter(x=>x.providerId&&x.productId).filter(x=>x.providerId===groups[0][0]).reduce((s,x)=>s+(Number(x.unitPrice)||0)*x.qty,0);
 if(subtotal<=0){state.textContent="Your cart has no valid items.";state.style.color="#a44c3e";return}
 button.disabled=true;button.textContent="Checking…";state.textContent="Validating offer securely…";state.style.color="";
 try{const {data,error}=await Doodhwala.supabase.rpc("preview_promo_code",{p_promo_code:code,p_subtotal:subtotal});if(error)throw error;if(data?.valid===false)throw new Error(data.reason||"Promo not applicable");appliedPromo={code:data.code||code,discount_amount:Number(data.discount_amount||data.discount||0),discount_label:data.discount_label||"Offer applied"};state.textContent=(appliedPromo.discount_label||"Offer applied")+" · savings "+money(appliedPromo.discount_amount);state.style.color="#17603f";renderItems()}
 catch(err){appliedPromo=null;state.textContent=friendlyPromoError(err.message||err);state.style.color="#a44c3e";renderItems()}
 finally{button.disabled=false;button.textContent="Apply"}
}
function friendlyPromoError(message){const m=String(message||"");if(/customer_limit_reached/.test(m))return"This offer has already been used on your account.";if(/usage_limit_reached/.test(m))return"This offer has reached its usage limit.";if(/min_order_value/.test(m))return"This order does not meet the minimum value for this offer.";if(/invalid_or_expired|promo not applicable/.test(m))return"This promo code is invalid or expired.";return m.replace(/^.*?:/,"").replace(/_/g," ")||"Promo code could not be applied."}
function saveCheckoutKeys(){if(window.DoodhwalaResilience)window.DoodhwalaResilience.writeStorage(CHECKOUT_KEYS_KEY,checkoutKeys);else try{localStorage.setItem(CHECKOUT_KEYS_KEY,JSON.stringify(checkoutKeys))}catch(_){}}
function cartFingerprint(){return JSON.stringify(Object.keys(cart||{}).sort().map(key=>{const item=cart[key]||{};return[key,String(item.providerId||""),String(item.productId||""),Number(item.qty)||0]}))}
function saveCheckoutProgress(){if(!checkoutProgress)return;if(window.DoodhwalaResilience)window.DoodhwalaResilience.writeStorage(CHECKOUT_PROGRESS_KEY,checkoutProgress);else try{localStorage.setItem(CHECKOUT_PROGRESS_KEY,JSON.stringify(checkoutProgress))}catch(_){}}
function checkoutProgressForCurrentCart(){const fingerprint=cartFingerprint();if(!checkoutProgress||checkoutProgress.userId!==sessionUser?.id||checkoutProgress.cartFingerprint!==fingerprint||!Array.isArray(checkoutProgress.orderIds)){checkoutProgress={userId:sessionUser.id,cartFingerprint:fingerprint,orderIds:[],paymentMethod:null};saveCheckoutProgress()}return checkoutProgress}
function recordCheckoutOrder(orderId){if(!checkoutProgress)return;const id=String(orderId);if(!checkoutProgress.orderIds.includes(id))checkoutProgress.orderIds.push(id)}
function idempotencyKeyForProvider(providerId){if(!checkoutKeys[providerId])checkoutKeys[providerId]={key:(crypto.randomUUID?.()||String(Date.now())+"-"+Math.random())};saveCheckoutKeys();return checkoutKeys[providerId].key}
function removeProviderFromCart(providerId){Object.keys(cart).forEach(function(k){if(cart[k]&&cart[k].providerId===providerId)delete cart[k]});if(window.DoodhwalaResilience)window.DoodhwalaResilience.writeStorage(CART_KEY,cart);else try{localStorage.setItem(CART_KEY,JSON.stringify(cart))}catch(_){}delete checkoutKeys[providerId];saveCheckoutKeys()}
$("applyPromo")?.addEventListener("click",applyPromo);
$("promoCode")?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();applyPromo()}});

let placingOrder=false;
$("placeOrder").onclick=async()=>{
 if(placingOrder||!sessionUser||!Doodhwala.configured)return;
 placingOrder=true;
 const placeButton=$("placeOrder");
 try{
  let addressId=window.__addressId;
  if(!addressId){
   let addressResult;
   try{addressResult=await Doodhwala.supabase.from("addresses").select("*").eq("user_id",sessionUser.id).order("is_default",{ascending:false}).limit(1)}
   catch(_){showError("We couldn't verify your saved address. Check your connection and retry.");return}
   if(addressResult.error){showError("We couldn't verify your saved address. Check your connection and retry.");return}
   if(!addressResult.data?.[0]){showError("Save a delivery address first.");return}
   addressId=addressResult.data[0].id;
  }
  const groups=grouped();
  if(!groups.length){showError("Your cart has no backend-linked products. Return to the shop and add the milk again.");return}
  checkoutProgressForCurrentCart();
  // Fail closed before create_order: older/partially migrated databases must never
  // create an order and then fail while persisting its payment choice.
  let controlsReadiness;
  try{controlsReadiness=await Doodhwala.supabase.rpc("customer_order_payment_controls_ready")}
  catch(error){controlsReadiness={error}}
  if(controlsReadiness?.error||controlsReadiness?.data?.ready!==true){
   showError("Checkout is temporarily paused while secure payment controls are being deployed or verified. No order has been placed; your cart is safe. Please try again later.");
   return;
  }
  const paymentMethod=document.querySelector('input[name="paymentMethod"]:checked')?.value==="direct_upi"?"direct_upi":"cod";
  if(checkoutProgress.paymentMethod&&checkoutProgress.paymentMethod!==paymentMethod){showError("A previous order in this checkout used "+checkoutProgress.paymentMethod.toUpperCase()+". Keep the same payment option to finish the remaining orders.");return}
  if(paymentMethod==="direct_upi"){
   for(const [providerId] of groups){
    let readiness;
    try{readiness=await Doodhwala.supabase.rpc("customer_check_provider_direct_upi",{p_provider_id:providerId})}catch(error){readiness={error}}
    if(readiness?.error||readiness?.data!==true){showError("Direct UPI is not set up for every seller in this cart. Choose Cash on Delivery or ask the seller to configure their UPI details.");return}
   }
  }
  if(!checkoutProgress.paymentMethod){checkoutProgress.paymentMethod=paymentMethod;saveCheckoutProgress()}
  placeButton.disabled=true;placeButton.textContent="Securing your order…";
  const orderIds=[],failures=[];
  for(const [providerId,items] of groups){
   const payload=items.map(x=>({product_id:x.productId,quantity:x.qty}));
   const key=idempotencyKeyForProvider(providerId);
   const rpcName=(appliedPromo&&groups.length===1)?"create_order_with_promo":"create_order";
   const rpcArgs={p_provider_id:providerId,p_address_id:addressId,p_items:payload,p_customer_note:$("orderNote").value.trim()||null,p_idempotency_key:key};
   if(rpcName==="create_order_with_promo")rpcArgs.p_promo_code=appliedPromo.code;
   let result;
   try{result=await Doodhwala.supabase.rpc(rpcName,rpcArgs)}
   catch(error){result={error}}
   if(!result||result.error){failures.push(result?.error||new Error("Order request did not return a result."));continue}
   let paymentResult;
   try{paymentResult=await Doodhwala.supabase.rpc("customer_set_order_payment_method",{p_order_id:result.data,p_method:paymentMethod})}
   catch(error){paymentResult={error}}
   if(paymentResult?.error){failures.push(paymentResult.error);continue}
   recordCheckoutOrder(result.data);
   orderIds.push(result.data);
   removeProviderFromCart(providerId);
   checkoutProgress.cartFingerprint=cartFingerprint();
   saveCheckoutProgress();
  }
  if(failures.length){
   placeButton.textContent="Retry remaining orders →";
   renderItems();
   const first=failures[0]?.message||"Some provider orders could not be completed.";
   if(checkoutProgress?.orderIds?.length){showError("Some orders are already safely placed. Completed order ID(s): "+checkoutProgress.orderIds.join(", ")+". Retry the remaining orders — duplicate orders are prevented.")}
   else showError(friendlyOrderError(first));
   return;
  }
  if(window.DoodhwalaResilience)window.DoodhwalaResilience.removeItem(CART_KEY);else try{localStorage.removeItem(CART_KEY)}catch(_){}
  checkoutKeys={};saveCheckoutKeys();
  const completedOrderIds=[...new Set((checkoutProgress?.orderIds||orderIds).map(String))];
  $("checkoutForm").classList.add("hidden");$("success").classList.remove("hidden");
  $("successText").textContent=(completedOrderIds.length===1?"Order "+completedOrderIds[0]+" has been created.":"We created "+completedOrderIds.length+" provider orders from your cart.")+(paymentMethod==="direct_upi"?" Direct UPI selected: open your order to pay the seller; payment remains pending until the seller checks their bank/UPI app.":" Cash on Delivery selected. Pay the seller when the milk arrives.");
  $("successOrders").innerHTML=completedOrderIds.map(id=>'<div class="success-order"><b>Order '+escapeHtml(id)+'</b><br><span>Placed • awaiting provider acceptance</span></div>').join("");
  if(window.DoodhwalaResilience)window.DoodhwalaResilience.removeItem(CHECKOUT_PROGRESS_KEY);else try{localStorage.removeItem(CHECKOUT_PROGRESS_KEY)}catch(_){}
  checkoutProgress=null;
 }catch(error){
  console.warn("Checkout submission failed",error);
  showError("We couldn't finish checkout because of a connection problem. Your cart is kept safe — please retry.");
  placeButton.textContent="Retry order →";
 }finally{
  placeButton.disabled=false;
  placingOrder=false;
 }
};

load();
syncCheckoutLocation();
window.addEventListener("pageshow",syncCheckoutLocation);
window.addEventListener("storage",syncCheckoutLocation);
