import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const base = process.env.DOODHWALA_BASE_URL || "http://127.0.0.1:4173/Doodhwala/";
const out = process.env.EVIDENCE_DIR || "artifacts/ui";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const width of [320, 390, 768, 1024, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: width <= 390 ? 844 : width === 768 ? 1024 : 900 } });
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.route("**/*", route => {
      const url = new URL(route.request().url());
      if (url.origin !== new URL(base).origin) return route.abort();
      return route.continue();
    });
    const response = await page.goto(base, { waitUntil: "domcontentloaded" });
    assert.ok(response?.ok(), `home route loads at ${width}px`);
    await page.waitForTimeout(500);
    const state = await page.evaluate(() => {
      const nav = document.querySelector(".customer-bottom-nav");
      const search = document.querySelector("#search");
      return {
        width: innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        overflow: document.documentElement.scrollWidth > innerWidth,
        navVisible: !!nav && getComputedStyle(nav).display !== "none" && nav.getBoundingClientRect().height > 0,
        navItems: nav ? [...nav.querySelectorAll("[data-customer-nav]")].map(b => b.dataset.customerNav) : [],
        searchName: search?.getAttribute("aria-label") || "",
      };
    });
    await page.screenshot({ path: path.join(out, `home-${width}px.png`), fullPage: true });
    results.push({ ...state, pageErrors: errors });
    if (width <= 760) {
      assert.ok(state.navVisible, `mobile navigation visible at ${width}px`);
      assert.equal(state.navItems.length, 7, "seven customer navigation destinations exist");
    } else assert.equal(state.navVisible, false, `mobile navigation hidden at ${width}px`);
    assert.equal(state.searchName, "Search milk, provider or area", "search has accessible name");
    assert.equal(state.overflow, false, `no horizontal overflow at ${width}px`);
    assert.deepEqual(errors, [], `no uncaught page errors at ${width}px`);
    if (width === 390) {
      await page.waitForFunction(() => typeof window.__doodhwalaNavigate === "function", null, { timeout: 5000 });
      for (const key of ["explore", "saved", "home"]) {
        const selector = `[data-customer-nav="${key}"]`;
        await page.locator(selector).click();
        await page.waitForFunction(sel => document.querySelector(sel)?.getAttribute("aria-current") === "page", selector, { timeout: 5000 });
      }
    }
    await page.close();
  }

  for (const route of ["checkout/", "auth/", "plans/", "orders/", "product/", "support/", "provider.html"]) {
    for (const width of [390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 844 } });
      await page.route("**/*", routeReq => {
        const url = new URL(routeReq.request().url());
        if (url.origin !== new URL(base).origin) return routeReq.abort();
        if (url.pathname === "/Doodhwala/auth.js") return routeReq.fulfill({status:200,contentType:"application/javascript",body:"/* auth disabled in isolated UI smoke */"});
        return routeReq.continue();
      });
      const response = await page.goto(new URL(route, base).href, { waitUntil: "domcontentloaded" });
      assert.ok(response?.ok(), `${route} loads at ${width}px`);
      await page.waitForTimeout(250);
      const size = await page.evaluate(() => ({scroll:document.documentElement.scrollWidth,width:innerWidth}));
      await page.screenshot({path:path.join(out, `${route.replaceAll("/","-")||"home"}-${width}px.png`),fullPage:true});
      assert.ok(size.scroll <= size.width, `${route} has no horizontal overflow at ${width}px`);
      await page.close();
    }
  }
  fs.writeFileSync(path.join(out, "results.json"), JSON.stringify(results, null, 2));
  console.log("DW-002 Chromium viewport, navigation, route-layout, and screenshot checks passed.");
} finally { await browser.close(); }
