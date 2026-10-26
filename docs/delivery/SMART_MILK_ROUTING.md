# Smart milk delivery routing (Phase 1)

## Goal
Support early-morning milk rounds where one delivery person serves many homes in sequence. Customers see a private ETA for their own delivery; the assigned delivery person sees the full route.

## Included in this PR
- Additive database foundation for route runs, ordered stops, ETA windows and one latest GPS fix per active route.
- Indexes for driver/day queues, provider/day queues, ordered stops and pending ETAs.
- RLS read access: assigned driver/provider can view the route; a customer can view only their own stop and the active route's latest position.
- Direct client writes are revoked. Route planning, assignment, status transitions and GPS writes must be implemented behind trusted, authenticated backend functions. This intentionally fails closed rather than letting a browser spoof a driver or route.

## Arrival-time model
1. Generate the day's eligible orders from confirmed orders and active milk subscriptions, excluding paused/skipped/cancelled deliveries.
2. Group deliveries by provider, driver, service date and practical locality/cluster.
3. Build a road travel-time matrix; straight-line distance alone is not a reliable route metric.
4. Optimize stop order for total travel time/distance while honoring delivery windows, vehicle capacity and priority constraints.
5. Estimate each stop ETA from route start + road travel time + expected handover time per stop.
6. Publish an ETA range, not a falsely exact minute. Recompute remaining ETAs when GPS progress, delays, skipped stops or a new order changes the route.
7. Keep the active next stop stable; re-optimize only the unvisited suffix to avoid confusing the delivery person.

## Customer experience
- Before the route starts: show planned arrival window and stop number only when sequencing is confirmed.
- During the active round: show “Stop N”, current ETA window, last location update time and live driver marker.
- If location is stale/unavailable: show last update time and ETA window; never pretend GPS is live.
- After delivery: stop location sharing and remove the live marker. Keep delivery/status audit data, not a permanent GPS trail.

## Delivery-person experience
- Full route map, total remaining distance/time, next stop, numbered stops and a compact list of addresses / milk quantities.
- One-tap arrived, delivered, skipped with reason, and customer contact actions.
- GPS sharing starts only for an assigned active route and stops when it ends.
- Handle no GPS, low battery, offline periods, duplicate taps, wrong address, customer unavailable and route reassignment.

## Technical choices / cost controls
- MapLibre GL JS is open source; tile hosting is a separate cost/terms decision. Do not treat public OpenStreetMap tile servers as unlimited free production infrastructure.
- Google OR-Tools can optimize routes with time windows, but road travel-time/distance matrices still need a routing source. Start with small, bounded routes and measure.
- Use authenticated private Supabase Broadcast channels for high-frequency location updates; avoid broad Postgres Changes subscriptions for every GPS fix.
- GPS update target initially 5–10 seconds while actively moving, subject to battery/network tests. Do not collect location before route start or after completion.
- Scale with one current-position row per route, bounded stop queries, indexed RLS, and no per-customer polling loop. Load test realtime fan-out on isolated staging.

## Required before production
- Trusted route create/assign/reorder endpoint with provider/driver ownership checks.
- Atomic stop transitions and GPS endpoint with active-assignment validation, rate limiting, timestamp validation and stale-fix rejection.
- Customer ETA endpoint exposing only the customer's stop and route status.
- Map UI in customer order tracking and driver route console.
- Push/SMS/WhatsApp notifications only after provider, cost and consent decisions.
- Test two customers on one route, cross-account isolation, stale GPS, route changes, missed deliveries, subscription skips, offline driver and concurrent status taps.
- Apply only to isolated staging first. Production migration and live data are explicitly out of scope for this PR.
