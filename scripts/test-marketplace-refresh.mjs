import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");
const html = read("index.html");
const css = read("marketplace-refresh.css");
const app = read("app.js");

assert.match(html, /marketplace-refresh\.css\?v=20261030\.1/, "homepage must load the cache-busted marketplace refresh");
assert.match(css, /@media\(max-width:760px\)/, "mobile layout rules must exist");
assert.match(css, /@media\(min-width:1400px\)/, "large-screen layout rules must exist");
assert.match(css, /prefers-reduced-motion:reduce/, "motion must respect reduced-motion preference");
assert.match(css, /\.providers-grid/, "provider discovery grid styling must exist");
assert.match(css, /\.search:|\.search\s*\{/, "search field styling must exist");
assert.match(css, /\.hero\s*\{/, "retail hero styling must exist");
assert.doesNotMatch(css, /https?:\/\//i, "refresh stylesheet must not add external runtime dependencies");
for (const id of ["providersGrid", "search", "openCart", "checkout", "locationTop", "locationHero", "providerSort", "deliverableOnly"]) {
  assert.match(html, new RegExp('id="' + id + '"'), `existing UI hook #${id} must remain in the homepage`);
}
assert.match(app, /getElementById|\$\s*=|function render/, "existing customer interaction code should remain present");
console.log("Marketplace refresh contracts passed: responsive layouts, reduced-motion support, no new external dependencies, and core customer UI hooks preserved.");
