import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CartAddItem, CartContextType, CartItem, CartPriceTier } from "./types.ts";

const CART_STORAGE_KEY = "legacy_tech_cart"; // keep key stable; we migrate on load

function clampInt(n: unknown, min: number, max: number) {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, Math.floor(x)));
}

function toCents(priceDollars: unknown) {
  const n = typeof priceDollars === "number" ? priceDollars : Number(priceDollars);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n * 100));
}

function normalizeTiers(tiers: CartPriceTier[] | undefined | null): CartPriceTier[] {
  const arr = Array.isArray(tiers) ? tiers : [];
  const cleaned = arr
      .map((t) => ({
        min_qty: clampInt((t as any).min_qty, 1, 1_000_000_000),
        max_qty:
            (t as any).max_qty === undefined || (t as any).max_qty === null
                ? null
                : clampInt((t as any).max_qty, 1, 1_000_000_000),
        unit_amount_cents: clampInt((t as any).unit_amount_cents, 0, 1_000_000_000),
        currency: ((t as any).currency ?? "usd") as string,
        stripe_price_id: ((t as any).stripe_price_id ?? null) as string | null,
      }))
      .filter((t) => Number.isFinite(t.min_qty) && Number.isFinite(t.unit_amount_cents));

  cleaned.sort((a, b) => a.min_qty - b.min_qty);
  return cleaned;
}

function pickTier(tiers: CartPriceTier[], qty: number): CartPriceTier | null {
  if (!tiers.length) return null;
  // assumes tiers sorted by min_qty ASC
  for (let i = tiers.length - 1; i >= 0; i--) {
    const t = tiers[i];
    if (qty >= t.min_qty && (t.max_qty === null || qty <= t.max_qty)) return t;
  }
  // if qty is below first min, fall back to first
  return tiers[0];
}

function normalizeCartItem(item: CartItem): CartItem {
  const quantity = clampInt(item.quantity, 1, 1_000_000_000);
  const tiers = normalizeTiers(item.tiers);
  const currency = (item.currency ?? tiers[0]?.currency ?? "usd") as string;
  const tier = pickTier(tiers, quantity);
  const unit_amount_cents = tier ? tier.unit_amount_cents : 0;

  const title = (item as any).title ?? (item as any).name ?? "Item";
  const image_url = (item as any).image_url ?? (item as any).image ?? null;

  return {
    ...item,
    title,
    name: title,
    image_url,
    image: image_url,
    quantity,
    tiers,
    currency,
    unit_amount_cents,
    price: unit_amount_cents / 100,
    stripe_price_id: (tier?.stripe_price_id ?? null) as string | null,
  } as CartItem;
}

// Best-effort migration from the old cart shape (Product + price in dollars).
function migrateStoredItem(raw: any): CartItem | null {
  if (!raw || typeof raw !== "object") return null;

  // Already new shape?
  if (raw.kind === "product" || raw.kind === "keycard") {
    const base: any = {
      ...raw,
      title: raw.title ?? raw.name ?? "Item",
      currency: raw.currency ?? "usd",
      tiers: raw.tiers ?? [],
      unit_amount_cents: raw.unit_amount_cents ?? 0,
      stripe_price_id: raw.stripe_price_id ?? null,
      image_url: raw.image_url ?? raw.image ?? null,
    };
    return normalizeCartItem(base as CartItem);
  }

  // Legacy cart item
  const legacyId = String(raw.id ?? "");
  const qty = clampInt(raw.quantity, 1, 1_000_000_000);
  const unitCents =
      typeof raw.unit_amount_cents === "number"
          ? clampInt(raw.unit_amount_cents, 0, 1_000_000_000)
          : toCents(raw.price);

  const legacyTiers: CartPriceTier[] = normalizeTiers([
    {
      min_qty: 1,
      max_qty: null,
      unit_amount_cents: unitCents,
      currency: "usd",
      stripe_price_id: null,
    },
  ]);

  const looksLikeKeycard =
      raw.categoryCode === "KEYCARDS" ||
      raw.meta?.lockTechId ||
      String(raw.category ?? "").toLowerCase().includes("keycard");

  if (looksLikeKeycard) {
    const designId = clampInt(raw.meta?.designId ?? raw.design_id, 0, 1_000_000_000);
    const lockTechId = clampInt(raw.meta?.lockTechId ?? raw.lock_tech_id, 0, 1_000_000_000);
    const cardsPerBox = clampInt(raw.meta?.cardsPerBox ?? raw.cards_per_box, 200, 10_000);

    const title = raw.name ?? raw.title ?? "RFID Keycards";
    const image = raw.image ?? null;

    const migrated: CartItem = {
      id: legacyId || `keycard:legacy:${designId}:${lockTechId}`,
      kind: "keycard",
      title,
      name: title,
      description: raw.description ?? null,
      image_url: image,
      image,
      images: Array.isArray(raw.images) ? raw.images : undefined,
      quantity: qty,
      currency: "usd",
      tiers: legacyTiers,
      unit_amount_cents: unitCents,
      price: unitCents / 100,
      stripe_price_id: null,
      design_id: designId,
      lock_tech_id: lockTechId,
      cards_per_box: cardsPerBox,
      meta: raw.meta ?? {},
    };

    return normalizeCartItem(migrated);
  }

  const productId = clampInt(raw.product_id ?? Number.parseInt(String(raw.id ?? ""), 10), 0, 1_000_000_000);
  const variantId = clampInt(raw.variant_id ?? 0, 0, 1_000_000_000);

  const title = raw.name ?? raw.title ?? "Product";
  const image = raw.image ?? null;

  const migrated: CartItem = {
    id: legacyId || `product:legacy:${productId}:${variantId}`,
    kind: "product",
    title,
    name: title,
    description: raw.description ?? null,
    image_url: image,
    image,
    images: Array.isArray(raw.images) ? raw.images : undefined,
    quantity: qty,
    currency: "usd",
    tiers: legacyTiers,
    unit_amount_cents: unitCents,
    price: unitCents / 100,
    stripe_price_id: null,
    product_id: productId,
    variant_id: variantId,
    sku: raw.sku ?? null,
    brand_name: raw.brand ?? raw.brand_name ?? null,
    category_name: raw.category ?? raw.category_name ?? null,
    stripe_product_id: raw.stripe_product_id ?? null,
  };

  return normalizeCartItem(migrated);
}

