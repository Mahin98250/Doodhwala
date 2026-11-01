# Doodhwala Phase 1: direct payments without a payment gateway

## Money flow

1. A customer places a milk order and chooses seller-direct UPI or Cash on Delivery.
2. For UPI, the customer opens their installed UPI app with the seller's UPI ID, payee name, order amount, and order reference prefilled.
3. The customer pays the seller directly. Doodhwala does not receive, route, pool, or hold this order money.
4. The seller checks their own bank/UPI app and confirms receipt in Doodhwala using the transaction reference. This is a seller attestation, not independent bank verification.
5. For COD, the seller collects cash on delivery and confirms it only after delivery.
6. Separately, the seller pays Doodhwala's monthly listing/promoted-listing fee directly to Doodhwala. This is a marketplace subscription/billing ledger, not a deduction from customer order funds.

## Fees and limits

- The Phase 1 order flow does not integrate an online payment gateway, so it avoids a per-order gateway integration charge for direct seller UPI.
- UPI/banking infrastructure or bank/merchant-specific charges may still apply; do not promise that every transfer is free.
- Doodhwala must not describe a seller's confirmation as bank-verified settlement.
- Card, wallet, netbanking, or other online gateway collection must remain disabled until an acquiring provider, credentials, signed webhook verification, and isolated end-to-end tests are in place.

## Current release status (2026-10-29)

- Customer checkout supports direct seller UPI and COD and checks seller UPI readiness before creating orders.
- Orders can retrieve order-scoped seller UPI instructions and launch a UPI app.
- Seller UPI setup and manual receipt confirmation use guarded database RPCs and an immutable payment audit trail.
- Static and rollback-only isolated staging tests have passed for customer/seller authorization, COD constraints, seller billing validation, and fail-closed gateway behavior.
- The separate seller-to-Doodhwala monthly billing implementation is still in PR #71 and remains blocked by merge conflicts. It is not yet considered integrated into the current main branch.
- PR #144 keeps unconfigured gateway methods disabled. No production deployment or real-money test is authorized by this work.

## Release gates

1. Reconcile PR #71 with current main without overwriting newer UI, CI, or security changes.
2. Verify the customer-to-seller UPI/COD UI and seller billing UI together in isolated staging.
3. Confirm no gateway methods appear as available while unconfigured.
4. Re-run security, migration, static, and staging end-to-end checks against the final merged commit.
5. Do not deploy production until those checks pass and production changes are explicitly approved.
