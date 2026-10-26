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
  // Route interaction checks use a separate context with service workers disabled.
  // External APIs/CDNs are blocked; auth.js is stubbed because it intentionally
  // redirects localhost to production. No live account or order action is used.
  const interactionContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block"
  });
  const baseOrigin = new URL(base).origin;
  const interactionResults = [];
  try {
    await interactionContext.route("**/*", route => {
      const url = new URL(route.request().url());
      if (url.origin !== baseOrigin) return route.abort();
      if (url.pathname === "/Doodhwala/auth.js") {
        return route.fulfill({
          status: 200,
          contentType: "application/javascript",
          body: "/* auth runtime disabled in isolated browser smoke */"
        });
      }
      return route.continue();
    });
    const page = await interactionContext.newPage();
    const homeResponse = await page.goto(base, { waitUntil: "domcontentloaded" });
    assert.ok(homeResponse && homeResponse.ok(), "interactive smoke home route loads");
    await page.waitForSelector(".customer-bottom-nav", { timeout: 8000 });
    assert.equal(await page.locator(".customer-bottom-nav [data-customer-nav]").count(), 6,
      "mobile navigation exposes all six destinations");

    const search = page.locator("#search");
    await search.fill("smoke-test-no-live-provider");
    assert.equal(await search.inputValue(), "smoke-test-no-live-provider", "search accepts typed input");
    assert.equal(await search.getAttribute("aria-label"), "Search milk, provider or area",
      "search remains programmatically named during interaction");

    await page.locator('[data-customer-nav="cart"]').click();
    await page.waitForFunction(() => document.body.classList.contains("drawer-open"), { timeout: 3000 });
    await page.locator("#closeCart").click();
    await page.waitForFunction(() => !document.body.classList.contains("drawer-open"), { timeout: 3000 });
    interactionResults.push({ check: "cart drawer open/close", status: "passed" });

    await page.locator('[data-customer-nav="plans"]').click();
    await page.waitForFunction(() => location.pathname.endsWith("/plans.html"), { timeout: 10000 });
    assert.match(await page.title(), /Milk Plans/i, "Plans navigation reaches the Plans route");
    interactionResults.push({ check: "Plans navigation", status: "passed" });

    await page.goto(base, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".customer-bottom-nav", { timeout: 8000 });
    await page.locator('[data-customer-nav="orders"]').click();
    await page.waitForFunction(() => location.pathname.endsWith("/orders.html"), { timeout: 10000 });
    assert.match(await page.title(), /Orders/i, "Orders navigation reaches the Orders route");
    interactionResults.push({ check: "Orders navigation", status: "passed" });

    await page.goto(base, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".customer-bottom-nav", { timeout: 8000 });
    await page.waitForSelector("#retryProviders", { timeout: 8000 });
    assert.ok(await page.locator("#retryProviders").isVisible(),
      "offline/blocked backend state presents a visible recovery action");
    await page.locator("#retryProviders").click();
    await page.waitForSelector("#retryProviders", { timeout: 8000 });
    interactionResults.push({ check: "marketplace error and retry", status: "passed" });

    const cdp = await interactionContext.newCDPSession(page);
    await cdp.send("Browser.setPermission", {
      permission: { name: "geolocation" },
      setting: "denied",
      origin: baseOrigin
    });
    await page.locator("#locationHero").click();
    await page.locator("#locationUseMe").click();
    await page.waitForFunction(
      () => document.getElementById("locationState")?.textContent.includes("Location permission was denied."),
      { timeout: 5000 }
    );
    assert.match(await page.locator("#locationState").innerText(), /Location permission was denied/i,
      "location denial is explained and recoverable");
    await page.screenshot({ path: path.join(out, "location-denied-390px.png"), fullPage: true });
    interactionResults.push({ check: "geolocation denial recovery message", status: "passed" });
    await cdp.detach();

    const authPage = await interactionContext.newPage();
    const authResponse = await authPage.goto(new URL("auth.html", base).href, { waitUntil: "domcontentloaded" });
    assert.ok(authResponse && authResponse.ok(), "auth form loads in isolated test context");
    const initialValidity = await authPage.locator("#authForm").evaluate(form => ({
      formValid: form.checkValidity(),
      emailRequired: form.querySelector("#email").required,
      emailMissing: form.querySelector("#email").validity.valueMissing,
      passwordRequired: form.querySelector("#password").required,
      passwordMissing: form.querySelector("#password").validity.valueMissing
    }));
    assert.equal(initialValidity.formValid, false, "blank auth form is rejected by native validation");
    assert.equal(initialValidity.emailRequired, true);
    assert.equal(initialValidity.emailMissing, true);
    assert.equal(initialValidity.passwordRequired, true);
    assert.equal(initialValidity.passwordMissing, true);
    await authPage.locator("#email").fill("not-an-email");
    await authPage.locator("#password").fill("short");
    const invalidValidity = await authPage.locator("#authForm").evaluate(form => ({
      emailTypeMismatch: form.querySelector("#email").validity.typeMismatch,
      passwordTooShort: form.querySelector("#password").validity.tooShort
    }));
    assert.equal(invalidValidity.emailTypeMismatch, true, "malformed email is rejected");
    assert.equal(invalidValidity.passwordTooShort, true, "short password is rejected");
    await authPage.screenshot({ path: path.join(out, "auth-validation-390px.png"), fullPage: true });
    interactionResults.push({ check: "auth native validation", status: "passed" });

    const checkoutPage = await interactionContext.newPage();
    const checkoutResponse = await checkoutPage.goto(new URL("checkout.html", base).href, { waitUntil: "domcontentloaded" });
    assert.ok(checkoutResponse && checkoutResponse.ok(), "checkout entry route loads");
    const requiredAddressFields = await checkoutPage.evaluate(() =>
      ["recipient", "addressPhone", "addressLine", "addressArea", "addressCity", "addressPin"]
        .map(id => ({ id, required: !!document.getElementById(id)?.required }))
    );
    assert.ok(requiredAddressFields.every(field => field.required),
      "checkout address fields retain required validation");
    assert.equal(await checkoutPage.locator("#checkoutState").count(), 1,
      "checkout exposes its status/recovery region");
    await checkoutPage.screenshot({ path: path.join(out, "checkout-entry-390px.png"), fullPage: true });
    interactionResults.push({ check: "checkout entry and required address fields", status: "passed" });

    fs.writeFileSync(path.join(out, "interaction-results.json"), JSON.stringify(interactionResults, null, 2));
  } finally {
    await interactionContext.close();
  }
  console.log("UI Chromium smoke passed: five viewport sizes plus navigation, cart drawer, search, error retry, denied geolocation, auth validation and checkout-entry contracts. Evidence is in artifacts/ui.");
} finally {
  await browser.close();
}
