import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const checkoutSource = fs.readFileSync(new URL("../checkout.js", import.meta.url), "utf8");
const ORDER_RPC = "customer_create_order_with_payment";
let idempotencySequence = 0;

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
  const storage = options.storage || new Map();
  const defaultCart = {
    "provider-1:milk-1": {
      providerId: "provider-1", productId: "milk-1", milk: "Cow milk",
      provider: "Staging seller", unitPrice: 50, qty: 2
    }
  };
  if (!storage.has("doodhwala-cart")) storage.set("doodhwala-cart", JSON.stringify(options.cart || defaultCart));
  const elements = new Map();
  const getElement = id => {
    if (!elements.has(id)) elements.set(id, makeElement(id));
    return elements.get(id);
  };
  const userId = options.userId || "staging-customer-001";
  const address = {
    id: "staging-address-001", user_id: userId, recipient_name: "Test Customer",
    phone: "9876543210", address_line: "Original lane", area_name: "Test Area",
    city: "Ahmedabad", pin_code: "380001", latitude: 23.0225, longitude: 72.5714,
    is_default: true
  };
  const calls = { addressUpdates: [], addressInserts: [], rpc: [] };
  let createOrderAttempts = 0;
  const failedProviders = options.failedProviders || new Set();
  const serverOrdersByIdempotencyKey = options.serverOrdersByIdempotencyKey || new Map();
  const lockState = options.lockState || { held: false };
  const paymentChoice = { value: options.paymentMethod || "cod" };

  const supabase = {
    auth: { async getUser() { return { data: { user: { id: userId, email: "test@example.invalid", user_metadata: {} } }, error: null }; } },
    from(table) {
      assert.equal(table, "addresses");
      let operation = "read";
      let row = null;
      const filters = {};
      return {
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
    },
    async rpc(name, args) {
      calls.rpc.push({ name, args: structuredClone(args) });
      if (name === "customer_order_payment_controls_ready") return { data: { ready: options.paymentControlsReady !== false }, error: null };
      if (name === "customer_check_provider_direct_upi") return { data: options.sellerUpiReady !== false, error: null };
      if (name !== ORDER_RPC) throw new Error("unexpected RPC: " + name);

      createOrderAttempts += 1;
      if (options.blockOrderRpc) await options.blockOrderRpc;
      if (options.failFirstRpc && createOrderAttempts === 1) throw new Error("simulated network interruption");
      if (options.failProviderOnce === args.p_provider_id && !failedProviders.has(args.p_provider_id)) {
        failedProviders.add(args.p_provider_id);
        throw new Error("simulated provider-specific network interruption");
      }
      if (options.rejectAtomicOrder) return { data: null, error: { message: "seller_direct_upi_not_configured" } };
      const key = args.p_idempotency_key;
      let order = serverOrdersByIdempotencyKey.get(key);
      if (order && order.payment_method !== args.p_payment_method) return { data: null, error: { message: "payment_method_already_selected" } };
      if (!order) {
        order = {
          order_id: "staging-order-" + String(serverOrdersByIdempotencyKey.size + 1).padStart(3, "0"),
          status: options.initialOrderStatus || "placed",
          payment_method: args.p_payment_method,
          payment_status: options.initialPaymentStatus || (args.p_payment_method === "direct_upi" ? "payment_pending_verification" : "cash_on_delivery")
        };
        serverOrdersByIdempotencyKey.set(key, order);
      }
      options.afterCommit?.(storage);
      if (options.failAfterCommit && !failedProviders.has("after-commit")) {
        failedProviders.add("after-commit");
        throw new Error("response lost after commit");
      }
      if (options.malformedResponse) return { data: { order_id: order.order_id }, error: null };
      return { data: structuredClone(order), error: null };
    }
  };

  const localStorage = {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) {
      if (options.storageUnavailable || options.failStorageWrite?.(key, String(value), storage)) throw new Error("storage denied");
      storage.set(key, String(value));
    },
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
  const window = { DoodhwalaResilience: resilience, addEventListener() {} };
  const document = { getElementById: getElement, querySelector(selector) {
    if (selector.includes(":checked")) return paymentChoice;
    const method = selector.match(/\[value="(cod|direct_upi)"\]/)?.[1];
    return method ? { set checked(value) { if (value) paymentChoice.value = method; } } : null;
  } };
  const Doodhwala = { configured: true, supabase };
  window.Doodhwala = Doodhwala;
  const navigator = options.noWebLocks ? {} : { locks: { async request(name, config, callback) {
    assert.equal(name, "doodhwala-checkout-v1");
    assert.equal(config.ifAvailable, true);
    if (lockState.held) return callback(null);
    lockState.held = true;
    try { return await callback({ name }); } finally { lockState.held = false; }
  } } };
  const context = vm.createContext({
    window, document, Doodhwala, localStorage, navigator,
    crypto: { randomUUID() { idempotencySequence += 1; return "stable-test-idempotency-key-" + idempotencySequence; } },
    console: { warn() {}, error() {}, log() {} }, structuredClone, setTimeout, clearTimeout
  });
  vm.runInContext(checkoutSource, context, { filename: "checkout.js" });
  return { getElement, storage, address, calls, context, paymentChoice, serverOrdersByIdempotencyKey, failedProviders };
}

