import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("../", import.meta.url);
const sharedHref = "/Doodhwala/doodhwala-ui-system.css?v=20261028.1";
const homeHref = "/Doodhwala/doodhwala-ui-system.css?v=20261028.2";
const customerHref = "/Doodhwala/customer-ui-stability.css?v=20261028.1";
const pages = [
  "index.html", "profile.html", "profile/index.html",
  "auth.html", "auth/index.html",
  "checkout.html", "checkout/index.html",
  "plans.html", "plans/index.html",
  "orders.html", "orders/index.html",
  "product.html", "product/index.html",
  "store.html", "store/index.html",
  "provider.html", "provider/index.html",
  "admin.html", "admin/index.html",
  "notifications.html", "notifications/index.html",
  "support.html", "support/index.html",
  "legal.html", "legal/index.html"
];

for (const path of pages) {
  const html = fs.readFileSync(new URL(path, root), "utf8");
  assert.ok(html.includes(path === "index.html" ? homeHref : sharedHref), `${path} must load the expected shared UI consistency layer`);
}
const home = fs.readFileSync(new URL("index.html", root), "utf8");
assert.ok(home.includes(customerHref), "home must load its focused mobile empty-state fixes");
assert.ok(home.includes(homeHref), "home must use the refreshed mobile header stylesheet URL");

const css = fs.readFileSync(new URL("doodhwala-ui-system.css", root), "utf8");
for (const [pattern, reason] of [
  [/\.home-page \.no-results>div:first-child svg path[\s\S]*?fill:none!important;stroke:currentColor!important/, "empty-state SVG paths must not render as an oversized solid black shape"],
  [/@media\(max-width:760px\)/, "mobile-specific layout rules must be present"],
  [/focus-visible/, "keyboard-visible focus feedback must be present"],
  [/env\(safe-area-inset-bottom/, "mobile controls must respect device safe areas"],
  [/prefers-reduced-motion:reduce/, "motion must respect reduced-motion preferences"],
  [/location-modal/, "the delivery location dialog must remain responsive"]
]) assert.match(css, pattern, reason);

const customer = fs.readFileSync(new URL("customer-ui-stability.css", root), "utf8");
assert.match(customer, /\.no-results>div:first-child svg/, "customer empty-state icon sizing must be explicit");
assert.match(customer, /grid-template-columns:minmax\(0,1fr\)!important/, "provider cards must collapse safely on narrow screens");

const sw = fs.readFileSync(new URL("sw.js", root), "utf8");
assert.match(sw, /const CACHE="doodhwala-v109"/, "UI release must advance the PWA cache revision");
assert.ok(sw.includes(homeHref), "refreshed home stylesheet must be precached for offline shell consistency");
assert.ok(sw.includes(customerHref), "customer empty-state stylesheet must be precached");

console.log("Shared UI system contracts passed: customer, seller, admin, clean routes, responsive states, accessibility, and PWA cache.");
