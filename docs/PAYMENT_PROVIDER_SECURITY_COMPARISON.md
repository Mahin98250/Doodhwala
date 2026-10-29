# Doodhwala payment provider security comparison and integration gate

**Prepared:** 2026-10-29  
**Scope:** Provider selection and safe integration design only.  
**Decision status:** No provider selected; no gateway activated; no production migration/deployment or real payment performed.

## 1. Repository audit snapshot

Audited current `main` at `dba11d39ae149d0b57fb36003da7d9330aba8b0b`, including:

- `supabase/functions/doodhwala-pay/index.ts`
- `supabase/migrations/20261022120000_doodhwala_pay_foundation.sql`
- `supabase/migrations/20261022133000_doodhwala_pay_event_ledger.sql`
- `supabase/migrations/20261022150000_doodhwala_direct_seller_payments.sql`
- `supabase/migrations/20261023150000_doodhwala_payment_audit_and_reference_guard.sql`
- `scripts/test-doodhwala-pay.mjs`
- `scripts/test-doodhwala-pay-state.mjs`
- `PAYMENT_SECURITY_READINESS.md`
- `DIRECT_UPI_PAYMENT_FLOW.md`
- `docs/payment-gateway-audit-and-zero-fee-plan.md`

### Source-confirmed findings

1. `doodhwala-pay` authenticates the Supabase user, scopes orders and status lookup to that user, calculates amount from the stored order, checks payable order states, and uses an idempotency key.
2. The payment ledger has a customer/idempotency uniqueness constraint and is intended for server-only writes.
3. The Edge Function deliberately fails closed for online collection: `gateway_ready: false`, `money_moved: false`, and `payment_provider_setup_required`. No provider create-order/capture integration or verified provider webhook handler is present in this function.
4. Direct seller UPI constructs a UPI intent/QR and seller confirmation is manual attestation, not independent bank verification.
5. Existing tests are largely source-contract assertions. They are not a provider sandbox run, live schema verification, adversarial authorization test, or penetration test.
6. Previous `PAYMENT_SECURITY_READINESS.md` recorded a read-only live Supabase snapshot from 2026-10-23 where the payment migrations and `doodhwala-pay` function were not deployed. That is historical evidence only; re-check current deployment state before any release.
7. Provider monthly billing PRs are separate seller-to-Doodhwala billing functionality and must not be mixed into customer order payment collection.

## 2. Provider comparison (security-first, subject to underwriting)

| Option | Marketplace fit | Settlement model | Security / verification capability | Cost note | Main gate |
|---|---|---|---|---|---|
| Razorpay Payment Gateway + Route | Strong candidate for a marketplace with multiple sellers | Route supports linked accounts and controlled transfers/splits; product access and settlement rules require approval | Server-side payment APIs, payment/transfer events and webhooks can support a verified state machine | Standard gateway fees plus Route/transfer charges and GST may apply; get a written quote | Confirm Doodhwala's marketplace model, seller onboarding/KYC, UPI support, refunds/disputes, settlement and pricing in writing |
| Cashfree Payments + Easy Split | Strong candidate for marketplace/vendor settlement | Easy Split describes vendor onboarding, split logic and scheduled settlement | Provider APIs/webhooks and reconciliation can support server-side verification; exact product capabilities and event coverage need sandbox proof | Processing fees and any split/payout/settlement fees depend on contract; get written quote | Confirm marketplace eligibility, UPI support, seller onboarding, refund/reversal behavior, settlement cycles and total pricing |
| Acquiring bank / bank-supported merchant UPI integration | Potentially strong if a bank explicitly supports this business model | Direct settlement may be possible under the bank's merchant arrangement | Can be robust when the bank provides authenticated server-side status inquiry/callbacks and reconciliation files | Pricing and integration complexity are bank-specific; not automatically zero-fee | Obtain written bank confirmation of merchant/marketplace model, settlement, APIs, callback authenticity, support and compliance responsibilities |
| Existing direct-to-seller UPI + COD | Useful limited fallback, not an automated gateway | UPI funds go directly to seller; COD settled at delivery | No independent automated bank verification in current flow; seller-entered reference is evidence for manual review only | Avoids a gateway processing fee in this direct flow but has manual effort, reconciliation and fraud risk | Clearly label pending/manual verification; never auto-mark paid from redirect, screenshot or customer-submitted reference |

