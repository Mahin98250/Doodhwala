import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");
const profile = read("profile/index.html");
const editor = read("profile/details/index.html");
const styles = read("doodhwala-ui-system.css");
const migrations = fs.readdirSync(new URL("../supabase/migrations/", import.meta.url));
const completionMigration = read("supabase/migrations/20261011151730_fix_customer_profile_phone_regex.sql");
const completionBase = read("supabase/migrations/20261008031000_customer_oauth_profile_completion.sql");

// Profile entry must point to a real dedicated editor, not route users back to auth.
assert.match(profile, /href=["']\/Doodhwala\/profile\/details\/["'][^>]*>[\s\S]*?Personal details|Personal details[\s\S]*?href=["']\/Doodhwala\/profile\/details\/["']/i,
  "Personal details must open the dedicated editor route");
assert.match(editor, /<form[^>]+id=["']personalDetailsForm["']/i, "Editor must expose a real personal details form");
for (const id of ["fullName", "phone", "addressLine", "areaName", "city", "pinCode", "saveProfile", "formMessage"]) {
  assert.ok(new RegExp(`id=[\"']${id}[\"']`).test(editor), "Editor is missing required control: " + id);
}
assert.match(editor, /auth\.getSession\(\)/, "Editor must require an authenticated session");
assert.match(editor, /\.from\(["']profiles["']\)[\s\S]*?\.eq\(["']id["'],\s*user\.id\)/,
  "Profile read must be scoped to the authenticated user's id");
assert.match(editor, /\.from\(["']addresses["']\)[\s\S]*?\.eq\(["']user_id["'],\s*user\.id\)[\s\S]*?\.eq\(["']is_default["'],\s*true\)/,
  "Default address read must be scoped to the authenticated user");
assert.match(editor, /\.rpc\(["']complete_current_customer_profile["']/,
  "Saving must use the existing authenticated profile RPC");
assert.doesNotMatch(editor, /\.from\(["']profiles["']\)\s*\.upsert|\.from\(["']profiles["']\)\s*\.update/,
  "Editor must not bypass the existing profile RPC with direct profile writes");
assert.match(completionMigration, /grant execute on function private\.complete_current_customer_profile_impl[\s\S]*?to authenticated/i,
  "Existing profile completion implementation must remain restricted to authenticated users");
assert.match(completionBase, /revoke execute on function public\.complete_current_customer_profile[\s\S]*?from public,anon/i,
  "Profile RPC must remain unavailable to anonymous/public callers");
assert.match(editor, /textContent\s*=|\.value\s*=/, "User-controlled values should be assigned as text/input values, not HTML markup");
assert.match(editor, /p_full_name|p_phone/, "Editor must send validated profile fields to the RPC");
assert.match(editor, /p_address_line|p_area_name|p_city|p_pin_code/, "Editor must handle optional complete default-address fields");
assert.match(editor, /pwa-register\.js/, "Editor must register the existing PWA service worker");
assert.match(editor, /resilience\.js/, "Editor must load the existing network resilience bootstrap");
assert.ok(migrations.includes("20261011151730_fix_customer_profile_phone_regex.sql"),
  "Editor must rely on the known PostgreSQL-safe phone validation migration");

console.log("Personal details contracts passed: dedicated route, authenticated session, owner-scoped reads, existing protected RPC, validation feedback, and PWA/resilience bootstraps.");
