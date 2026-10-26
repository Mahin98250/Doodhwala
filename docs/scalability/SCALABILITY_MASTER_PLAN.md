# Doodhwala Scalability Master Plan

Status: architecture and implementation backlog. No infrastructure has been provisioned and no production settings have been changed.

## Goal and acceptance target

Prove that Doodhwala can serve 1,000 concurrent active users under a defined, realistic workload with acceptable latency, error rate, database load and cost. “1,000 concurrent users” is not the same as 1,000 requests per second. Record the scenario, request rate, test duration, p95/p99 latency, error rate and resource ceilings for every test.

Initial target for staging acceptance (adjust after baseline):
- Read-heavy browsing/discovery: p95 below 1.5 seconds for the nearby-provider RPC; error rate below 1%.
- Checkout/order writes: test separately with synthetic data and validate correctness, duplicate protection and stock/capacity constraints.
- Run ramp, steady-state, spike and soak tests; don't run synthetic load against production.
- Never claim capacity until a staging run has produced a report.

## Current architecture

- Static HTML/CSS/JavaScript PWA delivered from GitHub Pages.
- Supabase-managed PostgreSQL, Auth, RLS and selected RPCs/Edge Functions.
- Existing repository includes nearby-provider query/index work, order-capacity indexes, resilience handling, staging safety guards and a manual-only k6 read test.
- A separate staging Supabase project is currently blocked by the free-project limit. Do not create paid compute, upgrade a plan, pause/delete another project, or repurpose production without explicit approval.
- Repository migrations are not proof that the same migrations have been applied to production. Reconcile schema/history before any database change.

## System inventory and implementation approach

### 1. Edge traffic and protection
- CDN/static asset delivery: retain GitHub Pages delivery initially; verify cache headers and cache-bust versioned assets.
- DNS/TLS and edge routing: use managed platform defaults unless measurements or custom API needs justify a change.
- WAF, bot controls and DDoS protection: use a managed edge provider's free/low-cost tier if available and compatible; configure safe limits and review false positives.
- Reverse proxy/API gateway/load balancer: do not add a self-managed load balancer in front of GitHub Pages or Supabase. Supabase manages its service ingress. If a custom API service is introduced later, place a managed load balancer/API gateway in front of multiple stateless instances.
- Rate limiting: enforce sensitive-operation limits at trusted server-side boundaries; client-only limits are not security controls.

### 2. Application compute
- Keep the static frontend stateless. Do not store authoritative orders, prices, permissions or payment state in LocalStorage.
- Keep business-critical validation and writes in PostgreSQL RPCs or trusted Edge Functions.
- Scale custom compute horizontally only if we introduce it; make handlers stateless, add health/readiness checks, timeouts, bounded concurrency and graceful shutdown.
- Add autoscaling only when metrics show a real need and the budget is approved.

### 3. PostgreSQL and connection management
- Measure slow queries and query plans; add only evidence-backed indexes.
- Paginate provider, product, order and admin lists; cap result sizes and avoid unbounded queries.
- Use connection pooling for server-side connections where appropriate; don't open a new database connection per request.
- Keep transactions short; enforce order totals, price, provider capacity, authorization and idempotency inside trusted database/server operations.
- Add read replicas only if the managed plan supports them and read load warrants the cost. They are not the first optimization.
- Monitor CPU, memory, I/O, active connections, locks, slow queries, table/index bloat and pool saturation.
- Reconcile migrations and production schema read-only before proposing changes. Apply migrations only through reviewed PRs and an approved deployment process.

### 4. Cache layers
- Browser cache for versioned static assets and CDN cache for public static files.
- Cache only safe, non-sensitive catalogue/discovery data where freshness rules are clear.
- Redis/distributed cache is a later option if measurements show repeated reads are overwhelming PostgreSQL. Define TTL, invalidation and cache-outage behavior first.
- Never cache private account, address, order, payment or authorization responses in a shared cache.

### 5. Asynchronous work
- Move non-critical notifications, analytics aggregation, image processing and periodic cleanup to background jobs when these workloads exist.
- Start with PostgreSQL-backed scheduled/queued jobs or managed platform functions if sufficient.
- Add a dedicated message broker (for example, managed queue) only when throughput, retries or fan-out justify the operational cost.
- Use bounded retries, exponential backoff, idempotent jobs and a dead-letter/review path.

### 6. Reliability and security
- Request timeouts, bounded retries, exponential backoff with jitter and circuit breakers for external dependencies.
- Idempotency keys and unique constraints for order/payment-intent operations to prevent duplicates.
- Least-privilege RLS, server-side authorization, secret separation, input validation, audit logs and abuse controls.
- Graceful degradation: browsing should remain usable if analytics/notifications are unavailable.
- Backups, restore drills, incident runbooks and documented recovery objectives.

### 7. Observability
- Structured logs with request/correlation IDs and sensitive-data redaction.
- Frontend error reporting, API/RPC latency, database performance, auth failures, queue depth, rate-limit events and availability dashboards.
- Alerts for elevated 5xx/error rates, p95 latency, database saturation, failed jobs and backup/recovery issues.
- Keep secrets, access tokens, full payment references and personal data out of logs.

### 8. Testing and delivery
- CI: syntax, unit/contract tests, SQL migration validation and security regression tests.
- Staging: separate project/config/secrets and synthetic data only.
- k6: read-heavy discovery, realistic mixed browsing, checkout write correctness, spike and soak tests.
- Test guard: workflow must be manual-only, require explicit staging confirmation, reject the production project ref/URL and avoid writes unless a separately approved write scenario explicitly targets staging.
- Store reports as artifacts; compare p50/p95/p99, errors, throughput and database metrics between runs.
- Use feature flags where useful, reviewed PRs, staged rollout and rollback instructions.

## Phased implementation order

1. **Foundation and inventory:** keep production read-only; validate CI, map RPCs/indexes, establish baselines and document blockers.
2. **Database efficiency:** inspect query plans; verify pagination, index coverage, connection/pool behavior and RLS query costs.
3. **Testability:** resolve a zero-cost isolated staging option or request explicit budget approval; never substitute production.
4. **Load validation:** run safe k6 discovery tests, then expand to realistic mixed traffic and separately approved synthetic writes.
5. **Edge controls:** confirm CDN caching, request limits, abuse protection and monitoring.
6. **Async work and caching:** add only for measured bottlenecks and only with explicit freshness/retry rules.
7. **Custom API/load balancing:** introduce managed load balancing plus horizontally scaled stateless API instances only if the static + Supabase architecture demonstrably needs a custom compute tier.
8. **Release readiness:** recovery drill, cost review, security review, dashboards, alerts, rollback and capacity report.

## Decision gates

- No load test against production.
- No production migration/configuration change without explicit approval.
- No paid service, upgrade or resource creation without explicit approval.
- No claim that 1,000 users are supported until measured staging evidence exists.
- Keep work in branches and pull requests; do not merge or deploy without owner approval.
