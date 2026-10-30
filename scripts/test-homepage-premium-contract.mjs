import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");
const html = read("index.html");
const css = read("marketplace-refresh.css");
const ui = read("doodhwala-ui-system.css");
const app = read("app.js");
const location = read("location.js");
const nav = read("customer-nav.js");

// Existing runtime contracts: these must survive the visual redesign.
for (const id of [
  "search", "locationBtn", "locationTop", "locationLabel", "heroLocationLabel",
  "explore", "how", "providers", "chips", "providerSort", "deliverableOnly",
  "providersGrid", "compareDock", "compareDialog", "openCart", "cartCount",
  "drawer", "cartItems", "locationModalBackdrop", "locationMap", "locationUseMe",
  "locationUse", "locationModalClose"
]) {
  assert.equal((html.match(new RegExp('id="' + id + '"', "g")) || []).length, 1,
    "homepage must preserve exactly one #" + id + " runtime hook");
}

for (const filter of ["cow", "buffalo", "a2", "subscription"]) {
  assert.match(html, new RegExp('data-filter="' + filter + '"'),
    "homepage must preserve the " + filter + " category filter");
}

// Approved hierarchy: compact utilities, clear discovery priority, subscriptions secondary.
for (const marker of [
  'data-home-region="utilities"',
  'data-home-region="hero"',
  'data-home-region="categories"',
  'data-home-region="nearby-providers"',
  'data-home-region="subscriptions"',
]) {
  assert.ok(html.includes(marker), "homepage must include approved region " + marker);
}

assert.equal((html.match(/<h1\b/g) || []).length, 1, "homepage must have exactly one h1");
assert.match(html, /aria-label="[^"]*(?:main|primary)[^"]*"/i,
  "homepage must expose a named primary navigation or landmark");
assert.match(css, /prefers-reduced-motion\s*:\s*reduce/, "homepage styling must respect reduced motion");
assert.match(css, /:focus-visible/, "homepage styling must provide visible keyboard focus");
assert.match(css, /@media\s*\([^)]*(?:max-width|min-width)/, "homepage styling must include responsive breakpoints");
assert.match(css, /min-width:\s*0|overflow-x:\s*(?:clip|hidden)/,
  "homepage styling must guard against narrow-screen overflow");
// The mobile utility grid must target only the real app header, not nested dialog headers.
assert.match(ui, /\.home-page \.app main > header\s*\{/,
  "mobile utility layout must be scoped to the primary app header");
assert.doesNotMatch(ui, /\.home-page header\s*\{/,
  "nested homepage dialog headers must not inherit the app header grid");
assert.match(ui, /grid-template-areas:[\\s\\S]*?"help bell auth bag"/,
  "mobile header must give support, notification bell, sign-in, and cart distinct grid areas");
assert.match(ui, /d10x-bell\\s*\\{grid-area:bell;\\}/,
  "dynamically injected notification bell must occupy its reserved mobile slot");
assert.match(ui, /auth-link\\[href\\*="\\/notifications\\/"\\]\\{display:none!important\\}/,
  "mobile header must avoid duplicating the notification-bell entry point");
assert.match(ui, /auth-link\[href\*="\/support\/"\]\{grid-area:help\}/,
  "support link must have its own mobile header slot");
assert.match(css, /hero-art\{min-height:clamp\(145px,40vw,160px\)/,
  "mobile hero illustration must stay compact to prioritize discovery");

assert.doesNotMatch(html, /(?:\b(?:Test Dairy|Sample Seller|Demo Provider)\b|₹\s*(?:99|120|150)\s*\/\s*L)/i,
  "homepage must not introduce fabricated seller names or sample prices");

for (const [source, label] of [[app, "app.js"], [location, "location.js"], [nav, "customer-nav.js"]]) {
  assert.ok(source.length > 0, label + " must remain available for runtime compatibility review");
}

console.log("Homepage premium contracts passed: approved hierarchy, preserved runtime hooks, honest content, responsive and accessibility safeguards.");
