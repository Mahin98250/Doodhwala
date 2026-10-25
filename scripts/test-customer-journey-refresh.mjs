import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");
const css = read("customer-journey-refresh.css");
const pages = ["store.html", "product.html", "plans.html", "orders.html", "checkout.html"];
for (const page of pages) {
  const html = read(page);
  const version = page === "plans.html" || page === "orders.html" ? "20261025.3" : "20261025.1";
  assert.ok(html.includes("customer-journey-refresh.css?v=" + version), page + " must load the cache-busted customer journey refresh");
}
for (const selector of [".market-page", ".plans-page", ".orders-page", ".checkout-page", ".product-card", ".store-identity", ".order-card", ".checkout-card"]) {
  assert.ok(css.includes(selector), "expected scoped styling for " + selector);
}
assert.match(css, /@media\(max-width:800px\)/, "mobile layout rules must exist");
assert.match(css, /prefers-reduced-motion:reduce/, "reduced-motion support must exist");
assert.doesNotMatch(css, /https?:\/\//i, "refresh must not add new external runtime dependencies");
const store = read("store.html");
const product = read("product.html");
const checkout = read("checkout.html");
for (const id of ["storeContent", "productGrid", "storeChangeLocation"]) assert.ok(store.includes('id="' + id + '"'), "store hook #" + id + " must remain");
for (const id of ["productContent", "addToCart", "quantity"]) assert.ok(product.includes('id="' + id + '"'), "product hook #" + id + " must remain");
for (const id of ["checkoutForm", "addressForm", "checkoutItems", "placeOrder", "success"]) assert.ok(checkout.includes('id="' + id + '"'), "checkout hook #" + id + " must remain");
console.log("Customer journey refresh contracts passed: five pages load scoped styling, responsive/reduced-motion rules exist, and key storefront/product/checkout hooks remain.");
