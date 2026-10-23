import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const checkoutSource = fs.readFileSync(new URL("../checkout.js", import.meta.url), "utf8");

function makeElement(id) {
  const classes = new Set();
  if (["authGate", "checkoutForm", "success"].includes(id)) classes.add("hidden");
  return {
    id, value: "", textContent: "", innerHTML: "", hidden: false, disabled: false,
    checked: false, style: {}, dataset: {}, onclick: null, onsubmit: null,
    classList: {
      add(name) { classes.add(name); },
      remove(name) { classes.delete(name); },
      contains(name) { return classes.has(name); }
    },
    addEventListener() {},
    querySelector(selector) {
      if (id === "addressForm" && selector === 'button[type="submit"]') return this.saveButton;
      return null;
    }
  };
}

function createHarness(options = {}) {
  const storage = new Map();
  storage.set("doodhwala-cart", JSON.stringify({
    "provider-1:milk-1": {
      providerId: "provider-1",
      productId: "milk-1",
      milk: "Cow milk",
      provider: "Staging seller",
      unitPrice: 50,
      qty: 2
    }
  }));
  const elements = new Map();
  const getElement = (id) => {
    if (!elements.has(id)) elements.set(id, makeElement(id));
    return elements.get(id);
  };

  const address = {
    id: "staging-address-001",
    user_id: "staging-customer-001",
    recipient_name: "Test Customer",
    phone: "9876543210",
    address_line: "Original lane",
    area_name: "Test Area",
    city: "Ahmedabad",
    pin_code: "380001",
    latitude: 23.0225,
    longitude: 72.5714,
    is_default: true
  };

  const calls = { addressUpdates: [], addressInserts: [], rpc: [] };
  let createOrderAttempts = 0;
  const supabase = {
    auth: { async getUser() { return { data: { user: { id: "staging-customer-001", email: "test@example.invalid", user_metadata: {} } }, error: null }; } },
    from(table) {
      assert.equal(table, "addresses");
      let operation = "read";
      let row = null;
      const filters = {};
      const builder = {
        select() { return this; },
        order() { return this; },
        eq(key, value) { filters[key] = value; return this; },
        limit() {
          const matches = !filters.user_id || filters.user_id === address.user_id;
          return Promise.resolve({ data: matches ? [structuredClone(address)] : [], error: null });
        },
        update(value) { operation = "update"; row = value; return this; },
        insert(value) { operation = "insert"; row = value; return this; },
        single() {
          if (operation === "update") {
            assert.equal(filters.id, address.id);
            assert.equal(filters.user_id, address.user_id);
            calls.addressUpdates.push(structuredClone(row));
            Object.assign(address, structuredClone(row));
            return Promise.resolve({ data: structuredClone(address), error: null });
          }
          if (operation === "insert") {
            calls.addressInserts.push(structuredClone(row));
            return Promise.resolve({ data: { ...structuredClone(row), id: "staging-address-new" }, error: null });
          }
          return Promise.resolve({ data: structuredClone(address), error: null });
        }
      };
      return builder;
    },
    async rpc(name, args) {
      calls.rpc.push({ name, args: structuredClone(args) });
      if (name === "customer_order_payment_controls_ready") {
        return { data: { ready: options.paymentControlsReady !== false }, error: null };
      }
      if (name === "create_order" || name === "create_order_with_promo") {
        createOrderAttempts += 1;
        if (options.failFirstRpc && createOrderAttempts === 1) throw new Error("simulated network interruption");
        return { data: "staging-order-001", error: null };
      }
      if (name === "customer_check_provider_direct_upi") return { data: true, error: null };
      if (name === "customer_set_order_payment_method") return { data: { order_id: args.p_order_id, payment_method: args.p_method }, error: null };
      return { data: "staging-order-001", error: null };
    }
  };

  const localStorage = {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); },
    removeItem(key) { storage.delete(key); }
  };
  const resilience = {
    readObjectStorage(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (_) { return fallback; }
    },
    writeStorage(key, value) { localStorage.setItem(key, JSON.stringify(value)); },
    removeItem(key) { localStorage.removeItem(key); }
  };
  const window = {
    DoodhwalaResilience: resilience,
    addEventListener() {}
  };
  const document = { getElementById: getElement, querySelector() { return { value: "cod" }; } };
  const Doodhwala = { configured: true, supabase };
  window.Doodhwala = Doodhwala;

  const context = vm.createContext({
    window, document, Doodhwala, localStorage,
    crypto: { randomUUID() { return "stable-test-idempotency-key"; } },
    console: { warn() {}, error() {}, log() {} },
    structuredClone,
    setTimeout, clearTimeout
  });
  vm.runInContext(checkoutSource, context, { filename: "checkout.js" });

  return { elements, getElement, storage, localStorage, address, calls, context };
}

