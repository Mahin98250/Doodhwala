import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");
const sql = read("scripts/staging-schema-audit.sql");
const docs = read("docs/STAGING_BASELINE.md");
const readme = read("README.md");

assert.match(sql, /current_database\(\)/i);
assert.match(sql, /supabase_migrations\.schema_migrations/i);
assert.match(sql, /pg_stat_user_tables/i);
assert.match(sql, /pg_stat_user_indexes/i);
assert.match(sql, /pg_indexes/i);
assert.match(sql, /relrowsecurity/i);
assert.doesNotMatch(sql, /^\s*(insert|update|delete|truncate|alter|drop|create|grant|revoke|refresh|vacuum|analyze)\b/gim, "staging audit SQL must remain read-only");
assert.match(docs, /STAGING_PROJECT_REF/i);
assert.match(docs, /must not equal the production project ref/i);
assert.match(docs, /Do not accept a nonzero project\/compute charge without explicit approval/i);
assert.match(docs, /No capacity claim/i);
assert.match(docs, /reached its limit of two active free projects/i);
assert.match(docs, /Phase 1 remains \\*\\*blocked for full staging acceptance\\*\\*/i);
assert.match(docs, /Do not delete, pause, or repurpose either existing project/i);
assert.match(readme, /docs\/STAGING_BASELINE\.md/);
assert.match(readme, /scripts\/staging-schema-audit\.sql/);

console.log("Staging baseline contracts passed: read-only diagnostics, isolated staging secrets, cost approval and honest capacity claims.");
