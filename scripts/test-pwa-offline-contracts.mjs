import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const sw = read("sw.js");

function readArray(name) {
  const match = sw.match(new RegExp("const " + name + "=(\\[[\\s\\S]*?\\]);"));
  assert.ok(match, "service worker defines " + name);
  return JSON.parse(match[1]);
}

const cacheMatch = sw.match(/const CACHE="([^"]+)"/);
assert.ok(cacheMatch, "service worker has a named cache");
assert.equal(cacheMatch[1], "doodhwala-v95", "PWA cache version matches the reviewed revision");
const assets = readArray("ASSETS");
const coreAssets = readArray("CORE_ASSETS");
const cachedUrls = new Set([...assets, ...coreAssets]);

for (const url of [
  "/Doodhwala/offline.html",
  "/Doodhwala/customer-journey-refresh.css?v=20261025.1",
  "/Doodhwala/customer-ui-polish.css?v=20261025.3",
  "/Doodhwala/assets/mascot.png"
]) {
  assert.ok(cachedUrls.has(url), "precache includes exact offline URL: " + url);
}

assert.ok(coreAssets.includes("/Doodhwala/offline.html"), "offline fallback is a required core asset");
assert.match(sw, /keys\.filter\(k=>k!==CACHE&&k\.startsWith\("doodhwala-"\)\)/,
  "activation deletes only old Doodhwala caches");
assert.doesNotMatch(sw, /keys\.filter\(k=>k!==CACHE\)/,
  "activation must not delete unrelated origin caches");
assert.match(sw, /self\.skipWaiting\(\)/, "new worker activates promptly");
assert.match(sw, /self\.clients\.claim\(\)/, "new worker claims controlled clients");
assert.match(sw, /const exact=await caches\.match\(event\.request\)/, "offline fallback checks exact request first");
assert.match(sw, /event\.waitUntil\(cacheUpdate\)/, "successful network responses keep their cache write alive until completion");
assert.match(sw, /const offline=await caches\.match\(new URL\("\/Doodhwala\/offline\.html"/,
  "navigation fallback prefers the dedicated offline page");

const customerPages = [
  "index.html", "checkout.html", "plans.html", "orders.html", "auth.html", "support.html"
];
for (const page of customerPages) {
  const html = read(page);
  assert.match(html, /pwa-register\.js/, page + " registers the service worker");
  assert.match(html, /network-status\.js/, page + " shows connection status");
  for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
    const url = match[1];
    if (!url.startsWith("/Doodhwala/")) continue;
    const requestUrl = url.split("#", 1)[0];
    const pathOnly = requestUrl.split("?", 1)[0];
    assert.ok(cachedUrls.has(requestUrl) || cachedUrls.has(pathOnly),
      page + " references a local resource not represented in precache: " + requestUrl);
  }
}

const offline = read("offline.html");
assert.match(offline, /Some pages you visited earlier may still be available/,
  "offline page does not promise all pages work offline");
assert.match(offline, /Orders, sign-in, live order updates and payments need an internet connection/,
  "offline page clearly describes online-only actions");
const networkStatus = read("network-status.js");
assert.match(networkStatus, /Some cached pages may remain available/,
  "offline banner limits availability claim to cached pages");
assert.match(networkStatus, /checkout, account actions and live order updates need a connection/,
  "offline banner does not promise offline transactions");
assert.match(networkStatus, /Refresh if any information looks out of date/,
  "reconnect banner recommends refresh for fresh content");

console.log("PWA offline source-contract checks passed.");
