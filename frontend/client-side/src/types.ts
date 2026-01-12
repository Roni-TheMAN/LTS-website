// frontend/src/types.ts
// NOTE: This file intentionally contains both legacy product types and the new
// cart primitives (tier-based pricing, Stripe-ready).

// ---------------------------------------------------------------------------
// Legacy catalog types (still used by some UI components)
// ---------------------------------------------------------------------------
export interface PricingTier {
  quantity: number;
  price: number;
}

export interface Variant {
  id: string;
  name: string;
  skuSuffix: string;
  inStock: boolean;
  pricingTiers: PricingTier[];
}

export interface Product {
  id: string;
  name: string;
  category: string;
  categoryCode: string;
  price: number;
  originalPrice?: number;
  rating?: number;
  reviews?: number;
  image: string;
  description: string;
  features?: string[];
  inStock?: boolean;
  isNew?: boolean;
  isSale?: boolean;
  images?: string[]; // For gallery
  specifications?: Record<string, string>;
  variants?: Variant[];
}

// ---------------------------------------------------------------------------
// Cart types (tier-based pricing, cents-first)
// ---------------------------------------------------------------------------

export type CurrencyCode = string; // e.g. "usd"

export type CartItemKind = "product" | "keycard";

/**
 * A tier is a quantity range with a unit price (in cents). Stripe price id is optional.
 *
 * Products: qty = units
 * Keycards: qty = boxes
 */
export interface CartPriceTier {
  min_qty: number;
  max_qty: number | null; // null = and up
  unit_amount_cents: number;
  currency?: CurrencyCode;
  stripe_price_id?: string | null;
}

export interface CartItemBase {
  id: string;
  kind: CartItemKind;
  title: string;
  description?: string | null;
  image_url?: string | null;
  images?: string[];
  quantity: number;
  currency: CurrencyCode;
  tiers: CartPriceTier[];

  // Legacy aliases (so older UI code doesn't instantly break)
  name: string;
  image: string | null;
  /** Unit price in dollars (avoid using this for calculations). */
  price: number;

  // Derived/normalized fields (kept in state so UI stays dumb)
  unit_amount_cents: number;
  stripe_price_id: string | null;
}

export interface CartProductItem extends CartItemBase {
  kind: "product";
  product_id: number;
  variant_id: number;
  sku?: string | null;
  brand_name?: string | null;
  category_name?: string | null;
  stripe_product_id?: string | null;
}

export interface CartKeycardItem extends CartItemBase {
  kind: "keycard";
  design_id: number;
  lock_tech_id: number;
  cards_per_box: number;
  meta?: Record<string, any>;
}

export type CartItem = CartProductItem | CartKeycardItem;

/**
 * Minimal payload needed to add something to the cart.
 * Quantity is passed separately (so callers can reuse the same draft).
 */
export type CartAddItem =
    | Omit<
    CartProductItem,
    "quantity" | "unit_amount_cents" | "stripe_price_id" | "currency" | "name" | "image" | "price"
> & {
  currency?: CurrencyCode;
}
    | Omit<
    CartKeycardItem,
    "quantity" | "unit_amount_cents" | "stripe_price_id" | "currency" | "name" | "image" | "price"
> & {
  currency?: CurrencyCode;
};

export interface CartContextType {
  items: CartItem[];
  addToCart: (item: CartAddItem, quantity?: number) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  subtotal_cents: number;
  /** Back-compat: subtotal in dollars (avoid floating use in new code). */
  cartTotal: number;
  itemCount: number;

  clearCart: () => void;

  /** Stripe-ready line items (only includes items that currently have a stripe_price_id). */
  toStripeLineItems?: () => Array<{ price: string; quantity: number }>;
}

// ---------------------------------------------------------------------------
// Navigation types
// ---------------------------------------------------------------------------
export type PageName =
    | "HOME"
    | "PRODUCTS"
    | "PRODUCT_DETAIL"
    | "CART"
    | "CHECKOUT"
    | "SUPPORT"
    | "PRIVACY_POLICY"
    | "TERMS_OF_SERVICE"
    | "KEYCARDS"
    | "SOLUTIONS";

export interface NavigationState {
  page: PageName;
  params?: any;
}

export interface NavigationContextType {
  currentPage: NavigationState;
  navigate: (page: PageName, params?: any) => void;
}
