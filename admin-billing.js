/* Owner seller-billing UI adapted from PR #71. No customer-order payment is
 * modified here. UI availability defaults off; all writes still depend on the
 * server's authenticated admin checks, not on this browser guard. */
(function(){
  "use strict";
  const expected={
    "Normal listing":200000,
    "Recommended and in-app advertising":350000
  };
  let sequence=0;
  function conflictMessage(error){
    const message=String(error?.message||"");
    if(message.includes("provider_month_invoice_plan_conflict"))return "This seller already has an invoice for a different plan in that month. Review the existing invoice; no plan change was made.";
    if(message.includes("provider_month_invoice_period_conflict"))return "An invoice for that month already has a different billing period. Review the existing invoice.";
    if(message.includes("active_billing_plan_not_found"))return "The chosen plan is no longer active. Refresh and review it.";
    if(message.includes("payment_amount_mismatch"))return "The amount does not match the invoice. No payment was recorded.";
    if(message.includes("sponsored_pilot_not_enabled"))return "Sponsored placements are not enabled for this pilot.";
    if(message.includes("paid_premium_invoice_required"))return "A manually recorded, eligible premium invoice for the current billing period is required.";
    return "The action could not be completed. Refresh and check the stored records before retrying.";
  }
  function safeMoney(value){const n=Number(value);return Number.isSafeInteger(n)&&n>0?"₹"+(n/100).toLocaleString("en-IN",{maximumFractionDigits:2}):"—"}
  function monthBounds(value){
    const match=/^(\d{4})-(\d{2})$/.exec(value||"");
    if(!match||+match[2]<1||+match[2]>12)return null;
    const year=+match[1],month=+match[2];
    if(year<2000||year>2100)return null;
    const last=new Date(Date.UTC(year,month,0)).getUTCDate();
    return {start:value+"-01",end:value+"-"+String(last).padStart(2,"0")};
  }
  function receiptTime(value){
    const m=/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(String(value||"").trim());
    if(!m)return null;
    const parsed=new Date(m[1]+"-"+m[2]+"-"+m[3]+"T"+m[4]+":"+m[5]+":00+05:30");
    const india=new Date(parsed.getTime()+330*60000);
    if(!Number.isFinite(parsed.getTime())||parsed.getTime()>Date.now()+60000||
       india.getUTCFullYear()!==+m[1]||india.getUTCMonth()+1!==+m[2]||india.getUTCDate()!==+m[3]||
       india.getUTCHours()!==+m[4]||india.getUTCMinutes()!==+m[5])return null;
    return parsed.toISOString();
  }
  function shell(note){return '<div class="admin-section seller-admin"><div class="admin-hero"><div><span class="eyebrow">SEPARATE FROM MILK ORDERS</span><h2>Seller subscriptions</h2><p>Customer milk payments go to sellers. This section concerns only the separate seller fee owed to Doodhwala.</p></div></div>'+
    '<div class="seller-admin-prices"><article><small>NORMAL LISTING</small><b>₹2,000 <span>/ month</span></b><p>App listing</p></article><article><small>RECOMMENDED + IN-APP PROMOTION</small><b>₹3,500 <span>/ month total</span></b><p>Includes the normal listing; not an additional ₹3,500.</p></article></div>'+
    '<div class="admin-card"><h3>Seller billing status</h3><p class="seller-admin-note">'+note+'</p><div id="sellerBillingAdminBody"></div></div></div>'}
  async function load(ctx){
    const request=++sequence,{host,rpc,db,escape:esc,toast,isCurrent}=ctx;
    const current=()=>request===sequence&&isCurrent();
    host.innerHTML=shell("Checking the pilot release switch…");
    let state;
    try{state=await rpc("get_provider_billing_pilot_ui_state",{})}catch(_){state=null}
    if(!current())return;
    if(state?.billing_ui_enabled!==true){
      host.innerHTML=shell("Not enabled. These prices are a preview; no seller plan, invoice, payment or sponsored label is activated here. Schema, manual reconciliation, tax, terms and isolated staging still need review.");
      return;
    }
    let providers,plans,invoices,settings;
    try{
      const result=await Promise.all([
        rpc("admin_list_providers",{p_limit:200}),
        db.from("provider_billing_plans").select("id,name,amount_paise,billing_interval,description,is_active").order("created_at",{ascending:false}).limit(100),
        db.from("provider_subscription_invoices").select("id,provider_id,plan_id,plan_name_snapshot,amount_paise,period_start,period_end,due_date,invoice_number,status,paid_at").order("created_at",{ascending:false}).limit(200),
        rpc("admin_get_provider_billing_settings",{})
      ]);
      if(result[1].error||result[2].error)throw result[1].error||result[2].error;
      providers=Array.isArray(result[0])?result[0]:[];plans=result[1].data||[];invoices=result[2].data||[];settings=result[3]||{};
    }catch(_){if(current())host.innerHTML=shell("Billing could not be loaded. No records were changed. Check the reviewed billing schema and retry.");return}
    if(!current())return;
    const planRows=Object.entries(expected).map(([name,amount])=>{
      const matching=plans.filter(p=>p.name===name);
      return {name,amount,plan:matching.length===1?matching[0]:null,conflict:matching.length>1||matching.some(p=>Number(p.amount_paise)!==amount||p.billing_interval!=="month")};
    });
    const plansSafe=planRows.every(p=>p.plan&&!p.conflict);
    const active=plansSafe?planRows.filter(p=>p.plan.is_active):[];
    const providerById=new Map(providers.map(p=>[p.id,p]));
    const options=providers.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.display_name||p.owner_name||"Seller")+' · '+esc([p.area_name,p.city].filter(Boolean).join(", "))+'</option>').join("");
    const planOptions=active.map(p=>'<option value="'+esc(p.plan.id)+'">'+esc(p.name)+' · '+safeMoney(p.amount)+'/month</option>').join("");
    const planList=planRows.map(row=>'<li><b>'+esc(row.name)+' · '+safeMoney(row.amount)+'</b><span>'+(row.conflict?"Conflict: review before billing":!row.plan?"Not prepared":row.plan.is_active?"Active":"Inactive")+'</span>'+
      (row.plan&&!row.conflict?'<button type="button" data-plan-toggle="'+esc(row.plan.id)+'">'+(row.plan.is_active?"Deactivate":"Activate")+'</button>':"")+'</li>').join("");
    const invoiceRows=invoices.map(i=>{
      const p=providerById.get(i.provider_id)||{};
      const premium=i.plan_name_snapshot==="Recommended and in-app advertising"&&Number(i.amount_paise)===350000;
      return '<tr><td><b>'+esc(i.invoice_number)+'</b><small>'+esc(i.plan_name_snapshot)+'</small></td><td>'+esc(p.display_name||p.owner_name||"Seller unavailable")+'</td><td>'+safeMoney(i.amount_paise)+'</td><td>'+esc(i.period_start)+' – '+esc(i.period_end)+'<small>Due '+esc(i.due_date)+'</small></td><td>'+esc(i.status)+'</td><td>'+
        (i.status==="due"?'<button type="button" data-record-payment="'+esc(i.id)+'">Manually reconcile</button>':"")+
        (premium&&state.sponsored_ui_enabled&&i.status==="paid"?'<button type="button" data-sponsor-enable="'+esc(i.id)+'">Enable sponsored label</button>':"")+
        (premium?'<button type="button" data-sponsor-disable="'+esc(i.id)+'">Remove sponsored label</button>':"")+'</td></tr>';
    }).join("");
    host.innerHTML=shell("Pilot controls are enabled in this environment. Confirm every transfer yourself; this app does not independently verify UPI or bank settlement.");
    const body=document.getElementById("sellerBillingAdminBody");
    body.innerHTML='<div class="seller-admin-grid"><section><h4>Plan catalogue</h4><ul class="seller-admin-plan-list">'+planList+'</ul><p class="seller-admin-note">'+(plansSafe?"Activate only after final terms, tax and release approval.":"Both exact-price plans must be prepared without duplicates before invoicing. Resolve any catalogue mismatch outside this screen.")+'</p></section>'+
      '<section><h4>Doodhwala receiving details</h4><p class="seller-admin-note">These details are for seller fees only. Confirm that the account belongs to Doodhwala before saving.</p><form id="sellerBillingSettingsForm" class="seller-admin-form"><label>Payee name<input id="sellerBillPayee" required maxlength="120" value="'+esc(settings.payee_name||"")+'"></label><label>UPI ID<input id="sellerBillUpi" required maxlength="255" value="'+esc(settings.upi_id||"")+'"></label><label>Instructions<textarea id="sellerBillInstructions" maxlength="1000">'+esc(settings.instructions||"")+'</textarea></label><button type="submit">Save receiving details</button></form></section></div>'+
      '<section class="seller-admin-invoice"><h4>Create a monthly invoice</h4><p class="seller-admin-note">The server derives the price from the active plan. The current pilot draft uses full calendar months; confirm final billing terms before release.</p><form id="sellerBillingInvoiceForm" class="seller-admin-form seller-admin-invoice-form"><label>Seller<select id="sellerBillProvider" required><option value="">Choose seller</option>'+options+'</select></label><label>Plan<select id="sellerBillPlan" required><option value="">Choose active plan</option>'+planOptions+'</select></label><label>Billing month<input type="month" id="sellerBillMonth" required></label><label>Due date<input type="date" id="sellerBillDue" required></label><label>Unique invoice number<input id="sellerBillNumber" minlength="3" maxlength="80" required></label><button type="submit" '+(!active.length||!providers.length?'disabled':'')+'>Create invoice</button></form></section>'+
      '<section class="seller-admin-invoice"><h4>Seller invoices</h4><p class="seller-admin-note">Reconcile only after checking Doodhwala’s receiving account and the exact amount. A reference or UPI-app return is not proof of settlement.</p><div class="table-scroll"><table class="table admin-table seller-admin-table"><thead><tr><th>Invoice</th><th>Seller</th><th>Amount</th><th>Period</th><th>Status</th><th>Action</th></tr></thead><tbody>'+(invoiceRows||'<tr><td colspan="6">No invoices yet.</td></tr>')+'</tbody></table></div></section>';
    const refresh=()=>load(ctx);
    body.querySelectorAll("[data-plan-toggle]").forEach(button=>button.addEventListener("click",async()=>{
      const row=planRows.find(x=>x.plan?.id===button.dataset.planToggle);if(!row||row.conflict)return;
      const enabled=!row.plan.is_active;
      if(!confirm((enabled?"Activate":"Deactivate")+' “'+row.name+'”? Confirm final price, tax, terms and pilot approval first. Existing invoices will not change.'))return;
      button.disabled=true;
      try{await rpc("admin_upsert_provider_billing_plan",{p_plan_id:row.plan.id,p_name:row.name,p_amount_paise:row.amount,p_description:row.plan.description||"",p_is_active:enabled});toast(enabled?"Plan activated.":"Plan deactivated.");await refresh()}
      catch(error){toast(conflictMessage(error),"error");button.disabled=false}
    }));
    document.getElementById("sellerBillingSettingsForm").addEventListener("submit",async event=>{
      event.preventDefault();const form=event.currentTarget,button=form.querySelector('button[type="submit"]');
      const name=document.getElementById("sellerBillPayee").value.trim(),upi=document.getElementById("sellerBillUpi").value.trim(),instructions=document.getElementById("sellerBillInstructions").value.trim();
      if(!/^[A-Za-z0-9._-]{2,200}@[A-Za-z0-9.-]{2,100}$/.test(upi)){toast("Enter a valid Doodhwala UPI ID.","error");return}
      if(!confirm("Have you checked that this receiving account belongs to Doodhwala? Sellers may see these instructions on their invoices."))return;
      button.disabled=true;try{await rpc("admin_set_provider_billing_settings",{p_payee_name:name,p_upi_id:upi,p_instructions:instructions});toast("Receiving details saved.");await refresh()}
      catch(error){toast(conflictMessage(error),"error");button.disabled=false}
    });
    document.getElementById("sellerBillingInvoiceForm").addEventListener("submit",async event=>{
      event.preventDefault();const form=event.currentTarget,button=form.querySelector('button[type="submit"]');
      const providerId=document.getElementById("sellerBillProvider").value,planId=document.getElementById("sellerBillPlan").value,bounds=monthBounds(document.getElementById("sellerBillMonth").value);
      const due=document.getElementById("sellerBillDue").value,number=document.getElementById("sellerBillNumber").value.trim();
      if(!bounds||!providers.some(p=>p.id===providerId)||!active.some(p=>p.plan.id===planId)||!due||number.length<3){toast("Choose a seller, active plan, full billing month, due date and unique invoice number.","error");return}
      if(!confirm("Create or retrieve this seller’s invoice? It is separate from customer milk orders. Review the stored invoice before requesting payment."))return;
      button.disabled=true;
      try{
        const id=await rpc("admin_create_provider_subscription_invoice",{p_provider_id:providerId,p_plan_id:planId,p_period_start:bounds.start,p_period_end:bounds.end,p_due_date:due,p_invoice_number:number,p_notes:""});
        const stored=await db.from("provider_subscription_invoices").select("invoice_number,amount_paise,period_start,period_end,due_date,status").eq("id",id).single();
        if(stored.error||!stored.data)alert("The request returned an invoice ID, but its stored details could not be loaded. Refresh and confirm the stored invoice before asking for payment.");
        else alert("Stored invoice: "+stored.data.invoice_number+"\nAmount: "+safeMoney(stored.data.amount_paise)+"\nPeriod: "+stored.data.period_start+" to "+stored.data.period_end+"\nDue: "+stored.data.due_date+"\nStatus: "+stored.data.status+"\nA retry can return an existing invoice; these are the stored details.");
        await refresh();
      }catch(error){toast(conflictMessage(error),"error");button.disabled=false}
    });
    body.querySelectorAll("[data-record-payment]").forEach(button=>button.addEventListener("click",async()=>{
      const invoice=invoices.find(i=>i.id===button.dataset.recordPayment);if(!invoice||invoice.status!=="due")return;
      const expectedPaise=Number(invoice.amount_paise);
      if(!Number.isSafeInteger(expectedPaise)||expectedPaise<=0){toast("The stored invoice amount is invalid. Review it before recording a payment.","error");return}
      const entered=prompt("After checking Doodhwala’s receiving account, enter the exact amount received in rupees for invoice "+invoice.invoice_number+":");
      if(entered===null)return;
      if(!/^\d+(?:\.\d{1,2})?$/.test(entered.trim())||Math.round(Number(entered)*100)!==expectedPaise){toast("Amount does not match the invoice. No payment was recorded.","error");return}
      const method=prompt("Payment method: manual_upi, bank_transfer, or cash", "manual_upi");if(method===null)return;
      if(!["manual_upi","bank_transfer","cash"].includes(method.trim())){toast("Unsupported payment method.","error");return}
      const reference=prompt("Enter the bank/UPI reference or internal cash receipt reference:");if(reference===null||reference.trim().length<3){toast("A payment reference is required.","error");return}
      const received=prompt("Enter the receipt date and time shown in the account or cash receipt, in India time: YYYY-MM-DD HH:MM");
      if(received===null)return;
      const receivedAt=receiptTime(received);if(!receivedAt){toast("Enter a valid, non-future receipt date and time in India time.","error");return}
      if(!confirm("Have you personally checked Doodhwala’s receiving account or cash receipt and confirmed the exact amount? This is manual reconciliation, not independent bank verification."))return;
      button.disabled=true;try{await rpc("admin_record_provider_subscription_payment",{p_invoice_id:invoice.id,p_amount_paise:expectedPaise,p_method:method.trim(),p_reference:reference.trim(),p_received_at:receivedAt,p_notes:"Manually reconciled by authorized admin"});toast("Manual reconciliation recorded.");await refresh()}
      catch(error){toast(conflictMessage(error),"error");button.disabled=false}
    }));
    body.querySelectorAll("[data-sponsor-enable],[data-sponsor-disable]").forEach(button=>button.addEventListener("click",async()=>{
      const enabled=Boolean(button.dataset.sponsorEnable),id=button.dataset.sponsorEnable||button.dataset.sponsorDisable;
      if(!confirm(enabled?"Enable the text-only 'Recommended by Doodhwala · Sponsored' label for this eligible, manually recorded premium invoice and its current billing period?":"Remove the sponsored label for this invoice?"))return;
      button.disabled=true;try{await rpc("admin_set_sponsored_placement",{p_invoice_id:id,p_enabled:enabled});toast(enabled?"Sponsored placement enabled for the eligible period.":"Sponsored placement removed.");await refresh()}
      catch(error){toast(conflictMessage(error),"error");button.disabled=false}
    }));
  }
  window.loadSellerBillingAdmin=load;
})();
