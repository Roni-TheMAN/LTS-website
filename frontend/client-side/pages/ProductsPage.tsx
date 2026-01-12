// ProductsPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigation } from "../src/NavigationContext.tsx";
import { useSearch } from "../SearchContext.tsx";
import { publicApi } from "../src/lib/api";


type ApiBrand = {
  id: number;
  name: string;
  products_count?: number;
};

type ApiCategory = {
  id: number;
  parent_id: number | null;
  name: string;
  products_count?: number;
};

type ApiProduct = {
  id: number;
  type: "regular" | "keycard";
  name: string;
  description: string | null;
  brand_id: number | null;
  category_id: number | null;
  brand_name: string | null;
  category_name: string | null;
  max_price_cents: number | null;
  image_url: string | null;
};

const money = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

const ProductsPage: React.FC = () => {
  const { navigate } = useNavigation();
  const { searchQuery, setSearchQuery } = useSearch();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [brands, setBrands] = useState<ApiBrand[]>([]);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [products, setProducts] = useState<ApiProduct[]>([]);

  // Filters
  const [selectedBrandIds, setSelectedBrandIds] = useState<number[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [priceBounds, setPriceBounds] = useState<[number, number]>([0, 2000]); // dollars
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 2000]); // dollars

  const handleProductClick = (id: number) => {
    navigate("PRODUCT_DETAIL", { id: String(id) });
  };

  const toggleId = (id: number, setter: React.Dispatch<React.SetStateAction<number[]>>) => {
    setter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const resetFilters = () => {
    setSelectedBrandIds([]);
    setSelectedCategoryIds([]);
    setPriceRange(priceBounds);
    setSearchQuery("");
  };

  const handleMinPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.min(Number(e.target.value), priceRange[1] - 1);
    setPriceRange([value, priceRange[1]]);
  };

  const handleMaxPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.max(Number(e.target.value), priceRange[0] + 1);
    setPriceRange([priceRange[0], value]);
  };

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [bJson, cJson, pJson] = await Promise.all([
          publicApi.brands.list(),
          publicApi.categories.list(),
          publicApi.products.list(),
        ]);

        const b = (bJson?.data ?? []) as ApiBrand[];
        const c = (cJson?.data ?? []) as ApiCategory[];
        const p = (pJson?.data ?? []) as ApiProduct[];

        setBrands(b);
        setCategories(c);
        setProducts(p);

        // compute bounds from max_price_cents (convert to dollars)
        const maxDollars = Math.max(
            0,
            ...p.map((x) => ((x.max_price_cents ?? 0) / 100) | 0) // floor dollars
        );
        const upper = Math.max(50, maxDollars); // keep slider usable even if dataset tiny
        const bounds: [number, number] = [0, upper];

        setPriceBounds(bounds);
        setPriceRange(bounds);
      } catch (err: any) {
        console.error(err);
        if (!alive) return;
        setError(err?.message ?? "Something went wrong.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [setSearchQuery]);

  // Filtered list (client-side)
  const filteredProducts = useMemo(() => {
    const q = (searchQuery ?? "").toLowerCase().trim();

    return products.filter((p) => {
      const price = (p.max_price_cents ?? 0) / 100;

      const matchesBrand =
          selectedBrandIds.length === 0 || (p.brand_id !== null && selectedBrandIds.includes(p.brand_id));

      const matchesCategory =
          selectedCategoryIds.length === 0 ||
          (p.category_id !== null && selectedCategoryIds.includes(p.category_id));

      const matchesPrice = price >= priceRange[0] && price <= priceRange[1];

      const matchesSearch =
          !q ||
          (p.name ?? "").toLowerCase().includes(q) ||
          (p.description ?? "").toLowerCase().includes(q) ||
          (p.brand_name ?? "").toLowerCase().includes(q) ||
          (p.category_name ?? "").toLowerCase().includes(q);

      return matchesBrand && matchesCategory && matchesPrice && matchesSearch;
    });
  }, [products, selectedBrandIds, selectedCategoryIds, priceRange, searchQuery]);

  // Slider visuals
  const MIN_PRICE = priceBounds[0];
  const MAX_PRICE = priceBounds[1];
  const minPercent = ((priceRange[0] - MIN_PRICE) / Math.max(1, MAX_PRICE - MIN_PRICE)) * 100;
  const maxPercent = ((priceRange[1] - MIN_PRICE) / Math.max(1, MAX_PRICE - MIN_PRICE)) * 100;

  if (loading) {
    return (
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-gray-600 font-medium">Loading products…</div>
        </div>
    );
  }

  if (error) {
    return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
          <span className="material-symbols-outlined text-6xl text-gray-300 mb-3">error</span>
          <div className="text-lg font-bold text-gray-900 mb-1">Couldn’t load catalog</div>
          <div className="text-gray-600 max-w-md">{error}</div>
          <button
              onClick={() => window.location.reload()}
              className="mt-6 px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
    );
  }

  return (
      <div className="flex flex-col lg:flex-row min-h-screen bg-white">
        {/* Desktop filters */}
        <aside className="hidden lg:flex w-72 flex-col border-r border-gray-200 bg-white p-6 sticky top-[80px] h-[calc(100vh-80px)] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold font-display text-gray-900">Filters</h2>
            <button onClick={resetFilters} className="text-blue-600 text-sm font-semibold hover:underline">
              Reset
            </button>
          </div>

          <div className="space-y-8">
            {/* Price */}
            <div>
              <p className="text-sm font-bold text-gray-800 mb-4">Price Range</p>
              <div className="px-2">
                <div className="relative h-1.5 w-full bg-gray-100 rounded-full mb-6">
                  <div
                      className="absolute h-full bg-blue-600 rounded-full"
                      style={{ left: `${minPercent}%`, right: `${100 - maxPercent}%` }}
                  />
                  <input
                      type="range"
                      min={MIN_PRICE}
                      max={MAX_PRICE}
                      value={priceRange[0]}
                      onChange={handleMinPriceChange}
                      className="absolute w-full h-full opacity-0 cursor-pointer pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 z-20"
                  />
                  <input
                      type="range"
                      min={MIN_PRICE}
                      max={MAX_PRICE}
                      value={priceRange[1]}
                      onChange={handleMaxPriceChange}
                      className="absolute w-full h-full opacity-0 cursor-pointer pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 z-20"
                  />

                  <div
                      className="absolute top-1/2 -mt-2.5 -ml-2.5 size-5 rounded-full bg-white shadow-md border border-gray-200 pointer-events-none z-10"
                      style={{ left: `${minPercent}%` }}
                  />
                  <div
                      className="absolute top-1/2 -mt-2.5 -ml-2.5 size-5 rounded-full bg-white shadow-md border border-gray-200 pointer-events-none z-10"
                      style={{ left: `${maxPercent}%` }}
                  />
                </div>

                <div className="flex justify-between text-xs text-gray-500 font-mono font-medium">
                  <span>{money(priceRange[0])}</span>
                  <span>{money(priceRange[1])}</span>
                </div>
              </div>
            </div>

            {/* Brands */}
            <details className="group" open>
              <summary className="flex cursor-pointer items-center justify-between py-2 text-sm font-bold text-gray-800 list-none hover:text-blue-600 transition-colors">
                <span>Brand</span>
                <span className="material-symbols-outlined text-gray-400 transition-transform group-open:rotate-180">
                expand_more
              </span>
              </summary>
              <div className="pt-3 pb-2 space-y-3">
                {brands.map((b) => (
                    <label key={b.id} className="flex items-center gap-3 cursor-pointer group/item">
                      <input
                          type="checkbox"
                          checked={selectedBrandIds.includes(b.id)}
                          onChange={() => toggleId(b.id, setSelectedBrandIds)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-600"
                      />
                      <span
                          className={`text-sm transition-colors ${
                              selectedBrandIds.includes(b.id)
                                  ? "text-blue-600 font-medium"
                                  : "text-gray-600 group-hover/item:text-blue-600"
                          }`}
                      >
                    {b.name}
                        {typeof b.products_count === "number" ? (
                            <span className="text-xs text-gray-400 ml-2">({b.products_count})</span>
                        ) : null}
                  </span>
                    </label>
                ))}
              </div>
            </details>

            {/* Categories */}
            <details className="group" open>
              <summary className="flex cursor-pointer items-center justify-between py-2 text-sm font-bold text-gray-800 list-none hover:text-blue-600 transition-colors">
                <span>Category</span>
                <span className="material-symbols-outlined text-gray-400 transition-transform group-open:rotate-180">
                expand_more
              </span>
              </summary>
              <div className="pt-3 pb-2 space-y-3">
                {categories.map((cat) => (
                    <label key={cat.id} className="flex items-center gap-3 cursor-pointer group/item">
                      <input
                          type="checkbox"
                          checked={selectedCategoryIds.includes(cat.id)}
                          onChange={() => toggleId(cat.id, setSelectedCategoryIds)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-600"
                      />
                      <span
                          className={`text-sm transition-colors ${
                              selectedCategoryIds.includes(cat.id)
                                  ? "text-blue-600 font-medium"
                                  : "text-gray-600 group-hover/item:text-blue-600"
                          }`}
                      >
                    {cat.name}
                        {typeof cat.products_count === "number" ? (
                            <span className="text-xs text-gray-400 ml-2">({cat.products_count})</span>
                        ) : null}
                  </span>
                    </label>
                ))}
              </div>
            </details>
          </div>
        </aside>

        <main className="flex-1 p-4 sm:p-6 lg:p-10 relative">
          {/* Hero */}
          <div className="relative w-full rounded-2xl overflow-hidden mb-6 min-h-[240px] flex items-center bg-blue-600 shadow-xl shadow-blue-200 border border-blue-500/20">
            <div
                className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-overlay"
                style={{
                  backgroundImage:
                      "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAqcQkjieTXP4wXJnhj9EF8F90g4gUO9M6Zjz58Hf78-zsMo0_SKbb1uoRchudtNTcT4WQxL5ruPlIJ-_CThRc7ifuY7O5KYpfxkOkZHqOkN0E0slcG4iltix3xRDj2QmqmYqWAxoeunGS7FdERxFMp7c4iG1o8qHhuYmbORPli0VEqobpeeOpXFAYaOVesQL1rMHYUbCA1fLQsFjavuqNEaVY-2ExXKHnZqHTYKRleoJZ2Jz_kihlKbMMKsEJBNkkduGdn6Pir33c')",
                }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-blue-900/90 via-blue-700/80 to-transparent" />
            <div className="relative z-10 p-8 sm:p-10 max-w-2xl">
            <span className="inline-block px-3 py-1 mb-3 text-xs font-bold tracking-wider text-blue-100 uppercase bg-white/10 rounded-full border border-white/20 backdrop-blur-sm">
              Catalog
            </span>
              <h1 className="text-4xl sm:text-5xl font-bold text-white mb-3 tracking-tight font-display">
                Hardware Solutions <br /> <span className="text-blue-200">Engineered for Scale</span>
              </h1>
              <p className="text-blue-100 text-lg max-w-md">
                Filter by brand, category, and price to find the right gear fast.
              </p>
            </div>
          </div>

          {/* Top row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <span className="text-gray-500 text-sm font-medium">
            Showing <span className="text-gray-900 font-bold">{filteredProducts.length}</span> products
          </span>
            <div className="flex items-center gap-3">
              <button
                  onClick={resetFilters}
                  className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold shadow-sm hover:bg-gray-50 transition-colors text-gray-700"
              >
                Clear filters
              </button>
            </div>
          </div>

          {filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <span className="material-symbols-outlined text-6xl text-gray-300 mb-4">search_off</span>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No products found</h3>
                <p className="text-gray-500 max-w-md">
                  Try widening your price range, or clearing category/brand filters.
                </p>
                <button
                    onClick={resetFilters}
                    className="mt-6 px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Clear All Filters
                </button>
              </div>
          ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredProducts.map((p) => {
                  const price = (p.max_price_cents ?? 0) / 100;

                  // what cart probably expects (keep it close to your old shape)
                  const cartProduct: any = {
                    id: String(p.id),
                    name: p.name,
                    description: p.description ?? "",
                    price,
                    image: p.image_url ?? "",
                    category: p.category_name ?? "Uncategorized",
                    inStock: true,
                  };

                  return (
                      <div
                          key={p.id}
                          className="group relative bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300 hover:-translate-y-1"
                      >
                        <div className="absolute top-3 right-3 z-10">
                          <button className="p-2 rounded-full bg-white/60 backdrop-blur-sm text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors border border-gray-100">
                            <span className="material-symbols-outlined text-[20px] fill-current">favorite</span>
                          </button>
                        </div>

                        <div
                            className="h-64 bg-gray-50 flex items-center justify-center p-6 relative overflow-hidden group-hover:bg-blue-50/50 transition-colors cursor-pointer"
                            onClick={() => handleProductClick(p.id)}
                        >
                          {p.image_url ? (
                              <img
                                  className="w-full h-full object-contain drop-shadow-xl mix-blend-multiply transition-transform group-hover:scale-105"
                                  src={p.image_url}
                                  alt={p.name}
                              />
                          ) : (
                              <div className="flex flex-col items-center justify-center text-gray-400">
                                <span className="material-symbols-outlined text-5xl mb-2">image</span>
                                <span className="text-xs font-semibold">No image</span>
                              </div>
                          )}
                        </div>

                        <div className="p-5">
                          <div className="mb-2 flex flex-wrap gap-2">
                            {p.category_name ? (
                                <span className="text-[10px] font-bold text-blue-600 tracking-wider uppercase bg-blue-600/10 px-2 py-1 rounded-sm">
                          {p.category_name}
                        </span>
                            ) : null}
                            {p.brand_name ? (
                                <span className="text-[10px] font-bold text-gray-700 tracking-wider uppercase bg-gray-600/10 px-2 py-1 rounded-sm">
                          {p.brand_name}
                        </span>
                            ) : null}
                          </div>

                          <h3
                              className="text-lg font-bold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors font-display cursor-pointer"
                              onClick={() => handleProductClick(p.id)}
                          >
                            {p.name}
                          </h3>

                          <p className="text-sm text-gray-500 mb-4 line-clamp-2">{p.description ?? ""}</p>

                          <div className="flex items-center justify-between mt-auto">
                      <span className="text-xl font-bold text-gray-900">
                        {p.max_price_cents === null ? "Contact" : money(price)}
                      </span>
                            <button
                                onClick={() => handleProductClick(p.id)}
                                className="flex items-center justify-center size-10 rounded-lg bg-gray-100 text-gray-600 hover:bg-blue-600 hover:text-white transition-colors border border-gray-200 hover:border-transparent"
                            >
                              <span className="material-symbols-outlined text-[20px]">add_shopping_cart</span>
                            </button>
                          </div>
                        </div>
                      </div>
                  );
                })}
              </div>
          )}
        </main>
      </div>
  );
};

export default ProductsPage;
