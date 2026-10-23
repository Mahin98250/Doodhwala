const CACHE="doodhwala-v87";
const ASSETS=["/Doodhwala/","/Doodhwala/index.html","/Doodhwala/support.html","/Doodhwala/support.css?v=20261022.1","/Doodhwala/support.js?v=20261022.2","/Doodhwala/legal.html","/Doodhwala/offline.html","/Doodhwala/auth.html","/Doodhwala/checkout.html","/Doodhwala/provider.html","/Doodhwala/orders.html","/Doodhwala/direct-upi-checkout.js?v=20261023.1","/Doodhwala/direct-upi-checkout.css?v=20261023.1","/Doodhwala/experience-layer.css?v=20261023.5","/Doodhwala/network-status.js?v=20261023.1","/Doodhwala/orders.js?v=20261023.1","/Doodhwala/plans.html","/Doodhwala/admin.html","/Doodhwala/store.html","/Doodhwala/product.html","/Doodhwala/styles.css","/Doodhwala/market.css","/Doodhwala/auth.css","/Doodhwala/checkout.css","/Doodhwala/provider.css","/Doodhwala/provider.css?v=20261022.6","/Doodhwala/orders.css","/Doodhwala/plans.css","/Doodhwala/admin.css","/Doodhwala/admin.css?v=20261022.2","/Doodhwala/admin-intelligence.js?v=20261009.2","/Doodhwala/app.js","/Doodhwala/location.js","/Doodhwala/provider-location.js","/Doodhwala/auth.js","/Doodhwala/checkout.js","/Doodhwala/provider.js","/Doodhwala/provider.js?v=20261008.2","/Doodhwala/orders.js","/Doodhwala/customer-nav.js","/Doodhwala/customer-10x.js","/Doodhwala/customer-market-10x.js","/Doodhwala/checkout-10x.js","/Doodhwala/checkout-10x.js?v=20261008.2","/Doodhwala/provider-10x.js","/Doodhwala/supabase-config.js","/Doodhwala/supabase-client.js","/Doodhwala/resilience.js?v=20261023.5","/Doodhwala/plans.js?v=20261023.2","/Doodhwala/product.js","/Doodhwala/product.js?v=20261022.5","/Doodhwala/store.js","/Doodhwala/manifest.webmanifest","/Doodhwala/assets/mascot.png","/Doodhwala/supabase-config.js?v=20261009.1","/Doodhwala/supabase-client.js?v=20261009.1","/Doodhwala/auth.js?v=20261009.1","/Doodhwala/auth.js?v=20261012.1","/Doodhwala/checkout.js?v=20261022.5","/Doodhwala/checkout.js?v=20261023.2","/Doodhwala/provider.js?v=20261022.5","/Doodhwala/admin.js?v=20261022.3","/Doodhwala/pwa-register.js?v=20261011.1","/Doodhwala/pwa-register.js?v=20261022.4","/Doodhwala/customer-10x.js?v=20261011.2","/Doodhwala/customer-market-10x.js?v=20261011.2","/Doodhwala/provider-10x.js?v=20261011.2","/Doodhwala/store.js?v=20261011.2","/Doodhwala/styles.css?v=20261013.1","/Doodhwala/styles.css?v=20261013.2","/Doodhwala/styles.css?v=20261013.3","/Doodhwala/styles.css?v=20261023.5","/Doodhwala/market.css?v=20261011.2","/Doodhwala/app.js?v=20261013.1","/Doodhwala/app.js?v=20261022.4","/Doodhwala/customer-nav.js?v=20261011.2","/Doodhwala/session-controls.js?v=20261011.1"];
const CORE_ASSETS=["/Doodhwala/","/Doodhwala/index.html","/Doodhwala/styles.css?v=20261023.5","/Doodhwala/app.js?v=20261022.4","/Doodhwala/resilience.js?v=20261023.5"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(async cache=>{
  // These core files must exist for a useful offline shell. A flaky optional asset
  // must not abort the entire service-worker installation.
  await cache.addAll(CORE_ASSETS);
  const optional=ASSETS.filter(asset=>!CORE_ASSETS.includes(asset));
  await Promise.all(optional.map(asset=>cache.add(asset).catch(error=>{
    try{console.warn("Doodhwala optional offline asset could not be cached:",asset,error)}catch(_){}
  })));
}).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  event.respondWith(
    fetch(event.request).then(response=>{
      if(response.ok)caches.open(CACHE).then(cache=>cache.put(event.request,response.clone())).catch(()=>{});
      return response;
    }).catch(async()=>{
      // Check the exact request first, then its query-free path. This keeps offline
      // deep links (for example orders.html?filter=active) on the correct screen.
      const exact=await caches.match(event.request);
      if(exact)return exact;
      const pathOnly=new URL(url.pathname,self.location.origin).href;
      const pathCached=await caches.match(pathOnly);
      if(pathCached)return pathCached;
      // Only use the home screen when the requested navigation route was not cached.
      if(event.request.mode==="navigate"){
        const offline=await caches.match(new URL("/Doodhwala/offline.html",self.location.origin).href);
        if(offline)return offline;
        const home=await caches.match(new URL("/Doodhwala/index.html",self.location.origin).href);
        if(home)return home;
      }
      return Response.error();
    })
  );
});
