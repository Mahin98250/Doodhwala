# Doodhwala web app (migration foundation)

This directory contains the new Next.js App Router + React + TypeScript application. It remains isolated from the root-level HTML/CSS/JavaScript app so the current marketplace is not disrupted during migration.

## Requirements

- Node.js 20.9 or newer (CI currently uses Node 22)
- npm

## Local development

1. Copy .env.example to .env.local.
2. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY using the existing project URL and public publishable/anon key.
3. From this directory, run npm install and npm run dev.
4. Run npm run typecheck and npm run build before proposing changes.

## What works in this phase

- The home page links into /providers.
- /providers reads the existing find_nearby_providers_v2 Supabase RPC using the public browser client.
- Provider/product rows are normalized into typed, bounded view models before rendering.
- Search, milk-type filtering and sorting run locally on the loaded catalogue.
- Precise browser location is requested only after a user action, used for that RPC request, and not stored by this page.
- The discovery route is read-only; it does not create orders, modify provider data, or process payments.

## Not migrated yet

Authentication, saved items, cart, checkout, order history, seller operations, owner/admin tools and subscriptions remain on the current app. Do not point the production domain to this app until route parity, security and release criteria in the migration plan are complete.

## Data and security rules

- Only use public/publishable Supabase credentials in NEXT_PUBLIC variables. Never use a secret/service-role key in browser code.
- Public discovery must continue to respect function grants and database RLS; do not make provider tables publicly writable.
- Treat the browser's location as untrusted input and do not use it as proof of delivery eligibility. The database RPC remains responsible for availability calculations.
- Prices, seller ownership, order totals, payment status and role permissions must remain server/database-authoritative.
- Preserve existing authentication, order isolation, COD and direct-UPI invariants when those flows are migrated.
