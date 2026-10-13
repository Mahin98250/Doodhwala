import assert from "node:assert/strict";
import fs from "node:fs";

const path = "../supabase/migrations/20261013090000_doodhwala_lock_admin_allowlist_rls.sql";
const sql = fs.readFileSync(new URL(path, import.meta.url), "utf8").toLowerCase();
assert.match(sql, /alter\s+table\s+private\.admin_allowlist\s+enable\s+row\s+level\s+security\s*;/,
  "private admin allowlist must have RLS enabled");
assert.ok(!/create\s+policy\s+\w+\s+on\s+private\.admin_allowlist/i.test(sql),
  "do not create direct client policies for the private admin allowlist");
console.log("Admin allowlist RLS contract passed: private table protected without client-facing policies.");
