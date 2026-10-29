# Secure staging E2E execution plan

**Owner:** Vaidik Patel (@vaidikpatel22112010-tech)  
**Project lead / environment approval:** Mahin  
**Status:** PREPARED — EXECUTION BLOCKED until an isolated Supabase staging target is provisioned, inspected and explicitly approved.  
**Safety:** Never use production for test writes, synthetic orders, load, backup/restore drills, or real-money payment flows.

## 1. Mandatory environment gate

Before any authenticated E2E test runs, record and review all of the following:

- [ ] Mahin confirms the project is a separate staging project, not the production project `hmiboyfcvtfawrwujslg`.
- [ ] Record staging project ref, region, Supabase URL hostname, database target identity and current commit SHA.
- [ ] Verify the staging database is isolated from production and contains no copied customer PII.
- [ ] Compare the actual staging migration history/catalog with repository migrations. Resolve drift from source history/schema evidence; do not blindly replay migrations.
- [ ] Confirm required tables, RLS policies, RPC grants, SECURITY DEFINER ownership/search_path, Edge Functions and Realtime configuration in staging.
- [ ] Use separate GitHub Actions Environment secrets for staging URL and publishable/anon key. Never commit secrets or put service-role keys in browser code/logs.
- [ ] Confirm a rollback/cleanup plan and identify the owner authorized to reset synthetic fixtures.
- [ ] If staging requires a paid project/branch, stop and request explicit budget approval. Current blocker: the free-project limit is reached and the quoted branch cost was not approved.

**Gate result today:** **BLOCKED** — no isolated approved staging project/schema is verified. All cases below remain **BLOCKED / NOT RUN**; none is marked PASS.

## 2. Synthetic identity and fixture matrix

Create synthetic identities only after the environment gate passes:

| Alias | Role | Purpose |
|---|---|---|
| Customer A | authenticated customer | Own profile, address, cart, order, subscription, support ticket and notifications |
| Customer B | authenticated customer | Negative cross-customer ownership tests |
| Seller A | approved seller | Own catalogue, seller order queue, service settings and invoice records |
| Seller B | approved seller | Negative cross-seller ownership tests |
| Seller Pending | authenticated but not approved | Verify pending seller cannot expose catalogue or accept orders |
| Non-admin | authenticated non-admin | Negative tests for owner/admin-only operations |
| Allowlisted Admin | explicitly authorized owner/admin | Positive admin allowlist and audit trail checks |
| Anonymous | no session | Public route and anonymous-access boundaries |

All names, email addresses, IDs, products, addresses, order records and coordinates must be synthetic. Never use production records or copy production PII.

## 3. Ordered execution matrix

