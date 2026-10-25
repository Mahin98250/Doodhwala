import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");
const pages = ["store.html", "product.html", "checkout.html"];
const runtimes = [
  { path: "store.js", label: "provider storefront", loading: 'showLoading("Loading this local provider…")' },
  { path: "product.js", label: "product detail", loading: 'showLoading("Loading this milk…")' },
  { path: "checkout.js", label: "checkout", loading: 'showLoading("Preparing your checkout…")' }
];
const transitionCss = "/Doodhwala/milk-transition.css?v=20261025.4";
const transitionJs = "/Doodhwala/milk-transition.js?v=20261025.4";
const sw = read("sw.js");

for (const page of pages) {
  const html = read(page);
  assert.ok(html.includes(transitionCss), page + " must load the shared milk-transition stylesheet.");
  assert.ok(html.includes(transitionJs), page + " must load the milk-transition script before its page runtime.");
  assert.ok(sw.includes(transitionCss), "The PWA precache must include the shared milk-transition stylesheet.");
  assert.ok(sw.includes(transitionJs), "The PWA precache must include the shared milk-transition script.");
}

for (const runtime of runtimes) {
  const source = read(runtime.path);
  assert.ok(source.includes("const milkTransition=window.DoodhwalaMilkTransition;"),
    runtime.label + " must bind to the shared milk transition.");
  assert.ok(source.includes(runtime.loading), runtime.label + " must show a contextual milk-themed loading state.");
  assert.ok(source.includes("milkTransition?.hideLoading();"), runtime.label + " must stop its loading state after completion.");
  assert.ok(source.includes("finally{"), runtime.label + " must hide the loading indicator on success and error.");
}

assert.ok(read("store.html").includes("/Doodhwala/store.js?v=20261025.4"), "Storefront must use the current runtime URL.");
assert.ok(read("product.html").includes("/Doodhwala/product.js?v=20261025.6"), "Product page must use the current runtime URL.");
assert.ok(read("checkout.html").includes("/Doodhwala/checkout.js?v=20261025.3"), "Checkout must use the current runtime URL.");
for (const asset of [
  "/Doodhwala/store.js?v=20261025.4",
  "/Doodhwala/product.js?v=20261025.6",
  "/Doodhwala/checkout.js?v=20261025.3"
]) assert.ok(sw.includes(asset), "PWA precache must reference " + asset);

const motionCss = read("milk-transition.css");
const motionJs = read("milk-transition.js");
assert.match(motionJs, /dw-milk-stream-core/, "The transition must render a continuous milk stream.");
assert.match(motionJs, /dw-milk-source/, "The source container must tilt while pouring.");
assert.match(motionCss, /\.dw-milk-source\{left:4px;bottom:15px/, "The pouring bottle must sit higher than the receiving bottle.");
assert.match(motionJs, /M82 30 C116 29 161 40 208 39/, "The stream must arc from the raised source into the receiving bottle.");
assert.match(motionCss, /@keyframes dw-milk-tip/, "The source bottle must animate its pouring angle.");
assert.match(motionCss, /@keyframes dw-milk-fill-target/, "The receiving bottle must visibly fill.");
assert.match(motionCss, /prefers-reduced-motion/, "The liquid animation must respect reduced-motion settings.");

console.log("PASS: realistic milk-pour animation and loading coverage across provider storefront, product details, and checkout.");
