import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../sw.js", import.meta.url), "utf8");
const origin = "https://mahin98250.github.io";
const cache = new Map([
  [origin + "/Doodhwala/orders.html", "cached orders page"],
  [origin + "/Doodhwala/index.html", "cached home page"],
  [origin + "/Doodhwala/offline.html", "offline recovery page"],
  [origin + "/Doodhwala/legal.html", "cached legal draft"],
  [origin + "/Doodhwala/styles.css", "cached stylesheet"],
  [origin + "/Doodhwala/auth.js", "cached current auth script"]
]);
const handlers = new Map();
const cacheLookups = [];
const installWarnings = [];
const deletedCaches = [];
const cacheNames = ["doodhwala-v97", "doodhwala-v99", "unrelated-origin-cache-test"];
let skipWaitingCalls = 0;
let onlineMode = false;
let cachePutFinished = false;
const optionalFailure = "/Doodhwala/provider.css?v=20261027.2";
const installCache = {
  async addAll(urls) {
    for (const asset of urls) await this.add(asset);
  },
  async add(asset) {
    if (asset === optionalFailure) throw new Error("simulated transient optional asset failure");
    cache.set(new URL(asset, origin).href, "installed:" + asset);
  },
  async put(request, response) {
    await new Promise(resolve => setTimeout(resolve, 15));
    cachePutFinished = true;
    cache.set(request.url, await response.text());
  }
};
const fakeCaches = {
  async open() { return installCache; },
  async match(requestOrUrl) {
    const key = typeof requestOrUrl === "string" ? new URL(requestOrUrl, origin).href : requestOrUrl.url;
    cacheLookups.push(key);
    const body = cache.get(key);
    return body === undefined ? undefined : new Response(body, { status: 200 });
  },
  async keys() { return [...cacheNames]; },
  async delete(name) { deletedCaches.push(name); return true; }
};
const fakeSelf = {
  location: { origin },
  addEventListener(type, callback) { handlers.set(type, callback); },
  async skipWaiting() { skipWaitingCalls++; },
  clients: { async claim() {} }
};
vm.runInNewContext(source, {
  self: fakeSelf,
  caches: fakeCaches,
  fetch: async () => { if (onlineMode) return new Response("fresh network body", { status: 200 }); throw new TypeError("offline"); },
  URL,
  Response,
  Promise,
  console: { warn(...args) { installWarnings.push(args); } }
});

async function offlineResponse(url, mode = "navigate") {
  let responsePromise;
  handlers.get("fetch")({
    request: { method: "GET", url, mode },
    respondWith(promise) { responsePromise = promise; }
  });
  assert.ok(responsePromise, "fetch handler must provide a response");
  return await responsePromise;
}

const legalRoute = await offlineResponse(origin + "/Doodhwala/legal.html#privacy");
assert.equal(await legalRoute.text(), "cached legal draft", "legal center should be available offline after it is precached");
assert.ok(source.includes('"/Doodhwala/legal.html"'), "legal center must be included in the PWA precache");
assert.ok(source.includes('styles.css?v=20261023.5'), "legal footer styling must be included in the PWA precache");

const queryRoute = await offlineResponse(origin + "/Doodhwala/orders.html?filter=active");
assert.equal(await queryRoute.text(), "cached orders page", "offline query route must serve its own cached page");
assert.ok(cacheLookups.includes(origin + "/Doodhwala/orders.html"), "query-free path should be checked");

const queryAsset = await offlineResponse(origin + "/Doodhwala/styles.css?v=999", "no-cors");
assert.equal(await queryAsset.text(), "cached stylesheet", "offline asset should fall back to its cached path");
const versionedAuth = await offlineResponse(origin + "/Doodhwala/auth.js?v=20261012.1", "no-cors");
assert.equal(await versionedAuth.text(), "cached current auth script", "offline password recovery script must fall back to the refreshed cached base script");
assert.ok(source.includes('const CACHE="doodhwala-v99"'), "service worker cache revision must remain current");
assert.ok(source.includes('/Doodhwala/auth.js?v=20261012.1'), "the current password recovery script must be explicitly precached");
assert.ok(source.includes('/Doodhwala/provider.js?v=20261027.1'), "the current seller authorization script must be explicitly precached");
assert.ok(source.includes('/Doodhwala/provider.css?v=20261027.2'), "the current seller mobile navigation styles must be explicitly precached");
assert.ok(source.includes('/Doodhwala/styles.css?v=20261023.5'), "the current discovery styles must be explicitly precached");
assert.ok(source.includes('/Doodhwala/app.js?v=20261026.2'), "the current discovery runtime must be explicitly precached");
assert.ok(source.includes('/Doodhwala/plans.js?v=20261027.3'), "the latest customer plan runtime must be explicitly precached");
assert.ok(source.includes('"/Doodhwala/notifications.html"'), "the notification route must be included in the PWA precache");
assert.ok(source.includes('/Doodhwala/notifications.css?v=20261027.1'), "the notification stylesheet must be explicitly precached");
assert.ok(source.includes('/Doodhwala/notifications.js?v=20261027.1'), "the notification client must be explicitly precached");
assert.ok(source.includes('/Doodhwala/subscription-schedule-preview.css?v=20261027.2'), "the first-week plan calendar styles must be explicitly precached");

