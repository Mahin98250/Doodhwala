import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync(new URL("../supabase/migrations/20261022133000_doodhwala_pay_event_ledger.sql", import.meta.url), "utf8");
assert.match(migration, /create table if not exists public\.payment_provider_events/i, "provider webhook events need a dedicated inbox");
assert.match(migration, /unique \(gateway_name, gateway_event_id\)/i, "provider event IDs must be unique for replay protection");
assert.match(migration, /enable row level security/i, "provider event inbox must have RLS enabled");
assert.match(migration, /revoke all on public\.payment_provider_events from anon, authenticated/i, "browser roles must not access webhook inbox");
assert.match(migration, /grant select, insert, update, delete on public\.payment_provider_events to service_role/i, "event inbox must be server-only");
assert.match(migration, /old\.status = 'created'.*new\.status in \('pending_provider','failed','cancelled'\)/s, "created state must only allow safe transitions");
assert.match(migration, /old\.status = 'captured' and new\.status = 'refund_pending'/i, "captured payments may only enter refund flow");
assert.match(migration, /old\.status = 'refund_pending' and new\.status in \('refunded','captured'\)/i, "refund outcomes must be explicit");
assert.match(migration, /invalid_payment_status_transition/i, "invalid state transitions must be rejected at the database");
assert.match(migration, /revoke execute on function public\.doodhwala_pay_guard_state_transition\(\) from public, anon, authenticated/i, "transition helper must not be directly callable by browser roles");
console.log("Doodhwala Pay Phase 2 contracts passed: event idempotency, server-only event inbox and payment-state guard.");
