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
let skipWaitingCalls = 0;
const optionalFailure = "/Doodhwala/provider.css?v=20261022.6";
const installCache = {
  async addAll(urls) {
    for (const asset of urls) await this.add(asset);
  },
  async add(asset) {
    if (asset === optionalFailure) throw new Error("simulated transient optional asset failure");
    cache.set(new URL(asset, origin).href, "installed:" + asset);
  }
};
const fakeCaches = {
  async open() { return installCache; },
  async match(requestOrUrl) {
    const key = typeof requestOrUrl === "string" ? new URL(requestOrUrl, origin).href : requestOrUrl.url;
    cacheLookups.push(key);
    const body = cache.get(key);
    return body === undefined ? undefined : new Response(body, { status: 200 });
  }
};
const fakeSelf = {
  location: { origin },
  addEventListener(type, callback) { handlers.set(type, callback); },
  async skipWaiting() { skipWaitingCalls++; }
};
vm.runInNewContext(source, {
  self: fakeSelf,
  caches: fakeCaches,
  fetch: async () => { throw new TypeError("offline"); },
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
assert.ok(source.includes('const CACHE="doodhwala-v89"'), "seller authorization cache revision must advance so installed PWAs refresh their precache");
assert.ok(source.includes('/Doodhwala/auth.js?v=20261012.1'), "the current password recovery script must be explicitly precached");
assert.ok(source.includes('/Doodhwala/provider.js?v=20261022.5'), "the current seller authorization script must be explicitly precached");
assert.ok(source.includes('/Doodhwala/provider.css?v=20261022.6'), "the current seller mobile navigation styles must be explicitly precached");
assert.ok(source.includes('/Doodhwala/styles.css?v=20261023.5'), "the current discovery styles must be explicitly precached");
assert.ok(source.includes('/Doodhwala/app.js?v=20261022.4'), "the current discovery runtime must be explicitly precached");

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
assert.ok(installWarnings.some(args => String(args[0]).includes("optional offline asset")), "optional cache failures must be reported for diagnosis");


assert.ok(source.includes('/Doodhwala/product.js?v=20261022.5'), "the guarded product detail runtime must be explicitly precached");

assert.ok(source.includes('/Doodhwala/pwa-register.js?v=20261022.4'), "the diagnostic PWA registration runtime must be explicitly precached");
assert.ok(source.includes('const CACHE="doodhwala-v89"'), "seller authorization cache revision must advance so installed PWAs refresh their precache");
assert.ok(source.includes('/Doodhwala/network-status.js?v=20261023.1'), "network-status banner script must be precached");
assert.ok(source.includes('/Doodhwala/assets/mascot.png'), "final mascot must be included in the PWA precache");
assert.ok(source.includes('/Doodhwala/experience-layer.css?v=20261023.5'), "shared experience stylesheet must be precached");
