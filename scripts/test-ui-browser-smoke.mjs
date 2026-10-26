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
    // Keep this test isolated from live services/customer data; exercise the static UI shell only.
    await page.route("**/*", route => { const url = new URL(route.request().url()); if (url.hostname !== "127.0.0.1" || url.port !== "4173") return route.abort(); return route.continue(); });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    const response = await page.goto(base, { waitUntil: "domcontentloaded" });
    assert.ok(response && response.ok(), `home route returns HTTP success at ${width}px`);
    await page.waitForSelector(".customer-bottom-nav", { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(350);
    const evidence = await page.evaluate(() => {
      const nav = document.querySelector(".customer-bottom-nav");
      const search = document.querySelector("#search");
      const rects = [...document.querySelectorAll("body *")].filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && getComputedStyle(el).position !== "fixed" &&
          (r.left < -1 || r.right > window.innerWidth + 1);
      }).slice(0, 12).map(el => ({ tag: el.tagName, id: el.id, className: String(el.className || "").slice(0, 90),
        left: Math.round(el.getBoundingClientRect().left), right: Math.round(el.getBoundingClientRect().right) }));
      return {
        viewport: { width: innerWidth, height: innerHeight },
        documentWidth: document.documentElement.scrollWidth,
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
        overflowElements: rects,
        bottomNavExists: !!nav,
        bottomNavVisible: !!nav && getComputedStyle(nav).display !== "none" && nav.getBoundingClientRect().height > 0,
        navLabels: nav ? [...nav.querySelectorAll(".customer-nav-item span")].map(el => getComputedStyle(el).fontSize) : [],
        searchAccessibleName: search?.getAttribute("aria-label") || search?.getAttribute("aria-labelledby") || "",
      };
    });
    await page.screenshot({ path: path.join(out, `home-${width}px.png`), fullPage: true });
    results.push({ viewport: width, ...evidence, pageErrors: errors });
    if (width <= 760) assert.ok(evidence.bottomNavVisible, `mobile bottom navigation is visible at ${width}px`);
    if (width > 760) assert.ok(!evidence.bottomNavVisible, `mobile bottom navigation is hidden at ${width}px`);
    assert.equal(evidence.searchAccessibleName, "Search milk, provider or area", `search has accessible name at ${width}px`);
    assert.deepEqual(errors, [], `no uncaught page errors at ${width}px`);
    await page.close();
  }
  fs.writeFileSync(path.join(out, "viewport-results.json"), JSON.stringify(results, null, 2));
  const overflow = results.filter(r => r.horizontalOverflow);
  if (overflow.length) {
    console.error("HORIZONTAL_OVERFLOW_FINDINGS", JSON.stringify(overflow.map(r => ({ viewport:r.viewport, documentWidth:r.documentWidth, elements:r.overflowElements })), null, 2));
    throw new Error(`Horizontal overflow detected at viewport(s): ${overflow.map(r => r.viewport).join(", ")}px; see viewport-results.json and screenshots.`);
  }
  console.log("UI viewport browser smoke passed at 320, 390, 768, 1024 and 1440 CSS px. Screenshots and JSON evidence are in artifacts/ui.");
} finally {
  await browser.close();
}
