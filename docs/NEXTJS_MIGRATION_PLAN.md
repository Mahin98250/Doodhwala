# Doodhwala framework migration: production plan

## Decision

Adopt **Next.js App Router + React + TypeScript** for the new web application. Keep the existing HTML/CSS/JavaScript marketplace running while the new app is built in apps/web. This is an incremental strangler migration, not a destructive rewrite.

HTML, CSS and JavaScript are production-capable technologies. The reason to introduce a framework is to improve component reuse, route structure, type safety, testability and long-term change velocity—not because the existing languages are inherently unsuitable.

## Why Next.js for this marketplace

- Public seller/store and product pages can use server rendering and metadata for discoverability.
- Customer, seller and owner experiences can share tested React components while using route-level layouts and loading/error states.
- TypeScript helps catch mismatches across products, sellers, carts and order states before runtime.
- The app can deploy on a Next.js-capable host; Supabase remains the data platform.

A React + Vite SPA would also be valid, but would need a separate strategy for server-rendered public pages. Hosting and pricing must be reviewed before launch; free tiers are appropriate for an MVP, not a promise of unlimited production capacity.

## Migration guardrails

1. Do not delete or replace the current root HTML app during the first phases.
2. Do not change Supabase schema, RLS policies, production data, credentials, payment settlement or checkout behaviour as part of UI migration.
3. Never expose Supabase service-role credentials in browser code. Use the publishable/anon key only with correct RLS; privileged operations stay server-side.
4. Treat prices, seller ownership, delivery coverage, order totals, payment status and role permissions as server/database-authoritative.
5. Preserve existing direct-UPI and COD rules until the current flows and security invariants are documented and tested.
6. Keep the existing app deployable until the replacement passes functional parity, security checks, accessibility checks and mobile journey tests.
7. Do not run two public production apps indefinitely; use a staged preview and a planned cutover with rollback.

See [the legacy route and flow inventory](./LEGACY_ROUTE_FLOW_INVENTORY.md) for the entry-point-to-route matrix, observed Supabase RPC/table usage and critical migration invariants.

## Proposed route map

- / — customer discovery/home
- /providers — nearby provider discovery and filters
- /stores/[providerId] — initial public seller storefront keyed by the existing provider UUID; a stable public slug is a later improvement
- /products/[productId]?provider=[providerId] — initial product details using its seller context; public slugs and canonical SEO metadata are deferred
- /cart and /checkout — cart and checkout
- /orders and /orders/[id] — customer order history/details
- /auth/sign-in and /auth/sign-up — authentication
- /seller and /seller/* — seller console, protected by server-side role checks
- /owner and /owner/* — owner/admin console, protected by server-side role checks
- /support, /legal, /offline — support and policy routes

Route names are proposed and must be reconciled with existing links before cutover.

## Phases and exit criteria

### Phase 0 — inventory and safety baseline

- Inventory every HTML entry point, script, Supabase call, route, role check, checkout/payment path and CI contract.
- Record current behaviour with smoke tests and capture the existing release/deploy mechanism.
- Exit: route/flow matrix and known-risk list reviewed; no production routes removed.

### Phase 1 — framework foundation

- Establish the isolated Next.js app, design shell, metadata, typed configuration and CI build/type-check.
- Add preview deployment without changing the existing production domain.
- Exit: deterministic install, type-check, build and preview smoke test pass.

### Phase 2 — read-only public discovery (in progress)

- Home page routes customers into /providers.
- /providers calls the existing find_nearby_providers_v2 RPC with the public Supabase client and normalizes its response to typed public view models.
- /stores/[providerId] and /products/[productId]?provider=[providerId] call the existing get_provider_storefront RPC; they are read-only public views and do not add items to a cart or place orders.
- Search, milk-type filters and sort modes are client-side on the fetched catalogue. Home-page milk categories deep-link into the matching filter.
- Location lookup is user-initiated, not persisted by the new page, and never treated as proof of delivery eligibility.
- Repeatable normalizer unit tests are wired into CI. Next: verify the RPC grant/RLS contract against a configured preview and add route-level smoke tests.
- Exit: live data, empty/error/loading states, mobile layouts and public metadata are verified in a configured preview.

### Phase 3 — identity and account journeys

- Migrate auth/session handling and customer navigation without weakening existing policies.
- Exit: sign-in/out, session expiry, deep links and unauthorized access tests pass.

### Phase 4 — cart and checkout

- Migrate cart, COD and direct-UPI checkout with idempotency, server-side price recalculation and verified order state transitions.
- Exit: duplicate submission, tampered price, unauthorized order access and failed payment scenarios are tested.

### Phase 5 — seller and owner consoles

- Migrate provider operations, orders, admin analytics and owner-only actions with server-side role checks and audit trails.
- Exit: customer/seller/owner isolation and RLS tests pass.

### Phase 6 — release and cutover

- Run staging journeys, accessibility and responsive checks, security review, load tests and rollback rehearsal.
- Switch traffic only after sign-off; keep the previous deployment available for rollback.

## Current implementation boundary

The new app includes the framework foundation and initial **read-only live discovery, seller storefront and product detail routes**. The legacy root HTML/CSS/JS app remains the current marketplace and retains its existing cart, checkout, authentication, seller and owner flows. The new routes are not a replacement for production and do not create orders, maintain carts or process payments. No production Supabase schema, RLS policy, data, payment configuration or deployment has been changed by this work.