### Official references checked

- Razorpay Route marketplace/split-transfer product: https://razorpay.com/route/
- Cashfree Easy Split: https://www.cashfree.com/easy-split/split-payment-gateway/
- RBI Payment Aggregator Directions, 2025: https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=12896
- RBI list/reference of authorised payment aggregators: https://systemhealth.rbi.org.in/Scripts/PublicationsView.aspx_id%3D12043.html

These references establish product claims at a high level, not Doodhwala eligibility or current contract terms. Before selecting a provider, confirm its current RBI authorisation/status from the RBI source and the exact contracted legal entity; product pages and a listed licence do not guarantee the marketplace feature is approved for this account.

## 3. Recommendation

**Shortlist Razorpay Route and Cashfree Easy Split for a written, security-focused evaluation; do not choose based on headline processing fees alone.** Ask both providers the same questions and compare the total cost and operational obligations. Keep bank integration as a third path if an acquiring bank will explicitly support the marketplace and offer verifiable status APIs.

No provider is selected yet. Provider access, seller onboarding/KYC, account approval, product availability, pricing, supported payment methods and settlement arrangements must be confirmed directly.

### Questions required before choosing

1. Will you onboard a local milk marketplace where independent sellers fulfil orders and receive settlement, while Doodhwala does not hold seller funds?
2. Is UPI supported for this exact marketplace product, including server-verifiable payment status?
3. What seller KYC and bank-account verification are required, and who owns the compliance process?
4. Can the seller receive settlement directly, and can funds be held/reversed/refunded through approved product flows?
5. Which webhook events are emitted for authorization, capture, failure, refund, reversal, dispute and transfer settlement?
6. How is webhook authenticity verified? Is a signature computed over the exact raw request body? What retry/replay guarantees and event IDs exist?
7. How do idempotency keys work for order creation, payment capture, refunds and transfers?
8. What are all charges: processing, UPI, marketplace/split, transfer/payout, refunds, chargebacks, GST, minimums and settlement?
9. What are the sandbox limits, support SLAs, incident escalation route and reconciliation report formats?
10. What contractual, RBI, tax, consumer-protection, privacy and marketplace obligations remain with Doodhwala?

## 4. Required integration architecture

Keep the provider-specific code behind a server-side adapter. Browser code must never possess provider secrets and must never declare a payment successful.

1. **Create attempt:** authenticated customer requests payment for a payable order. Server loads the order, verifies customer/order/seller state and amount, stores amount in integer paise and creates an idempotent attempt.
2. **Provider order/session:** server uses secret credentials to create a provider order with a unique merchant reference and metadata linking to the internal attempt. Never trust client amount, seller ID, currency or success state.
3. **Checkout:** client uses the provider's supported checkout/UPI flow. No card data, CVV, UPI PIN, OTP or bank credentials are stored by Doodhwala.
4. **Webhook inbox:** receive raw bytes, verify the provider signature before parsing, enforce body-size and timestamp/replay policy, persist unique provider event ID, acknowledge only after durable acceptance, then process asynchronously/idempotently.
5. **Verify before paid:** verify provider account, merchant order ID, payment ID, amount, INR currency, final captured/settled state as appropriate, and internal order mapping using trusted server-side provider data. Browser redirects are informational only.
6. **Atomic transition:** in a database transaction, lock the payment attempt, deduplicate provider payment/event IDs, enforce allowed state transitions and update order payment status only once. Never regress a captured payment on a late failure event.
7. **Reconciliation:** compare internal ledger to provider settlement/reconciliation reports; alert on missing, duplicate, amount-mismatched or reversed transactions.
8. **Refund/dispute path:** idempotent refund requests, authorized roles, explicit refund-pending/refunded/failed states, immutable audit trail and customer-visible status.
9. **Observability:** structured logs with secrets/tokens/payment credentials redacted, correlation IDs, alerting, provider outage handling and documented incident procedures.
10. **Feature gate:** live collection stays disabled until sandbox, role-boundary, database, operational, contractual and compliance gates are approved.

