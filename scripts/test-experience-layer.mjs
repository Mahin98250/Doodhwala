import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");
const cssPages = ["checkout.html","index.html","orders.html","plans.html","product.html","provider.html","store.html"];
const networkPages = ["admin.html","auth.html","checkout.html","index.html","legal.html","orders.html","plans.html","product.html","provider.html","store.html","support.html"];
const routeAliases = [
  ["admin.html","admin/index.html"],
  ["auth.html","auth/index.html"],
  ["checkout.html","checkout/index.html"],
  ["legal.html","legal/index.html"],
  ["notifications.html","notifications/index.html"],
  ["orders.html","orders/index.html"],
  ["plans.html","plans/index.html"],
  ["product.html","product/index.html"],
  ["provider.html","provider/index.html"],
  ["store.html","store/index.html"],
  ["support.html","support/index.html"]
];
const cssTag = "/Doodhwala/experience-layer.css?v=20261028.3";
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
for (const [rootRoute, directoryRoute] of routeAliases) {
  assert.equal(read(rootRoute), read(directoryRoute),
    rootRoute + " and " + directoryRoute + " must remain byte-for-byte equivalent aliases");
}

const connection = read("network-status.js");
assert.ok(connection.includes('window.addEventListener("offline"'), "offline event should show a warning");
assert.ok(connection.includes('window.addEventListener("online"'), "online event should report reconnection");
assert.match(connection, /aria-live/, "status changes should be accessible");
assert.match(connection, /checkout, account actions and live order updates need a connection/i,
  "offline messaging must not imply checkout/live updates work offline");
assert.doesNotMatch(connection, /queue.*order|offline.*place.*order/i,
  "connection banner must not promise order submission while offline");

const experience = read("experience-layer.css");
assert.match(experience, /focus-visible/, "keyboard focus must remain visible");
assert.match(experience, /prefers-reduced-motion:reduce/, "reduced-motion must be honored");

const cleanUi = read("clean-ui.css");
assert.match(cleanUi, /--dw-clean-focus:#(?:[0-9a-f]{6});/i,
  "focus ring must use an opaque, contrast-testable color instead of a translucent token");
assert.ok(cleanUi.includes("outline:3px solid var(--dw-clean-focus)"),
  "shared controls must use the stronger visible focus token");
assert.ok(cleanUi.includes("@media(prefers-reduced-motion:reduce)"),
  "clean UI layer must honor reduced motion");

function hexRgb(hex) {
  const value = hex.replace("#", "");
  return [0, 2, 4].map(offset => parseInt(value.slice(offset, offset + 2), 16) / 255)
    .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
}
function contrastRatio(a, b) {
  const luminance = rgb => 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  const values = [luminance(hexRgb(a)), luminance(hexRgb(b))].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
function token(name) {
  const match = cleanUi.match(new RegExp(name + ":([^;]+);", "i"));
  assert.ok(match, "missing CSS token " + name);
  assert.match(match[1], /^#[0-9a-f]{6}$/i, name + " must be an opaque hex color for measurable contrast");
  return match[1];
}
const white = "#ffffff";
for (const name of ["--dw-clean-ink", "--dw-clean-muted", "--dw-clean-primary"]) {
  const ratio = contrastRatio(token(name), white);
  assert.ok(ratio >= 4.5, name + " must meet WCAG AA normal-text contrast against white (actual " + ratio.toFixed(2) + ":1)");
}
const focusRatio = contrastRatio(token("--dw-clean-focus"), white);
assert.ok(focusRatio >= 3, "focus indicator must reach 3:1 against white (actual " + focusRatio.toFixed(2) + ":1)");

const customer = read("customer-10x.js");
const provider = read("provider-10x.js");
assert.ok(customer.includes("Doodhwala Assist"), "customer utility should have the new user-facing name");
assert.ok(customer.includes("DOODHWALA ASSIST"), "customer panel should show the new name");
assert.doesNotMatch(customer, /Doodhwala 10X|DOODHWALA 10X/, "old customer-facing name should be absent");
assert.doesNotMatch(provider, /DOODHWALA 10X/, "old seller heading should be absent");

const workflow = read(".github/workflows/static-validation.yml");
assert.ok(workflow.includes("support.js network-status.js; do"), "new shared JS must be included in the syntax-check file loop");
assert.ok(workflow.includes('node --check "$file"'), "syntax-check loop must execute node --check for every listed file");
assert.ok(workflow.includes("Test premium experience and connection feedback"), "new contract test must run in CI");

console.log("Experience-layer contracts passed: route coverage, root/directory alias parity, WCAG AA token contrast, opaque keyboard-focus contrast, reduced-motion support, safe offline messaging, and customer-facing naming.");
