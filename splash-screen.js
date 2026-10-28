/* Doodhwala branded app-start reveal. Non-blocking, first visit per tab session. */
(function(w,d){
 "use strict";
 var root=d.getElementById("dwSplash");
 if(!root)return;
 var reduce=false;
 try{reduce=!!(w.matchMedia&&w.matchMedia("(prefers-reduced-motion: reduce)").matches);}catch(_){}
 if(reduce){root.hidden=true;return;}
 try{
   if(w.sessionStorage.getItem("dw-splash-seen-v2")==="1"){root.hidden=true;return;}
   w.sessionStorage.setItem("dw-splash-seen-v2","1");
 }catch(_){}
 var finished=false,timer=0,hideTimer=0,body=d.body;
 function finish(){
   if(finished)return;
   finished=true;
   w.clearTimeout(timer);
   root.classList.add("is-leaving");
   if(body)body.classList.remove("dw-splash-active");
   hideTimer=w.setTimeout(function(){root.hidden=true;root.classList.remove("is-leaving");},410);
 }
 root.hidden=false;
 if(body)body.classList.add("dw-splash-active");
 timer=w.setTimeout(finish,1780);
 var skip=root.querySelector("[data-splash-skip]");
 if(skip)skip.addEventListener("click",finish,{once:true});
 root.addEventListener("click",function(e){if(e.target===root)finish();});
 w.addEventListener("pagehide",function(){w.clearTimeout(timer);w.clearTimeout(hideTimer);});
})(window,document);
