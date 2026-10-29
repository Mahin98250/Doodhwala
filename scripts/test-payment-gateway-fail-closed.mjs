import assert from "node:assert/strict";
import fs from "node:fs";

const api = fs.readFileSync(new URL("../supabase/functions/doodhwala-pay/index.ts", import.meta.url), "utf8");
const ledger = fs.readFileSync(new URL("../supabase/migrations/20261022120000_doodhwala_pay_foundation.sql", import.meta.url), "utf8");
const eventLedger = fs.readFileSync(new URL("../supabase/migrations/20261022133000_doodhwala_pay_event_ledger.sql", import.meta.url), "utf8");

const methodBlock = api.match(/const ONLINE_METHODS = new Set\(\[(.*?)\]\);/s);
assert.ok(methodBlock, "online payment methods must be explicit");
assert.deepEqual(
  [...methodBlock[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]),
  ["upi", "card", "netbanking", "wallet"],
  "only online methods belong in the gateway path; COD stays on the order payment flow",
);

const gatewayGate = api.indexOf('error: "payment_provider_not_configured"');
const orderLookup = api.indexOf('const orderResponse = await rest("orders?id=eq.');
const ledgerInsert = api.indexOf('const insert = await rest("payment_transactions"');
assert.ok(gatewayGate >= 0, "unconfigured gateway must return an explicit error");
const gateStart = api.indexOf("if (ONLINE_METHODS.has(method)) {");
const gateEnd = api.indexOf("\n  }\n\n  const orderResponse", gateStart);
assert.ok(gateStart >= 0 && gateEnd > gateStart, "online gateway guard must be a bounded early-return block");
assert.match(api.slice(gateStart, gateEnd), /503, origin/, "unconfigured online methods must return HTTP 503");
assert.ok(orderLookup > gatewayGate, "disabled gateway must fail before order lookup");
assert.ok(ledgerInsert > gatewayGate, "disabled gateway must fail before creating a payment ledger row");
assert.ok(api.includes('error: "cod_uses_order_payment_flow"'), "COD must not be treated as an online gateway intent");
assert.ok(api.includes("gateway_ready: false") && api.includes("money_moved: false"), "disabled methods must not imply collection or readiness");

assert.match(ledger, /unique \(customer_id, idempotency_key\)/i, "idempotency must be database-enforced");
assert.match(ledger, /revoke all on public\.payment_transactions from anon, authenticated/i, "browser roles must not access the payment ledger");
assert.match(eventLedger, /unique \(gateway_name, gateway_event_id\)/i, "provider webhook event IDs must be replay-safe");
assert.match(eventLedger, /revoke all on public\.payment_provider_events from anon, authenticated/i, "browser roles must not access webhook events");
assert.match(eventLedger, /invalid_payment_status_transition/i, "payment status transitions must be guarded in the database");

console.log("Payment fail-closed security contracts passed: unconfigured online methods create no intents; COD is separate; ledger, event replay, and state-transition guards remain enforced.");
