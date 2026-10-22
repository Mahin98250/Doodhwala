# Doodhwala Pay — non-production validation and launch checklist

**Status: release checklist / not evidence of deployment.** The payment migrations are repository artifacts until they are applied and verified in a non-production Supabase project. Do not run these migrations against production as a shortcut.

## 1. Before touching a database

- [ ] Confirm the Supabase project and environment are explicitly **non-production**.
- [ ] Confirm a recent restorable backup exists for that environment.
- [ ] Record the current migration history and schema version.
- [ ] Inspect the existing definitions of `orders`, `providers`, and auth user references; confirm the referenced columns and types match the migration foreign keys.
- [ ] Review all migration SQL, triggers, grants, RLS policies, and service-role assumptions.
- [ ] Confirm the migration tool's expected ordering and that both payment migrations are included.
- [ ] Never paste service-role keys or gateway secrets into issues, browser code, test fixtures, or logs.

## 2. Apply and verify in non-production

- [ ] Apply `20261022120000_doodhwala_pay_foundation.sql` to non-production.
- [ ] Apply `20261022133000_doodhwala_pay_event_ledger.sql` to non-production.
- [ ] Confirm both migrations are recorded as applied.
- [ ] Confirm `payment_transactions` and `payment_provider_events` exist with expected columns, unique constraints, indexes, and foreign keys.
- [ ] Confirm RLS is enabled on both tables.
- [ ] Using an anonymous client, verify direct reads/writes are denied.
- [ ] Using an authenticated non-owner customer, verify direct reads/writes are denied.
- [ ] Verify the service role can perform the intended server-side operations without exposing its key.
- [ ] Attempt every allowed status transition and every forbidden transition in a disposable test transaction; verify invalid transitions are rejected.
- [ ] Confirm duplicate `(gateway_name, gateway_event_id)` inserts are rejected or handled idempotently by the eventual webhook processor.
- [ ] Verify rollback/recovery steps in a disposable environment. Do not delete payment/audit records to make a rollback appear clean; prepare a forward-fix plan for stateful data.

## 3. Required integration tests before provider sandbox work

- [ ] Test order ownership and order-state checks with multiple test accounts.
- [ ] Test concurrent duplicate intent requests with the same idempotency key.
- [ ] Test the same idempotency key with a different order or method and require rejection.
- [ ] Test amount calculation from server-side order data, including invalid, zero, and excessive values.
- [ ] Test missing/invalid publishable API key configuration fails closed.
- [ ] Test oversized, malformed, and unsupported-method requests.
- [ ] Confirm no client request can directly set a transaction to `captured` or `refunded`.
- [ ] Confirm all payment state changes are attributable to trusted server code and redacted operational logs.

## 4. Provider selection and sandbox gates

Do not build a fake UPI intent or pretend that a payment succeeded. Select a real provider only after confirming onboarding eligibility and marketplace support.

- [ ] Choose a provider that supports the intended UPI checkout flow and the required marketplace/seller settlement model.
- [ ] Confirm onboarding, KYC/business requirements, refund support, webhook signatures, event IDs, settlement reports, and fees directly with that provider.
- [ ] Obtain sandbox credentials and store them only as server-side Supabase secrets.
- [ ] Implement a provider adapter and a separate webhook endpoint.
- [ ] Verify webhook signatures against the exact raw request bytes before parsing or changing payment state.
- [ ] Add timestamp/replay checks, event-id idempotency, amount/currency/reference validation, and out-of-order event handling.
- [ ] Test success, failure, cancellation, duplicate webhook, delayed webhook, invalid signature, amount mismatch, and refund outcomes in sandbox.
- [ ] Verify return/redirect pages never count as payment proof.

## 5. Marketplace ledger and settlement gates

- [ ] Define and review the fee/commission policy; do not invent a percentage in code.
- [ ] Define allocation for multi-provider carts, discounts, delivery fees, taxes, refunds, reversals, and partial refunds.
- [ ] Add append-only ledger entries and compensating-entry rules.
- [ ] Build provider-report reconciliation and an exception queue for missing, duplicate, late, and amount-mismatched events.
- [ ] Ensure seller payable balances are not treated as proof that money has been settled.
- [ ] Verify seller onboarding/approval and settlement eligibility before enabling payouts.
- [ ] Test reconciliation and settlement exports with synthetic sandbox data.

## 6. Production release gates

- [ ] Independent security review of SQL, Edge Functions, RLS, webhook verification, secrets, logging, and abuse controls.
- [ ] Confirm distributed rate limiting and monitoring; in-memory counters are not sufficient for production.
- [ ] Review legal, tax, privacy, marketplace, and payment terms with qualified professionals. Policy copy remains a draft until reviewed.
- [ ] Confirm the real operator identity and support contact before publishing business-facing policy promises; do not invent either.
- [ ] Complete provider onboarding and any required business verification.
- [ ] Run end-to-end sandbox tests and document expected reconciliation outcomes.
- [ ] Feature-flag the rollout; begin with a controlled test group and a documented disable/incident process.
- [ ] Verify production environment variables and secrets without printing their values.
- [ ] Only announce live payments after a real end-to-end payment and reconciliation test is verified.

## Current implementation status

- Payment-intent foundation and payment transaction schema: implemented in repository.
- Publishable API-key allow-list hardening: implemented in repository.
- Provider-event inbox and database payment-state transition guard: implemented in repository.
- Provider API adapter, signed webhook processor, refund workflow, marketplace accounting ledger, reconciliation worker, and seller settlements: **not yet implemented**.
- Migration application to a real Supabase environment: **not verified by this checklist**.
- Live payments: **not enabled or ready**.

Static CI checks validate repository contracts; they do not execute SQL against Supabase, prove production configuration, or verify a real provider payment.
