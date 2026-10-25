/** Shared, platform-neutral domain types. Backend authorization remains authoritative. */

export type UserRole = "customer" | "seller" | "support" | "admin" | "owner";
export type MilkType = "cow" | "buffalo" | "a2" | "mixed" | "other";
export type OrderStatus =
  | "pending"
  | "accepted"
  | "preparing"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export type PaymentMethod = "cash_on_delivery" | "seller_upi";
export type PaymentStatus = "unpaid" | "pending" | "paid" | "failed" | "refunded";

export interface Money {
  /** Integer minor units (paise for INR), never a floating-point total. */
  amountMinor: number;
  currency: "INR";
}

export interface ProductSummary {
  id: string;
  sellerId: string;
  name: string;
  milkType: MilkType;
  pricePerLitre: Money;
  available: boolean;
}

export interface SellerSummary {
  id: string;
  displayName: string;
  area: string | null;
  city: string | null;
  ratingAverage: number | null;
  distanceMetres: number | null;
  serviceable: boolean | null;
  products: ProductSummary[];
}

export interface AddressInput {
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  area: string;
  city: string;
  state: string;
  postalCode: string;
  /** Optional user-consented coordinates; do not log precise coordinates. */
  latitude?: number;
  longitude?: number;
}

export interface CartLineInput {
  productId: string;
  quantityMilliLitres: number;
}

export interface CreateOrderInput {
  idempotencyKey: string;
  addressId: string;
  paymentMethod: PaymentMethod;
  lines: CartLineInput[];
  deliveryInstructions?: string;
}

export interface OrderSummary {
  id: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  total: Money;
  createdAt: string;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export type ApiErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "VALIDATION"
  | "NOT_FOUND"
  | "NOT_SERVICEABLE"
  | "OUT_OF_STOCK"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "UNAVAILABLE";

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  requestId?: string;
}
