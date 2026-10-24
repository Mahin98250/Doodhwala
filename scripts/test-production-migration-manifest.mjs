import assert from "node:assert/strict";
import fs from "node:fs";

const readJson = file => JSON.parse(fs.readFileSync(file, "utf8"));
const historyPath = "supabase/audit/production-migration-history-2026-10-24.json";
const history = readJson(historyPath);
const migrationDirectory = "supabase/migrations";
const localFiles = fs.readdirSync(migrationDirectory)
  .filter(name => /^\d{14}_.+\.sql$/i.test(name))
  .map(file => ({ file, version: file.slice(0, 14), name: file.slice(15, -4) }));
const localVersions = new Set(localFiles.map(item => item.version));
const liveVersions = history.migrations.map(item => item.version);
const liveVersionSet = new Set(liveVersions);
const liveNames = new Set(history.migrations.map(item => item.name));
const localNames = new Map();
for (const file of localFiles) {
  const list = localNames.get(file.name) || [];
  list.push(file.file);
  localNames.set(file.name, list);
}

const missingExactVersion = history.migrations.filter(item => !localVersions.has(item.version));
const sameNameDifferentVersion = missingExactVersion
  .filter(item => localNames.has(item.name))
  .map(item => ({ production_version: item.version, name: item.name, local_files: localNames.get(item.name) }));
const noExactVersionOrName = missingExactVersion.filter(item => !localNames.has(item.name));
const repositoryOnlyVersionedFiles = localFiles.filter(item => !liveVersionSet.has(item.version));
const localFilesWithNoLiveName = repositoryOnlyVersionedFiles.filter(item => !liveNames.has(item.name));
const localFilesWithLiveNameButDifferentVersion = repositoryOnlyVersionedFiles.filter(item => liveNames.has(item.name));
const exactVersionMatches = history.migrations.length - missingExactVersion.length;

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
assert.ok(baselineDocs.includes("name-match"));

console.log("Doodhwala migration reconciliation baseline:");
console.log(JSON.stringify({
  project_ref: history.project.ref,
  snapshot_date: history.snapshot_date,
  production_migrations_observed: history.migration_count,
  exact_version_files_present_in_repository: exactVersionMatches,
  live_versions_without_exact_local_file: missingExactVersion.length,
  of_those_name_matched_with_different_version: sameNameDifferentVersion.length,
  live_versions_with_neither_exact_version_nor_exact_name_match: noExactVersionOrName.length,
  local_versioned_files_not_in_production_snapshot: repositoryOnlyVersionedFiles.length,
  local_files_with_names_absent_from_production_snapshot: localFilesWithNoLiveName.length,
  local_files_with_names_seen_in_production_but_different_versions: localFilesWithLiveNameButDifferentVersion.length,
  latest_live_version_has_exact_local_file: localVersions.has(history.latest_migration),
  same_name_different_version_details: sameNameDifferentVersion,
  live_versions_without_exact_version_or_name_match: noExactVersionOrName.map(item => item.version + "_" + item.name),
  local_files_with_no_live_name: localFilesWithNoLiveName.map(item => item.file).sort()
}, null, 2));
console.log("Name matches are only investigative hints. This static comparison neither proves schema drift nor connects to/changes production.");
