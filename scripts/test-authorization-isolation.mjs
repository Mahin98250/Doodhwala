import assert from "node:assert/strict";
import fs from "node:fs";

function sql(path) {
  return fs.readFileSync(new URL("../" + path, import.meta.url), "utf8").toLowerCase();
}

function policy(source, name, file) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const expression = new RegExp(
    "\\bcreate\\s+policy\\s+(?:\"" + escaped + "\"|" + escaped + ")\\s+[\\s\\S]*?;",
    "i"
  );
  const match = source.match(expression);
  assert.ok(match, file + " must define RLS policy " + name);
  return match[0].toLowerCase();
}

function normalizeSql(value) {
  return value.toLowerCase().replace(/\s+/g, " ").replace(/\s*=\s*/g, "=").trim();
}

function includesAll(source, fragments, label) {
  const normalizedSource = normalizeSql(source);
  for (const fragment of fragments) {
    assert.ok(normalizedSource.includes(normalizeSql(fragment)), label + " must include " + fragment);
  }
}

const marketplacePath = "supabase/migrations/20261007_doodhwala_marketplace.sql";
const subscriptionsPath = "supabase/migrations/20261007092303_doodhwala_recurring_milk_engine.sql";
const orderEventsPath = "supabase/migrations/20261007092600_doodhwala_order_state_machine.sql";
const ratingPath = "supabase/migrations/20261008161200_order_ratings_rls_performance_hardening.sql";
const adminPolicyPath = "supabase/migrations/20261012090500_doodhwala_consolidate_admin_select_policies.sql";
const leastPrivilegePath = "supabase/migrations/20261012084616_doodhwala_security_least_privilege.sql";
const secureRpcPath = "supabase/migrations/20261007183000_doodhwala_secure_rpc_wrappers.sql";
const providerLifecyclePath = "supabase/migrations/20261008030000_provider_order_lifecycle_hardening.sql";
const providerDashboardPath = "supabase/migrations/20261008024500_provider_phase2_operations.sql";
const anonWritePath = "supabase/migrations/20261013130000_doodhwala_revoke_anon_table_writes.sql";
const anonPolicyPath = "supabase/migrations/20261013140000_doodhwala_split_anon_provider_read_policies.sql";
const anonCataloguePath = "supabase/migrations/20261013150000_doodhwala_limit_anon_catalogue_columns.sql";
const sellerFieldsPath = "supabase/migrations/20261013160000_doodhwala_protect_seller_private_fields.sql";

const marketplace = sql(marketplacePath);
const subscriptions = sql(subscriptionsPath);
const events = sql(orderEventsPath);
const ratings = sql(ratingPath);
const adminPolicies = sql(adminPolicyPath);
const leastPrivilege = sql(leastPrivilegePath);
const secureRpc = sql(secureRpcPath);
const providerLifecycle = sql(providerLifecyclePath);
const providerDashboard = sql(providerDashboardPath);
const anonWrite = sql(anonWritePath);
const anonPolicies = sql(anonPolicyPath);
const anonCatalogue = sql(anonCataloguePath);
const sellerFields = sql(sellerFieldsPath);
const appJs = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8").toLowerCase();

// Customer profiles: a user may read/update their own profile only.
// The sole additional SELECT route is the current-user admin allowlist helper.
const profileSelect = policy(adminPolicies, "profiles_select_own", adminPolicyPath);
includesAll(profileSelect, ["auth.uid()", "= id", "private.is_current_user_admin()"], "profile SELECT policy");
const profileInsert = policy(marketplace, "profiles_insert_own", marketplacePath);
includesAll(profileInsert, ["with check", "auth.uid()", "= id"], "profile INSERT policy");
const profileUpdate = policy(marketplace, "profiles_update_own", marketplacePath);
includesAll(profileUpdate, ["using", "with check", "auth.uid()", "= id"], "profile UPDATE policy");
includesAll(leastPrivilege, ["private.protect_profile_account_type()", "profiles_protect_account_type", "account_type_managed_by_admin"],
  "profile role-escalation guard");

