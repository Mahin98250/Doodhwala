import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PROMO_CHECKOUT_ENABLED, PROMO_CHECKOUT_UNAVAILABLE_MESSAGE } from "./promo.ts";

test("promo checkout remains disabled until atomic server-side redemption exists", () => {
  assert.equal(PROMO_CHECKOUT_ENABLED, false);
  assert.match(PROMO_CHECKOUT_UNAVAILABLE_MESSAGE, /server-side validation/i);
  assert.match(PROMO_CHECKOUT_UNAVAILABLE_MESSAGE, /displayed price/i);
});

test("checkout clearly disables the unavailable promo controls", () => {
  const checkout = fs.readFileSync(new URL("../../components/checkout-workspace.tsx", import.meta.url), "utf8");
  assert.match(checkout, /Offers coming soon/);
  assert.match(checkout, /disabled={!PROMO_CHECKOUT_ENABLED \|\| busy}/);
  assert.match(checkout, /Promo discounts are disabled until server-side validation/);
  assert.match(checkout, /PROMO_CHECKOUT_ENABLED \? .*Unavailable/);
});
