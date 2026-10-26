import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const nav = read("customer-nav.js");
const home = read("index.html");
const checkout = read("checkout.html");
const auth = read("auth.html");

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
assert.ok(nav.includes('updateCartBadge(nav)'), "cart badge must be refreshed");
assert.ok(nav.includes('addEventListener("storage"'), "cart badge must react to cross-tab storage changes");
assert.ok(nav.includes('addEventListener("doodhwala:cart-updated"'), "cart badge must react to cart updates");
assert.ok(nav.includes('font-size:9px'), "mobile nav labels must retain the improved readable size");
assert.ok(nav.includes('font-size:8.5px'), "small-screen nav labels must retain the responsive size");
assert.ok(home.includes("customer-nav.js"), "home page must load shared customer navigation");
assert.ok(checkout.includes("customer-nav.js"), "checkout must load shared customer navigation");
assert.ok(auth.includes("session-controls.js"), "authentication page must retain session controls");

console.log("UI regression contracts passed (source-level; browser interaction tests still required).");
