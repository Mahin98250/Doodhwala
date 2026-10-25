# Doodhwala Platform Framework

## Goal

Build one marketplace platform for independent neighbourhood milk sellers, with a customer website, native Android/iOS apps, seller workspace, and owner/admin operations. The existing production app remains the source of truth until the migration passes release gates.

## Framework decisions

- **Customer and operations web:** Next.js App Router + TypeScript in `apps/web`.
- **Native mobile:** Expo + React Native + TypeScript in `apps/mobile`; one native codebase targets Android and iOS.
- **Backend:** the existing Supabase project, PostgreSQL, Auth, Storage, and verified RPCs. Do not duplicate business rules in clients.
- **Shared contracts:** `packages/contracts` defines platform-neutral domain types and API result shapes. Add shared validation schemas only when a dependency strategy is agreed.
- **Hosting:** keep the current production deployment unchanged while the Next.js app is preview-only.
- **Cost posture:** prefer existing/free-tier services and avoid paid APIs unless the business case is explicit.

## Platform boundaries

```text
Customer website (Next.js) ─┐
Seller/admin web (Next.js) ─┼── Supabase Auth + RLS + verified RPCs
Android app (Expo) ─────────┤          │
iOS app (Expo) ─────────────┘          └── PostgreSQL / Storage
                     Shared domain contracts
```

Clients may format and validate input for usability, but the backend must re-check identity, seller ownership, availability, price, serviceability, subscription state, and order totals. Never trust client-calculated totals or expose service-role credentials to browsers or mobile bundles.

## Product modules

1. **Identity and access:** customer, seller, support, admin, and owner roles; server-enforced permissions and session lifecycle.
2. **Discovery:** nearby independent providers, service areas, products, prices, milk types, availability, and search.
3. **Ordering:** cart, delivery address, schedule, order creation, order status, cancellations, and idempotency.
4. **Payments:** seller-direct UPI and COD where supported by a verified workflow; payment state must be auditable. Never mark a payment successful based only on a client callback.
5. **Seller workspace:** catalogue, availability, service area, incoming orders, fulfilment, and business profile.
6. **Subscriptions and promotion:** seller plans and sponsored placements with explicit billing and entitlement checks.
7. **Owner/admin:** seller moderation, support tools, business analytics, audit trail, system health, and operational controls.
8. **Notifications:** consent-based push/SMS/email after token lifecycle, opt-out, and server authorization are implemented.

## Delivery sequence

- **Phase 1 — Foundation:** migration branch, web/mobile build validation, environment validation, shared contracts, CI, and staging-only configuration.
- **Phase 2 — Identity:** customer/seller auth, role mapping, deep links, RLS checks, and physical-device session tests.
- **Phase 3 — Marketplace:** discovery contract verification, product detail, cart, and serviceability.
- **Phase 4 — Orders:** backend-owned order pricing, idempotent order creation, COD/direct-UPI states, seller fulfilment, and audit events.
- **Phase 5 — Operations:** seller portal, owner/admin tools, subscription entitlements, moderation, and health monitoring.
- **Phase 6 — Reliability:** query/index review, pagination, rate limits, observability, load testing, backup/restore drill, and rollback rehearsal.
- **Phase 7 — Release:** privacy disclosures, store assets/signing, accessibility, device matrix, security review, and explicit production cutover approval.

## Non-negotiable release gates

- No production schema, auth, payment, domain, or deployment changes as part of this draft migration.
- Verify actual RPC names, arguments, result shape, grants, and RLS from the repository/backend before wiring a feature.
- Public browser/mobile keys only; no service-role key in any client environment.
- No invented seller data, fake checkout success, or client-only authorization.
- CI and staging smoke tests must pass for web and both mobile targets.
- Test realistic concurrent traffic and slow networks; do not claim a user capacity without measured load-test results.
- Keep the PR in draft until web, mobile, SQL, security, and deployment checks are green.
