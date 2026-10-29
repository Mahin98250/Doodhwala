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

## Rate limiting — defense in depth

The payment Edge Function now applies its in-memory request limit only after Supabase Auth verifies the caller and keys it by the verified user ID; client-provided `x-real-ip` and `cf-connecting-ip` values are not used as identity. The map is bounded and rejects new keys if it remains full after stale entries are cleaned up.

**Important limitation:** Edge Function isolates do not share this in-memory map, so it is only a per-isolate best-effort control. Before enabling online collection or treating this endpoint as production-ready, add a shared gateway- or database-backed rate limit, alerting, and load/abuse tests. Online gateway methods remain disabled and return HTTP 503 before order lookup or ledger writes.

## Remaining release gates

- [ ] Run the new GitHub Actions test suite on the PR head and inspect all checks.
- [ ] Reconcile PR #71 with current `main` without replacing newer UI/security changes.
- [ ] Run cross-account browser/API tests against authenticated staging sessions.
- [ ] Select and integrate a supported acquiring provider before enabling any online method.
- [ ] Implement signed raw-body webhook verification, event replay protection, amount/order/currency matching, reconciliation, refund/reversal handling, and provider outage tests.
- [ ] Enable and verify Supabase leaked-password protection.
- [ ] Obtain required payment/security review before production release.

## Safety

No production migration, function deployment, payment setting, billing setting, or real-money action was performed. This report does not claim the online gateway is production-ready.
