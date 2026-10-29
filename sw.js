const CACHE="doodhwala-v112";
const ASSETS=["/Doodhwala/profile/","/Doodhwala/profile/index.html","/Doodhwala/about/","/Doodhwala/about/index.html","/Doodhwala/profile/details/","/Doodhwala/profile/details/index.html","/Doodhwala/profile-details.js?v=20261029.2","/Doodhwala/customer-nav.js?v=20261028.4","/Doodhwala/auth/","/Doodhwala/plans/","/Doodhwala/orders/","/Doodhwala/provider/","/Doodhwala/notifications/","/Doodhwala/support/","/Doodhwala/checkout/","/Doodhwala/legal/","/Doodhwala/product/","/Doodhwala/store/","/Doodhwala/admin/","/Doodhwala/offline/","/Doodhwala/","/Doodhwala/index.html","/Doodhwala/notifications.html","/Doodhwala/support.html","/Doodhwala/support.css?v=20261022.1","/Doodhwala/support.js?v=20261022.2","/Doodhwala/legal.html","/Doodhwala/offline.html","/Doodhwala/auth.html","/Doodhwala/checkout.html","/Doodhwala/provider.html","/Doodhwala/orders.html","/Doodhwala/app.js?v=20261027.1","/Doodhwala/customer-nav.js?v=20261027.1","/Doodhwala/notifications.css?v=20261027.1","/Doodhwala/notifications.js?v=20261027.1","/Doodhwala/customer-ui-polish.css?v=20261025.3","/Doodhwala/customer-ui-polish.css?v=20261026.1","/Doodhwala/customer-journey-refresh.css?v=20261025.1","/Doodhwala/customer-journey-refresh.css?v=20261025.3","/Doodhwala/milk-transition.css?v=20261027.8","/Doodhwala/milk-transition.js?v=20261027.8","/Doodhwala/orders.js?v=20261025.4","/Doodhwala/plans.js?v=20261025.5","/Doodhwala/plans.js?v=20261027.3","/Doodhwala/subscription-schedule-preview.css?v=20261027.2","/Doodhwala/customer-nav.js?v=20261025.3","/Doodhwala/resilience.js?v=20261025.3","/Doodhwala/direct-upi-checkout.js?v=20261023.1","/Doodhwala/direct-upi-checkout.css?v=20261023.1","/Doodhwala/experience-layer.css?v=20261023.5","/Doodhwala/network-status.js?v=20261023.1","/Doodhwala/orders.js?v=20261023.1","/Doodhwala/plans.html","/Doodhwala/admin.html","/Doodhwala/store.html","/Doodhwala/product.html","/Doodhwala/styles.css","/Doodhwala/market.css","/Doodhwala/auth.css","/Doodhwala/checkout.css","/Doodhwala/provider.css","/Doodhwala/provider.css?v=20261022.6","/Doodhwala/provider.css?v=20261027.2","/Doodhwala/provider.css?v=20261027.1","/Doodhwala/orders.css","/Doodhwala/plans.css","/Doodhwala/admin.css","/Doodhwala/admin.css?v=20261022.2","/Doodhwala/admin-intelligence.js?v=20261009.2","/Doodhwala/app.js","/Doodhwala/location.js","/Doodhwala/provider-location.js","/Doodhwala/auth.js","/Doodhwala/checkout.js","/Doodhwala/provider.js","/Doodhwala/provider.js?v=20261008.2","/Doodhwala/orders.js","/Doodhwala/customer-nav.js","/Doodhwala/customer-10x.js","/Doodhwala/customer-market-10x.js","/Doodhwala/checkout-10x.js","/Doodhwala/checkout-10x.js?v=20261008.2","/Doodhwala/provider-10x.js","/Doodhwala/supabase-config.js","/Doodhwala/supabase-client.js","/Doodhwala/resilience.js?v=20261023.5","/Doodhwala/plans.js?v=20261023.2","/Doodhwala/product.js","/Doodhwala/product.js?v=20261025.6","/Doodhwala/store.js","/Doodhwala/manifest.webmanifest","/Doodhwala/assets/mascot.png","/Doodhwala/assets/mascot.png?v=20261023.3","/Doodhwala/supabase-config.js?v=20261009.1","/Doodhwala/supabase-client.js?v=20261009.1","/Doodhwala/auth.js?v=20261009.1","/Doodhwala/auth.js?v=20261012.1","/Doodhwala/checkout.js?v=20261022.5","/Doodhwala/checkout.js?v=20261025.3","/Doodhwala/provider.js?v=20261022.5","/Doodhwala/provider.js?v=20261027.1","/Doodhwala/admin.js?v=20261022.3","/Doodhwala/pwa-register.js?v=20261011.1","/Doodhwala/pwa-register.js?v=20261022.4","/Doodhwala/customer-10x.js?v=20261026.1","/Doodhwala/customer-market-10x.js?v=20261023.4","/Doodhwala/provider-10x.js?v=20261011.2","/Doodhwala/store.js?v=20261025.4","/Doodhwala/styles.css?v=20261013.1","/Doodhwala/styles.css?v=20261013.2","/Doodhwala/styles.css?v=20261013.3","/Doodhwala/styles.css?v=20261023.5","/Doodhwala/market.css?v=20261011.2","/Doodhwala/customer-nav.js?v=20261011.2","/Doodhwala/session-controls.js?v=20261011.1","/Doodhwala/splash-screen.css?v=20261028.2","/Doodhwala/splash-screen.js?v=20261028.2","/Doodhwala/doodhwala-ui-system.css?v=20261028.2","/Doodhwala/customer-ui-stability.css?v=20261028.1"];
const CORE_ASSETS=["/Doodhwala/","/Doodhwala/index.html","/Doodhwala/offline.html","/Doodhwala/styles.css?v=20261023.5","/Doodhwala/marketplace-refresh.css?v=20261025.3","/Doodhwala/customer-ui-polish.css?v=20261026.1","/Doodhwala/customer-journey-refresh.css?v=20261025.3","/Doodhwala/milk-transition.css?v=20261027.8","/Doodhwala/resilience.js?v=20261025.3","/Doodhwala/app.js?v=20261027.1","/Doodhwala/splash-screen.css?v=20261028.2","/Doodhwala/splash-screen.js?v=20261028.2","/Doodhwala/doodhwala-ui-system.css?v=20261028.2","/Doodhwala/customer-ui-stability.css?v=20261028.1"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(async cache=>{
  // These core files must exist for a useful offline shell. A flaky optional asset
  // must not abort the entire service-worker installation.
  await cache.addAll(CORE_ASSETS);
  const optional=ASSETS.filter(asset=>!CORE_ASSETS.includes(asset));
  await Promise.all(optional.map(asset=>cache.add(asset).catch(error=>{
    try{console.warn("Doodhwala optional offline asset could not be cached:",asset,error)}catch(_){}
  })));
}).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("doodhwala-")&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  event.respondWith(
    fetch(event.request).then(async response=>{
      if(response.ok){
        // Do not report a network response until its cache write has settled; query-string
        // URLs must be available immediately if the connection drops after this response.
        try{const cache=await caches.open(CACHE);await cache.put(event.request,response.clone())}catch(_){}
      }
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
