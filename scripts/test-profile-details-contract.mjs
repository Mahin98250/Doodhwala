import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");
const profile = read("profile/index.html");
const profilePage = read("profile/index.html");
assert.ok(profilePage.includes("client.auth.onAuthStateChange("), "Profile account card must react to sign-in/sign-out changes");
assert.ok(profilePage.includes("client.auth.getUser()"), "Profile must verify the current authenticated user");
assert.ok(profilePage.includes('action.href=detailsHref'), "Signed-in account action must open personal details, not send users back to sign-in");
assert.ok(profilePage.includes('action.href=signInHref'), "Signed-out account action must open sign-in");
assert.ok(profilePage.includes("authRevision===revisionAtStart"), "Profile must not overwrite a newer auth event with a stale initial request");

const editor = read("profile/details/index.html");
const runtime = read("profile-details.js");
const nav = read("customer-nav.js");
const migrations = fs.readdirSync(new URL("../supabase/migrations/", import.meta.url));
const completionMigration = read("supabase/migrations/20261011151730_fix_customer_profile_phone_regex.sql");
const completionBase = read("supabase/migrations/20261008031000_customer_oauth_profile_completion.sql");

// Profile entry must point to a real dedicated editor, not route users back to auth.
assert.match(profile, /href=["']\/Doodhwala\/profile\/details\/["'][^>]*>[\s\S]*?Personal details/i,
  "Personal details must open the dedicated editor route");
assert.match(editor, /<form[^>]+id=["']personalDetailsForm["']/i, "Editor must expose a real personal details form");
assert.match(editor, /profile-details\.js\?v=20261029\.1/, "Editor must load the separately syntax-checked runtime");
for (const id of ["fullName", "phone", "addressLine", "areaName", "city", "pinCode", "saveProfile", "formMessage"]) {
  assert.ok(editor.includes('id="' + id + '"'), "Editor is missing required control: " + id);
}
assert.ok(nav.includes('pathname.startsWith("/doodhwala/profile/")||pathname==="/doodhwala/profile"'), "Nested Profile routes must keep Profile selected in bottom navigation");
assert.match(runtime, /auth\.getSession\(\)/, "Editor must require an authenticated session");
assert.ok(runtime.includes("auth.onAuthStateChange("), "Editor must respond to cross-tab and same-tab authentication changes");
assert.ok(runtime.includes("latestAuthTransition.userId!==(currentUser?.id||null)"), "Editor must reject a stale session snapshot when authentication changes during loading");
assert.ok(runtime.includes("latestUser.id!==currentUser.id"), "Save must verify the active account immediately before the profile RPC");
assert.ok(runtime.includes("redirectingToSignIn"), "Auth changes must lock editing and clear stale form values before redirecting");
assert.match(runtime, /\.from\(["']profiles["']\)[\s\S]*?\.eq\(["']id["'],\s*currentUser\.id\)/,
  "Profile read must be scoped to the authenticated user's id");
assert.match(runtime, /\.from\(["']addresses["']\)[\s\S]*?\.eq\(["']user_id["'],\s*currentUser\.id\)[\s\S]*?\.eq\(["']is_default["'],\s*true\)/,
  "Default address read must be scoped to the authenticated user");
assert.match(runtime, /\.rpc\(["']complete_current_customer_profile["']/,
  "Saving must use the existing authenticated profile RPC");
assert.doesNotMatch(runtime, /\.from\(["']profiles["']\)\s*\.upsert|\.from\(["']profiles["']\)\s*\.update/,
  "Editor must not bypass the existing profile RPC with direct profile writes");
assert.match(completionMigration, /grant execute on function private\.complete_current_customer_profile_impl[\s\S]*?to authenticated/i,
  "Existing profile completion implementation must remain restricted to authenticated users");
assert.match(completionBase, /revoke execute on function public\.complete_current_customer_profile[\s\S]*?from public,anon/i,
  "Profile RPC must remain unavailable to anonymous/public callers");
assert.match(runtime, /textContent\s*=|\.value\s*=/, "User-controlled values should be assigned as text/input values, not HTML markup");
assert.match(runtime, /p_full_name|p_phone/, "Editor must send validated profile fields to the RPC");
assert.match(runtime, /p_address_line|p_area_name|p_city|p_pin_code/, "Editor must handle optional complete default-address fields");
assert.match(editor, /\.details-toggle-row input:focus-visible/, "Address edit checkbox must have visible keyboard focus");
assert.match(editor, /pwa-register\.js/, "Editor must register the existing PWA service worker");
assert.match(editor, /resilience\.js/, "Editor must load the existing network resilience bootstrap");
assert.ok(migrations.includes("20261011151730_fix_customer_profile_phone_regex.sql"),
  "Editor must rely on the known PostgreSQL-safe phone validation migration");
const worker = read("sw.js");
assert.match(worker, /doodhwala-v110/, "Service worker cache revision must advance for the new editor");
assert.match(worker, /profile\/details\/index\.html/, "Service worker must precache the editor route");
assert.match(worker, /profile-details\.js\?v=20261029\.1/, "Service worker must precache the editor runtime");

console.log("Personal details contracts passed: dedicated route, authenticated session, owner-scoped reads, protected RPC, validation feedback, and PWA/resilience bootstraps.");
