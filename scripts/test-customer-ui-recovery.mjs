import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const orders = read("orders.js");
const plans = read("plans.js");
const marketplace = read("app.js");
const nav = read("customer-nav.js");
const polish = read("customer-ui-polish.css");
const transitionJs = read("milk-transition.js");
const transitionCss = read("milk-transition.css");
const indexHtml = read("index.html");
const plansHtml = read("plans.html");
const ordersHtml = read("orders.html");

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
