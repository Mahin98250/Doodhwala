# Staging Payment and Seller-Billing Security Validation

**Date:** 2026-10-29  
**Environment:** Isolated Supabase project named Doodhwala Staging  
**Data policy:** All test identities, orders, invoices, and payment references were synthetic. Test transactions were rolled back. No production data, real customer account, or real money was used.

## Customer order payment flow — PASS

A single transaction created synthetic users, a verified test seller, seller UPI instructions, an address, and a placed order. Assertions verified:

- Customer can choose seller-direct UPI for their own placed order.
- The order enters `payment_pending_verification`, not a gateway-captured state.
- Only the order's customer can retrieve order-scoped UPI instructions.
- A different customer cannot read those payment instructions.
- A different customer cannot change the order payment method.
- A seller who does not own the order cannot confirm its payment.
- The owning seller can record a valid manual reference; the RPC explicitly returns `bank_settlement_verified_by_doodhwala: false`.
- The status stored is `paid_direct_to_seller`, which represents seller attestation, not bank settlement verification.

The test ended with `ROLLBACK`.

## COD authorization — PASS

A separate synthetic transaction verified:

- The customer can select COD on their own order.
- The payment status remains `cash_on_delivery`.
- The seller cannot confirm COD collection before the order is delivered.
- An unauthenticated caller cannot change the payment method.

The test ended with `ROLLBACK`.

## Seller monthly billing — PASS

Before validating the pending invoice-idempotency migration, the staging invoice table was checked: 0 invoices, 0 invalid billing periods, 0 duplicate provider/month pairs, and neither new constraint existed.

The invoice idempotency migration was applied to **staging only**. The revised migration was then executed inside a transaction and rolled back to verify that it safely re-applies when its constraints already exist. This is necessary because the first staging validation was recorded under the descriptive migration name `doodhwala_provider_invoice_month_idempotency_staging_validation`, not the repository's original timestamped filename. The repository migration now conditionally creates the constraints and rejects same-name constraints of the wrong type.

Synthetic billing assertions then verified:

- An authorized admin can create an invoice for a full calendar month.
- Retrying the same provider/month returns the original invoice ID.
- Only one invoice exists per provider/month.
- Partial-month periods are rejected.
- The database unique constraint rejects a duplicate provider/month invoice.
- A non-admin cannot create invoices.
- Exact-amount manual UPI reconciliation marks the invoice paid and records a payment row.
- An amount mismatch is rejected.
- A duplicate payment reference is rejected.
- A provider can read their own invoices and payment evidence.
- A different provider cannot read those invoices.
- A non-admin cannot record a payment.

All billing test data and payment records were rolled back.

## Online gateway — BLOCKED / NOT RUN

The live staging project has no deployed Edge Functions. No acquiring-provider adapter, provider credentials, or signed webhook processor is configured. Therefore, an online gateway transaction cannot be end-to-end tested honestly. The code change in this PR now returns `503 payment_provider_not_configured` for online UPI/card/netbanking/wallet intents before order lookup or payment-ledger insertion. COD is rejected from the gateway endpoint and remains on the separate order-payment RPC path.

The static contract test `scripts/test-payment-gateway-fail-closed.mjs` is wired into CI. It asserts that disabled methods cannot create intents, browser roles cannot access the server-owned payment ledger/event inbox, event IDs are unique, and payment state transitions remain guarded.

## Rate limiting — shared server-side control

The payment endpoint now validates the caller through Supabase Auth and then calls the server-only `doodhwala_payment_api_allow_request` RPC. PostgreSQL atomically tracks each authenticated user across Edge Function isolates, allowing 30 requests per 60-second window. The endpoint fails closed with HTTP 503 if the shared limiter cannot be reached or returns an unexpected response; a denied request receives HTTP 429.

The limiter table has RLS enabled and no browser-role table grants or execute permission on the RPC. CI exercises the 31st-request denial, window reset, and privilege boundaries in disposable PostgreSQL. These controls provide shared rate limiting, but alerting, abuse/load testing, and a payment-security review remain release gates. Online gateway methods remain disabled and return HTTP 503 before order lookup or payment-ledger writes.