async function settle() {
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
}
const orderCalls = h => h.calls.rpc.filter(call => call.name === ORDER_RPC);

async function testFailsClosedWhenPaymentControlsMissing() {
  const h = createHarness({ paymentControlsReady: false });
  await settle();
  await h.getElement("placeOrder").onclick();
  assert.equal(orderCalls(h).length, 0);
  assert.equal(h.storage.has("doodhwala-cart"), true);
  assert.equal(h.getElement("success").classList.contains("hidden"), true);
  assert.match(h.getElement("checkoutState").textContent, /No new order was submitted/);
}

async function testAddressUpdateAndSuccessfulCod() {
  const h = createHarness();
  await settle();
  assert.equal(h.getElement("checkoutForm").classList.contains("hidden"), false);
  h.getElement("addressLine").value = "Updated lane, House 12";
  await h.getElement("addressForm").onsubmit({ preventDefault() {} });
  assert.equal(h.calls.addressUpdates.length, 1);
  assert.equal(h.calls.addressInserts.length, 0);
  await h.getElement("placeOrder").onclick();
  assert.equal(orderCalls(h).length, 1);
  assert.equal(h.calls.rpc[0].name, "customer_order_payment_controls_ready");
  assert.equal(orderCalls(h)[0].args.p_payment_method, "cod");
  assert.equal(orderCalls(h)[0].args.p_address_id, "staging-address-001");
  assert.equal(h.calls.rpc.some(call => call.name === "customer_set_order_payment_method"), false);
  assert.equal(h.getElement("success").classList.contains("hidden"), false);
  assert.match(h.getElement("successText").textContent, /staging-order-001/);
  assert.deepEqual(JSON.parse(h.storage.get("doodhwala-cart")), {});
}

async function testDirectUpiKeepsSellerAttestationTruthful() {
  const h = createHarness({ paymentMethod: "direct_upi" });
  await settle();
  await h.getElement("placeOrder").onclick();
  assert.equal(orderCalls(h)[0].args.p_payment_method, "direct_upi");
  assert.ok(h.calls.rpc.some(call => call.name === "customer_check_provider_direct_upi"));
  assert.match(h.getElement("successText").textContent, /Only the seller can confirm receipt/);
  assert.doesNotMatch(h.getElement("successText").textContent, /payment (?:is )?(?:successful|verified|complete)/i);
}

async function testRetryAfterLostCommittedResponse() {
  const h = createHarness({ failAfterCommit: true, paymentMethod: "direct_upi" });
  await settle();
  await h.getElement("placeOrder").onclick();
  assert.equal(h.serverOrdersByIdempotencyKey.size, 1, "server committed one atomic order");
  assert.equal(h.storage.has("doodhwala-cart"), true);
  assert.equal(h.getElement("success").classList.contains("hidden"), true);
  assert.match(h.getElement("checkoutState").textContent, /could not confirm.*Check Orders/i);
  const firstKey = orderCalls(h)[0].args.p_idempotency_key;
  assert.equal(JSON.parse(h.storage.get("doodhwala-checkout-idempotency-v1"))["provider-1"].key, firstKey);

  const paused = createHarness({ storage: h.storage, serverOrdersByIdempotencyKey: h.serverOrdersByIdempotencyKey, paymentControlsReady: false, paymentMethod: "direct_upi" });
  await settle();
  await paused.getElement("placeOrder").onclick();
  assert.match(paused.getElement("checkoutState").textContent, /earlier attempt may have created an order/i);
  assert.doesNotMatch(paused.getElement("checkoutState").textContent, /No order has been placed/i);

  const retry = createHarness({ storage: h.storage, failedProviders: h.failedProviders, serverOrdersByIdempotencyKey: h.serverOrdersByIdempotencyKey, sellerUpiReady: false });
  await settle();
  assert.equal(retry.paymentChoice.value, "direct_upi", "reload restores the earlier payment choice");
  await retry.getElement("placeOrder").onclick();
  assert.equal(orderCalls(retry)[0].args.p_idempotency_key, firstKey, "reload must reuse the same request key");
  assert.equal(retry.calls.rpc.some(call => call.name === "customer_check_provider_direct_upi"), false, "availability preflight must not block recovery of a committed order");
  assert.equal(retry.serverOrdersByIdempotencyKey.size, 1, "retry must return the existing order");
  assert.equal(retry.getElement("success").classList.contains("hidden"), false);
  assert.match(retry.getElement("successText").textContent, /staging-order-001/);
}

