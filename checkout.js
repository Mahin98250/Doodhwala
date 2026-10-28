const CART_KEY="doodhwala-cart";
const CHECKOUT_KEYS_KEY="doodhwala-checkout-idempotency-v1";
const CHECKOUT_PROGRESS_KEY="doodhwala-checkout-progress-v1";
function readCheckoutStorage(key,fallback){
 if(window.DoodhwalaResilience)return window.DoodhwalaResilience.readObjectStorage(key,fallback);
 try{const value=JSON.parse(localStorage.getItem(key));return value&&typeof value==="object"&&!Array.isArray(value)?value:fallback}catch(_){return fallback}
}
let cart=readCheckoutStorage(CART_KEY,{})||{};
let checkoutKeys=readCheckoutStorage(CHECKOUT_KEYS_KEY,{})||{};
let checkoutProgress=readCheckoutStorage(CHECKOUT_PROGRESS_KEY,null)||null;
const $=id=>document.getElementById(id);
let sessionUser=null;
let savedAddressId=null;
const LOCATION_KEY="doodhwala-customer-location-v1";
function validCoordinates(latitude,longitude){return Number.isFinite(latitude)&&Number.isFinite(longitude)&&latitude>=-90&&latitude<=90&&longitude>=-180&&longitude<=180}
function readCustomerLocation(){try{const v=JSON.parse(localStorage.getItem(LOCATION_KEY)||"null");const latitude=Number(v?.latitude),longitude=Number(v?.longitude);if(v&&validCoordinates(latitude,longitude))return{latitude,longitude,accuracy:Number(v.accuracy)||null,savedAt:v.savedAt||null};}catch(_){}return null}
function syncCheckoutLocation(){const pos=readCustomerLocation();const state=$("checkoutLocationState"),lat=$("addressLatitude"),lng=$("addressLongitude");if(pos){lat.value=pos.latitude;lng.value=pos.longitude;state.textContent="Pinned delivery location is ready";state.style.color="#17603f";return}const latitude=lat.value===""?NaN:Number(lat.value),longitude=lng.value===""?NaN:Number(lng.value);const hasSavedPin=validCoordinates(latitude,longitude);state.textContent=hasSavedPin?"Saved delivery coordinates are ready":"No exact location selected — set it from the location picker";state.style.color=hasSavedPin?"#17603f":"";if(!hasSavedPin){lat.value="";lng.value=""}}


