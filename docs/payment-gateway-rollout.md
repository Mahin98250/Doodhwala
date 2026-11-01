# Doodhwala Pay — test-first rollout plan

## Goal

Add provider-backed online payments to Doodhwala without breaking the existing direct seller UPI or Cash on Delivery paths. The first milestone is a staging-only, provider-test-mode integration. Live payment processing remains disabled until provider onboarding, security review, and explicit approval.

## Current safety boundary

- `doodhwala-pay` is not a live gateway integration. Online methods must continue to fail closed with `503 payment_provider_not_configured`, `gateway_ready: false`, and `money_moved: false` until a real provider adapter is configured and verified.
- Never treat a browser redirect, client-side success callback, screenshot, or customer assertion as proof of payment.
- Only a server-verified provider webhook or a server-to-server provider status lookup can mark an online payment successful.
- Never expose provider secret keys in browser code, logs, repository files, or client-visible error messages.
- Keep COD and seller-direct UPI available independently of the gateway integration.
- Do not run production migrations, change production configuration, enable billing/ads, merge this work, or process real payments without separate explicit approval.

## Phase 0 — confirm marketplace and provider eligibility

Before choosing the provider adapter, document and verify:
- Provider onboarding requirements for an Indian marketplace and whether Doodhwala qualifies.
- Whether the provider supports seller onboarding/linked accounts and direct seller settlements for this exact business model.
- Current gateway and split-settlement fees, GST, refunds, chargebacks, settlement schedules, and any minimum-volume/turnover conditions.
- KYC requirements for Doodhwala and each seller.
- Whether customer funds will settle directly to the relevant seller or pass through a platform-controlled marketplace flow. Do not assume these are interchangeable.
- Test-mode credentials, webhook signing method, webhook retry behavior, and idempotency support.

Preferred initial rollout: test mode first; no live credentials or real transactions.

## Phase 1 — isolate provider integration

Implement a server-only provider adapter behind the existing Doodhwala Pay Edge Function. The browser must never call the provider secret API directly.

Expected server-side operations:
1. Create a provider payment/order using the authoritative server-calculated order amount and currency.
2. Persist a unique internal payment attempt and provider reference with idempotency protection.
3. Return only the minimum safe checkout data needed by the client.
4. Accept provider webhooks and verify the signature against the raw request body before parsing or trusting event data.
5. Deduplicate webhook event IDs and enforce valid payment-state transitions.
6. Confirm status using a server-to-server provider lookup when required by the provider's recommended verification flow.
7. Reconcile pending/failed payments and handle duplicate, delayed, and out-of-order webhook events.
8. Never let the client set `paid`, `verified`, settlement, refund, or provider-signature fields.

No real provider integration should be considered complete until provider documentation and test credentials are available.

## Phase 2 — checkout and order consistency

- Keep payment choices explicit: provider-backed online payment, direct seller UPI, and COD.
- Do not create duplicate orders on double-click, network retry, or browser refresh.
- Do not mark an order paid from a checkout redirect.
- If order creation and provider payment creation cannot be atomic, implement a documented pending-payment state and safe retry/reconciliation path.
- A successful payment must be linked to the correct customer, order, amount, currency, and provider reference.
- Define cancel, expiry, failed payment, duplicate payment, refund, and late webhook behavior before live launch.
- For seller-direct UPI, keep seller manual receipt confirmation; it is not automatically verified by Doodhwala.
- For COD, confirm collection only through the existing authorised seller workflow.

## Phase 3 — staging test matrix

Run against the staging Supabase project and provider sandbox only. Use test accounts and test payment methods. Do not use production credentials or real funds.

| Scenario | Expected result |
| --- | --- |
| Gateway has no provider configuration | Fail closed; no paid status and no provider request |
| Missing/invalid authentication | Request rejected |
| Client submits altered amount/currency/order/customer | Server ignores client amount and rejects mismatched ownership or context |
| Valid sandbox payment | Remains pending until trusted provider verification |
| Forged/invalid webhook signature | Rejected; payment/order unchanged |
| Duplicate webhook event | Idempotent; no duplicate ledger/order transition |
| Out-of-order webhook | No invalid state regression |
| Payment succeeds for wrong amount/order | Not marked paid; flagged for reconciliation |
| Provider timeout/network retry | Safe retry; no duplicate charge/order |
| Failed/cancelled/expired payment | Remains unpaid; order is recoverable or safely cancelled |
| Delayed success after expiry/cancellation | Reconciliation path; never silently resurrect a cancelled order |
| Double-click/refresh on checkout | At most one logical payment attempt per idempotency key |
| Direct seller UPI | Seller details/amount displayed; seller manually confirms receipt |
| COD | Existing COD workflow remains functional |
| Gateway disabled | Direct UPI and COD continue to work |
| Secrets/logging review | No secret keys, UPI PINs, OTPs, or card security codes in client bundles/logs |

Record test evidence, environment, commit SHA, and failures. A source-contract test alone is not an end-to-end test.

## Phase 4 — live-readiness gate

Live mode remains disabled until all items are checked:
- Provider marketplace approval and seller settlement model confirmed in writing.
- Production credentials stored only in the approved secret store.
- Webhook endpoint uses signature verification, event deduplication, and replay protections.
- Database constraints/RLS and payment state transitions reviewed.
- Staging end-to-end tests and reconciliation tests pass.
- Refunds, disputes, settlement accounting, customer support, and legal disclosures are documented.
- Separate explicit approval is given for production configuration and any live transaction.

## Rollback

If any verification fails, disable the online gateway adapter and return the online method to the existing fail-closed response. Do not affect COD or direct seller UPI. Do not delete payment audit records; preserve them for investigation.
