import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");
const html = read("index.html");
const css = read("splash-screen.css");
const js = read("splash-screen.js");
const sw = read("sw.js");

assert.match(html, /<section class="dw-splash" id="dwSplash" hidden role="status"/,
  "splash must start hidden so a failed or delayed script never traps the page");
assert.ok(html.includes('/Doodhwala/splash-screen.css?v=20261028.2'), "home page must load the current splash stylesheet");
assert.ok(html.includes('/Doodhwala/splash-screen.js?v=20261028.2'), "home page must load the current splash runtime");
assert.ok(html.indexOf('splash-screen.js?v=20261028.2') < html.indexOf('app.js?v=20261027.1'),
  "the intro should begin before the home runtime starts");
assert.match(html, /dw-splash-mascot[\s\S]*?dw-splash-milk[\s\S]*?Doodhwala[\s\S]*?Your local milk marketplace/,
  "splash should include branded mascot, animated milk stroke, wordmark and tagline");
assert.match(html, /data-splash-skip/, "the startup experience must be skippable");

assert.match(css, /\.dw-splash\[hidden\]\{display:none!important\}/, "hidden fallback must remain reliable");
assert.match(css, /body\.dw-splash-active\{overflow:hidden\}/, "background scrolling must be locked only during the intro");
assert.match(css, /@keyframes dw-splash-pour/, "milk stroke should animate into view");
assert.match(css, /@keyframes dw-splash-mascot-in/, "mascot should have a dedicated entrance");
assert.match(css, /safe-area-inset-bottom/, "skip control must respect mobile safe areas");
assert.match(css, /prefers-reduced-motion:reduce/, "all splash choreography must respect reduced-motion preferences");

assert.match(js, /dw-splash-seen-v2/, "intro should run once per tab session");
assert.match(js, /prefers-reduced-motion: reduce/, "reduced-motion users must bypass the animated intro");
assert.match(js, /w\.setTimeout\(finish,1780\)/, "intro must end automatically without a long loading delay");
assert.match(js, /data-splash-skip/, "skip control must end the intro immediately");
assert.match(js, /pagehide/, "navigation away must never leave a stale overlay on return");
assert.doesNotMatch(js, /fetch\(|https?:\/\//, "splash runtime must have no network dependency");

assert.match(sw, /const CACHE="doodhwala-v107"/, "PWA cache must advance for the splash release");
for (const asset of ["/Doodhwala/splash-screen.css?v=20261028.2", "/Doodhwala/splash-screen.js?v=20261028.2"]) {
  assert.ok(sw.includes(asset), "service worker must precache " + asset);
}
const core = sw.match(/const CORE_ASSETS=\[(.*?)\];/s)?.[1] || "";
for (const asset of ["/Doodhwala/splash-screen.css?v=20261028.2", "/Doodhwala/splash-screen.js?v=20261028.2"]) {
  assert.ok(core.includes(asset), "splash must be part of the required offline shell: " + asset);
}

console.log("Branded Doodhwala splash contracts passed: first-session behavior, skip, reduced motion, safe areas, lifecycle cleanup and offline shell.");
