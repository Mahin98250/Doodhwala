export interface CartItem {
  productId: string;
  providerId: string;
  milk: string;
  provider: string;
  unitPrice: number;
  qty: number;
}

export type Cart = Record<string, CartItem>;

const CART_KEY = "doodhwala-cart";
const CHECKOUT_KEYS_KEY = "doodhwala-checkout-idempotency-v1";
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

function objectLike(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function normalizeCart(value: unknown): Cart {
  if (!objectLike(value)) return {};
  const normalized: Cart = {};
  for (const [key, raw] of Object.entries(value).slice(0, 300)) {
    if (!objectLike(raw)) continue;
    const productId = String(raw.productId ?? raw.product_id ?? "");
    const providerId = String(raw.providerId ?? raw.provider_id ?? "");
    const qty = Number(raw.qty ?? raw.quantity);
    const unitPrice = Number(raw.unitPrice ?? raw.unit_price ?? 0);
    if (!UUID.test(productId) || !UUID.test(providerId)) continue;
    if (!Number.isFinite(qty) || qty <= 0 || qty > 100) continue;
    normalized[key] = {
      productId,
      providerId,
      milk: String(raw.milk ?? raw.name ?? "Milk").slice(0, 120),
      provider: String(raw.provider ?? raw.providerName ?? "Local seller").slice(0, 120),
      unitPrice: Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : 0,
      qty: Math.round(qty * 1000) / 1000,
    };
  }
  return normalized;
}

export function cartEntries(cart: Cart): CartItem[] {
  return Object.values(cart).filter((item) => item.qty > 0);
}

export function groupCartByProvider(cart: Cart): Array<[string, CartItem[]]> {
  const groups = new Map<string, CartItem[]>();
  for (const item of cartEntries(cart)) {
    const existing = groups.get(item.providerId) ?? [];
    existing.push(item);
    groups.set(item.providerId, existing);
  }
  return Array.from(groups.entries());
}

export function cartSubtotal(cart: Cart): number {
  return cartEntries(cart).reduce((sum, item) => sum + item.unitPrice * item.qty, 0);
}

export function addCartItem(cart: Cart, item: CartItem): Cart {
  if (!UUID.test(item.productId) || !UUID.test(item.providerId)) return cart;
  if (!Number.isFinite(item.qty) || item.qty <= 0 || item.qty > 100) return cart;
  const key = item.providerId + ":" + item.productId;
  const next = { ...cart };
  const old = next[key];
  next[key] = {
    ...item,
    qty: Math.min(100, Math.round(((old?.qty ?? 0) + item.qty) * 1000) / 1000),
  };
  return next;
}

export function removeCartItem(cart: Cart, key: string): Cart {
  const next = { ...cart };
  delete next[key];
  return next;
}

export function setCartQuantity(cart: Cart, key: string, quantity: number): Cart {
  if (!cart[key]) return cart;
  if (!Number.isFinite(quantity) || quantity <= 0) return removeCartItem(cart, key);
  return { ...cart, [key]: { ...cart[key], qty: Math.min(100, Math.round(quantity * 1000) / 1000) } };
}

export function readCart(): Cart {
  if (typeof window === "undefined") return {};
  try { return normalizeCart(JSON.parse(window.localStorage.getItem(CART_KEY) ?? "{}")); }
  catch { return {}; }
}

export function writeCart(cart: Cart): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(CART_KEY, JSON.stringify(normalizeCart(cart))); }
  catch { /* Storage may be disabled; the UI will still remain usable for this render. */ }
}

export function idempotencyKeyForProvider(providerId: string): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = JSON.parse(window.localStorage.getItem(CHECKOUT_KEYS_KEY) ?? "{}");
    const keys = objectLike(raw) ? raw : {};
    if (typeof keys[providerId] === "string" && keys[providerId]) return String(keys[providerId]);
    const key = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : "checkout-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
    keys[providerId] = key;
    window.localStorage.setItem(CHECKOUT_KEYS_KEY, JSON.stringify(keys));
    return key;
  } catch {
    return "checkout-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  }
}

export function clearProviderCheckoutKey(providerId: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = JSON.parse(window.localStorage.getItem(CHECKOUT_KEYS_KEY) ?? "{}");
    if (!objectLike(raw)) return;
    delete raw[providerId];
    window.localStorage.setItem(CHECKOUT_KEYS_KEY, JSON.stringify(raw));
  } catch { /* Safe to recreate a key if local storage is unavailable. */ }
}
