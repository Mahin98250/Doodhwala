import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const app = read("app.js");
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
for (const script of ["app.js", "auth.js", "checkout.js", "checkout-10x.js", "customer-nav.js", "customer-10x.js", "customer-market-10x.js", "location.js", "orders.js", "plans.js", "product.js", "store.js"]) {
  assert.doesNotMatch(read(script), /\bsup\.(?:from|rpc)\(/, script + " must not call from()/rpc() on a Supabase client accessor function.");
}
assert.match(plans, /const sup\s*=\s*\(\)\s*=>\s*window\.Doodhwala\?\.supabase/, "Plans Supabase accessor should remain explicit.");
assert.match(plans, /async function loadContext\(/, "Plans account loading entry point must exist.");
assert.match(plans, /async function loadPlans\(/, "Plans list loading entry point must exist.");

const ordersBaseSelect = orders.match(/\.from\(["']orders["']\)\s*\.select\(["']([^"']+)["']\)/);
assert.ok(ordersBaseSelect, "Orders must keep a primary orders query.");
assert.doesNotMatch(ordersBaseSelect[1], /payment_(?:method|status|reference|confirmed_at)/, "Optional payment columns must not block core order history on older production schemas.");
assert.match(orders, /paymentResult/, "Payment details should be loaded separately as optional metadata.");
assert.match(orders, /Payment method not recorded/, "Older production orders must not be incorrectly labeled as COD when payment metadata is absent.");

for (const [name, html] of [["home", home], ["plans", plansHtml], ["orders", ordersHtml]]) {
  assert.match(html, /customer-ui-polish\.css\?v=20261025\.3/, name + " page must load the responsive UI fixes.");
  assert.match(html, /milk-transition\.css\?v=20261025\.3/, name + " page must load the milk animation styles.");
  assert.match(html, /milk-transition\.js\?v=20261025\.3/, name + " page must load the transition runtime.");
}
assert.match(nav, /function go\(url\).*DoodhwalaMilkTransition/, "Bottom navigation must use the milk transition helper.");
assert.match(app, /showLoading\("Finding fresh milk nearby…?"\)/, "Home provider data loading should display the milk animation.");
assert.match(app, /milkTransition\?\.hideLoading\(\)/, "Home provider data loading must always clear the loader.");
assert.match(app, /destination==="plans"\|\|destination==="orders"/, "Desktop sidebar must navigate to Plans and Orders.");
assert.match(app, /DoodhwalaMilkTransition\.navigate\(url\)/, "Desktop customer navigation must use the milk transition.");
assert.ok(home.indexOf("milk-transition.js?v=20261025.3") < home.indexOf("app.js?v=20261025.5"), "Milk transition runtime must be available before the home app requests data.");
assert.match(ordersHtml, /customer-10x\.js\?v=20261023\.4" data-doodhwala-10x="1"/, "Orders page must use one current customer 10X runtime without injecting a duplicate.");
assert.match(worker, /doodhwala-v93/, "PWA cache must change when the home runtime changes.");
assert.match(transitionJs, /showLoading/);
const showLoadingBlock = transitionJs.slice(transitionJs.indexOf("function showLoading"), transitionJs.indexOf("function hideLoading"));
assert.match(showLoadingBlock, /loader\.hidden=false/, "Data loader must be prepared before a transition overlay fades.");
assert.doesNotMatch(showLoadingBlock, /if\(overlay&&overlay\.classList\.contains\("is-visible"\)\)return/, "A visible page-transition overlay must not suppress the data-loading indicator.");

assert.match(transitionJs, /navigate\(url\)/);
assert.match(transitionCss, /@keyframes dw-milk-drop/);
assert.match(transitionCss, /prefers-reduced-motion/);
assert.match(mobileCss, /grid-template-areas/);
assert.match(mobileCss, /@media\(max-width:390px\)/);
assert.match(worker, /doodhwala-v93/, "Service worker cache must be bumped so installed PWAs refresh stale assets.");
assert.match(worker, /customer-ui-polish\.css\?v=20261025\.3/);
assert.match(worker, /customer-journey-refresh\.css\?v=20261025\.3/, "PWA must cache the styles required by Plans and Orders.");
assert.match(worker, /milk-transition\.js\?v=20261025\.3/);
assert.match(resilience, /aboveCustomerNav/);
assert.ok(resilience.includes('^\\/$'), "Root-hosted Home page errors must place recovery notices above the bottom navigation.");
assert.match(resilience, /APP_VERSION = "20261025\.3"/);


/* Execute the actual Plans loader with a tiny Supabase mock. This catches the
   historical sup.from is not a function bug rather than only checking source text. */
const helperMatch = plans.match(/const sup=\(\)=>window\.Doodhwala\?\.supabase;/);
assert.ok(helperMatch, "Plans Supabase accessor must be available for the runtime smoke test.");
const loadStart = plans.indexOf("async function loadPlans(){");
const loadEnd = plans.indexOf("\nfunction planCard(", loadStart);
assert.ok(loadStart >= 0 && loadEnd > loadStart, "Could not isolate the Plans list loader for the runtime smoke test.");
const loadPlansSource = plans.slice(loadStart, loadEnd);
const queriedTables = [];
const mockQuery = {
  select() { return this; },
  eq() { return this; },
  order() { return Promise.resolve({ data: [], error: null }); }
};
const mockSupabase = {
  from(table) { queriedTables.push(table); return mockQuery; }
};
const mockElements = new Map();
const planRuntimeResult = await runInNewContext(
  "(async()=>{" + helperMatch[0] + "\n" + loadPlansSource + "\nreturn await loadPlans();})()",
  {
    window: { Doodhwala: { supabase: mockSupabase } },
    user: { id: "customer-runtime-smoke" },
    sup: undefined,
    $: (id) => {
      if (!mockElements.has(id)) mockElements.set(id, { innerHTML: "", textContent: "", classList: { add() {}, remove() {}, contains() { return false; } } });
      return mockElements.get(id);
    },
    document: { querySelectorAll() { return []; } },
    console: { warn() {}, error() {}, info() {} }
  }
);
assert.equal(planRuntimeResult, true, "Plans loader should complete with a valid Supabase client and empty plan history.");
assert.deepEqual(queriedTables, ["milk_subscriptions"], "Plans loader must call from() on the returned client, not on the accessor function.");
assert.match(mockElements.get("plansList").innerHTML, /No recurring plans yet/, "Empty plan history should render a usable empty state.");


/* Exercise the real-time setup with the actual function. This catches using the
   Supabase accessor as an object (sup.channel) instead of its client (sup().channel). */
const realtimeStart = plans.indexOf("function setupPlansRealtime(user){");
const realtimeEnd = plans.indexOf("\\nasync function loadContext()", realtimeStart);
assert.ok(realtimeStart >= 0 && realtimeEnd > realtimeStart, "Could not isolate the Plans realtime setup function.");
const realtimeSource = plans.slice(realtimeStart, realtimeEnd);
const createdChannels = [];
const removedChannels = [];
const mockRealtimeClient = {
  channel(name) {
    const channel = {
      name,
      on() { return this; },
      subscribe(callback) { callback("SUBSCRIBED"); return this; }
    };
    createdChannels.push(channel);
    return channel;
  },
  removeChannel(channel) { removedChannels.push(channel); return Promise.resolve("removed"); }
};
await runInNewContext(
  helperMatch[0] + "\\n" + realtimeSource +
  "\\nsetupPlansRealtime({id: \"first-customer\"}); setupPlansRealtime({id: \"second-customer\"});",
  {
    window: { Doodhwala: { configured: true, supabase: mockRealtimeClient } },
    document: { visibilityState: "visible" },
    console: { warn() {}, error() {} }
  }
);
assert.deepEqual(createdChannels.map(channel => channel.name), [
  "customer-plans-first-customer",
  "customer-plans-second-customer"
], "Plans realtime must create a channel through the returned Supabase client.");
assert.deepEqual(removedChannels, [createdChannels[0]], "Changing customer channels must remove the previous channel through the client.");

console.log("PASS: customer mobile layout, Plans Supabase calls, Orders schema compatibility, milk transitions, PWA cache, and recovery-notice contracts.");
