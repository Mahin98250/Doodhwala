# Doodhwala web app (migration foundation)

This directory contains the new Next.js App Router + React + TypeScript foundation. It is intentionally isolated from the existing root-level HTML/CSS/JavaScript application so the current marketplace is not disrupted during migration.

## Requirements

- Node.js 20.9 or newer (CI currently uses Node 22)
- npm

## Local development

From this directory:

```sh
npm install
npm run dev
```

Open the local URL printed by Next.js. Before proposing changes, run:

```sh
npm run typecheck
npm run build
```

## Current scope

The home page is a design and framework shell only. It does not yet read live provider data or implement accounts, saved items, cart, checkout, seller tools or owner/admin tools. Do not point the production domain to this app until route-by-route migration and release criteria in [the migration plan](../../docs/NEXTJS_MIGRATION_PLAN.md) are complete.

## Data and security rules

- Keep secrets out of client components and `NEXT_PUBLIC_*` variables.
- Use Supabase publishable/anon credentials only with correctly enforced Row Level Security.
- Never expose the service-role key in the browser.
- Recalculate prices and totals on a trusted server/database boundary; do not trust client-submitted amounts or payment status.
- Preserve existing auth, seller ownership, order isolation, COD and direct-UPI invariants through the migration.
