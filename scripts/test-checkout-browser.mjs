import { chromium } from "playwright";
import assert from 'node:assert/strict';

// All backend calls below are synthetic. Never submit test orders to a real project.
const base=process.env.DOODHWALA_BASE_URL || 'http://127.0.0.1:4173/Doodhwala/';
const origin=new URL(base).origin;
const stub = `
(function(){
 const user={id:'synthetic-customer-1',email:'synthetic@example.invalid',user_metadata:{}};
 const address={id:'synthetic-address-1',user_id:user.id,recipient_name:'Synthetic Customer',phone:'9999999999',address_line:'Synthetic lane',area_name:'Test',city:'Ahmedabad',pin_code:'380001',is_default:true};
 const response=(name,args)=>{
  const calls=JSON.parse(localStorage.getItem('__test_calls')||'[]'); calls.push({name,args});localStorage.setItem('__test_calls',JSON.stringify(calls));
  if(name==='customer_order_payment_controls_ready')return {data:{ready:true},error:null};
  if(name==='customer_check_provider_direct_upi')return {data:true,error:null};
  if(name==='customer_create_order_with_payment'){
   const orders=JSON.parse(localStorage.getItem('__test_server_orders')||'{}');let order=orders[args.p_idempotency_key];
   if(!order){order={order_id:'synthetic-order-1',status:'placed',payment_method:args.p_payment_method,payment_status:args.p_payment_method==='cod'?'cash_on_delivery':'payment_pending_verification'};orders[args.p_idempotency_key]=order;localStorage.setItem('__test_server_orders',JSON.stringify(orders))}
   if(localStorage.getItem('__test_lost_response')==='1'){localStorage.setItem('__test_lost_response','0');throw new Error('Synthetic lost response after commit')}
   return {data:order,error:null};
  }
  return {data:null,error:null};
 };
 window.Doodhwala={configured:true,supabase:{
  auth:{async getUser(){return {data:{user},error:null}},async getSession(){return {data:{session:{user}},error:null}},onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}},async signOut(){return {error:null}}},
  from(table){const rows=table==='addresses'?[address]:[];const query={select(){return this},eq(){return this},in(){return this},order(){return this},limit(){return this},update(){return this},insert(){return this},single(){return Promise.resolve({data:address,error:null})},then(ok,fail){return Promise.resolve({data:rows,error:null}).then(ok,fail)}};return query},
  async rpc(name,args){
   if(name==='customer_create_order_with_payment' && window.__test_hold) await new Promise(resolve=>{window.__test_release=resolve});
   return response(name,args);
  },
  channel(){const chan={on(){return chan},subscribe(cb){if(cb)cb('SUBSCRIBED');return chan}};return chan}
 }};
})();`;
const browser=await chromium.launch({headless:true});
try{
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});
  await context.addInitScript(() => {
   if(!localStorage.getItem('__test_seeded')){
    localStorage.clear();localStorage.setItem('__test_seeded','1');
    localStorage.setItem('doodhwala-cart',JSON.stringify({'seller-1:product-1':{providerId:'seller-1',productId:'product-1',milk:'Cow milk',provider:'Synthetic seller',unitPrice:50,qty:2}}));
   }
  });
  const page=await context.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await context.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.origin!==origin)return route.abort();
   if(url.pathname==='/Doodhwala/supabase-client.js')return route.fulfill({status:200,contentType:'application/javascript',body:stub});
   return route.continue();
  });
  const response=await page.goto(new URL('checkout/',base).href,{waitUntil:'domcontentloaded'});assert.ok(response.ok());
  await page.waitForSelector('#checkoutForm:not(.hidden)');
  assert.match(await page.locator('body').innerText(),/Promo codes are paused/);
  if(width===390){
   await page.locator('input[value="direct_upi"]').check();
   await page.evaluate(()=>localStorage.setItem('__test_lost_response','1'));
   await page.locator('#placeOrder').click();
   await page.waitForFunction(()=>document.querySelector('#checkoutState').textContent.includes('Check Orders'));
   assert.equal(await page.locator('#success').evaluate(el=>el.classList.contains('hidden')),true);
   const key=await page.evaluate(()=>JSON.parse(localStorage.getItem('doodhwala-checkout-idempotency-v1'))['seller-1'].key);
   await page.reload({waitUntil:'domcontentloaded'});await page.waitForSelector('#checkoutForm:not(.hidden)');
   assert.equal(await page.locator('input[value="direct_upi"]').isChecked(),true,'the earlier payment choice is restored');
   await page.locator('#placeOrder').click();
   await page.waitForSelector('#success:not(.hidden)');
   const result=await page.locator('#successText').innerText();assert.match(result,/Check each order's payment status before paying/);assert.match(result,/Only the seller can confirm receipt/);
   const calls=await page.evaluate(()=>JSON.parse(localStorage.getItem('__test_calls')));const createCalls=calls.filter(x=>x.name==='customer_create_order_with_payment');
   assert.equal(createCalls.length,2);assert.equal(createCalls[0].args.p_idempotency_key,key);assert.equal(createCalls[1].args.p_idempotency_key,key);
   assert.equal(await page.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem('__test_server_orders'))).length),1);
  }else{
   const peer=await context.newPage();peer.on('pageerror',error=>errors.push(error.message));
   await peer.goto(new URL('checkout/',base).href,{waitUntil:'domcontentloaded'});await peer.waitForSelector('#checkoutForm:not(.hidden)');
   await page.evaluate(()=>{window.__test_hold=true});
   await page.locator('#placeOrder').click();
   await page.waitForFunction(()=>typeof window.__test_release==='function');
   await peer.locator('#placeOrder').click();
   await peer.waitForFunction(()=>document.querySelector('#checkoutState').textContent.includes('already running in another tab'));
   assert.match(await peer.locator('#checkoutState').innerText(),/already running in another tab/);
   await page.evaluate(()=>window.__test_release());await page.waitForSelector('#success:not(.hidden)');
   assert.match(await page.locator('#successText').innerText(),/Cash on Delivery selected/);
   await peer.locator('#placeOrder').click();
   await peer.waitForFunction(()=>document.querySelector('#checkoutState').textContent.includes('cart changed in another tab'));
   assert.match(await peer.locator('#checkoutState').innerText(),/cart changed in another tab/);
   const calls=await page.evaluate(()=>JSON.parse(localStorage.getItem('__test_calls')));const createCalls=calls.filter(x=>x.name==='customer_create_order_with_payment');
   assert.equal(createCalls.length,1);assert.equal(createCalls[0].args.p_payment_method,'cod');
   await peer.close();
  }
  assert.equal(await page.locator('#checkout10xPromo').count(),0,'legacy promo interceptor must not mount');
  assert.deepEqual(errors,[],`no uncaught page errors at ${width}px`);
  console.log(`PASS synthetic checkout at ${width}px: ${width===390?'UPI lost-response reload, same key and one order':'COD cross-tab lock and one order'}; promo paused`);
  await context.close();
 }
}finally{await browser.close()}
