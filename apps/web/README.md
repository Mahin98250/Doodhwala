# Doodhwala web app

This directory contains the new Next.js App Router + React + TypeScript application. It remains isolated from the root-level HTML/CSS/JavaScript app so the current marketplace is not disrupted during migration.

## Requirements

- Node.js 20.9 or newer (CI uses Node 22)
- npm

## Local development

1. Copy `.env.example` to `.env.local`.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the existing project's URL and browser-safe publishable/anon key.
3. Run `npm ci` from this directory.
4. Run `npm run dev`.

Never set a Supabase secret or service-role key in any `NEXT_PUBLIC_*` variable. The browser client explicitly rejects the `sb_secret_*` format and legacy JWTs with the `service_role` claim.

## Verification

Run these commands before proposing or merging changes:

```sh
npm test
npm run typecheck
npm run build
npm run smoke
```

- `npm test` checks provider normalization, catalogue filtering/sorting, and browser-safe Supabase key classification.
- `npm run smoke` starts the production build locally and checks HTTP status/content for home, discovery, seller, product and not-found routes.
- GitHub Actions runs the same checks after an `npm ci` install.

## What works in this phase

- Responsive green-and-white customer home page with milk-category deep links.
- `/providers` reads the existing `find_nearby_providers_v2` RPC and supports search, milk-type filtering, price/rating/distance sorting and an opt-in location search.
- `/stores/[providerId]` and `/products/[productId]?provider=[providerId]` read the existing `get_provider_storefront` RPC.
- Typed data normalization prevents malformed public rows from being rendered as seller/product cards.
- Location is requested only by an explicit user action and is not persisted by these routes.
- Read-only catalogue routes do not create orders, modify provider data, maintain a cart, or process payments.
- Route loading, retryable errors, not-found handling, keyboard focus and reduced-motion support are included.

## Not migrated yet

Authentication, saved items, cart, checkout, order history, subscriptions, seller operations, owner/admin tools and support tickets remain on the existing app. Do not point the production domain to this app until route parity, authorization, payment integrity, accessibility, responsive journeys and rollback criteria in [the migration plan](../../docs/NEXTJS_MIGRATION_PLAN.md) are complete.

See the [legacy route and flow inventory](../../docs/LEGACY_ROUTE_FLOW_INVENTORY.md) for the RPC, page and payment behaviours that must be preserved.

## Data and security rules

- Only use public/publishable Supabase credentials in browser components.
- Public catalogue RPCs must continue to respect function grants and database RLS; do not make provider tables publicly writable.
- Treat browser-supplied location as untrusted input and never use it as proof of delivery eligibility.
- Prices, seller ownership, order totals, payment status and role permissions remain server/database-authoritative.
- Preserve existing auth, order isolation, subscription capacity, COD and direct-UPI invariants when those flows are migrated.
