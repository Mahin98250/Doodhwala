import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");
const migration = read("supabase/migrations/20261027100000_doodhwala_account_deletion_request_intake.sql");
const html = read("account-deletion.html");
const css = read("account-deletion.css");
const client = read("account-deletion.js");
const legal = read("legal.html");
const customerPages = ["index.html", "auth.html", "checkout.html", "orders.html", "plans.html", "store.html", "product.html", "provider.html", "support.html"];

assert.match(migration, /create table if not exists private\.account_deletion_requests/i, "deletion requests must be stored in the private schema");
assert.match(migration, /enable row level security/i, "private request table must have RLS enabled");
assert.match(migration, /revoke all on private\.account_deletion_requests from public, anon, authenticated/i, "browser roles must not read or write deletion queue directly");
assert.match(migration, /auth\.uid\(\)/i, "request functions must derive identity from the authenticated session");
assert.match(migration, /p_confirmation is distinct from 'DELETE MY ACCOUNT'/i, "request creation must require explicit server-side confirmation");
assert.match(migration, /account_deletion_requests_one_active_per_user_idx/i, "database must constrain a user to one active deletion request");
assert.match(migration, /unique_violation/i, "concurrent/repeated requests must be handled without duplicate active requests");
assert.match(migration, /get_my_account_deletion_request/i, "users need a scoped request status endpoint");
assert.match(migration, /r\.user_id = v_uid/i, "user status/cancel operations must be scoped to auth.uid()");
assert.match(migration, /r\.status = 'pending'/i, "only pending requests may be cancelled");
assert.match(migration, /not coalesce\(private\.is_current_user_admin\(\), false\)/i, "admin request queue must fail closed if admin check is null");
assert.match(migration, /revoke all on function public\.admin_list_account_deletion_requests\(integer\) from public, anon/i, "admin queue RPC must not be anonymous");
assert.match(migration, /grant execute on function public\.admin_list_account_deletion_requests\(integer\) to authenticated/i, "authenticated calls must still be guarded by the RPC admin allowlist");
assert.match(migration, /pending request is not proof that account data has been deleted/i, "database docs must not imply request intake deletes data");

assert.match(html, /id="deletionRequestForm"/i, "public web deletion resource must have a request form");
assert.match(html, /id="deletionSignIn"/i, "signed-out users need an authentication path");
assert.match(html, /DELETE MY ACCOUNT/i, "page must explain its explicit confirmation phrase");
assert.match(html, /account and personal data are not erased when you submit this form/i, "page must clearly distinguish request intake from completed deletion");
assert.match(html, /Final deletion\/anonymisation is not enabled by this intake feature yet/i, "page must disclose unfinished final deletion processing");
assert.match(html, /supabase-client\.js/i, "page must use the shared configured Supabase client");
assert.match(css, /@media\s*\(max-width:\s*540px\)/i, "page needs a mobile layout");
assert.match(css, /prefers-reduced-motion/i, "page must respect reduced-motion settings");

assert.match(client, /rpc\("request_account_deletion"/i, "form must submit through the server RPC");
assert.match(client, /rpc\("get_my_account_deletion_request"/i, "status must come from the authenticated server RPC");
assert.match(client, /rpc\("cancel_account_deletion_request"/i, "pending requests must be cancellable through the server RPC");
assert.match(client, /request\.status === "pending"/i, "cancel action must only appear for pending status");
assert.match(client, /Your account and personal data are not yet deleted/i, "client must never claim the pending request deleted the account");
assert.doesNotMatch(client, /\.from\(["']account_deletion_requests/i, "client must not access the private request table directly");
assert.doesNotMatch(client, /innerHTML\s*=/i, "request IDs/status values must not be inserted as untrusted HTML");

assert.match(legal, /href="\/Doodhwala\/account-deletion\.html"/i, "legal data-rights section must link to the deletion resource");

const adminHtml = read("admin.html");
const adminJs = read("admin.js");
const adminCss = read("admin.css");
const triageMigration = read("supabase/migrations/20261027103000_doodhwala_account_deletion_admin_triage.sql");
const sw = read("sw.js");
assert.match(adminHtml, /data-section="privacy"/i, "owner navigation must expose privacy request triage");
assert.match(adminHtml, /admin\.js\?v=20261027\.1/i, "owner bundle must use its refreshed cache version");
assert.match(adminJs, /admin_list_account_deletion_requests/i, "owner UI must read requests through the guarded RPC");
assert.match(adminJs, /admin_update_account_deletion_request/i, "owner UI must save review status through the guarded RPC");
assert.match(adminJs, /triage does not delete an account/i, "owner UI must disclose triage does not perform deletion");
assert.match(triageMigration, /p_status not in \('under_review', 'blocked_open_orders'\)/i, "owner triage must not mark deletion completed or cancel on behalf of the user");
assert.match(triageMigration, /not coalesce\(private\.is_current_user_admin\(\), false\)/i, "owner triage must fail closed");
assert.match(adminCss, /privacy-admin-summary/i, "owner privacy queue needs responsive styling");
assert.match(sw, /const CACHE="doodhwala-v95"/i, "PWA cache must be bumped for owner privacy triage");
assert.match(sw, /admin\.js\?v=20261027\.1/i, "latest owner bundle must be precached");

for (const file of customerPages) {
  assert.match(read(file), /href="\/Doodhwala\/account-deletion\.html">Account deletion<\/a>/i, file + " must expose the account deletion resource");
}

console.log("Account-deletion request contracts passed: private queue, authenticated ownership, explicit confirmation, duplicate-safe intake, admin guard, honest pending status and public route.");
