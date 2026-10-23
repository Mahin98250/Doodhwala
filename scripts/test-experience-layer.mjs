import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");
const cssPages = ["checkout.html","index.html","orders.html","plans.html","product.html","provider.html","store.html"];
const networkPages = ["admin.html","auth.html","checkout.html","index.html","legal.html","orders.html","plans.html","product.html","provider.html","store.html","support.html"];
const cssTag = "/Dudh-Wallah/experience-layer.css?v=20261023.1";
const networkTag = "/Dudh-Wallah/network-status.js?v=20261023.1";

for (const path of cssPages) {
  const html = read(path);
  assert.ok(html.includes(cssTag), path + " must include shared experience CSS");
  assert.equal(html.split(cssTag).length - 1, 1, path + " must not include duplicate experience CSS");
}
for (const path of networkPages) {
  const html = read(path);
  assert.ok(html.includes(networkTag), path + " must include network feedback");
  assert.equal(html.split(networkTag).length - 1, 1, path + " must not include duplicate network feedback");
}

const connection = read("network-status.js");
assert.match(connection, /window\.addEventListener\("offline"/, "offline event should show a warning");
assert.match(connection, /window\.addEventListener\("online"/, "online event should report reconnection");
assert.match(connection, /aria-live/, "status changes should be accessible");
assert.match(connection, /checkout, account actions and live order updates need a connection/i,
  "offline messaging must not imply checkout/live updates work offline");
assert.doesNotMatch(connection, /queue.*order|offline.*place.*order/i,
  "connection banner must not promise order submission while offline");

const experience = read("experience-layer.css");
assert.match(experience, /focus-visible/, "keyboard focus must remain visible");
assert.match(experience, /prefers-reduced-motion:reduce/, "reduced-motion must be honored");

const customer = read("customer-10x.js");
const provider10x = read("provider-10x.js");
assert.ok(customer.includes("Doodhwala Assist"), "customer utility should have the new user-facing name");
assert.ok(customer.includes("DOODHWALA ASSIST"), "customer panel should show the new name");
assert.doesNotMatch(customer, /Doodhwala 10X|DOODHWALA 10X/, "old customer-facing name should be absent");
assert.doesNotMatch(provider10x, /DOODHWALA 10X/, "old seller heading should be absent");

const providerHtml = read("provider.html");
const provider = read("provider.js");
const providerCss = read("provider.css");
const serviceWorker = read("sw.js");
assert.match(providerHtml, /id="readinessBadge"[^>]*role="status"/, "seller readiness must be announced accessibly");
assert.doesNotMatch(providerHtml, /<span class="status-good">Ready<\/span>/, "seller dashboard must not show a hard-coded green Ready badge");
assert.match(provider, /function updateDeliveryReadiness\(\)/, "seller readiness must be derived from current state");
assert.match(provider, /provider\.verificationStatus!=="approved"/, "unapproved providers must not appear ready");
assert.match(provider, /provider\.acceptingOrders===false/, "a paused seller store must not be marked ready");
assert.match(provider, /!profileReady\|\|!locationReady\|\|!productReady/, "profile, location and active stock must be checked");
for (const label of ["Connect account", "Review required", "Pending review", "Store paused", "Setup needed", "Ready for orders"]) {
  assert.ok(provider.includes(label), "seller readiness must explain " + label);
}
assert.match(providerCss, /\.status-neutral/, "neutral readiness must be styled");
assert.match(providerCss, /\.status-warning/, "pending/setup readiness must be styled");
assert.match(providerCss, /\.status-danger/, "rejected verification must be styled distinctly");
assert.ok(serviceWorker.includes('const CACHE="doodhwala-v86"'), "seller readiness changes must refresh installed PWAs");
assert.ok(serviceWorker.includes("/Dudh-Wallah/provider.js?v=20261023.2"), "updated seller runtime must be precached");
assert.ok(serviceWorker.includes("/Dudh-Wallah/provider.css?v=20261023.2"), "updated seller styles must be precached");

const workflow = read(".github/workflows/static-validation.yml");
assert.ok(workflow.includes("support.js network-status.js; do"), "new shared JS must be included in the syntax-check file loop");
assert.ok(workflow.includes('node --check "$file"'), "syntax-check loop must execute node --check for every listed file");
assert.ok(workflow.includes("Test premium experience and connection feedback"), "new contract test must run in CI");

console.log("Experience-layer contracts passed: route coverage, accessible connectivity status, safe offline messaging, reduced-motion support, and customer-facing naming.");
