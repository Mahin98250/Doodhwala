import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");
const schema = read("supabase/migrations/20261026170000_doodhwala_smart_delivery_routing.sql");
const operations = read("supabase/migrations/20261026180000_doodhwala_delivery_route_operations.sql");
const edge = read("supabase/functions/delivery-routing/index.ts");
const docs = read("docs/delivery/SMART_MILK_ROUTING.md");
const sw = read("sw.js");
const providerHtml = read("provider.html");
const ordersJs = read("orders.js");
const dispatchHtml = read("delivery-dispatch.html");
const dispatchJs = read("delivery-dispatch.js");
const driverHtml = read("delivery-driver.html");
const driverJs = read("delivery-driver.js");
const trackingHtml = read("track-delivery.html");
const trackingJs = read("track-delivery.js");
const sqlAssertions = read("scripts/sql-tests/delivery-routing-assertions.sql");
const staticWorkflow = read(".github/workflows/static-validation.yml");

for (const table of ["delivery_route_runs", "delivery_route_stops", "delivery_live_locations"]) {
  assert.match(schema, new RegExp("create table if not exists public\\." + table, "i"));
  assert.match(schema, new RegExp("alter table public\\." + table + " enable row level security", "i"));
  assert.match(schema, new RegExp("revoke all on public\\." + table + " from anon, authenticated", "i"));
}
assert.match(schema, /unique \(route_id, sequence_no\)/i);
assert.match(schema, /unique \(route_id, order_id\)/i);
assert.match(schema, /latest location fix, not a permanent GPS breadcrumb trail/i);
assert.match(schema, /driver_user_id = \(select auth\.uid\(\)\)/i);
assert.match(schema, /provider_owner_id = \(select auth\.uid\(\)\)/i);
assert.match(schema, /o\.customer_id = \(select auth\.uid\(\)\)/i);

for (const rpc of [
  "delivery_driver_enroll", "delivery_driver_is_enrolled", "delivery_provider_link_driver",
  "delivery_provider_unlink_driver", "delivery_get_route_planning_data", "delivery_create_route",
  "delivery_start_route", "delivery_update_location", "delivery_stop_location_sharing",
  "delivery_mark_route_stop_action", "delivery_get_my_active_route", "delivery_get_my_tracking",
  "delivery_get_active_route_eta", "delivery_update_remaining_etas"
]) {
  assert.match(operations, new RegExp("function public\\." + rpc + "\\(", "i"), "missing RPC: " + rpc);
}
assert.match(operations, /realtime\.send/i);
assert.match(operations, /topic => 'delivery-route:'/i);
assert.match(operations, /event => 'location_stopped'/i);
assert.match(operations, /Delivery participants can receive private route broadcasts/i);
assert.match(operations, /for update of r/i, "route row must be locked before delivery stop rows");
assert.match(operations, /previous_route_stop_not_completed/i);
assert.match(operations, /fresh_driver_location_required/i);
assert.match(operations, /delete from public\.delivery_live_locations where route_id=v_stop\.route_id/i);
assert.match(operations, /grant execute on function public\.delivery_get_my_tracking\(uuid\) to authenticated/i);

assert.match(edge, /const MAX_STOPS = 99/);
assert.match(edge, /action === "plan_route"/);
assert.match(edge, /action === "refresh_eta"/);
assert.match(edge, /nearest-next-by-road-duration|nearest-neighbour/i);
assert.match(edge, /bounded 2-opt/i);
assert.match(edge, /DELIVERY_ROUTING_BASE_URL/i);
assert.match(edge, /\/table\/v1\/driving\//);
assert.match(edge, /\/route\/v1\/driving\//);
assert.match(edge, /delivery_update_remaining_etas/i);
assert.match(edge, /end-user JWT/i);

for (const [name, page] of [
  ["dispatch", dispatchHtml], ["driver", driverHtml], ["tracking", trackingHtml]
]) {
  assert.match(page, /\/Doodhwala\/pwa-register\.js/, name + " screen must register the service worker");
  assert.match(page, /leaflet/i, name + " screen must include map support");
}
assert.match(dispatchJs, /delivery_list_enrolled_drivers/);
assert.match(dispatchJs, /delivery_provider_link_driver/);
assert.match(dispatchJs, /functions\.invoke\("delivery-routing"/);
assert.match(dispatchJs, /action: "plan_route"/);
assert.match(dispatchJs, /ordered_stops/);
assert.match(driverJs, /navigator\.geolocation\.watchPosition/);
assert.match(driverJs, /delivery_start_route/);
assert.match(driverJs, /delivery_update_location/);
assert.match(driverJs, /action: "refresh_eta"/);
assert.match(driverJs, /delivery_mark_route_stop_action/);
assert.match(driverJs, /delivery_stop_location_sharing/);
assert.match(driverJs, /event: "eta_updated"/);
assert.match(trackingJs, /delivery_get_my_tracking/);
assert.match(trackingJs, /event: "location_stopped"/);
assert.match(trackingJs, /event: "eta_updated"/);
assert.match(trackingJs, /tracking\.location_stale/);
assert.match(providerHtml, /href="\/Doodhwala\/delivery-dispatch\.html"/);
assert.match(ordersJs, /track-delivery\.html\?order=/);

for (const asset of [
  "/Doodhwala/delivery-dispatch.html", "/Doodhwala/delivery-driver.html",
  "/Doodhwala/track-delivery.html", "/Doodhwala/delivery-dispatch.js?v=20261026.1",
  "/Doodhwala/delivery-driver.js?v=20261026.1", "/Doodhwala/track-delivery.js?v=20261026.1"
]) assert.ok(sw.includes(asset), "service worker must cache " + asset);
assert.match(sw, /const CACHE="doodhwala-v95"/);
assert.match(sqlAssertions, /cross_account_tracking_was_allowed/);
assert.match(sqlAssertions, /previous_route_stop_not_completed/);
assert.match(sqlAssertions, /location_broadcast_not_emitted/);
assert.match(staticWorkflow, /denoland\/setup-deno@v2/);
assert.match(staticWorkflow, /deno check --no-lock supabase\/functions\/delivery-routing\/index\.ts/);
assert.match(docs, /heuristic/);
assert.match(docs, /DELIVERY_ROUTING_BASE_URL/);
assert.match(docs, /No production migration, live GPS session, route provider billing or customer data was changed/i);

console.log("PASS: smart delivery route schema, trusted lifecycle RPCs, ETA refresh, live maps, private tracking, PWA caching and rollout safety contracts.");
