import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync(
  new URL("../supabase/migrations/20261025180000_delivery_tracking_owner_read_policy.sql", import.meta.url),
  "utf8",
);

assert.match(migration, /ALTER\s+TABLE\s+public\.delivery_tracking_events\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
assert.match(migration, /CREATE\s+POLICY\s+delivery_tracking_owner_read/i);
assert.match(migration, /ON\s+public\.delivery_tracking_events\s+FOR\s+SELECT\s+TO\s+authenticated/i);
assert.match(migration, /FROM\s+public\.orders\s+AS\s+o/i);
assert.match(migration, /o\.id\s*=\s*delivery_tracking_events\.order_id/i);
assert.match(migration, /o\.provider_id\s*=\s*delivery_tracking_events\.provider_id/i);
assert.match(migration, /o\.customer_id\s*=\s*\(SELECT\s+auth\.uid\(\)\)/i);
assert.match(migration, /o\.provider_owner_id\s*=\s*\(SELECT\s+auth\.uid\(\)\)/i);
assert.match(migration, /GRANT\s+SELECT\s+ON\s+TABLE\s+public\.delivery_tracking_events\s+TO\s+authenticated/i);
assert.match(
  migration,
  /REVOKE\s+INSERT\s*,\s*UPDATE\s*,\s*DELETE\s*,\s*TRUNCATE\s*,\s*REFERENCES\s*,\s*TRIGGER\s+ON\s+TABLE\s+public\.delivery_tracking_events\s+FROM\s+PUBLIC\s*,\s*anon\s*,\s*authenticated/i,
);
assert.equal((migration.match(/CREATE\s+POLICY/gi) ?? []).length, 1, "tracking migration should add only the reviewed owner-read policy");
assert.doesNotMatch(migration, /FOR\s+(?:INSERT|UPDATE|DELETE|ALL)\b/i, "browser roles must not gain tracking-event write policies");

console.log("Delivery tracking policy contract passed: owner-scoped SELECT only; browser writes remain revoked.");
