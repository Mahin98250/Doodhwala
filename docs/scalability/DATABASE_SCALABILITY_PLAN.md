# Doodhwala: Database Scalability and Reliability Plan

**Status:** Architecture plan; not a claim that production has been load-tested or can currently serve these targets.
**Current backend:** Supabase/PostgreSQL (verify live schema and plan before changing production).
**Principle:** Scale from measured traffic and bottlenecks. Do not promise that one database or a free tier can handle 100,000 simultaneous requests or billions of users.

## 1. Define the load target correctly

These are different measurements:
- **Registered users:** accounts that exist.
- **Concurrent users:** people active during the same period.
- **Requests per second (RPS):** requests arriving at the backend each second.
- **Concurrent requests:** requests in flight at the same time.
- **Database queries per second (QPS):** SQL statements executed per second.

“100,000 queries at a time” must be converted into an RPS/QPS, query mix, payload size, and latency/error target before capacity can be sized. One million registered users does not mean one million simultaneous database connections. Ten billion users is not a credible near-term sizing target; it requires a multi-region, partitioned architecture and a large operating budget.

## 2. Target architecture

```text
Web / PWA
   |
CDN + static asset caching (GitHub Pages)
   |
Supabase Auth + API / Edge Functions
   |
Rate limits + input validation + authorization
   |
Postgres connection pooler
   |
PostgreSQL primary  ---- read replicas (only for eligible read traffic)
   |                         |
Backups + PITR                Read-only catalog/report queries
   |
Object storage for images and documents (not database blobs)
   
Async work: durable queue -> idempotent workers -> notifications / analytics
Observability: request IDs, logs, metrics, alerts, traces
```

This is a target design, not a description of everything currently deployed. A CDN caches public/static assets; it must never cache private order data or authenticated responses as public content.

## 3. Database rules that protect correctness and performance

1. **Keep PostgreSQL as the source of truth** for users, providers, subscriptions, inventory, orders, and payment state until measured scale justifies a deliberate change.
2. **Connection pooling:** use Supabase's supported pooler and server-side pooling patterns. Never open one database connection per browser/user. Keep transactions short and avoid idle transactions.
3. **Indexes:** index actual filter/join/order columns from query plans (for example provider ID + active status, customer ID + created_at, order status + created_at). Avoid speculative indexes; every index costs write and storage capacity.
4. **Pagination:** use bounded page sizes and cursor/keyset pagination for growing order/history tables. Do not return unbounded rows or use deep OFFSET pagination on hot paths.
5. **Query discipline:** select only required columns; avoid N+1 queries, repeated identical reads, expensive wildcard searches, and full-table scans. Review `EXPLAIN (ANALYZE, BUFFERS)` on representative staging data.
6. **Data integrity:** use foreign keys, constraints, transactions, and unique idempotency keys for order/payment operations. Do not rely on the browser to enforce business rules.
7. **Tenant isolation:** enforce Row Level Security (RLS) for customer/provider data, test cross-account access, and never expose the service-role key in frontend code.
8. **Hot data:** cache only safe, frequently-read data (e.g. public provider/product listings) with a bounded TTL and explicit invalidation. Order/payment status must not be served from stale public cache.
9. **Large files:** store images/receipts in object storage; keep metadata and storage keys in PostgreSQL.
10. **Growth:** archive/partition large append-heavy tables only after measuring table size and query patterns. Partitioning does not replace indexes or good queries.

## 4. Protect the system during traffic spikes

- Apply per-IP and per-account rate limits at the API/edge layer; use stricter limits for login, search, checkout, OTP, and payment endpoints.
- Enforce request body size, pagination, timeouts, and maximum work per request.
- Put slow non-critical work (email, analytics, image processing) onto a durable queue. Workers need bounded concurrency, retries with backoff, dead-letter handling, and idempotency.
- Use bounded retries with jitter. Never let every client retry a failing database at once.
- Apply backpressure: return a controlled 429/503 with retry guidance rather than exhausting the database.
- Keep checkout/order writes transactional and idempotent. Do not make payment success depend on an unverified client-side redirect.
- Provide graceful degradation: if analytics/recommendations fail, core browsing and safe order flows should continue.
- Do not add Redis, Kafka, sharding, or microservices just because they sound scalable. Add them only when measurements prove the need and the team can operate them.

