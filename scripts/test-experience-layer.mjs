import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");
const cssPages = ["checkout.html","index.html","orders.html","plans.html","product.html","provider.html","store.html"];
const networkPages = ["admin.html","auth.html","checkout.html","index.html","legal.html","orders.html","plans.html","product.html","provider.html","store.html","support.html"];
const cssTag = "/Doodhwala/experience-layer.css?v=20261023.5";
const networkTag = "/Doodhwala/network-status.js?v=20261023.1";

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
const provider = read("provider-10x.js");
assert.ok(customer.includes("Doodhwala Assist"), "customer utility should have the new user-facing name");
assert.ok(customer.includes("DOODHWALA ASSIST"), "customer panel should show the new name");
assert.doesNotMatch(customer, /Doodhwala 10X|DOODHWALA 10X/, "old customer-facing name should be absent");
assert.doesNotMatch(provider, /DOODHWALA 10X/, "old seller heading should be absent");

const workflow = read(".github/workflows/static-validation.yml");
assert.ok(workflow.includes("support.js network-status.js delivery-dispatch.js delivery-driver.js track-delivery.js; do"), "shared and delivery JS must be included in the syntax-check file loop");
assert.ok(workflow.includes('node --check "$file"'), "syntax-check loop must execute node --check for every listed file");
assert.ok(workflow.includes("Test premium experience and connection feedback"), "new contract test must run in CI");

console.log("Experience-layer contracts passed: route coverage, accessible connectivity status, safe offline messaging, reduced-motion support, and customer-facing naming.");
