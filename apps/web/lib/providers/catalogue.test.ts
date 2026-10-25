import assert from "node:assert/strict";
import test from "node:test";
import { filterAndSortProviders, milkTypeLabel, productsForMilkFilter } from "./catalogue.ts";
import type { PublicProvider } from "./normalize";

function provider(
  id: string,
  values: Partial<PublicProvider> = {},
): PublicProvider {
  return {
    id,
    name: `Seller ${id}`,
    description: "Local milk",
    area: "Bhadaj",
    city: "Ahmedabad",
    milkType: "cow",
    rating: null,
    deliveryFrom: null,
    deliveryTo: null,
    distanceKm: null,
    serviceRadiusKm: null,
    isServiceable: null,
    products: [],
    ...values,
  };
}

function product(
  id: string,
  milkType: "cow" | "buffalo" | "a2" | "mixed" | "other",
  pricePerLitre: number | null,
) {
  return {
    id,
    name: `${milkType} ${id}`,
    milkType,
    pricePerLitre,
    dailyAvailable: false,
    unitLabel: "1 L",
  };
}

test("filters sellers by case-insensitive seller, area, city and product search", () => {
  const sellers = [
    provider("1", { name: "Green Dairy", products: [product("p1", "cow", 60)] }),
    provider("2", { name: "Sunrise Milk", area: "Thaltej", products: [product("p2", "buffalo", 70)] }),
  ];

  assert.deepEqual(filterAndSortProviders(sellers, "  GREEN ", "all", "closest").map((x) => x.id), ["1"]);
  assert.deepEqual(filterAndSortProviders(sellers, "thaltej", "all", "closest").map((x) => x.id), ["2"]);
  assert.deepEqual(filterAndSortProviders(sellers, "BUFFALO P2", "all", "closest").map((x) => x.id), ["2"]);
  assert.deepEqual(filterAndSortProviders(sellers, "", "a2", "closest"), []);
});

test("filters visible products and milk-type sellers consistently", () => {
  const seller = provider("1", {
    milkType: "mixed",
    products: [
      product("cow", "cow", 60),
      product("buffalo", "buffalo", 80),
      product("a2", "a2", 90),
    ],
  });

  assert.deepEqual(productsForMilkFilter(seller.products, "cow").map((x) => x.id), ["cow"]);
  assert.deepEqual(productsForMilkFilter(seller.products, "buffalo").map((x) => x.id), ["buffalo"]);
  assert.equal(filterAndSortProviders([seller], "", "cow", "closest").length, 1);
});

test("price sorting uses the currently selected milk type, not unrelated products", () => {
  const cowExpensiveBuffaloCheap = provider("1", {
    milkType: "mixed",
    products: [product("cow", "cow", 80), product("buffalo", "buffalo", 40)],
  });
  const cowCheapBuffaloExpensive = provider("2", {
    milkType: "mixed",
    products: [product("cow", "cow", 50), product("buffalo", "buffalo", 100)],
  });

  assert.deepEqual(
    filterAndSortProviders([cowExpensiveBuffaloCheap, cowCheapBuffaloExpensive], "", "cow", "price").map((x) => x.id),
    ["2", "1"],
  );
  assert.deepEqual(
    filterAndSortProviders([cowExpensiveBuffaloCheap, cowCheapBuffaloExpensive], "", "buffalo", "price").map((x) => x.id),
    ["1", "2"],
  );
});

test("null prices and unknown distances sort after known values; source order is preserved for ties", () => {
  const unknown = provider("unknown", { distanceKm: null, products: [product("p1", "cow", null)] });
  const farther = provider("farther", { distanceKm: 6, products: [product("p2", "cow", 60)] });
  const nearer = provider("nearer", { distanceKm: 2, products: [product("p3", "cow", 60)] });
  const equalDistance = provider("equal", { distanceKm: 2, products: [product("p4", "cow", 70)] });

  assert.deepEqual(filterAndSortProviders([unknown, farther, nearer, equalDistance], "", "all", "closest").map((x) => x.id), ["nearer", "equal", "farther", "unknown"]);
  assert.deepEqual(filterAndSortProviders([unknown, farther, nearer], "", "all", "price").map((x) => x.id), ["farther", "nearer", "unknown"]);
  assert.deepEqual(filterAndSortProviders([unknown, farther, nearer], "", "all", "rating").map((x) => x.id), ["unknown", "farther", "nearer"]);
});

test("milk labels stay human readable", () => {
  assert.equal(milkTypeLabel("cow"), "Cow milk");
  assert.equal(milkTypeLabel("buffalo"), "Buffalo milk");
  assert.equal(milkTypeLabel("a2"), "A2 milk");
  assert.equal(milkTypeLabel("other"), "Local milk");
});

test("does not show a seller under a milk filter when its published products do not match", () => {
  const seller = provider("primary-cow", {
    milkType: "cow",
    products: [product("only-buffalo", "buffalo", 75)],
  });

  assert.deepEqual(filterAndSortProviders([seller], "", "cow", "closest"), []);
  assert.deepEqual(filterAndSortProviders([seller], "buffalo", "cow", "closest"), []);
  assert.deepEqual(filterAndSortProviders([seller], "buffalo", "all", "closest").map((x) => x.id), ["primary-cow"]);
});

test("search respects the currently visible milk type", () => {
  const seller = provider("mixed", {
    milkType: "mixed",
    products: [product("cow", "cow", 60), product("buffalo", "buffalo", 80)],
  });

  assert.deepEqual(filterAndSortProviders([seller], "buffalo", "cow", "closest"), []);
  assert.deepEqual(filterAndSortProviders([seller], "buffalo", "buffalo", "closest").map((x) => x.id), ["mixed"]);
});
