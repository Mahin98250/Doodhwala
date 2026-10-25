import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const orders = read("orders.js");
const checkout = read("checkout.js");
const store = read("store.js");
const product = read("product.js");
const seller = read("provider.js");
const admin = read("admin.js");
const serviceWorker = read("sw.js");
const plans = read("plans.js");
const marketplace = read("app.js");
const nav = read("customer-nav.js");
const polish = read("customer-ui-polish.css");
const transitionJs = read("milk-transition.js");
const transitionCss = read("milk-transition.css");
const indexHtml = read("index.html");
const plansHtml = read("plans.html");
const ordersHtml = read("orders.html");
const checkoutHtml = read("checkout.html");
const storeHtml = read("store.html");
const productHtml = read("product.html");
const sellerHtml = read("provider.html");
const adminHtml = read("admin.html");

test("orders keep the core history query independent of optional payment columns", () => {
  assert.match(orders, /\.select\("id,status,subtotal,delivery_fee,total,customer_note,created_at,[^"]*provider_id,provider_profiles/);
  assert.match(orders, /\.select\("id,payment_method,payment_status,payment_reference,payment_confirmed_at"\)/);
  assert.match(orders, /Optional payment metadata is not available/);
  assert.match(orders, /catch\(err\)[\s\S]*Orders load failed/);
});

test("plan list survives a saved-address query failure", () => {
  assert.match(plans, /Promise\.allSettled\(\[/);
  assert.match(plans, /Saved addresses couldn’t be loaded/);
  assert.match(plans, /Your plans are available/);
  assert.match(plans, /plansLoad\.value!==false/);
  assert.match(plans, /hideLoading\(\)/);
});

test("customer data loading always clears the milk loading indicator", () => {
  assert.match(marketplace, /showLoading\("Finding fresh milk nearby/);
  assert.match(marketplace, /finally\{window\.DoodhwalaMilkTransition\?\.hideLoading\(\);\}/);
  assert.match(orders, /showLoading\("Loading your orders/);
  assert.match(orders, /finally\{[\s\S]*hideLoading\(\)/);
  assert.match(plans, /showLoading\("Loading your milk plans/);
});

test("customer, seller and owner boot loaders always clear and show recoverable states", () => {
  for (const source of [checkout, store, product, seller, admin]) {
    assert.match(source, /DoodhwalaMilkTransition\?\.showLoading\(/);
    assert.match(source, /finally\s*\{[\s\S]*?DoodhwalaMilkTransition\?\.hideLoading\(\)/);
  }
  assert.match(checkout, /cart is safe; check your connection and reload to retry/i);
  assert.match(store, /Store temporarily unavailable/);
  assert.match(product, /Could not load this milk/);
  assert.match(seller, /Could not refresh live seller data/);
  assert.match(admin, /Could not load owner data/);
  assert.match(checkoutHtml, /checkout\.js\?v=20261025\.3/);
  assert.match(storeHtml, /store\.js\?v=20261025\.2/);
  assert.match(productHtml, /product\.js\?v=20261025\.6/);
  assert.match(sellerHtml, /provider\.js\?v=20261025\.3/);
  assert.match(adminHtml, /admin\.js\?v=20261025\.1/);
  assert.match(serviceWorker, /const CACHE="doodhwala-v92"/);
  for (const asset of [
    "/Doodhwala/checkout.js?v=20261025.3",
    "/Doodhwala/store.js?v=20261025.2",
    "/Doodhwala/product.js?v=20261025.6",
    "/Doodhwala/provider.js?v=20261025.3",
    "/Doodhwala/admin.js?v=20261025.1"
  ]) assert.ok(serviceWorker.includes(asset), "service worker should precache " + asset);
});

test("page changes show a local milk-transfer animation without a network dependency", () => {
  assert.match(transitionJs, /function navigate\(url\)/);
  assert.match(transitionJs, /DoodhwalaMilkTransition/);
  assert.match(transitionCss, /@keyframes dw-milk-drop/);
  assert.match(transitionCss, /@keyframes dw-milk-tip/);
  assert.match(transitionCss, /@keyframes dw-milk-fill-level/);
  assert.match(transitionJs, /loader.innerHTML=.*dw-milk-loading-scene.*dw-milk-title/);
  assert.match(nav, /DoodhwalaMilkTransition\.navigate/);
  assert.match(nav, /animateSection\(/);
  for (const html of [indexHtml, plansHtml, ordersHtml]) {
    assert.match(html, /customer-ui-polish\.css/);
    assert.match(html, /milk-transition\.css/);
    assert.match(html, /milk-transition\.js/);
  }
});

test("customer home stats retain readable contrast on pale statistic cards", () => {
  assert.match(polish, /\.story \.stats > div b\{color:#153b28!important/);
  assert.match(polish, /\.story \.stats > div small\{display:block;color:#476652!important/);
  assert.match(polish, /grid-template-areas:[\s\S]*"brand location location"/);
});
