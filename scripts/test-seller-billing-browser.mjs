import { chromium } from "playwright";
import assert from "node:assert/strict";

// Every backend call and account below is synthetic. External network is
// blocked. Never use this script to create real invoices or move money.
const base=process.env.DOODHWALA_BASE_URL||"http://127.0.0.1:4173/Doodhwala/";
const origin=new URL(base).origin;
const stub=`
(function(){
 const seller='30000000-0000-4000-8000-000000000003', other='30000000-0000-4000-8000-000000000004';
 const user={id:'20000000-0000-4000-8000-000000000003',email:'seller@example.invalid',user_metadata:{}};
 const normal={id:'plan-normal',name:'Normal listing',amount_paise:200000,billing_interval:'month',description:'Synthetic normal',is_active:true};
 const premium={id:'plan-premium',name:'Recommended and in-app advertising',amount_paise:350000,billing_interval:'month',description:'Synthetic premium',is_active:true};
 const providers=[{id:seller,display_name:'Synthetic dairy',owner_name:'Test owner',area_name:'Test',city:'Ahmedabad'}];
 const invoice={id:'synthetic-invoice',provider_id:seller,plan_id:premium.id,plan_name_snapshot:premium.name,plan_name:premium.name,amount_paise:350000,period_start:'2026-10-01',period_end:'2026-10-31',due_date:'2026-10-31',invoice_number:'TEST-INV-01',status:'due',created_at:'2026-10-01T00:00:00Z'};
 const invoices=[invoice],plans=[normal,premium];window.__billingEnabled=false;window.__sponsorEnabled=true;window.__showSponsor=false;window.__sponsorExpiry=Date.now()+3600000;window.__calls=[];
 const settings={payee_name:'Synthetic Doodhwala',upi_id:'synthetic@bank',instructions:'Use the invoice number.'};
 function query(table){
  let filter=null;
  const rows=()=>table==='provider_billing_plans'?plans:table==='provider_subscription_invoices'?invoices:[];
  const q={select(){return q},eq(k,v){filter=[k,v];return q},in(){return q},or(){return q},order(){return q},limit(){return q},update(){return q},insert(){return q},upsert(){return q},delete(){return q},
    single(){return Promise.resolve({data:rows().find(x=>!filter||x[filter[0]]===filter[1])||null,error:null})},
    then(ok,fail){return Promise.resolve({data:rows().filter(x=>!filter||x[filter[0]]===filter[1]),error:null}).then(ok,fail)}};return q;
 }
 const channel={on(){return channel},subscribe(cb){if(cb)cb('SUBSCRIBED');return channel}};
 window.Doodhwala={configured:true,supabase:{
  auth:{async getUser(){return {data:{user},error:null}},async getSession(){return {data:{session:{user}},error:null}},onAuthStateChange(fn){window.__authChange=fn;return {data:{subscription:{unsubscribe(){}}}}},async signOut(){return {error:null}}},
  from:query,channel(){return channel},removeChannel(){},
  async rpc(name,args={}){
   window.__calls.push({name,args});
   if(name==='is_current_user_admin')return {data:true,error:null};
   if(name==='get_admin_overview')return {data:{daily_sales:[],provider_sales:[],orders:0,providers:1,customers:0},error:null};
   if(name==='provider_get_dashboard')return {data:{provider:{id:seller,display_name:'Synthetic dairy',owner_name:'Test owner',phone:'9999999999',primary_milk_type:'cow',area_name:'Test',city:'Ahmedabad',pin_code:'380001',service_radius_km:5},products:[],metrics:{},verification_status:'approved'},error:null};
   if(name==='provider_get_own_profile')return {data:{id:seller,accepting_orders:true,acceptance_timeout_minutes:10},error:null};
   if(name==='provider_get_direct_upi_settings')return {data:null,error:null};
   if(name==='get_provider_billing_pilot_ui_state')return {data:{billing_ui_enabled:window.__billingEnabled,sponsored_ui_enabled:window.__billingEnabled&&window.__sponsorEnabled},error:null};
   if(name==='provider_get_billing_for_dashboard')return {data:{billing_instructions:settings,invoices:invoices.map(x=>({...x,plan_name:x.plan_name_snapshot}))},error:null};
   if(name==='admin_list_providers')return {data:providers,error:null};
   if(name==='admin_get_provider_billing_settings')return {data:settings,error:null};
   if(name==='admin_create_provider_subscription_invoice'){
     if(window.__forcePlanConflict)return {data:null,error:{message:'provider_month_invoice_plan_conflict'}};
     const p=plans.find(x=>x.id===args.p_plan_id);const row={id:'synthetic-new-invoice',provider_id:args.p_provider_id,plan_id:p.id,plan_name_snapshot:p.name,amount_paise:p.amount_paise,period_start:args.p_period_start,period_end:args.p_period_end,due_date:args.p_due_date,invoice_number:args.p_invoice_number,status:'due'};invoices.push(row);return {data:row.id,error:null};
   }
   if(name==='admin_record_provider_subscription_payment'){const item=invoices.find(x=>x.id===args.p_invoice_id);item.status='paid';item.paid_at=args.p_received_at;return {data:'synthetic-payment',error:null}}
   if(name==='admin_set_sponsored_placement')return {data:true,error:null};
   if(name==='admin_set_provider_billing_settings'||name==='admin_upsert_provider_billing_plan')return {data:true,error:null};
   if(name==='find_nearby_providers_v3'||name==='find_nearby_providers_v2')return {data:[
     {provider_id:seller,provider_name:'Synthetic dairy',area_name:'Test',city:'Ahmedabad',milk_type:'cow',distance_km:1,is_serviceable:true,products:[]},
     {provider_id:other,provider_name:'Another dairy',area_name:'Test',city:'Ahmedabad',milk_type:'buffalo',distance_km:2,is_serviceable:true,products:[]}
   ],error:null};
   if(name==='get_sponsored_provider_cards'){
     const snapshot=window.__showSponsor?[{provider_id:seller,expires_at:new Date(window.__sponsorExpiry).toISOString()},{provider_id:'ffffffff-ffff-4fff-8fff-ffffffffffff',expires_at:new Date(window.__sponsorExpiry).toISOString()}]:[];
     if(window.__holdSponsor){window.__holdSponsor=false;await new Promise(resolve=>{window.__releaseSponsor=resolve})}
     if(window.__sponsorError)return {data:null,error:{message:'synthetic lookup failure'}};
     return {data:snapshot,error:null};
   }
   return {data:[],error:null};
  }
 }};
})();`;

