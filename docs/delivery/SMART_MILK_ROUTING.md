# Smart milk delivery routing

## Outcome
Doodhwala supports a planned implementation for early-morning rounds with many homes per driver. The provider dispatch screen selects eligible orders and an opted-in driver; the routing Edge Function orders the stops using road travel durations and returns numbered stops with ETA windows. The driver screen starts the route and shares GPS. Each customer sees only their own stop number, ETA window, destination and the assigned driver's recent location.

## Implemented in this draft PR
- **Database**: route runs, sequence-numbered stops, ETA windows and one latest GPS fix per route; supporting indexes and RLS.
- **Driver consent and assignment**: the driver explicitly enables delivery mode. A provider owner can link only an enrolled driver. Direct browser writes to route/location tables are revoked.
- **Trusted RPC contracts**: create/start route, GPS update, arrive/deliver/skip a stop, query driver route, private customer tracking, stop GPS sharing and refresh remaining ETAs.
- **Route planning UI**: select one linked driver, delivery date/start time and up to 99 eligible orders with saved coordinates; view road path, stop numbers, distance, estimated duration and arrival windows.
- **Driver UI**: numbered sequence, full address/quantity details, call action, start route, arrived/delivered/skip actions and active-route GPS sharing.
- **Customer UI**: track link from order history; the tracking screen shows only the customer's own destination and route position/status/ETA.
- **Realtime**: private authenticated Broadcast channel for location and ETA refresh; location is cleared when sharing stops or the route completes.
- **Tests**: isolated PostgreSQL fixture applies both migrations and tests enrollment, assignment, planning, route lifecycle, GPS broadcast, sequential stops and customer-account isolation. Static checks cover the new screens and Edge Function.

The UI and backend are authored on this draft PR; they are **not production-active** until the PR is reviewed, the migration and Edge Function are tested/deployed in staging, and the rollout gates below are satisfied.

## Planning flow
1. A provider owner reviews eligible ready / out_for_delivery orders. Orders must have delivery latitude/longitude. The provider base coordinates are read from the saved service area.
2. A provider selects a driver who opted in and is linked to that provider.
3. The Edge Function calls delivery_get_route_planning_data as the authenticated user, sends the selected coordinates to the configured road-routing endpoint, and gets a road-duration/distance matrix.
4. It seeds the ordering with nearest-next-by-road-duration and improves it with a bounded 2-opt pass. It then requests the road geometry and saves the sequence and ETA windows.
5. The driver starts the planned route. Orders still in ready move to out_for_delivery; the server refuses to start if any order is no longer eligible.
6. The driver marks each stop arrived then delivered, or skips it with a reason. A later stop cannot be completed while an earlier stop is still pending or arrived.
7. GPS updates are accepted only for the signed-in assigned driver on an active route. While sharing is active, remaining ETAs refresh about once per minute from the latest driver position and road-duration matrix. Private Broadcast tells the driver/customer screens to reload the updated ETA.
8. The last GPS row is deleted on explicit stop-sharing, page-hide sharing shutdown, or route completion.

## Accuracy and honest ETA display
- The current optimizer is a **heuristic**, not a proof of the globally shortest possible route. It minimizes supplied road-duration estimates better than straight-line sorting, but may miss a better sequence.
- The current routing endpoint does not include live traffic predictions unless the configured routing service supplies them. Doorstep handover, traffic, road closures, inaccurate pins and GPS error affect arrival times.
- ETAs are windows, not exact guarantees. Initial windows use a ±7-minute range around estimated stop arrival; active-route refresh uses a ±5-minute range based on current GPS and road duration.
- If a location fix is older than two minutes or absent, the customer screen must show a stale/waiting state and no fake live marker. The customer tracking RPC returns a location only for a fresh active-route fix.
- The provider's base location and every chosen order must have real, validated coordinates before route creation. PIN/locality-only addresses need geocoding first.

## Routing, map tiles and cost
- The Edge Function requires DELIVERY_ROUTING_BASE_URL pointing at an HTTPS OSRM-compatible routing service that supports /table/v1/driving and /route/v1/driving. This is configured separately from Supabase.
- Do not point a production dispatch workload at the public OSRM demo server; provision a suitable hosted or self-hosted endpoint and respect its rate limits/terms. No paid route provider or billing has been configured by this PR.
- Leaflet renders the current map UI. The included OpenStreetMap standard tile URL is a development/default tile source only, not a service-level guarantee for production traffic. Select a tile provider that fits expected request volume and usage policy before rollout.
- A route is limited to **99 delivery stops** per run. Split larger rounds across multiple drivers/routes.
- GPS is requested only after the driver explicitly starts/resumes sharing on an active route. Target cadence is about 5 seconds, subject to device/browser/network and battery conditions. Mobile browsers may pause geolocation in the background; keep the route screen visible during the run.
- One latest position per route is stored; no continuous breadcrumb history is retained. Data access is limited to the linked driver/provider and customers whose own orders belong to that route.

## Required environment
Set the Supabase Edge Function secrets for the target staging environment:
- SUPABASE_URL
- SUPABASE_PUBLISHABLE_KEYS (JSON array/object of allowed publishable keys), or the compatible SUPABASE_ANON_KEY fallback
- DELIVERY_ROUTING_BASE_URL (HTTPS OSRM-compatible endpoint)
- Optional comma-separated DELIVERY_ALLOWED_ORIGINS for additional trusted app origins

The Edge Function uses the end-user JWT for RPC calls so provider/driver ownership checks run as the authenticated user. Do not pass a service-role key to the browser.

## Staging rollout gates
1. Review the route SQL/Edge Function changes and run the committed PostgreSQL fixture and static/type checks.
2. Apply the migrations only to a **separate staging database** and deploy the Edge Function with staging secrets.
3. Verify driver opt-in, provider linking, two different customers on one route, the exact numbered sequence, ETA refresh after movement, offline/stale GPS, stop-sharing, route completion and cross-account isolation.
4. Test denied cases: unlinked driver, provider trying to read another provider's route, customer trying to track another order, fake GPS writes, duplicate stop actions, skipped earlier stops, stale location, route already assigned and route geometry too large.
5. Load test privately authorized Realtime fan-out and bounded routing requests with synthetic locations/orders. Do not load test the production Supabase project.
6. Choose production road-routing and map-tile hosting, costs/limits, consent copy, notification channel and data-retention policy before production rollout.

No production migration, live GPS session, route provider billing or customer data was changed by this PR.
