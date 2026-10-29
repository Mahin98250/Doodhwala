# Staging baseline and migration reconciliation

**Current status (read-only inventory, 2026-10-29): staging project exists and is healthy; full application acceptance is not yet proven.** Use synthetic identities/data only. Do not run synthetic checkout/load tests or migrations against production.

## Current verified environment inventory (2026-10-29)

| Measure | Doodhwala Staging | Doodhwala Production |
| --- | --- | --- |
| Project ref | `jbcekiaiyxcatueixeqh` | `hmiboyfcvtfawrwujslg` |
| Region | `ap-northeast-2` | `ap-south-1` |
| Database engine | PostgreSQL 17 | PostgreSQL 17 |
| Public tables | 25 | 27 |
| Public functions | 68 | 70 |
| Public RLS policies | 40 | 45 |
| Public triggers | 13 | 17 |
| Recorded migration entries | 87 | 67 |
| Latest recorded migration | `20261029110337` | `20261027062657` |
| Edge Functions observed | `doodhwala-pay` v1 (JWT verification enabled) | `client-error-report` v3 |

These are read-only inventory facts, not certification that the schemas are equivalent or secure. Table counts, policy counts and RLS-enabled flags do not prove policy correctness. The application tables observed in staging were empty at the time of this snapshot, so synthetic test fixtures and authenticated browser journeys are still required.

The two projects are in different regions. Staging test timing is not directly representative of production latency unless the region difference and test design are documented. Refresh this table after any reviewed environment change.

## Current blockers and safety boundaries

- **Migration reconciliation remains P0.** Staging records 87 migrations versus production's 67. Public-object counts also differ. Determine which differences are intended, missing, renamed or unsafe before applying any changes. Never infer that a Git migration is deployed solely because its file exists.
- **Authenticated end-to-end acceptance remains pending.** No evidence in this baseline proves the full customer → seller → customer journey, actual Auth/RLS/Realtime behavior, or cross-account isolation on staging.
- **Payment separation remains important.** The staging `doodhwala-pay` Edge Function exists, but the repository's documented contract is a fail-closed payment-intent foundation, not a live automated gateway. Direct seller UPI is manually seller-attested, not bank-verified by Doodhwala. Production currently has no `doodhwala-pay` function in the observed inventory.
- **No additional spend without approval.** Do not create paid branches, additional projects, or upgraded compute without explicit cost review and approval. Do not pause, delete or repurpose projects to free a slot.
- **No production test writes or migrations.** Keep production preflight read-only. Production rollout is a separate reviewed change with explicit approval.

## First execution sequence

1. Capture the latest migration list, relevant schema definitions and grants from both staging and production using read-only methods.
2. Compare functions/signatures, triggers, indexes, RLS policies, grants and migration identifiers. Record each difference and its impact.
3. Review migration dependencies and rehearse an explicitly selected sequence on staging; do not blindly replay all local migrations.
4. Verify the staged schema and all relevant grants/policies after migration rehearsal.
5. Run authenticated synthetic customer → seller → customer browser journeys, including retries/reload/reconnect, and capture non-sensitive evidence.
6. Run bounded load tests against staging only after validating the workflow's project-ref/URL guards.
7. Save the commit SHA, migration list, test account aliases, synthetic order IDs, results, limitations and rollback steps.
8. Treat production rollout as a separate change; staging results never authorize production migration automatically.

## Read-only database audit

Use `scripts/staging-schema-audit.sql` only when the SQL client is explicitly connected to the intended staging database. Verify project ref and URL before execution; do not include secret credentials in the report.

## Acceptance gates

- [x] A distinct staging project exists and current inventory reports it active/healthy.
- [ ] Exact staging migration history and schema inventory reconciled.
- [ ] RLS, function grants, payment gates and order-capacity constraints reviewed against actual definitions.
- [ ] Authenticated synthetic end-to-end order journey passes.
- [ ] Retry, reload, reconnect and duplicate-submit behavior verified in browser.
- [ ] Backup/restore or supported recovery procedure tested and documented.
- [ ] Read-only discovery load test passes with named baseline settings.
- [ ] Report records commit SHA, environment, metrics, errors and limitations.

**No capacity or enterprise-readiness claim** should be made until tests are evidenced for a named commit, environment/region, plan, data size, scenario mix and load-generator profile.

## Production migration snapshot and repository drift

### Focused live-schema check