// Addresses: each operation must be scoped to the signed-in owner, and UPDATE
// must enforce ownership both before and after changing the row.
for (const [name, command, required] of [
  ["addresses_own_select", "select", ["for select", "auth.uid()", "= user_id"]],
  ["addresses_own_insert", "insert", ["for insert", "with check", "auth.uid()", "= user_id"]],
  ["addresses_own_update", "update", ["for update", "using", "with check", "auth.uid()", "= user_id"]],
  ["addresses_own_delete", "delete", ["for delete", "using", "auth.uid()", "= user_id"]]
]) {
  const p = policy(marketplace, name, marketplacePath);
  includesAll(p, required, name);
}

// Orders: customers and the assigned seller can read an order; only the owning
// seller may update through the direct-table policy. Customer actions go via
// authenticated, ownership-checking RPCs instead of direct table writes.
const orderSelect = policy(marketplace, "orders_customer_or_provider_select", marketplacePath);
includesAll(orderSelect, ["customer_id", "auth.uid()", "provider_owner_id", "or"], "orders SELECT policy");
const orderUpdate = policy(marketplace, "orders_provider_update", marketplacePath);
includesAll(orderUpdate, ["for update", "using", "with check", "provider_owner_id", "auth.uid()"], "orders UPDATE policy");
includesAll(marketplace, [
  "grant select on public.orders to authenticated",
  "grant select on public.order_items to authenticated",
  "create policy \"order_items_customer_or_provider_select\"",
  "o.customer_id = (select auth.uid()) or o.provider_owner_id = (select auth.uid())",
  "grant execute on function public.create_order(uuid, uuid, jsonb, text) to authenticated"
], "order ownership and protected write path");
const orderItemSelect = policy(marketplace, "order_items_customer_or_provider_select", marketplacePath);
includesAll(orderItemSelect, ["exists", "public.orders o", "order_items.order_id", "o.customer_id", "o.provider_owner_id", "auth.uid()"], "order-item SELECT policy");
assert.doesNotMatch(marketplace, /grant\s+(?:select\s*,\s*)?insert[^;]*\border_items\b/i,
  "order items must not receive direct INSERT privileges for browser roles");
assert.doesNotMatch(marketplace, /grant\s+(?:select\s*,\s*)?insert[^;]*\borders\b/i,
  "orders must not receive direct INSERT privileges for browser roles");

// Order status history follows the parent order's customer/provider visibility.
const statusHistory = policy(events, "Customers and providers can view order status events", orderEventsPath);
includesAll(statusHistory, ["for select", "exists", "public.orders o", "o.id=order_status_events.order_id",
  "o.customer_id=(select auth.uid())", "o.provider_owner_id=(select auth.uid())"], "order status history policy");

// Recurring plans and their delivery schedule are visible to the customer who
// owns the plan or the seller who owns its provider. Direct table writes stay closed.
const customerPlan = policy(subscriptions, "Customers can view own milk subscriptions", subscriptionsPath);
includesAll(customerPlan, ["for select", "customer_id", "auth.uid()"], "customer subscription policy");
const providerPlan = policy(subscriptions, "Providers can view their milk subscriptions", subscriptionsPath);
includesAll(providerPlan, ["for select", "provider_profiles pp", "pp.id=milk_subscriptions.provider_id",
  "pp.owner_user_id=(select auth.uid())"], "provider subscription policy");
const customerDelivery = policy(subscriptions, "Customers can view own subscription deliveries", subscriptionsPath);
includesAll(customerDelivery, ["for select", "subscription_deliveries.subscription_id", "ms.customer_id=(select auth.uid())"],
  "customer subscription-delivery policy");
const providerDelivery = policy(subscriptions, "Providers can view subscription deliveries", subscriptionsPath);
includesAll(providerDelivery, ["for select", "public.milk_subscriptions ms", "public.provider_profiles pp",
  "pp.owner_user_id=(select auth.uid())"], "provider subscription-delivery policy");
