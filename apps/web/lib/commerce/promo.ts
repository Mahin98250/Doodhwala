// Keep promo checkout disabled until the backend implements and tests both preview
// and atomic redemption. This is a fail-closed feature gate, not a permanent product decision.
export const PROMO_CHECKOUT_ENABLED = false;
export const PROMO_CHECKOUT_UNAVAILABLE_MESSAGE =
  "Promo codes are temporarily unavailable while server-side validation is completed. You can still place your order at the displayed price.";
