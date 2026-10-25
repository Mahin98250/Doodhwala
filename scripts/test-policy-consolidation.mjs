import assert from "node:assert/strict";
import fs from "node:fs";

const migrationPath = "supabase/migrations/20261012090500_doodhwala_consolidate_admin_select_policies.sql";
const sql = fs.readFileSync(new URL("../" + migrationPath, import.meta.url), "utf8").toLowerCase();

for (const table of ["profiles", "milk_products", "provider_service_areas"]) {
  assert.ok(sql.includes("drop policy if exists admin_realtime_select on public." + table),
    table + " must remove the duplicate standalone admin policy");
}
assert.ok(sql.includes("create policy profiles_select_own"), "profiles needs one combined owner/admin SELECT policy");
assert.ok(sql.includes("or (select private.is_current_user_admin())"), "authenticated admins must retain authorized visibility");
assert.ok(sql.includes("create policy milk_products_select_anon") && sql.includes("create policy milk_products_select_authenticated"),
  "milk products need separate anon and authenticated policies");
assert.ok(sql.includes("create policy service_area_select_anon") && sql.includes("create policy service_area_select_authenticated"),
  "service areas need separate anon and authenticated policies");

const anonSections = [
  sql.split("create policy milk_products_select_anon")[1]?.split("create policy milk_products_select_authenticated")[0],
  sql.split("create policy service_area_select_anon")[1]?.split("create policy service_area_select_authenticated")[0]
];
for (const section of anonSections) {
  assert.ok(section, "each anonymous public-read policy definition must exist");
  assert.ok(!section.includes("private.is_current_user_admin"), "anonymous access must not call the admin-only helper");
  assert.ok(section.includes("private.is_approved_provider"), "public read must continue to require approved providers");
}
assert.ok(sql.includes("milk_products.stock") && sql.includes("milk_products.is_active"),
  "public product visibility must continue respecting availability and active status");
assert.ok(sql.includes("pp.is_active"), "public product visibility must continue respecting provider active status");
assert.ok(sql.includes("drop policy if exists profiles_select_own on public.profiles"),
  "profiles policy must be recreated with the same owner boundary");

const followupPath = "supabase/migrations/20261025200000_doodhwala_consolidate_admin_select_policies_followup.sql";
const followup = fs.readFileSync(new URL("../" + followupPath, import.meta.url), "utf8").toLowerCase();
for (const table of ["orders", "milk_subscriptions", "provider_profiles", "provider_verifications", "subscription_deliveries"]) {
  assert.ok(followup.includes("drop policy if exists admin_realtime_select on public." + table),
    table + " must remove the duplicate standalone admin SELECT policy");
}
for (const policy of [
  "orders_customer_or_provider_select",
  "milk_subscriptions_owner_or_admin_select",
  "provider_profiles_select_anon",
  "provider_profiles_select_authenticated",
  "provider_verifications_select_anon",
  "provider_verifications_select_authenticated",
  "subscription_deliveries_owner_or_admin_select"
]) {
  assert.ok(followup.includes("create policy " + policy), "missing consolidated policy: " + policy);
}
assert.ok(followup.includes("or (select private.is_current_user_admin())"),
  "authenticated owners/customer policies must preserve allowlisted-admin access");
assert.ok(followup.includes("provider_owner_id = (select auth.uid())"),
  "orders must remain restricted to the assigned seller owner");
assert.ok(followup.includes("ms.customer_id = (select auth.uid())"),
  "subscription deliveries must remain customer-scoped");
const anonProviderPolicies = [
  followup.split("create policy provider_profiles_select_anon")[1]?.split("create policy provider_profiles_select_authenticated")[0],
  followup.split("create policy provider_verifications_select_anon")[1]?.split("create policy provider_verifications_select_authenticated")[0]
];
for (const policy of anonProviderPolicies) {
  assert.ok(policy, "separate anonymous public-read policy must exist");
  assert.ok(!policy.includes("private.is_current_user_admin"), "anonymous policies must never invoke the admin helper");
}

console.log("RLS policy consolidation contracts passed: public catalogue boundaries and authenticated owner/admin access are preserved.");
