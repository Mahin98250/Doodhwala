/* Doodhwala milk-pour page transition and data-loading indicator. No network dependency. */
(function(w,d){
  "use strict";
  if(w.DoodhwalaMilkTransition)return;
  var overlay=null,loader=null,timer=null;
  var bottle='<svg viewBox="0 0 64 92" aria-hidden="true" focusable="false"><path class="dw-milk-glass" d="M22 9h20v10l8 11v46c0 6-4 9-10 9H24c-6 0-10-3-10-9V30l8-11Z"/><path class="dw-milk-fill" d="M17 43h30v33c0 4-2 6-6 6H23c-4 0-6-2-6-6Z"/><path class="dw-milk-surface" d="M18 44q7-3 14 0t14 0"/><path d="M22 19h20M18 32h28" fill="none" stroke="#b8d2bf" stroke-width="1.4"/><ellipse cx="32" cy="9" rx="10" ry="3.2" fill="#f8fff9" stroke="#3b7953" stroke-width="1.5"/><ellipse cx="32" cy="9" rx="7.2" ry="1.6" fill="#dcebe0" stroke="#9ebea6" stroke-width=".8"/><path d="M18 35v35c0 4 2 7 5 8M45 35v31" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".78"/><path d="M24 55q8 3 16 0" fill="none" stroke="#bfdac6" stroke-width="1.1" opacity=".8"/></svg>';
  function stream(){
    return '<svg class="dw-milk-stream" viewBox="0 0 250 118" aria-hidden="true" focusable="false"><path class="dw-milk-stream-shadow" d="M82 30 C116 30 161 34 208 39"/><path class="dw-milk-stream-core" d="M82 30 C116 30 161 34 208 39"/><path class="dw-milk-stream-glint" d="M82 30 C116 30 161 34 208 39"/></svg>';
  }
  function scene(label,variant){
    return '<div class="dw-milk-scene '+(variant||'')+'">'+stream()+'<span class="dw-milk-bottle dw-milk-source">'+bottle+'</span><span class="dw-milk-bottle dw-milk-target">'+bottle+'</span><span class="dw-milk-pour" aria-hidden="true"><i></i><i></i><i></i></span></div><strong class="dw-milk-title">'+label+'</strong>';
  }
  function ensure(){
    if(!d.body)return false;
    if(!overlay){
      overlay=d.createElement("div");overlay.className="dw-milk-transition";overlay.hidden=true;
      overlay.setAttribute("role","status");overlay.setAttribute("aria-live","polite");
      overlay.innerHTML='<div class="dw-milk-transition-card"><span class="dw-milk-brand-mark">D</span><div class="dw-milk-content">'+scene("Pouring fresh milk","dw-milk-scene--transition")+'<small>Taking you to your next stop</small></div></div>';
      d.body.appendChild(overlay);
    }
    if(!loader){
      loader=d.createElement("div");loader.className="dw-milk-loading";loader.hidden=true;
      loader.setAttribute("role","status");loader.setAttribute("aria-live","polite");
      loader.innerHTML='<div class="dw-milk-loading-scene">'+scene("","")+'</div><strong class="dw-milk-title">Loading fresh data</strong>';
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
    loader.querySelector(".dw-milk-title").textContent=label||"Loading fresh data…";
    loader.hidden=false;
  }
  function hideLoading(){if(loader)loader.hidden=true;}
  function navigate(url){
    var target;
    try{target=new URL(url,w.location.href)}catch(_){w.location.href=url;return;}
    if(target.origin!==w.location.origin){w.location.href=target.href;return;}
    showTransition("Pouring fresh milk");
    var reduceMotion=false;
    try{reduceMotion=!!(w.matchMedia&&w.matchMedia("(prefers-reduced-motion: reduce)").matches)}catch(_){}
    timer=w.setTimeout(function(){w.location.assign(target.href);},reduceMotion?0:760);
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
})(window,document);