const unknownRoute = await offlineResponse(origin + "/Doodhwala/not-cached.html");
assert.equal(await unknownRoute.text(), "offline recovery page", "unknown offline navigation should show the honest offline recovery page");
assert.ok(source.includes('"/Doodhwala/offline.html"'), "offline recovery page must be included in the PWA precache");
const offlinePage = fs.readFileSync(new URL("../offline.html", import.meta.url), "utf8");
assert.match(offlinePage, /Orders, sign-in, live order updates and payments need an internet connection/i, "offline page must clearly state online-only actions");
assert.match(offlinePage, /id="retry"/, "offline page must provide a retry action");

console.log("Service-worker offline route recovery passed: query routes, versioned assets, and final navigation fallback.");

let installPromise;
handlers.get("install")({ waitUntil(promise) { installPromise = promise; } });
assert.ok(installPromise, "service worker install handler must register its completion promise");
await installPromise;
assert.equal(skipWaitingCalls, 1, "optional asset failures must not block service worker activation");
assert.ok(cache.has(origin + "/Doodhwala/index.html"), "core offline shell must be cached before activation");
assert.ok(cache.has(origin + "/Doodhwala/plans.js?v=20261027.3"), "the new customer plan runtime must be installed into the PWA cache");
assert.ok(cache.has(origin + "/Doodhwala/notifications.html"), "the notification route must be installed into the PWA cache");
assert.ok(cache.has(origin + "/Doodhwala/notifications.css?v=20261027.1"), "the notification stylesheet must be installed into the PWA cache");
assert.ok(cache.has(origin + "/Doodhwala/notifications.js?v=20261027.1"), "the notification client must be installed into the PWA cache");
assert.ok(cache.has(origin + "/Doodhwala/subscription-schedule-preview.css?v=20261027.2"), "the customer plan calendar stylesheet must be installed into the PWA cache");
assert.ok(installWarnings.some(args => String(args[0]).includes("optional offline asset")), "optional cache failures must be reported for diagnosis");


assert.ok(source.includes('/Doodhwala/product.js?v=20261025.6'), "the guarded product detail runtime must be explicitly precached");
assert.ok(source.includes('/Doodhwala/store.js?v=20261025.4'), "the provider storefront runtime must be explicitly precached");
assert.ok(source.includes('/Doodhwala/checkout.js?v=20261025.3'), "the checkout runtime must be explicitly precached");
assert.ok(source.includes('/Doodhwala/milk-transition.css?v=20261025.4'), "the shared milk transition stylesheet must be precached");
assert.ok(source.includes('/Doodhwala/milk-transition.js?v=20261025.4'), "the shared milk transition runtime must be precached");

assert.ok(source.includes('/Doodhwala/pwa-register.js?v=20261022.4'), "the diagnostic PWA registration runtime must be explicitly precached");
assert.ok(source.includes('const CACHE="doodhwala-v99"'), "seller authorization cache revision must advance so installed PWAs refresh their precache");
assert.ok(source.includes('/Doodhwala/network-status.js?v=20261023.1'), "network-status banner script must be precached");
assert.ok(source.includes('/Doodhwala/assets/mascot.png'), "unversioned mascot URL must be included in the PWA precache");
assert.ok(source.includes('/Doodhwala/customer-journey-refresh.css?v=20261025.1'), "exact checkout stylesheet variant must be precached");
assert.ok(source.includes('/Doodhwala/customer-ui-polish.css?v=20261025.3'), "older customer UI polish variant must be precached");
assert.ok(source.includes('"/Doodhwala/offline.html"'), "offline fallback must be declared in the worker");
assert.ok(source.includes('const CORE_ASSETS=["/Doodhwala/","/Doodhwala/index.html","/Doodhwala/offline.html"'), "offline fallback must be a required core asset");
assert.match(source, /keys\.filter\(k=>k\.startsWith\("doodhwala-"\)&&k!==CACHE\)/, "activation deletes only obsolete Doodhwala caches");
assert.doesNotMatch(source, /keys\.filter\(k=>k!==CACHE\)/, "activation preserves unrelated cache namespaces");

let activationPromise;
handlers.get("activate")({ waitUntil(promise) { activationPromise = promise; } });
await activationPromise;
assert.deepEqual(deletedCaches, ["doodhwala-v97"], "activation must delete only obsolete Doodhwala cache keys");
assert.ok(cacheNames.includes("unrelated-origin-cache-test"), "unrelated cache remains in the shared origin");

onlineMode = true;
let networkResponsePromise;
handlers.get("fetch")({
  request: { method: "GET", url: origin + "/Doodhwala/orders.html?filter=active", mode: "navigate" },
  respondWith(promise) { networkResponsePromise = promise; }
});
const networkResponse = await networkResponsePromise;
assert.equal(await networkResponse.text(), "fresh network body", "successful network response should be returned");
assert.equal(cachePutFinished, true, "network response must not resolve before cache.put completes");
assert.equal(cache.get(origin + "/Doodhwala/orders.html?filter=active"), "fresh network body", "exact query-string URL must be persisted in Cache Storage");
assert.ok(source.includes('/Doodhwala/experience-layer.css?v=20261023.5'), "shared experience stylesheet must be precached");
