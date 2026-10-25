import test from "node:test";
import assert from "node:assert/strict";
import { addCartItem, cartSubtotal, groupCartByProvider, normalizeCart, removeCartItem, setCartQuantity } from "./cart.ts";

const p1 = "11111111-1111-4111-8111-111111111111";
const p2 = "22222222-2222-4222-8222-222222222222";
const seller = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const seller2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

test("normalizes only valid IDs and bounded positive quantities", () => {
  const cart = normalizeCart({
    good: { productId: p1, providerId: seller, qty: 2, unitPrice: 55 },
    invalid: { productId: "not-a-uuid", providerId: seller, qty: 1 },
    tooMuch: { productId: p2, providerId: seller, qty: 101 },
  });
  assert.equal(Object.keys(cart).length, 1);
  assert.equal(cart.good.qty, 2);
});

test("groups carts by seller and calculates an indicative subtotal", () => {
  const cart = normalizeCart({
    one: { productId: p1, providerId: seller, qty: 2, unitPrice: 50 },
    two: { productId: p2, providerId: seller, qty: 1, unitPrice: 60 },
    three: { productId: p1, providerId: seller2, qty: 1, unitPrice: 45 },
  });
  assert.equal(groupCartByProvider(cart).length, 2);
  assert.equal(cartSubtotal(cart), 205);
});

test("quantity updates and removals do not mutate the original cart", () => {
  const original = normalizeCart({ one: { productId: p1, providerId: seller, qty: 1, unitPrice: 50 } });
  const increased = setCartQuantity(original, "one", 2);
  const removed = removeCartItem(increased, "one");
  assert.equal(original.one.qty, 1);
  assert.equal(increased.one.qty, 2);
  assert.deepEqual(removed, {});
});

test("adding a product increments its existing seller/product line", () => {
  const first = addCartItem({}, { productId: p1, providerId: seller, milk: "Cow milk", provider: "Local seller", unitPrice: 50, qty: 1 });
  const second = addCartItem(first, { productId: p1, providerId: seller, milk: "Cow milk", provider: "Local seller", unitPrice: 50, qty: 1.5 });
  assert.equal(Object.values(second)[0].qty, 2.5);
});