function money(n){return "₹"+Number(n||0).toLocaleString("en-IN",{maximumFractionDigits:2})}
function showError(message){$("checkoutState").textContent=message;$("checkoutState").style.color="#a44c3e"}
function friendlyOrderError(message){const m=String(message||"");const map={provider_order_capacity_full:"This provider is handling the maximum number of active orders right now. Please try another local provider.",provider_daily_capacity_full:"This provider has reached today's milk capacity. Please choose another local provider or try again later.",provider_unavailable:"This provider is no longer available for ordering.",product_unavailable:"One of the selected milk products is no longer available. Refresh the shop and try again.",invalid_cart_quantity:"The selected quantity is not valid.",delivery_location_required:"Set your delivery location before ordering from this provider.",outside_provider_service_area:"This address is outside the provider's delivery area. Choose another nearby provider or address.",idempotency_key_reuse_conflict:"This checkout changed after an earlier attempt. Check Orders before starting another checkout."};return map[m]||m.replace(/^.*?:/,"").replace(/_/g," ")||"Could not place the order."}
function cartEntries(){return Object.values(cart).filter(x=>x.qty>0)}
function grouped(){const groups=new Map();for(const item of cartEntries()){if(!item.providerId||!item.productId)continue;const key=item.providerId;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(item)}return [...groups.entries()]}
function checkoutMilkIcon(){return '<svg viewBox="0 0 64 66" aria-hidden="true"><rect x="4" y="4" width="56" height="58" rx="16" fill="#f7fbf7" stroke="#d8e7db"/><path d="M26 12h12v7l5 7v24c0 3-2 5-5 5H26c-3 0-5-2-5-5V26l5-7Z" fill="#fff" stroke="#17603f" stroke-width="1.7"/><path d="M32 32c-3 4-5 7-5 10a5 5 0 0 0 10 0c0-3-2-6-5-10Z" fill="#17603f"/></svg>'}
function renderItems(){const entries=cartEntries();if(!entries.length){$("providerCount").textContent="0 providers";$("checkoutSubtotal").textContent=money(0);$("checkoutTotal").textContent=money(0);$("checkoutItems").innerHTML='<div class="empty-provider-state"><div class="checkout-empty-icon">'+checkoutMilkIcon()+'</div><h3>Your cart is empty</h3><p>Choose milk from a local provider first.</p><a class="primary checkout-cta" href="/Doodhwala/">Back to shop →</a></div>';return}const valid=entries.filter(x=>x.providerId&&x.productId);const invalid=entries.length-valid.length;if(invalid){$("checkoutState").textContent="Your cart contains older demo items. Please add the milk again after the backend is connected.";$("checkoutState").style.color="#a46a22"}$("providerCount").textContent=grouped().length+" provider"+(grouped().length===1?"":"s");$("checkoutItems").innerHTML=valid.map(x=>'<div class="checkout-line"><div class="checkout-thumb">'+checkoutMilkIcon()+'</div><div><h4>'+escapeHtml(x.milk)+'</h4><p>'+escapeHtml(x.provider)+" · "+money(x.unitPrice||0)+" / L · "+x.qty+" L"+'</p></div><b>'+money((x.unitPrice||0)*x.qty)+'</b></div>').join("");const subtotal=valid.reduce((s,x)=>s+(Number(x.unitPrice)||0)*x.qty,0);$("checkoutSubtotal").textContent=money(subtotal);$("checkoutTotal").textContent=money(subtotal)}
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
  if(checkoutProgress?.userId===sessionUser.id&&["cod","direct_upi"].includes(checkoutProgress.paymentMethod)){
   const savedChoice=document.querySelector('input[name="paymentMethod"][value="'+checkoutProgress.paymentMethod+'"]');
   if(savedChoice)savedChoice.checked=true;
  }
  $("checkoutState").textContent="Signed in as "+(data.user.email||"customer");
  $("checkoutForm").classList.remove("hidden");
  const {data:addresses}=await Doodhwala.supabase.from("addresses").select("*").order("is_default",{ascending:false}).limit(1);
  if(addresses?.[0])fillAddress(addresses[0]);
  renderItems();
  if(!cartEntries().length&&checkoutProgress?.userId===sessionUser.id&&Array.isArray(checkoutProgress.orderIds)&&checkoutProgress.orderIds.length&&
    [checkoutProgress.cartFingerprint,checkoutProgress.pendingCartFingerprint].includes(cartFingerprint())){
   $("checkoutState").textContent="A saved checkout is ready to recover. Select Place order to view it, or check Orders. No new order will be sent.";
  }
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

