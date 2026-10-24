import assert from "node:assert/strict";
import fs from "node:fs";

const readJson = file => JSON.parse(fs.readFileSync(file, "utf8"));
const historyPath = "supabase/audit/production-migration-history-2026-10-24.json";
const history = readJson(historyPath);
const migrationDirectory = "supabase/migrations";
const localFiles = fs.readdirSync(migrationDirectory)
  .filter(name => /^\d{14}_.+\.sql$/i.test(name));
const localVersions = new Set(localFiles.map(name => name.slice(0, 14)));
const liveVersions = history.migrations.map(item => item.version);
const liveVersionSet = new Set(liveVersions);
const missingFromRepository = history.migrations.filter(item => !localVersions.has(item.version));
const repositoryOnly = localFiles.filter(name => !liveVersionSet.has(name.slice(0, 14)));
const presentInRepository = history.migrations.length - missingFromRepository.length;

assert.equal(history.snapshot_date, "2026-10-24");
assert.equal(history.project.ref, "hmiboyfcvtfawrwujslg");
assert.equal(history.migration_count, history.migrations.length);
assert.equal(history.migrations.length, 57);
assert.equal(history.first_migration, liveVersions[0]);
assert.equal(history.latest_migration, liveVersions.at(-1));
assert.equal(history.first_migration, "20261007090118");
assert.equal(history.latest_migration, "20261013164921");
assert.equal(new Set(liveVersions).size, liveVersions.length, "live migration versions must be unique");
assert.deepEqual(liveVersions, [...liveVersions].sort(), "live migration history must be ordered");
for (const item of history.migrations) {
  assert.match(item.version, /^\d{14}$/);
  assert.ok(item.name, "every live migration must have a name");
}
assert.match(history.note, /not a schema dump/i);
const baselineDocs = fs.readFileSync("docs/STAGING_BASELINE.md", "utf8");
assert.ok(baselineDocs.includes("production-migration-history-2026-10-24.json"));
assert.ok(baselineDocs.includes("test-production-migration-manifest.mjs"));

console.log("Doodhwala migration reconciliation baseline:");
console.log(JSON.stringify({
  project_ref: history.project.ref,
  snapshot_date: history.snapshot_date,
  production_migrations_observed: history.migration_count,
  exact_version_files_present_in_repository: presentInRepository,
  live_versions_without_exact_local_file: missingFromRepository.length,
  local_versioned_files_not_in_production_snapshot: repositoryOnly.length,
  latest_live_version_has_exact_local_file: localVersions.has(history.latest_migration),
  live_versions_missing: missingFromRepository.map(item => item.version + "_" + item.name),
  local_only_migrations: repositoryOnly.sort()
}, null, 2));
console.log("This is a static metadata comparison only. It does not connect to or modify production.");
