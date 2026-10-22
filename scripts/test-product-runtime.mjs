import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

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
assert.ok(html.includes('/Dudh-Wallah/product.js?v=20261022.5'), "product page must cache-bust the guarded detail runtime");
assert.ok(sw.includes('const CACHE="doodhwala-v76"'), "product runtime release must invalidate the old PWA cache");
assert.ok(sw.includes('/Dudh-Wallah/product.js?v=20261022.5'), "service worker must precache the guarded product runtime");


function createElement(id) {
  const classes = new Set(id === "productContent" ? ["hidden"] : []);
  return {
    id, textContent: "", innerHTML: "", href: "", className: "", disabled: false, style: {},
    classList: {
      add(name) { classes.add(name); },
      remove(name) { classes.delete(name); },
      contains(name) { return classes.has(name); }
    },
    append() {}, remove() {}, setAttribute() {}, addEventListener() {}, focus() {}
  };
}

function runProductPage(rpc) {
  const ids = ["marketLocationLabel","productState","productContent","addToCart","minus","plus","productEmoji","productName","productCrumb","productLead","productPrice","productUnit","buyTotal","quantity","providerLink","productBack","detailProvider","detailType","detailWindow","detailRadius","planLink","locationService","locationServiceTitle","locationServiceCopy"];
  const elements = new Map(ids.map(id => [id, createElement(id)]));
  const saved = new Map();
  const window = {
    Doodhwala: { configured: true, supabase: { rpc } },
    dispatchEvent() {},
    console: { error() {}, warn() {} }
  };
  const document = {
    body: { append() {} },
    getElementById(id) { return elements.get(id) || null; },
    createElement(tag) { return createElement(tag); }
  };
  const localStorage = {
    getItem(key) { return saved.has(key) ? saved.get(key) : null; },
    setItem(key, value) { saved.set(key, String(value)); },
    removeItem(key) { saved.delete(key); }
  };
  const sandbox = {
    window, document, localStorage, location: { search: "?provider=provider-a&product=product-a", href: "https://mahin98250.github.io/Dudh-Wallah/product.html?provider=provider-a&product=product-a" },
    URLSearchParams, URL, Event, Number, String, Math, JSON, Array, Object, Promise, console: { error() {}, warn() {} },
    setTimeout(fn) { fn(); return 1; }, clearTimeout() {}
  };
  vm.runInNewContext(product, sandbox, { timeout: 1000 });
  return { elements, saved, sandbox };
}

const productRow = { id: "product-a", name: "Fresh milk", milk_type: "cow", unit_label: "1 L", price_per_litre: 0 };
let resolvePending;
const waitingRpc = () => new Promise(resolve => { resolvePending = resolve; });
const pendingPage = runProductPage(waitingRpc);
assert.doesNotThrow(() => pendingPage.elements.get("minus").onclick(), "minus must be safe before product load completes");
assert.doesNotThrow(() => pendingPage.elements.get("plus").onclick(), "plus must be safe before product load completes");
assert.doesNotThrow(() => pendingPage.elements.get("addToCart").onclick(), "add must be safe before product load completes");
resolvePending({ data: [{ provider_id: "provider-a", provider_name: "Local seller", products: [null, productRow], is_serviceable: true, service_radius_km: 5 }], error: null });
await new Promise(resolve => setImmediate(resolve));
assert.equal(pendingPage.elements.get("productPrice").textContent, "Price unavailable", "zero price must not be presented as valid");
assert.equal(pendingPage.elements.get("addToCart").disabled, true, "zero-price product must be non-purchasable");
assert.doesNotThrow(() => pendingPage.elements.get("addToCart").onclick(), "price validation must hold even when click handlers are called directly");
assert.equal(pendingPage.saved.has("doodhwala-cart"), false, "invalid product must not be persisted in the cart");

const validPage = runProductPage(async () => ({
  data: [{ provider_id: "provider-a", provider_name: "Local seller", products: [{ id: "product-a", name: "Fresh milk", milk_type: "cow", unit_label: "1 L", price_per_litre: 72 }], is_serviceable: true, service_radius_km: 5, delivery_from: "06:00:00", delivery_to: "09:00:00" }],
  error: null
}));
await new Promise(resolve => setImmediate(resolve));
assert.equal(validPage.elements.get("productPrice").textContent, "₹72", "valid price should render normally");
assert.equal(validPage.elements.get("addToCart").disabled, false, "valid product should enable purchase when serviceable");
validPage.elements.get("addToCart").onclick();
assert.equal(JSON.parse(validPage.saved.get("doodhwala-cart"))["provider-a:product-a"].unitPrice, 72, "cart must use the validated numeric price");

const failedPage = runProductPage(async () => { throw new TypeError("simulated network failure"); });
await new Promise(resolve => setImmediate(resolve));
assert.match(failedPage.elements.get("productState").innerHTML, /Could not load this product/, "RPC rejection should render recoverable state instead of an unhandled exception");
assert.equal(failedPage.elements.get("productContent").classList.contains("hidden"), true, "failed load must keep the empty product shell hidden");

console.log("Product runtime contracts passed: null guards, valid pricing, safe storage, recoverable load errors and PWA asset refresh.");
