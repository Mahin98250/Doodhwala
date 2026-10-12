import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../sw.js", import.meta.url), "utf8");
const origin = "https://mahin98250.github.io";
const cache = new Map([
  [origin + "/Dudh-Wallah/orders.html", "cached orders page"],
  [origin + "/Dudh-Wallah/index.html", "cached home page"],
  [origin + "/Dudh-Wallah/styles.css", "cached stylesheet"],
  [origin + "/Dudh-Wallah/auth.js", "cached current auth script"]
]);
const handlers = new Map();
const cacheLookups = [];
const fakeCaches = {
  async match(requestOrUrl) {
    const key = typeof requestOrUrl === "string" ? new URL(requestOrUrl, origin).href : requestOrUrl.url;
    cacheLookups.push(key);
    const body = cache.get(key);
    return body === undefined ? undefined : new Response(body, { status: 200 });
  }
};
const fakeSelf = {
  location: { origin },
  addEventListener(type, callback) { handlers.set(type, callback); }
};
vm.runInNewContext(source, {
  self: fakeSelf,
  caches: fakeCaches,
  fetch: async () => { throw new TypeError("offline"); },
  URL,
  Response,
  Promise
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

const queryRoute = await offlineResponse(origin + "/Dudh-Wallah/orders.html?filter=active");
assert.equal(await queryRoute.text(), "cached orders page", "offline query route must serve its own cached page");
assert.ok(cacheLookups.includes(origin + "/Dudh-Wallah/orders.html"), "query-free path should be checked");

const queryAsset = await offlineResponse(origin + "/Dudh-Wallah/styles.css?v=999", "no-cors");
assert.equal(await queryAsset.text(), "cached stylesheet", "offline asset should fall back to its cached path");
const versionedAuth = await offlineResponse(origin + "/Dudh-Wallah/auth.js?v=20261012.1", "no-cors");
assert.equal(await versionedAuth.text(), "cached current auth script", "offline password recovery script must fall back to the refreshed cached base script");
assert.ok(source.includes('const CACHE="doodhwala-v65"'), "auth recovery cache revision must advance so installed PWAs refresh their precache");
assert.ok(source.includes('/Dudh-Wallah/auth.js?v=20261012.1'), "the current password recovery script must be explicitly precached");

const unknownRoute = await offlineResponse(origin + "/Dudh-Wallah/not-cached.html");
assert.equal(await unknownRoute.text(), "cached home page", "unknown offline navigation should fall back to the cached home page");

console.log("Service-worker offline route recovery passed: query routes, versioned assets, and final navigation fallback.");