async function testMultiProviderPartialFailureRetainsOrderTrail() {
  const cart = {
    "provider-1:milk-1": { providerId: "provider-1", productId: "milk-1", milk: "Cow milk", provider: "Seller One", unitPrice: 50, qty: 2 },
    "provider-2:milk-2": { providerId: "provider-2", productId: "milk-2", milk: "Buffalo milk", provider: "Seller Two", unitPrice: 60, qty: 1 }
  };
  const h = createHarness({ cart, failProviderOnce: "provider-2" });
  await settle();
  await h.getElement("placeOrder").onclick();
  const firstPass = orderCalls(h);
  assert.deepEqual(firstPass.map(call => call.args.p_provider_id), ["provider-1", "provider-2"]);
  const remainingCart = JSON.parse(h.storage.get("doodhwala-cart"));
  assert.equal(remainingCart["provider-1:milk-1"], undefined);
  assert.ok(remainingCart["provider-2:milk-2"]);
  assert.match(h.getElement("checkoutState").textContent, /staging-order-001/);
  assert.match(h.getElement("checkoutState").textContent, /could not confirm/i);
  assert.deepEqual(JSON.parse(h.storage.get("doodhwala-checkout-progress-v1")).orderIds, ["staging-order-001"]);

  const retry = createHarness({ storage: h.storage, failedProviders: h.failedProviders, serverOrdersByIdempotencyKey: h.serverOrdersByIdempotencyKey, failProviderOnce: "provider-2" });
  await settle();
  await retry.getElement("placeOrder").onclick();
  const all = [...orderCalls(h), ...orderCalls(retry)];
  assert.deepEqual(all.map(call => call.args.p_provider_id), ["provider-1", "provider-2", "provider-2"]);
  assert.equal(all[2].args.p_idempotency_key, all[1].args.p_idempotency_key);
  assert.match(retry.getElement("successText").textContent, /2 seller orders/);
  assert.match(retry.getElement("successOrders").innerHTML, /staging-order-001/);
  assert.match(retry.getElement("successOrders").innerHTML, /staging-order-002/);
  assert.deepEqual(JSON.parse(h.storage.get("doodhwala-cart")), {});
  assert.equal(h.storage.has("doodhwala-checkout-progress-v1"), false);
}

