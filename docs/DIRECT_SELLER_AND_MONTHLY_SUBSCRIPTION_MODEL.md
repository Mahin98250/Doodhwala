# Doodhwala Marketplace Payments and Seller Subscription Model

## Product decision

Doodhwala is a marketplace and software/service provider for independent local milk sellers. The customer pays **100% of the order amount directly to the selected milk provider**. Doodhwala does not collect, split, deduct, or hold customer order funds.

Milk providers choose one of two fixed monthly Doodhwala plans: a normal listing or a premium listing with a recommended tag and advertising. The premium price is the full monthly price, not a ₹3,500 add-on to the normal plan. Subscription collection is separate from customer checkout.

## Owner-selected seller plans

| Plan | Monthly price | Included benefit |
| --- | ---: | --- |
| Normal listing | ₹2,000 (200,000 paise) | Seller's name/listing in the app. |
| Recommended + advertising | ₹3,500 (350,000 paise) **total** | Seller's app listing, text-only recommended label and in-app advertising. |

The premium plan replaces the normal plan for the selected period; it is not ₹5,500 per month or an extra ₹3,500 charge. The owner wants the words “Recommended by Doodhwala” in the app. The initial design puts **“Recommended by Doodhwala · Sponsored”** on the seller's existing discovery card, with a short neutral line inviting customers to view milk, prices and delivery details. This is a text-only promotion, not a banner or hidden change to search ranking. Campaign limits and duration, whether tax is included, billing dates, and upgrade/downgrade or proration rules still need approval. Do not activate, bill, promise a placement or collect payment until the separate billing and advertising flows are integrated, tested and approved for launch.

## Customer order payment methods

### Direct UPI
- Show the selected seller's verified display name, UPI ID, and QR/UPI intent for the exact order amount.
- Clearly tell the customer that the money goes to the seller, not Doodhwala.
- Never collect UPI PINs, OTPs, card CVVs, or bank passwords.
- Returning from a UPI app, scanning a QR, or uploading a screenshot does not prove that money reached the seller.
- Keep the order in a pending-payment state until the seller confirms through the supported seller workflow or a trustworthy, authorized payment confirmation integration.
- Store the payment reference with uniqueness protection and an audit trail; do not treat a seller-entered reference as independently bank-verified.
- Seller confirmation must be authenticated and restricted to that seller's own order.

### Cash on Delivery
- The customer pays the seller or the seller's authorized delivery person the full order total.
- Track COD as unpaid until the authorized seller records collection.
- Do not confuse COD collection with payment of the seller's Doodhwala subscription.

## Seller subscription billing

- Maintain a separate seller subscription record with plan, fixed price, billing period, start/end dates, status, invoice/reference, and audit timestamps.
- Configure the owner-selected ₹2,000 and ₹3,500 monthly plans in the separate billing system, in paise. Never put seller-plan prices into customer checkout or imply a plan is active before its terms and implementation are approved.
- Subscription payments are made by the seller to Doodhwala using an explicitly configured method (for example, Doodhwala's own business UPI/bank details) and are reconciled separately.
- A subscription receipt must not mark any customer order as paid, and a customer order payment must not settle a seller subscription.
- Provide a clear invoice/receipt, renewal date, due status, grace period, cancellation process, and seller notification.
- Any suspension for non-payment should follow disclosed terms, preserve seller/order records, and not disrupt orders already accepted without an explicit operational policy.
- Recommended placement and advertising are optional benefits included in the ₹3,500 premium plan. Do not silently charge an extra advertising fee. A paid recommendation or placement must be transparently identified as sponsored, not represented as an independent endorsement.

## Ledger separation

Keep separate records and state machines for:
1. Customer order payments: seller is the payee; Doodhwala does not take a commission.
2. Seller subscription invoices/payments: Doodhwala is the payee; the ₹3,500 premium plan includes its stated advertising benefit.
3. Any separately approved future advertising charge: Doodhwala is the payee, with its own clear terms. There is no separate advertising charge in the two plans selected above.

Never use one ledger row or status field to represent both an order payment and a subscription payment. Use server-derived amounts, authenticated ownership checks, idempotency, append-only audit events, and database constraints for duplicate references and invalid transitions.

## Security and launch gates

- Default to fail-closed: no configured verification means no automated "paid" state.
- Do not claim an automated payment gateway exists unless a real, authorized bank/UPI confirmation integration has been configured and tested.
- Do not use screenshots, customer self-attestation, UPI-app return URLs, or client-side status updates as proof of payment.
- Verify seller identity and ownership before displaying seller payment details.
- Test duplicate submissions, replayed references, wrong amounts, stale/cancelled orders, concurrent status changes, refunds/reversals, audit logs, RLS, and subscription/order ledger isolation in staging.
- Do not apply payment migrations to production until the current database migration state and a tested backup/rollback plan are confirmed.
- Do not promise zero total cost: direct UPI may avoid aggregator percentage fees, but bank/provider terms, business account requirements, taxes, and operational costs still need verification.

## Customer-facing wording

"Pay the full order amount directly to your milk provider. Doodhwala does not deduct a commission from this order. Your provider pays Doodhwala separately for a seller plan. Paid placements are identified as sponsored."

## Current implementation status

This document records the business model; it does not itself enable payments, verify bank transfers, create subscription billing, or activate a production payment provider. The owner has chosen manual confirmation; see the [pilot plan](MANUAL_CONFIRMATION_PILOT.md) for current implementation status, separate billing dependency, operating steps and release gates. Existing payment backend readiness must be verified in staging before launch.
