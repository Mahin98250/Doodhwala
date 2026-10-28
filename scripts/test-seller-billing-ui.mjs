import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read=file=>fs.readFileSync(new URL("../"+file,import.meta.url),"utf8");
const providerSource=read("provider-billing.js");
const adminSource=read("admin-billing.js");
const sponsoredSource=read("sponsored-cards.js");
const draft=read("supabase/deferred/20261028130000_billing_pilot_sponsorship.sql");
const worker=read("sw.js");
const page=read("seller-plans.html");
const providerHtml=read("provider.html");
const adminHtml=read("admin.html");

function sellerHarness({enabled=false,missing=false,secondUser="seller-1",billingError=null,invoiceAmount=350000}={}){
  const elements={
    providerBillingState:{textContent:""},
    providerBillingContent:{innerHTML:"",replaceChildren(){this.innerHTML=""}},
    refreshProviderBilling:{addEventListener(_name,callback){this.callback=callback}}
  };
  const calls=[];let reads=0,authChange;
  const db={
    auth:{async getUser(){reads++;return {data:{user:{id:reads===1?"seller-1":secondUser}},error:null}},onAuthStateChange(fn){authChange=fn}},
    async rpc(name,args){
      calls.push({name,args});
      if(name==="get_provider_billing_pilot_ui_state")return missing?{data:null,error:{code:"PGRST202"}}:{data:{billing_ui_enabled:enabled},error:null};
      if(name==="provider_get_own_profile")return {data:{id:"seller-profile-1"},error:null};
      if(name==="provider_get_billing_for_dashboard")return billingError?{data:null,error:{message:billingError}}:{data:{
        billing_instructions:{payee_name:'<img src=x onerror=alert(1)>',upi_id:'business@bank',instructions:'Keep <script> out'},
        invoices:[{id:"one",invoice_number:'INV-<unsafe>',plan_name:'Recommended',amount_paise:invoiceAmount,status:'due',period_start:'2026-10-01',period_end:'2026-10-31',due_date:'2026-11-01'},{id:"two",invoice_number:'INV-PAID',plan_name:'Normal',amount_paise:200000,status:'paid',period_start:'2026-09-01',period_end:'2026-09-30',due_date:'2026-09-30'}]
      },error:null};
      throw new Error("Unexpected RPC "+name);
    }
  };
  const win={Doodhwala:{configured:true,supabase:db}};
  vm.runInNewContext(providerSource,{window:win,document:{getElementById:id=>elements[id]||null},URLSearchParams,Date,Number,String,Array,console:{warn(){}}});
  return {elements,calls,load:()=>win.loadProviderBilling(),authChange:event=>authChange(event)};
}

let h=sellerHarness();await h.load();
assert.match(h.elements.providerBillingState.textContent,/not enabled yet/i);
assert.equal(h.elements.providerBillingContent.innerHTML,"");
assert.deepEqual(h.calls.map(x=>x.name),["get_provider_billing_pilot_ui_state"],"disabled UI must not fetch invoices or instructions");
h=sellerHarness({missing:true});await h.load();
assert.match(h.elements.providerBillingState.textContent,/not enabled yet/i,"missing readiness RPC fails closed");
assert.equal(h.calls.length,1);
h=sellerHarness({enabled:true});await h.load();
assert.deepEqual(h.calls.map(x=>x.name),["get_provider_billing_pilot_ui_state","provider_get_own_profile","provider_get_billing_for_dashboard"]);
assert.equal(h.calls[2].args.p_provider_id,"seller-profile-1","billing is checked against the seller dashboard profile");
assert.match(h.elements.providerBillingContent.innerHTML,/₹3,500/);
assert.match(h.elements.providerBillingContent.innerHTML,/upi:\/\/pay\?/);
assert.match(h.elements.providerBillingContent.innerHTML,/Opening an app does not confirm a payment/);
assert.match(h.elements.providerBillingContent.innerHTML,/not independent bank verification/);
assert.doesNotMatch(h.elements.providerBillingContent.innerHTML,/<img src=x|<script>/i,"untrusted settings are escaped");
assert.match(h.elements.providerBillingContent.innerHTML,/&lt;img/);
h.authChange("SIGNED_OUT");assert.equal(h.elements.providerBillingContent.innerHTML,"","sign-out clears private invoice data");
h=sellerHarness({enabled:true,secondUser:"seller-2"});await h.load();
assert.match(h.elements.providerBillingState.textContent,/account changed/i);
assert.equal(h.elements.providerBillingContent.innerHTML,"","account switches cannot render old billing data");
h=sellerHarness({enabled:true,billingError:"billing_provider_scope_requires_review"});await h.load();
assert.match(h.elements.providerBillingState.textContent,/more than one seller profile/i);
assert.equal(h.elements.providerBillingContent.innerHTML,"");
h=sellerHarness({enabled:true,invoiceAmount:-1});await h.load();
assert.doesNotMatch(h.elements.providerBillingContent.innerHTML,/upi:\/\/pay\?/);
assert.match(h.elements.providerBillingContent.innerHTML,/could not be displayed/i);