async function settle() {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

async function testCheckoutFailsClosedWhenPaymentControlsMissing() {
  const h = createHarness({ paymentControlsReady: false });
  await settle();

  await h.getElement("placeOrder").onclick();

  assert.equal(h.calls.rpc.filter(call => call.name === "customer_order_payment_controls_ready").length, 1, "checkout must check backend payment controls first");
  assert.equal(h.calls.rpc.filter(call => call.name === "create_order" || call.name === "create_order_with_promo").length, 0, "checkout must not create an order if payment controls are missing");
  assert.equal(h.calls.rpc.filter(call => call.name === "customer_set_order_payment_method").length, 0, "payment choice must not be attempted without readiness");
  assert.equal(h.storage.has("doodhwala-cart"), true, "cart must remain intact when the readiness gate fails");
  assert.equal(h.getElement("success").classList.contains("hidden"), true, "missing payment controls must never show order success");
  assert.match(h.getElement("checkoutState").textContent, /No order has been placed/, "checkout should clearly say that no order was created");
}

async function testAddressUpdateAndSuccessfulOrder() {
  const h = createHarness();
  await settle();

  assert.equal(h.getElement("checkoutForm").classList.contains("hidden"), false, "signed-in customer should see checkout");
  assert.equal(h.getElement("addressLine").value, "Original lane", "existing address should load");

  h.getElement("addressLine").value = "Updated lane, House 12";
  await h.getElement("addressForm").onsubmit({ preventDefault() {} });

  assert.equal(h.calls.addressUpdates.length, 1, "editing an address should update the existing row");
  assert.equal(h.calls.addressInserts.length, 0, "editing should not create a duplicate address");
  assert.equal(h.calls.addressUpdates[0].address_line, "Updated lane, House 12");

  await h.getElement("placeOrder").onclick();
  assert.equal(h.calls.rpc.filter(call => call.name === "create_order").length, 1, "one provider should produce one create-order RPC");
  assert.equal(h.calls.rpc[0].name, "customer_order_payment_controls_ready", "payment controls must be checked before an order is created");
  assert.equal(h.calls.rpc[0].args, undefined, "readiness check should not need customer-supplied order data");
  assert.equal(h.calls.rpc[1].name, "create_order");
  assert.equal(h.calls.rpc[2].name, "customer_set_order_payment_method");
  assert.equal(h.calls.rpc[2].args.p_method, "cod");
  assert.equal(h.calls.rpc[1].args.p_address_id, "staging-address-001", "order should use the saved address ID");
  assert.equal(h.getElement("success").classList.contains("hidden"), false, "successful order should show the success state");
  assert.match(h.getElement("successText").textContent, /staging-order-001/);
  assert.equal(h.storage.has("doodhwala-cart"), false, "cart should clear after confirmed order creation");
}

async function testRetryKeepsIdempotencyKeyAndCart() {
  const h = createHarness({ failFirstRpc: true });
  await settle();

  await h.getElement("placeOrder").onclick();
  assert.equal(h.calls.rpc.filter(call => call.name === "create_order").length, 1, "first attempt should call create-order once");
  assert.equal(h.getElement("placeOrder").disabled, false, "button should unlock after a failed request");
  assert.equal(h.storage.has("doodhwala-cart"), true, "cart must be preserved after an uncertain network result");
  assert.equal(h.getElement("success").classList.contains("hidden"), true, "a failed request must not show order success");

  const storedKeys = JSON.parse(h.storage.get("doodhwala-checkout-idempotency-v1"));
  const orderCallsAfterFirstAttempt = h.calls.rpc.filter(call => call.name === "create_order");
  const firstKey = orderCallsAfterFirstAttempt[0].args.p_idempotency_key;
  assert.equal(storedKeys["provider-1"].key, firstKey, "idempotency key should persist after an uncertain request");

  await h.getElement("placeOrder").onclick();
  const orderCallsAfterRetry = h.calls.rpc.filter(call => call.name === "create_order");
  assert.equal(orderCallsAfterRetry.length, 2, "retry should attempt the order again");
  assert.equal(orderCallsAfterRetry[1].args.p_idempotency_key, firstKey, "retry must reuse the same idempotency key");
  assert.equal(h.getElement("success").classList.contains("hidden"), false, "second successful attempt should show order confirmation");
  assert.equal(h.storage.has("doodhwala-cart"), false, "cart should clear only after a confirmed successful attempt");
}

await testCheckoutFailsClosedWhenPaymentControlsMissing();
await testAddressUpdateAndSuccessfulOrder();
await testRetryKeepsIdempotencyKeyAndCart();
console.log("Checkout flow simulation passed: address update, successful order, and idempotent network retry.");