async function testRecoveryAcrossEveryLocalWriteBoundary() {
  const failures = {
    "save confirmed key": (key, value) => key === "doodhwala-checkout-idempotency-v1" && Object.values(JSON.parse(value)).some(entry => entry.confirmedOrderId),
    "save confirmed progress": (key, value, storage) => key === "doodhwala-checkout-progress-v1" && JSON.parse(value).orderIds.length > 0 && !JSON.parse(value).pendingCartFingerprint && Object.keys(JSON.parse(storage.get("doodhwala-cart"))).length > 0,
    "prepare cart transition": (key, value) => key === "doodhwala-checkout-progress-v1" && Boolean(JSON.parse(value).pendingCartFingerprint),
    "remove completed seller from cart": (key, value) => key === "doodhwala-cart" && Object.keys(JSON.parse(value)).length === 0,
    "finish cart transition": (key, value, storage) => key === "doodhwala-checkout-progress-v1" && JSON.parse(value).orderIds.length > 0 && !JSON.parse(value).pendingCartFingerprint && Boolean(JSON.parse(value).pendingProviderKeys) && Object.keys(JSON.parse(storage.get("doodhwala-cart"))).length === 0,
    "clear pending marker": (key, value, storage) => key === "doodhwala-checkout-progress-v1" && JSON.parse(value).orderIds.length > 0 && !JSON.parse(value).pendingProviderKeys && Boolean(JSON.parse(storage.get("doodhwala-checkout-progress-v1")).pendingProviderKeys) && Object.keys(JSON.parse(storage.get("doodhwala-cart"))).length === 0,
    "clear confirmed key": (key, value, storage) => key === "doodhwala-checkout-idempotency-v1" && Object.keys(JSON.parse(value)).length === 0 && Object.keys(JSON.parse(storage.get("doodhwala-cart"))).length === 0
  };
  for (const [label, predicate] of Object.entries(failures)) {
    let failed = false;
    const h = createHarness({ failStorageWrite(key, value, storage) {
      if (!failed && predicate(key, value, storage)) { failed = true; return true; }
      return false;
    } });
    await settle();
    await h.getElement("placeOrder").onclick();
    assert.ok(failed, label + ": the intended write must fail");
    assert.equal(h.serverOrdersByIdempotencyKey.size, 1, label + ": the order exists on the server");
    assert.equal(h.getElement("success").classList.contains("hidden"), true, label + ": do not claim a fully recovered checkout");
    assert.match(h.getElement("checkoutState").textContent, /staging-order-001/);
    const firstKey = orderCalls(h)[0].args.p_idempotency_key;

    const retry = createHarness({ storage: h.storage, serverOrdersByIdempotencyKey: h.serverOrdersByIdempotencyKey });
    await settle();
    await retry.getElement("placeOrder").onclick();
    assert.equal(retry.getElement("success").classList.contains("hidden"), false, label + ": reload can recover");
    assert.match(retry.getElement("successOrders").innerHTML, /staging-order-001/);
    assert.equal(retry.serverOrdersByIdempotencyKey.size, 1, label + ": no duplicate order");
    if (orderCalls(retry).length) assert.equal(orderCalls(retry)[0].args.p_idempotency_key, firstKey, label + ": retry reuses key");
    assert.deepEqual(JSON.parse(retry.storage.get("doodhwala-checkout-idempotency-v1")), {});
  }
}

async function testInterruptedMultiSellerCartTransition() {
  const cart = {
    "provider-1:milk-1": { providerId: "provider-1", productId: "milk-1", milk: "Cow milk", provider: "Seller One", unitPrice: 50, qty: 2 },
    "provider-2:milk-2": { providerId: "provider-2", productId: "milk-2", milk: "Buffalo milk", provider: "Seller Two", unitPrice: 60, qty: 1 }
  };
  let failed = false;
  const h = createHarness({ cart, failStorageWrite(key, value, storage) {
    if (!failed && key === "doodhwala-checkout-progress-v1" && JSON.parse(value).orderIds.length === 1 && !JSON.parse(value).pendingCartFingerprint && Object.keys(JSON.parse(storage.get("doodhwala-cart"))).length === 1) {
      failed = true; return true;
    }
    return false;
  } });
  await settle();
  await h.getElement("placeOrder").onclick();
  assert.equal(failed, true);
  assert.equal(orderCalls(h).length, 1);
  assert.ok(JSON.parse(h.storage.get("doodhwala-checkout-progress-v1")).pendingCartFingerprint);
  assert.deepEqual(Object.keys(JSON.parse(h.storage.get("doodhwala-cart"))), ["provider-2:milk-2"]);

  const retry = createHarness({ storage: h.storage, serverOrdersByIdempotencyKey: h.serverOrdersByIdempotencyKey });
  await settle();
  await retry.getElement("placeOrder").onclick();
  assert.deepEqual(orderCalls(retry).map(call => call.args.p_provider_id), ["provider-2"]);
  assert.equal(retry.serverOrdersByIdempotencyKey.size, 2);
  assert.match(retry.getElement("successOrders").innerHTML, /staging-order-001/);
  assert.match(retry.getElement("successOrders").innerHTML, /staging-order-002/);
  assert.deepEqual(JSON.parse(retry.storage.get("doodhwala-checkout-idempotency-v1")), {});
}

