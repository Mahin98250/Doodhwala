import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("../", import.meta.url);
const shared = fs.readFileSync(new URL("doodhwala-ui-system.css", root), "utf8");
const nav = fs.readFileSync(new URL("customer-nav.js", root), "utf8");

assert.match(shared, /:where\([^)]*\.profile-page[^)]*\.legal-page[^)]*\)/,
  "shared route-safe styles must include the customer Profile and Legal surfaces");
assert.match(shared, /accent-color\s*:\s*var\(--dw-color-brand\)/,
  "form controls must use the shared brand token");
assert.match(shared, /font-family\s*:\s*var\(--dw-font-body\)/,
  "shared controls must use the common body typography token");
assert.match(shared, /prefers-reduced-motion\s*:\s*reduce/,
  "shared motion must respect reduced-motion preferences");
assert.match(shared, /focus-visible/,
  "keyboard users must receive visible focus feedback");
assert.match(shared, /env\(safe-area-inset-bottom/,
  "mobile bottom surfaces must respect device safe areas");
assert.match(shared, /overflow-x\s*:\s*clip/,
  "customer page shells must prevent accidental horizontal overflow");

const expectedNavKeys = ["home", "explore", "plans", "orders", "saved", "cart", "profile"];
for (const key of expectedNavKeys) {
  assert.ok(nav.includes(`item("${key}"`), `customer navigation must retain ${key}`);
}
assert.match(nav, /setAttribute\("aria-current"/,
  "navigation must expose the current destination accessibly");

console.log("Customer app UI contracts passed: route coverage, shared control tokens, accessibility and seven destinations.");
