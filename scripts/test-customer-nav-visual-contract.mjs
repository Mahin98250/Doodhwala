import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../customer-nav.js", import.meta.url), "utf8");
const styleStart = source.indexOf("style.textContent=`");
const styleEnd = source.indexOf("`;document.head.appendChild(style)", styleStart);
assert.ok(styleStart >= 0 && styleEnd > styleStart, "customer navigation must keep its isolated responsive style block");
const styles = source.slice(styleStart, styleEnd);

for (const key of ["home", "explore", "plans", "orders", "saved", "cart", "profile"]) {
  assert.ok(source.includes(`item("${key}"`), `navigation must retain the ${key} destination`);
}
assert.match(source, /setAttribute\("aria-current"/, "active destination must be exposed with aria-current");
assert.match(styles, /var\(--dw-z-bottom-nav/, "bottom navigation must use the shared z-index token");
assert.match(styles, /left:50%[\s\S]*?translateX\(-50%\)/, "mobile navigation must be centered and width-constrained");
assert.match(styles, /min-height:44px/, "each navigation item must keep a minimum touch target");
assert.match(styles, /font-size:8\.5px/, "mobile labels must remain legible");
assert.match(styles, /env\(safe-area-inset-bottom/, "navigation and body spacing must respect device safe areas");
assert.match(styles, /prefers-reduced-motion\s*:\s*reduce/, "navigation transitions must respect reduced motion");
assert.match(styles, /customer-nav-badge\.show/, "cart badge visibility contract must remain intact");

console.log("Customer navigation visual contracts passed: seven routes, touch targets, safe areas and accessible active state.");
