import assert from "node:assert/strict";
import fs from "node:fs";

const writeMigrationPath = "../supabase/migrations/20261013130000_doodhwala_revoke_anon_table_writes.sql";
const policyMigrationPath = "../supabase/migrations/20261013140000_doodhwala_split_anon_provider_read_policies.sql";
const writeSql = fs.readFileSync(new URL(writeMigrationPath, import.meta.url), "utf8").toLowerCase();
const policySql = fs.readFileSync(new URL(policyMigrationPath, import.meta.url), "utf8").toLowerCase();
const catalogueMigrationPath = "../supabase/migrations/20261013150000_doodhwala_limit_anon_catalogue_columns.sql";
const catalogueSql = fs.readFileSync(new URL(catalogueMigrationPath, import.meta.url), "utf8").toLowerCase();

assert.match(
  writeSql,
  /revoke\s+insert\s*,\s*update\s*,\s*delete\s+on\s+all\s+tables\s+in\s+schema\s+public\s+from\s+anon\s*;/,
  "anonymous users must not have direct write privileges on existing public tables"
);
assert.match(
  writeSql,
  /alter\s+default\s+privileges\s+for\s+role\s+postgres\s+in\s+schema\s+public\s+revoke\s+insert\s*,\s*update\s*,\s*delete\s+on\s+tables\s+from\s+anon\s*;/,
  "future public tables must not grant anonymous write privileges by default"
);
assert.doesNotMatch(writeSql, /revoke\s+select/i, "public catalogue reads must remain available");
assert.doesNotMatch(writeSql, /from\s+public\s*,\s*anon/i, "this migration must not remove grants needed by public reads or authenticated flows");

for (const [table, anonStart, authStart] of [
  ["provider_profiles", "create policy provider_profiles_select_anon", "create policy provider_profiles_select_authenticated"],
  ["provider_verifications", "create policy provider_verifications_select_anon", "create policy provider_verifications_select_authenticated"]
]) {
  assert.ok(policySql.includes("drop policy if exists " + table.replace("provider_profiles", "provider_profiles_select_public_or_owner").replace("provider_verifications", "provider_verifications_select_public_or_owner")),
    table + " must replace the previously shared anon/authenticated policy");
  const section = policySql.split(anonStart)[1]?.split(authStart)[0];
  assert.ok(section, table + " must have a separate anonymous SELECT policy");
  assert.ok(section.includes("private.is_approved_provider"), table + " public reads must remain limited to approved providers");
  assert.ok(!section.includes("private.is_current_user_admin"), table + " anonymous policy must not call the admin-only helper");
}
assert.ok(policySql.includes("create policy provider_profiles_select_authenticated"), "authenticated provider visibility policy must be preserved");
assert.ok(policySql.includes("create policy provider_verifications_select_authenticated"), "authenticated verification visibility policy must be preserved");
assert.ok(policySql.includes("private.is_current_user_admin()"), "admin-only visibility must remain in the authenticated policy");

assert.match(
  catalogueSql,
  /revoke\\s+select\\s+on\\s+all\\s+tables\\s+in\\s+schema\\s+public\\s+from\\s+anon\\s*;/,
  "anonymous users must not have table-level SELECT grants on application data"
);
assert.match(
  catalogueSql,
  /alter\\s+default\\s+privileges\\s+for\\s+role\\s+postgres\\s+in\\s+schema\\s+public\\s+revoke\\s+select\\s+on\\s+tables\\s+from\\s+anon\\s*;/,
  "future public tables must not grant anonymous SELECT by default"
);
for (const table of ["provider_profiles", "provider_service_areas", "provider_verifications", "milk_products"]) {
  assert.match(
    catalogueSql,
    new RegExp("grant\\\\s+select\\\\s*\\\\([\\\\s\\\\S]*?\\\\)\\\\s+on\\\\s+public\\\\." + table + "\\\\s+to\\\\s+anon\\\\s*;"),
    table + " must grant only the columns needed for public catalogue RPCs"
  );
}
const profileGrant = catalogueSql.match(/grant\\s+select\\s*\\(([^)]*)\\)\\s*on\\s+public\\.provider_profiles\\s+to\\s+anon/);
assert.ok(profileGrant, "provider profile column grant must be present");
for (const privateColumn of ["owner_name", "phone", "owner_user_id"]) {
  assert.ok(!profileGrant[1].includes(privateColumn), "anonymous users must not receive seller " + privateColumn);
}
const anonPolicies = [
  catalogueSql.split("create policy provider_profiles_select_anon")[1]?.split("drop policy if exists provider_verifications_select_anon")[0],
  catalogueSql.split("create policy provider_verifications_select_anon")[1]?.split("drop policy if exists service_area_select_anon")[0],
  catalogueSql.split("create policy service_area_select_anon")[1]?.split("drop policy if exists milk_products_select_anon")[0],
  catalogueSql.split("create policy milk_products_select_anon")[1]
];
for (const section of anonPolicies) {
  assert.ok(section, "each anonymous catalogue policy must be present");
  assert.ok(!section.includes("private.is_current_user_admin"), "anonymous catalogue policies must never call admin authorization");
  assert.ok(!section.includes("owner_user_id"), "anonymous catalogue policies must not depend on private owner identity");
}

console.log("Anonymous access hardening contracts passed: no direct anonymous writes and no anonymous calls to the admin authorization helper.");
