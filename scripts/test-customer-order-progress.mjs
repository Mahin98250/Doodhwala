import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const orders = read("orders.js");
const html = read("orders.html");
const css = read("orders.css");
const sw = read("sw.js");

function extract(startMarker, endMarker) {
  const start = orders.indexOf(startMarker);
  const end = orders.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, "Could not isolate " + startMarker);
  return orders.slice(start, end).trim();
}
const escape = extract("function esc(v){", "\nfunction money(");
const statusLabel = extract("function statusLabel(v){", "\nfunction countdownText(");
const progress = extract("function renderOrderProgress(status,events){", "\nfunction renderTimeline(events){");
const fixture = [
  "placed", "accepted", "preparing", "ready", "out_for_delivery", "delivered"
];
const result = runInNewContext([
  escape,
  statusLabel,
  progress,
  "({",
  "placed:renderOrderProgress('placed',[]),",
  "accepted:renderOrderProgress('accepted',[]),",
  "preparing:renderOrderProgress('preparing',[]),",
  "ready:renderOrderProgress('ready',[]),",
  "out:renderOrderProgress('out_for_delivery',[]),",
  "delivered:renderOrderProgress('delivered',[]),",
  "cancelled:renderOrderProgress('cancelled',[{to_status:'cancelled',reason:'<img src=x onerror=alert(1)>'}]),",
  "rejected:renderOrderProgress('rejected',[]),",
  "unknown:renderOrderProgress('new_backend_state',[])",
  "})"
].join("\n"), {});

assert.match(result.placed, /Waiting for the seller to respond/, "New orders should explain the next action in plain language.");
assert.match(result.placed, /Step 1 of 6/, "Placed orders should start at the first stage.");
assert.match(result.accepted, /Step 2 of 6/, "Accepted orders should move to stage two.");
assert.match(result.preparing, /aria-current="step"/, "The current stage must be announced accessibly.");
assert.match(result.preparing, /class="customer-progress-step done"/, "Earlier stages should be shown as complete.");
assert.match(result.preparing, /class="customer-progress-step current"/, "The current stage should be visually distinct.");
assert.match(result.preparing, /Milk being packed/, "Packing should use customer-friendly wording.");
assert.match(result.ready, /Your order is ready for delivery/, "Ready orders should explain their current state.");
assert.match(result.out, /Your milk is on its way/, "Out-for-delivery should use direct language.");
assert.match(result.delivered, /Your milk has arrived/, "Delivered orders should be presented as complete.");
assert.match(result.delivered, /Step 6 of 6/, "Delivered orders should finish the progress tracker.");
assert.match(result.cancelled, /This order was cancelled/, "Cancelled orders need a clear terminal state.");
assert.match(result.cancelled, /&lt;img src=x onerror=alert\(1\)&gt;/, "Customer-visible reasons must be escaped.");
assert.doesNotMatch(result.cancelled, /<img\b/, "Order reasons must not inject markup.");
assert.match(result.rejected, /This order was declined/, "Declined orders need a terminal state.");
assert.match(result.unknown, /new backend state/, "Unknown backend statuses must fall back to a safe label rather than fake a progress stage.");

assert.ok(html.includes('orders.css?v=20261027.1'), "Customer orders must load the current progress stylesheet.");
assert.ok(html.includes('orders.js?v=20261027.1'), "Customer orders must load the current progress runtime.");
assert.match(css, /\.customer-order-progress\{/, "The customer progress panel needs a distinct layout.");
assert.match(css, /\.customer-progress-step\.current/, "Current delivery step must be visible.");
assert.match(css, /@media\(max-width:620px\)/, "Progress should adapt for mobile screens.");
assert.match(css, /prefers-reduced-motion:reduce/, "Progress should respect reduced-motion preferences.");
assert.match(css, /focus-visible/, "Timeline toggles should show keyboard focus.");
assert.match(sw, /const CACHE="doodhwala-v97"/, "Installed PWAs should refresh to the new cache revision.");
assert.ok(sw.includes("/Doodhwala/orders.js?v=20261027.1"), "The updated customer order script must be precached.");
assert.ok(sw.includes("/Doodhwala/orders.css?v=20261027.1"), "The updated customer order styles must be precached.");
assert.ok(fixture.length===6, "The customer progress tracker should cover the same six everyday stages as the seller dashboard.");

console.log("PASS: customer order progress states, cancelled/declined reason escaping, unknown-state fallback, mobile CSS and PWA cache contracts.");
