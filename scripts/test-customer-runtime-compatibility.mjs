import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");
const plans = read("plans.js");
const orders = read("orders.js");
const plansHtml = read("plans.html");
const ordersHtml = read("orders.html");
const adminHtml = read("admin.html");
const adminCss = read("admin.css");
const sw = read("sw.js");

assert.match(plans, /const sup=\(\)=>window\.Doodhwala\?\.supabase/);
assert.match(plans, /const client=sup\(\)/, "plans page should keep a guarded Supabase client reference");
assert.match(plans, /client\.auth\.getSession\(\)/, "plans should get the session from the actual client object");
assert.doesNotMatch(plans, /\bsup\.(?:auth|from|rpc|channel|removeChannel)\b/,
  "sup is a client getter function; all direct sup.property calls would crash");
assert.match(plans, /sup\(\)\.channel\(/, "realtime subscriptions should call the client getter");
assert.match(plans, /sup\(\)\.from\(/, "database queries should call the client getter");
assert.match(plans, /sup\(\)\.rpc\(/, "subscription RPCs should call the client getter");

assert.match(orders, /async function fetchCustomerOrders\(userId\)/, "orders need a schema-compatible read helper");
assert.match(orders, /payment_method,payment_status,payment_reference,payment_confirmed_at/,
  "orders should still use payment fields when the live schema supports them");
assert.match(orders, /const missingPaymentColumn=/, "fallback must only react to a known missing payment column");
assert.match(orders, /read\(withoutPayments\)/, "orders must retry with the legacy select when payment columns are missing");
assert.match(orders, /paymentSchemaFallback/, "fallback state should be exposed without leaking the database error");
assert.match(orders, /hasPaymentMethod&&o\.payment_method===\"direct_upi\"/,
  "a missing payment schema must never create an unsupported UPI payment action");
assert.match(orders, /hasOwnProperty\.call\(o,\"payment_method\"\)/,
  "missing payment method must not be misrepresented as Cash on Delivery");

assert.ok(plansHtml.includes("/Doodhwala/plans.js?v=20261023.2"), "plans HTML must bust cache for fixed runtime");
assert.ok(ordersHtml.includes("/Doodhwala/orders.js?v=20261023.2"), "orders HTML must bust cache for schema fallback");
assert.ok(adminHtml.includes("/Doodhwala/admin.css?v=20261023.2"), "admin HTML must load the latest admin styles");
assert.ok(adminHtml.includes("/Doodhwala/admin.js?v=20261023.2"), "admin HTML must load the latest admin runtime");
assert.ok(adminCss.includes(".admin-mobile-nav{display:flex;position:fixed"), "mobile admin navigation should be fixed and accessible");
assert.ok(adminCss.includes('button[data-section="seller-billing"]::before'), "seller billing should have its own navigation cue");

assert.ok(sw.includes('const CACHE="doodhwala-v86"'), "PWA cache should advance after customer runtime fixes");
for (const asset of [
  "/Doodhwala/plans.js?v=20261023.2",
  "/Doodhwala/orders.js?v=20261023.2",
  "/Doodhwala/admin.css?v=20261023.2",
  "/Doodhwala/admin.js?v=20261023.2"
]) assert.ok(sw.includes(asset), "PWA cache should include " + asset);

console.log("Customer runtime compatibility contracts passed.");
