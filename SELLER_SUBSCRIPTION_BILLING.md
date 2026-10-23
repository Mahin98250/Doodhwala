# Seller subscription billing — product and release specification

**Status: source implementation started in PR #34; not deployed or live.** The migration, seller billing view, owner plan controls, offline collection record flow, audit trail, and static contract test are present on the feature branch. The connected production database has not been changed. Online checkout is deliberately blocked until a real payment provider integration is selected, configured, and verified.

## Business model

Doodhwala charges independent sellers a recurring monthly platform subscription. Customer order money is paid directly to the seller; Doodhwala does not take an order commission.

Initial proposed plans (owner-configurable, not hard-coded commercial promises):

- **Basic — ₹2,000/month:** seller listing and standard marketplace access.
- **Featured — ₹3,000/month:** Basic features plus explicitly defined in-app promotion/featured placement.

The owner/admin must be able to change plan names, prices, duration, included features and whether a plan is available. Price changes apply to new/renewed subscriptions unless a clear, reviewed policy says otherwise; do not silently rewrite an already-paid period.

## Two ways to pay Doodhwala

### 1. Online payment
- Seller chooses a plan and starts checkout.
- Create a durable subscription-payment record with amount in integer paise, currency INR, seller, plan, billing period, status, idempotency key and provider reference.
- Keep it **pending** until a trusted payment-provider server event or a manual owner reconciliation confirms receipt. A browser redirect, screenshot, client callback, UPI app opening, or seller claim is not proof.
- Only a verified successful payment activates/extends the seller's subscription and the featured entitlement.
- Never collect UPI PINs, OTPs, card numbers, CVV or banking passwords.
- Online collection remains **disabled in the current implementation**. Choose and configure a suitable payment provider/acquirer first; credentials must be server-side, with signed webhook verification, replay protection, idempotency, reconciliation and failure/refund handling.

### 2. Offline payment collected by Doodhwala
- Seller selects “Pay offline / request collection”.
- Record the requested amount, seller, plan, billing period and request timestamp.
- An authorized admin records the collection only after actually receiving the money: amount, collection date, method (cash/UPI/bank transfer/other), collector/admin user, receipt/reference (optional), and an audit note.
- Record who marked it paid and when. Sellers cannot mark their own subscription as paid.
- Keep an auditable correction/reversal trail; do not silently delete or overwrite payment history.
- Do not expose internal admin notes or other sellers' billing records.

## Subscription lifecycle

Suggested states: `pending_payment`, `active`, `past_due`, `expired`, `cancelled`, and `suspended`. Payment states are separate: `pending`, `succeeded`, `failed`, `refunded`, and `reversed`.

- Store `starts_at`, `expires_at`, `plan_id`, agreed price snapshot and promotion entitlement.
- Renewal creates a new payment attempt/ledger record; it must be idempotent.
- Expiry removes paid/featured privileges but should not delete seller profile, products or historical orders. Define whether basic listing access continues or pauses before launch.
- Featured placement must be driven by an active paid entitlement, not a client-side toggle.
- Notify sellers before expiry and show payment history/receipts where available.
- Admin views should support filtering by plan, status, expiry, online/offline method and reconciliation state.

## Security and release gates

- Use server-side database functions/RLS for access control. Sellers may read only their own subscription and payment history. Only authorized admins can configure plans or record offline collections.
- Keep an immutable audit trail for plan-price changes, manual collections, status changes and reversals.
- Do not mix seller subscription payments with customer order payments or the existing customer milk-delivery subscriptions.
- This model does not make Doodhwala a payment gateway. Review Indian tax, invoicing, consumer-protection, privacy and any applicable legal requirements with a qualified professional.
- Do not deploy a schema migration to production until it is tested against an isolated staging database and reviewed. The connected Supabase project previously showed that newer payment migrations were not deployed; re-audit before any launch.
- Do not advertise online payment as available until a real provider integration has been configured and end-to-end verified.
