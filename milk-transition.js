/* Doodhwala milk-transfer page transition and data-loading indicator. No network dependency. */
(function(w,d){
  "use strict";
  if(w.DoodhwalaMilkTransition)return;
  var overlay=null,loader=null,timer=null;
  var bottle='<svg viewBox="0 0 52 70" aria-hidden="true"><path d="M19 4h14v8l5 7v39c0 4-3 7-7 7H21c-4 0-7-3-7-7V19l5-7Z" fill="#fff" stroke="#2a6845" stroke-width="2"/><path d="M19 12h14M16 28h20" fill="none" stroke="#a9cbb0" stroke-width="1.6"/><path class="dw-milk-fill" d="M16 40h20v18c0 3-2 5-5 5H21c-3 0-5-2-5-5Z" fill="#dff2df"/><path d="M26 34c-3 4-4 6-4 8a4 4 0 0 0 8 0c0-2-1-4-4-8Z" fill="#7fb78a"/></svg>';
  function scene(label){
    return '<div class="dw-milk-scene"><span class="dw-milk-bottle dw-milk-source">'+bottle+'</span><span class="dw-milk-pour" aria-hidden="true"><i></i><i></i><i></i></span><span class="dw-milk-bottle dw-milk-target">'+bottle+'</span></div><strong class="dw-milk-title">'+label+'</strong>';
  }
  function ensure(){
    if(!d.body)return false;
    if(!overlay){
      overlay=d.createElement("div");overlay.className="dw-milk-transition";overlay.hidden=true;
      overlay.setAttribute("role","status");overlay.setAttribute("aria-live","polite");
      overlay.innerHTML='<div class="dw-milk-transition-card"><span class="dw-milk-brand-mark">D</span><div class="dw-milk-content">'+scene("Pouring fresh milk")+'<small>Taking you to your next stop</small></div></div>';
      d.body.appendChild(overlay);
    }
    if(!loader){
      loader=d.createElement("div");loader.className="dw-milk-loading";loader.hidden=true;
      loader.setAttribute("role","status");loader.setAttribute("aria-live","polite");
      loader.innerHTML='<div class="dw-milk-loading-scene"><div class="dw-milk-scene"><span class="dw-milk-bottle dw-milk-source">'+bottle+'</span><span class="dw-milk-pour" aria-hidden="true"><i></i><i></i><i></i></span><span class="dw-milk-bottle dw-milk-target">'+bottle+'</span></div></div><strong class="dw-milk-title">Loading fresh data</strong>';
      d.body.appendChild(loader);
    }
    return true;
  }
  function showTransition(label){
    if(!ensure())return;
    if(timer){w.clearTimeout(timer);timer=null;}
    overlay.querySelector(".dw-milk-title").textContent=label||"Pouring fresh milk";
    overlay.querySelector(".dw-milk-content small").textContent="Taking you to your next stop";
    overlay.hidden=false;
    overlay.classList.remove("is-visible");
    void overlay.offsetWidth;
    overlay.classList.add("is-visible");
  }
  function hideTransition(){
    if(!overlay)return;
    overlay.classList.remove("is-visible");
    overlay.hidden=true;
  }
  function showLoading(label){
    if(!ensure())return;
    // Prepare the inline loader even while the full transition overlay is visible.
    // When the short overlay fades, the data-loading indicator remains until work ends.
    loader.querySelector(".dw-milk-title").textContent=label||"Loading fresh data…";
    loader.hidden=false;
  }
  function hideLoading(){if(loader)loader.hidden=true;}
  function navigate(url){
    var target;
    try{target=new URL(url,w.location.href)}catch(_){w.location.href=url;return;}
    if(target.origin!==w.location.origin){w.location.href=target.href;return;}
    showTransition("Pouring fresh milk");
    try{w.sessionStorage.setItem("dw-milk-transition-pending",String(Date.now()));}catch(_){}
    timer=w.setTimeout(function(){w.location.assign(target.href);},540);
  }
  w.DoodhwalaMilkTransition={showTransition:showTransition,hideTransition:hideTransition,showLoading:showLoading,hideLoading:hideLoading,navigate:navigate};
  d.addEventListener("click",function(event){
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    var link=event.target&&event.target.closest?event.target.closest("a[href]"):null;
    if(!link||link.hasAttribute("download")||(link.target&&link.target!=="_self"))return;
    var href=link.getAttribute("href");
    if(!href||href.charAt(0)==="#"||/^\s*javascript:/i.test(href))return;
    var target;
    try{target=new URL(href,w.location.href)}catch(_){return;}
    if(target.origin!==w.location.origin)return;
    if(target.pathname===w.location.pathname&&target.search===w.location.search)return;
    if(!target.pathname.startsWith("/Doodhwala/"))return;
    event.preventDefault();navigate(target.href);
  },true);
  function resume(){
    var pending=0;
    try{pending=Number(w.sessionStorage.getItem("dw-milk-transition-pending")||0);w.sessionStorage.removeItem("dw-milk-transition-pending");}catch(_){}
    if(pending&&Date.now()-pending<3500){
      showTransition("Fresh milk, right on time");
      w.setTimeout(hideTransition,300);
    }
  }
  if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",resume,{once:true});else resume();
})(window,document);
