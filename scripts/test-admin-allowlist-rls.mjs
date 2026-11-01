import assert from "node:assert/strict";
import fs from "node:fs";

const path = "../supabase/migrations/20261013090000_doodhwala_lock_admin_allowlist_rls.sql";
const sql = fs.readFileSync(new URL(path, import.meta.url), "utf8").toLowerCase();
const confirmedEmailGuard = fs.readFileSync(
  new URL("../supabase/migrations/20261029110337_doodhwala_admin_allowlist_confirmed_email.sql", import.meta.url),
  "utf8",
).toLowerCase();
assert.match(sql, /alter\s+table\s+private\.admin_allowlist\s+enable\s+row\s+level\s+security\s*;/,
  "private admin allowlist must have RLS enabled");
assert.ok(!/create\s+policy\s+\w+\s+on\s+private\.admin_allowlist/i.test(sql),
  "do not create direct client policies for the private admin allowlist");

assert.match(confirmedEmailGuard, /join\s+auth\.users\s+as\s+u\s+on\s+u\.id\s*=\s*auth\.uid\(\)/i,
  "admin authorization must be anchored to the currently authenticated Auth user");
assert.match(confirmedEmailGuard, /u\.email_confirmed_at\s+is\s+not\s+null/i,
  "unconfirmed email identities must never receive admin privileges");
assert.match(confirmedEmailGuard, /lower\(u\.email\)\s*=\s*lower\(coalesce\(auth\.jwt\(\)->>'email'/i,
  "the signed JWT email must match the Auth user's current email");
assert.match(confirmedEmailGuard, /set\s+search_path\s*=\s*''/i,
  "the SECURITY DEFINER helper must pin an empty search_path");
assert.match(confirmedEmailGuard, /revoke\s+all\s+on\s+function\s+private\.is_current_user_admin\(\)\s+from\s+public,\s*anon/i,
  "the private admin helper must not be executable by anonymous/public roles");
console.log("Admin allowlist contracts passed: private RLS, confirmed matching Auth identity, empty search_path, no anonymous execute.");
