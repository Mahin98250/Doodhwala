import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync("provider.html", "utf8");
const js = readFileSync("provider.js", "utf8");
const css = readFileSync("provider.css", "utf8");
const sw = readFileSync("sw.js", "utf8");

assert.ok(html.includes('id="readinessBadge"'), "provider dashboard must expose a live readiness status");
assert.ok(!html.includes('<span class="status-good">Ready</span>'), "readiness must not be hard-coded as green");
assert.ok(js.includes("function updateDeliveryReadiness()"), "readiness must be computed from provider state");
assert.ok(js.includes('provider.verificationStatus!=="approved"'), "unapproved providers must not appear ready");
assert.ok(js.includes('provider.acceptingOrders===false'), "paused stores must not appear ready");
assert.ok(js.includes("!profileReady||!locationReady||!productReady"), "missing profile, location, or stock must block readiness");
assert.ok(css.includes(".status-neutral") && css.includes(".status-warning") && css.includes(".status-danger"), "all readiness states must be styled");
assert.ok(sw.includes("provider.js?v=20261023.2") && sw.includes("provider.css?v=20261023.2"), "PWA precache must include current provider assets");
console.log("Provider delivery-readiness contracts passed.");