async function adminDisabled(state,throws=false){
  const host={innerHTML:""},calls=[];
  const win={};vm.runInNewContext(adminSource,{window:win,document:{},Number,Date,String,Array,Object,Map,console});
  await win.loadSellerBillingAdmin({host,db:{from(){throw new Error("Disabled UI read a table")}},rpc:async(name)=>{calls.push(name);if(throws)throw Error("missing");return state},escape:String,toast(){},isCurrent:()=>true});
  assert.match(host.innerHTML,/Not enabled/);
  assert.match(host.innerHTML,/₹2,000/);assert.match(host.innerHTML,/₹3,500/);
  assert.deepEqual(calls,["get_provider_billing_pilot_ui_state"]);
}
await adminDisabled({billing_ui_enabled:false});await adminDisabled(null,true);
assert.match(adminSource,/admin_create_provider_subscription_invoice/);
assert.match(adminSource,/admin_record_provider_subscription_payment/);
assert.match(adminSource,/personally checked Doodhwala’s receiving account/i);
assert.match(adminSource,/stored details/i,"invoice retries must show the persisted invoice snapshot");
assert.match(adminSource,/provider_month_invoice_plan_conflict/,"different-plan retry is explained");
assert.match(adminSource,/admin_set_sponsored_placement/);
assert.doesNotMatch(providerSource,/admin_record_provider_subscription_payment|\.from\(["']provider_subscription_invoices["']\)/);

for(const file of [page,providerHtml,adminSource]){
  assert.match(file,/₹2,000/);assert.match(file,/₹3,500/);assert.match(file,/total/i);
}
assert.match(page,/Not available for purchase yet/i);
assert.match(page,/Recommended by Doodhwala · Sponsored/);
assert.match(providerHtml,/data-view="billing"/);
assert.match(adminHtml,/data-section="seller-billing"/);
for(const asset of ["seller-plans.html","seller-plans.css?v=20261028.2","provider-billing.js?v=20261028.2","admin-billing.js?v=20261028.2","sponsored-cards.js?v=20261028.2","sponsored-cards.css?v=20261028.2"])assert.ok(worker.includes(asset),asset+" is precached");
assert.match(sponsoredSource,/rpc\("get_sponsored_provider_cards"/);
assert.match(sponsoredSource,/Recommended by Doodhwala · Sponsored/);
assert.match(sponsoredSource,/View milk, prices and delivery details/);
assert.doesNotMatch(sponsoredSource,/localStorage\s*\.|\.sort\([^)]*(rating|sponsored)/i,"sponsored status is not persisted or used to rank sellers");
assert.match(draft,/billing_ui_enabled boolean not null default false/i);
assert.match(draft,/sponsored_ui_enabled boolean not null default false/i);
assert.match(draft,/paid_premium_invoice_required/);
assert.match(draft,/provider_billing_pilot_ready/);
assert.match(draft,/cardinality\(p_provider_ids\)>100/);
assert.match(draft,/at time zone 'Asia\/Kolkata'/i);
console.log("Seller billing UI tests passed: disabled/missing rollout, scoped read, account change, invoice escaping, manual reconciliation copy, disclosed sponsored placement and plan previews.");
