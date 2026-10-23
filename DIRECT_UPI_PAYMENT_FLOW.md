# Direct seller UPI — implementation and release boundary

**Status: MVP implementation in source; real-money readiness is not verified.**

Doodhwala's direct-seller UPI flow is designed so the customer pays the independent milk seller's UPI address directly. Doodhwala does not collect, pool, hold, split, or settle these funds.

## Current flow

1. The seller saves their own UPI ID and exact payee display name in Provider dashboard → Profile → Direct Payments. Direct UPI stays disabled until the seller explicitly enables it.
2. Checkout creates one order per seller. For direct UPI, a server-side RPC checks that each seller has enabled UPI and stores the order as `payment_pending_verification`. Cash on Delivery remains available.
3. The customer opens Orders and taps **Pay seller with UPI**. An order-scoped RPC returns the seller's UPI ID, payee name, and the amount stored on that order.
4. The payment dialog builds a UPI intent and a QR code in the browser. The customer must verify the payee name and amount inside their UPI app before authorising. The dialog does not claim success after the app opens or after the customer returns.
5. The seller checks their own bank/UPI app and uses **Confirm receipt in bank app** only after checking the exact amount arrived. The resulting `paid_direct_to_seller` status is a seller attestation, not a bank-verified event.
6. COD remains `cash_on_delivery` until the order is delivered and the seller confirms cash collection.

## Security invariants

- No UPI PIN, OTP, bank password, card number, or CVV is collected by Doodhwala.
- Seller payment settings are not directly readable through table access; customers receive them only via an authenticated order-scoped RPC.
- Order totals are read from the backend, not trusted from browser cart prices.
- Payment status writes must use the ownership-checked RPCs; direct client writes to payment fields are guarded by a database trigger.
- Payment instructions are returned only while the customer's direct-UPI order is still pending verification and not cancelled/rejected.
- Never treat a QR scan, app redirect, customer-submitted reference, or client callback as proof of payment.

## What this is not

This direct UPI flow is **not a self-built bank network or a fully automated payment gateway**. It uses UPI payment instructions to route funds from the customer's UPI app to the seller's UPI address. It has no Doodhwala-side bank settlement feed or signed PSP webhook in this flow. The separate `doodhwala-pay` Edge Function and `payment_transactions` ledger remain a bookkeeping foundation with `gateway_ready: false` and `money_moved: false`; do not present them as a live aggregator integration.

Automated confirmation would require a supported merchant/PSP/bank integration with server-verifiable payment status, signed callbacks/webhooks, replay protection, reconciliation, refund/reversal handling, and appropriate onboarding/reviews. Do not scrape private bank emails/SMS or request banking credentials as a substitute for an official integration.

## Staging release checklist

- [ ] Confirm all migrations from `supabase/migrations/20261022120000_doodhwala_pay_foundation.sql` through `20261022154000_doodhwala_direct_upi_pending_only.sql` are applied to the intended Supabase project in timestamp order.
- [ ] Verify the database functions exist and are executable only by the intended authenticated roles.
- [ ] Use a staging customer and staging seller with test UPI details; do not make real transfers as part of automated tests.
- [ ] Test seller setup disabled/enabled, invalid UPI ID, unavailable seller, multi-seller cart, duplicate checkout retries, cancelled/rejected order, repeated payment clicks, and seller confirmation permission boundaries.
- [ ] Test Android UPI intent handoff and QR scan from a second device; verify exact payee and amount before authorising.
- [ ] Verify customer A cannot read customer B's payment instructions and one seller cannot confirm another seller's order.
- [ ] Verify a customer returning from a UPI app never changes payment status automatically.
- [ ] Verify COD can only be marked collected after delivery.
- [ ] Confirm no secrets are in browser files and no real money movement is claimed until separately verified.

**Release note:** source-level implementation and GitHub review are not proof that the migrations are deployed or that a live payment has succeeded. Keep real-money collection and any automated gateway claim disabled until staging, device, security, and applicable compliance reviews are complete.