## Seller billing amount and timestamp guards

A new migration adds database constraints limiting monthly plan prices, invoice totals, and reconciled payment rows to ₹1–₹10,00,000. The admin RPC enforces the same limits, so bypassing the browser UI cannot submit a higher or sub-₹1 amount. Migration preflight rejects existing out-of-range records rather than silently changing billing history.

Manual reconciliation now rejects a received-at timestamp more than five minutes in the future and one more than five minutes before the invoice was created. It also explicitly rejects a null/unsupported payment method, holds the invoice row while recording payment, and retains exact-amount matching. These checks improve data integrity; because reconciliation remains manually attested, they do not independently prove a bank/UPI transfer happened.

The isolated PostgreSQL CI fixture now exercises direct database amount constraints, RPC amount limits, future/backdated timestamps, amount mismatch, and a valid exact-amount reconciliation.

## Remaining release gates

- [ ] Run the new GitHub Actions test suite on the PR head and inspect all checks.
- [ ] Reconcile PR #71 with current `main` without replacing newer UI/security changes.
- [ ] Run cross-account browser/API tests against authenticated staging sessions.
- [ ] Select and integrate a supported acquiring provider before enabling any online method.
- [ ] Implement signed raw-body webhook verification, event replay protection, amount/order/currency matching, reconciliation, refund/reversal handling, and provider outage tests.
- [ ] Enable and verify Supabase leaked-password protection.
- [ ] Obtain required payment/security review before production release.


## Follow-up API source review and runtime validation

- A source-level audit found that doodhwala-pay/index.ts called rest(...) for the shared limiter and payment-status lookup, but its helper definition had been lost during the earlier rate-limit refactor. That made the endpoint fail closed with HTTP 503 rate_limit_unavailable after authentication. Restored a typed server-side REST helper that sets the service key only inside the Edge Function and preserves per-request headers.
- Added regression assertions for the helper definition and its server-only API/Authorization headers. Added "deno check supabase/functions/doodhwala-pay/index.ts" to Static validation; the actual Edge Function type-check and payment source-contract test pass on code commit 90aa96732ff36d7c82fe04632aaf6069dcfdace8.
- All five GitHub Actions workflows passed on that code commit: [Static validation](https://github.com/Mahin98250/Doodhwala/actions/runs/40859052967), [SQL migration validation](https://github.com/Mahin98250/Doodhwala/actions/runs/40859052978), [In-app notification validation](https://github.com/Mahin98250/Doodhwala/actions/runs/40859052857), [PWA offline browser evidence](https://github.com/Mahin98250/Doodhwala/actions/runs/40859052911), and [Provider monthly billing idempotency](https://github.com/Mahin98250/Doodhwala/actions/runs/40859052863).
- The helper correction and CI changes are source-only. doodhwala-pay remains undeployed to staging and production; online payment methods are still disabled. This is not a claim of live Edge Function/browser E2E success.

## Staging Security Advisor and RPC review

- The staging Security Advisor reported RLS-enabled/no-policy findings for the payment rate-limit table, payment ledger/event inbox, and seller payment/billing settings. The rate-limit table and payment ledger/event inbox have RLS enabled and browser-role table privileges revoked; those rows are intentionally inaccessible directly through browser roles. The no-policy findings are documented, not presented as a clean Advisor result.
- The Advisor also reported 14 SECURITY DEFINER functions executable by authenticated. Reviewed the payment and seller-billing RPC definitions: anonymous execute was denied for the inspected functions; each uses an empty search_path; customer payment-method selection and UPI instruction retrieval scope to auth.uid()/the owning order; seller UPI/COD confirmation scope to the seller owner and enforce method/status requirements; and seller-billing write/read RPCs check the admin allowlist or provider ownership. COD collection is restricted until an order is delivered.
- These checks reduce the risk but do not erase the Advisor warnings. Final manual review must still validate the admin allowlist/authentication model and every exposed privileged RPC before release. Do not silence or bulk-revoke the findings without checking the intended app calls and least-privilege behavior.


## Safety

No production migration, function deployment, payment setting, billing setting, or real-money action was performed. This report does not claim the online gateway is production-ready.
