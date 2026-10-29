# Doodhwala Payment Production Readiness — Live Audit

**Audit date:** 2026-10-29  
**Repository:** `Mahin98250/Doodhwala`  
**Production Supabase project:** `hmiboyfcvtfawrwujslg` (read-only inspection)  
**Branch:** `feat/dw-006-production-payment-readiness`  
**Decision:** **NOT READY for automated online collection.** Existing direct seller UPI/COD foundations are distinct from a provider-backed gateway.

## What was checked live

Read-only Supabase project, migration, Edge Function, table, grant, and security-advisor queries were run on 2026-10-29.

| Area | Observed result | Meaning |
|---|---|---|
| Supabase project | ACTIVE_HEALTHY; PostgreSQL 17.11, ap-south-1 | Database is reachable; this is not payment readiness |
| Payment migrations | Production history includes `doodhwala_pay_foundation`, `doodhwala_pay_event_ledger`, `doodhwala_direct_seller_payments`, payment-choice race guard, payment-field write guard, payment readiness controls, and payment audit/reference guard | Current live state is newer than the older 2026-10-23 readiness note; that note must not be treated as current |
| Payment tables | `payment_transactions`, `payment_provider_events`, `provider_payment_settings`, and `order_payment_events` exist; RLS is enabled | Ledger/schema foundations exist |
| Current payment rows | Payment ledger and provider-event inbox currently have zero rows | No live gateway transactions or webhook processing have been demonstrated |
| Deployed Edge Functions | Only `client-error-report` is deployed; `doodhwala-pay` is absent | The Doodhwala Pay intent/status endpoint is not live |
| Payment-table grants | `payment_transactions`, `payment_provider_events`, and `provider_payment_settings` have service-role table grants only for API roles; `order_payment_events` exposes SELECT to authenticated users and relies on RLS | Continue to verify row ownership policies and RPC boundaries; do not grant browser table writes |
| Authenticated RPCs | Eight direct-UPI/payment-control SECURITY DEFINER RPCs are executable by `authenticated` | Advisor flags them; inspect each function's ownership checks and search_path. Do not revoke blindly because the customer/seller flows call them |
| Security Advisor | 5 RLS-enabled/no-policy findings (including server-only payment tables); 8 authenticated SECURITY DEFINER warnings; leaked-password protection disabled | Verify intended deny-by-default grants, review each RPC, and enable leaked-password protection before launch |
| Orders/payments | Read-only table summary showed 0 orders and 0 payment ledger rows | No real-money end-to-end flow has been proven |

**Evidence limits:** these are live metadata/read-only checks. No payment was created, no production row was written, no migration was applied, no Edge Function was deployed, and no customer/seller account was used for an end-to-end test.

## Implemented vs. unverified

### Exists in production
- Payment-related tables/migrations and RLS.
- Direct seller UPI settings and order-scoped payment RPC foundations.
- Payment-choice controls and audit/event schema.
- Server-owned payment ledger schema and provider-event inbox schema.

### Not implemented or not verified as live
- `doodhwala-pay` Edge Function deployment.
- An actual acquiring provider/PSP integration and server-side provider credentials.
- Provider-signed webhook endpoint with raw-body signature validation.
- Provider event processing, replay protection exercised end-to-end, amount/order/currency verification, and provider settlement reconciliation.
- Refund/reversal/dispute flows tested against a provider.
- Browser/API end-to-end testing with real Supabase Auth sessions in isolated staging.
- Production-like load, recovery, and incident-response tests.

## Product-safe payment model

1. **Customer orders:** retain seller-direct UPI and COD. Funds go to the fulfilling seller, not Doodhwala. A seller's manual confirmation is **seller-attested**, not independently bank-verified. Never mark an order paid because the customer returned from a UPI app or supplied a screenshot/reference.
2. **Seller fees paid to Doodhwala:** keep monthly listing/promoted-listing invoices separate from customer order payments. A no-gateway-fee route is seller-to-Doodhwala UPI/bank transfer plus evidence-based manual reconciliation and an audit trail.
3. **Automated card/netbanking/wallet/UPI gateway:** do not enable until an appropriate provider is selected, its account/merchant onboarding is complete, fees are accepted, server-side credentials are configured outside Git, signed webhooks are implemented, and isolated staging tests pass. A true automated gateway cannot honestly be promised with zero provider fees unless a supported no-fee provider/acquirer agreement exists.

## Critical engineering risks to close

- **Edge Function rate limiting:** current source uses an in-memory per-instance bucket. It is not distributed and cannot be relied on as a production-wide abuse control.
- **Webhook security:** the event-ledger migration explicitly requires signature verification before event insertion; no provider webhook endpoint is deployed.
- **State truth:** only trusted server-side provider events may set gateway payments to captured/refunded. Seller-attested direct UPI must remain a separate status path.
- **RPC security:** review all eight SECURITY DEFINER functions for strict ownership/role checks, fixed `search_path`, input validation, and least privilege; resolve advisor findings based on code evidence, not blanket grant changes.
- **Auth security:** leaked-password protection is disabled in the current Supabase project and needs enabling/verification in Auth settings.
- **Staging/migrations:** do not push migrations based on filenames or old snapshots alone. Reconcile the current migration history/schema and test in an isolated staging project first. The current environment inventory has previously documented that a free isolated Supabase staging project was unavailable; do not create paid compute or use production as a test environment without explicit approval.

## Release checklist

- [x] Read-only live project status checked.
- [x] Live migration history checked for payment migrations.
- [x] Deployed Edge Function list checked.
- [x] Payment tables, RLS, API-role grants, and security-advisor findings checked.
- [ ] Review source and live definitions for all payment-related SECURITY DEFINER RPCs.
- [ ] Fix or explicitly justify every payment-related security finding.
- [ ] Add a supported provider integration, or formally keep gateway methods disabled and launch only the reviewed direct-UPI/COD/manual-reconciliation model.
- [ ] Deploy/test only in isolated staging; authenticated browser/API tests with synthetic accounts.
- [ ] Test idempotency under concurrency, duplicate/replayed callbacks, amount mismatch, cancelled orders, refunds, delayed settlement, reconciliation mismatches, and outage recovery.
- [ ] Obtain independent security/payment/legal review appropriate to the operating model.
- [ ] Explicit owner approval before production deployment or any real-money test.

## Safe next actions

1. Keep automated gateway collection disabled.
2. Reconcile and review the existing billing PR #71 rather than creating a competing billing implementation.
3. Run the eight RPC ownership/security reviews and document each result.
4. Add provider integration behind explicit server-side configuration and a fail-closed readiness gate; keep it disabled until staging acceptance.
5. Re-run all tests on the exact PR head and report PASS/FAIL/BLOCKED/NOT RUN separately.

## Safety boundary

This PR is an audit/readiness artifact. It does not merge other PRs, apply migrations, deploy Edge Functions, change production settings, enable billing, spend money, or perform real payments.