A separate read-only catalog query was captured in [`supabase/audit/production-schema-check-2026-10-24.json`](../supabase/audit/production-schema-check-2026-10-24.json). The key findings are:

- `public.find_nearby_providers_v2` is present in production, although the observed migration-history snapshot does not show the exact repository migration version `20261023120000`.
- The provider latitude/longitude and active-product indexes are present.
- The two repository order-capacity indexes (`orders_provider_open_capacity_idx` and `orders_provider_daily_litres_idx`) are absent by those exact names in the observed catalog.
- `payment_transactions` and `order_payment_events` are absent from the observed catalog.

This is concrete evidence of **migration-history/schema mismatch**: some real schema objects exist without matching the exact repo migration history, while others added in Git are not present in production. The finding is why we must compare the actual schema and migration history, inspect definitions and privileges, then recreate and test the sequence in staging. Do not blindly replay files, rename timestamps to force a match, or apply any of these migrations in production based on this report.

Run `node scripts/test-production-schema-inventory.mjs` to validate the metadata snapshot's consistency in CI. This is an offline static test and does not query production.

The read-only snapshot at [`supabase/audit/production-migration-history-2026-10-24.json`](../supabase/audit/production-migration-history-2026-10-24.json) records the 57 migration versions observed in the live project on 2026-10-24. It contains migration identifiers and names only; it is not a database dump.

Run `node scripts/test-production-migration-manifest.mjs` (also executed by CI) to compare exact live version IDs with timestamped SQL files in `supabase/migrations/`. It reports:
- Production migration versions that have no exact matching local SQL filename.
- Local timestamped migration files absent from the observed production history (candidates for staging review, not auto-apply instructions).
- Whether the latest production version has an exact source file in Git.

Initial report result for the current audit branch (static CI, 2026-10-24): **10/57** live version IDs have an exact local SQL filename, **47/57** do not; **55** timestamped local SQL files are not present in the live snapshot; and the latest live version has no exact local filename. These are filename/history comparisons, not proof that 47 SQL changes are missing from the actual schema. Some local files may use different timestamps for identically named migrations. The audit now separates exact version matches from same-name/different-version clues; a name-match is investigatory evidence only and does not prove the SQL contents are equivalent. The mismatch has to be resolved from source history or a clean schema dump before replaying or applying migrations.

This check is deliberately diagnostic rather than an automatic deployment gate: historical file names may have drifted, and newer repository migrations must be reviewed in dependency order. **Never apply migrations or mark them as deployed based solely on the report.** Refresh this snapshot from the authorized read-only Supabase migration inventory when production changes; keep the source date visible.

## Migration reconciliation protocol

1. Capture the exact current staging migration list and schema before changing anything.
2. Compare migration version identifiers with the repository's `supabase/migrations/` directory. Record missing, duplicate, out-of-order and renamed migrations.
3. Review the SQL and dependencies for every migration missing from staging. Do not blindly run every repository migration against production.
4. Apply repository migrations to staging in a controlled order, then run the SQL validation and app contract tests.
5. Compare important functions, indexes, RLS policies and grants against expected definitions. The audit queries in `scripts/staging-schema-audit.sql` are read-only diagnostics and may need schema-specific additions as the project evolves.
6. Run browser-based customer → seller → customer order tracking with synthetic accounts, then run read-only load testing. Only after those pass, run bounded synthetic write tests against staging.
7. Save the commit SHA, migration list, load-test settings/results, query plans, failures and rollback steps in the staging report.
8. Production rollout is a separate reviewed change. No staging result automatically authorizes a production migration.

## Read-only database audit

Run `scripts/staging-schema-audit.sql` only after connecting your SQL client to the intended staging database. It does not modify schema or data. Verify the connection target before execution.

## First acceptance gates

- [ ] Organization and project cost confirmed.
- [ ] Separate staging project created and healthy.
- [ ] Staging project ref and URL saved as GitHub repository variables, anon key saved as a repository secret (not committed).
- [ ] Repository migration history reconciled against staging.
- [ ] RLS, function grants, payment gates and order-capacity constraints reviewed.
- [ ] Synthetic end-to-end order journey passes.
- [ ] Backup/restore or supported recovery procedure documented.
- [ ] Read-only discovery load test passes at baseline settings.
- [ ] Staging report records commit SHA, metrics, errors and limitations.

**No capacity claim** should be made until measured results exist for a named commit, database plan/region, data size, scenario mix and load-generator profile.
