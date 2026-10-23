import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");
const migration = read("supabase/migrations/20261023150000_doodhwala_payment_audit_and_reference_guard.sql");
const sellerPayments = read("supabase/migrations/20261022150000_doodhwala_direct_seller_payments.sql");
const provider = read("provider.js");
const checkout = read("checkout.js");
const docs = read("PAYMENT_SECURITY_READINESS.md");

assert.match(migration, /create table if not exists public\.order_payment_events/i);
assert.match(migration, /alter table public\.order_payment_events enable row level security/i);
assert.match(migration, /revoke all on public\.order_payment_events from anon, authenticated/i);
assert.match(migration, /grant select on public\.order_payment_events to authenticated/i);
assert.match(migration, /Order participants read payment audit/i);
assert.match(migration, /create trigger orders_log_payment_audit_event/i);
assert.match(migration, /security definer\s+set search_path = ''/i, "audit trigger must use a fixed empty search_path");
assert.match(migration, /order_payment_events_no_mutation/i);
assert.match(migration, /payment_audit_events_are_immutable/i, "audit trail rows must not be editable or deletable");
assert.match(migration, /payment_reference_required/i);
assert.match(migration, /length\(v_reference\) < 6/i);
assert.match(migration, /v_reference !~ '\^\[A-Za-z0-9\/_-\]\{6,120\}\$'/i);
assert.match(migration, /bank_settlement_verified_by_doodhwala', false/i, "a seller attestation must not be represented as bank verification");
assert.match(migration, /revoke execute on function public\.provider_confirm_direct_upi_payment\(uuid, text\) from public, anon/i);
assert.match(migration, /grant execute on function public\.provider_confirm_direct_upi_payment\(uuid, text\) to authenticated/i);

assert.match(provider, /Enter the UPI transaction reference \/ UTR/i, "seller UI must request the payment reference");
assert.match(provider, /valid transaction reference is required\. Nothing was confirmed/i, "UI must stop before RPC when the reference is invalid");
assert.match(provider, /provider_confirm_direct_upi_payment/);
assert.match(provider, /bank settlement is not independently verified/i);
assert.match(sellerPayments, /payment_fields_require_authorized_rpc/i, "existing guarded payment-field updates must remain part of the architecture");
assert.match(checkout, /customer_order_payment_controls_ready/, "checkout must stay closed when required payment migrations are missing");
assert.match(docs, /not independently verified/i, "payment readiness documentation must disclose the limitation");

console.log("Payment reconciliation contracts passed: immutable participant-scoped audit, mandatory UPI reference, guarded seller confirmation, and no false bank-verification claim.");
