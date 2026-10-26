import assert from "node:assert/strict";
import test from "node:test";
import { normalizeProviderRow } from "./normalize.ts";

test("normalizes the existing nearby-provider RPC response", () => {
  const provider = normalizeProviderRow({
    provider_id: "provider-123",
    provider_name: "Neighbourhood Dairy",
    area_name: "Bhadaj",
    city: "Ahmedabad",
    milk_type: "cow",
    rating_avg: "4.6",
    delivery_from: "06:00:00",
    delivery_to: "09:00:00",
    distance_km: "1.25",
    is_serviceable: true,
    products: [
      { id: "product-1", name: "Cow milk", price_per_litre: "58", daily_available: true },
      { id: "product-2", name: "Seasonal milk", price_per_litre: null, daily_available: false },
    ],
  });

  assert.ok(provider);
  assert.equal(provider.id, "provider-123");
  assert.equal(provider.name, "Neighbourhood Dairy");
  assert.equal(provider.description, "Fresh local milk from an independent provider.");
  assert.equal(provider.serviceRadiusKm, null);
  assert.equal(provider.rating, 4.6);
  assert.equal(provider.distanceKm, 1.25);
  assert.equal(provider.deliveryFrom, "06:00");
  assert.equal(provider.deliveryTo, "09:00");
  assert.equal(provider.isServiceable, true);
  assert.deepEqual(provider.products, [
    {
      id: "product-1",
      name: "Cow milk",
      milkType: "cow",
      pricePerLitre: 58,
      dailyAvailable: true,
      unitLabel: "1 L",
    },
    {
      id: "product-2",
      name: "Seasonal milk",
      milkType: "cow",
      pricePerLitre: null,
      dailyAvailable: false,
      unitLabel: "1 L",
    },
  ]);
});

test("rejects malformed provider rows instead of rendering incomplete cards", () => {
  assert.equal(normalizeProviderRow(null), null);
  assert.equal(normalizeProviderRow([]), null);
  assert.equal(normalizeProviderRow({ provider_id: "only-an-id" }), null);
  assert.equal(normalizeProviderRow({ provider_name: "Only a name" }), null);
});

test("bounds invalid prices, ratings and distances to safe unavailable values", () => {
  const provider = normalizeProviderRow({
    provider_id: "provider-456",
    provider_name: "Test provider",
    rating_avg: 7.8,
    distance_km: -4,
    is_serviceable: "yes",
    products: [
      { id: "bad-1", name: "Negative price", price_per_litre: -1 },
      { id: "bad-2", name: "Not a number", price_per_litre: "NaN" },
    ],
  });

  assert.ok(provider);
  assert.equal(provider.rating, null);
  assert.equal(provider.distanceKm, null);
  assert.equal(provider.isServiceable, null);
  assert.equal(provider.products[0]?.pricePerLitre, null);
  assert.equal(provider.products[1]?.pricePerLitre, null);
});

test("ignores malformed product entries and non-array product payloads", () => {
  const provider = normalizeProviderRow({
    provider_id: "provider-789",
    provider_name: "Valid provider",
    products: [
      null,
      { id: "missing-name" },
      { name: "missing-id" },
      { id: "ok", name: "Milk", price_per_litre: 61 },
    ],
  });

  assert.ok(provider);
  assert.equal(provider.products.length, 1);
  assert.equal(provider.products[0]?.id, "ok");

  const providerWithoutProducts = normalizeProviderRow({
    provider_id: "provider-790",
    provider_name: "Another provider",
    products: { unexpected: true },
  });

  assert.ok(providerWithoutProducts);
  assert.deepEqual(providerWithoutProducts.products, []);
});
