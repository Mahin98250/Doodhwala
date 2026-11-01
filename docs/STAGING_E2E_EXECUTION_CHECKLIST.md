# Staging E2E Execution Checklist

**Status: PREPARED — execution BLOCKED.** This checklist is for an isolated, explicitly approved non-production Supabase project only. The repository's current staging baseline says no isolated staging project is provisioned/verified and no additional paid service may be created without approval. Production is never a fallback.

**Owner:** Vaidik Patel (@vaidikpatel22112010-tech)  
**Approval authority:** Mahin Patel (@Mahin98250)  
**Related work:** [DW-011 / issue #94](https://github.com/Mahin98250/Doodhwala/issues/94), [order journey #73](https://github.com/Mahin98250/Doodhwala/issues/73), [RLS review #79](https://github.com/Mahin98250/Doodhwala/issues/79), [payment readiness #78](https://github.com/Mahin98250/Doodhwala/issues/78), [staging baseline](STAGING_BASELINE.md).

## 1. Entry gate — do not execute until every item is confirmed

- [ ] Mahin confirms the target is an isolated staging project and authorizes the specific test window.
- [ ] Project ref is verified and explicitly differs from production project ref `hmiboyfcvtfawrwujslg`.
- [ ] Staging URL, publishable/anon key, schema, region, billing/compute plan, and project health are verified without posting secret values in logs or Git.
- [ ] No production credentials, customer PII, production orders, or copied production data are used.
- [ ] Synthetic users and records are created specifically for this run; cleanup/retention plan is approved.
- [ ] Migrations and schema drift are reviewed against staging before application tests.
- [ ] Payment provider is in test mode or payment flows are disabled; no real-money payment is possible.
- [ ] Test run records candidate commit SHA, staging build/deployment identity, browser, date/time, and operator.
- [ ] Bounded test duration, request rate, data limits, and stop conditions are agreed before performance testing.
- [ ] Backup/recovery procedure and rollback/cleanup steps are documented before any write or load test.

**If any gate is unchecked:** all authenticated staging execution stays **BLOCKED**. Continue only offline/static/disposable-PostgreSQL preparation.

## 2. Synthetic role matrix

Use distinct synthetic identities and unique seeded records. Never reuse real customer/seller data.

| Role | Fixture | Allowed checks | Required negative checks |
|---|---|---|---|
| Customer A | customer-a@example.invalid | Own profile/address/cart/order/subscription/support/notifications | Cannot read or mutate Customer B data |
| Customer B | customer-b@example.invalid | Own records only | Cannot read or mutate Customer A data |
| Seller A | seller-a@example.invalid | Own products, stock, order queue, invoice/settings | Cannot read or mutate Seller B data |
| Seller B | seller-b@example.invalid | Own products, stock, order queue, invoice/settings | Cannot read or mutate Seller A data |
| Non-admin | non-admin@example.invalid | Ordinary user-authorized paths | Cannot invoke owner/admin RPCs or access admin data |
| Admin | admin@example.invalid | Explicitly allowlisted admin functions only | Unallowlisted identity and unauthorized RPC attempts are denied |

These addresses are placeholders, not provisioned accounts. Replace them with staging-only synthetic account IDs in the private run record; do not commit credentials or session tokens.

## 3. Execution matrix

For every row, record: tested SHA; environment/project ref (never keys); role; exact steps/command; expected result; actual result; status (**PASS / FAIL / BLOCKED / NOT RUN**); artifact/log URL; follow-up issue; cleanup outcome.

| ID | Scenario | Expected result | Current status |
|---|---|---|---|
| AUTH-01 | Sign up/sign in/sign out and session restore for synthetic customer and seller | Valid sessions work; sign-out/expired session loses protected access | BLOCKED — staging not verified |
| AUTH-02 | Customer A requests Customer B profile/address/cart/order/subscription/support/notification IDs | Denied or safely empty; no data disclosure or mutation | BLOCKED — staging not verified |
| AUTH-03 | Seller A requests Seller B products/orders/invoices/private settings | Denied; no cross-seller data disclosure or mutation | BLOCKED — staging not verified |
| AUTH-04 | Non-admin invokes admin/owner-only RPCs or privileged routes | Authorization denied server-side | BLOCKED — staging not verified |
| CAT-01 | Approved/unapproved seller, service area, empty/search results, invalid stock/price | Only eligible products appear; invalid/non-positive price is not purchasable; empty/error/retry states are honest | BLOCKED — staging not verified |
| CART-01 | Add/update/remove quantities and recalculate totals with seeded prices | Totals match current server-authoritative prices; invalid product/price is rejected | BLOCKED — staging not verified |
| ORDER-01 | Synthetic customer checkout through seller acceptance and status update | One order identity persists across customer and seller; legal state transitions only | BLOCKED — staging not verified |
| ORDER-02 | Double-submit, timeout/retry, reconnect/replay | No duplicate order/charge; idempotency and rollback behavior match contract | BLOCKED — staging not verified |
| ORDER-03 | Stale price/stock and concurrent capacity limits | Server revalidates; rejected writes do not leave partial order state | BLOCKED — staging not verified |
| SUB-01 | Create/edit/pause/resume/skip/cancel subscription across local-date cutoff | Correct timezone/cutoff behavior; no duplicate daily delivery | BLOCKED — staging not verified |
| RT-01 | Seller order status/notification/Realtime update and reconnect | Authorized updates arrive; reload/reconnect reflects persisted server state | BLOCKED — staging not verified |
| PAY-01 | Payment status, disabled/test-mode provider and webhook replay cases | No live collection; only verified server-side events change payment state; replay is idempotent | BLOCKED — staging not verified |
| UI-01 | Loading, empty, success, validation, network error and retry states | Clear feedback, accessible errors, no false success | NOT RUN — separate manual/browser evidence required |
| PWA-01 | Fresh install, prior-cache update, offline navigation, reconnect and old-tab update | Current assets/fallback behave correctly; no claim that orders/payments queue offline | NOT RUN — device/old-tab checks outstanding |
| PERF-01 | Bounded read-only baseline with agreed concurrency and stop conditions | Latency/error/throughput captured without affecting production | BLOCKED — staging and explicit approval required |
| REC-01 | Approved staging backup/restore or documented recovery exercise | Recovery is verified against synthetic fixture data | BLOCKED — staging and recovery approval required |

## 4. Safety and stop conditions

Stop immediately if the configured target cannot be positively identified as staging, any production ref/credential is detected, real payment collection is possible, test identities can access another role's data, a migration has an unexplained destructive effect, or errors exceed the approved threshold. Preserve sanitized logs and the exact SHA; do not retry writes blindly.

Never:
- run synthetic orders, load tests, migrations, or destructive checks against production;
- paste secrets, service-role keys, session tokens, customer data, or payment details into GitHub;
- run paid compute or create paid resources without explicit budget approval;
- mark a blocked/not-run row as passed based on static checks, mocks, or disposable PostgreSQL fixtures.

## 5. Current evidence and next action

- Repository staging baseline: [docs/STAGING_BASELINE.md](STAGING_BASELINE.md) records the missing isolated project and no-additional-cost constraint.
- Existing CI/disposable PostgreSQL checks are useful preflight evidence only; they do not prove deployed Supabase Auth/RLS/RPC/Realtime or full E2E behavior.
- **Next action:** Mahin to confirm whether an isolated staging project is available and approved, including the exact project ref and cost/plan. Until then, keep all authenticated staging scenarios above **BLOCKED** and continue only safe repository-level test preparation.
