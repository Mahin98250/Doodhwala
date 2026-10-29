import assert from "node:assert/strict";
import fs from "node:fs";

const schema = fs.readFileSync(new URL("../supabase/migrations/20261026120000_doodhwala_provider_monthly_billing.sql", import.meta.url), "utf8");
const rpcs = fs.readFileSync(new URL("../supabase/migrations/20261026121000_doodhwala_provider_billing_rpcs.sql", import.meta.url), "utf8");
const referenceGuard = fs.readFileSync(new URL("../supabase/migrations/20261026124000_doodhwala_provider_billing_reference_unique.sql", import.meta.url), "utf8");
const adminSettings = fs.readFileSync(new URL("../supabase/migrations/20261026123000_doodhwala_admin_get_provider_billing_settings.sql", import.meta.url), "utf8");

assert.match(schema, /create table if not exists public\.provider_subscription_invoices/i);
assert.match(schema, /create table if not exists public\.provider_subscription_payments/i);
assert.match(schema, /unique\(method,reference\)/i, "references are initially unique within a method");
assert.match(referenceGuard, /create unique index if not exists provider_subscription_payments_reference_unique_idx[\s\S]*?\(reference\)/i, "a UPI/bank reference cannot be reused under a different method");
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
assert.doesNotMatch(rpcs, /not private\.is_current_user_admin\(\)/i, "admin checks must not accidentally authorize NULL helper results");
assert.match(rpcs, /not coalesce\(private\.is_current_user_admin\(\), false\)/i, "billing admin RPCs must fail closed when the helper returns false or NULL");
assert.match(adminSettings, /not coalesce\(private\.is_current_user_admin\(\), false\)/i, "billing settings admin RPC must fail closed when the helper returns false or NULL");
assert.match(rpcs, /admin_set_provider_billing_settings/i, "owner can configure Doodhwala UPI instructions");
assert.doesNotMatch(rpcs, /update public\.orders/i, "seller subscription payment must never update customer order status");
assert.doesNotMatch(rpcs, /update public\.payment_transactions/i, "seller subscription payment must not alter customer payment ledger");

const invoiceIdempotency = fs.readFileSync(new URL("../supabase/migrations/20261026125000_doodhwala_provider_invoice_month_idempotency.sql", import.meta.url), "utf8");
const amountTimeGuards = fs.readFileSync(new URL("../supabase/migrations/20261029102526_doodhwala_billing_amount_and_time_guards.sql", import.meta.url), "utf8");
assert.match(amountTimeGuards, /provider_billing_plans_amount_paise_range_check/i, "database must bound plan prices");
assert.match(amountTimeGuards, /provider_subscription_invoices_amount_paise_range_check/i, "database must bound invoice amounts");
assert.match(amountTimeGuards, /provider_subscription_payments_amount_paise_range_check/i, "database must bound recorded payment amounts");
assert.match(amountTimeGuards, /p_amount_paise < 100 or p_amount_paise > 100000000/i, "server RPC must enforce ₹1–₹10,00,000 plan/payment bounds");
assert.match(amountTimeGuards, /payment_received_at_in_future/i, "future-dated manual payment evidence must be rejected");
assert.match(amountTimeGuards, /payment_received_before_invoice/i, "manual payment evidence cannot predate invoice creation");
assert.match(amountTimeGuards, /revoke all on function public\.admin_record_provider_subscription_payment[\s\S]*?from public,anon,authenticated/i, "replacement payment RPC must retain explicit grants");
assert.match(invoiceIdempotency, /provider_subscription_invoices_calendar_month_check/i, "monthly billing periods must be full calendar months");
assert.match(invoiceIdempotency, /provider_subscription_invoices_provider_month_unique[\s\S]*?unique\s*\(provider_id,\s*period_start\)/i, "database must enforce one invoice per provider/month");
assert.match(invoiceIdempotency, /on conflict\s*\(provider_id,\s*period_start\)\s*do nothing/i, "concurrent invoice creation must not create a duplicate");
assert.match(invoiceIdempotency, /provider_month_invoice_retry_required/i, "a missing conflict winner must return an explicit retryable failure");
assert.match(invoiceIdempotency, /provider_month_invoice_period_conflict/i, "conflicting invoice period inputs must be rejected");
assert.match(invoiceIdempotency, /not coalesce\(private\.is_current_user_admin\(\),\s*false\)/i, "invoice creation must fail closed when the admin helper returns false or null");
assert.match(invoiceIdempotency, /revoke all on function public\.admin_create_provider_subscription_invoice[\s\S]*?from public, anon, authenticated/i, "invoice RPC must not be executable by anonymous or arbitrary authenticated users");

console.log("Provider billing contract checks passed: separate ledgers, RLS, admin-only billing writes, server-priced invoices, amount/reference guards, calendar-month invoice idempotency.");
