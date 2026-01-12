import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useNavigation } from "../src/NavigationContext.tsx";
import { useCart } from "../src/CartContext.tsx";
import {
  publicApi,
  resolveMediaUrl,
  type PublicProductDetail,
  type PublicVariant,
  type PublicVariantPriceTier,
} from "../src/lib/api";

const money = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

function tierLabel(t: PublicVariantPriceTier) {
  if (t.max_qty === null || t.max_qty === undefined) return `Buy ${t.min_qty}+`;
  if (t.min_qty === t.max_qty) return `Buy ${t.min_qty}`;
  return `Buy ${t.min_qty}–${t.max_qty}`;
}

const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { navigate } = useNavigation();
  const { addToCart } = useCart();

  const productId = Number(id);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [product, setProduct] = useState<PublicProductDetail | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<PublicVariant | null>(null);

  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<"details" | "specs">("details");
  const [isAdded, setIsAdded] = useState(false);

  const [activeImage, setActiveImage] = useState<string>("");

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        if (!Number.isInteger(productId) || productId <= 0) {
          throw new Error("Invalid product id.");
        }

        const json = await publicApi.products.detail(productId);
        const data = json.data;

        if (!alive) return;

        setProduct(data);

        const firstVariant = data.variants?.[0] ?? null;
        setSelectedVariant(firstVariant);

        const imgs =
            (data.images ?? []).map((i) => resolveMediaUrl(i.url)).filter(Boolean);

        const fallback = data.image_url ? [resolveMediaUrl(data.image_url)] : [];
        const allImgs = imgs.length ? imgs : fallback;

        setActiveImage(allImgs[0] ?? "");
        setQuantity(1);
        setActiveTab("details");
        setIsAdded(false);

        window.scrollTo(0, 0);
      } catch (e: any) {
        console.error(e);
        if (!alive) return;
        setError(e?.message ?? "Failed to load product.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [productId]);

  const images = useMemo(() => {
    if (!product) return [];
    const imgs = (product.images ?? []).map((i) => resolveMediaUrl(i.url)).filter(Boolean);
    if (imgs.length) return imgs;

    const hero = resolveMediaUrl(product.image_url);
    return hero ? [hero] : [];
  }, [product]);

  const tiers = selectedVariant?.price_tiers ?? [];

  const matchedTier = useMemo(() => {
    if (!tiers.length) return null;
    // tiers are already ordered by min_qty ASC from backend, but be safe
    const sorted = [...tiers].sort((a, b) => a.min_qty - b.min_qty);

    return (
        sorted.find(
            (t) => quantity >= t.min_qty && (t.max_qty === null || quantity <= t.max_qty)
        ) ?? sorted[0]
    );
  }, [tiers, quantity]);

  const unitPrice = matchedTier ? matchedTier.unit_amount_cents / 100 : null;
  const totalPrice = unitPrice !== null ? unitPrice * quantity : null;

  const handleSelectVariant = (v: PublicVariant) => {
    setSelectedVariant(v);
    setQuantity(1);

    // swap image if variant has one
    if (v.image_url) setActiveImage(resolveMediaUrl(v.image_url));
  };

  const handleAddToCart = () => {
    if (!product || !selectedVariant || !matchedTier) return;

    const cartId = `product:${product.id}:variant:${selectedVariant.id}`;
    const tiers = (selectedVariant.price_tiers ?? []).map((t: any) => ({
      min_qty: Number(t.min_qty) || 1,
      max_qty: t.max_qty === undefined ? null : t.max_qty,
      unit_amount_cents: Number(t.unit_amount_cents) || 0,
      currency: (t.currency ?? "usd") as string,
      stripe_price_id: (t.stripe_price_id ?? null) as string | null,
    }));

    const cartItem: any = {
      id: cartId,
      kind: "product",
      product_id: product.id,
      variant_id: selectedVariant.id,
      sku: selectedVariant.sku ?? null,
      title: `${product.name} — ${selectedVariant.name}`,
      description: selectedVariant.description ?? product.description ?? null,
      image_url: activeImage || resolveMediaUrl(product.image_url),
      brand_name: product.brand_name ?? null,
      category_name: product.category_name ?? null,
      stripe_product_id: (product as any).stripe_product_id ?? null,
      tiers,
    };

    addToCart(cartItem, quantity);
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2000);
  };

  if (loading) {
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-gray-600 font-medium">Loading product…</div>
        </div>
    );
  }

  if (error || !product) {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
          <span className="material-symbols-outlined text-6xl text-gray-300 mb-3">error</span>
          <div className="text-lg font-bold text-gray-900 mb-1">Couldn’t load product</div>
          <div className="text-gray-600 max-w-md">{error ?? "Not found."}</div>
          <button
              onClick={() => navigate("PRODUCTS")}
              className="mt-6 px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Products
          </button>
        </div>
    );
  }

  const skuLabel = selectedVariant?.sku
      ? selectedVariant.sku
      : `P${String(product.id).padStart(6, "0")}`;

  const canBuy = Boolean(selectedVariant && matchedTier && unitPrice !== null);

  return (
      <div className="bg-gray-50 min-h-screen pb-20">
        <div className="px-4 md:px-10 py-6 max-w-[1440px] mx-auto">
          <div className="flex flex-wrap gap-2 text-sm">
            <button
                onClick={() => navigate("HOME")}
                className="text-gray-500 hover:text-blue-600 transition-colors font-medium"
            >
              Home
            </button>
            <span className="text-gray-300 font-medium">/</span>
            <button
                onClick={() => navigate("PRODUCTS")}
                className="text-gray-500 hover:text-blue-600 transition-colors font-medium"
            >
              Products
            </button>
            <span className="text-gray-300 font-medium">/</span>
            <span className="text-gray-900 font-semibold">{product.name}</span>
          </div>
        </div>

        <div className="px-4 md:px-10 max-w-[1440px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 xl:gap-16">
            {/* LEFT COLUMN */}
            <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-6">
                <div className="relative w-full aspect-[4/3] md:aspect-[3/2] lg:aspect-[16/9] rounded-2xl overflow-hidden bg-white shadow-sm border border-gray-200 group">
                    <div className="absolute inset-0 p-6 lg:p-7 flex items-center justify-center">
                        <img
                            src={activeImage || images[0] || ""}
                            alt={product?.name ?? "Product image"}
                            className="max-h-full max-w-full object-contain transition-transform duration-500 group-hover:scale-[1.03]"
                            draggable={false}
                        />
                    </div>
                </div>

              {images.length > 1 && (
                  <div className="grid grid-cols-4 gap-4">
                    {images.map((img, idx) => (
                        <button
                            key={idx}
                            onClick={() => setActiveImage(img)}
                            className={`relative aspect-video rounded-xl overflow-hidden bg-white p-2 shadow-sm border transition-all ${
                                (activeImage || images[0]) === img
                                    ? "ring-2 ring-blue-600 border-transparent"
                                    : "border-gray-200 hover:border-blue-300"
                            }`}
                        >
                          <div
                              className="w-full h-full bg-center bg-contain bg-no-repeat"
                              style={{ backgroundImage: `url('${img}')` }}
                          />
                        </button>
                    ))}
                  </div>
              )}

              <div className="mt-8 border-t border-gray-200 pt-8">
                <div className="flex gap-8 border-b border-gray-200 mb-8">
                  <button
                      onClick={() => setActiveTab("details")}
                      className={`pb-3 font-bold text-sm uppercase tracking-wide transition-colors relative ${
                          activeTab === "details"
                              ? "text-blue-600"
                              : "text-gray-500 hover:text-gray-900"
                      }`}
                  >
                    Product Details
                    {activeTab === "details" && (
                        <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600" />
                    )}
                  </button>
                  <button
                      onClick={() => setActiveTab("specs")}
                      className={`pb-3 font-bold text-sm uppercase tracking-wide transition-colors relative ${
                          activeTab === "specs"
                              ? "text-blue-600"
                              : "text-gray-500 hover:text-gray-900"
                      }`}
                  >
                    Specifications
                    {activeTab === "specs" && (
                        <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600" />
                    )}
                  </button>
                </div>

                <div className="min-h-[220px]">
                  {activeTab === "details" ? (
                      <div className="animate-fade-in-up">
                        <h3 className="text-2xl font-bold text-gray-900 mb-4">Overview</h3>
                        <p className="text-gray-600 leading-relaxed text-lg mb-6">
                          {product.description ?? "No description available."}
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="bg-white border border-gray-200 rounded-xl p-4">
                            <div className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">
                              Brand
                            </div>
                            <div className="font-semibold text-gray-900">
                              {product.brand_name ?? "—"}
                            </div>
                          </div>
                          <div className="bg-white border border-gray-200 rounded-xl p-4">
                            <div className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">
                              Category
                            </div>
                            <div className="font-semibold text-gray-900">
                              {product.category_name ?? "—"}
                            </div>
                          </div>
                        </div>
                      </div>
                  ) : (
                      <div className="animate-fade-in-up">
                        <h3 className="text-2xl font-bold text-gray-900 mb-6">
                          Pricing Tiers (per selected variant)
                        </h3>

                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                          <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              <th className="px-6 py-3 font-bold text-gray-700">Qty</th>
                              <th className="px-6 py-3 font-bold text-gray-700">Unit price</th>
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                            {tiers.length ? (
                                tiers.map((t) => {
                                  const isActive = matchedTier?.id === t.id;
                                  return (
                                      <tr key={t.id} className={isActive ? "bg-blue-50/60" : "bg-white"}>
                                        <td className="px-6 py-4 font-semibold text-gray-800">
                                          {tierLabel(t)}
                                        </td>
                                        <td className="px-6 py-4 text-gray-700">
                                          {money(t.unit_amount_cents / 100)}
                                          {isActive ? (
                                              <span className="ml-2 text-xs font-bold text-blue-700">
                                        (current)
                                      </span>
                                          ) : null}
                                        </td>
                                      </tr>
                                  );
                                })
                            ) : (
                                <tr>
                                  <td className="px-6 py-4 text-gray-500 italic" colSpan={2}>
                                    No active prices found for this variant.
                                  </td>
                                </tr>
                            )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="lg:col-span-5 xl:col-span-4">
              <div className="sticky top-24 flex flex-col gap-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <div className="flex flex-col gap-2">
                  <div className="text-xs text-blue-600 font-bold uppercase tracking-wider mb-1">
                    {product.category_name ?? "Product"}
                  </div>
                  <h1 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight leading-tight font-display">
                    {product.name}
                  </h1>

                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <span className="bg-gray-100 text-gray-700 text-xs font-mono px-2 py-1 rounded">
                    SKU: {skuLabel}
                  </span>
                    {product.brand_name ? (
                        <span className="bg-gray-100 text-gray-700 text-xs font-semibold px-2 py-1 rounded">
                      {product.brand_name}
                    </span>
                    ) : null}
                  </div>
                </div>

                {/* Variants */}
                {product.variants?.length ? (
                    <div className="py-2">
                      <label className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3 block">
                        Select Option
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {product.variants.map((v) => (
                            <button
                                key={v.id}
                                onClick={() => handleSelectVariant(v)}
                                className={`px-4 py-2 text-sm font-semibold rounded-lg border transition-all duration-200 ${
                                    selectedVariant?.id === v.id
                                        ? "bg-blue-600 border-blue-600 text-white shadow-md"
                                        : "bg-white border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600"
                                }`}
                            >
                              {v.name}
                            </button>
                        ))}
                      </div>
                    </div>
                ) : (
                    <div className="text-sm text-gray-600">
                      No purchasable variants available. Contact sales.
                    </div>
                )}

                {/* Price */}
                <div className="py-4 border-y border-gray-100">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">
                        Unit price
                      </div>
                      <div className="text-4xl font-bold text-gray-900 tracking-tight">
                        {unitPrice === null ? "—" : money(unitPrice)}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">
                        Total
                      </div>
                      <div className="text-xl font-bold text-gray-900">
                        {totalPrice === null ? "—" : money(totalPrice)}
                      </div>
                      {matchedTier ? (
                          <div className="text-xs text-gray-500 mt-1">{tierLabel(matchedTier)}</div>
                      ) : null}
                    </div>
                  </div>

                  {/* Tier box */}
                  {tiers.length > 1 && (
                      <div className="mt-4 bg-blue-50/50 rounded-lg p-3 border border-blue-100">
                        <p className="text-xs font-bold text-blue-800 uppercase mb-2">
                          Volume Pricing
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {tiers.map((t) => {
                            const active = matchedTier?.id === t.id;
                            return (
                                <div
                                    key={t.id}
                                    className={`flex justify-between text-xs p-1.5 rounded ${
                                        active ? "bg-blue-100 text-blue-900 font-bold" : "text-gray-600"
                                    }`}
                                >
                                  <span>{tierLabel(t)}</span>
                                  <span>{money(t.unit_amount_cents / 100)} ea</span>
                                </div>
                            );
                          })}
                        </div>
                      </div>
                  )}
                </div>

                {/* Qty + Add */}
                <div className="flex flex-col gap-3 mt-4">
                  <div className="flex gap-3 h-12">
                    <div className="w-36 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-between px-2">
                      <button
                          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                          className="text-gray-500 hover:text-blue-600 w-9 h-9 flex items-center justify-center transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">remove</span>
                      </button>

                      <input
                          value={quantity}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            if (!Number.isFinite(v)) return;
                            setQuantity(Math.max(1, Math.floor(v)));
                          }}
                          className="w-14 text-center bg-transparent font-semibold text-gray-900 outline-none"
                          inputMode="numeric"
                      />

                      <button
                          onClick={() => setQuantity((q) => q + 1)}
                          className="text-gray-500 hover:text-blue-600 w-9 h-9 flex items-center justify-center transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">add</span>
                      </button>
                    </div>

                    <button
                        onClick={handleAddToCart}
                        disabled={!canBuy || isAdded}
                        className={`flex-1 font-bold rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg ${
                            isAdded
                                ? "bg-green-600 text-white shadow-green-500/30"
                                : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/30 hover:shadow-blue-500/40 disabled:bg-gray-300 disabled:cursor-not-allowed"
                        }`}
                    >
                      {isAdded ? (
                          <>
                            <span className="material-symbols-outlined">check</span>
                            Added
                          </>
                      ) : (
                          <>
                            <span className="material-symbols-outlined">shopping_cart</span>
                            Add to Cart
                          </>
                      )}
                    </button>
                  </div>

                  {!canBuy && selectedVariant ? (
                      <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3">
                        No active pricing tiers for this variant.
                      </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
};

export default ProductDetailPage;
