const CACHE="doodhwala-v74";
const ASSETS=["/Dudh-Wallah/","/Dudh-Wallah/index.html","/Dudh-Wallah/legal.html","/Dudh-Wallah/auth.html","/Dudh-Wallah/checkout.html","/Dudh-Wallah/provider.html","/Dudh-Wallah/orders.html","/Dudh-Wallah/plans.html","/Dudh-Wallah/admin.html","/Dudh-Wallah/store.html","/Dudh-Wallah/product.html","/Dudh-Wallah/styles.css","/Dudh-Wallah/market.css","/Dudh-Wallah/auth.css","/Dudh-Wallah/checkout.css","/Dudh-Wallah/provider.css","/Dudh-Wallah/provider.css?v=20261013.3","/Dudh-Wallah/orders.css","/Dudh-Wallah/plans.css","/Dudh-Wallah/admin.css","/Dudh-Wallah/admin.css?v=20261013.1","/Dudh-Wallah/admin-intelligence.js?v=20261009.2","/Dudh-Wallah/app.js","/Dudh-Wallah/location.js","/Dudh-Wallah/provider-location.js","/Dudh-Wallah/auth.js","/Dudh-Wallah/checkout.js","/Dudh-Wallah/provider.js","/Dudh-Wallah/provider.js?v=20261008.2","/Dudh-Wallah/orders.js","/Dudh-Wallah/customer-nav.js","/Dudh-Wallah/customer-10x.js","/Dudh-Wallah/customer-market-10x.js","/Dudh-Wallah/checkout-10x.js","/Dudh-Wallah/checkout-10x.js?v=20261008.2","/Dudh-Wallah/provider-10x.js","/Dudh-Wallah/supabase-config.js","/Dudh-Wallah/supabase-client.js","/Dudh-Wallah/resilience.js?v=20261022.3","/Dudh-Wallah/plans.js","/Dudh-Wallah/product.js","/Dudh-Wallah/product.js?v=20261022.4","/Dudh-Wallah/store.js","/Dudh-Wallah/manifest.webmanifest","/Dudh-Wallah/assets/logo.svg","/Dudh-Wallah/supabase-config.js?v=20261009.1","/Dudh-Wallah/supabase-client.js?v=20261009.1","/Dudh-Wallah/auth.js?v=20261009.1","/Dudh-Wallah/auth.js?v=20261012.1","/Dudh-Wallah/checkout.js?v=20261011.4","/Dudh-Wallah/provider.js?v=20261013.1","/Dudh-Wallah/admin.js?v=20261012.1","/Dudh-Wallah/pwa-register.js?v=20261011.1","/Dudh-Wallah/customer-10x.js?v=20261011.2","/Dudh-Wallah/customer-market-10x.js?v=20261011.2","/Dudh-Wallah/provider-10x.js?v=20261011.2","/Dudh-Wallah/store.js?v=20261011.2","/Dudh-Wallah/styles.css?v=20261013.1","/Dudh-Wallah/styles.css?v=20261013.2","/Dudh-Wallah/styles.css?v=20261013.3","/Dudh-Wallah/styles.css?v=20261022.3","/Dudh-Wallah/market.css?v=20261011.2","/Dudh-Wallah/app.js?v=20261013.1","/Dudh-Wallah/app.js?v=20261022.3","/Dudh-Wallah/customer-nav.js?v=20261011.2","/Dudh-Wallah/session-controls.js?v=20261011.1"];
const CORE_ASSETS=["/Dudh-Wallah/","/Dudh-Wallah/index.html","/Dudh-Wallah/styles.css?v=20261022.3","/Dudh-Wallah/app.js?v=20261022.3","/Dudh-Wallah/resilience.js?v=20261022.3"];
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
        const home=await caches.match(new URL("/Dudh-Wallah/index.html",self.location.origin).href);
        if(home)return home;
      }
      return Response.error();
    })
  );
});