| ID | Scenario / steps | Expected result | Current status |
|---|---|---|---|
| STG-001 | Verify staging identity, migration ledger, required schema, RLS, RPC grants and function configuration before seeding | Target is isolated; schema drift is understood; missing objects are reported, not bypassed | **BLOCKED** — staging target unavailable |
| STG-002 | Sign in/out and reload as Customer A, Customer B, Seller A/B, Pending Seller, Non-admin and Allowlisted Admin | Session state is correct; invalid/expired session fails closed; each role sees only permitted routes/actions | **BLOCKED** — authenticated staging required |
| STG-003 | As Customer A, attempt read/write of Customer B profile/address/cart/order/subscription/support/notification/tracking identifiers; repeat in reverse | Every cross-owner read/write is denied without leaking private record details | **BLOCKED** — deployed RLS/RPC test required |
| STG-004 | As Seller A, attempt to read/mutate Seller B products/orders/invoices/payment settings; test Pending Seller visibility | Seller can access only owned resources; pending/unapproved seller remains restricted | **BLOCKED** — deployed RLS/RPC test required |
| STG-005 | Test anonymous and Non-admin calls to owner/admin RPCs; then test the allowlisted role | Anonymous/non-admin calls denied; only approved allowlist identity can execute authorized admin operation; audit trail is accurate | **BLOCKED** — deployed grants/policies required |
| STG-006 | Browse approved/unapproved sellers; test location granted/denied, outside-radius, empty results, loading/error/retry | Only eligible/serviceable sellers shown; no false success; retry recovers safely | **BLOCKED** — live staging data required |
| STG-007 | Load product with valid, zero, negative, missing and stale price/stock; change quantity; alter server fixture before checkout | Server-authoritative price/stock wins; invalid/unavailable item cannot be ordered; totals are accurate | **BLOCKED** — staging backend required |
| STG-008 | Submit checkout twice rapidly; simulate timeout/retry and reload after a partial multi-seller result | No duplicate order for completed work; partial success is stated truthfully; retry resumes safely | **BLOCKED** — synthetic staging orders only after approval |
| STG-009 | Move one synthetic order through legal customer/seller states; attempt illegal transition and cross-seller mutation | Only allowed state transitions succeed; unauthorized mutation denied; status survives reload/reconnect | **BLOCKED** — persisted workflow/Realtime required |
| STG-010 | Create/edit/pause/resume/skip/cancel a subscription around local-date cutoff and timezone boundaries; retry actions | Local-calendar rules are consistent; cutoff is enforced; duplicate actions do not create duplicate delivery obligations | **BLOCKED** — staging schedule/RPC required |
| STG-011 | Create/read/mark-read notifications; trigger supported order events; disconnect/reconnect Realtime | Notifications are scoped to owner and read state persists; unavailable push is not reported as delivered | **BLOCKED** — authenticated Realtime required |
| STG-012 | Exercise support-ticket create/history/retry/error and account-deletion request lifecycle with synthetic identities | Owner-only access, safe retries and honest success/failure; deletion retention policy is followed | **BLOCKED** — authenticated staging required |
| STG-013 | Exercise payment readiness and failure states using test fixtures only; verify gateway reports not-ready if provider is not deployed | No real payment is initiated; redirects or seller attestations are not treated as bank-verified payment; unavailable integration fails closed | **BLOCKED** — payment integration review required; **NO REAL MONEY** |
| STG-014 | Fresh PWA install, update from prior cache, offline route loads, reconnect and older-tab update behavior | Required offline shell is available; unrelated origin caches preserved; offline copy does not promise queued orders; refresh reveals current content | **BLOCKED / NOT RUN** — physical Android/iOS and installed-PWA tests unavailable |
| STG-015 | Backup/restore and rollback rehearsal using synthetic staging data | Restore checksums/counts/invariants match; rollback steps and recovery time are recorded | **BLOCKED** — isolated target and explicit approval required |
| STG-016 | Bounded read-only performance test only after the isolated target and safety guards are approved | Record region, data size, concurrency, p50/p95/p99, errors and artifact; no writes/production load | **BLOCKED** — staging target and explicit run approval required |

## 4. Per-test evidence template

For every executed case, record:

- Test ID and exact commit SHA
- Environment/project ref and region (never secrets)
- Role alias and synthetic fixture identifiers
- Browser/device/OS/viewport, where relevant
- Exact commands or reproducible steps
- Expected result and actual observed result
- Status: **PASS / FAIL / BLOCKED / NOT RUN**
- Workflow/run URL and artifact URL, with screenshots stripped of personal data
- Failure severity, follow-up issue/PR, owner and next action

A source contract or disposable PostgreSQL fixture is not evidence of deployed Supabase Auth/RLS/Realtime behavior. A Chromium smoke is not evidence of physical-device behavior.

## 5. Cleanup and stop conditions

1. Stop immediately if the target identity is ambiguous, the URL/project ref matches production, schema/migration history is unexplained, or any secret/real user data appears.
2. Never run synthetic writes or load against production. Never initiate a real-money transaction.
3. Use only documented fixture cleanup scoped to the isolated staging project; verify cleanup by synthetic IDs/counts. Do not issue broad deletes.
4. Preserve sanitized logs/artifacts and record failed/partial cleanup as a blocker.
5. Do not enable payment collection or recommend release solely because automated CI is green.

## 6. Approval required to unblock

Mahin must confirm:
- An isolated staging project/schema and project ref are provisioned and verified.
- Required schema/migration reconciliation is reviewed.
- Synthetic accounts and test secrets are ready in the restricted staging environment.
- Any nonzero hosting/compute cost is explicitly approved.
- The first staging E2E run and any later bounded load/backup-restore operation are authorized.

Until those confirmations are recorded, keep all STG-001–STG-016 execution statuses **BLOCKED / NOT RUN**.
