# Doodhwala mobile and scale architecture

## Decision

Build Doodhwala as one product with a responsive web app and store-distributed mobile apps. Keep the current Next.js migration isolated until its release gates pass. Do not replace the production app or split the backend into microservices just to prepare for scale.

## Recommended framework stack

- **Web:** Next.js App Router + React + TypeScript. Keep customer, seller, and owner experiences in the web app where that is useful.
- **Mobile:** React Native + Expo + TypeScript. Share API contracts, validation schemas, domain types, and small framework-agnostic business-logic packages with the web app. Do not try to share every UI component across web and mobile.
- **Backend/data:** Supabase PostgreSQL, Auth, Storage, and existing RPCs/RLS as the source of truth. Keep secrets and privileged operations server-side.
- **Hosting:** Vercel for the Next.js web app; Expo Application Services (EAS) or local native build tooling for signed Android/iOS builds. Review current free-tier and store requirements before choosing paid services.
- **Testing:** unit tests for domain logic, integration tests against a staging Supabase project, Playwright for critical web journeys, and device testing for Android/iOS.
- **Observability:** structured server logs, error reporting, request IDs, and latency/error dashboards. Choose a low-cost provider only after privacy and budget review.

## Architecture boundaries

1. The database and trusted server-side operations decide prices, stock, delivery coverage, seller ownership, order state, subscriptions, and payment status. The client is never authoritative for these.
2. Keep the existing Supabase RLS policies and RPC contracts intact during the migration. Add regression tests before changing any contract.
3. Use cursor/keyset pagination for growing order, product, and admin lists; select only required columns and avoid per-row query loops.
4. Add indexes based on observed query plans and real workload, not guesswork. Measure p50/p95/p99 latency, error rates, database saturation, and connection usage.
5. Use idempotency keys for order creation and other retryable writes. Never blindly retry a payment/order mutation.
6. Cache only public or safely partitioned data. Do not shared-cache customer addresses, order details, seller-private data, or owner/admin responses.
7. Move slow, retryable work (notifications, image processing, reports) to a durable queue when needed. Make handlers idempotent. Do not introduce Redis or microservices until measurement demonstrates a need.
8. Keep separate development, staging, and production credentials and data. Load-test staging only; never run destructive tests against production.

## Mobile delivery plan

### Phase 1 — Foundation
- Keep web and mobile as separate apps in the repository (for example, `apps/web` and `apps/mobile`).
- Establish shared packages for domain types, validation, API contracts, and configuration only where they are genuinely platform-neutral.
- Document environment variables and ensure no service-role key is bundled into a browser or mobile app.
- Confirm auth deep links, session handling, and sign-out behavior on physical devices.

### Phase 2 — Customer MVP
- Browse nearby independent milk sellers and products.
- Seller storefront, cart, delivery address, checkout, COD/direct-seller-UPI hand-off where supported by current backend rules.
- Order status/history, subscription management, support, and notification preferences.
- Loading, empty, offline, permission-denied, and recoverable-error states; accessible text sizes and touch targets.

### Phase 3 — Seller experience
- Seller sign-in and role-gated workspace.
- Product/stock management, incoming orders, dispatch/delivery updates, and payment receipt acknowledgement.
- Ensure every operation is checked server-side against seller ownership.

### Phase 4 — Store release
- Configure app IDs, icons, splash screens, privacy policy, support contact, data-safety/privacy disclosures, permission explanations, and account deletion flows where required by current store policies.
- Test signed release builds on real Android and iOS devices; verify deep links, notifications, network failures, small screens, and app resume.
- Use internal/closed testing tracks first, then staged rollout. Store review approval and publication are separate from building the app.
- Keep mobile API behavior backward-compatible so older app versions do not break when the web app is updated.

## Scale gates before public launch

- Verify staging auth, RLS, RPC grants and response shapes with customer, seller, and owner test accounts.
- Test duplicate submissions, stale stock, price tampering, seller isolation, unauthorized admin access, and interrupted network requests.
- Load-test realistic browse, search, checkout, and order-status traffic against staging; record p50/p95/p99 latency, throughput, error rate, and database connection pressure.
- Confirm backup/restore and rollback procedures.
- Define an initial SLO and alerts before increasing traffic. Scale database resources or introduce caching/queues only in response to measured bottlenecks.

## Important non-goals

- Do not move straight to microservices.
- Do not add a separate backend server if existing secure Supabase RPCs and server-side Next.js routes are sufficient.
- Do not store card/bank credentials or claim that direct seller UPI is a payment gateway.
- Do not publish the current web migration as a mobile app until the customer journey and security gates pass.
- Do not merge the migration PR or switch production traffic based only on a successful build.
