import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync("supabase/migrations/20261026160000_doodhwala_atomic_provider_capacity.sql", "utf8");
const original = fs.readFileSync("supabase/migrations/20261007094209_doodhwala_reliability_and_provider_capacity.sql", "utf8");
const workflow = fs.readFileSync(".github/workflows/static-validation.yml", "utf8");
const fnStart = migration.indexOf("create or replace function private.create_order_secure");
const fnEnd = migration.indexOf("$$;", fnStart + 5) + 3;
assert.ok(fnStart >= 0 && fnEnd > fnStart, "migration must replace the secure order function");
const fn = migration.slice(fnStart, fnEnd);

// Keep the existing server-authoritative order path and security boundary.
assert.match(fn, /security definer/i);
assert.match(fn, /set search_path\s*=\s*public, private, pg_temp/i);
assert.match(fn, /auth\.uid\(\)/);
assert.match(fn, /address_not_owned/);
assert.match(fn, /provider_order_capacity_full/);
assert.match(fn, /provider_daily_capacity_full/);
assert.match(fn, /p_idempotency_key text default null/i, "migration must preserve the idempotent five-argument checkout");
assert.ok(migration.includes("revoke all on function private.create_order_secure(uuid,uuid,jsonb,text) from public,anon,authenticated,service_role;"), "legacy four-argument function must remain restricted");
assert.ok(migration.includes("grant execute on function private.create_order_secure(uuid,uuid,jsonb,text,text) to authenticated;"), "authenticated users must use the idempotent checkout");
assert.ok(!migration.includes("grant execute on function private.create_order_secure(uuid,uuid,jsonb,text) to authenticated"), "do not restore access to the legacy four-argument function");

// The provider row lock must be acquired while reading its active/approved status,
// before the open-order and daily-volume checks; concurrent checkouts serialize per seller.
const providerRead = fn.indexOf("from public.provider_profiles pp");
const providerLock = fn.indexOf("for update of pp", providerRead);
const openCount = fn.indexOf("select count(*)", providerLock);
const dailyCount = fn.indexOf("select coalesce(sum(oi.quantity),0)", openCount);
assert.ok(providerRead >= 0 && providerLock > providerRead, "provider row must be locked");
assert.ok(openCount > providerLock && dailyCount > openCount, "lock must precede both capacity checks");
assert.match(fn, /where o\.provider_id=p_provider_id\s+and o\.status in \('placed','accepted','preparing','ready','out_for_delivery'\)/i);

// Daily capacity is computed in the same Kolkata-local date domain as the expression index,
// not by relying on the database session's current_date timezone.
assert.match(fn, /\(o\.created_at at time zone 'Asia\/Kolkata'\)::date\s*=\s*\(now\(\) at time zone 'Asia\/Kolkata'\)::date/i);
assert.match(original, /create or replace function private\.create_order_secure/);
assert.ok(workflow.includes("scripts/test-atomic-provider-capacity.mjs"));

console.log("PASS: provider checkout capacity is serialized per seller and daily litres use Kolkata-local date.");
