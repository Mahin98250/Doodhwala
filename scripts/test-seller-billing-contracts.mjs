import fs from "node:fs";
import assert from "node:assert/strict";

const migrationPath="supabase/migrations/20261023190000_seller_subscription_billing.sql";
assert.ok(fs.existsSync(migrationPath),"seller billing migration must exist");
const sql=fs.readFileSync(migrationPath,"utf8");
for(const contract of [
 "public.seller_subscription_plans","public.seller_subscriptions","public.seller_subscription_payments",
 "public.seller_subscription_audit","alter table public.seller_subscription_payments enable row level security",
 "revoke all on public.seller_subscription_plans, public.seller_subscriptions",
 "public.seller_get_subscription_billing()","public.seller_request_subscription(p_plan_id uuid, p_payment_method text)",
 "public.admin_list_seller_subscription_billing","public.admin_upsert_seller_subscription_plan",
 "public.admin_record_offline_seller_subscription_payment","public.admin_list_seller_subscription_audit",
 "public.is_current_user_admin()","auth.uid()","offline_collection_confirmed",
 "'basic','Basic',200000","'featured','Featured',300000",
 "Online checkout is not configured yet","Only verified offline collections can be recorded here"
]) assert.ok(sql.includes(contract),"migration missing contract: "+contract);
assert.ok(!/grant\s+(?:all|select|insert|update|delete)\s+on\s+public\.seller_subscription_(?:payments|audit)\s+to\s+anon/i.test(sql),"private seller billing records must not be granted to anon");
assert.ok(sql.includes("p_amount_paise is distinct from v_pay.amount_paise"),"admin must reconcile the exact expected amount");
assert.ok(sql.includes("collected_by=auth.uid()"),"offline collector must be auditable");

const providerHtml=fs.readFileSync("provider.html","utf8");
const providerJs=fs.readFileSync("provider.js","utf8");
const providerCss=fs.readFileSync("provider.css","utf8");
const adminHtml=fs.readFileSync("admin.html","utf8");
const adminJs=fs.readFileSync("admin.js","utf8");
const sw=fs.readFileSync("sw.js","utf8");
assert.ok(providerHtml.includes('id="view-billing"')&&providerHtml.includes('data-view="billing"'),"seller dashboard must expose billing view");
assert.ok(providerJs.includes('seller_get_subscription_billing')&&providerJs.includes('seller_request_subscription'),"seller UI must use server-owned billing RPCs");
assert.ok(providerJs.includes("Online checkout is not configured")||providerHtml.includes("Online checkout will appear once"),"seller UI must not pretend online payment is live");
assert.ok(providerJs.includes('data-request-billing')&&providerJs.includes('offline_cash'),"seller must be able to request offline collection");
assert.ok(providerCss.includes("seller-billing-plans")&&providerCss.includes("repeat(8,minmax(0,1fr))"),"billing cards and all eight mobile destinations must be styled");
assert.ok(adminHtml.includes('data-section="seller-billing"'),"owner navigation must include separate seller billing section");
assert.ok(adminJs.includes('admin_list_seller_subscription_billing')&&adminJs.includes('admin_record_offline_seller_subscription_payment')&&adminJs.includes('admin_upsert_seller_subscription_plan'),"owner UI must support payment review, offline collection and plan updates");
assert.ok(sw.includes('const CACHE="doodhwala-v85"')&&sw.includes("provider.js?v=20261023.3")&&sw.includes("provider.css?v=20261023.3")&&sw.includes("admin.js?v=20261023.1"),"PWA must precache the seller billing UI assets");
console.log("Seller subscription billing contracts passed.");