async function testAlreadyPaidAndTerminalRecoveryMessaging() {
  const paid = createHarness({ paymentMethod: "direct_upi", initialPaymentStatus: "paid_direct_to_seller" });
  await settle();
  await paid.getElement("placeOrder").onclick();
  assert.match(paid.getElement("successText").textContent, /Check each order's payment status before paying/);
  assert.doesNotMatch(paid.getElement("successText").textContent, /open the order to pay/i);

  const terminal = createHarness({ initialOrderStatus: "cancelled" });
  await settle();
  await terminal.getElement("placeOrder").onclick();
  assert.equal(terminal.getElement("success").classList.contains("hidden"), true);
  assert.match(terminal.getElement("checkoutState").textContent, /already cancelled/);
  assert.ok(terminal.storage.has("doodhwala-cart"));
  const previousKey = orderCalls(terminal)[0].args.p_idempotency_key;
  const retry = createHarness({ storage: terminal.storage, serverOrdersByIdempotencyKey: terminal.serverOrdersByIdempotencyKey });
  await settle();
  await retry.getElement("placeOrder").onclick();
  assert.notEqual(orderCalls(retry)[0].args.p_idempotency_key, previousKey);
  assert.equal(retry.serverOrdersByIdempotencyKey.size, 2);
  assert.equal(retry.getElement("success").classList.contains("hidden"), false);
}

async function testStorageAndServerErrorsNeverShowSuccess() {
  const unavailable = createHarness({ storageUnavailable: true });
  await settle();
  await unavailable.getElement("placeOrder").onclick();
  assert.equal(orderCalls(unavailable).length, 0, "do not submit without durable recovery storage");
  assert.match(unavailable.getElement("checkoutState").textContent, /browser storage/);

  for (const [key, value] of [
    ["doodhwala-checkout-idempotency-v1", "{broken-json"],
    ["doodhwala-checkout-idempotency-v1", JSON.stringify({ "provider-1": {} })],
    ["doodhwala-checkout-progress-v1", "not-json"]
  ]) {
    const storage = new Map([[key, value]]);
    const corrupted = createHarness({ storage });
    await settle();
    await corrupted.getElement("placeOrder").onclick();
    assert.equal(orderCalls(corrupted).length, 0, "corrupt recovery state must not silently generate a new key");
    assert.equal(storage.get(key), value, "corrupt state must be preserved for investigation");
    assert.match(corrupted.getElement("checkoutState").textContent, /recovery data is unavailable or damaged/);
  }

  let markerFailed = false;
  const beforeSend = createHarness({ failStorageWrite(key, value) {
    if (!markerFailed && key === "doodhwala-checkout-progress-v1" && JSON.parse(value).pendingProviderKeys) { markerFailed = true; return true; }
    return false;
  } });
  await settle();
  await beforeSend.getElement("placeOrder").onclick();
  assert.equal(markerFailed, true);
  assert.equal(orderCalls(beforeSend).length, 0, "do not submit until both recovery records are saved");
  const savedKey = JSON.parse(beforeSend.storage.get("doodhwala-checkout-idempotency-v1"))["provider-1"].key;
  const afterMarkerFailure = createHarness({ storage: beforeSend.storage, serverOrdersByIdempotencyKey: beforeSend.serverOrdersByIdempotencyKey });
  await settle();
  await afterMarkerFailure.getElement("placeOrder").onclick();
  assert.equal(orderCalls(afterMarkerFailure)[0].args.p_idempotency_key, savedKey);

  const lost = createHarness({ failAfterCommit: true });
  await settle();
  await lost.getElement("placeOrder").onclick();
  assert.equal(lost.serverOrdersByIdempotencyKey.size, 1);
  assert.ok(JSON.parse(lost.storage.get("doodhwala-checkout-progress-v1")).pendingProviderKeys);
  lost.storage.set("doodhwala-checkout-idempotency-v1", "{}");
  const missingKey = createHarness({ storage: lost.storage, serverOrdersByIdempotencyKey: lost.serverOrdersByIdempotencyKey });
  await settle();
  await missingKey.getElement("placeOrder").onclick();
  assert.equal(orderCalls(missingKey).length, 0, "a missing primary key must not generate a duplicate after a lost response");
  assert.match(missingKey.getElement("checkoutState").textContent, /recovery data is unavailable or damaged/);

  const rejected = createHarness({ paymentMethod: "direct_upi", rejectAtomicOrder: true });
  await settle();
  await rejected.getElement("placeOrder").onclick();
  assert.equal(rejected.serverOrdersByIdempotencyKey.size, 0);
  assert.equal(rejected.storage.has("doodhwala-cart"), true);
  assert.equal(rejected.getElement("success").classList.contains("hidden"), true);
  assert.match(rejected.getElement("checkoutState").textContent, /Check Orders/);

  const malformed = createHarness({ malformedResponse: true });
  await settle();
  await malformed.getElement("placeOrder").onclick();
  assert.equal(malformed.storage.has("doodhwala-cart"), true);
  assert.equal(malformed.getElement("success").classList.contains("hidden"), true);
  assert.match(malformed.getElement("checkoutState").textContent, /could not be confirmed/i);
}

async function testCrossTabLockAndCartRefresh() {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const lockState = { held: false };
  const first = createHarness({ lockState, blockOrderRpc: pending });
  const second = createHarness({ storage: first.storage, lockState, serverOrdersByIdempotencyKey: first.serverOrdersByIdempotencyKey });
  await settle();
  const firstSubmit = first.getElement("placeOrder").onclick();
  await settle();
  await second.getElement("placeOrder").onclick();
  assert.equal(orderCalls(second).length, 0, "a second tab cannot submit while the first tab owns the lock");
  assert.match(second.getElement("checkoutState").textContent, /another tab/);
  release();
  await firstSubmit;
  assert.equal(first.serverOrdersByIdempotencyKey.size, 1);
  await second.getElement("placeOrder").onclick();
  assert.equal(orderCalls(second).length, 0, "a stale second tab must not resubmit the completed cart");
  assert.match(second.getElement("checkoutState").textContent, /cart changed in another tab/);
  assert.equal(second.getElement("checkoutTotal").textContent, "₹0", "stale totals must clear with the cart");

  const changedDuringRequest = createHarness({ afterCommit(storage) {
    const latest = JSON.parse(storage.get("doodhwala-cart"));
    latest["provider-2:milk-2"] = { providerId: "provider-2", productId: "milk-2", milk: "Buffalo milk", provider: "Second seller", unitPrice: 60, qty: 1 };
    storage.set("doodhwala-cart", JSON.stringify(latest));
  } });
  await settle();
  await changedDuringRequest.getElement("placeOrder").onclick();
  const preserved = JSON.parse(changedDuringRequest.storage.get("doodhwala-cart"));
  assert.ok(preserved["provider-1:milk-1"] && preserved["provider-2:milk-2"], "a cart changed while the request was in flight must not be overwritten");
  assert.equal(changedDuringRequest.getElement("success").classList.contains("hidden"), true);
  assert.match(changedDuringRequest.getElement("checkoutState").textContent, /Order staging-order-001 exists/);
  await changedDuringRequest.getElement("placeOrder").onclick();
  assert.equal(orderCalls(changedDuringRequest).length, 1, "changed-cart retry cannot silently submit another order");
  assert.match(changedDuringRequest.getElement("checkoutState").textContent, /cart changed in another tab/);

  const unsupported = createHarness({ noWebLocks: true });
  await settle();
  await unsupported.getElement("placeOrder").onclick();
  assert.equal(orderCalls(unsupported).length, 0, "browsers without cross-tab locking must fail closed");
  assert.match(unsupported.getElement("checkoutState").textContent, /cannot safely protect checkout/);
}

async function testCrossAccountPendingKeyDoesNotLeakOrderId() {
  const storage = new Map([
    ["doodhwala-checkout-idempotency-v1", JSON.stringify({ "provider-1": { key: "previous-test-idempotency-key", userId: "another-user", confirmedOrderId: "private-order-id" } })]
  ]);
  const h = createHarness({ storage, userId: "current-user" });
  await settle();
  await h.getElement("placeOrder").onclick();
  assert.equal(orderCalls(h).length, 0);
  assert.match(h.getElement("checkoutState").textContent, /another account/);
  assert.doesNotMatch(h.getElement("checkoutState").textContent, /private-order-id/);
}

await testFailsClosedWhenPaymentControlsMissing();
await testAddressUpdateAndSuccessfulCod();
await testDirectUpiKeepsSellerAttestationTruthful();
await testRetryAfterLostCommittedResponse();
await testMultiProviderPartialFailureRetainsOrderTrail();
await testRecoveryAcrossEveryLocalWriteBoundary();
await testInterruptedMultiSellerCartTransition();
await testAlreadyPaidAndTerminalRecoveryMessaging();
await testStorageAndServerErrorsNeverShowSuccess();
await testCrossTabLockAndCartRefresh();
await testCrossAccountPendingKeyDoesNotLeakOrderId();
console.log("Checkout simulations passed: atomic COD/UPI requests, retries, interrupted local writes, multi-seller recovery, cross-tab locking, payment messaging, and account isolation.");
