/* Seller subscription billing UI.
 * Reads the provider-scoped RPC only; never writes an invoice as paid from the browser.
 */
(function(){
  const $=id=>document.getElementById(id);
  const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const rupees=paise=>(Number(paise||0)/100).toLocaleString("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2});
  const day=value=>value?new Date(value+"T00:00:00").toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"}):"—";
  const when=value=>value?new Date(value).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"}):"—";
  let loading=false;
  let lastData=null;
  function setState(message,error=false){const el=$("providerBillingState");if(!el)return;el.textContent=message;el.classList.toggle("error-note",!!error)}
  async function copy(value,label){
    if(!value)return;
    try{
      if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(value);
      else {const input=document.createElement("textarea");input.value=value;input.setAttribute("readonly","");input.style.position="fixed";input.style.opacity="0";document.body.appendChild(input);input.select();const ok=document.execCommand("copy");input.remove();if(!ok)throw new Error("Copy unavailable");}
      setState(label+" copied.");
    }catch(_){setState("Could not copy automatically. Select and copy the value manually.",true)}
  }
  function invoiceCard(invoice,settings){
    const paid=invoice.status==="paid",voided=invoice.status==="void";
    const status=paid?"Paid":voided?"Void":"Payment due";
    const due=invoice.status==="due";
    const amount=rupees(invoice.amount_paise);
    const payee=settings&&settings.upi_id;
    const upiUrl=due&&payee?"upi://pay?"+new URLSearchParams({
      pa:settings.upi_id,pn:settings.payee_name||"Doodhwala",am:(Number(invoice.amount_paise)/100).toFixed(2),
      cu:"INR",tn:"Doodhwala invoice "+invoice.invoice_number
    }).toString():null;
    const reference=Array.isArray(invoice.payments)?invoice.payments.map(p=>'<div class="provider-billing-payment-row"><span>'+escapeHtml(p.method.replace(/_/g," "))+' · '+escapeHtml(p.reference)+'</span><b>'+rupees(p.amount_paise)+'</b><small>Recorded '+escapeHtml(when(p.received_at))+'</small></div>').join(""):"";
    return '<article class="provider-billing-invoice '+(paid?"is-paid":voided?"is-void":"is-due")+'">'+
      '<div class="provider-billing-invoice-top"><div><span class="eyebrow">'+escapeHtml(invoice.plan_name||"Seller subscription")+'</span><h4>'+escapeHtml(invoice.invoice_number)+'</h4></div><span class="provider-billing-status '+(paid?"paid":voided?"void":"due")+'">'+status+'</span></div>'+
      '<div class="provider-billing-amount">'+amount+'</div>'+
      '<div class="provider-billing-dates"><div><small>Billing period</small><b>'+escapeHtml(day(invoice.period_start))+' – '+escapeHtml(day(invoice.period_end))+'</b></div><div><small>Due date</small><b>'+escapeHtml(day(invoice.due_date))+'</b></div></div>'+
      (invoice.notes?'<p class="provider-billing-invoice-note">'+escapeHtml(invoice.notes)+'</p>':"")+
      (due?'<div class="provider-billing-invoice-actions">'+(upiUrl?'<a class="provider-primary provider-billing-pay" href="'+escapeHtml(upiUrl)+'">Open UPI app ↗</a>':"")+'<button type="button" class="secondary" data-copy-invoice="'+escapeHtml(invoice.invoice_number)+'">Copy invoice number</button></div><p class="provider-billing-smallprint">This opens your installed UPI app if supported. It does not confirm payment. Doodhwala records payment only after the owner verifies the incoming transfer.</p>':"")+
      (reference?'<div class="provider-billing-payment-history"><b>Reconciliation history</b>'+reference+'</div>':"")+
      (paid?'<p class="provider-billing-confirmed">Verified and recorded by Doodhwala on '+escapeHtml(when(invoice.paid_at))+'</p>':"")+
    '</article>';
  }
  function render(data){
    const summary=$("providerBillingSummary"),payee=$("providerBillingPayee"),invoices=$("providerBillingInvoices");
    if(!summary||!payee||!invoices)return;
    const settings=data.billing_instructions||null,rows=Array.isArray(data.invoices)?data.invoices:[];
    const due=rows.filter(x=>x.status==="due");
    const total=due.reduce((n,x)=>n+Number(x.amount_paise||0),0);
    const latest=rows.filter(x=>x.status==="due").sort((a,b)=>String(a.due_date).localeCompare(String(b.due_date)))[0];
    summary.innerHTML='<article class="provider-billing-stat"><small>OUTSTANDING</small><b>'+rupees(total)+'</b><span>'+due.length+' invoice'+(due.length===1?"":"s")+' due</span></article>'+
      '<article class="provider-billing-stat"><small>INVOICES RECORDED</small><b>'+rows.length+'</b><span>Monthly subscription statements</span></article>'+
      '<article class="provider-billing-stat"><small>NEXT DUE DATE</small><b>'+escapeHtml(latest?day(latest.due_date):"—")+'</b><span>'+(latest?escapeHtml(latest.invoice_number):"No unpaid invoice")+'</span></article>';
    if(settings&&settings.upi_id){
      payee.innerHTML='<div class="provider-billing-payee-row"><div><small>PAY TO</small><b>'+escapeHtml(settings.payee_name||"Doodhwala")+'</b></div><button type="button" class="secondary" data-copy-billing-value="'+escapeHtml(settings.payee_name||"Doodhwala")+'">Copy name</button></div>'+
        '<div class="provider-billing-upi-row"><div><small>DOODHWALA UPI ID</small><b>'+escapeHtml(settings.upi_id)+'</b></div><button type="button" class="secondary" data-copy-billing-value="'+escapeHtml(settings.upi_id)+'">Copy UPI ID</button></div>'+
        '<p>'+escapeHtml(settings.instructions||"Pay the exact invoice amount and include the invoice number in the payment note.")+'</p>'+
        '<div class="provider-billing-alert"><span>ⓘ</span><div><b>Manual payment verification</b><p>Use the amount and invoice number shown on an invoice. Keep your transaction reference for support. Never share a UPI PIN or OTP with anyone.</p></div></div>';
    }else{
      payee.innerHTML='<div class="provider-billing-empty"><span>₹</span><b>Payment details are being set up</b><p>The owner has not configured Doodhwala’s receiving UPI ID yet. Do not send money to an unverified account.</p></div>';
    }
    invoices.innerHTML=rows.length?rows.sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).map(x=>invoiceCard(x,settings)).join(""):'<div class="provider-billing-empty"><span>✓</span><b>No invoices yet</b><p>Your monthly invoice will appear here once Doodhwala configures your seller plan and creates the billing period.</p></div>';
    invoices.querySelectorAll("[data-copy-invoice]").forEach(b=>b.addEventListener("click",()=>copy(b.dataset.copyInvoice,"Invoice number")));
    payee.querySelectorAll("[data-copy-billing-value]").forEach(b=>b.addEventListener("click",()=>copy(b.dataset.copyBillingValue,b.dataset.copyBillingValue.includes("@")?"UPI ID":"Payee name")));
  }
  async function load(){
    if(loading)return;
    const state=$("providerBillingState");
    if(!state)return;
    if(!window.Doodhwala?.configured){setState("Billing is unavailable because the Supabase client is not configured.",true);$("providerBillingInvoices").innerHTML='<div class="order-empty">Connect the backend to load billing information.</div>';return}
    loading=true;
    const button=$("refreshProviderBilling");if(button){button.disabled=true;button.setAttribute("aria-busy","true")}
    try{
      const {data:userResult,error:userError}=await Doodhwala.supabase.auth.getUser();
      if(userError)throw userError;
      if(!userResult?.user){setState("Sign in with your seller account to view monthly billing.");$("providerBillingSummary").innerHTML="";$("providerBillingPayee").innerHTML='<div class="provider-billing-empty"><b>Seller sign-in required</b><p>Sign in through your provider account before accessing private billing information.</p><a class="provider-primary" href="/Doodhwala/auth.html?return=/Doodhwala/provider.html">Sign in</a></div>';$("providerBillingInvoices").innerHTML="";return}
      const {data,error}=await Doodhwala.supabase.rpc("provider_get_my_billing");
      if(error)throw error;
      if(!data||typeof data!=="object")throw new Error("Billing response was empty.");
      lastData=data;render(data);setState("Billing information updated "+new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})+". Customer order payments remain separate.");
    }catch(err){
      console.error("Provider billing refresh failed",err);
      setState(err?.message==="provider_not_found"?"No linked provider account was found. Complete seller onboarding first.":(err?.message||"Unable to load billing. Please retry."),true);
      if(!lastData){$("providerBillingSummary").innerHTML="";$("providerBillingPayee").innerHTML='<div class="provider-billing-empty"><b>Billing could not load</b><p>Check your connection and retry. No payment status was changed.</p></div>';$("providerBillingInvoices").innerHTML=""}
    }finally{
      loading=false;if(button){button.disabled=false;button.removeAttribute("aria-busy")}
    }
  }
  window.loadProviderBilling=load;
  document.addEventListener("DOMContentLoaded",function(){
    $("refreshProviderBilling")?.addEventListener("click",load);
    if(document.getElementById("view-billing")?.classList.contains("active"))load();
  });
})();
