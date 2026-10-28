/* Seller fees are separate from customer orders. This module does not change
 * invoice status. The pilot UI is unavailable unless the reviewed server-side
 * rollout switch and compatibility checks both say it is enabled. */
(function(){
  "use strict";
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const money=paise=>"₹"+(Number(paise)/100).toLocaleString("en-IN",{minimumFractionDigits:0,maximumFractionDigits:2});
  const date=value=>{
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||"")))return "—";
    const d=new Date(value+"T12:00:00+05:30");
    return Number.isNaN(d.getTime())?"—":d.toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric",timeZone:"Asia/Kolkata"});
  };
  let sequence=0;
  function clear(message){
    const host=$("providerBillingContent"),status=$("providerBillingState");
    if(host)host.replaceChildren();
    if(status)status.textContent=message;
  }
  function card(invoice,settings){
    const amount=Number(invoice.amount_paise);
    if(!Number.isSafeInteger(amount)||amount<=0)return "";
    const due=invoice.status==="due",paid=invoice.status==="paid",voided=invoice.status==="void";
    const state=due?"Payment due":paid?"Manually recorded":voided?"Void":"Status unavailable";
    const upi=String(settings?.upi_id||"");
    const upiValid=/^[A-Za-z0-9._-]{2,200}@[A-Za-z0-9.-]{2,100}$/.test(upi);
    const payLink=due&&upiValid?"upi://pay?"+new URLSearchParams({
      pa:upi,pn:String(settings.payee_name||"Doodhwala"),am:(amount/100).toFixed(2),cu:"INR",
      tn:"Doodhwala invoice "+String(invoice.invoice_number||"")
    }).toString():"";
    return '<article class="seller-invoice">'+
      '<div class="seller-invoice-head"><div><small>'+esc(invoice.plan_name||"Seller plan")+'</small><h4>'+esc(invoice.invoice_number||"Invoice")+'</h4></div><span class="seller-invoice-status '+(paid?"paid":voided?"void":"due")+'">'+state+'</span></div>'+
      '<strong class="seller-invoice-amount">'+money(amount)+'</strong>'+
      '<p>Period: '+esc(date(invoice.period_start))+' – '+esc(date(invoice.period_end))+'<br>Due: '+esc(date(invoice.due_date))+'</p>'+
      (invoice.notes?'<p>'+esc(invoice.notes)+'</p>':"")+
      (due&&payLink?'<a class="provider-primary seller-billing-pay" href="'+esc(payLink)+'">Open UPI app ↗</a>':"")+
      (due?'<p class="seller-billing-small">Opening an app does not confirm a payment. An authorized Doodhwala admin must check the receiving account and record it manually. Never share a PIN or OTP.</p>':"")+
      (paid?'<p class="seller-billing-small">Recorded by Doodhwala after a manual check; this is not independent bank verification.</p>':"")+
    '</article>';
  }
  function render(data){
    const host=$("providerBillingContent");if(!host)return;
    const rows=Array.isArray(data.invoices)?data.invoices:[];
    const settings=data.billing_instructions&&typeof data.billing_instructions==="object"?data.billing_instructions:null;
    const valid=rows.filter(row=>row&&Number.isSafeInteger(Number(row.amount_paise))&&Number(row.amount_paise)>0);
    const payee=settings?.upi_id?'<div class="seller-payee"><small>DOODHWALA RECEIVING DETAILS</small><b>'+esc(settings.payee_name||"Doodhwala")+'</b><span>'+esc(settings.upi_id)+'</span><p>'+esc(settings.instructions||"Use the invoice number as your payment note.")+'</p><p>Confirm the payee independently before sending money. This is separate from customer payments to you.</p></div>':
      '<div class="seller-payee"><b>Payment details not configured</b><p>Do not send money to an unverified account. Contact Doodhwala for help.</p></div>';
    host.innerHTML=payee+'<div class="seller-invoice-list">'+(valid.length?valid.map(row=>card(row,settings)).join(""):'<div class="seller-billing-empty"><b>No seller invoices yet</b><p>No invoice has been issued for this seller account.</p></div>')+'</div>'+
      (valid.length!==rows.length?'<p class="seller-billing-small">Some invoice details could not be displayed. Contact support before making a payment.</p>':"");
  }
  async function load(){
    const request=++sequence;
    clear("Checking seller billing availability…");
    const db=window.Doodhwala?.configured?window.Doodhwala.supabase:null;
    if(!db){clear("Seller billing is not connected. The plan prices above are a preview only.");return}
    try{
      const initial=await db.auth.getUser();
      if(request!==sequence)return;
      const user=initial.data?.user;
      if(initial.error||!user){clear("Sign in with your seller account to check billing. The plan prices above are a preview only.");return}
      const state=await db.rpc("get_provider_billing_pilot_ui_state");
      if(request!==sequence)return;
      if(state.error||state.data?.billing_ui_enabled!==true){clear("Seller billing is not enabled yet. No plan is activated from this page.");return}
      const profile=await db.rpc("provider_get_own_profile");
      if(request!==sequence)return;
      if(profile.error||!profile.data?.id){clear("Complete your seller profile before viewing billing.");return}
      const result=await db.rpc("provider_get_billing_for_dashboard",{p_provider_id:profile.data.id});
      if(request!==sequence)return;
      if(result.error){
        if(String(result.error.message||"").includes("billing_provider_scope_requires_review")){
          clear("This account has more than one seller profile. Contact support before viewing seller billing.");return;
        }
        throw result.error;
      }
      const current=await db.auth.getUser();
      if(request!==sequence)return;
      if(current.error||current.data?.user?.id!==user.id){clear("Your account changed. Reopen seller billing to continue.");return}
      if(!result.data||typeof result.data!=="object")throw new Error("invalid_billing_response");
      render(result.data);
      $("providerBillingState").textContent="Seller invoices are separate from customer milk-order payments.";
    }catch(error){
      if(request!==sequence)return;
      console.warn("Seller billing could not be loaded",error?.code||"unavailable");
      clear("Seller billing could not be loaded. No payment status was changed; please try again or contact support.");
    }
  }
  window.loadProviderBilling=load;
  $("refreshProviderBilling")?.addEventListener("click",load);
  if(window.Doodhwala?.configured&&window.Doodhwala.supabase.auth.onAuthStateChange){
    window.Doodhwala.supabase.auth.onAuthStateChange((event)=>{
      if(event==="SIGNED_IN"||event==="SIGNED_OUT"||event==="USER_UPDATED"){
        ++sequence;clear("Account changed. Reopen seller billing to continue.");
      }
    });
  }
})();
