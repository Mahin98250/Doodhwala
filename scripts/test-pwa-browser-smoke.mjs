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
const evidence = { viewport: { width: 390, height: 844 }, checks: [] };
await page.route("**/*", route => {
  const url = new URL(route.request().url());
  if (url.origin !== origin) return route.abort();
  return route.continue();
});
try {
  await page.goto(new URL("offline.html", base).href, { waitUntil: "domcontentloaded" });
  await page.evaluate(async () => {
    await caches.open("doodhwala-v97");
    await caches.open("unrelated-origin-cache-test");
  });
  const response = await page.goto(base, { waitUntil: "domcontentloaded" });
  assert.ok(response && response.ok(), "home route loads on the local static server");
  await page.waitForFunction(() => {
    const splash = document.getElementById("dwSplash");
    return !!splash && !splash.hidden;
  }, { timeout: 5000 });
  assert.ok(await page.getByRole("heading", { name: "Doodhwala" }).isVisible(),
    "first visit should show the Doodhwala branded app-start screen");
  assert.ok(await page.getByRole("button", { name: "Skip intro" }).isVisible(),
    "splash must offer a visible skip action on mobile");
  await page.getByRole("button", { name: "Skip intro" }).click();
  await page.waitForFunction(() => {
    const splash = document.getElementById("dwSplash");
    return !!splash && splash.hidden;
  }, { timeout: 1500 });
  evidence.checks.push("first-visit branded splash appeared and skip dismissed it cleanly");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, { timeout: 15000 });
  await page.waitForFunction(async () => {
    const cache = await caches.open("doodhwala-v112");
    return !!(await cache.match("/Doodhwala/offline.html")) &&
      !!(await cache.match("/Doodhwala/customer-journey-refresh.css?v=20261025.1")) &&
      !!(await cache.match("/Doodhwala/doodhwala-ui-system.css?v=20261028.2")) &&
      !!(await cache.match("/Doodhwala/customer-ui-stability.css?v=20261028.1"));
  }, { timeout: 15000 });
  await page.screenshot({ path: path.join(evidenceDir, "home-online.png"), fullPage: true });
  evidence.checks.push("worker installed and required offline shell/exact CSS variant cached");

  const queryUrl = new URL("/Doodhwala/orders.html?filter=active", origin).href;
  const queryResponse = await page.goto(queryUrl, { waitUntil: "domcontentloaded" });
  assert.ok(queryResponse && queryResponse.ok(), "query-string route loads online");
  await page.waitForFunction(async url => {
    const cache = await caches.open("doodhwala-v112");
    return !!(await cache.match(url));
  }, queryUrl, { timeout: 10000 });
  await page.screenshot({ path: path.join(evidenceDir, "orders-query-online.png"), fullPage: true });
  evidence.checks.push("exact query-string route persisted before response completed");

  const cacheEvidence = await page.evaluate(async () => {
    const names = await caches.keys();
    const cache = await caches.open("doodhwala-v112");
    return {
      names,
      oldDoodhwalaCacheRemoved: !names.includes("doodhwala-v97"),
      unrelatedCachePreserved: names.includes("unrelated-origin-cache-test"),
      offlineFallbackCached: !!(await cache.match("/Doodhwala/offline.html")),
      checkoutCssExactVariantCached: !!(await cache.match("/Doodhwala/customer-journey-refresh.css?v=20261025.1")),
      mascotUnversionedCached: !!(await cache.match("/Doodhwala/assets/mascot.png")),
      sharedUiCssCached: !!(await cache.match("/Doodhwala/doodhwala-ui-system.css?v=20261028.2")),
      customerUiCssCached: !!(await cache.match("/Doodhwala/customer-ui-stability.css?v=20261028.1")),
      profileDetailsRouteCached: !!(await cache.match("/Doodhwala/profile/details/")),
      aboutRouteCached: !!(await cache.match("/Doodhwala/about/")),
      aboutDocumentCached: !!(await cache.match("/Doodhwala/about/index.html")),
      profileDetailsRuntimeCached: !!(await cache.match("/Doodhwala/profile-details.js?v=20261029.2"))
    };
  });
  assert.ok(cacheEvidence.oldDoodhwalaCacheRemoved, "obsolete Doodhwala cache is removed");
  assert.ok(cacheEvidence.unrelatedCachePreserved, "unrelated origin cache remains");
  assert.ok(cacheEvidence.offlineFallbackCached, "offline fallback is cached");
  assert.ok(cacheEvidence.checkoutCssExactVariantCached, "exact versioned checkout CSS is cached");
  assert.ok(cacheEvidence.mascotUnversionedCached, "unversioned mascot URL is cached");
  assert.ok(cacheEvidence.sharedUiCssCached, "shared UI consistency stylesheet is cached");
  assert.ok(cacheEvidence.customerUiCssCached, "customer mobile stability stylesheet is cached");
  assert.ok(cacheEvidence.profileDetailsRouteCached, "personal details route is cached for offline access");
  assert.ok(cacheEvidence.aboutRouteCached, "About route is cached for offline access");
  assert.ok(cacheEvidence.aboutDocumentCached, "About document is cached for offline access");
  assert.ok(cacheEvidence.profileDetailsRuntimeCached, "personal details runtime is cached for offline access");
  evidence.cache = cacheEvidence;

  await context.setOffline(true);
  const fallback = await page.goto(new URL("not-cached-route.html", base).href, { waitUntil: "domcontentloaded" });
  assert.ok(fallback, "offline navigation resolves through the service-worker fallback");
  assert.match(await page.locator("h1").innerText(), /connection took a break/i);
  await page.screenshot({ path: path.join(evidenceDir, "offline-fallback.png"), fullPage: true });
  evidence.checks.push("uncached offline navigation shows the honest offline fallback");

  await context.setOffline(false);
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.screenshot({ path: path.join(evidenceDir, "reconnected-home.png"), fullPage: true });
  evidence.checks.push("reconnect returns to the site; manual refresh remains the way to ensure fresh content");
  fs.writeFileSync(path.join(evidenceDir, "pwa-browser-results.json"), JSON.stringify(evidence, null, 2));
  console.log("PWA offline browser smoke passed; screenshots and JSON evidence are in artifacts/pwa.");
} finally {
  await context.close();
  await browser.close();
}
