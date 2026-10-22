import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../sw.js", import.meta.url), "utf8");
const origin = "https://mahin98250.github.io";
const cache = new Map([
  [origin + "/Dudh-Wallah/orders.html", "cached orders page"],
  [origin + "/Dudh-Wallah/index.html", "cached home page"],
  [origin + "/Dudh-Wallah/legal.html", "cached legal draft"],
  [origin + "/Dudh-Wallah/styles.css", "cached stylesheet"],
  [origin + "/Dudh-Wallah/auth.js", "cached current auth script"]
]);
const handlers = new Map();
const cacheLookups = [];
const installWarnings = [];
let skipWaitingCalls = 0;
const optionalFailure = "/Dudh-Wallah/provider.css?v=20261013.3";
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

const legalRoute = await offlineResponse(origin + "/Dudh-Wallah/legal.html#privacy");
assert.equal(await legalRoute.text(), "cached legal draft", "legal center should be available offline after it is precached");
assert.ok(source.includes('"/Dudh-Wallah/legal.html"'), "legal center must be included in the PWA precache");
assert.ok(source.includes('styles.css?v=20261013.3'), "legal footer styling must be included in the PWA precache");

const queryRoute = await offlineResponse(origin + "/Dudh-Wallah/orders.html?filter=active");
assert.equal(await queryRoute.text(), "cached orders page", "offline query route must serve its own cached page");
assert.ok(cacheLookups.includes(origin + "/Dudh-Wallah/orders.html"), "query-free path should be checked");

const queryAsset = await offlineResponse(origin + "/Dudh-Wallah/styles.css?v=999", "no-cors");
assert.equal(await queryAsset.text(), "cached stylesheet", "offline asset should fall back to its cached path");
const versionedAuth = await offlineResponse(origin + "/Dudh-Wallah/auth.js?v=20261012.1", "no-cors");
assert.equal(await versionedAuth.text(), "cached current auth script", "offline password recovery script must fall back to the refreshed cached base script");
assert.ok(source.includes('const CACHE="doodhwala-v75"'), "seller authorization cache revision must advance so installed PWAs refresh their precache");
assert.ok(source.includes('/Dudh-Wallah/auth.js?v=20261012.1'), "the current password recovery script must be explicitly precached");
assert.ok(source.includes('/Dudh-Wallah/provider.js?v=20261013.1'), "the current seller authorization script must be explicitly precached");
assert.ok(source.includes('/Dudh-Wallah/provider.css?v=20261013.3'), "the current seller mobile navigation styles must be explicitly precached");
assert.ok(source.includes('/Dudh-Wallah/styles.css?v=20261022.3'), "the current discovery styles must be explicitly precached");
assert.ok(source.includes('/Dudh-Wallah/app.js?v=20261022.3'), "the current discovery runtime must be explicitly precached");

const unknownRoute = await offlineResponse(origin + "/Dudh-Wallah/not-cached.html");
assert.equal(await unknownRoute.text(), "cached home page", "unknown offline navigation should fall back to the cached home page");

console.log("Service-worker offline route recovery passed: query routes, versioned assets, and final navigation fallback.");

let installPromise;
handlers.get("install")({ waitUntil(promise) { installPromise = promise; } });
assert.ok(installPromise, "service worker install handler must register its completion promise");
await installPromise;
assert.equal(skipWaitingCalls, 1, "optional asset failures must not block service worker activation");
assert.ok(cache.has(origin + "/Dudh-Wallah/index.html"), "core offline shell must be cached before activation");
assert.ok(installWarnings.some(args => String(args[0]).includes("optional offline asset")), "optional cache failures must be reported for diagnosis");


assert.ok(source.includes('/Dudh-Wallah/product.js?v=20261022.4'), "the guarded product detail runtime must be explicitly precached");

assert.ok(source.includes('/Dudh-Wallah/pwa-register.js?v=20261022.4'), "the diagnostic PWA registration runtime must be explicitly precached");
