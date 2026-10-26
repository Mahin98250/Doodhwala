import assert from "node:assert/strict";
import fs from "node:fs";

const schema = fs.readFileSync(new URL("../supabase/migrations/20261026120000_doodhwala_provider_monthly_billing.sql", import.meta.url), "utf8");
const rpcs = fs.readFileSync(new URL("../supabase/migrations/20261026121000_doodhwala_provider_billing_rpcs.sql", import.meta.url), "utf8");

assert.match(schema, /create table if not exists public\.provider_subscription_invoices/i);
assert.match(schema, /create table if not exists public\.provider_subscription_payments/i);
assert.match(schema, /unique\(method,reference\)/i, "duplicate payment references must be rejected");
assert.match(schema, /enable row level security/i, "billing tables must use RLS");
assert.match(schema, /provider_subscription_invoice_owner_read[\s\S]*?p\.owner_user_id=\(select auth\.uid\(\)\)/i, "providers may read only their own invoices");
assert.match(schema, /provider_subscription_payment_owner_read[\s\S]*?p\.owner_user_id=\(select auth\.uid\(\)\)/i, "providers may read only their own payment records");
assert.match(rpcs, /provider_get_my_billing/i, "provider needs a billing dashboard read API");
assert.match(rpcs, /admin_upsert_provider_billing_plan/i, "only admins manage fixed plan pricing");
assert.match(rpcs, /admin_create_provider_subscription_invoice/i, "invoice amount must be derived from the active plan");
assert.match(rpcs, /v_plan\.amount_paise/i, "invoice uses server-side plan price");
assert.match(rpcs, /admin_record_provider_subscription_payment/i, "admin reconciliation endpoint is required");
assert.match(rpcs, /p_amount_paise<>v_invoice\.amount_paise/i, "partial or wrong amount cannot mark an invoice paid");
assert.match(rpcs, /private\.is_current_user_admin\(\)/i, "admin writes must enforce the private admin allowlist");
assert.match(rpcs, /admin_set_provider_billing_settings/i, "owner can configure Doodhwala UPI instructions");
assert.doesNotMatch(rpcs, /update public\.orders/i, "seller subscription payment must never update customer order status");
assert.doesNotMatch(rpcs, /update public\.payment_transactions/i, "seller subscription payment must not alter customer payment ledger");
console.log("Provider billing contract checks passed: separate ledgers, RLS, admin-only billing writes, server-priced invoices, amount/reference guards.");
