import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");
const eta = read("supabase/migrations/20261025210000_doodhwala_restore_delivery_promise_functions.sql").toLowerCase();
const cancelGrant = read("supabase/migrations/20261025211000_grant_customer_cancel_order_implementation.sql").toLowerCase();
const cancelImpl = read("supabase/migrations/20261007183000_doodhwala_secure_rpc_wrappers.sql").toLowerCase();
const lifecycle = read("supabase/migrations/20261008030000_provider_order_lifecycle_hardening.sql").toLowerCase();
const migrationReconciliation = read("docs/STAGING_MIGRATION_RECONCILIATION.md").toLowerCase();

assert.ok(eta.includes("create or replace function private.calculate_order_eta(p_order_id uuid)"),
  "the ETA calculation referenced by delivery lifecycle must have a repository definition");
assert.ok(eta.includes("create or replace function private.set_order_delivery_promise(p_order_id uuid)"),
  "provider acceptance must be able to compute and persist a delivery promise");
assert.ok(eta.includes("security definer") && eta.includes("set search_path to ''"),
  "private ETA helpers must retain a hardened SECURITY DEFINER search path");
assert.ok(eta.includes("estimated_delivery_min_minutes = v_eta.eta_min")
  && eta.includes("estimated_delivery_max_minutes = v_eta.eta_max")
  && eta.includes("promised_delivery_at = v_eta.promised_at")
  && eta.includes("late_after_at = v_eta.late_after"),
  "delivery promises must persist all expected SLA fields");
assert.ok(eta.includes("revoke all on function private.calculate_order_eta(uuid) from public, anon, authenticated")
  && eta.includes("revoke all on function private.set_order_delivery_promise(uuid) from public, anon, authenticated"),
  "private ETA implementation functions must not be executable as browser RPCs");
assert.ok(lifecycle.includes("perform private.set_order_delivery_promise(p_order_id)"),
  "provider acceptance must call the ETA persistence helper");

assert.ok(cancelImpl.includes("where id=p_order_id and customer_id=v_uid"),
  "cancellation implementation must be scoped to the authenticated customer");
assert.ok(cancelImpl.includes("if v_order.status not in ('placed','accepted')"),
  "customer cancellation must be limited to eligible order states");
assert.ok(cancelImpl.includes("returns jsonb language sql security invoker"),
  "the public cancellation wrapper must remain SECURITY INVOKER");
assert.ok(cancelGrant.includes("grant execute on function private.customer_cancel_order_impl(uuid, text) to authenticated"),
  "the invoker wrapper needs authenticated EXECUTE on its private implementation");
assert.ok(!cancelGrant.includes("to anon") && !cancelGrant.includes("to public"),
  "anonymous and PUBLIC access to the cancellation implementation must not be granted");


assert.ok(migrationReconciliation.includes("do not run `supabase db push`"),
  "staging migration history must be reconciled before db push");
assert.ok(migrationReconciliation.includes("do not edit `supabase_migrations.schema_migrations` directly"),
  "migration history must use the supported repair workflow, not direct metadata edits");
for (const filename of [
  "20261025170000_staging_security_hardening.sql",
  "20261025171000_remove_legacy_create_order_overload.sql",
  "20261025180000_delivery_tracking_owner_read_policy.sql",
  "20261022120000_doodhwala_pay_foundation.sql",
  "20261022150000_doodhwala_direct_seller_payments.sql",
  "20261022151000_doodhwala_direct_upi_settings_read.sql",
  "20261022152000_doodhwala_payment_choice_race_guard.sql",
  "20261022153000_doodhwala_guard_payment_field_writes.sql",
  "20261022154000_doodhwala_direct_upi_pending_only.sql",
  "20261023050000_doodhwala_payment_controls_readiness.sql",
  "20261023100000_doodhwala_recheck_seller_approval_for_upi.sql",
  "20261025190000_doodhwala_payment_fk_indexes.sql",
  "20261012090500_doodhwala_consolidate_admin_select_policies.sql",
  "20261025200000_doodhwala_consolidate_admin_select_policies_followup.sql",
  "20261025210000_doodhwala_restore_delivery_promise_functions.sql",
  "20261025211000_grant_customer_cancel_order_implementation.sql"
]) {
  assert.ok(migrationReconciliation.includes(filename.toLowerCase()),
    "staging migration ledger must retain a mapping for " + filename);
}

console.log("Staging order-security dependency contracts passed: ETA helpers are private, delivery promises are wired, and customer cancellation has the required authenticated implementation grant.");
