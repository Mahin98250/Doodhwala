# Doodhwala scale and stability gates

This document describes the safe path from the current isolated Next.js migration to a production-ready marketplace. It does not authorize production cutover.

## Shipped in the migration branch

- Existing route-level loading, error and not-found experiences provide feedback without placing a global streaming boundary in front of redirect aliases.
- Browser Supabase configuration validation rejects insecure non-local HTTP URLs and URLs containing embedded credentials, query strings or fragments.
- Responsive overflow, keyboard-focus, reduced-motion, touch and narrow-screen safeguards.
- Existing order idempotency and backend-authoritative pricing/coverage checks remain the required checkout boundary.

## Before a preview can be trusted

1. Use a dedicated staging Supabase project with synthetic customers, sellers, catalogue entries and orders. Never run load or destructive tests against live orders.
2. Configure only the preview environment with that project's public URL and publishable/anon key. Never expose service-role or secret keys through NEXT_PUBLIC_*.
3. Add the preview origin to Supabase Auth redirect allowlists and configure OAuth/SMS providers only for test identities.
4. Exercise customer, seller and owner roles through a browser, including denied access paths. Confirm the database/RPC layer—not UI visibility—enforces every permission.
5. Record a baseline for p50/p95 latency, error rate, database connection pressure, CPU, memory and rate-limit responses before changing concurrency.

## Scale architecture principles

- Keep Next.js handlers stateless. Do not keep sessions, locks, carts or order state in process memory; instances can scale horizontally and restart at any time.
- Keep price calculation, inventory validation, delivery coverage, authorization, idempotency and payment-state transitions inside trusted database functions/transactions.
- Make every list paginated with a stable order and bounded page size. Avoid unbounded select-all queries, client-side downloading of entire tables, and per-row request loops.
- Inspect query plans for hot seller discovery, order queue, order history and admin reports. Add indexes only after confirming actual filter/order predicates and measuring them on staging.
- Use the Supabase connection pooler and supported transaction/session mode for server-side workloads if server-side database connections are introduced. Do not create a separate database connection per request.
- Cache only public, non-personal catalogue/discovery data with a short, explicit freshness policy. Never shared-cache account data, addresses, order history, admin responses or authorization decisions.
- Apply bounded concurrency, request timeouts, retry only safe/idempotent reads, and exponential backoff with jitter. Do not automatically retry order creation or payment-state mutations unless the backend idempotency contract guarantees safety.
- Add rate limits for auth, OTP, support submission, seller actions and checkout at the trusted boundary; UI-only throttling is not security.
- Track request IDs, RPC latency, error class, retries, rate-limit hits and checkout outcomes without logging passwords, OTPs, tokens, full addresses or payment secrets.

## Load-test release gates

- Run the existing staging scalability workflow only after its target URL and test credentials point to staging.
- Start at low concurrency, ramp gradually, then test a short burst and a sustained plateau. Use synthetic, non-payment orders only.
- Set acceptance thresholds before the run. At minimum, require no duplicate orders under retry, no cross-user data exposure, no uncontrolled 5xx growth, and stable p95 latency/connection pressure under expected load.
- Run a separate spike test for discovery and checkout. A successful static build is not a capacity test.
- Save the run report with commit SHA, test shape, p50/p95/p99, throughput, error rate and resource metrics.

## Production cutover remains blocked until

- Preview auth and real RPC/RLS journeys pass for customer, seller and owner roles.
- Price tampering, duplicate submissions, seller ownership, address coverage and unauthorized admin operations are tested.
- Mobile, keyboard accessibility and failure/retry paths are reviewed.
- A rollback is rehearsed and the existing live marketplace remains available until parity is accepted.
