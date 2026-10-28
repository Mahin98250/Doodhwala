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
    const cache = await caches.open("doodhwala-v106");
    return !!(await cache.match("/Doodhwala/offline.html")) &&
      !!(await cache.match("/Doodhwala/customer-journey-refresh.css?v=20261025.1")) &&
      !!(await cache.match("/Doodhwala/experience-layer.css?v=20261028.3")) &&
      !!(await cache.match("/Doodhwala/clean-ui.css?v=20261028.1"));
  }, { timeout: 15000 });
  await page.screenshot({ path: path.join(evidenceDir, "home-online.png"), fullPage: true });
  evidence.checks.push("worker installed and required offline shell, checkout CSS, and shared UI layer cached");

  const queryUrl = new URL("/Doodhwala/orders.html?filter=active", origin).href;
  const queryResponse = await page.goto(queryUrl, { waitUntil: "domcontentloaded" });
  assert.ok(queryResponse && queryResponse.ok(), "query-string route loads online");
  await page.waitForFunction(async url => {
    const cache = await caches.open("doodhwala-v106");
    return !!(await cache.match(url));
  }, queryUrl, { timeout: 10000 });
  await page.screenshot({ path: path.join(evidenceDir, "orders-query-online.png"), fullPage: true });
  evidence.checks.push("exact query-string route persisted before response completed");

  const cacheEvidence = await page.evaluate(async () => {
    const names = await caches.keys();
    const cache = await caches.open("doodhwala-v106");
    return {
      names,
      oldDoodhwalaCacheRemoved: !names.includes("doodhwala-v97"),
      unrelatedCachePreserved: names.includes("unrelated-origin-cache-test"),
      offlineFallbackCached: !!(await cache.match("/Doodhwala/offline.html")),
      checkoutCssExactVariantCached: !!(await cache.match("/Doodhwala/customer-journey-refresh.css?v=20261025.1")),
      sharedUiLayerCached: !!(await cache.match("/Doodhwala/experience-layer.css?v=20261028.3")),
      cleanUiStylesheetCached: !!(await cache.match("/Doodhwala/clean-ui.css?v=20261028.1")),
      mascotUnversionedCached: !!(await cache.match("/Doodhwala/assets/mascot.png"))
    };
  });
  assert.ok(cacheEvidence.oldDoodhwalaCacheRemoved, "obsolete Doodhwala cache is removed");
  assert.ok(cacheEvidence.unrelatedCachePreserved, "unrelated origin cache remains");
  assert.ok(cacheEvidence.offlineFallbackCached, "offline fallback is cached");
  assert.ok(cacheEvidence.checkoutCssExactVariantCached, "exact versioned checkout CSS is cached");
  assert.ok(cacheEvidence.sharedUiLayerCached, "shared UI stylesheet is cached for offline route rendering");
  assert.ok(cacheEvidence.cleanUiStylesheetCached, "final clean UI stylesheet is cached for offline route rendering");
  assert.ok(cacheEvidence.mascotUnversionedCached, "unversioned mascot URL is cached");
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

  // Run route/layout assertions in a fresh context with service workers blocked.
  // This keeps the visual audit independent of the intentionally manipulated
  // offline/service-worker state above while still testing the same local build.
  const visualContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block"
  });
  const visualPage = await visualContext.newPage();
  const failedVisualRequests = [];
  visualPage.on("requestfailed", request => {
    failedVisualRequests.push({
      url: request.url(),
      failure: request.failure()?.errorText || "unknown"
    });
    if (failedVisualRequests.length > 25) failedVisualRequests.shift();
  });
  await visualPage.route("**/*", route => {
    const url = new URL(route.request().url());
    // auth.js intentionally redirects local-origin auth pages to the production
    // OAuth-capable site. This smoke only checks static route markup/layout, so
    // stub that one script in this isolated visual context; auth behavior remains
    // covered by its own contracts and is not changed in application code.
    if (url.origin === origin && url.pathname === "/Doodhwala/auth.js") {
      return route.fulfill({
        status: 200,
        contentType: "application/javascript; charset=utf-8",
        body: "/* auth interactions intentionally excluded from static route-layout smoke */"
      });
    }
    if (url.origin !== origin) return route.abort();
    return route.continue();
  });

  // Route-family visual smoke: verify the final shared layer is present and
  // record actual layout widths for the customer, seller, and owner shells.
  const visualRoutes = [
    ["home", ""],
    ["auth", "auth/"],
    ["checkout", "checkout/"],
    ["orders", "orders/"],
    ["plans", "plans/"],
    ["product", "product/"],
    ["store", "store/"],
    ["provider", "provider/"],
    ["admin", "admin/"],
    ["notifications", "notifications/"],
    ["support", "support/"],
    ["legal", "legal/"]
  ];
  evidence.visualRoutes = [];
  for (const viewport of [
    {name:"mobile",width:390,height:844},
    {name:"desktop",width:1440,height:900}
  ]) {
    await visualPage.setViewportSize({width:viewport.width,height:viewport.height});
    for (const [name,route] of visualRoutes) {
      const target = route ? new URL(route, base).href : base;
      const routeResponse = await visualPage.goto(target,{waitUntil:"domcontentloaded"});
      assert.ok(routeResponse && routeResponse.ok(),
        name + " " + viewport.name + " route must load; target=" + target +
        "; status=" + (routeResponse?.status() ?? "no response") +
        "; finalURL=" + visualPage.url() +
        "; failedRequests=" + JSON.stringify(failedVisualRequests));

      // Capture the page after the branded intro is dismissed, not while it
      // covers the underlying layout. This is visual evidence only: external
      // backend/CDN requests remain blocked in this static route-layout smoke.
      if (name === "home") {
        const skipIntro = visualPage.getByRole("button", { name: /skip intro/i });
        await skipIntro.waitFor({ state: "visible", timeout: 1500 }).catch(() => {});
        if (await skipIntro.isVisible().catch(() => false)) {
          await skipIntro.click();
          await visualPage.waitForFunction(() => {
            const splash = document.getElementById("dwSplash");
            return !splash || splash.hidden;
          }, { timeout: 2000 });
        }
      }
      await visualPage.evaluate(async () => {
        if (document.fonts?.ready) await document.fonts.ready;
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });
      const layout = await visualPage.evaluate(() => ({
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        cleanUiLink: !!document.querySelector('link[rel="stylesheet"][href*="clean-ui.css?v=20261028.1"]'),
        stylesheetHrefs: [...document.querySelectorAll('link[rel="stylesheet"]')].map(link => link.getAttribute("href")),
        pageUrl: window.location.href,
        title: document.title,
        heading: document.querySelector("h1")?.textContent?.trim() || ""
      }));
      assert.ok(layout.cleanUiLink,
        name + " must include the final shared clean UI layer; target=" + target +
        "; URL=" + layout.pageUrl +
        "; stylesheet hrefs=" + JSON.stringify(layout.stylesheetHrefs) +
        "; failedRequests=" + JSON.stringify(failedVisualRequests));
      assert.equal(layout.horizontalOverflow, false,
        name + " " + viewport.name + " layout must not overflow horizontally (document " +
        layout.documentWidth + "px / viewport " + layout.viewportWidth + "px)");
      await visualPage.screenshot({path:path.join(evidenceDir,"route-"+name+"-"+viewport.name+".png")});
      evidence.visualRoutes.push({route:name,viewport:viewport.name,...layout});
    }
  }
  evidence.checks.push("12 route families rendered at mobile and desktop widths with the clean UI layer present and no horizontal overflow");
  await visualContext.close();
  fs.writeFileSync(path.join(evidenceDir, "pwa-browser-results.json"), JSON.stringify(evidence, null, 2));
  console.log("PWA offline browser smoke passed; screenshots and JSON evidence are in artifacts/pwa.");
} finally {
  await context.close();
  await browser.close();
}
