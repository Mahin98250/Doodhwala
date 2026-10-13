import assert from "node:assert/strict";
import fs from "node:fs";

const writeMigrationPath = "../supabase/migrations/20261013130000_doodhwala_revoke_anon_table_writes.sql";
const policyMigrationPath = "../supabase/migrations/20261013140000_doodhwala_split_anon_provider_read_policies.sql";
const writeSql = fs.readFileSync(new URL(writeMigrationPath, import.meta.url), "utf8").toLowerCase();
const policySql = fs.readFileSync(new URL(policyMigrationPath, import.meta.url), "utf8").toLowerCase();

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

console.log("Anonymous access hardening contracts passed: no direct anonymous writes and no anonymous calls to the admin authorization helper.");