includesAll(subscriptions, [
  "revoke all on table public.milk_subscriptions from anon,authenticated",
  "revoke all on table public.subscription_deliveries from anon,authenticated",
  "grant select on table public.milk_subscriptions to authenticated",
  "grant select on table public.subscription_deliveries to authenticated",
  "revoke execute on function public.materialize_due_subscription_deliveries() from public,anon,authenticated"
], "recurring-table and materializer grants");

// Ratings: only the customer who placed the order or the owner of the
// associated provider may read; writes must belong to the current customer.
const ratingSelect = policy(ratings, "order_ratings_select_visible_to_parties", ratingPath);
includesAll(ratingSelect, ["for select", "customer_id=(select auth.uid())",
  "public.provider_profiles pp", "pp.owner_user_id=(select auth.uid())"], "rating SELECT policy");
const ratingInsert = policy(ratings, "customer_order_ratings_insert_own", ratingPath);
includesAll(ratingInsert, ["for insert", "with check", "customer_id=(select auth.uid())"], "rating INSERT policy");
const ratingUpdate = policy(ratings, "customer_order_ratings_update_own", ratingPath);
includesAll(ratingUpdate, ["for update", "using", "with check", "customer_id=(select auth.uid())"], "rating UPDATE policy");

// Provider-facing operations: seller records remain tied to their owner, and
// the server-side order-status implementation re-checks ownership by user ID.
for (const name of ["provider_profiles_insert_own", "provider_profiles_update_own"]) {
  const p = policy(marketplace, name, marketplacePath);
  includesAll(p, ["provider_profiles", "auth.uid()", "owner_user_id"], name);
}
for (const name of ["service_area_insert_own", "service_area_update_own"]) {
  const p = policy(marketplace, name, marketplacePath);
  includesAll(p, ["provider_service_areas", "public.provider_profiles pp", "pp.owner_user_id", "auth.uid()"], name);
}
for (const name of ["milk_products_insert_own", "milk_products_update_own", "milk_products_delete_own"]) {
  const p = policy(marketplace, name, marketplacePath);
  includesAll(p, ["milk_products", "public.provider_profiles pp", "pp.owner_user_id", "auth.uid()"], name);
}
includesAll(providerLifecycle, ["where id=p_order_id and provider_owner_id=v_uid", "authentication_required",
  "order_not_found_or_not_provider"], "provider status mutation authorization");

// Seller-private profile fields are available through the authenticated dashboard RPC,
// whose implementation binds the row to auth.uid() and accepts no arbitrary owner ID.
includesAll(providerDashboard, [
  "create or replace function private.provider_get_dashboard_impl()",
  "v_uid uuid:=auth.uid()",
  "where owner_user_id=v_uid",
  "if not found then raise exception 'provider_not_found'",
  "'provider',to_jsonb(v_provider)",
  "create or replace function public.provider_get_dashboard()",
  "grant execute on function public.provider_get_dashboard() to authenticated"
], "owner-scoped seller dashboard RPC");
const dashboardSignature = providerDashboard.slice(providerDashboard.indexOf("create or replace function private.provider_get_dashboard_impl()"), providerDashboard.indexOf("returns jsonb", providerDashboard.indexOf("create or replace function private.provider_get_dashboard_impl()")));
assert.ok(dashboardSignature.includes("private.provider_get_dashboard_impl()") && !dashboardSignature.includes("p_owner"), "seller dashboard RPC must not accept a caller-supplied owner identity");

// Public RPC wrappers are invoker-security wrappers; the privileged implementations
// verify the admin allowlist or ownership before reading/mutating protected data.
includesAll(secureRpc, [
  "create or replace function public.admin_list_customers",
  "language sql security invoker",
  "if not private.is_current_user_admin() then raise exception 'owner_access_required'",
  "where id=p_order_id and provider_owner_id=v_uid",
  "where id=p_order_id and customer_id=v_uid",
  "grant execute on function public.admin_list_customers(integer) to authenticated"
], "protected RPC authorization");

