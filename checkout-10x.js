/*
 * Legacy promo checkout is intentionally disabled.
 *
 * An older version intercepted the order button and created promo orders outside
 * the payment-choice transaction. Keep this file harmless even when a cached
 * customer-navigation script loads it. Promo checkout may only return after it
 * has an atomic, authorized server-side implementation and staging tests.
 */
