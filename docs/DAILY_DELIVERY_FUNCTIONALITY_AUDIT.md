# Daily delivery functionality audit

**Reviewed:** 2026-10-27  
**Scope:** Customer recurring plans and the independent seller's daily order/route workflow.  
**Environment:** Source inspection only; no authenticated staging session, real order, payment, location trace or production data was used.

## What already exists

### Customer recurring plans
- `plans.html` and `plans.js` create a plan through `create_milk_subscription` and support editing, pausing, resuming, skipping one scheduled delivery and cancelling through their existing RPCs.
- The plan form previews selected weekdays and the first week's delivery count. Each saved plan also renders a rolling seven-day view based on the plan's date range, weekdays and any returned delivery records.
- Cutoff/ownership/business rules remain enforced by the backend RPCs; a frontend message is not proof that an operation was accepted.
- The UI is source-verified, but real authenticated plan creation, delivery-generation and cutoff behavior still require an approved staging environment.

### Seller orders and recurring route
- `provider.html` exposes separate Orders, Today's route and Subscriptions views, plus mobile navigation.
- `provider.js` uses `provider_update_order_status` for legal order-state transitions, asks for a reason when declining/cancelling, shows response deadlines, and refreshes the order queue with Realtime plus a fallback refresh.
- The route view uses `get_provider_delivery_route`; its dispatch board uses `get_provider_dispatch_board`. Recurring customer summaries use `provider_get_subscriptions`.
- The seller subscription list is informational; daily order-state changes happen through the associated order workflow. This PR deliberately does not create a second scheduler or introduce new database/RPC contracts.

## Usability gap addressed in this change

1. Decline/cancel reasons previously used the browser's `prompt()`, which interrupts the mobile flow and provides little inline guidance.
2. Order cards showed a status badge but no quick visual indication of completed/current/next stages.
3. Queue filters did not show counts, making it harder for sellers to see how much work needs action.

The branch replaces the decline/cancel prompt with an accessible in-app dialog and inline validation, adds an escaped status-progress indicator, adds filter counts, gives status errors plain-language handling, and makes the updated assets available through the existing service-worker cache.

## Boundaries and verification

- No new order or subscription state is invented in the UI; state changes continue through the existing server RPC.
- Customer-facing reasons and status labels must be escaped before rendering.
- Automated source/runtime contract checks are added to static CI. CI results are recorded in the PR as they complete.
- Authenticated browser flows, physical-device usability, Realtime behavior against a real staging project and the full customer-to-seller journey remain **not verified** until the project has approved isolated staging credentials and test accounts.
- A green syntax/contract workflow does not establish that production integration is ready.
