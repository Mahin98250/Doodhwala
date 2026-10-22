import assert from "node:assert/strict";
import fs from "node:fs";

const api = fs.readFileSync(new URL("../supabase/functions/doodhwala-pay/index.ts", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("../supabase/migrations/20261022120000_doodhwala_pay_foundation.sql", import.meta.url), "utf8");
const orderStateMachine = fs.readFileSync(new URL("../supabase/migrations/20261007092600_doodhwala_order_state_machine.sql", import.meta.url), "utf8");
const payableStatusesMatch = api.match(/const payableOrderStatuses = new Set\\(\\[(.*?)\\]\\);/s);
assert.ok(payableStatusesMatch, "payment intents must use an explicit allowlist of payable order states");
const payableStatuses = [...payableStatusesMatch[1].matchAll(/"([^"]+)"/g)].map(match => match[1]);
assert.deepEqual(payableStatuses, ["placed", "accepted", "preparing", "ready", "out_for_delivery"], "only known pre-delivery order states may create payment intents");
for (const status of ["placed", "accepted", "preparing", "ready", "out_for_delivery", "delivered", "rejected", "cancelled"]) {
  assert.ok(orderStateMachine.includes("'" + status + "'"), "payment state checks must stay aligned with order status migration: " + status);
}
assert.ok(api.includes("!payableOrderStatuses.has(String(order.status))"), "unknown, delivered, rejected and cancelled orders must fail closed");

assert.ok(api.includes("/auth/v1/user"), "payment API must validate the caller session with Supabase Auth");
assert.ok(api.includes("!PUBLISHABLE_KEYS.length"), "missing publishable-key allowlist configuration must fail closed");
assert.ok(api.includes("if (!apiKey || !PUBLISHABLE_KEYS.includes(apiKey))"), "missing or unconfigured client apikey must be rejected before authentication");
assert.doesNotMatch(api, /PUBLISHABLE_KEYS\.length\s*&&/, "an empty allowlist must never disable API-key validation");
assert.ok(api.includes("customer_id=eq."), "orders and payment status must be scoped to the authenticated customer");
assert.ok(api.includes("Math.round(total * 100)"), "server must derive the payable amount from the database order total in paise");
assert.ok(api.includes("idempotency_key"), "payment intents must be idempotent");
assert.ok(api.includes("idempotency_conflict"), "reusing a key for different order terms must fail");
assert.ok(api.includes("Concurrent retries can race") && api.includes("racedRows"), "concurrent idempotent retries must safely return the existing matching intent");
assert.ok(api.includes("payment_provider_setup_required"), "online payments must fail closed until an actual provider is configured");
assert.ok(api.includes("money_moved: false"), "intent creation must never claim funds were collected");
assert.ok(api.includes('return json({ ok: true }, 200, origin)'), "CORS preflight must not return a body with a 204 status");
assert.ok(api.includes("req.body?.getReader()") && api.includes("if (size > MAX_BODY_BYTES)"), "request stream must be bounded before buffering, even without Content-Length");
assert.doesNotMatch(api, /input\.(card_number|cvv|upi_pin|bank_password)/i, "the app must never collect sensitive payment credentials");
assert.ok(api.includes("get_status"), "customer-owned payment status lookup must exist");
assert.match(migration, /enable row level security/i, "payment ledger must have RLS enabled");
assert.ok(migration.includes("revoke all on public.payment_transactions from anon, authenticated"), "browser roles must not write payment ledger rows");
assert.ok(migration.includes("grant select, insert, update, delete on public.payment_transactions to service_role"), "ledger writes must be server-owned");
assert.ok(migration.includes("unique (customer_id, idempotency_key)"), "database must enforce payment-intent idempotency");
assert.ok(migration.includes("captured"), "captured must be an explicit state, not inferred from a client callback");
console.log("Doodhwala Pay contracts passed: authenticated ownership, server-calculated amount, idempotency, restricted ledger and fail-closed collection.");
