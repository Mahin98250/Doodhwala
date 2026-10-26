import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const nav = read("customer-nav.js");
const home = read("index.html");
const checkout = read("checkout.html");
const auth = read("auth.html");
const app = read("app.js");
const product = read("product.js");
const location = read("location.js");
const checkoutJs = read("checkout.js");

// Regression contracts for the shared customer navigation. These checks protect
// existing destinations and state updates while styling/readability is changed.
for (const [key, label] of [
  ["home", "Home"],
  ["explore", "Explore"],
  ["plans", "Plans"],
  ["orders", "Orders"],
  ["saved", "Saved"],
  ["cart", "Cart"],
]) {
  assert.ok(nav.includes(`item("${key}","${label}"`), `missing nav item: ${label}`);
  assert.ok(nav.includes(`if(key==="${key}")`), `missing navigation handler: ${key}`);
}

assert.ok(nav.includes('addEventListener("click"'), "navigation buttons must retain click handlers");
assert.ok(nav.includes('setAttribute("aria-current"'), "active destination must expose aria-current");
assert.ok(nav.includes('addEventListener("doodhwala:view-changed"'), "shared navigation must update active state for in-page view changes");
assert.ok(app.includes('new CustomEvent("doodhwala:view-changed"'), "home view changes must notify shared navigation");
assert.ok(nav.includes('updateCartBadge(nav)'), "cart badge must be refreshed");
assert.ok(nav.includes('addEventListener("storage"'), "cart badge must react to cross-tab storage changes");
assert.ok(nav.includes('addEventListener("doodhwala:cart-updated"'), "cart badge must react to cart updates");
assert.ok(nav.includes('font-size:9px'), "mobile nav labels must retain the improved readable size");
assert.ok(nav.includes('font-size:8.5px'), "small-screen nav labels must retain the responsive size");
assert.ok(home.includes("customer-nav.js"), "home page must load shared customer navigation");
assert.ok(checkout.includes("customer-nav.js"), "checkout must load shared customer navigation");
assert.ok(auth.includes("session-controls.js"), "authentication page must retain session controls");




// Source-level customer journey regression contracts. These checks guard wiring
// and safe recovery copy; they do not replace browser/device interaction tests.
assert.ok(home.includes('id="search" aria-label="Search milk, provider or area"'),
  "marketplace search must have a programmatic accessible name");
assert.ok(app.includes('$("search")?.addEventListener("input"'),
  "marketplace search input must remain wired to result filtering");
assert.ok(app.includes('$("providerSort")?.addEventListener("change"'),
  "provider sort control must remain wired");
assert.ok(app.includes('dataState==="error"') && app.includes('retryProviders'),
  "marketplace error state and retry path must remain available");
assert.ok(app.includes('if(!list.length)'),
  "marketplace must retain a no-results state");
assert.ok(product.includes('params.get("provider")') && product.includes('params.get("product")'),
  "product detail must read provider and product identifiers from the URL");
assert.ok(product.includes("function add()") && product.includes('function saveCart(c)'),
  "product detail must retain its add-to-cart and cart persistence paths");
assert.ok(product.includes('new Event("doodhwala:cart-updated")'),
  "product cart changes must notify shared navigation badge");
assert.ok(product.includes('button.disabled=true'),
  "unavailable product state must disable add-to-cart");
assert.ok(location.includes("navigator.geolocation.getCurrentPosition"),
  "location picker must retain its explicit permission request");
assert.ok(location.includes("Location permission was denied."),
  "location denial must be explained to the customer");
assert.ok(checkoutJs.includes('$("authGate").classList.remove("hidden")'),
  "checkout must expose a sign-in gate when the user is unauthenticated");
assert.ok(checkoutJs.includes("!Doodhwala.configured"),
  "checkout must not proceed when backend configuration is missing");
assert.ok(checkoutJs.includes('let placingOrder=false'),
  "checkout must retain its duplicate-submit guard");
assert.ok(checkoutJs.includes('CHECKOUT_KEYS_KEY'),
  "checkout must retain its idempotency key storage contract");
assert.ok(auth.includes('id="email" type="email"') && auth.includes('id="password" type="password"'),
  "authentication fields must retain appropriate input types");
assert.ok(auth.includes('id="email" type="email" autocomplete="email" placeholder="you@example.com" required'),
  "email must remain required");
assert.ok(auth.includes('id="password" type="password" autocomplete="current-password" minlength="8"'),
  "password must retain its minimum length");

console.log("UI and customer journey source-contract checks passed (browser interaction tests still required).");