// Guest role: no direct table writes, no broad table reads, and only vetted catalogue
// columns are readable. Anonymous policies must never invoke admin-only helpers.
includesAll(anonWrite, [
  "revoke insert, update, delete",
  "on all tables in schema public",
  "from anon",
  "revoke insert, update, delete on tables from anon"
], "anonymous write revocation");
includesAll(anonCatalogue, [
  "revoke select",
  "on all tables in schema public",
  "from anon",
  "alter default privileges for role postgres in schema public",
  "revoke select on tables from anon",
  "on public.provider_profiles",
  "on public.provider_service_areas",
  "on public.provider_verifications",
  "on public.milk_products"
], "anonymous catalogue-only grants");
for (const name of ["provider_profiles_select_anon", "provider_verifications_select_anon"]) {
  const p = policy(anonPolicies, name, anonPolicyPath);
  includesAll(p, ["for select", "to anon", "private.is_approved_provider"], name);
  assert.ok(!p.includes("private.is_current_user_admin"), name + " must not call admin authorization");
}
for (const name of ["provider_profiles_select_anon", "provider_verifications_select_anon",
  "service_area_select_anon", "milk_products_select_anon"]) {
  const p = policy(anonCatalogue, name, anonCataloguePath);
  assert.ok(!p.includes("private.is_current_user_admin"), name + " must not call admin authorization");
  assert.ok(!p.includes("owner_user_id"), name + " must not expose or depend on seller owner identity");
}


 // Seller contact details and moderation notes must not be readable through direct
// table queries by other authenticated marketplace users.
includesAll(sellerFields, [
  "revoke select on table public.provider_profiles from authenticated",
  "on table public.provider_profiles to authenticated",
  "revoke select on table public.provider_verifications from authenticated",
  "grant select (provider_id, status) on table public.provider_verifications to authenticated",
  "revoke execute on function public.find_nearby_providers(numeric, numeric, numeric)",
  "revoke execute on function private.find_nearby_providers_private(numeric, numeric, numeric)"
], "seller private-column hardening");
const normalizedSellerSql = normalizeSql(sellerFields);
const profileGrantEnd = normalizedSellerSql.indexOf(") on table public.provider_profiles to authenticated");
assert.ok(profileGrantEnd > 0, "seller profile grant must be explicit and column-scoped");
const profileGrantStart = normalizedSellerSql.lastIndexOf("grant select (", profileGrantEnd);
assert.ok(profileGrantStart >= 0, "seller profile grant must begin with a SELECT column list");
const profileColumns = normalizedSellerSql.slice(profileGrantStart + "grant select (".length, profileGrantEnd);
assert.ok(!profileColumns.includes("owner_name") && !profileColumns.includes("phone"), "seller owner name and phone must not be directly readable by all authenticated users");

const verificationGrant = "grant select (provider_id, status) on table public.provider_verifications to authenticated";
assert.ok(normalizedSellerSql.includes(verificationGrant), "verification access must be limited to provider_id and status");
const verificationGrantEnd = normalizedSellerSql.indexOf(") on table public.provider_verifications to authenticated");
const verificationGrantStart = normalizedSellerSql.lastIndexOf("grant select (", verificationGrantEnd);
const verificationColumns = normalizedSellerSql.slice(verificationGrantStart + "grant select (".length, verificationGrantEnd);
assert.ok(!verificationColumns.includes("notes") && !verificationColumns.includes("reviewed_at"), "moderator notes and review timestamps must not be directly readable by ordinary authenticated users");
assert.ok(appJs.includes('rpc("find_nearby_providers_v2"'), "current customer discovery must use the safe public catalogue RPC");
assert.ok(!appJs.includes('rpc("find_nearby_providers"') && !appJs.includes("rpc('find_nearby_providers'"), "customer UI must not call the legacy owner-name-returning RPC");

console.log("Authorization isolation contracts passed: profile/address ownership, customer/provider order access, recurring plans, delivery events, ratings, seller ownership, protected RPCs, and anonymous catalogue-only access.");
