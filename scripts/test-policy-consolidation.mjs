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
console.log("RLS policy consolidation contracts passed: public catalogue boundaries and authenticated owner/admin access are preserved.");
