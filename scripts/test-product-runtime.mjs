import assert from "node:assert/strict";
import fs from "node:fs";

const product = fs.readFileSync(new URL("../product.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../product.html", import.meta.url), "utf8");
const sw = fs.readFileSync(new URL("../sw.js", import.meta.url), "utf8");

assert.match(product, /if\(!store\|\|!product\)/, "render and cart actions must guard against missing store/product state");
assert.match(product, /products\.find\(p=>p&&String\(p\.id\)===String\(productId\)\)/, "catalogue mapping must tolerate null product entries");
assert.match(product, /Number\.isFinite\(unitPrice\)\|\|unitPrice<=0/, "invalid/non-positive prices must never enter the cart");
assert.match(product, /Price unavailable/, "invalid catalogue prices must not be shown as ₹0");
assert.match(product, /function saveCart\(c\)\{try\{localStorage\.setItem/, "product cart persistence must recover when local storage throws");
assert.match(product, /Product detail load failed/, "unexpected product RPC failures must be caught and presented as recoverable UI");
assert.match(product, /const row=Array\.isArray\(data\)\?data\[0\]:data/, "product loader must handle array and object RPC responses");
assert.doesNotMatch(product, /\$\("addToCart"\)\.disabled=false;/, "buying must remain disabled until a valid product is loaded");
assert.ok(html.includes('/Dudh-Wallah/product.js?v=20261022.4'), "product page must cache-bust the guarded detail runtime");
assert.ok(sw.includes('const CACHE="doodhwala-v75"'), "product runtime release must invalidate the old PWA cache");
assert.ok(sw.includes('/Dudh-Wallah/product.js?v=20261022.4'), "service worker must precache the guarded product runtime");

console.log("Product runtime contracts passed: null guards, valid pricing, safe storage, recoverable load errors and PWA asset refresh.");
