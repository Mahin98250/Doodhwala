import assert from "node:assert/strict";
import fs from "node:fs";

const file = "supabase/audit/production-schema-check-2026-10-24.json";
const snapshot = JSON.parse(fs.readFileSync(file, "utf8"));
const baseline = fs.readFileSync("docs/STAGING_BASELINE.md", "utf8");
const getFunction = (schema, name, args) =>
  snapshot.functions.find(f => f.schema === schema && f.name === name && f.arguments === args);
const getIndex = (name) => snapshot.indexes.find(i => i.name === name);

assert.equal(snapshot.snapshot_date, "2026-10-24");
assert.equal(snapshot.project.ref, "hmiboyfcvtfawrwujslg");
assert.match(snapshot.important_note, /not a pg_dump/i);
assert.equal(snapshot.tables.orders, true);
assert.equal(snapshot.tables.provider_profiles, true);
assert.equal(snapshot.tables.payment_transactions, false);
assert.equal(snapshot.tables.order_payment_events, false);

assert.equal(
  getFunction("public", "find_nearby_providers_v2", "p_latitude numeric, p_longitude numeric, p_max_km numeric")?.present,
  true,
  "production inventory currently reports nearby-provider v2 present"
);
assert.equal(
  getFunction("private", "create_order_secure", "p_provider_id uuid, p_address_id uuid, p_items jsonb, p_customer_note text, p_idempotency_key text")?.present,
  true,
  "production inventory currently reports idempotent order-creation overload present"
);

assert.equal(getIndex("provider_service_areas_lat_lng_idx")?.present, true);
assert.equal(getIndex("milk_products_active_idx")?.present, true);
assert.equal(getIndex("orders_customer_idempotency_key_uidx")?.present, true);
assert.equal(getIndex("orders_provider_open_capacity_idx")?.present, false);
assert.equal(getIndex("orders_provider_daily_litres_idx")?.present, false);
assert.ok(baseline.includes("production-schema-check-2026-10-24.json"));
assert.ok(baseline.toLowerCase().includes("migration-history/schema mismatch"));

console.log("Focused production schema snapshot (read-only, 2026-10-24):");
console.log(JSON.stringify({
  project_ref: snapshot.project.ref,
  nearby_provider_v2_present: getFunction("public", "find_nearby_providers_v2", "p_latitude numeric, p_longitude numeric, p_max_km numeric").present,
  idempotent_order_rpc_present: getFunction("private", "create_order_secure", "p_provider_id uuid, p_address_id uuid, p_items jsonb, p_customer_note text, p_idempotency_key text").present,
  capacity_indexes_present: [
    getIndex("orders_provider_open_capacity_idx").present,
    getIndex("orders_provider_daily_litres_idx").present
  ],
  payment_tables_present: {
    payment_transactions: snapshot.tables.payment_transactions,
    order_payment_events: snapshot.tables.order_payment_events
  }
}, null, 2));
console.log("Static manifest test only: no live database calls or writes are performed.");
