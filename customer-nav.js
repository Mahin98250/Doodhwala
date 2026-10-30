(() => {
  const BASE="/Doodhwala/";
  const icons={
    home:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10Z"/><path d="M9 21h6"/></svg>',
    explore:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="m14.7 9.3-1.8 3.6-3.6 1.8 1.8-3.6 3.6-1.8Z"/></svg>',
    plans:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v3M17 3v3M4 9h16"/><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 13h3M8 17h5"/></svg>',
    orders:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-3-6 3V3Z"/><path d="M9 8h6M9 12h6"/></svg>',
    saved:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 8.5c0 5-8 10-8 10s-8-5-8-10a4.5 4.5 0 0 1 8-2.5 4.5 4.5 0 0 1 8 2.5Z"/></svg>',
    cart:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14l-1 12H6L5 7Z"/><path d="M9 7a3 3 0 0 1 6 0"/><path d="M9 11v4M15 11v4"/></svg>',
    profile:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></svg>'
  };
  function getPage(){const pathname=location.pathname.toLowerCase();if(pathname==="/doodhwala/"||pathname==="/doodhwala"||pathname==="/doodhwala/index.html")return"home";if(pathname==="/doodhwala/plans/"||pathname==="/doodhwala/plans/index.html")return"plans";if(pathname==="/doodhwala/orders/"||pathname==="/doodhwala/orders/index.html")return"orders";if(pathname==="/doodhwala/checkout/"||pathname==="/doodhwala/checkout/index.html")return"cart";if(pathname.startsWith("/doodhwala/profile/")||pathname==="/doodhwala/profile")return"profile";if(pathname==="/doodhwala/store/"||pathname==="/doodhwala/store/index.html"||pathname==="/doodhwala/product/"||pathname==="/doodhwala/product/index.html")return"explore";if(["/doodhwala/auth/","/doodhwala/auth/index.html","/doodhwala/provider/","/doodhwala/provider/index.html","/doodhwala/admin/","/doodhwala/admin/index.html"].includes(pathname))return"";return"home"}
  function item(key,label,extra=""){const badge=key==="cart"?'<b class="customer-nav-badge" data-cart-count>0</b>':"";return'<button type="button" class="customer-nav-item '+extra+'" data-customer-nav="'+key+'" aria-label="'+label+'">'+icons[key]+'<span>'+label+'</span>'+badge+'</button>'}
  function setActive(nav){const q=new URLSearchParams(location.search);let active=getPage();if(getPage()==="home"){if(q.get("view")==="providers")active="explore";if(q.get("view")==="saved")active="saved";if(q.get("cart")==="1")active="cart"}nav.querySelectorAll("[data-customer-nav]").forEach(btn=>{btn.classList.toggle("active",btn.dataset.customerNav===active);btn.setAttribute("aria-current",btn.dataset.customerNav===active?"page":"false")})}
  function cartCount(){try{const cart=JSON.parse(localStorage.getItem("doodhwala-cart")||"{}");return Object.values(cart).reduce((sum,item)=>sum+Math.max(0,Number(item?.qty)||0),0)}catch(_){return 0}}
  function updateCartBadge(nav){const count=cartCount(),badge=nav.querySelector("[data-cart-count]");if(!badge)return;badge.textContent=count>99?"99+":String(count);badge.classList.toggle("show",count>0)}
  function go(url){if(window.DoodhwalaMilkTransition&&typeof window.DoodhwalaMilkTransition.navigate==="function")window.DoodhwalaMilkTransition.navigate(url);else location.href=url}function navigate(key){const pathname=location.pathname.toLowerCase(),home=pathname==="/doodhwala/"||pathname==="/doodhwala"||pathname==="/doodhwala/index.html";if(key==="home"){if(home)window.scrollTo({top:0,behavior:"smooth"});else go(BASE);return}if(key==="explore"){if(home&&typeof window.__doodhwalaNavigate==="function")window.__doodhwalaNavigate("providers");else go(BASE+"?view=providers");return}if(key==="plans"){go(BASE+"plans/");return}if(key==="orders"){go(BASE+"orders/");return}if(key==="saved"){if(home&&typeof window.__doodhwalaNavigate==="function")window.__doodhwalaNavigate("saved");else go(BASE+"?view=saved");return}if(key==="cart"){if(home&&typeof window.openCart==="function")window.openCart();else go(BASE+"?cart=1");return}if(key==="profile"){go(BASE+"profile/")}}
  function installStyles(){if(document.getElementById("doodhwalaCustomerNavStyles"))return;const style=document.createElement("style");style.id="doodhwalaCustomerNavStyles";style.textContent=`.customer-bottom-nav{display:none}
@media(max-width:760px){
 body.has-customer-nav{padding-bottom:calc(100px + env(safe-area-inset-bottom,0px))}
 .customer-bottom-nav{
  position:fixed;left:50%;right:auto;bottom:calc(10px + env(safe-area-inset-bottom,0px));
  transform:translateX(-50%);width:min(720px,calc(100vw - 16px));max-width:100%;
  z-index:var(--dw-z-bottom-nav,9999);display:grid;grid-template-columns:repeat(7,minmax(0,1fr));
  gap:2px;height:78px;padding:7px 6px;
  background:rgba(255,255,255,.96);border:1px solid #dce7dd;border-radius:24px;
  box-shadow:0 14px 38px rgba(20,45,29,.16),0 2px 7px rgba(20,45,29,.06);
  backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);isolation:isolate;
 }
 .customer-nav-item{
  position:relative;min-width:0;min-height:44px;height:64px;padding:6px 1px;
  border:0;border-radius:15px;background:transparent;color:var(--dw-color-text-muted,#6f7c73);
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;
  cursor:pointer;touch-action:manipulation;
  transition:background-color var(--dw-motion-normal,220ms) var(--dw-motion-ease,cubic-bezier(.2,.75,.25,1)),
             color var(--dw-motion-normal,220ms) var(--dw-motion-ease,cubic-bezier(.2,.75,.25,1)),
             transform var(--dw-motion-fast,140ms) var(--dw-motion-ease,cubic-bezier(.2,.75,.25,1));
 }
 .customer-nav-item svg{width:21px;height:21px;flex:0 0 auto;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
 .customer-nav-item span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:8.5px;line-height:1.1;font-weight:750;letter-spacing:-.01em}
 .customer-nav-item.active{color:var(--dw-color-brand-strong,#10482f);background:var(--dw-color-brand-soft,#e3f1e7)}
 .customer-nav-item.is-cart{margin:0;color:#fff;background:var(--dw-color-brand-strong,#10482f);border-radius:16px;box-shadow:0 7px 16px rgba(16,72,47,.16)}
 .customer-nav-item.is-cart.active{color:#fff;background:var(--dw-color-brand)}
 .customer-nav-item:active{transform:scale(.96)}
 .customer-nav-badge{
  position:absolute;top:3px;right:10%;min-width:18px;height:18px;padding:0 4px;
  border-radius:9px;background:#e7b95e;color:#392d13;font-size:7px!important;
  line-height:18px!important;text-align:center;font-weight:900!important;display:none!important;
 }
 .customer-nav-badge.show{display:block!important}
}
@media(max-width:390px){
 .customer-bottom-nav{width:calc(100vw - 12px);padding:7px 4px;border-radius:21px}
 .customer-nav-item{gap:4px;border-radius:13px}
 .customer-nav-item svg{width:20px;height:20px}
 .customer-nav-item span{font-size:8px}
}
@media(prefers-reduced-motion:reduce){
 .customer-bottom-nav,.customer-nav-item{transition:none!important;animation:none!important;scroll-behavior:auto!important}
};document.head.appendChild(style)}
  function loadScriptOnce(src,marker){if(document.querySelector("script["+marker+"]"))return;const s=document.createElement("script");s.src=src;s.setAttribute(marker,"1");document.body.appendChild(s)}
  function mount(){if(!document.body)return;installStyles();document.body.classList.add("has-customer-nav");let nav=document.querySelector(".customer-bottom-nav"),legacy=document.querySelector(".bottom");if(!nav){nav=legacy||document.createElement("nav");nav.className="customer-bottom-nav";if(!legacy)document.body.appendChild(nav)}nav.setAttribute("aria-label","Doodhwala navigation");nav.innerHTML=[item("home","Home"),item("explore","Explore"),item("plans","Plans"),item("orders","Orders"),item("saved","Saved"),item("cart","Cart","is-cart"),item("profile","Profile")].join("");nav.querySelectorAll("[data-customer-nav]").forEach(btn=>btn.addEventListener("click",()=>navigate(btn.dataset.customerNav)));setActive(nav);updateCartBadge(nav);window.addEventListener("storage",()=>updateCartBadge(nav));window.addEventListener("doodhwala:cart-updated",()=>updateCartBadge(nav));window.addEventListener("popstate",()=>setActive(nav));const params=new URLSearchParams(location.search);if(getPage()==="home"){const initialView=params.get("view");if(initialView==="providers"||initialView==="saved")setTimeout(()=>{document.querySelector('[data-go="'+initialView+'"]')?.click();setActive(nav)},0);if(params.get("cart")==="1")setTimeout(()=>window.openCart?.(),80)}window.DoodhwalaCustomerNav={navigate,updateCartBadge:()=>updateCartBadge(nav)};loadScriptOnce(BASE+"customer-10x.js?v=20261026.1","data-doodhwala-10x");loadScriptOnce(BASE+"customer-market-10x.js?v=20261023.4","data-doodhwala-market-10x");loadScriptOnce(BASE+"checkout-10x.js?v=20261008.2","data-doodhwala-checkout-10x")}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount,{once:true});else mount();
})();