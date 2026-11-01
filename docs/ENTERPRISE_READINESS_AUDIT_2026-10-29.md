# Doodhwala Enterprise Readiness Audit

**Audit snapshot:** 2026-10-29 (UTC)
**Repository baseline:** `main` at `dba11d39ae149d0b57fb36003da7d9330aba8b0b`
**Scope:** Repository source/workflows plus read-only Supabase project, table and migration inventory. No data rows were read beyond table row-count metadata. No writes, migrations, deployments or payment attempts were made.
**Decision:** **Not yet ready for a high-confidence enterprise launch.** The project has substantial groundwork—RLS, SQL contract tests, checkout retry tests, a PWA browser smoke test, and staging payment scaffolding—but release evidence is incomplete.

## Executive summary

The next stage should be **reliability and release evidence**, not a large feature expansion. Current risk is mostly the gap between repository/contract tests and verified behaviour in a real authenticated staging application, plus meaningful production/staging schema drift.

### Live inventory snapshot

Read-only Supabase inventory confirmed these projects are active and healthy:

| Measure | Doodhwala Staging | Doodhwala Production |
| --- | --- | --- |
| Project ref | `jbcekiaiyxcatueixeqh` | `hmiboyfcvtfawrwujslg` |
| Region | `ap-northeast-2` | `ap-south-1` |
| Public tables | 25 | 27 |
| Public functions | 68 | 70 |
| Public RLS policies | 40 | 45 |
| Public triggers | 13 | 17 |
| Recorded migrations | 87 | 67 |
| Latest recorded migration | `20261029110337` | `20261027062657` |

The staging table inventory reported RLS enabled for the listed public tables. This inventory is not a full policy correctness/security audit. The staging project was empty across the listed application tables at the time of the count, so it needs synthetic test fixtures before business-flow acceptance.

The staging and production regions differ. Use staging measurements as useful engineering evidence, but don't treat latency/throughput numbers as directly representative of production without documenting the regional difference.

**Documentation drift found and corrected in this audit branch:** the prior `docs/STAGING_BASELINE.md` said staging had not been provisioned, contrary to the read-only inventory. This branch refreshes that runbook and updates its contract test so it protects the current inventory and does not regress to the stale blocker. Review the updated baseline together with this audit.

## Prioritized findings

### P0 — Release blockers

#### P0.1 Reconcile staging and production schema/migration history

**Evidence:** The two projects differ in recorded migration count (87 versus 67), latest migration, public table/function/policy/trigger counts, and region. Existing `docs/STAGING_BASELINE.md` records a migration-history/schema mismatch and contains stale staging-provisioning status.

**Risk:** A migration that passes disposable PostgreSQL tests may still fail or have different effects against the actual Supabase schema, grants, Auth, RLS or Realtime state.

**Required work:**
- Refresh exact migration histories and schema inventories using read-only queries.
- Diff functions, signatures, triggers, indexes, RLS policies and grants—not only migration filenames.
- Classify each difference as expected, missing, renamed/drifted or unsafe/unknown.
- Rehearse required changes on staging in dependency order and record rollback steps.
- Do not use `db push`, migration repair, or production DDL as a shortcut for reconciling history.

**Acceptance:** A reviewed reconciliation report maps all relevant differences and dependencies; staging tests pass after the reviewed migration sequence. Production remains a separate explicitly approved release step.

#### P0.2 Prove the real customer → seller → customer journey in staging

**Evidence:** The repo contains unit/contract-style Node tests, checkout retry simulation, SQL assertions on disposable PostgreSQL, and a Playwright PWA/offline smoke test. Those checks are valuable but do not prove that authenticated Supabase Auth, RLS, database functions, Realtime events and the actual customer/seller screens work together. The staging inventory was empty across application tables at the audit snapshot.

**Required work:** Use synthetic staging accounts only to test sign-in, saved address, provider discovery, order placement, seller order visibility, accept/reject/status changes, customer tracking after reload/reconnect, multi-provider partial failure/retry, cancellation, subscription controls and notifications.

**Acceptance:** Evidence records commit SHA, environment/project ref, synthetic order ID, customer and seller assertions, expected/actual statuses and screenshots/log references. Retry and refresh must not create duplicate logical orders. No synthetic test orders in production.

#### P0.3 Make the Profile/auth fix merge-ready and verify it after deployment

