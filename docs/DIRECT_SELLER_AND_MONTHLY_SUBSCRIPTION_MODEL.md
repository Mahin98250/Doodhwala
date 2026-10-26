# Doodhwala Marketplace Payments and Seller Subscription Model

## Product decision

Doodhwala is a marketplace and software/service provider for independent local milk sellers. The customer pays **100% of the order amount directly to the selected milk provider**. Doodhwala does not collect, split, deduct, or hold customer order funds.

Milk providers pay Doodhwala a separate fixed subscription fee (and, if selected, a separately disclosed advertising fee) for listing, marketplace access, and optional promotion. Subscription collection is separate from customer checkout.

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
- Example plan prices are configuration only; never hard-code a price into checkout or imply a plan is active until its terms are set and approved.
- Subscription payments are made by the seller to Doodhwala using an explicitly configured method (for example, Doodhwala's own business UPI/bank details) and are reconciled separately.
- A subscription receipt must not mark any customer order as paid, and a customer order payment must not settle a seller subscription.
- Provide a clear invoice/receipt, renewal date, due status, grace period, cancellation process, and seller notification.
- Any suspension for non-payment should follow disclosed terms, preserve seller/order records, and not disrupt orders already accepted without an explicit operational policy.
- Advertising is optional, separately priced, and must not be silently added to a subscription.

## Ledger separation

Keep separate records and state machines for:
1. Customer order payments: seller is the payee; Doodhwala does not take a commission.
2. Seller subscription invoices/payments: Doodhwala is the payee.
3. Optional seller advertising invoices/payments: Doodhwala is the payee.

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

"Pay the full order amount directly to your milk provider. Doodhwala does not deduct a commission from this order. Your provider pays Doodhwala separately for their seller subscription or any optional advertising plan."

## Current implementation status

This document records the intended business model; it does not itself enable payments, verify bank transfers, create subscription billing, or activate a production payment provider. Existing payment backend readiness must be verified in staging before launch.