// Persist recovery keys before sending an order request. If browser storage is
// unavailable, stop rather than risk a new key and a duplicate after a reload.
function writeCheckoutStorage(key,value){
 try{const serialized=JSON.stringify(value);localStorage.setItem(key,serialized);return localStorage.getItem(key)===serialized}catch(_){return false}
}
function readVerifiedCheckoutStorage(key,fallback){
 const raw=localStorage.getItem(key);if(raw===null)return fallback;
 const value=JSON.parse(raw);
 if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("invalid_checkout_storage");
 return value;
}
function validateCheckoutRecovery(keys,progress){
 for(const entry of Object.values(keys)){
  if(!entry||typeof entry!=="object"||Array.isArray(entry)||typeof entry.key!=="string"||entry.key.length<16||entry.key.length>120||
    (entry.userId!=null&&(typeof entry.userId!=="string"||!entry.userId))||
    (entry.confirmedOrderId!=null&&(typeof entry.confirmedOrderId!=="string"||!entry.confirmedOrderId))||
    (entry.cartFingerprint!=null&&typeof entry.cartFingerprint!=="string"))throw new Error("invalid_checkout_key");
 }
 if(progress&&(!Array.isArray(progress.orderIds)||progress.orderIds.some(id=>typeof id!=="string"||!id)||
   typeof progress.userId!=="string"||!progress.userId||typeof progress.cartFingerprint!=="string"||
   (progress.pendingCartFingerprint!=null&&typeof progress.pendingCartFingerprint!=="string")||
   (progress.paymentMethod!=null&&!["cod","direct_upi"].includes(progress.paymentMethod))))throw new Error("invalid_checkout_progress");
 if(progress?.pendingProviderKeys!=null){
  const pending=progress.pendingProviderKeys;
  if(typeof pending!=="object"||Array.isArray(pending))throw new Error("invalid_pending_keys");
  for(const [providerId,key] of Object.entries(pending)){
   if(typeof key!=="string"||keys[providerId]?.key!==key)throw new Error("missing_pending_key");
  }
 }
}
function saveCheckoutKeys(){return writeCheckoutStorage(CHECKOUT_KEYS_KEY,checkoutKeys)}
function cartFingerprint(value=cart){return JSON.stringify(Object.keys(value||{}).sort().map(key=>{const item=value[key]||{};return[key,String(item.providerId||""),String(item.productId||""),Number(item.qty)||0]}))}
function saveCheckoutProgress(){return !!checkoutProgress&&writeCheckoutStorage(CHECKOUT_PROGRESS_KEY,checkoutProgress)}
function checkoutProgressForCurrentCart(){
 const fingerprint=cartFingerprint();
 if(!checkoutProgress||checkoutProgress.userId!==sessionUser?.id||!Array.isArray(checkoutProgress.orderIds)||
   (checkoutProgress.cartFingerprint!==fingerprint&&checkoutProgress.pendingCartFingerprint!==fingerprint)){
  checkoutProgress={userId:sessionUser.id,cartFingerprint:fingerprint,orderIds:[],paymentMethod:null};
 }else if(checkoutProgress.pendingCartFingerprint===fingerprint){
  // The cart write succeeded but the following progress write may have failed.
  checkoutProgress.cartFingerprint=fingerprint;delete checkoutProgress.pendingCartFingerprint;
 }
 return checkoutProgress;
}
function recordCheckoutOrder(orderId){const id=String(orderId);if(!checkoutProgress.orderIds.includes(id))checkoutProgress.orderIds.push(id)}
function clearPendingProviderMarker(providerId){
 if(!checkoutProgress.pendingProviderKeys?.[providerId])return true;
 const previous={...checkoutProgress.pendingProviderKeys};delete checkoutProgress.pendingProviderKeys[providerId];
 if(!Object.keys(checkoutProgress.pendingProviderKeys).length)delete checkoutProgress.pendingProviderKeys;
 if(saveCheckoutProgress())return true;
 checkoutProgress.pendingProviderKeys=previous;return false;
}
function clearResolvedCheckoutKeys(){
 const previous={...checkoutKeys};let changed=false;
 for(const [providerId,entry] of Object.entries(checkoutKeys)){
  if(entry?.userId===sessionUser.id&&entry.confirmedOrderId&&checkoutProgress.orderIds.includes(String(entry.confirmedOrderId))&&
    !cartEntries().some(item=>item.providerId===providerId)){
   if(!clearPendingProviderMarker(providerId)){checkoutKeys=previous;return false}
   delete checkoutKeys[providerId];changed=true;
  }
 }
 if(!changed||saveCheckoutKeys())return true;
 checkoutKeys=previous;return false;
}
function idempotencyKeyForProvider(providerId){
 let entry=checkoutKeys[providerId];
 if(entry?.userId&&entry.userId!==sessionUser.id)throw new Error("This browser has a pending checkout for another account. Sign in to that account to resolve it before ordering from this seller.");
 if(entry?.confirmedOrderId&&!checkoutProgress.orderIds.includes(entry.confirmedOrderId)){
  if(entry.cartFingerprint!==checkoutProgress.cartFingerprint)throw new Error("Previous order "+entry.confirmedOrderId+" needs review. Check Orders before starting a new checkout for this seller.");
  recordCheckoutOrder(entry.confirmedOrderId);
  if(!saveCheckoutProgress())throw new Error("Order "+entry.confirmedOrderId+" was saved, but recovery details could not be updated. Check Orders before retrying.");
 }
 if(!entry||typeof entry.key!=="string")entry=checkoutKeys[providerId]={key:(crypto.randomUUID?.()||String(Date.now())+"-"+Math.random()),cartFingerprint:checkoutProgress.cartFingerprint};
 entry.userId=sessionUser.id;entry.attempted=true;
 if(!saveCheckoutKeys())throw new Error("Checkout needs browser storage to keep a safe retry key. No new order was submitted; check Orders for any earlier attempt.");
 // A second durable record lets us detect if the primary key is later lost.
 checkoutProgress.pendingProviderKeys=checkoutProgress.pendingProviderKeys||{};
 if(checkoutProgress.pendingProviderKeys[providerId]&&checkoutProgress.pendingProviderKeys[providerId]!==entry.key)throw new Error("The earlier request key changed. Check Orders and contact support before retrying.");
 checkoutProgress.pendingProviderKeys[providerId]=entry.key;
 if(!saveCheckoutProgress())throw new Error("Checkout needs browser storage to keep a safe retry key. No new order was submitted; check Orders for any earlier attempt.");
 return entry.key;
}
function finalizeProviderOrder(providerId,orderId){
 // Write each recovery step before discarding the previous one. A failure keeps
 // the original request key rather than silently retrying with a fresh key.
 const entry=checkoutKeys[providerId];entry.confirmedOrderId=String(orderId);
 if(!saveCheckoutKeys())return false;
 recordCheckoutOrder(orderId);
 if(!saveCheckoutProgress())return false;
 // Browsing in another tab can still change the cart while an order request is
 // in flight. Preserve that newer cart rather than overwriting its changes.
 try{if(JSON.stringify(readVerifiedCheckoutStorage(CART_KEY,{}))!==JSON.stringify(cart))return false}catch(_){return false}
 const remaining={...cart};for(const key of Object.keys(remaining)){if(remaining[key]?.providerId===providerId)delete remaining[key]}
 // Record the expected next cart before replacing it, so a crash between the
 // two localStorage writes cannot discard earlier confirmed order IDs.
 checkoutProgress.pendingCartFingerprint=cartFingerprint(remaining);
 if(!saveCheckoutProgress())return false;
 if(!writeCheckoutStorage(CART_KEY,remaining))return false;
 cart=remaining;checkoutProgress.cartFingerprint=checkoutProgress.pendingCartFingerprint;
 delete checkoutProgress.pendingCartFingerprint;
 if(!saveCheckoutProgress())return false;
 if(!clearPendingProviderMarker(providerId))return false;
 delete checkoutKeys[providerId];
 if(!saveCheckoutKeys()){checkoutKeys[providerId]=entry;return false}
 return true;
}
function clearTerminalAttempt(providerId){
 if(!clearPendingProviderMarker(providerId))return false;
 const entry=checkoutKeys[providerId];delete checkoutKeys[providerId];
 if(saveCheckoutKeys())return true;
 checkoutKeys[providerId]=entry;return false;
}
function finishCheckout(paymentMethod){
 if(!clearResolvedCheckoutKeys()){showError("Your order was saved, but recovery details could not be updated. Check Orders before retrying.");return}
 // The completed cart was already persisted as empty. Do not remove its key:
 // another tab might have added new items after the order was finalized.
 const completedOrderIds=[...new Set(checkoutProgress.orderIds.map(String))];
 $("checkoutForm").classList.add("hidden");$("success").classList.remove("hidden");
 $("successText").textContent=(completedOrderIds.length===1?"Order "+completedOrderIds[0]+" has been saved.":"We saved "+completedOrderIds.length+" seller orders from your cart.")+(paymentMethod==="direct_upi"?" Direct UPI selected. Check each order's payment status before paying the seller. Only the seller can confirm receipt after checking their bank/UPI app.":" Cash on Delivery selected. Check each order's payment status; the seller confirms cash collection.");
 $("successOrders").innerHTML=completedOrderIds.map(id=>'<div class="success-order"><b>Order '+escapeHtml(id)+'</b><br><span>Check Orders for the latest status</span></div>').join("");
 if(window.DoodhwalaResilience)window.DoodhwalaResilience.removeItem(CHECKOUT_PROGRESS_KEY);else try{localStorage.removeItem(CHECKOUT_PROGRESS_KEY)}catch(_){}
 checkoutProgress=null;
}

