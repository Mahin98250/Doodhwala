# Doodhwala payment gateway audit and zero-fee plan

**Audit date:** 2026-10-23  
**Scope:** repository code-search results, known Supabase deployment audit, and public YOUPI PG V2 README/package metadata. This is not a full source-code security audit.

## Finding: Doodhwala does not currently have a verified, working payment gateway

Repository code search did not find a payment gateway implementation. The previous read-only Supabase audit also found that `payment_transactions`, `payment_provider_events`, `provider_payment_settings`, `customer_order_payment_controls_ready()`, `customer_set_order_payment_method(uuid,text)`, and the `doodhwala-pay` Edge Function were absent in the live project at audit time. A subscription payment ledger schema was proposed in PR #48, but that schema alone does not collect or verify money.

Therefore do not label the existing app as having an integrated gateway. Recheck main and the live project before release because repository and deployment state can change.

## YOUPI PG V2 reference assessment

Reference repository: https://github.com/youpi-pg/YouPI-PG

The README describes a self-hosted UPI checkout with direct-to-bank payment, QR/deep links, a FIFO single-payment slot, and bank SMS / Android notification / Gmail observers. Critically, its own README calls it an **experimental research project**, says it is not certified or bank/NPCI approved, warns against business-critical or high-volume production use, and says to independently verify every payment and confirm legal/bank requirements. Its package metadata declares a **Commercial** license. Do not copy or bundle its code unless the license and rights explicitly permit it; using public source as an architectural reference is different from copying its implementation.

Zero aggregator fee does not mean zero operating cost, zero fraud risk, or regulatory approval. Bank-alert parsing can be delayed, spoofed, duplicated, misattributed when amounts collide, or fail silently. A frontend success callback or an HMAC-signed webhook from an untrusted/incorrect source is not proof of settlement.

## Cost-first design for Doodhwala

### Phase 1 — lowest-cost, lower-complexity choices
1. **Cash on delivery (COD):** no online processing fee; record collection at delivery and reconcile seller cash.
2. **Direct-to-seller UPI:** show a seller-verified UPI ID and payment QR/deep link. Funds go directly to the seller, avoiding a marketplace aggregator fee in this flow. Start with an explicit pending/manual confirmation workflow; do not automatically fulfil just because the browser returns from a UPI app or the customer uploads a screenshot.
3. **Pay per delivery / weekly / monthly:** these are settlement schedules, not payment rails. They can use COD or direct UPI and keep a per-order/per-period ledger.
4. **Advance payment:** enable only when there is a reliable reconciliation path and clear refund/cancellation policy. For direct UPI, initially require seller reconciliation; do not promise instant automated confirmation.

### Phase 2 — automated confirmation
Before automatic payment confirmation, evaluate one of:
- a bank/acquirer-approved merchant UPI integration with a documented server-side status API/webhook; or
- a carefully isolated YOUPI-style experiment only after source review, license review, written bank/account permission, legal/compliance review, and threat-model testing.

Do not deploy the experimental SMS/Gmail observer design as Doodhwala's sole payment source of truth. Do not collect card numbers, CVV, UPI PINs, OTPs, or bank login credentials in Doodhwala.

### Payment invariants required before production
- Use integer paise for all money calculations.
- Create a server-side payment intent bound to one order/subscription, exact amount, currency, seller, and expiry.
- Idempotency for intent creation and callback/event processing.
- Verify amount, receiving beneficiary, event authenticity, freshness/replay, order state, and unique transaction reference server-side.
- Deduplicate events with a unique provider event/transaction ID; safely handle retries and out-of-order events.
- Never trust client-supplied `paid` status, return URL, screenshots, or unverified SMS/email content.
- Keep immutable payment events plus a reconciliation ledger; separate payment status from order fulfilment.
- Handle partial payment, duplicate payment, failed payment, refunds, cancellation, disputes, and manual review.
- Restrict payment-setting changes to verified seller owners and protect secrets in server-side environment settings.
- Add rate limits, audit logs, alerting, backups, access controls, and tests for concurrent/replayed callbacks.
- Confirm the business model and any applicable RBI/NPCI, bank/acquirer, privacy, tax, consumer-protection, and payment-aggregation requirements with qualified advisers. This document is not legal advice.

## Decision

Build Doodhwala's own **payment orchestration and ledger**, not a claim of being a bank, UPI network, or regulated payment aggregator. Initially offer COD and direct seller UPI with transparent pending/manual reconciliation. Keep an adapter boundary so a verified bank/acquirer or other permitted provider can be added later. Treat a fully automated zero-fee UPI flow as an experiment until it passes security, operational, licensing, and compliance gates.

No production database, payment account, or gateway has been activated by this document.
