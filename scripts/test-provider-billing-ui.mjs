import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const providerHtml = read("../provider.html");
const providerBilling = read("../provider-billing.js");
const providerJs = read("../provider.js");
const providerCss = read("../provider.css");
const adminHtml = read("../admin.html");
const adminJs = read("../admin.js");
const adminCss = read("../admin.css");
const worker = read("../sw.js");
const adminSettingsMigration = read("../supabase/migrations/20261026123000_doodhwala_admin_get_provider_billing_settings.sql");

assert.match(providerHtml, /id="view-billing"/, "seller billing view must exist");
assert.match(providerHtml, /data-view="billing"/, "seller billing must be reachable from navigation");
assert.match(providerHtml, /provider-billing\.js\?v=20261026\.1/, "seller billing script should be cache-busted");
assert.match(providerJs, /if\(view==="billing"\)window\.loadProviderBilling/, "opening the billing view must trigger its data load");
assert.match(providerBilling, /rpc\("provider_get_my_billing"\)/, "seller billing must use the provider-scoped RPC");
assert.doesNotMatch(providerBilling, /from\(["']provider_subscription_invoices["']\)\.(insert|update|upsert)/, "seller browser must not mutate invoice rows");
assert.doesNotMatch(providerBilling, /status\s*[:=]\s*["']paid["']/, "seller browser must not mark invoices paid");
assert.match(providerBilling, /upi:\/\/pay\?/, "invoice can launch a direct UPI intent when configured");
assert.match(providerBilling, /does not confirm payment/i, "UPI app launch must not be presented as payment proof");
assert.match(providerCss, /provider-billing-summary/, "seller billing layout styles must be present");
assert.match(providerCss, /provider-mobile-nav\{display:flex/, "mobile navigation must remain horizontally usable");

assert.match(adminHtml, /data-section="seller-billing"/, "owner navigation must contain seller billing");
assert.match(adminJs, /async function loadProviderBillingSection\(/, "owner billing section must exist");
assert.match(adminJs, /admin_get_provider_billing_settings/, "owner UI must retrieve configured receiving instructions");
assert.match(adminJs, /admin_create_provider_subscription_invoice/, "owner UI must create monthly invoices");
assert.match(adminJs, /admin_record_provider_subscription_payment/, "owner UI must reconcile payments");
assert.match(adminJs, /personally checked Doodhwala.*receiving bank/i, "owner must explicitly verify incoming transfer before recording payment");
assert.match(adminCss, /seller-billing-admin-grid/, "owner billing layout styles must be present");
assert.match(worker, /provider-billing\.js\?v=20261026\.1/, "service worker must cache the new seller billing module");
assert.match(worker, /admin\.js\?v=20261026\.1/, "service worker must cache updated owner UI");
assert.match(adminSettingsMigration, /private\.is_current_user_admin\(\)/, "owner settings endpoint must enforce the admin allowlist");
assert.match(adminSettingsMigration, /revoke all on function public\.admin_get_provider_billing_settings\(\) from public, anon, authenticated/i, "settings reader should start with no browser grants before controlled grant");
console.log("Provider billing UI contracts passed: provider-scoped read-only seller portal, owner-only invoice controls, manual reconciliation and PWA asset versioning.");
