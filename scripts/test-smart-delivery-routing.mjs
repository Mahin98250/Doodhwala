import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync(new URL("../supabase/migrations/20261026170000_doodhwala_smart_delivery_routing.sql", import.meta.url), "utf8");
const docs = fs.readFileSync(new URL("../docs/delivery/SMART_MILK_ROUTING.md", import.meta.url), "utf8");

for (const table of ["delivery_route_runs", "delivery_route_stops", "delivery_live_locations"]) {
  assert.match(migration, new RegExp("create table if not exists public\\." + table, "i"));
  assert.match(migration, new RegExp("alter table public\\." + table + " enable row level security", "i"));
  assert.match(migration, new RegExp("revoke all on public\\." + table + " from anon, authenticated", "i"));
}
assert.match(migration, /unique \(route_id, sequence_no\)/i);
assert.match(migration, /unique \(route_id, order_id\)/i);
assert.match(migration, /o\.customer_id = \(select auth\.uid\(\)\)/i);
assert.match(migration, /driver_user_id = \(select auth\.uid\(\)\)/i);
assert.match(migration, /provider_owner_id = \(select auth\.uid\(\)\)/i);
assert.match(migration, /latest location fix, not a permanent GPS breadcrumb trail/i);
assert.match(docs, /road travel-time matrix/i);
assert.match(docs, /private Supabase Broadcast channels/i);
assert.match(docs, /Production migration and live data are explicitly out of scope/i);
console.log("PASS: smart delivery route schema, scoped reads, revoked client writes and rollout safety contracts.");