## 5. Scale in stages

### Stage 0 — Establish a safe baseline (now)
- Verify live schema/migrations and deployed functions against the repository; production is known to have been missing payment schema/RPC objects in a prior preflight.
- Keep checkout fail-closed until required database functions, authorization, and payment-state transitions are verified.
- Capture current Supabase plan/limits, database size, connection use, slow queries, API error rate, and backup/PITR status.
- Add request IDs, structured logs, alerts, and a documented rollback process.

### Stage 1 — Optimize the current Postgres
- Inspect real query plans and add only justified indexes.
- Add cursor pagination, response limits, and query timeouts.
- Verify pooler usage, RLS policies, and least-privilege access.
- Run tests against a separate staging project with production-like schema and synthetic data.

### Stage 2 — Test and tune
- Define separate read-heavy, write-heavy, and burst scenarios.
- Use k6 or an equivalent load tool against staging, not production.
- Ramp load gradually; monitor p50/p95/p99 latency, errors, database CPU/memory, active/queued connections, locks, cache hit ratio, and storage.
- Test steady state, 2–5x bursts, connection exhaustion, slow queries, and recovery after a test stops.
- Set an explicit pass/fail SLO before testing (for example, p95 API latency target and error-rate budget); do not invent capacity numbers before results exist.

### Stage 3 — Scale the measured bottleneck
- Upgrade database compute/limits when CPU, memory, I/O, or connections are demonstrably saturated.
- Add read replicas for compatible read-only traffic if the chosen Supabase plan supports them and replication lag is acceptable.
- Add a cache for measured hot reads and a durable queue for non-critical asynchronous tasks.
- Partition high-volume tables only with a tested migration and query plan.
- Re-run load tests after each material change.

### Stage 4 — Multi-region / very large scale
- Decide region placement and data residency based on actual users and legal requirements.
- Define replication, failover, recovery-point objective (RPO), and recovery-time objective (RTO).
- Consider regional read models, partitioning/sharding, and separate services only when single-region PostgreSQL has measured limits.
- Plan for conflict handling, cross-region consistency, operational staffing, incident response, and substantial infrastructure costs.
- Ten billion users cannot be guaranteed by an architecture document; it requires concrete workload modelling and ongoing engineering.

## 6. Required reliability checks

- [ ] Production migrations are versioned, reviewed, and safely repeatable where appropriate.
- [ ] Staging schema matches the intended production schema.
- [ ] RLS and authorization tests cover customer/provider/admin cross-access.
- [ ] Order creation is transactional and idempotent.
- [ ] Payment webhooks are authenticated, deduplicated, and idempotent.
- [ ] Backups/PITR and a restore drill are verified.
- [ ] Database and API monitoring/alerts are enabled.
- [ ] Load tests include read and write traffic and record the tested environment.
- [ ] Rate limits, timeouts, bounded retries, and backpressure are tested.
- [ ] Rollback and incident runbooks exist.
- [ ] Live end-to-end customer, seller, and admin workflows are verified separately from static CI.

## 7. Load-test acceptance report template

Record before claiming capacity:
- Commit / schema migration version:
- Supabase project plan and database compute:
- Test environment and dataset size:
- Scenario (read/write mix, payload sizes):
- Target arrival rate (RPS) and concurrency:
- Duration and ramp profile:
- p50 / p95 / p99 latency:
- HTTP/API error rate and SQL errors:
- Peak DB CPU, memory, connections, I/O, locks:
- Replication lag (if applicable):
- Result: pass / fail, bottleneck, follow-up:
- Recovery and restore test outcome:

## 8. Important cost and honesty note

A scalable architecture is not automatically free. CDN caching and careful SQL can reduce costs, but database compute, backups, replicas, queues, monitoring, and high availability have limits or costs. Start with the current free/low-cost tier and measured optimization; do not enable paid infrastructure or production migrations without an explicit decision. No design can promise zero downtime or unlimited traffic.

## Immediate next actions

1. Read-only audit the current schema, migrations, query paths, RLS, and Supabase project limits.
2. Resolve the known production schema/function mismatch safely, using staging and reviewed migrations first.
3. Add query-plan/index and pagination tests for the hottest customer/provider/order paths.
4. Create a staging-only load-test workflow and publish measured results.
5. Make scaling decisions from the results, not from registered-user counts alone.