const browser=await chromium.launch({headless:true});
try{
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:"block"});
  await context.route("**/*",route=>{
   const url=new URL(route.request().url());
   if(url.origin!==origin)return route.abort();
   if(url.pathname==="/Doodhwala/supabase-client.js")return route.fulfill({status:200,contentType:"application/javascript",body:stub});
   return route.continue();
  });
  const page=await context.newPage(),errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.goto(new URL("seller-plans.html",base).href,{waitUntil:"domcontentloaded"});
  assert.match(await page.locator("body").innerText(),/₹2,000/);
  assert.match(await page.locator("body").innerText(),/₹3,500/);
  assert.match(await page.locator("body").innerText(),/Not available for purchase yet/);
  assert.match(await page.locator("body").innerText(),/not ₹2,000 \+ ₹3,500/i);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,"plan preview must not overflow the viewport");

  await page.goto(new URL("provider/",base).href,{waitUntil:"domcontentloaded"});
  await page.waitForSelector("#dashboard:not(.hidden)");
  const sellerNav=width===390?'.provider-mobile-nav [data-view="billing"]':'.provider-nav [data-view="billing"]';
  await page.locator(sellerNav).click();
  await page.waitForFunction(()=>document.querySelector('#providerBillingState')?.textContent.includes('not enabled yet'));
  assert.equal(await page.locator('#providerBillingContent a[href^="upi:"]').count(),0);
  assert.equal(await page.evaluate(()=>window.__calls.some(x=>x.name==='provider_get_billing_for_dashboard')),false,"disabled seller UI must not fetch invoices");
  await page.evaluate(()=>{window.__billingEnabled=true});await page.locator('#refreshProviderBilling').click();
  await page.waitForSelector('#providerBillingContent a[href^="upi:"]');
  assert.match(await page.locator('#providerBillingContent').innerText(),/Opening an app does not confirm a payment/);
  assert.match(await page.locator('#providerBillingContent').innerText(),/₹3,500/);
  await page.evaluate(()=>window.__authChange('SIGNED_OUT'));
  assert.equal(await page.locator('#providerBillingContent').innerText(),'',"sign-out clears seller invoice details");

  await page.goto(new URL("admin/",base).href,{waitUntil:"domcontentloaded"});
  await page.waitForSelector('#adminApp:not(.hidden)');
  if(width===390){await page.locator('#adminMore').click();await page.getByRole('button',{name:'Seller billing'}).last().click()}
  else await page.locator('.admin-side [data-section="seller-billing"]').click();
  await page.waitForFunction(()=>document.querySelector('#adminContent')?.textContent.includes('Not enabled.'));
  assert.equal(await page.locator('#sellerBillingInvoiceForm').count(),0);
  await page.evaluate(()=>{window.__billingEnabled=true});await page.locator('#refreshAdmin').click();
  await page.waitForSelector('#sellerBillingInvoiceForm');
  assert.match(await page.locator('#adminContent').innerText(),/₹3,500/);
  page.on('dialog',async dialog=>{
    const msg=dialog.message();
    if(dialog.type()==='confirm'||dialog.type()==='alert')return dialog.accept();
    if(msg.startsWith('After checking'))return dialog.accept('3500');
    if(msg.startsWith('Payment method'))return dialog.accept('manual_upi');
    if(msg.startsWith('Enter the bank'))return dialog.accept('SYNTHETIC-REF');
    if(msg.startsWith('Enter the receipt'))return dialog.accept('2020-01-01 10:00');
    return dialog.dismiss();
  });
  await page.locator('#sellerBillProvider').selectOption('30000000-0000-4000-8000-000000000003');
  await page.locator('#sellerBillPlan').selectOption('plan-normal');
  await page.locator('#sellerBillMonth').fill('2026-11');
  await page.locator('#sellerBillDue').fill('2026-11-30');
  await page.locator('#sellerBillNumber').fill('SYNTHETIC-NEW-001');
  await page.locator('#sellerBillingInvoiceForm button[type="submit"]').click();
  await page.waitForFunction(()=>window.__calls.some(x=>x.name==='admin_create_provider_subscription_invoice'));
  await page.waitForSelector('[data-record-payment="synthetic-invoice"]');
  await page.locator('[data-record-payment="synthetic-invoice"]').click();
  await page.waitForFunction(()=>window.__calls.some(x=>x.name==='admin_record_provider_subscription_payment'));
  await page.waitForSelector('[data-sponsor-enable="synthetic-invoice"]');
  await page.locator('[data-sponsor-enable="synthetic-invoice"]').click();
  await page.waitForFunction(()=>window.__calls.some(x=>x.name==='admin_set_sponsored_placement'));
  const actions=await page.evaluate(()=>window.__calls);
  const payment=actions.find(x=>x.name==='admin_record_provider_subscription_payment').args;
  assert.equal(payment.p_amount_paise,350000);assert.equal(payment.p_method,'manual_upi');
  assert.equal(payment.p_received_at,'2020-01-01T04:30:00.000Z');
  assert.equal(actions.find(x=>x.name==='admin_set_sponsored_placement').args.p_enabled,true);
  assert.equal(actions.some(x=>/customer_set_order_payment|provider_confirm_direct_upi/.test(x.name)),false,"seller billing must not confirm a customer order");

  await page.goto(base,{waitUntil:"domcontentloaded"});
  await page.waitForSelector('[data-provider-card="30000000-0000-4000-8000-000000000003"]');
  assert.equal(await page.locator('.sponsored-seller-copy').count(),0);
  await page.evaluate(()=>{window.__showSponsor=true;window.dispatchEvent(new Event('doodhwala:providers-updated'))});
  await page.waitForSelector('.sponsored-seller-copy');
  assert.equal(await page.locator('.sponsored-seller-copy').count(),1,"only the returned, already-discovered eligible seller gets a label");
  assert.match(await page.locator('.sponsored-seller-copy').innerText(),/Recommended by Doodhwala · Sponsored/);
  const order=await page.locator('[data-provider-card]').evaluateAll(nodes=>nodes.map(n=>n.dataset.providerCard));
  assert.deepEqual(order,['30000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000004'],"sponsored labels must not change discovery ranking");
  await page.evaluate(()=>{window.__sponsorError=true;window.dispatchEvent(new Event('doodhwala:providers-updated'))});
  await page.waitForFunction(()=>document.querySelectorAll('.sponsored-seller-copy').length===0);
  await page.evaluate(()=>{window.__sponsorError=false;window.__sponsorExpiry=Date.now()+1500;window.dispatchEvent(new Event('doodhwala:providers-updated'))});
  await page.waitForSelector('.sponsored-seller-copy');
  await page.waitForFunction(()=>document.querySelectorAll('.sponsored-seller-copy').length===0,{timeout:5000});
  await page.evaluate(()=>{window.__sponsorExpiry=Date.now()+3600000;window.__holdSponsor=true;window.dispatchEvent(new Event('doodhwala:providers-updated'))});
  await page.waitForFunction(()=>typeof window.__releaseSponsor==='function');
  await page.evaluate(()=>{window.__showSponsor=false;window.dispatchEvent(new Event('doodhwala:providers-updated'))});
  await page.waitForTimeout(150);
  await page.evaluate(()=>window.__releaseSponsor());
  await page.waitForTimeout(150);
  assert.equal(await page.locator('.sponsored-seller-copy').count(),0,"a stale eligible response must not restore a revoked label");
  await page.evaluate(()=>{window.__showSponsor=true;window.dispatchEvent(new Event('doodhwala:providers-updated'))});
  await page.waitForSelector('.sponsored-seller-copy');
  await page.evaluate(()=>window.dispatchEvent(new Event('offline')));
  assert.equal(await page.locator('.sponsored-seller-copy').count(),0,"offline invalidates sponsored labels");
  assert.deepEqual(errors,[],`no uncaught page errors at ${width}px`);
  console.log(`PASS synthetic ${width}px seller plans, disabled gate, manual billing and disclosed sponsored label`);
  await context.close();
 }
}finally{await browser.close()}