let placingOrder=false;
$("placeOrder").onclick=async()=>{
 if(placingOrder||!sessionUser||!Doodhwala.configured)return;
 placingOrder=true;
 const placeButton=$("placeOrder");
 try{
  // A process-local click guard is not enough: two open tabs can otherwise
  // generate different idempotency keys for the same cart. Fail closed if the
  // browser cannot provide an origin-wide lock.
  if(!navigator.locks||typeof navigator.locks.request!=="function"){
   showError("This browser cannot safely protect checkout across tabs. Use a compatible browser and check Orders for any earlier attempt.");return;
  }
  await navigator.locks.request("doodhwala-checkout-v1",{mode:"exclusive",ifAvailable:true},async lock=>{
  if(!lock){showError("Checkout is already running in another tab. Wait for it to finish and check Orders before retrying.");return}
  let storedCart,storedKeys,storedProgress;
  try{
   storedCart=readVerifiedCheckoutStorage(CART_KEY,{});
   storedKeys=readVerifiedCheckoutStorage(CHECKOUT_KEYS_KEY,{});
   storedProgress=readVerifiedCheckoutStorage(CHECKOUT_PROGRESS_KEY,null);
   validateCheckoutRecovery(storedKeys,storedProgress);
  }catch(_){showError("Checkout recovery data is unavailable or damaged. Check Orders and contact support before starting another order.");return}
  if(JSON.stringify(storedCart)!==JSON.stringify(cart)){
   cart=storedCart;checkoutKeys=storedKeys;checkoutProgress=storedProgress;
   renderItems();showError("Your cart changed in another tab. Review it and check Orders before placing another order.");return;
  }
  // Another tab may have persisted a key after this tab originally loaded.
  checkoutKeys=storedKeys;checkoutProgress=storedProgress;
  if(checkoutProgress?.pendingProviderKeys&&Object.keys(checkoutProgress.pendingProviderKeys).length&&
    (checkoutProgress.userId!==sessionUser.id||
     (checkoutProgress.cartFingerprint!==cartFingerprint()&&checkoutProgress.pendingCartFingerprint!==cartFingerprint()))){
   showError("An earlier checkout is still pending or its cart changed. Check Orders and contact support before starting another order.");return;
  }
  checkoutProgressForCurrentCart();
  if(!saveCheckoutProgress()){showError("Checkout needs browser storage to keep recovery details. No new order was submitted; check Orders for any earlier attempt.");return}
  if(!clearResolvedCheckoutKeys()){showError("Your earlier order was saved, but recovery details could not be updated. Check Orders before retrying.");return}
  if(!cartEntries().length&&checkoutProgress.orderIds.length){finishCheckout(checkoutProgress.paymentMethod);return}
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
  if(cartEntries().some(item=>!item.providerId||!item.productId)){showError("Your cart contains older items that cannot be ordered. Return to the shop and remove or add them again.");return}
  const hasEarlierAttempt=groups.some(([providerId])=>!!checkoutKeys[providerId]?.key);
  // The atomic RPC also checks this on the server. This preflight gives an
  // understandable message on partially migrated staging environments.
  let controlsReadiness;
  try{controlsReadiness=await Doodhwala.supabase.rpc("customer_order_payment_controls_ready")}
  catch(error){controlsReadiness={error}}
  if(controlsReadiness?.error||controlsReadiness?.data?.ready!==true){
   const known=checkoutProgress.orderIds.length?" Confirmed order ID(s): "+checkoutProgress.orderIds.join(", ")+".":"";
   showError("Checkout is temporarily paused while secure payment controls are verified."+known+(hasEarlierAttempt?" An earlier attempt may have created an order; check Orders before retrying.":" No new order was submitted on this attempt.")+" Your cart is preserved.");
   return;
  }
  const paymentMethod=document.querySelector('input[name="paymentMethod"]:checked')?.value==="direct_upi"?"direct_upi":"cod";
  if(checkoutProgress.paymentMethod&&checkoutProgress.paymentMethod!==paymentMethod){showError("A previous order in this checkout used "+checkoutProgress.paymentMethod.toUpperCase()+". Keep the same payment option to finish the remaining orders.");return}
  if(paymentMethod==="direct_upi"){
   for(const [providerId] of groups){
    // An earlier request may already have committed; let the idempotent server
    // recover it even if the seller's availability changed in the meantime.
    if(checkoutKeys[providerId]?.key)continue;
    let readiness;
    try{readiness=await Doodhwala.supabase.rpc("customer_check_provider_direct_upi",{p_provider_id:providerId})}catch(error){readiness={error}}
    if(readiness?.error||readiness?.data!==true){showError("Direct UPI is not set up for every seller in this cart. Choose Cash on Delivery or ask the seller to configure their UPI details.");return}
   }
  }
  if(!checkoutProgress.paymentMethod){checkoutProgress.paymentMethod=paymentMethod;if(!saveCheckoutProgress()){showError("Checkout needs browser storage to save the payment choice. No new order was submitted; check Orders for any earlier attempt.");return}}
  placeButton.disabled=true;placeButton.textContent="Securing your order…";
  const failures=[];
  for(const [providerId,items] of groups){
   const payload=items.map(x=>({product_id:x.productId,quantity:x.qty}));
   let key;
   try{key=idempotencyKeyForProvider(providerId)}catch(error){failures.push({message:error.message,known:true});break}
   const rpcArgs={p_provider_id:providerId,p_address_id:addressId,p_items:payload,p_customer_note:$("orderNote").value.trim()||null,p_idempotency_key:key,p_payment_method:paymentMethod};
   let result;
   try{result=await Doodhwala.supabase.rpc("customer_create_order_with_payment",rpcArgs)}
   catch(error){result={error}}
   if(!result||result.error){failures.push({message:friendlyOrderError(result?.error?.message||""),uncertain:true});continue}
   const order=result.data;
   const validPaymentStatuses=paymentMethod==="direct_upi"?["payment_pending_verification","paid_direct_to_seller"]:["cash_on_delivery","paid_cod"];
   if(!order||typeof order.order_id!=="string"||!order.order_id||order.payment_method!==paymentMethod||typeof order.status!=="string"||!validPaymentStatuses.includes(order.payment_status)){
    failures.push({message:"The server response could not be confirmed.",uncertain:true});continue;
   }
   if(order.status==="cancelled"||order.status==="rejected"){
    const cleared=clearTerminalAttempt(providerId);
    failures.push({message:"Order "+order.order_id+" is already "+order.status+". Check Orders for details."+(cleared?" Your cart is kept if you choose to place a new order.":" The previous request key could not be cleared; contact support before starting another order."),known:true});
    continue;
   }
   if(!["placed","accepted","preparing","ready","out_for_delivery","delivered"].includes(order.status)){
    failures.push({message:"Order "+order.order_id+" has an unrecognized status. Check Orders before retrying.",known:true});continue;
   }
   if(!finalizeProviderOrder(providerId,order.order_id)){
    failures.push({message:"Order "+order.order_id+" exists, but the cart or local recovery details changed. Check Orders before retrying.",known:true});break;
   }
  }
  if(failures.length){
   placeButton.textContent="Retry remaining orders →";
   renderItems();
   const known=checkoutProgress.orderIds.length?" Confirmed order ID(s): "+checkoutProgress.orderIds.join(", ")+".":"";
   const uncertain=failures.some(f=>f.uncertain)?" We could not confirm every order. Check Orders before retrying; the same request key will be reused.":"";
   showError(failures[0].message+known+uncertain+" Remaining cart items are preserved.");
   return;
  }
  finishCheckout(paymentMethod);
  });
 }catch(error){
  console.warn("Checkout submission failed",error);
  showError("We couldn't confirm checkout. Check Orders before retrying; your cart and request key are kept where possible.");
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
