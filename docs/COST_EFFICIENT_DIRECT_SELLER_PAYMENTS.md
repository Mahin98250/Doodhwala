# DoodhWala: Cost-efficient direct-to-seller payment design

**Status:** Proposed architecture; not a live payment integration  
**Date:** 22 October 2026  
**Business model:** Marketplace; independent milk sellers fulfil orders  
**Goal:** Avoid percentage-based platform payment fees where possible and have customer money go directly to the responsible seller, while keeping order tracking and operational costs low.

## Recommendation

Do not build a custom payment gateway or hold seller funds in DoodhWala. Build the ordering and fulfilment workflow ourselves, and use a seller-owned merchant UPI QR/UPI intent or cash-on-delivery where suitable. The seller is the payee. DoodhWala stores order and payment-status records, not customer bank credentials or UPI PINs.

This is a proposed low-cost MVP. Direct seller UPI payment may avoid a third-party aggregator's percentage fee, but it does not guarantee that every payment is fee-free: applicable merchant classification, transaction value, bank terms, and current rules matter. Verify each seller's account eligibility and acquiring-bank terms before rollout.

## Customer and seller flow

1. Customer selects milk products, quantity, delivery slot/address and submits an order.
2. Server calculates the total from trusted product prices and creates an order with status `placed` and payment status `unpaid` (or `cash_on_delivery` for COD).
3. Seller accepts/rejects the order. If accepted, seller fulfils it through explicit states: `accepted` → `preparing` → `ready` → `out_for_delivery` → `delivered`.
4. For prepaid direct UPI, display the seller's verified UPI payee name and UPI ID/QR, with an order-specific amount and reference where supported. Open the customer's installed UPI app through a UPI intent; never ask the customer to enter a UPI PIN in DoodhWala.
5. Returning from the UPI app is not proof of payment. Keep status `payment_pending_verification` until an authorized confirmation method is available. A customer tapping “I paid” must not mark the order as paid.
6. For MVP without a provider callback, seller verifies receipt in their bank/UPI app and confirms it in the seller dashboard. Record who confirmed it and when. Keep disputes and mismatches reviewable. Do not advertise this as automatic verification.
7. COD orders are confirmed as paid only after the authorized seller/delivery workflow records collection.
8. Notify the customer as the order advances, with clear cancellation and payment-failure paths.

## Payment states (separate from fulfilment states)

- `unpaid`
- `payment_pending_verification`
- `paid_direct_to_seller`
- `cash_on_delivery`
- `payment_failed`
- `refund_or_reversal_review` (manual review until a supported refund process exists)

Only trusted server code or authorized seller/admin actions may change payment status. Use a separate immutable audit trail. Do not allow a client-side redirect, screenshot, UPI app launch, or client-supplied status to set `paid_direct_to_seller`.

## Data and security rules

- Store seller UPI ID/payee name as seller-owned configuration with a verification/review flag; do not accept an arbitrary payee ID from the customer request.
- Calculate price, quantities, delivery fees and totals on the server from trusted catalogue/order data.
- Tie each order to one seller for the MVP, or explicitly split into per-seller suborders before allowing a cart with multiple sellers.
- Use idempotent order creation and payment-attempt records to avoid duplicate orders on retries.
- Verify customer ownership and seller authorization on every order read/write.
- Never collect or store UPI PINs, bank passwords, card PAN/CVV, or UPI-app credentials.
- Keep secrets server-side. Rate-limit order/payment-attempt endpoints and redact personal/payment details from logs.
- Record confirmation source, actor, timestamps, amount and reference where available; avoid storing more banking notification content than necessary.
- Do not mark a payment as verified based only on SMS/email text, a screenshot, or a client callback.
- Keep payment collection and seller payouts separate. Direct-to-seller UPI means DoodhWala should not pool seller funds or imply that it is settling money.

## Cost model

Prefer:
1. No payment gateway SDK or paid API for the MVP.
2. Seller-owned UPI QR/intent for direct payment, after confirming account/merchant terms.
3. COD as an alternative when it suits the seller/customer.
4. Free or already-provisioned hosting/backend tiers, with usage limits monitored.
5. Automated notifications through low-cost channels first; avoid paid SMS/WhatsApp APIs until the unit economics justify them.

Costs that may remain: hosting/database usage, connectivity, notification services, seller's own bank/merchant charges if applicable, support and manual reconciliation. “No percentage fee” must be treated as a target to validate—not a universal promise.

## Trade-offs

**Advantages:** no platform-held funds, potentially avoids aggregator percentage charges, simpler MVP, seller receives money directly, no custom gateway licensing/build burden.

**Limitations:** seller may need to confirm payment manually; customers may pay the wrong seller or wrong amount unless the UI is careful; refunds/reversals require a documented seller process; direct UPI intents do not provide reliable server-side settlement confirmation by themselves; multi-seller carts need separate seller payments or a different supported arrangement.

If DoodhWala later needs fully automatic confirmation, refunds, platform commissions, or seller split settlements, evaluate a provider/bank product that explicitly supports marketplace/direct settlement and compare total fees. Do not bypass applicable payment-system requirements by building an unlicensed payment aggregator.

## Launch gates

- Confirm the seller's bank/account type and applicable merchant UPI terms, including any applicable MDR or charges.
- Have sellers explicitly onboard and confirm the correct payee details.
- Review privacy, terms, cancellation/refund, disputes and seller responsibilities with qualified counsel; policy text remains draft until reviewed.
- Test amount integrity, seller ownership, duplicate order submissions, unauthorized status changes, incorrect payee configuration, failed UPI app launch, abandoned payment, duplicate payment and manual reconciliation.
- Show clear UX copy: “Pay the seller directly. Payment confirmation may require seller verification.” Do not promise instant automatic verification until implemented and tested.

## Official reference

The Ministry of Finance published an MDR FAQ in September 2026 describing which UPI merchant transaction categories remain free and which may attract MDR. Applicable terms depend on the actual transaction and merchant classification. Read the current official guidance: https://financialservices.gov.in/faqs-merchant-discount-rate-mdr-select-upi-p2m-transactions

This design document is engineering guidance, not legal or regulatory advice. It does not certify DoodhWala or any seller as eligible for a specific UPI fee treatment.
