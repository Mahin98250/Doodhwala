import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");
const checkoutHtml = read("checkout.html");
const checkout = read("checkout.js");
const orders = read("orders.js");
const directUpi = read("direct-upi-checkout.js");
const providerHtml = read("provider.html");
const provider = read("provider.js");
const payments = read("supabase/migrations/20261022150000_doodhwala_direct_seller_payments.sql");
const audit = read("supabase/migrations/20261023150000_doodhwala_payment_audit_and_reference_guard.sql");

// Phase 1 is seller-direct UPI/COD, not a Doodhwala-hosted payment gateway.
assert.match(checkoutHtml, /value="direct_upi"/, "checkout must offer seller-direct UPI");
assert.match(checkoutHtml, /value="cod"/, "checkout must offer COD");
assert.match(checkoutHtml, /Doodhwala does not collect or hold seller funds/i, "checkout must explain who receives the funds");
assert.match(checkout, /customer_check_provider_direct_upi/, "UPI checkout must require seller UPI readiness");
assert.match(checkout, /customer_set_order_payment_method/, "chosen method must be saved through the guarded RPC");
assert.match(orders, /customer_get_order_direct_upi/, "order payment must fetch order-scoped seller instructions");
assert.match(orders, /upi:\/\/pay\?pa=/, "customer must be sent to a seller UPI payment URI");
assert.match(orders, /Returning here does not prove payment/, "returning from a UPI app must not be treated as proof of payment");
assert.match(directUpi, /upi:\/\/pay/, "direct UPI helper must use the UPI app protocol");
assert.match(providerHtml, /providerUpiId/, "seller dashboard must expose UPI ID configuration");
assert.match(providerHtml, /providerUpiEnabled/, "seller must explicitly enable direct UPI");
assert.match(provider, /provider_save_direct_upi/, "seller UPI settings must be saved by the authorized RPC");
assert.match(provider, /provider_confirm_direct_upi_payment/, "seller confirmation must use the guarded confirmation RPC");
assert.match(provider, /bank settlement is not independently verified/i, "seller attestation must not be misrepresented as bank verification");
assert.match(payments, /where owner_user_id = auth\.uid\(\)/i, "only the seller owner may configure their UPI details");
assert.match(payments, /where id=p_order_id and customer_id=auth\.uid\(\)/i, "customer payment actions must be order-owner scoped");
assert.match(payments, /where id=p_order_id and provider_owner_id=auth\.uid\(\)/i, "only the order seller may confirm receipt");
assert.match(audit, /payment_audit_events_are_immutable/i, "payment audit events must be immutable");
assert.match(audit, /orders_direct_upi_reference_unique_idx/i, "seller transaction references must not be reused across orders");

console.log("No-gateway customer-to-seller payment contracts passed: direct UPI/COD only, order-scoped instructions, seller-owned confirmation, and auditable references.");
