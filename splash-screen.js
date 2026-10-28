/* Lightweight first-visit app-start animation. Never blocks app interaction for long. */
(function(w,d){
 "use strict";
 var root=d.getElementById("dwSplash");
 if(!root||w.matchMedia("(prefers-reduced-motion: reduce)").matches){if(root)root.hidden=true;return;}
 try{if(w.sessionStorage.getItem("dw-splash-seen")==="1"){root.hidden=true;return;}w.sessionStorage.setItem("dw-splash-seen","1");}catch(_){}
 var done=false,timer=w.setTimeout(finish,2050);
 function finish(){if(done)return;done=true;w.clearTimeout(timer);root.classList.add("is-leaving");w.setTimeout(function(){root.hidden=true;},450);}
 var skip=root.querySelector("[data-splash-skip]");
 if(skip)skip.addEventListener("click",finish,{once:true});
 root.hidden=false;
 root.addEventListener("click",function(e){if(e.target===root)finish();},{once:true});
})(window,document);
