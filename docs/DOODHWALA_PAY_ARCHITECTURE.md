# Doodhwala Pay — marketplace payment architecture

**Status: engineering design, not a live gateway.** This document is a build plan, not a claim of regulatory approval. Do not accept or advertise online payments until provider onboarding, security review, production tests, and applicable professional review are complete.

## Product scope

Doodhwala is a marketplace: independent milk sellers fulfil orders. Payment records must distinguish the customer's payment to the marketplace/provider from seller earnings and later settlement. A payment intent is not a payment, and a provider redirect is not proof of capture.

## Target components

1. **Customer checkout** — requests an intent for an existing order; never submits a trusted amount.
2. **Doodhwala Pay Edge Function** — authenticates the customer, verifies order ownership and payable state, computes the amount from authoritative server data, and calls the provider using server-only credentials.
3. **Provider adapter** — isolated implementation for one selected authorized provider. Keep provider-specific request/response types out of the client.
4. **Webhook endpoint** — verifies the provider's signature against the raw request body, validates timestamp/replay controls, and persists the provider event idempotently before applying a state transition.
5. **Payment ledger** — server-only transaction records with unique idempotency keys and provider payment identifiers.
6. **Marketplace ledger** — immutable double-entry-style entries for gross customer payment, provider fees (when known), platform commission, seller payable, refunds, reversals and settlements. Entries are append-only; corrections use compensating entries rather than editing history.
7. **Reconciliation worker** — compares provider reports/payouts with internal ledger totals and raises exceptions for missing, duplicate, late or amount-mismatched events.
8. **Admin finance view** — access-controlled transaction search, exception queue, refund requests, seller payable balance and settlement export. Sensitive provider secrets never appear in browser code or logs.

## Payment state machine

Allowed high-level transitions should be explicit and enforced on the server:

- created -> pending_provider
- pending_provider -> authorized | captured | failed | cancelled
- authorized -> captured | failed | cancelled
- captured -> refund_pending
- refund_pending -> refunded | captured (only after a verified provider result; a failed refund returns to captured)
- terminal failed, cancelled, and refunded states must not be changed by a client request.

Provider events may arrive more than once or out of order. Persist each provider event ID with a unique constraint; validate amount, currency, provider order reference, and transaction ownership before transition. Do not downgrade captured because a late failure event arrived. Partial refunds need an amount-aware refund ledger rather than simply changing the whole transaction to refunded.

## Marketplace money model

For each captured order, calculate the seller payable and platform commission from a versioned, reviewed fee policy. Do not hard-code a fee percentage until the business chooses and reviews it. If several sellers can contribute to one order, allocate each line item to the correct seller and define shipping/tax/discount allocation explicitly. Seller settlement must only use verified provider balance/payout evidence and approved seller identity/onboarding; a database balance alone does not move funds.

## Minimum security requirements

- Provider secrets are server-side secrets only; never commit them or expose them to the browser.
- Never collect/store card PAN, CVV, UPI PIN or banking passwords. Use the provider's hosted checkout/approved SDK.
- Verify webhook signatures on the exact raw bytes, use constant-time comparison where supported, enforce timestamps, and reject replayed event IDs.
- Compute amounts from the server-owned order snapshot; reject cancelled, fulfilled/paid or otherwise non-payable orders according to a reviewed order state model.
- Enforce unique idempotency keys in the database and handle concurrent duplicate requests safely.
- Use distributed rate limiting and monitoring for production; in-memory Edge Function counters are not distributed.
- Restrict ledger writes to trusted server code; expose only customer-owned status through an authenticated API.
- Redact personal data and provider payload secrets from logs; never log authorization headers or payment credentials.
- Reconcile daily and maintain an operator-visible exception queue.
- Keep legal/policy text as review drafts until reviewed by qualified professionals.

## Launch gates

1. Choose the payment provider/acquirer based on onboarding eligibility, supported UPI/card/net-banking methods, marketplace/split-settlement support, refund API, webhook guarantees, fees and settlement reporting.
2. Complete provider onboarding and required business verification; do not imply that Doodhwala is itself a licensed payment system.
3. Review the existing orders schema and map the authoritative order amount/status safely.
4. Apply the ledger migration to a non-production environment and validate foreign keys, RLS, grants and backups.
5. Implement provider order creation and signed webhook handling; add database-enforced state transitions and provider-event idempotency.
6. Add sandbox tests for success, failure, cancellation, timeout, duplicate/out-of-order webhook, amount/currency mismatch, replay, partial refund and concurrent checkout retries.
7. Implement seller allocation, reconciliation, refund workflows and access-controlled admin audit logs.
8. Complete security, privacy, marketplace, tax and other applicable professional reviews.
9. Run a controlled end-to-end test before enabling a production feature flag.

## Current implementation boundary

The current branch has a preliminary transaction-intent ledger and an authenticated Edge Function. It deliberately returns gateway_ready: false and money_moved: false. The migration has not been applied to production, provider credentials are not configured, and verified provider webhooks/settlement/reconciliation are not implemented. Do not treat this document as evidence that payments are ready to launch.