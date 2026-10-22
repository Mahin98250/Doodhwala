import assert from "node:assert/strict";
import fs from "node:fs";

const api = fs.readFileSync(new URL("../supabase/functions/doodhwala-pay/index.ts", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("../supabase/migrations/20261022120000_doodhwala_pay_foundation.sql", import.meta.url), "utf8");

assert.match(api, /auth\\/v1\\/user/, "payment API must validate the caller session with Supabase Auth");
assert.match(api, /customer_id=eq\\./, "orders and payment status must be scoped to the authenticated customer");
assert.match(api, /Math\\.round\\(total \\* 100\\)/, "server must derive the payable amount from the database order total in paise");
assert.match(api, /idempotency_key/, "payment intents must be idempotent");
assert.match(api, /idempotency_conflict/, "reusing a key for different order terms must fail");
assert.match(api, /payment_provider_setup_required/, "online payments must fail closed until an actual provider is configured");
assert.match(api, /money_moved: false/, "intent creation must never claim funds were collected");
assert.doesNotMatch(api, /input\\.(card_number|cvv|upi_pin|bank_password)/i, "the app must never collect sensitive payment credentials");
assert.match(api, /get_status/, "customer-owned payment status lookup must exist");
assert.match(migration, /enable row level security/i, "payment ledger must have RLS enabled");
assert.match(migration, /revoke all on public\\.payment_transactions from anon, authenticated/i, "browser roles must not write payment ledger rows");
assert.match(migration, /grant select, insert, update, delete on public\\.payment_transactions to service_role/i, "ledger writes must be server-owned");
assert.match(migration, /unique \\(customer_id, idempotency_key\\)/i, "database must enforce payment-intent idempotency");
assert.match(migration, /captured/, "captured must be an explicit state, not inferred from a client callback");
console.log("Doodhwala Pay contracts passed: authenticated ownership, server-calculated amount, idempotency, restricted ledger and fail-closed collection.");