## 5. Security tests required before a sandbox can pass

- Cross-customer order/payment status lookup denied; cross-seller settlement/action denied.
- Tampered amount, currency, seller, order reference, unknown order state and expired attempt rejected.
- Same idempotency key/same request returns same attempt; same key/different terms returns conflict.
- Concurrent duplicate webhooks and duplicate provider event/payment IDs have one effect only.
- Invalid signature, wrong provider account, malformed body, stale/replayed event and mismatched amount are rejected/quarantined.
- Redirect/screenshot/client payload cannot mark paid.
- Late/out-of-order failure event cannot downgrade captured state.
- Refund retry cannot double-refund; refund and reversal transitions are auditable.
- Provider timeout leaves a truthful pending/unknown status and supports safe server-side status reconciliation.
- RLS/grants deny browser writes to payment ledgers and webhook inbox.
- Logs never expose credentials or payment secrets.
- Disposable PostgreSQL and synthetic sandbox fixtures only; no real-money tests.

## 6. Explicit non-actions and current release status

- No provider selected or credentials requested.
- No payment migration applied and no Edge Function deployed by this work.
- No staging or production configuration/data changed.
- No billing, ads, customer payment, or seller settlement activated.
- No real payment initiated.

**Status: BLOCKED for real-money launch.** Next implementation step after provider selection: build the adapter and webhook receiver against the provider sandbox on a dedicated branch, extend disposable PostgreSQL tests, then request review. A passing test suite is necessary but not a certification or independent penetration test.


## 7. Follow-up official-document review (2026-10-29)

A second review of provider-owned pages adds two decision-critical caveats:

- **Razorpay Route eligibility is not a given.** Razorpay's current Route documentation/terms state a minimum annual turnover condition of ₹40 lakh for third-party settlements (or ₹5 lakh annual export turnover where applicable), alongside requirements that the linked account directly interface with the customer and additional Route compliance checks. Doodhwala must not assume eligibility from a standard gateway account. Get written confirmation from Razorpay for this exact local-milk marketplace and legal entity before treating Route as viable. References: https://razorpay.com/terms/ and https://razorpay.com/route/ .
- **Cashfree Easy Split has relevant documented APIs** for vendor creation/management, order-level split or split-after-payment, refund, vendor settlement details and reconciliation. This is a good fit at the feature level, but does not prove Doodhwala's account/business model will be approved. Confirm product activation, marketplace eligibility, seller onboarding/KYC, UPI flow and all fees with Cashfree. Reference: https://www.cashfree.com/docs/api-reference/payments/latest/split/easy-split-overview .
- Cashfree documents webhook signature verification and server-side order/payment status retrieval. Implement using the current provider SDK/spec and raw request bytes; never use a browser redirect as the final source of truth. References: https://www.cashfree.com/devstudio/preview/pg/tools/webhookVerification and https://www.cashfree.com/devstudio/preview/pg/web/checkout .
- RBI's public authorised-PA listing includes both Cashfree Payments India Private Limited and Razorpay's prior operating entity, but Razorpay's own notice says the online payment aggregation business transfer to Razorpay Payments Private Limited was operationalised from 1 January 2026. Verify the **current contracting legal entity and its applicable RBI authorisation** directly at onboarding, rather than relying on an old listing entry. References: https://systemhealth.rbi.org.in/Scripts/PublicationsView.aspx_id%3D12043.html and https://razorpay.com/notice/ .

### Refined recommendation (not a final selection)

Given the Route turnover/eligibility gate, **request written marketplace eligibility and total-cost information from Cashfree Easy Split first, and ask Razorpay to confirm Route eligibility in parallel**. Do not implement either provider's production adapter until one confirms in writing that it supports Doodhwala's exact model. This ordering is an evaluation priority, not a statement that Cashfree is approved or objectively safer. Security should be judged by documented webhook/status semantics, seller verification, refund/reversal lifecycle, reconciliation and operational support—not by brand reputation alone.
