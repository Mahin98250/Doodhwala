import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL("../" + file, import.meta.url), "utf8");
const seed = read("supabase/deferred/20261028120000_prepare_inactive_seller_plans.sql");
const guard = read("supabase/deferred/20261028110000_provider_invoice_plan_conflict.sql");
const assertions = read("scripts/sql-tests/manual-invoice-plan-conflict-assertions.sql");
const pilot = read("docs/MANUAL_CONFIRMATION_PILOT.md");
const model = read("docs/DIRECT_SELLER_AND_MONTHLY_SUBSCRIPTION_MODEL.md");

assert.match(seed, /DISPOSABLE STAGING TEST ONLY\. NOT AN AUTOMATIC MIGRATION/i);
assert.match(seed, /'Normal listing',\s*200000::bigint/i);
assert.match(seed, /'Recommended and in-app advertising',\s*350000::bigint/i);
assert.match(seed, /admin_upsert_provider_billing_plan\(\s*null,\s*v_plan\.name,\s*v_plan\.amount_paise,\s*v_plan\.description,\s*false\s*\)/i,
  "fixture preparation must create inactive plans through the existing admin RPC");
assert.match(seed, /p\.is_active\s*=\s*false/i);
assert.match(seed, /current_setting\('doodhwala\.disposable_pilot_fixture',\s*true\)\s+is distinct from\s+'yes'/i);
assert.match(seed, /not coalesce\(private\.is_current_user_admin\(\),\s*false\)/i);
assert.match(seed, /seller_plan_catalog_conflict_review_required/i);
assert.doesNotMatch(seed, /\b(?:insert\s+into|update|delete\s+from)\s+public\.provider_subscription_(?:invoices|payments)\b/i,
  "the fixture plan preparation must not write financial records");

assert.match(guard, /DEFERRED FOLLOW-UP, NOT AN AUTOMATIC MIGRATION/i);
assert.match(guard, /provider_invoice_function_drift_review_required/i);
assert.match(guard, /provider_invoice_month_constraint_review_required/i);
assert.equal((guard.match(/v_existing\.plan_id is distinct from p_plan_id/g) || []).length, 2,
  "both the fast retry and concurrent unique-constraint paths must reject a different plan");
assert.equal((guard.match(/raise exception 'provider_month_invoice_plan_conflict'/g) || []).length, 2);
assert.match(assertions, /premium_to_normal_was_silently_accepted/);
assert.match(assertions, /normal_to_premium_was_silently_accepted/);
assert.match(assertions, /same_plan_retry_created_another_invoice/);

for (const text of [pilot, model]) {
  assert.match(text, /₹2,000/);
  assert.match(text, /₹3,500/);
  assert.match(text, /in-app advertising/i);
  assert.match(text, /sponsored/i);
}
assert.match(pilot, /Recommended by Doodhwala · Sponsored/);
assert.match(pilot, /View milk, prices and delivery details/);
assert.match(pilot, /Neither plan, the tag, nor any advertising campaign is live/i);
console.log("Seller plan draft contracts passed. This is not billing, promotion, staging, or payment approval.");