function loadCartFromStorage(): CartItem[] {
  try {
    const saved = localStorage.getItem(CART_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
        .map(migrateStoredItem)
        .filter(Boolean)
        .map((x) => normalizeCartItem(x as CartItem));
  } catch (e) {
    console.error("Failed to load cart from local storage:", e);
    return [];
  }
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(() => loadCartFromStorage());

  // Persist state to localStorage whenever items change
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error("Failed to save cart to local storage:", e);
    }
  }, [items]);

  const addToCart = useCallback((draft: CartAddItem, quantity = 1) => {
    const addQty = clampInt(quantity, 1, 1_000_000_000);

    setItems((prev) => {
      const idx = prev.findIndex((x) => x.id === draft.id);

      const currency = (draft as any).currency ?? (draft as any).tiers?.[0]?.currency ?? "usd";
      const baseCommon: any = {
        ...draft,
        title: (draft as any).title ?? (draft as any).name ?? "Item",
        image_url: (draft as any).image_url ?? (draft as any).image ?? null,
        currency,
        tiers: normalizeTiers((draft as any).tiers),
      };

      if (idx >= 0) {
        const existing = prev[idx];
        const merged: CartItem = normalizeCartItem({
          ...(existing as any),
          ...baseCommon,
          quantity: existing.quantity + addQty,
        });
        const next = [...prev];
        next[idx] = merged;
        return next;
      }

      const newItem: CartItem = normalizeCartItem({
        ...(baseCommon as any),
        name: baseCommon.title,
        image: baseCommon.image_url ?? null,
        price: 0,
        quantity: addQty,
        unit_amount_cents: 0,
        stripe_price_id: null,
      } as CartItem);

      return [...prev, newItem];
    });
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    try {
      localStorage.removeItem(CART_STORAGE_KEY);
    } catch (e) {
      console.error("Failed to clear cart from local storage:", e);
    }
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    const nextQty = clampInt(quantity, 1, 1_000_000_000);
    setItems((prev) => prev.map((x) => (x.id === id ? normalizeCartItem({ ...x, quantity: nextQty }) : x)));
  }, []);

  const subtotal_cents = useMemo(() => {
    return items.reduce((sum, x) => sum + x.unit_amount_cents * x.quantity, 0);
  }, [items]);

  // Back-compat: dollars subtotal (avoid using this for calculations)
  const cartTotal = useMemo(() => subtotal_cents / 100, [subtotal_cents]);

  const itemCount = useMemo(() => {
    return items.reduce((sum, x) => sum + x.quantity, 0);
  }, [items]);

  const toStripeLineItems = useCallback(() => {
    return items
        .filter((x) => typeof x.stripe_price_id === "string" && x.stripe_price_id.length > 0)
        .map((x) => ({ price: x.stripe_price_id as string, quantity: x.quantity }));
  }, [items]);

  const value = useMemo<CartContextType>(
      () => ({
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        subtotal_cents,
        cartTotal,
        itemCount,
        toStripeLineItems,
      }),
      [items, addToCart, removeFromCart, updateQuantity, clearCart, subtotal_cents, cartTotal, itemCount, toStripeLineItems]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
};
