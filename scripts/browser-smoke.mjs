import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(new URL(import.meta.url));
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || "playwright");
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const port = Number(process.env.BROWSER_SMOKE_PORT || 4173);
const files = new Set([
  "index.html","orders.html","orders.js","orders.css","styles.css","customer-market-10x.js","checkout-10x.js",
  "experience-layer.css","customer-journey-refresh.css","direct-upi-checkout.css",
  "customer-ui-polish.css","milk-transition.css","resilience.js","supabase-config.js",
  "supabase-client.js","direct-upi-checkout.js","customer-nav.js","customer-10x.js",
  "session-controls.js","pwa-register.js","network-status.js","provider.html",
  "provider.css","provider.js","provider-10x.js","provider-location.js","provider-location.css",
  "provider-location.css","milk-transition.js","provider-journey.js","provider-nav.js","assets/mascot.png",
  "manifest.webmanifest","sw.js","admin.html"
]);
const mime = file => file.endsWith(".html") ? "text/html; charset=utf-8"
  : file.endsWith(".js") ? "text/javascript; charset=utf-8"
  : file.endsWith(".css") ? "text/css; charset=utf-8"
  : file.endsWith(".webmanifest") || file.endsWith(".json") ? "application/manifest+json"
  : file.endsWith(".png") ? "image/png" : "application/octet-stream";

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const pathname = decodeURIComponent(url.pathname);
    if (!pathname.startsWith("/Doodhwala/") && pathname !== "/Doodhwala") {
      res.writeHead(404); res.end("not found"); return;
    }
    const relative = pathname === "/Doodhwala" || pathname === "/Doodhwala/"
      ? "index.html" : pathname.slice("/Doodhwala/".length);
    if (!files.has(relative) || relative.includes("..")) { res.writeHead(404); res.end("not found"); return; }
    const bytes = await readFile(path.join(root, relative));
    res.writeHead(200, { "content-type": mime(relative), "cache-control": "no-store" });
    res.end(bytes);
  } catch {
    res.writeHead(404); res.end("not found");
  }
});

let browser;
try {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const pageErrors = [];
  const localHttpFailures = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("response", response => {
    const url = new URL(response.url());
    if (url.hostname === "127.0.0.1" && response.status() >= 400) {
      localHttpFailures.push(response.status() + " " + url.pathname);
    }
  });
  // This synthetic browser test never calls backend features. Keep error telemetry local
  // and deterministic rather than sending a test-runner incident to the configured project.
  await page.route("https://hmiboyfcvtfawrwujslg.supabase.co/functions/v1/client-error-report", async route => {
    await route.fulfill({
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": `http://127.0.0.1:${port}`,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
        "Access-Control-Max-Age": "600"
      },
      body: ""
    });
  });

  const customerResponse = await page.goto(`http://127.0.0.1:${port}/Doodhwala/orders.html`, { waitUntil: "domcontentloaded" });
  assert.equal(customerResponse.status(), 200, "orders page should load");
  assert.equal(await page.title(), "Doodhwala — Orders");
  assert.equal(await page.locator(".orders-brand b").innerText(), "Doodhwala");
  assert.ok(await page.locator("#ordersState").count(), "customer order state region exists");
  assert.ok(await page.locator("#ordersGate").count(), "signed-out customer gate exists");
  assert.ok(await page.locator("#refreshOrders").isVisible(), "refresh action is visible on mobile");
  const customerOverflow = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  assert.ok(customerOverflow.scroll <= customerOverflow.viewport + 1, "customer order page should not overflow horizontally on mobile");
  await page.keyboard.press("Tab");
  assert.ok(await page.evaluate(() => document.activeElement !== document.body), "keyboard focus should move to a control");

  const sellerResponse = await page.goto(`http://127.0.0.1:${port}/Doodhwala/provider.html`, { waitUntil: "domcontentloaded" });
  assert.equal(sellerResponse.status(), 200, "seller dashboard page should load");
  assert.equal(await page.title(), "Doodhwala Provider — Local Seller Dashboard");
  assert.ok(await page.locator("#onboarding").isVisible(), "first-time seller sees onboarding");
  assert.ok(await page.getByRole("heading", { name: "Tell us about your milk business." }).isVisible());
  assert.ok(await page.locator("#providerName").isVisible(), "seller name field is visible");
  assert.ok(await page.locator("#phone").isVisible(), "mobile number field is visible");
  assert.ok(await page.locator(".next-step[data-next='2']").isVisible(), "seller can continue onboarding");
  await page.locator("#providerName").fill("Browser Test Milk Home");
  await page.locator("#ownerName").fill("Browser Test Seller");
  await page.locator("#phone").fill("9876543210");
  await page.locator("#providerType").selectOption("cow");
  await page.locator(".next-step[data-next='2']").click();
  assert.ok(await page.getByRole("heading", { name: "Where do you deliver?" }).isVisible(), "seller flow advances to delivery setup");
  assert.ok(await page.locator("#baseArea").isVisible(), "delivery locality field appears in step 2");
  await page.locator("#baseArea").fill("Bhadaj");
  await page.locator("#pincode").fill("380060");
  await page.locator(".next-step[data-next='3']").click();
  assert.ok(await page.getByRole("heading", { name: "Add your first milk." }).isVisible(), "seller flow advances to catalogue setup");
  assert.ok(await page.locator("#firstMilkPrice").isVisible(), "first product price field is visible");
  const sellerOverflow = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  assert.ok(sellerOverflow.scroll <= sellerOverflow.viewport + 1, "seller onboarding should not overflow horizontally on mobile");
  assert.deepEqual(pageErrors, [], "browser should not report uncaught JavaScript errors during the smoke flow");
  assert.deepEqual(localHttpFailures, [], "all browser-requested local page assets should load successfully");

  console.log("PASS: mobile Chromium smoke — customer orders page, keyboard focus, responsive width, seller onboarding form and three-step navigation.");
  console.log("LIMIT: synthetic local-only browser flow; no account authentication, Supabase requests, real orders, payments or production mutation.");
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
