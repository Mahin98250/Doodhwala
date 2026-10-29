# Doodhwala Phase 1 — Direct-to-seller UPI + COD

**Implementation branch:** `payments/phase1-direct-seller-hardening`  
**State:** Draft implementation; CI/review pending; not deployed  
**Business rule:** Customer money goes directly to the selected milk seller. Doodhwala takes no per-order commission and does not receive, pool or settle the customer's milk payment.

## Phase 1 scope

- Customers choose direct seller UPI or cash on delivery at checkout.
- UPI instructions are loaded only through the authenticated, order-scoped RPC for that customer's pending order; payee details come from the seller's saved settings.
- The server derives the amount from the stored order total. Client-supplied amount/status values never confirm payment.
- A seller must be active and approved to enable direct UPI.
- Enabling UPI requires a second, explicit seller declaration that the UPI ID and payee name belong to their business. The database stores who attested and when, and a check constraint prevents enabled settings without that record.
- Legacy UPI settings that have no new attestation are disabled by the migration. Sellers must review and re-enable their details after the migration is approved and applied.
- Seller receipt confirmation requires a transaction reference. References are normalized before recording, and a case-insensitive unique index blocks reuse for another order.
- Repeating the same seller's confirmation with the same reference returns an idempotent result after a timeout. A different reference cannot overwrite an already-confirmed order.
- Customer and seller interfaces say that seller confirmation is an attestation, not independent bank verification. Cancelled/rejected orders do not show a fresh payment action.
- Existing append-only `order_payment_events`, payment field guards, customer/seller ownership checks and COD-after-delivery rules remain part of the safety boundary.

## Important limits

The ownership declaration is **not** proof that a bank or UPI account belongs to the seller. The seller must check the payee name during setup, and customers must check the displayed payee name and amount inside their own UPI app before approving the payment. Doodhwala still does not receive a signed bank/provider callback or independently verify settlement in Phase 1.

Direct UPI may avoid a payment-aggregator fee in this particular flow, but the customer's or seller's bank/UPI terms can still apply. No fee-free guarantee is made for every account or transaction. Doodhwala's zero per-order commission is a separate business rule and remains the intent.

## Migration and release notes

- The new migration replaces the legacy three-argument `provider_save_direct_upi` RPC. A caller that omits the new ownership argument defaults to `false` and cannot enable a UPI destination.
- Before any real rollout, apply migrations to an isolated disposable database first. The normalized unique-reference index deliberately fails closed if legacy case-variant duplicate references exist; inspect/reconcile them before retrying.
- Confirm the exact migration set and current Supabase schema state before a staging rollout. This PR does not apply migrations, deploy Edge Functions, change secrets or settings, turn on production payments, or move money.
- The new regression checks are primarily source-contract checks. A passing static test is not a substitute for disposable-PostgreSQL integration tests, authorization tests against real RLS/grants, or an independent security review.

## Next engineering gates

1. Run repository CI against this branch and fix any failures.
2. Add a disposable PostgreSQL scenario test for the new migration: attestation required, legacy enabled row disabled, unapproved seller rejected, exact-reference replay idempotent, case-variant reference reuse rejected, customer/seller ownership denied, and cancelled order blocked.
3. Review and apply migrations only to an isolated staging database with explicit approval; repeat the adversarial suite.
4. Keep real-money collection gated. Automated bank/provider verification belongs in a later phase only if a supported bank/provider contract and verified server-side mechanism are confirmed.

## Design principle

Learn from general payment engineering ideas such as integer paise, durable audit events, idempotency and server-side authorization, but do not copy YouPI source code. YouPI's repository labels itself experimental and its declared `Commercial` licence has not established permission for Doodhwala to reuse it.
