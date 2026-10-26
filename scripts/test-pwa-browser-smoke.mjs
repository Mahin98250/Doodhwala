import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const base = process.env.DOODHWALA_BASE_URL || "http://127.0.0.1:4173/Doodhwala/";
const evidenceDir = process.env.EVIDENCE_DIR || "artifacts/pwa";
fs.mkdirSync(evidenceDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "allow" });
const page = await context.newPage();
const origin = new URL(base).origin;
await page.route("**/*", route => {
  const url = new URL(route.request().url());
  if (url.origin !== origin) return route.abort();
  return route.continue();
});
try {
  // Seed cache names before registering the worker; no production service is used.
  await page.goto(new URL("offline.html", base).href, { waitUntil: "domcontentloaded" });
  await page.evaluate(async () => {
    await caches.open("doodhwala-v94");
    await caches.open("unrelated-origin-cache-test");
  });
  const response = await page.goto(base, { waitUntil: "domcontentloaded" });
  assert.ok(response && response.ok(), "home route loads online");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, { timeout: 15000 });
  await page.waitForFunction(async () => {
    const cache = await caches.open("doodhwala-v95");
    return !!(await cache.match("/Doodhwala/offline.html")) && !!(await cache.match("/Doodhwala/customer-journey-refresh.css?v=20261025.1"));
  }, { timeout: 15000 });

  // Visit each customer-facing route online first. The worker is network-first,
  // and its awaited cache write should make these exact requests available offline.
  const routeCases = [
    { path: "/Doodhwala/", title: /Local Milk/i },
    { path: "/Doodhwala/checkout.html", title: /Checkout/i },
    { path: "/Doodhwala/plans.html", title: /Milk Plans/i },
    { path: "/Doodhwala/orders.html", title: /Orders/i },
    { path: "/Doodhwala/orders.html?filter=active", title: /Orders/i },
    { path: "/Doodhwala/auth.html", title: /Sign in/i },
    { path: "/Doodhwala/support.html", title: /Support/i }
  ];
  for (const routeCase of routeCases) {
    const routeUrl = new URL(routeCase.path, origin).href;
    // The production auth runtime intentionally redirects localhost to production.
    // Verify its precached HTML now; exercise its offline navigation below with a
    // test-only cached JS stub so no live-site redirect or auth request can occur.
    if (routeCase.path === "/Doodhwala/auth.html") {
      const authCached = await page.evaluate(async () => {
        const cache = await caches.open("doodhwala-v95");
        return !!(await cache.match("/Doodhwala/auth.html"));
      });
      assert.ok(authCached, "auth HTML is included in the install precache");
      continue;
    }
    const response = await page.goto(routeUrl, { waitUntil: "domcontentloaded" });
    assert.ok(response && response.ok(), "customer route loads online: " + routeCase.path);
    assert.match(await page.title(), routeCase.title, "online page title matches route: " + routeCase.path);
    await page.waitForFunction(async url => {
      const cache = await caches.open("doodhwala-v95");
      return !!(await cache.match(url));
    }, routeUrl, { timeout: 10000 });
  }

  const activationEvidence = await page.evaluate(async () => {
    const names = await caches.keys();
    const cache = await caches.open("doodhwala-v95");
    return {
      cacheNames: names,
      oldV94Removed: !names.includes("doodhwala-v94"),
      unrelatedCachePreserved: names.includes("unrelated-origin-cache-test"),
      offlineShellCached: !!(await cache.match("/Doodhwala/offline.html")),
      exactVersionedCssCached: !!(await cache.match("/Doodhwala/customer-journey-refresh.css?v=20261025.1")),
      exactQueryRouteCached: !!(await cache.match("/Doodhwala/orders.html?filter=active"))
    };
  });
  assert.ok(activationEvidence.oldV94Removed, "activation removes the previous Doodhwala cache");
  assert.ok(activationEvidence.unrelatedCachePreserved, "activation preserves unrelated origin caches");
  assert.ok(activationEvidence.offlineShellCached, "offline fallback page is cached");
  assert.ok(activationEvidence.exactVersionedCssCached, "exact versioned customer CSS URL is cached");
  assert.ok(activationEvidence.exactQueryRouteCached, "exact query-string route was cached while online");

  // Replace only the test-origin auth runtime in this isolated cache. The
  // production auth.js redirects localhost to production and must never run here.
  await page.evaluate(async () => {
    const cache = await caches.open("doodhwala-v95");
    await cache.put("/Doodhwala/auth.js?v=20261012.1", new Response("/* auth runtime intentionally stubbed in offline smoke test */", {
      status: 200,
      headers: { "Content-Type": "application/javascript" }
    }));
  });
  await context.setOffline(true);
  const offlineRoutes = [];
  for (const routeCase of routeCases) {
    const routeUrl = new URL(routeCase.path, origin).href;
    const cachedResponse = await page.goto(routeUrl, { waitUntil: "domcontentloaded" });
    assert.ok(cachedResponse && cachedResponse.ok(), "cached customer route remains available offline: " + routeCase.path);
    assert.match(await page.title(), routeCase.title, "offline navigation serves the requested cached page: " + routeCase.path);
    offlineRoutes.push({ path: routeCase.path, status: "passed", title: await page.title() });
    if (routeCase.path.includes("orders.html?filter=active")) {
      await page.screenshot({ path: path.join(evidenceDir, "offline-cached-orders-390px.png"), fullPage: true });
    }
  }

  const unknownResponse = await page.goto(new URL("/Doodhwala/uncached-browser-probe?offline=1", origin).href, { waitUntil: "domcontentloaded" });
  assert.ok(unknownResponse && unknownResponse.ok(), "uncached offline navigation receives an offline fallback page");
  assert.match(await page.locator("body").innerText(), /Some pages you visited earlier may still be available/i,
    "offline fallback accurately limits availability claim to previously cached pages");
  assert.match(await page.locator("body").innerText(), /Orders, sign-in, live order updates and payments need an internet connection/i,
    "offline fallback warns that online-only actions still need a connection");
  await page.screenshot({ path: path.join(evidenceDir, "offline-fallback-390px.png"), fullPage: true });

  await context.setOffline(false);
  const reconnected = await page.goto(base, { waitUntil: "domcontentloaded" });
  assert.ok(reconnected && reconnected.ok(), "home route is reachable again after reconnect");
  const result = { activation: activationEvidence, offlineCustomerRoutes: offlineRoutes, uncachedNavigationFallback: "passed", reconnectHome: "passed", viewport: { width: 390, height: 844 } };
  fs.writeFileSync(path.join(evidenceDir, "pwa-browser-results.json"), JSON.stringify(result, null, 2));
  console.log("PWA browser smoke passed for home, checkout, plans, orders (including query string), auth, support, cache cleanup, exact versioned CSS, fallback, and reconnect. Evidence is in artifacts/pwa.");
} finally {
  await context.close();
  await browser.close();
}
