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
    return !!(await cache.match("/Doodhwala/offline.html"));
  }, { timeout: 15000 });

  // Prime the exact query-string navigation while online so the test can verify
  // exact-request cache matching rather than accidentally testing a fallback.
  const ordersResponse = await page.goto(new URL("orders.html?filter=active", base).href, { waitUntil: "domcontentloaded" });
  assert.ok(ordersResponse && ordersResponse.ok(), "orders query route loads online before offline simulation");
  await page.waitForFunction(async () => {
    const cache = await caches.open("doodhwala-v95");
    return !!(await cache.match("/Doodhwala/orders.html?filter=active"));
  }, { timeout: 10000 });

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

  await context.setOffline(true);
  const cachedResponse = await page.goto(new URL("orders.html?filter=active", base).href, { waitUntil: "domcontentloaded" });
  assert.ok(cachedResponse && cachedResponse.ok(), "cached query-string customer route remains available offline");
  assert.match(await page.title(), /Orders/i, "offline query-string route serves the requested cached page");
  await page.screenshot({ path: path.join(evidenceDir, "offline-cached-orders-390px.png"), fullPage: true });

  const unknownResponse = await page.goto(new URL("uncached-browser-probe?offline=1", base).href, { waitUntil: "domcontentloaded" });
  assert.ok(unknownResponse && unknownResponse.ok(), "uncached offline navigation receives an offline fallback page");
  assert.match(await page.locator("body").innerText(), /Some pages you visited earlier may still be available/i,
    "offline fallback accurately limits availability claim to previously cached pages");
  assert.match(await page.locator("body").innerText(), /Orders, sign-in, live order updates and payments need an internet connection/i,
    "offline fallback warns that online-only actions still need a connection");
  await page.screenshot({ path: path.join(evidenceDir, "offline-fallback-390px.png"), fullPage: true });

  await context.setOffline(false);
  const reconnected = await page.goto(base, { waitUntil: "domcontentloaded" });
  assert.ok(reconnected && reconnected.ok(), "home route is reachable again after reconnect");
  const result = { activation: activationEvidence, offlineCachedQueryRoute: "passed", uncachedNavigationFallback: "passed", reconnectHome: "passed", viewport: { width: 390, height: 844 } };
  fs.writeFileSync(path.join(evidenceDir, "pwa-browser-results.json"), JSON.stringify(result, null, 2));
  console.log("PWA browser smoke passed. Evidence is in artifacts/pwa.");
} finally {
  await context.close();
  await browser.close();
}
