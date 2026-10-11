/* Doodhwala customer marketplace 10X: personalized home desk + realtime alerts. */
(function(){
  const api=window.Doodhwala?.supabase;
  if(!api)return;
  const BASE="/Dudh-Wallah/";
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const money=v=>"₹"+Number(v||0).toLocaleString("en-IN",{maximumFractionDigits:2});

  function styles(){
    if(document.getElementById("customerMarket10xStyles"))return;
    const s=document.createElement("style");s.id="customerMarket10xStyles";
    s.textContent=`
      .d10x-desk{max-width:1200px;margin:8px auto 0;padding:8px 24px 0;animation:d10x-appear .45s ease both}
      @keyframes d10x-appear{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
      .d10x-desk-inner{border:1px solid #d9e5db;background:linear-gradient(135deg,#fbfdfb,#eef6f0);border-radius:24px;padding:18px;box-shadow:0 14px 36px rgba(22,59,37,.07)}
      .d10x-brand-row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding-bottom:13px;border-bottom:1px solid #e1ebe3}
      .d10x-brand{display:flex;align-items:center;gap:9px;min-width:0}.d10x-brand img{width:35px;height:35px;border-radius:11px;box-shadow:0 5px 12px rgba(20,65,37,.12)}
      .d10x-brand-copy{min-width:0}.d10x-brand-copy small{display:block;font-size:7px;font-weight:900;letter-spacing:.15em;color:#758279}.d10x-brand-copy b{display:block;margin-top:2px;font:800 14px Manrope,sans-serif;color:#183b28;letter-spacing:-.035em}.d10x-brand-copy em{font-style:normal;color:#32734c}
      .d10x-session-pill{display:inline-flex;align-items:center;gap:6px;flex-shrink:0;border:1px solid #d4e5d8;border-radius:999px;padding:6px 9px;background:#fff;color:#426b4f;font-size:7px;font-weight:900;letter-spacing:.05em;white-space:nowrap}.d10x-session-pill i{width:6px;height:6px;border-radius:50%;background:#38985b;box-shadow:0 0 0 3px rgba(56,152,91,.1)}
      .d10x-desk-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;padding-top:14px}.d10x-desk-head small{display:block;font-size:8px;font-weight:900;letter-spacing:.15em;color:#728078}.d10x-desk-head h2{margin:4px 0 0;font:800 22px Manrope,sans-serif;color:#193d29;letter-spacing:-.04em}.d10x-desk-head p{margin:5px 0 0;color:#6f7b72;font-size:9px;line-height:1.5}
      .d10x-desk-link{border:1px solid #cfdcd2;background:#fff;color:#17603f;border-radius:11px;padding:10px 12px;font-size:8px;font-weight:900;white-space:nowrap;transition:transform .18s,box-shadow .18s}.d10x-desk-link:hover{transform:translateY(-1px);box-shadow:0 6px 14px rgba(30,70,43,.08)}
      .d10x-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:14px}.d10x-stat{background:#fff;border:1px solid #e3eae4;border-radius:14px;padding:11px;transition:transform .18s,border-color .18s}.d10x-stat:hover{transform:translateY(-2px);border-color:#cadace}.d10x-stat span{display:block;color:#7a867e;font-size:7px;font-weight:900;letter-spacing:.1em}.d10x-stat b{display:block;margin-top:5px;font:800 19px Manrope,sans-serif;color:#1d3f2a}.d10x-stat small{display:block;margin-top:3px;color:#8a958e;font-size:7px;line-height:1.4}
      .d10x-focus{margin-top:10px;background:#fff;border:1px solid #e0e9e1;border-radius:15px;padding:13px;display:flex;align-items:center;justify-content:space-between;gap:12px}.d10x-focus-copy{min-width:0}.d10x-focus-copy b{display:flex;align-items:center;gap:7px;font-size:10px;color:#1a3423}.d10x-focus-copy span{display:block;margin-top:4px;color:#718078;font-size:8px;line-height:1.5}.d10x-live-dot{width:7px;height:7px;border-radius:50%;background:#32a361;box-shadow:0 0 0 3px #e3f4e9;flex:0 0 7px}
      .d10x-focus-actions{display:flex;gap:6px;flex-wrap:wrap}.d10x-btn{border:0;border-radius:10px;padding:9px 11px;font-size:8px;font-weight:900;background:#17221a;color:#fff;white-space:nowrap;transition:transform .16s,background .16s}.d10x-btn:hover{background:#28583c;transform:translateY(-1px)}.d10x-btn.secondary{border:1px solid #d7e1d8;background:#fff;color:#17603f}.d10x-btn svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
      .d10x-progress{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-top:11px;padding:12px;background:#fff;border:1px solid #e3eae4;border-radius:13px}.d10x-step{position:relative;display:grid;grid-template-columns:14px 1fr;gap:6px;align-items:center;color:#96a198;min-width:0}.d10x-step:after{content:"";position:absolute;left:17px;right:-7px;top:6px;height:1px;background:#e3eae4}.d10x-step:last-child:after{display:none}.d10x-step i{position:relative;z-index:1;display:block;width:12px;height:12px;border:2px solid #dce5de;border-radius:50%;background:#fff}.d10x-step b{min-width:0;font-size:7px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.d10x-step.done{color:#236542}.d10x-step.done i{background:#2c8050;border-color:#2c8050;box-shadow:inset 0 0 0 2px #fff}.d10x-step.current{color:#173e29}.d10x-step.current i{border-color:#2c8050;box-shadow:0 0 0 3px #e4f2e8}.d10x-bell{position:relative;width:38px;height:38px;border:1px solid #d5dfd7;background:#fff;border-radius:11px;color:#17603f;display:inline-grid;place-items:center;margin-left:2px;cursor:pointer;transition:background .18s,border-color .18s}.d10x-bell:hover{background:#f0f7f2;border-color:#bfd3c4}.d10x-bell svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round}.d10x-bell i{position:absolute;right:4px;top:4px;width:7px;height:7px;border-radius:50%;background:#e4b65c;border:2px solid #fff;display:none}.d10x-bell i.show{display:block}
      @media(max-width:760px){.d10x-desk{padding:7px 14px 0}.d10x-desk-inner{padding:13px;border-radius:20px}.d10x-brand-row{align-items:flex-start}.d10x-brand img{width:31px;height:31px}.d10x-brand-copy b{font-size:12px}.d10x-session-pill{font-size:6px;padding:6px 7px}.d10x-desk-head{display:grid;gap:10px}.d10x-desk-head h2{font-size:19px}.d10x-desk-link{width:max-content}.d10x-stats{grid-template-columns:1fr 1fr;gap:7px}.d10x-focus{align-items:flex-start;flex-direction:column}.d10x-focus-actions{width:100%}.d10x-btn{flex:1}.d10x-progress{padding:10px 8px;gap:3px}.d10x-step{grid-template-columns:11px 1fr;gap:4px}.d10x-step:after{left:14px;right:-3px}.d10x-step b{font-size:6px}}
    `;
    document.head.appendChild(s);
  }

  async function currentUser(){
    const {data}=await api.auth.getUser();
    return data?.user||null;
  }

  async function loadSnapshot(){
    const user=await currentUser();
    if(!user)return null;
    const [orders,subs,favs,notes]=await Promise.all([
      api.from("orders").select("id,status,total,created_at,provider_profiles(display_name)").eq("customer_id",user.id).order("created_at",{ascending:false}).limit(6),
      api.from("milk_subscriptions").select("id,status,quantity_litres,delivery_time").eq("customer_id",user.id).in("status",["active","paused"]).limit(50),
      api.from("customer_favorites").select("provider_id,product_id").eq("customer_id",user.id).limit(100),
      api.from("customer_notifications").select("id,is_read").eq("customer_id",user.id).limit(50)
    ]);
    if(orders.error)throw orders.error;
    if(subs.error)throw subs.error;
    if(favs.error)throw favs.error;
    if(notes.error)throw notes.error;
    const active=orders.data?.find(o=>["placed","accepted","preparing","ready","out_for_delivery"].includes(o.status));
    return {user,orders:orders.data||[],subs:subs.data||[],favs:favs.data||[],unread:(notes.data||[]).filter(n=>!n.is_read).length,active};
  }

  async function syncLegacyFavorites(){
    const user=await currentUser();
    if(!user||!window.Doodhwala10X?.loadFavorites)return;
    let local=[];
    try{local=JSON.parse(localStorage.getItem("doodhwala-favorites")||"[]")}catch(_){}
    local=Array.isArray(local)?local.filter(Boolean):[];
    const remote=await window.Doodhwala10X.loadFavorites();
    const remoteProviders=(remote||[]).filter(x=>x.provider_id).map(x=>String(x.provider_id));
    for(const id of local){
      if(!remoteProviders.includes(String(id))){
        try{await window.Doodhwala10X.toggleFavorite("provider",id)}catch(_){}
      }
    }
    const merged=[...new Set(local.concat(remoteProviders))];
    localStorage.setItem("doodhwala-favorites",JSON.stringify(merged));
    try{window.loadRemoteProvidersFromSaved?.()}catch(_){}
  }

  function openAlerts(){
    const launcher=document.querySelector(".doodhwala-10x-launcher");
    if(!launcher)return;
    if(!document.querySelector(".doodhwala-10x-panel.open"))launcher.click();
    setTimeout(()=>document.querySelector('.doodhwala-10x-panel .d10-tab[data-tab="notifications"]')?.click(),30);
  }

  function updateBell(unread){
    const bell=document.querySelector(".d10x-bell");
    bell?.querySelector("i")?.classList.toggle("show",Number(unread)>0);
    if(bell)bell.setAttribute("aria-label",Number(unread)>0?"Open notifications":"Open notifications");
  }

  function renderSidebarDesk(snapshot){
    const status=document.getElementById("sidebar10xStatus");
    const title=document.getElementById("sidebar10xOrderTitle");
    const meta=document.getElementById("sidebar10xOrderMeta");
    const action=document.getElementById("sidebar10xAction");
    if(!status||!title||!meta||!action)return;
    const active=snapshot?.active;
    window.doodhwalaCurrentOrderId=active?.id?String(active.id):"";
    status.textContent=active?"CURRENT":"SYNCED";
    status.classList.toggle("is-live",!!active);
    title.textContent=active?"Order #"+String(active.id).slice(0,8).toUpperCase():(snapshot?.orders?.length?"No active delivery":"No orders yet");
    meta.textContent=active?String(active.status||"placed").replace(/_/g," ")+" · "+(active.provider_profiles?.display_name||"Local provider"):(snapshot?.orders?.length?"Your latest order is in Order Centre.":"Your live order status will appear here.");
    action.href=BASE+"orders.html";
    action.innerHTML='Open order centre <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 5l7 7-7 7"/></svg>';
  }

  function renderOrderProgress(status){
    const steps=[["Placed",0],["Accepted",1],["Preparing",2],["On the way",3]];
    const current=({placed:0,accepted:1,preparing:2,ready:2,out_for_delivery:3})[String(status||"placed").toLowerCase()]??0;
    return '<div class="d10x-progress" aria-label="Order progress">'+steps.map(([label,index])=>'<div class="d10x-step '+(index<current?"done":index===current?"current":"")+'"><i></i><b>'+label+'</b></div>').join("")+'</div>';
  }

  function renderDesk(snapshot){
    if(!snapshot)return;
    styles();
    const hero=document.querySelector(".hero");
    renderSidebarDesk(snapshot);
    if(!hero||document.querySelector(".d10x-desk"))return;
    const active=snapshot.active;
    const activeText=active
      ? (String(active.status||"").replace(/_/g," ")+" · "+(active.provider_profiles?.display_name||"Local provider"))
      : "No active delivery right now";
    const recent=snapshot.orders?.find(o=>o.status==="delivered")||snapshot.orders?.[0];
    const progress=active?renderOrderProgress(active.status):"";
    const section=document.createElement("section");section.className="d10x-desk";section.innerHTML=
      '<div class="d10x-desk-inner"><div class="d10x-brand-row"><div class="d10x-brand"><img src="/Dudh-Wallah/assets/logo.svg" alt=""><div class="d10x-brand-copy"><small>YOUR PERSONAL DELIVERY DESK</small><b>Doodhwala <em>10X</em></b></div></div><span class="d10x-session-pill"><i></i> ACCOUNT SYNCED</span></div>'+
      '<div class="d10x-desk-head"><div><small>YOUR MILK DESK</small><h2>Everything important, one glance.</h2><p>Orders, recurring plans, saved sellers and alerts — all in one place.</p></div><button class="d10x-desk-link" id="d10xOpenOrders">Open order centre →</button></div>'+
      '<div class="d10x-stats"><div class="d10x-stat"><span>CURRENT ORDER</span><b>'+(active?"1":"0")+'</b><small>'+esc(active?String(active.status).replace(/_/g," "):"Nothing active")+'</small></div><div class="d10x-stat"><span>DELIVERY PLANS</span><b>'+snapshot.subs.length+'</b><small>Active or paused</small></div><div class="d10x-stat"><span>SAVED</span><b>'+snapshot.favs.filter(x=>x.provider_id).length+'</b><small>Providers & products</small></div><div class="d10x-stat"><span>ALERTS</span><b>'+snapshot.unread+'</b><small>Unread notifications</small></div></div>'+
      '<div class="d10x-focus"><div class="d10x-focus-copy"><b>'+(active?'<i class="d10x-live-dot"></i> Your delivery is in progress':"Ready for your next order")+'</b><span>'+esc(activeText)+(recent?(" · Latest total "+money(recent.total)):"")+'</span></div><div class="d10x-focus-actions">'+
      (active?'<button class="d10x-btn" id="d10xTrack"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-5.2 7-12a7 7 0 1 0-14 0c0 6.8 7 12 7 12Z"/><circle cx="12" cy="9" r="2.2"/></svg> Track live</button>':"")+
      (recent?'<button class="d10x-btn secondary" id="d10xReorder">↻ Reorder</button>':"")+
      '<button class="d10x-btn secondary" id="d10xAlerts"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg> Alerts</button></div></div>'+
      progress+'</div>';
    hero.insertAdjacentElement("afterend",section);
    document.getElementById("d10xOpenOrders").onclick=()=>location.href=BASE+"orders.html";
    document.getElementById("d10xAlerts").onclick=openAlerts;
    document.getElementById("d10xTrack")?.addEventListener("click",()=>{
      window.doodhwalaCurrentOrderId=String(active?.id||"");
      if(window.Doodhwala10X?.openPanel)window.Doodhwala10X.openPanel("tracking");
      else location.href=BASE+"orders.html";
    });
    document.getElementById("d10xReorder")?.addEventListener("click",async function(){
      this.disabled=true;this.textContent="Adding…";
      try{
        if(!recent?.id||!window.Doodhwala10X?.reorder)throw new Error("Reorder is unavailable for this order.");
        const n=await window.Doodhwala10X.reorder(recent.id);
        window.Doodhwala10X.toast?.(n+" L added to cart");
        setTimeout(()=>window.openCart?.(),220);
      }catch(e){window.Doodhwala10X?.toast?.(e.message||"Reorder unavailable")}
      finally{this.disabled=false;this.textContent="↻ Reorder"}
    });
    updateBell(snapshot.unread);
  }

  function mountBell(){
    if(document.querySelector(".d10x-bell"))return;
    const header=document.querySelector("main header");
    if(!header)return;
    const auth=header.querySelector(".auth-link");
    const bell=document.createElement("button");bell.className="d10x-bell";bell.type="button";bell.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg><i></i>';
    bell.onclick=openAlerts;
    if(auth)header.insertBefore(bell,auth);else header.appendChild(bell);
  }

  async function setupRealtime(user){
    if(!user)return;
    if(window.__customerMarket10xChannel){try{api.removeChannel(window.__customerMarket10xChannel)}catch(_){}}
    const channel=api.channel("customer-market-"+user.id).on("postgres_changes",{event:"*",schema:"public",table:"customer_notifications",filter:"customer_id=eq."+user.id},async()=>{
      try{const rows=await api.from("customer_notifications").select("id,is_read").eq("customer_id",user.id).limit(50);updateBell((rows.data||[]).filter(x=>!x.is_read).length)}catch(_){}
    });
    window.__customerMarket10xChannel=channel;channel.subscribe();
  }

  async function mount(){
    if(location.pathname.endsWith("auth.html")||location.pathname.endsWith("provider.html")||location.pathname.endsWith("admin.html"))return;
    const user=await currentUser().catch(()=>null);
    mountBell();
    if(!user)return;
    try{
      await syncLegacyFavorites();
      const snapshot=await loadSnapshot();
      renderDesk(snapshot);
      await setupRealtime(user);
    }catch(e){console.warn("Customer marketplace 10X failed",e)}
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(mount,450),{once:true});else setTimeout(mount,450);
})();