**Evidence:** On `main`, both `profile/index.html` and `profile/details/index.html` initialize the shared client without first loading the Supabase browser SDK. This matches the reported signed-in Profile card showing “Sign in” and the Personal Details page not working. A targeted fix and regression assertions are in [PR #153](https://github.com/Mahin98250/Doodhwala/pull/153), currently a draft and not merged. The Vercel preview check reports an external build-rate-limit failure, so browser verification is not established.

**Required work:** Review PR #153, confirm all relevant CI gates are green, and verify the deployed branch in an authenticated mobile browser. Include SDK load order, refresh while signed in, auth state transitions, Personal Details read/save and sign-out in acceptance evidence.

**Acceptance:** Account status remains correct after refresh/navigation/sign-in/sign-out; no stale account data leaks across account switches; Personal Details can read/save through its protected RPC. Do not call the issue resolved solely because source assertions pass.

#### P0.4 Keep payments fail-closed until a genuine provider integration is verified

**Evidence:** Staging has an active `doodhwala-pay` Edge Function with JWT verification enabled. Production Edge Function inventory shows only `client-error-report`. The repo's payment readiness documentation states that `doodhwala-pay` is a payment-intent foundation, not a live automated gateway; direct seller UPI is manually seller-attested and is not independent bank-settlement proof.

**Required work:** Keep online gateway methods unavailable unless a provider has approved the marketplace model and the server-side adapter, signature-verified webhook, event deduplication, order/amount/customer matching, reconciliation and refund path pass sandbox tests. Keep direct seller UPI and COD independently functional. Never mark an order paid from a browser redirect, screenshot or client-supplied success flag.

**Acceptance:** A documented provider approval/settlement decision exists; forged, duplicate, delayed and wrong-amount webhooks are rejected or reconciled safely; no live payment is enabled without separate explicit approval.

### P1 — Must complete before broad rollout

#### P1.1 Move from source contracts to runtime authorization evidence

**Evidence:** Static security and authorization-isolation test scripts exist, and the inventory reports RLS enabled for listed public tables in both projects. Static source checks and RLS-enabled flags do not prove each role has only the intended access.

**Required work:** Exercise customer A/customer B, seller A/seller B, anonymous and admin roles against real staging policies/RPCs. Inventory `SECURITY DEFINER` functions, `search_path`, grants, ownership checks and write paths. Add negative tests for cross-customer and cross-seller reads/writes.

**Acceptance:** Every sensitive RPC has an explicit actor/ownership rule and tested allow/deny cases; admin operations have independent authorization checks and an audit trail.

#### P1.2 Add operational monitoring and error triage

**Evidence:** Production's table inventory showed 118 rows in `client_error_reports`. This is a count only; the records were not inspected, so it does not establish that all are unresolved or actionable.

**Required work:** Add a privacy-safe aggregate dashboard for error rates by release, route and error class; define severity, retention/redaction and triage ownership; alert on sustained critical error spikes. Validate that reports exclude secrets, OTPs, UPI PINs, payment credentials and unnecessary personal data.

**Acceptance:** A known synthetic error is searchable by release/route, redaction tests pass, and alert/triage ownership and retention are documented.

#### P1.3 Prove backup and recovery readiness

**Evidence:** Repository checks cover migration metadata and PWA recovery. The project has not been shown to have a successfully rehearsed database restore in the audit evidence.

**Required work:** Confirm backup/PITR settings and retention for the current plan, document recovery point/time objectives, and run a non-production restore/recovery drill with data-integrity checks. Do not claim recoverability just because backups are configured.

**Acceptance:** A dated drill report records restore source, restored environment, integrity checks, elapsed time and rollback/cleanup.

#### P1.4 Complete customer-facing operational workflows

**Required work:** Test seller onboarding and verification; inventory/availability; order acceptance timeouts; cancellation/refund/support escalation; notification failure states; recurring plan schedule/skip/cancel rules; account deletion and retention requirements.

**Acceptance:** Every visible action either performs a tested operation or explains clearly why it is unavailable. No placeholder action should promise a workflow that does not exist.

#### P1.5 Make legal and seller-trust requirements launch-ready

**Evidence:** The legal page explicitly marks current policies as drafts and identifies missing operator/legal/contact details.

**Required work:** Confirm operator identity/contact, seller verification procedures, applicable food-business registration/licensing checks, customer complaint handling, data handling/retention, and reviewed terms/refunds/privacy notices. Keep legal drafts clearly labelled until actually reviewed.

**Acceptance:** Approved policy versions and the implemented operational procedures agree; no UI copy claims verification or protections that the product does not provide.

### P2 — Scale and polish after P0/P1

- Establish target service levels for availability, p95 route/API latency, checkout success and error rate; measure before optimizing.
- Run bounded load tests against a clearly identified non-production environment. The existing workflow guards the target as staging and exercises read-only nearby-provider search; extend coverage only after safe staging write scenarios are designed.
- Add broader Playwright coverage for authenticated customer/seller/admin journeys, error states, accessibility, and common mobile viewport sizes. The existing Playwright smoke script focuses on PWA/offline behavior.
- Test PWA updates across old/new caches, online/offline transitions and cross-account session state.
- Improve deployment observability, release notes, canary/rollback instructions, branch protection and code-owner review.
- Defer framework migration, microservices and infrastructure complexity until measured bottlenecks justify them.

## Release gates

A release candidate must not be described as enterprise-ready until all applicable gates are evidenced:

1. **CI gate:** required syntax, contract, SQL and browser workflows pass on the exact release commit.
2. **Environment gate:** staging/production schema and migration differences are reconciled and reviewed; correct credentials/URLs are confirmed.
3. **Journey gate:** end-to-end customer → seller → customer order lifecycle passes with synthetic staging accounts and retry/reload tests.
4. **Security gate:** role-isolation tests, privileged RPC review, secrets scan and payment fail-closed checks pass.
5. **Operations gate:** backup restore and incident/error-triage procedures are demonstrated.
6. **Commercial gate:** provider approval, settlement model, legal review and policy/contact completion before enabling live payments or commercial expansion.
7. **Release gate:** explicit approval, deployment evidence, monitoring window and tested rollback plan.

## Proposed parallel work split

- **Mahin / backend and release:** staging migration reconciliation; RPC/RLS/grant inventory; payment provider decision and sandbox safety; backup/restore and release gates.
- **Vaidik / customer UI and QA:** route/button inventory; mobile responsive/accessibility audit; Playwright coverage for customer/seller journeys; screenshots and reproducible bug reports.
- **Shared contract:** one task board and one progress log; agree file ownership before implementation; separate branches/PRs; no concurrent edits to the same files; record the exact commit and evidence for every completed task.

## Audit limitations

This was a read-only, repository-based and metadata-based readiness assessment. It is not a penetration test, formal compliance review, capacity test, full source-code review of every RPC, or authenticated browser acceptance run. No table contents, customer profile data, payment records, or production writes were accessed for this report. It should guide the next verification work, not be used as a certification of security or launch readiness.
