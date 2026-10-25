export type MilkType = "cow" | "buffalo" | "a2" | "mixed" | "other";

export interface ProviderProduct {
  id: string;
  name: string;
  milkType: MilkType;
  pricePerLitre: number | null;
  dailyAvailable: boolean;
}

export interface PublicProvider {
  id: string;
  name: string;
  area: string;
  city: string;
  milkType: MilkType;
  rating: number | null;
  deliveryFrom: string | null;
  deliveryTo: string | null;
  distanceKm: number | null;
  isServiceable: boolean | null;
  products: ProviderProduct[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown, fallback = ""): string {
  if (typeof value !== "string" && typeof value !== "number") return fallback;
  return String(value).trim().slice(0, 160) || fallback;
}

function numeric(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const result = typeof value === "number" ? value : Number(value);
  return Number.isFinite(result) ? result : null;
}

function milkType(value: unknown): MilkType {
  const normalized = text(value).toLowerCase();
  if (normalized === "cow" || normalized === "buffalo" || normalized === "a2" || normalized === "mixed") {
    return normalized;
  }
  return "other";
}

function time(value: unknown): string | null {
  const normalized = text(value);
  if (!normalized) return null;
  return normalized.slice(0, 5);
}

/** Convert the existing find_nearby_providers_v2 RPC shape into a small public view model. */
export function normalizeProviderRow(value: unknown): PublicProvider | null {
  const row = asRecord(value);
  if (!row) return null;

  const id = text(row.provider_id);
  const name = text(row.provider_name);
  if (!id || !name) return null;

  const rawProducts = Array.isArray(row.products) ? row.products : [];
  const products = rawProducts
    .map((item): ProviderProduct | null => {
      const product = asRecord(item);
      if (!product) return null;

      const productId = text(product.id);
      const productName = text(product.name);
      if (!productId || !productName) return null;

      const rawPrice = numeric(product.price_per_litre);
      const pricePerLitre = rawPrice !== null && rawPrice > 0 ? rawPrice : null;

      return {
        id: productId,
        name: productName,
        milkType: milkType(product.milk_type ?? row.milk_type),
        pricePerLitre,
        dailyAvailable: product.daily_available === true,
      };
    })
    .filter((product): product is ProviderProduct => product !== null);

  const ratingValue = numeric(row.rating_avg);
  const rating = ratingValue !== null && ratingValue >= 0 && ratingValue <= 5 ? ratingValue : null;
  const distanceValue = numeric(row.distance_km);
  const distanceKm = distanceValue !== null && distanceValue >= 0 ? distanceValue : null;

  return {
    id,
    name,
    area: text(row.area_name, "Local area"),
    city: text(row.city),
    milkType: milkType(row.milk_type),
    rating,
    deliveryFrom: time(row.delivery_from),
    deliveryTo: time(row.delivery_to),
    distanceKm,
    isServiceable: typeof row.is_serviceable === "boolean" ? row.is_serviceable : null,
    products,
  };
}
