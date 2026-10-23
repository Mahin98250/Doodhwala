# Milk plans and payment options

## Customer flow
1. Choose a seller/product, daily litres, delivery time, start date, and end date (monthly, yearly, or custom).
2. Select a payment preference:
   - **Cash on delivery** — settle per delivery.
   - **Direct UPI to seller** — seller's verified UPI details are shown; the app must not mark it paid just because a customer says they paid.
   - **Pay in full online** — available only after a payment gateway is configured and payment is verified server-side.
   - **Per delivery**, **weekly**, or **monthly** settlement.
3. Submit a request. It remains pending and creates no deliveries until seller approval.
4. Seller accepts or rejects. Rejection must include a reason.
5. Once approved, the system reserves daily supply for the whole date range and creates one scheduled delivery per day. Customers/sellers can pause or cancel according to the agreed policy.

## Capacity and concurrency requirements
- Approval must be an atomic server-side operation. Lock a stable per-provider capacity row, recalculate existing commitments for every affected date, then approve and create delivery rows in the same transaction.
- A uniqueness constraint on (subscription_id, delivery_date) prevents duplicate schedule generation.
- Reject approval if any date exceeds the seller's declared daily capacity; offer a smaller quantity or alternate start date rather than overbooking.
- Pending requests do not reserve stock unless the seller explicitly configures a temporary hold policy.
- Idempotency keys are required for customer submission, approval, and payment callbacks.
- Existing order commitments must be counted alongside subscription deliveries; subscription-only totals are not enough.

## Payment safety
- This migration stores a preference and ledger metadata only. It does **not** charge money or integrate a gateway.
- Never collect card details or UPI PINs in Doodhwala. Gateway payment status must be verified by a signed server-side webhook.
- For direct UPI, display a seller-verified UPI ID/QR and reconcile payment explicitly. Do not claim escrow, refunds, or automated settlement.
- Gateway fees are provider-dependent; no-gateway-fee online payments cannot be promised. Cash on delivery and direct UPI avoid a marketplace gateway charge, though bank/UPI rules may still apply.
- Do not store raw payment credentials. Keep external references non-sensitive.

## Migration status
This is a staged schema proposal in a feature branch. It has not been applied to production. Before rollout, implement and test the trusted atomic approval/schedule RPC, seller ownership mapping, verified payment flow, and customer/seller UI. Apply only after staging migration-history reconciliation and security review.
