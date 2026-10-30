import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("../", import.meta.url);
const css = fs.readFileSync(new URL("doodhwala-ui-system.css", root), "utf8");
const pages = {
  home: ["index.html", ["id=\"search\"", "id=\"providers\"", "id=\"providersGrid\"", "id=\"chips\"", "id=\"providerSort\"", "id=\"deliverableOnly\"", "id=\"compareDock\"", "id=\"compareDialog\"", "id=\"openCart\""]],
  store: ["store/index.html", ["id=\"storeContent\"", "id=\"productGrid\"", "id=\"storeMap\""]],
  product: ["product/index.html", ["id=\"productContent\"", "id=\"quantity\"", "id=\"addToCart\"", "id=\"planLink\""]]
};
for (const [name, [path, hooks]] of Object.entries(pages)) {
  const html = fs.readFileSync(new URL(path, root), "utf8");
  assert.ok(html.includes("doodhwala-ui-system.css"), `${name} must load the shared customer design system`);
  for (const hook of hooks) assert.ok(html.includes(hook), `${name} must retain ${hook}`);
}
for (const selector of [
  ".home-page .hero", ".home-page .providers-grid", ".home-page .provider",
  ".home-page .quick button", ".market-page .store-identity",
  ".market-page .product-info", ".market-page .product-card"
]) {
  assert.ok(css.includes(selector), `missing discovery styling for ${selector}`);
}
assert.match(css, /@media\s*\(max-width:760px\)/, "discovery refinements must remain responsive");
assert.match(css, /prefers-reduced-motion\s*:\s*reduce/, "discovery refinements must respect reduced motion");

console.log("Customer discovery contracts passed: Home, provider store, product hooks and responsive shared styling.");
