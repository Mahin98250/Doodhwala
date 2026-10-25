import type { MilkType, PublicProvider, ProviderProduct } from "./normalize.ts";

export type MilkFilter = "all" | "cow" | "buffalo" | "a2";
export type SortMode = "closest" | "rating" | "price";

export function productsForMilkFilter(
  products: ProviderProduct[],
  filter: MilkFilter,
): ProviderProduct[] {
  if (filter === "all") return products;
  return products.filter((product) => product.milkType === filter);
}

export function matchesMilkFilter(provider: PublicProvider, filter: MilkFilter): boolean {
  if (filter === "all") return true;
  if (provider.products.length > 0) {
    return provider.products.some((product) => product.milkType === filter);
  }
  return provider.milkType === filter;
}

export function filterAndSortProviders(
  providers: PublicProvider[],
  search: string,
  milkFilter: MilkFilter,
  sortMode: SortMode,
): PublicProvider[] {
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filtered = providers.filter((provider) => {
    const searchable = [
      provider.name,
      provider.area,
      provider.city,
      ...productsForMilkFilter(provider.products, milkFilter).map((product) => product.name),
    ].join(" ").toLocaleLowerCase();

    return searchable.includes(normalizedSearch) && matchesMilkFilter(provider, milkFilter);
  });

  return [...filtered].sort((a, b) => {
    if (sortMode === "rating") {
      return (b.rating ?? -1) - (a.rating ?? -1);
    }

    if (sortMode === "price") {
      const aPrices = productsForMilkFilter(a.products, milkFilter)
        .map((product) => product.pricePerLitre)
        .filter((price): price is number => price !== null);
      const bPrices = productsForMilkFilter(b.products, milkFilter)
        .map((product) => product.pricePerLitre)
        .filter((price): price is number => price !== null);
      const aPrice = aPrices.length ? Math.min(...aPrices) : Number.POSITIVE_INFINITY;
      const bPrice = bPrices.length ? Math.min(...bPrices) : Number.POSITIVE_INFINITY;
      return aPrice - bPrice;
    }

    const aDistance = a.distanceKm ?? Number.POSITIVE_INFINITY;
    const bDistance = b.distanceKm ?? Number.POSITIVE_INFINITY;
    return aDistance - bDistance;
  });
}

export function milkTypeLabel(type: MilkType): string {
  if (type === "a2") return "A2 milk";
  if (type === "other") return "Local milk";
  return type === "cow" ? "Cow milk" : type === "buffalo" ? "Buffalo milk" : "Mixed milk";
}
