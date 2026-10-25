import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const plans = read("plans.js");
const orders = read("orders.js");
const home = read("index.html");
const plansHtml = read("plans.html");
const ordersHtml = read("orders.html");
const nav = read("customer-nav.js");
const mobileCss = read("customer-ui-polish.css");
const transitionJs = read("milk-transition.js");
const transitionCss = read("milk-transition.css");
const worker = read("sw.js");
const resilience = read("resilience.js");

assert.doesNotMatch(plans, /\bsup\.(?:from|rpc)\(/, "Plans must call the Supabase client accessor before from()/rpc().");
assert.match(plans, /const sup\s*=\s*\(\)\s*=>\s*window\.Doodhwala\?\.supabase/, "Plans Supabase accessor should remain explicit.");
assert.match(plans, /async function loadContext\(/, "Plans account loading entry point must exist.");
assert.match(plans, /async function loadPlans\(/, "Plans list loading entry point must exist.");

const ordersBaseSelect = orders.match(/\.from\(["']orders["']\)\s*\.select\(["']([^"']+)["']\)/);
assert.ok(ordersBaseSelect, "Orders must keep a primary orders query.");
assert.doesNotMatch(ordersBaseSelect[1], /payment_(?:method|status|reference|confirmed_at)/, "Optional payment columns must not block core order history on older production schemas.");
assert.match(orders, /paymentResult/, "Payment details should be loaded separately as optional metadata.");

for (const [name, html] of [["home", home], ["plans", plansHtml], ["orders", ordersHtml]]) {
  assert.match(html, /customer-ui-polish\.css\?v=20261025\.3/, name + " page must load the responsive UI fixes.");
  assert.match(html, /milk-transition\.css\?v=20261025\.3/, name + " page must load the milk animation styles.");
  assert.match(html, /milk-transition\.js\?v=20261025\.3/, name + " page must load the transition runtime.");
}
assert.match(nav, /function go\(url\).*DoodhwalaMilkTransition/, "Bottom navigation must use the milk transition helper.");
assert.match(transitionJs, /showLoading/);
assert.match(transitionJs, /navigate\(url\)/);
assert.match(transitionCss, /@keyframes dw-milk-drop/);
assert.match(transitionCss, /prefers-reduced-motion/);
assert.match(mobileCss, /grid-template-areas/);
assert.match(mobileCss, /@media\(max-width:390px\)/);
assert.match(worker, /doodhwala-v91/, "Service worker cache must be bumped so installed PWAs refresh stale assets.");
assert.match(worker, /customer-ui-polish\.css\?v=20261025\.3/);
assert.match(worker, /milk-transition\.js\?v=20261025\.3/);
assert.match(resilience, /aboveCustomerNav/);
assert.match(resilience, /APP_VERSION = "20261025\.3"/);

console.log("PASS: customer mobile layout, Plans Supabase calls, Orders schema compatibility, milk transitions, PWA cache, and recovery-notice contracts.");
