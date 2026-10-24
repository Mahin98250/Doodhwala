# Staging load-test guide

## Why this exists

Doodhwala now has a read-only k6 scenario for the public `find_nearby_providers_v2` RPC. It sends a controlled request rate and records latency, failed requests, and dropped iterations. This lets us build a measured capacity baseline before increasing traffic.

**This is not a 100,000-concurrent-query test.** The initial GitHub Actions runner is intentionally capped at 50 requests/second for short, controlled tests. A 100,000-request burst or distributed high-concurrency test needs a dedicated staging environment and a deliberately provisioned load generator; it must never be aimed at production.

## Safety model

- The workflow is manual-only (`workflow_dispatch`); pushes and pull requests do not generate load.
- Type exactly `STAGING` before the workflow runs.
- The target must use HTTPS and a Supabase project hostname.
- The known production project ref `hmiboyfcvtfawrwujslg` is explicitly blocked.
- The scenario only POSTs to the read-only `find_nearby_providers_v2` RPC. It does not place orders, update profiles, send payments, or mutate rows.
- Never test with customer data copied from production. Use synthetic providers/products.

## Configure a separate staging project

1. Create a **separate Supabase project** for staging; do not point these settings at production.
2. Apply the repository migrations to staging in the intended order and verify the staging schema. Seed only synthetic providers and products.
3. In GitHub repository settings, add the repository variable `STAGING_PROJECT_REF` with the exact 20-character staging project ref.
4. Add repository variable `STAGING_SUPABASE_URL` with the matching staging project base URL, e.g. `https://your-staging-ref.supabase.co`. The workflow rejects a ref/URL mismatch and the known production ref.
5. Add repository secret `STAGING_SUPABASE_ANON_KEY` containing the staging project's public anon key. Never use the service-role key.
6. Optional repository variables `STAGING_TEST_LATITUDE` and `STAGING_TEST_LONGITUDE` set the test location. Defaults are Ahmedabad coordinates and can be overridden with a synthetic staging area.

The workflow will fail safely if the project ref, URL or anon key is missing, if the ref and URL do not match, or if the production project is selected. The current repo does not assume that a staging project has already been configured. Each run attempts to save a metadata file and k6 summary as a non-sensitive Actions artifact (14-day retention); the report contains target rate, duration, commit SHA, and metrics, not credentials or customer data.

## Run a first baseline

From GitHub Actions, open **Staging scalability load test** and select **Run workflow**. Select an initial rate of 1 request/second for 30 seconds. Repeat at 5 and 10 requests/second before trying 25 or 50.

Initial pass criteria in the scenario:
- Failed HTTP requests below 1%.
- p95 HTTP request duration below 1,500 ms.

These are initial engineering guardrails, not claims about current capacity or final product SLOs. Review full output as well: request count, p50/p95/p99, timeouts, HTTP failures, and `dropped_iterations`. A dropped iteration indicates the load generator could not start work at the requested pace; it is not automatically proof that PostgreSQL is the bottleneck.

## What this test does not prove

It tests one read-only discovery path. It does not validate checkout writes, row-lock contention, payments, realtime fan-out, a complete multi-user workload, failover, restore, or billions of accounts. Those need separate staging scenarios and representative data. No production SQL migration is applied by this workflow.

## Next scale-test steps

1. Record the first passing RPS and latency percentiles along with staging compute and row counts.
2. Inspect `EXPLAIN (ANALYZE, BUFFERS)` and Supabase metrics for the nearby-search query.
3. Add separate read and write workloads only with idempotent synthetic test data and cleanup.
4. Increase the rate gradually; stop when error rates, latency, database saturation, or dropped iterations exceed the agreed guardrails.
5. Use a dedicated/distributed load generator for higher rates. Do not jump from a small GitHub runner to a 100,000-request burst without a capacity plan.


## Preserved run report

After a run reaches target validation, the workflow writes a metadata record containing the commit SHA, staging project ref, rate, duration, read-only scenario name and UTC timestamp. k6 exports a JSON summary, and the workflow uploads both files as a non-sensitive Actions artifact with 14-day retention. The report must never include the anon key, service-role key, access tokens, customer data or provider contact details. Save the artifact/run URL with any baseline notes so results can be tied to the exact commit and scenario.
