import assert from "node:assert/strict";
import fs from "node:fs";

const sw = fs.readFileSync(new URL("../sw.js", import.meta.url), "utf8");
const offline = fs.readFileSync(new URL("../offline.html", import.meta.url), "utf8");
const networkStatus = fs.readFileSync(new URL("../network-status.js", import.meta.url), "utf8");

assert.match(sw, /const CACHE="doodhwala-v106"/, "keep the current monotonic cache revision");
for(const route of ["/Doodhwala/auth/","/Doodhwala/plans/","/Doodhwala/orders/","/Doodhwala/provider/","/Doodhwala/notifications/","/Doodhwala/support/","/Doodhwala/checkout/","/Doodhwala/legal/","/Doodhwala/product/","/Doodhwala/store/","/Doodhwala/admin/","/Doodhwala/offline/"]) assert.ok(sw.includes(`"${route}"`), `clean route ${route} must be precached`);
for (const asset of [
  "/Doodhwala/customer-journey-refresh.css?v=20261025.1",
  "/Doodhwala/marketplace-refresh.css?v=20261025.3",
  "/Doodhwala/customer-ui-polish.css?v=20261025.3",
  "/Doodhwala/assets/mascot.png",
  "/Doodhwala/splash-screen.css?v=20261028.2",
  "/Doodhwala/splash-screen.js?v=20261028.2"
]) {
  assert.ok(sw.includes(asset), "exact customer-facing URL must be precached: " + asset);
}
assert.match(sw, /const CORE_ASSETS=\["\/Doodhwala\/","\/Doodhwala\/index\.html","\/Doodhwala\/offline\.html"/,
  "offline fallback is a required core asset");
assert.match(sw, /keys\.filter\(k=>k\.startsWith\("doodhwala-"\)&&k!==CACHE\)/,
  "activation cleanup is limited to obsolete Doodhwala caches");
assert.doesNotMatch(sw, /keys\.filter\(k=>k!==CACHE\)/,
  "activation cannot delete unrelated origin caches");
assert.match(sw, /await cache\.put\(event\.request,response\.clone\(\)\)/,
  "successful response waits for Cache Storage persistence");

assert.match(offline, /Some pages you visited earlier may still be available/,
  "offline page limits its availability claim to previously visited pages");
assert.match(offline, /Orders, sign-in, live order updates and payments need an internet connection/,
  "offline page clearly requires connectivity for account/order/payment actions");
assert.match(networkStatus, /Some cached pages may remain available/,
  "offline banner is honest about cached-only availability");
assert.match(networkStatus, /checkout, account actions and live order updates need a connection/i,
  "offline banner does not promise transactional offline behavior");
assert.match(networkStatus, /Refresh if any information looks out of date/,
  "reconnect copy advises a manual refresh for fresh content");


const sharedUiAsset = "/Doodhwala/experience-layer.css?v=20261028.3";
const coreAssetsMatch = sw.match(/const CORE_ASSETS=\[(.*?)\];/s);
assert.ok(coreAssetsMatch && coreAssetsMatch[1].includes(sharedUiAsset), "shared UI stylesheet must be a required core offline asset");
const routeAliases = [
  ["index.html", null],
  ["auth.html", "auth/index.html"],
  ["admin.html", "admin/index.html"],
  ["checkout.html", "checkout/index.html"],
  ["legal.html", "legal/index.html"],
  ["notifications.html", "notifications/index.html"],
  ["orders.html", "orders/index.html"],
  ["plans.html", "plans/index.html"],
  ["product.html", "product/index.html"],
  ["provider.html", "provider/index.html"],
  ["store.html", "store/index.html"],
  ["support.html", "support/index.html"]
];
for (const [rootPage, aliasPage] of routeAliases) {
  const rootMarkup = fs.readFileSync(new URL("../" + rootPage, import.meta.url), "utf8");
  assert.ok(rootMarkup.includes(sharedUiAsset), rootPage + " must load the versioned shared UI layer");
  if (aliasPage) {
    const aliasMarkup = fs.readFileSync(new URL("../" + aliasPage, import.meta.url), "utf8");
    assert.ok(aliasMarkup.includes(sharedUiAsset), aliasPage + " must load the versioned shared UI layer");
    assert.equal(aliasMarkup, rootMarkup, aliasPage + " must stay in parity with " + rootPage);
  }
}

console.log("PWA offline source-contract checks passed.");
