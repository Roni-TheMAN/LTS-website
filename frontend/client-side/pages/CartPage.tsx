import React, { useEffect, useMemo, useState } from "react";
import { useNavigation } from "../src/NavigationContext.tsx";
import { useCart } from "../src/CartContext.tsx";

const moneyFromCents = (cents: number) => {
  const n = (Number(cents) || 0) / 100;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
};

function tierLabel(min: number, max: number | null) {
  if (max === null) return `${min}+`;
  if (min === max) return `${min}`;
  return `${min}–${max}`;
}

const CartPage: React.FC = () => {
  const { navigate } = useNavigation();
  const { items, removeFromCart, updateQuantity, subtotal_cents } = useCart();

  // Change Amount here for tax cal in cart
  const tax_cents = useMemo(() => Math.round(subtotal_cents * 0.15), [subtotal_cents]);
  const total_cents = subtotal_cents + tax_cents;

  // ✅ allow manual typing (draft) + commit on blur/enter
  const [qtyDraft, setQtyDraft] = useState<Record<string, string>>({});
  const [focusedId, setFocusedId] = useState<string | null>(null);

  useEffect(() => {
    setQtyDraft((prev) => {
      const next = { ...prev };

      for (const it of items) {
        const id = String(it.id);
        if (focusedId === id) continue; // don't overwrite while user is typing
        next[id] = String(it.quantity);
      }

      // clean drafts for removed items
      for (const id of Object.keys(next)) {
        if (!items.some((it) => String(it.id) === id)) delete next[id];
      }

      return next;
    });
  }, [items, focusedId]);

  const clampQty = (raw: string) => {
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n)) return 1;
    return Math.max(1, n);
  };

  const commitQty = (id: string) => {
    const qty = clampQty(qtyDraft[id] ?? "1");
    setQtyDraft((d) => ({ ...d, [id]: String(qty) }));
    updateQuantity(id, qty);
  };

  return (
      <div className="bg-gray-50 min-h-screen py-8 lg:px-20 xl:px-40">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-6 flex items-center gap-2 text-sm">
            <button onClick={() => navigate("HOME")} className="text-gray-500 hover:text-blue-600 transition-colors">
              Home
            </button>
            <span className="text-gray-300">/</span>
            <span className="text-gray-900 font-medium">Cart</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 flex flex-col gap-6">
              <div className="flex flex-col gap-2 pb-4 border-b border-gray-200">
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 font-display">Your Cart</h1>
                <p className="text-gray-500">You have {items.length} items in your cart ready for checkout.</p>
              </div>

              {items.length === 0 ? (
                  <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
                    <p className="text-gray-500 text-lg">Your cart is empty.</p>
                    <button onClick={() => navigate("PRODUCTS")} className="mt-4 text-blue-600 font-bold hover:underline">
                      Start Shopping
                    </button>
                  </div>
              ) : (
                  <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-gray-50 text-xs uppercase text-gray-500 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-4 font-semibold tracking-wider w-[50%]">Item</th>
                          <th className="px-6 py-4 font-semibold tracking-wider">Unit</th>
                          <th className="px-6 py-4 font-semibold tracking-wider">Qty</th>
                          <th className="px-6 py-4 font-semibold tracking-wider text-right">Total</th>
                          <th className="px-6 py-4 font-semibold tracking-wider text-center">Action</th>
                        </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-200">
                        {items.map((item) => {
                          const id = String(item.id);

                          const unitLabel = item.kind === "keycard" ? "per box" : "each";
                          const lineTotal = item.unit_amount_cents * item.quantity;

                          const activeTier = item.tiers.find(
                              (t) => item.quantity >= t.min_qty && (t.max_qty === null || item.quantity <= t.max_qty)
                          );
                          const tierText = activeTier ? `${tierLabel(activeTier.min_qty, activeTier.max_qty)}` : "—";

                          const shown = qtyDraft[id] ?? String(item.quantity);
                          const numericShown = clampQty(shown === "" ? String(item.quantity) : shown);

                          return (
                              <tr key={item.id} className="group hover:bg-gray-50/50 transition-colors">
                                <td className="px-6 py-4">
                                  <div className="flex gap-4 items-center">
                                    <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100 p-1 border border-gray-200">
                                      {item.image_url ? (
                                          <img
                                              alt={item.title}
                                              className="h-full w-full object-contain object-center mix-blend-multiply"
                                              src={item.image_url}
                                          />
                                      ) : (
                                          <div className="h-full w-full flex items-center justify-center text-gray-400">
                                            <span className="material-symbols-outlined">image</span>
                                          </div>
                                      )}
                                    </div>

                                    <div className="flex flex-col">
                                  <span
                                      className={
                                        item.kind === "product"
                                            ? "text-base font-semibold text-gray-900 hover:text-blue-600 transition-colors cursor-pointer"
                                            : "text-base font-semibold text-gray-900"
                                      }
                                      onClick={() => {
                                        if (item.kind === "product") {
                                          navigate("PRODUCT_DETAIL", { id: String(item.product_id) });
                                        }
                                      }}
                                  >
                                    {item.title}
                                  </span>

                                      <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                                        {item.kind === "product" ? (
                                            <>
                                              <div>
                                                Product #{item.product_id} • Variant #{item.variant_id}
                                                {item.sku ? ` • SKU: ${item.sku}` : ""}
                                              </div>
                                              <div className="text-gray-400">Tier: {tierText}</div>
                                            </>
                                        ) : (
                                            <>
                                              <div>
                                                Boxes: <span className="font-medium text-gray-700">{item.quantity}</span> • Cards:{" "}
                                                {item.quantity * item.cards_per_box}
                                              </div>
                                              {item.meta?.lockTechName ? <div>Lock tech: {item.meta.lockTechName}</div> : null}
                                              <div className="text-gray-400">Tier: {tierText} boxes</div>
                                            </>
                                        )}

                                        {item.kind === "product" && item.stripe_price_id ? (
                                            <div className="text-[11px] text-gray-400">Stripe price: {item.stripe_price_id}</div>
                                        ) : null}
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                <td className="px-6 py-4 text-gray-700 font-semibold">
                                  {moneyFromCents(item.unit_amount_cents)}{" "}
                                  <span className="text-gray-400 font-medium text-xs">{unitLabel}</span>
                                </td>

                                <td className="px-6 py-4">
                                  <div className="flex w-fit items-center rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
                                    <button
                                        onClick={() => {
                                          const nextQty = Math.max(1, numericShown - 1);
                                          setQtyDraft((d) => ({ ...d, [id]: String(nextQty) }));
                                          updateQuantity(id, nextQty);
                                        }}
                                        className="flex h-8 w-8 items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                                        aria-label="Decrease quantity"
                                    >
                                      <span className="material-symbols-outlined text-[16px]">remove</span>
                                    </button>

                                    <input
                                        className="h-8 w-16 border-x border-gray-200 bg-transparent text-center text-sm text-gray-900 focus:outline-none focus:ring-0"
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        value={shown}
                                        onFocus={() => setFocusedId(id)}
                                        onChange={(e) => {
                                          const v = e.target.value;
                                          // allow empty while typing; otherwise digits only
                                          if (v === "" || /^\d+$/.test(v)) {
                                            setQtyDraft((d) => ({ ...d, [id]: v }));
                                          }
                                        }}
                                        onBlur={() => {
                                          setFocusedId(null);
                                          commitQty(id);
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            (e.currentTarget as HTMLInputElement).blur(); // commits via onBlur
                                          }
                                          if (e.key === "Escape") {
                                            setQtyDraft((d) => ({ ...d, [id]: String(item.quantity) }));
                                            (e.currentTarget as HTMLInputElement).blur();
                                          }
                                        }}
                                        aria-label="Quantity"
                                    />

                                    <button
                                        onClick={() => {
                                          const nextQty = numericShown + 1;
                                          setQtyDraft((d) => ({ ...d, [id]: String(nextQty) }));
                                          updateQuantity(id, nextQty);
                                        }}
                                        className="flex h-8 w-8 items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                                        aria-label="Increase quantity"
                                    >
                                      <span className="material-symbols-outlined text-[16px]">add</span>
                                    </button>
                                  </div>
                                </td>

                                <td className="px-6 py-4 text-right font-bold text-gray-900">{moneyFromCents(lineTotal)}</td>

                                <td className="px-6 py-4 text-center">
                                  <button
                                      onClick={() => removeFromCart(item.id)}
                                      className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-50"
                                      aria-label="Remove from cart"
                                  >
                                    <span className="material-symbols-outlined text-[20px]">delete</span>
                                  </button>
                                </td>
                              </tr>
                          );
                        })}
                        </tbody>
                      </table>
                    </div>
                  </div>
              )}

              <div className="flex justify-between items-center pt-4">
                <button
                    onClick={() => navigate("PRODUCTS")}
                    className="flex items-center gap-2 text-gray-500 font-medium hover:text-blue-600 transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                  Continue Shopping
                </button>
              </div>
            </div>

            <div className="lg:col-span-4">
              <div className="sticky top-24 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-bold text-gray-900 mb-6">Order Summary</h2>
                <div className="space-y-4 mb-6">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Subtotal</span>
                    <span className="text-gray-900 font-medium">{moneyFromCents(subtotal_cents)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Shipping Estimate</span>
                    <span className="text-green-600 font-medium">Free</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Tax</span>
                    <span className="text-gray-900 font-medium">{moneyFromCents(tax_cents)}</span>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-6 mb-6">
                  <div className="flex justify-between items-end mb-1">
                    <span className="text-base font-semibold text-gray-900">Total</span>
                    <span className="text-2xl font-bold text-gray-900">{moneyFromCents(total_cents)}</span>
                  </div>
                  <p className="text-xs text-gray-500 text-right">Including taxes</p>
                </div>

                <button
                    onClick={() => navigate("CHECKOUT")}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 py-3.5 text-base font-bold text-white shadow-lg shadow-blue-500/25 hover:bg-blue-700 hover:shadow-blue-500/40 transition-all active:scale-[0.98]"
                >
                  Proceed to Checkout
                  <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
};

export default CartPage;
