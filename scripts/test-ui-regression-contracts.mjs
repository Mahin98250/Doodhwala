import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const nav = read("customer-nav.js");
const home = read("index.html");
const app = read("app.js");
const checkout = read("checkout/index.html");
const checkoutJs = read("checkout.js");
const provider = read("provider.html");

for (const [key, label] of [
  ["home", "Home"], ["explore", "Explore"], ["plans", "Plans"],
  ["orders", "Orders"], ["saved", "Saved"], ["cart", "Cart"], ["profile", "Profile"]
]) {
  assert.ok(nav.includes(`item("${key}","${label}"`), `missing customer navigation item: ${label}`);
}
assert.ok(nav.includes('setAttribute("aria-current"'), "navigation must expose current destination");
assert.ok(nav.includes('addEventListener("doodhwala:view-changed"'), "navigation must respond to in-page view changes");
assert.ok(nav.includes("font-size:9px") && nav.includes("font-size:8.5px"), "mobile nav labels must retain improved sizes");
assert.ok(home.includes('id="search" type="search" aria-label="Search milk, provider or area"'), "search input must have an accessible name");
assert.ok(app.includes('new CustomEvent("doodhwala:view-changed"'), "in-page view changes must notify navigation");
assert.ok(app.includes('dataState==="loading"') && app.includes('provider-skeleton'), "marketplace must show a loading state");
assert.ok(app.includes('dataState==="error"') && app.includes('retryProviders'), "marketplace error state must offer retry");
assert.ok(app.includes('if(!list.length)'), "marketplace must render an empty/no-results state");
assert.ok(app.includes('clearDiscoverySearch') || app.includes('No providers match'), "filtered empty state must explain recovery");
assert.ok(checkout.includes('id="authGate"'), "checkout must expose its signed-out gate");
assert.ok(checkoutJs.includes("let placingOrder=false"), "checkout must guard duplicate submits");
assert.ok(checkoutJs.includes("CHECKOUT_KEYS_KEY"), "checkout must retain idempotency-key handling");
assert.ok(provider.includes('data-step="1"') && provider.includes('data-step="2"') && provider.includes('data-step="3"'), "provider onboarding must retain its three steps");
console.log("DW-002 UI regression source contracts passed.");
