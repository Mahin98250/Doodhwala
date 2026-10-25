import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");
const lower = (path) => read(path).toLowerCase();

const privileges = lower("supabase/migrations/20261025214000_staging_least_privilege_role_guards.sql");
assert.match(privileges, /revoke truncate, references, trigger\s+on all tables in schema public\s+from public, anon, authenticated/);
assert.match(privileges, /alter default privileges for role postgres\s+revoke all on tables from public, anon, authenticated/);
assert.match(privileges, /alter default privileges for role postgres\s+revoke all on sequences from public, anon, authenticated/);
assert.match(privileges, /alter default privileges for role postgres\s+revoke execute on functions from public, anon, authenticated/);
assert.match(privileges, /raise exception 'account_type_managed_by_admin'/);
assert.match(privileges, /before insert or update on public\.profiles/);

const sellerPrivacy = lower("supabase/migrations/20261025215000_staging_protect_seller_private_fields.sql");
assert.match(sellerPrivacy, /revoke select on table public\.provider_profiles from authenticated/);
assert.match(sellerPrivacy, /revoke select on table public\.provider_verifications from authenticated/);
assert.match(sellerPrivacy, /grant select \(provider_id, status\) on table public\.provider_verifications to authenticated/);
assert.match(sellerPrivacy, /revoke execute on function public\.find_nearby_providers\(numeric, numeric, numeric\) from public, anon, authenticated/);
assert.doesNotMatch(sellerPrivacy, /grant select\s*\([^)]*owner_name/i,
  "seller private name must not be granted through the public table");
assert.doesNotMatch(sellerPrivacy, /grant select\s*\([^)]*phone/i,
  "seller private phone must not be granted through the public table");

const hideOwnerId = lower("supabase/migrations/20261013170000_doodhwala_hide_provider_owner_uuid.sql");
assert.match(hideOwnerId, /revoke select \(owner_user_id\)\s+on table public\.provider_profiles from authenticated/);
const anonRevoke = lower("supabase/migrations/20261013130000_doodhwala_revoke_anon_table_writes.sql");
assert.match(anonRevoke, /revoke insert, update, delete on all tables in schema public from anon/);

const nearby = lower("supabase/migrations/20261023120000_doodhwala_bounded_nearby_provider_search.sql");
assert.match(nearby, /bounded_providers as/);
assert.match(nearby, /least\(coalesce\(p_max_km, 20\), 25\)/);
assert.match(nearby, /pp\.is_active/);
assert.match(nearby, /pv\.status = 'approved'/);
assert.match(nearby, /returns table\s*\(\s*provider_id uuid,\s*provider_name text/);
assert.doesNotMatch(nearby, /returns table\s*\([^)]*owner_name/i);

const capacity = lower("supabase/migrations/20261023130000_doodhwala_order_capacity_query_indexes.sql");
assert.match(capacity, /orders_provider_open_capacity_idx/);
assert.match(capacity, /orders_provider_daily_litres_idx/);

const providerLedger = lower("supabase/migrations/20261022133000_doodhwala_pay_event_ledger.sql");
assert.match(providerLedger, /create table if not exists public\.payment_provider_events/);
assert.match(providerLedger, /doodhwala_pay_guard_state_transition/);
assert.match(providerLedger, /payment_transactions_guard_state/);

const paymentAudit = lower("supabase/migrations/20261023150000_doodhwala_payment_audit_and_reference_guard.sql");
assert.match(paymentAudit, /create table if not exists public\.order_payment_events/);
assert.match(paymentAudit, /orders_direct_upi_reference_unique_idx/);
assert.match(paymentAudit, /payment_reference_already_used/);
assert.match(paymentAudit, /payment_audit_events_are_immutable/);
assert.match(paymentAudit, /bank settlement/i);

const actorIndex = lower("supabase/migrations/20261025217000_order_payment_events_actor_index.sql");
assert.match(actorIndex, /order_payment_events_actor_user_idx/);

const searchPath = lower("supabase/migrations/20261025218000_staging_definer_search_path_hardening.sql");
assert.match(searchPath, /alter function %s set search_path = %l/);
assert.match(searchPath, /security_definer_search_path_hardening_incomplete/);
assert.match(searchPath, /where p\.prosecdef/);

const consolidation = lower("supabase/migrations/20261025216000_staging_reconsolidate_security_select_policies.sql");
assert.match(consolidation, /delivery_tracking_select_own/);
assert.match(consolidation, /milk_subscriptions_owner_or_admin_select/);
assert.match(consolidation, /subscription_deliveries_owner_or_admin_select/);

const ledger = lower("docs/STAGING_MIGRATION_RECONCILIATION.md");
for (const filename of [
  "20261012084800_doodhwala_security_default_privileges.sql",
  "20261013130000_doodhwala_revoke_anon_table_writes.sql",
  "20261013150000_doodhwala_limit_anon_catalogue_columns.sql",
  "20261025214000_staging_least_privilege_role_guards.sql",
  "20261025215000_staging_protect_seller_private_fields.sql",
  "20261013170000_doodhwala_hide_provider_owner_uuid.sql",
  "20261013180000_doodhwala_secure_provider_profile_upsert.sql",
  "20261013190000_doodhwala_provider_rls_owner_helper.sql",
  "20261013200000_doodhwala_revoke_provider_direct_writes.sql",
  "20261025216000_staging_reconsolidate_security_select_policies.sql",
  "20261023120000_doodhwala_bounded_nearby_provider_search.sql",
  "20261023130000_doodhwala_order_capacity_query_indexes.sql",
  "20261022133000_doodhwala_pay_event_ledger.sql",
  "20261023150000_doodhwala_payment_audit_and_reference_guard.sql",
  "20261025217000_order_payment_events_actor_index.sql",
  "20261025218000_staging_definer_search_path_hardening.sql"
]) {
  assert.ok(ledger.includes(filename.toLowerCase()), "migration ledger is missing " + filename);
}
assert.match(ledger, /do not run `supabase db push`/);
assert.match(ledger, /public\.support_tickets/);
assert.match(ledger, /deferred/);

console.log("Staging least-privilege contracts passed: no anonymous DML grants, seller private columns stay hidden, bounded discovery remains public-safe, and payment audit/state guards are documented.");
