/* Optional sponsored copy on already-discovered seller cards. Nothing in a
 * seller profile, localStorage, invoice request or browser payment can grant a
 * label: only the bounded server RPC can return eligible IDs. */
(function(){
  "use strict";
  const grid=document.getElementById("providersGrid");if(!grid)return;
  const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  let eligible=new Map(),signature="",generation=0,refreshTimer=null,expiryTimer=null,scheduled=null;
  function cards(){return Array.from(grid.querySelectorAll("[data-provider-card]"))}
  function ids(){return Array.from(new Set(cards().map(card=>card.dataset.providerCard).filter(id=>UUID.test(id)))).sort()}
  function apply(){
    const now=Date.now();
    cards().forEach(card=>{
      const id=card.dataset.providerCard,existing=card.querySelector(".sponsored-seller-copy");
      const allowed=(eligible.get(id)||0)>now;
      if(!allowed){existing?.remove();return}
      if(existing)return;
      const name=card.querySelector(".provider-body .name-row");if(!name)return;
      const box=document.createElement("div"),title=document.createElement("b"),detail=document.createElement("small");
      box.className="sponsored-seller-copy";
      title.textContent="Recommended by Doodhwala · Sponsored";
      detail.textContent="View milk, prices and delivery details";
      box.append(title,detail);name.insertAdjacentElement("afterend",box);
    });
  }
  function invalidate(){
    ++generation;eligible=new Map();clearTimeout(refreshTimer);clearTimeout(expiryTimer);apply();
  }
  function schedule(delay=40){clearTimeout(scheduled);scheduled=setTimeout(refresh,delay)}
  async function refresh(){
    const requested=ids(),key=requested.join(",");
    signature=key;invalidate();
    const token=generation,db=window.Doodhwala?.configured?window.Doodhwala.supabase:null;
    if(!db||!requested.length||document.visibilityState==="hidden"||navigator.onLine===false)return;
    try{
      const batches=[];for(let i=0;i<requested.length;i+=100)batches.push(requested.slice(i,i+100));
      const results=await Promise.all(batches.map(batch=>db.rpc("get_sponsored_provider_cards",{p_provider_ids:batch})));
      if(token!==generation||ids().join(",")!==key)return;
      if(results.some(result=>result.error||!Array.isArray(result.data)))throw new Error("sponsored_lookup_unavailable");
      const wanted=new Set(requested),now=Date.now(),next=new Map();
      for(const result of results)for(const row of result.data){
        const id=String(row?.provider_id||""),expires=Date.parse(row?.expires_at||"");
        if(wanted.has(id)&&Number.isFinite(expires)&&expires>now)next.set(id,expires);
      }
      eligible=next;apply();
      if(next.size){
        const soonest=Math.min(...next.values());
        expiryTimer=setTimeout(()=>{eligible=new Map();apply();schedule(0)},Math.max(1,Math.min(soonest-now,2147483647)));
      }
      // Recheck revocations; a hidden/offline page clears labels immediately.
      refreshTimer=setTimeout(refresh,next.size?30000:120000);
    }catch(_){
      if(token!==generation)return;
      eligible=new Map();apply();
      // Missing or unavailable RPC is not a marketplace failure and never grants a label.
      refreshTimer=setTimeout(refresh,120000);
    }
  }
  const observer=new MutationObserver(()=>{
    const next=ids().join(",");
    if(next!==signature){signature=next;invalidate();if(next)schedule()}
    else apply();
  });
  observer.observe(grid,{childList:true,subtree:true});
  window.addEventListener("doodhwala:providers-updated",()=>{signature=ids().join(",");invalidate();if(signature)schedule()});
  window.addEventListener("offline",()=>{clearTimeout(scheduled);invalidate()});
  window.addEventListener("online",()=>schedule(0));
  document.addEventListener("visibilitychange",()=>{
    if(document.visibilityState==="hidden"){clearTimeout(scheduled);invalidate()}
    else schedule(0);
  });
  signature=ids().join(",");if(signature)schedule();
})();
