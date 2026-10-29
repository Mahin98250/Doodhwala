import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const provider = read("provider.js");
const html = read("provider.html");
const css = read("provider.css");
const worker = read("sw.js");
const workflow = read(".github/workflows/static-validation.yml");

const handlerStart = provider.indexOf('list.querySelectorAll("[data-order-status]")');
assert.ok(handlerStart >= 0, "Order status actions must be wired to the rendered queue.");
const handlerEnd = provider.indexOf("\n });", handlerStart);
assert.ok(handlerEnd > handlerStart, "Could not isolate the order status event handler.");
const handler = provider.slice(handlerStart, handlerEnd);
assert.doesNotMatch(handler, /\bprompt\s*\(/, "Decline/cancel reasons must use the in-app dialog, not a browser prompt.");
assert.match(handler, /openOrderReasonDialog\(button,status\)/, "Decline/cancel must open the accessible reason dialog.");
assert.match(handler, /submitProviderOrderStatus\(button,status,null\)/, "Ordinary status transitions must use the same guarded RPC handler.");

for (const source of [
  'function orderProgressMarkup(status,reason)',
  'aria-label="Order progress"',
  'aria-current="step"',
  'function openOrderReasonDialog(button,status)',
  'role="dialog" aria-modal="true"',
  'maxlength="300"',
  'function closeOrderReasonDialog()',
  'function providerOrderStatusError(message)',
  'function updateOrderFilterCounts(orders)',
  'p_new_status:status,p_reason:reason||null',
  'orderProgressMarkup(o.status,o.status_reason)',
  'updateOrderFilterCounts(orders);'
]) {
  assert.ok(provider.includes(source), "Provider order workflow must include: " + source);
}
assert.match(provider, /setInterval\(refreshOrderDeadlines,1000\)/, "Existing acceptance deadline countdown must remain active.");

const escapeStart = provider.indexOf("function escapeHtml(");
const escapeEnd = provider.indexOf("\n", escapeStart);
const progressStart = provider.indexOf("function orderProgressMarkup(status,reason)");
const actionsStart = provider.indexOf("\nfunction orderActions(", progressStart);
const errorStart = provider.indexOf("\nfunction providerOrderStatusError(", actionsStart);
assert.ok(escapeStart >= 0 && escapeEnd > escapeStart, "Provider HTML escaping helper must be available.");
assert.ok(progressStart >= 0 && actionsStart > progressStart && errorStart > actionsStart, "Could not isolate pure order UI helpers.");
const runtimeSource = [
  provider.slice(escapeStart, escapeEnd),
  provider.slice(progressStart, actionsStart),
  provider.slice(actionsStart + 1, errorStart),
  "({ preparing: orderProgressMarkup('preparing', null), cancelled: orderProgressMarkup('cancelled', '<img src=x onerror=alert(1)>'), placed: orderActions({id:'synthetic-order',status:'placed',payment_method:'cod'}), delivered: orderProgressMarkup('delivered', null) })"
].join("\n");
const actual = runInNewContext(runtimeSource, {});
assert.match(actual.preparing, /aria-current="step"/, "Current order stage must be announced accessibly.");
assert.match(actual.preparing, /class="order-progress-step done"/, "Prior stages must be shown as complete.");
assert.match(actual.preparing, /class="order-progress-step current"/, "Current stage must be highlighted.");
assert.match(actual.cancelled, /Order cancelled/, "Cancelled orders must have a terminal state.");
assert.match(actual.cancelled, /&lt;img src=x onerror=alert\(1\)&gt;/, "Customer-visible cancellation reasons must be escaped.");
assert.doesNotMatch(actual.cancelled, /<img\b/, "Cancellation reason must not inject markup.");
assert.match(actual.placed, /Accept order/, "New orders must offer the primary next action.");
assert.match(actual.placed, /Decline order/, "New orders must offer a clearly named decline action.");
assert.match(actual.delivered, /Delivered/, "Delivered orders must reach the final progress stage.");

assert.ok(html.includes("provider.css?v=20261027.2"), "Seller page must load the latest order workflow CSS.");
assert.ok(html.includes("provider.js?v=20261027.1"), "Seller page must load the latest order workflow JavaScript.");
assert.match(css, /\.order-progress\{/, "Order progress must have its own layout.");
assert.match(css, /\.order-reason-modal\{/, "Reason dialog must have a dedicated overlay.");
assert.match(css, /@media\(max-width:700px\)/, "Order progress/dialog must adapt to mobile.");
assert.match(css, /prefers-reduced-motion:reduce/, "New seller workflow styles must respect reduced motion.");
assert.match(css, /focus-visible/, "Keyboard focus must be visible.");
assert.match(worker, /doodhwala-v112/, "PWA cache version must change with updated seller assets.");
assert.ok(worker.includes("/Doodhwala/provider.css?v=20261027.2"), "PWA must cache the versioned seller stylesheet.");
assert.ok(worker.includes("/Doodhwala/provider.js?v=20261027.1"), "PWA must cache the versioned seller runtime.");
assert.match(workflow, /node scripts\/test-provider-simple-order-workflow\.mjs/, "New order workflow regression tests must run in static CI.");

console.log("PASS: provider order progression, cancellation/decline reason dialog, safe reason rendering, filter counts, mobile/accessibility and offline asset contracts.");
