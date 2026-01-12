import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigation } from "../src/NavigationContext.tsx";
import { useCart } from "../src/CartContext.tsx";
import { useSearch } from "../SearchContext.tsx";
import { PUBLIC_API_BASE_URL, resolveMediaUrl } from "../src/lib/api.ts";

const CARDS_PER_BOX = 200;

type ApiKeycardBrand = {
    id: number;
    name: string;
    designs_count: number;
};

type ApiKeycardDesign = {
    id: number;
    brand_id: number | null;
    brand_name: string | null;
    code: string;
    name: string;
    description: string | null;
    created_at: string;
    image_front_url: string | null;
    image_back_url: string | null;
};

type ApiLockTech = {
    id: number;
    name: string;
    created_at: string;
};

type ApiQuote = {
    design: any | null;
    lock_tech_id: number;
    boxes: number;
    cards_per_box: number;
    total_cards: number;
    currency: string;
    price_per_box_cents: number;
    subtotal_cents: number;
    tier: { min_boxes: number; max_boxes: number | null };
};

type UiKeycardDesign = {
    id: number;
    code: string;
    name: string;
    brandId: number | null;
    brandName: string;
    description: string;
    imageFront: string;
    imageBack: string;
    isNew?: boolean;
    popular?: boolean;
};

type ApiLockTechTier = {
    min_boxes: number;
    max_boxes: number | null;
    currency: string;
    price_per_box_cents: number;
};


function clampInt(n: number, min: number, max: number) {
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, Math.floor(n)));
}

function moneyFromCents(cents: number) {
    const n = (Number(cents) || 0) / 100;
    return `$${n.toFixed(2)}`;
}

function makeUrl(path: string, query?: Record<string, string | number | undefined | null>) {
    const base = PUBLIC_API_BASE_URL || "";
    const qs = new URLSearchParams();
    if (query) {
        for (const [k, v] of Object.entries(query)) {
            if (v === undefined || v === null || v === "") continue;
            qs.set(k, String(v));
        }
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return `${base}${path}${suffix}`;
}

async function getJson<T>(path: string, query?: Record<string, string | number | undefined | null>): Promise<T> {
    const url = makeUrl(path, query);
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
        const msg = (payload && payload.error) || `Request failed (${res.status})`;
        throw new Error(msg);
    }
    return payload as T;
}

function isRecent(createdAt: string | null | undefined, days: number) {
    if (!createdAt) return false;
    const t = Date.parse(createdAt);
    if (!Number.isFinite(t)) return false;
    return Date.now() - t <= days * 24 * 60 * 60 * 1000;
}

function tierLabel(tier: { min_boxes: number; max_boxes: number | null } | null | undefined) {
    if (!tier) return "—";
    if (tier.max_boxes === null) return `${tier.min_boxes}+ boxes`;
    if (tier.min_boxes === tier.max_boxes) return `${tier.min_boxes} box`;
    return `${tier.min_boxes}–${tier.max_boxes} boxes`;
}

const KeycardDesignsPage: React.FC = () => {
    const { navigate } = useNavigation();
    const { addToCart } = useCart();
    const { searchQuery, setSearchQuery } = useSearch();

    // API data
    const [brands, setBrands] = useState<ApiKeycardBrand[]>([]);
    const [designs, setDesigns] = useState<UiKeycardDesign[]>([]);
    const [lockTechs, setLockTechs] = useState<ApiLockTech[]>([]);

    // Loading + errors
    const [loadingBrands, setLoadingBrands] = useState(false);
    const [loadingDesigns, setLoadingDesigns] = useState(false);
    const [loadingLockTechs, setLoadingLockTechs] = useState(false);
    const [designsError, setDesignsError] = useState<string | null>(null);

    // Filters (ONLY brands + search)
    const [selectedBrandIds, setSelectedBrandIds] = useState<number[]>([]);
    const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeDesign, setActiveDesign] = useState<UiKeycardDesign | null>(null);
    const [boxes, setBoxes] = useState<number>(1);
    const [lockTechId, setLockTechId] = useState<number | null>(null);
    const [previewSide, setPreviewSide] = useState<"front" | "back">("front");
    const closeBtnRef = useRef<HTMLButtonElement | null>(null);

    // Quote
    const [quote, setQuote] = useState<ApiQuote | null>(null);
    const [quoteLoading, setQuoteLoading] = useState(false);
    const [quoteError, setQuoteError] = useState<string | null>(null);

    // Used for cards list "From $X/box"
    const [minPricePerBoxCents, setMinPricePerBoxCents] = useState<number | null>(null);

    // Debounce search (so we don’t hammer API on every keystroke)
    const [debouncedQuery, setDebouncedQuery] = useState<string>("");
    useEffect(() => {
        const t = setTimeout(() => setDebouncedQuery((searchQuery ?? "").trim()), 250);
        return () => clearTimeout(t);
    }, [searchQuery]);

    const toggleBrand = (brandId: number) => {
        setSelectedBrandIds((prev) =>
            prev.includes(brandId) ? prev.filter((b) => b !== brandId) : [...prev, brandId]
        );
    };

    const resetFilters = () => {
        setSelectedBrandIds([]);
        setSearchQuery("");
        setIsMobileFiltersOpen(false);
    };

    // Fetch brands
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                setLoadingBrands(true);
                const r = await getJson<{ data: ApiKeycardBrand[] }>("/api/public/keycards/brands");
                if (!alive) return;
                setBrands(Array.isArray(r.data) ? r.data : []);
            } catch (e: any) {
                if (!alive) return;
                setBrands([]);
            } finally {
                if (alive) setLoadingBrands(false);
            }
        })();
        return () => {
            alive = false;
        };
    }, []);

    // Fetch lock techs
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                setLoadingLockTechs(true);
                const r = await getJson<{ data: ApiLockTech[] }>("/api/public/keycards/lock-tech");
                if (!alive) return;
                const list = Array.isArray(r.data) ? r.data : [];
                setLockTechs(list);

                // set default tech once
                setLockTechId((prev) => (prev === null && list[0]?.id ? list[0].id : prev));
            } catch {
                if (!alive) return;
                setLockTechs([]);
            } finally {
                if (alive) setLoadingLockTechs(false);
            }
        })();
        return () => {
            alive = false;
        };
    }, []);

    // Fetch designs (server filters: q + single brand_id; multi-brand is handled client-side)
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                setLoadingDesigns(true);
                setDesignsError(null);

                const brand_id = selectedBrandIds.length === 1 ? selectedBrandIds[0] : undefined;
                const r = await getJson<{ data: ApiKeycardDesign[] }>("/api/public/keycards/designs", {
                    brand_id,
                    q: debouncedQuery || undefined,
                });

                if (!alive) return;

                const mapped: UiKeycardDesign[] = (Array.isArray(r.data) ? r.data : []).map((d) => {
                    const front = resolveMediaUrl(d.image_front_url) || "";
                    const back = resolveMediaUrl(d.image_back_url) || front || "";
                    return {
                        id: d.id,
                        code: d.code,
                        name: d.name,
                        brandId: d.brand_id ?? null,
                        brandName: d.brand_name ?? "—",
                        description: d.description ?? "",
                        imageFront: front,
                        imageBack: back,
                        isNew: isRecent(d.created_at, 21), // “New” if added in last 3 weeks
                    };
                });

                setDesigns(mapped);
            } catch (e: any) {
                if (!alive) return;
                setDesigns([]);
                setDesignsError(String(e?.message ?? "Failed to load designs."));
            } finally {
                if (alive) setLoadingDesigns(false);
            }
        })();

        return () => {
            alive = false;
        };
    }, [debouncedQuery, selectedBrandIds]);

    // Multi-brand filter (client-side)
    const filteredDesigns = useMemo(() => {
        if (selectedBrandIds.length <= 1) return designs;
        return designs.filter((d) => (d.brandId ? selectedBrandIds.includes(d.brandId) : false));
    }, [designs, selectedBrandIds]);

    // Compute global "From $X/box" (min across lock tech for 1 box)
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                if (!lockTechs.length) {
                    setMinPricePerBoxCents(null);
                    return;
                }
                const results = await Promise.all(
                    lockTechs.map(async (lt) => {
                        try {
                            const r = await getJson<{ data: any[] }>(`/api/public/keycards/lock-tech/${lt.id}/tiers`);
                            const tiers = Array.isArray(r.data) ? r.data : [];
                            // pick tier for 1 box
                            let picked = tiers.find((t) => 1 >= t.min_boxes && (t.max_boxes === null || 1 <= t.max_boxes));
                            if (!picked) {
                                // fallback: smallest min_boxes
                                picked = tiers.slice().sort((a, b) => a.min_boxes - b.min_boxes)[0];
                            }
                            return picked?.price_per_box_cents ?? null;
                        } catch {
                            return null;
                        }
                    })
                );

                if (!alive) return;

                const nums = results.filter((n): n is number => typeof n === "number" && Number.isFinite(n));
                setMinPricePerBoxCents(nums.length ? Math.min(...nums) : null);
            } catch {
                if (!alive) return;
                setMinPricePerBoxCents(null);
            }
        })();
        return () => {
            alive = false;
        };
    }, [lockTechs]);

    const openDesignModal = (design: UiKeycardDesign) => {
        setActiveDesign(design);
        setPreviewSide("front");
        setBoxes(1);
        setQuote(null);
        setQuoteError(null);

        // If lockTechId not set yet, default to first available
        setLockTechId((prev) => prev ?? lockTechs[0]?.id ?? null);

        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setActiveDesign(null);
        setQuote(null);
        setQuoteError(null);
    };

    // Modal UX: lock scroll + focus + ESC
    useEffect(() => {
        if (!isModalOpen && !isMobileFiltersOpen) return;

        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        if (isModalOpen) setTimeout(() => closeBtnRef.current?.focus(), 0);

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                closeModal();
                setIsMobileFiltersOpen(false);
            }
        };
        window.addEventListener("keydown", onKeyDown);

        return () => {
            document.body.style.overflow = prevOverflow;
            window.removeEventListener("keydown", onKeyDown);
        };
    }, [isModalOpen, isMobileFiltersOpen]);

    const selectedLockTech = useMemo(
        () => lockTechs.find((l) => l.id === lockTechId) ?? null,
        [lockTechs, lockTechId]
    );

    // Fetch quote whenever modal inputs change
    useEffect(() => {
        let alive = true;
        (async () => {
            if (!isModalOpen || !activeDesign || !lockTechId) return;
            try {
                setQuoteLoading(true);
                setQuoteError(null);

                const r = await getJson<{ data: ApiQuote }>("/api/public/keycards/quote", {
                    design_id: activeDesign.id,
                    lock_tech_id: lockTechId,
                    boxes: clampInt(boxes, 1, 100000),
                });

                if (!alive) return;
                setQuote(r.data);
            } catch (e: any) {
                if (!alive) return;
                setQuote(null);
                setQuoteError(String(e?.message ?? "Failed to price this selection."));
            } finally {
                if (alive) setQuoteLoading(false);
            }
        })();
        return () => {
            alive = false;
        };
    }, [isModalOpen, activeDesign?.id, lockTechId, boxes]);

    const computedUnitCents = quote?.price_per_box_cents ?? 0;
    const computedTotalCents = quote?.subtotal_cents ?? 0;
    const totalCards = clampInt(boxes, 1, 100000) * CARDS_PER_BOX;

    const handleAddToCart = async () => {
        if (!activeDesign || !selectedLockTech || !quote) return;

        const safeBoxes = clampInt(quote.boxes, 1, 100000);
        const cartId = `keycard:${activeDesign.id}:${selectedLockTech.id}`;

        let tiers: any[] = [];
        try {
            const r = await getJson<{ data: ApiLockTechTier[] }>(
                `/api/public/keycards/lock-tech/${selectedLockTech.id}/tiers`
            );
            tiers = (r.data ?? []).map((t) => ({
                min_qty: clampInt(t.min_boxes, 1, 100000),
                max_qty: t.max_boxes === null ? null : clampInt(t.max_boxes, 1, 100000),
                unit_amount_cents: clampInt(t.price_per_box_cents, 0, 1_000_000_000),
                currency: (t.currency ?? quote.currency ?? "usd") as string,
                stripe_price_id: null,
            }));
        } catch {
            tiers = [
                {
                    min_qty: clampInt(quote.tier?.min_boxes ?? 1, 1, 100000),
                    max_qty: quote.tier?.max_boxes === null ? null : clampInt(quote.tier?.max_boxes ?? safeBoxes, 1, 100000),
                    unit_amount_cents: clampInt(quote.price_per_box_cents, 0, 1_000_000_000),
                    currency: (quote.currency ?? "usd") as string,
                    stripe_price_id: null,
                },
            ];
        }

        const cartItem: any = {
            id: cartId,
            kind: "keycard",
            design_id: activeDesign.id,
            lock_tech_id: selectedLockTech.id,
            cards_per_box: CARDS_PER_BOX,
            title: `${activeDesign.name} — ${selectedLockTech.name}`,
            description: activeDesign.description ?? null,
            image_url: activeDesign.imageFront,
            images: [activeDesign.imageFront, activeDesign.imageBack].filter(Boolean),
            currency: (quote.currency ?? "usd") as string,
            tiers,
            meta: {
                designId: activeDesign.id,
                designCode: activeDesign.code,
                brandId: activeDesign.brandId,
                brandName: activeDesign.brandName,
                lockTechId: selectedLockTech.id,
                lockTechName: selectedLockTech.name,
                cardsPerBox: CARDS_PER_BOX,
                tier: tierLabel(quote.tier),
            },
        };

        addToCart(cartItem, safeBoxes);
        closeModal();
        // navigate("CART");
    };

    // Shared Filter Content (used in sidebar and mobile drawer)
    const FilterContent = () => (
        <div className="space-y-8">
            <details className="group" open>
                <summary className="flex cursor-pointer items-center justify-between py-2 text-sm font-bold text-gray-800 list-none hover:text-blue-600 transition-colors">
                    <span>Brand</span>
                    <span className="material-symbols-outlined text-gray-400 transition-transform group-open:rotate-180">
            expand_more
          </span>
                </summary>

                <div className="pt-3 pb-2 space-y-3">
                    {loadingBrands ? (
                        <p className="text-sm text-gray-500">Loading brands…</p>
                    ) : brands.length === 0 ? (
                        <p className="text-sm text-gray-500">No brands yet.</p>
                    ) : (
                        brands.map((b) => (
                            <label key={b.id} className="flex items-center gap-3 cursor-pointer group/item">
                                <input
                                    type="checkbox"
                                    checked={selectedBrandIds.includes(b.id)}
                                    onChange={() => toggleBrand(b.id)}
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
                                    <span className="ml-2 text-xs text-gray-400">({b.designs_count})</span>
                </span>
                            </label>
                        ))
                    )}
                </div>
            </details>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                        <span className="material-symbols-outlined">info</span>
                    </div>
                    <div>
                        <p className="text-sm font-bold text-gray-900">Tiered pricing</p>
                        <p className="text-xs text-gray-500 mt-1">
                            Pricing is per <b>box</b> ({CARDS_PER_BOX} cards). Tiers depend on the lock tech you choose.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );

    const selectedBrandChips = useMemo(() => {
        const map = new Map(brands.map((b) => [b.id, b.name]));
        return selectedBrandIds.map((id) => ({ id, name: map.get(id) ?? `Brand ${id}` }));
    }, [brands, selectedBrandIds]);

    return (
        <div className="flex flex-col lg:flex-row min-h-screen bg-white">
            {/* Desktop Filter Sidebar */}
            <aside className="hidden lg:flex w-72 flex-col border-r border-gray-200 bg-white p-6 sticky top-[80px] h-[calc(100vh-80px)] overflow-y-auto z-10">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold font-display text-gray-900">Filters</h2>
                    <button onClick={resetFilters} className="text-blue-600 text-sm font-semibold hover:underline">
                        Reset
                    </button>
                </div>
                <FilterContent />
            </aside>

            {/* Mobile Filter Drawer */}
            {isMobileFiltersOpen && (
                <div className="fixed inset-0 z-[100] lg:hidden">
                    <div
                        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
                        onClick={() => setIsMobileFiltersOpen(false)}
                    />
                    <div className="absolute inset-y-0 right-0 w-full max-w-xs bg-white shadow-2xl p-6 overflow-y-auto animate-slide-in-right">
                        <div className="flex items-center justify-between mb-6 border-b border-gray-100 pb-4">
                            <h2 className="text-xl font-bold font-display text-gray-900">Filters</h2>
                            <button
                                onClick={() => setIsMobileFiltersOpen(false)}
                                className="p-2 text-gray-500 hover:bg-gray-100 rounded-full"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <FilterContent />
                        <div className="mt-8 pt-4 border-t border-gray-100">
                            <button
                                onClick={() => setIsMobileFiltersOpen(false)}
                                className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg"
                            >
                                Show Results
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Main */}
            <main className="flex-1 p-4 sm:p-6 lg:p-10 relative bg-gray-50">
                {/* Hero */}
                <div className="relative w-full rounded-2xl overflow-hidden mb-8 min-h-[220px] sm:min-h-[260px] flex items-center bg-blue-600 shadow-xl shadow-blue-200 border border-blue-500/20">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-900/90 via-blue-700/80 to-transparent"></div>
                    <div className="relative z-10 p-6 sm:p-12 max-w-3xl">
                        <div className="flex flex-wrap items-center gap-2 mb-4">
                            <button
                                onClick={() => navigate("HOME")}
                                className="inline-flex items-center gap-1 text-xs font-bold tracking-wider uppercase text-blue-100 hover:text-white transition-colors"
                            >
                                <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                                Home
                            </button>
                            <span className="text-blue-200/60">/</span>
                            <span className="text-xs font-bold tracking-wider uppercase text-blue-100">RFID Keycard Designs</span>
                        </div>

                        <span className="inline-block px-3 py-1 mb-4 text-[10px] sm:text-xs font-bold tracking-wider text-blue-100 uppercase bg-white/10 rounded-full border border-white/20 backdrop-blur-sm">
              Box pricing • {CARDS_PER_BOX} cards/box
            </span>

                        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-3 tracking-tight font-display leading-tight">
                            RFID Keycard Designs
                        </h1>
                        <p className="text-blue-100 text-sm sm:text-lg max-w-2xl">
                            Pick a design, choose your lock tech, select boxes, and add to cart.
                        </p>
                    </div>
                </div>

                {/* Top row: search + mobile filter trigger */}
                <div className="flex flex-col gap-4 mb-8">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <span className="text-gray-500 text-sm font-medium">
              Showing{" "}
                <span className="text-gray-900 font-bold">
                {loadingDesigns ? "…" : filteredDesigns.length}
              </span>{" "}
                designs
            </span>

                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <div className="relative w-full sm:w-80">
                                <input
                                    type="text"
                                    placeholder="Search designs…"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-600 focus:ring-blue-600 transition-all shadow-sm"
                                />
                                <span className="material-symbols-outlined absolute left-3 top-2.5 text-gray-400 text-[20px]">
                  search
                </span>
                            </div>

                            {/* Mobile Filter Button */}
                            <button
                                onClick={() => setIsMobileFiltersOpen(true)}
                                className="lg:hidden flex items-center justify-center h-[42px] w-[42px] rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-blue-600 transition-colors shadow-sm"
                            >
                                <span className="material-symbols-outlined">filter_list</span>
                            </button>
                        </div>
                    </div>

                    {/* Active Filters */}
                    {selectedBrandIds.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                            {selectedBrandChips.map((b) => (
                                <button
                                    key={b.id}
                                    onClick={() => toggleBrand(b.id)}
                                    className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
                                >
                                    {b.name}
                                    <span className="material-symbols-outlined text-[16px]">close</span>
                                </button>
                            ))}
                            <button onClick={resetFilters} className="text-xs text-gray-500 hover:text-blue-600 underline ml-2">
                                Clear all
                            </button>
                        </div>
                    )}
                </div>

                {/* Grid */}
                {designsError ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-2xl border border-gray-200 shadow-sm">
                        <span className="material-symbols-outlined text-6xl text-gray-300 mb-4">error</span>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Couldn’t load designs</h3>
                        <p className="text-gray-500 max-w-md px-4">{designsError}</p>
                        <button
                            onClick={() => setSearchQuery((q) => q)} // trigger refetch via state cycle
                            className="mt-6 px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Try Again
                        </button>
                    </div>
                ) : loadingDesigns ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="bg-white border border-gray-200 rounded-2xl overflow-hidden animate-pulse">
                                <div className="h-56 bg-gray-100" />
                                <div className="p-5 space-y-3">
                                    <div className="h-4 bg-gray-100 rounded w-1/2" />
                                    <div className="h-5 bg-gray-100 rounded w-3/4" />
                                    <div className="h-4 bg-gray-100 rounded w-full" />
                                    <div className="h-10 bg-gray-100 rounded w-full" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : filteredDesigns.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-gray-200 shadow-sm">
                        <span className="material-symbols-outlined text-6xl text-gray-300 mb-4">search_off</span>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">No designs found</h3>
                        <p className="text-gray-500 max-w-md px-4">Try adjusting brand filters or your search term.</p>
                        <button
                            onClick={resetFilters}
                            className="mt-6 px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Clear Filters
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                        {filteredDesigns.map((d) => (
                            <div
                                key={d.id}
                                className="group relative bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 hover:-translate-y-1"
                            >
                                <div className="absolute top-3 left-3 z-10 flex gap-2">
                                    {d.isNew && (
                                        <span className="px-2 py-1 text-[10px] font-bold text-white bg-blue-600 rounded uppercase shadow-sm">
                      New
                    </span>
                                    )}
                                    {d.popular && (
                                        <span className="px-2 py-1 text-[10px] font-bold text-white bg-gray-900 rounded uppercase shadow-sm">
                      Popular
                    </span>
                                    )}
                                </div>

                                <div
                                    className="h-56 bg-gray-50 flex items-center justify-center p-6 relative overflow-hidden group-hover:bg-blue-50/40 transition-colors cursor-pointer"
                                    onClick={() => openDesignModal(d)}
                                >
                                    <div className="relative w-full h-full">
                                        <img
                                            className="absolute inset-0 w-full h-full object-contain drop-shadow-xl mix-blend-multiply transition-opacity duration-300 opacity-100 group-hover:opacity-0"
                                            src={d.imageFront}
                                            alt={`${d.name} front`}
                                            loading="lazy"
                                        />
                                        <img
                                            className="absolute inset-0 w-full h-full object-contain drop-shadow-xl mix-blend-multiply transition-opacity duration-300 opacity-0 group-hover:opacity-100"
                                            src={d.imageBack}
                                            alt={`${d.name} back`}
                                            loading="lazy"
                                        />
                                    </div>
                                    <div className="absolute bottom-3 right-3 px-2 py-1 rounded-full bg-white/80 backdrop-blur border border-gray-200 text-[10px] font-bold text-gray-700 flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[14px]">swap_horiz</span>
                                        <span className="hidden sm:inline">Hover for back</span>
                                        <span className="sm:hidden">Tap for details</span>
                                    </div>
                                </div>

                                <div className="p-5">
                                    <div className="flex items-center justify-between gap-4 mb-2">
                    <span className="text-[10px] font-bold text-blue-600 tracking-wider uppercase bg-blue-600/10 px-2 py-1 rounded-sm">
                      {d.brandName}
                    </span>
                                        <span className="text-sm font-bold text-gray-900">
                      {minPricePerBoxCents !== null ? `From ${moneyFromCents(minPricePerBoxCents)}/box` : "—"}
                    </span>
                                    </div>

                                    <h3 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors font-display">
                                        {d.name}
                                    </h3>
                                    <p className="text-sm text-gray-500 mb-4 line-clamp-2">{d.description}</p>

                                    <button
                                        onClick={() => openDesignModal(d)}
                                        className="w-full h-10 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20"
                                    >
                                        Select Options
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Modal */}
                {isModalOpen && activeDesign && (
                    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-6">
                        <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={closeModal}></div>

                        <div className="relative w-full h-[95vh] sm:h-auto sm:max-h-[90vh] sm:max-w-4xl rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl animate-[slideUp_0.3s_ease-out] sm:animate-[zoomIn_0.2s_ease-out] border border-gray-200 overflow-y-auto flex flex-col">
                            {/* Sticky Header */}
                            <div className="sticky top-0 z-10 flex items-center justify-between px-5 sm:px-7 py-4 border-b border-gray-200 bg-white/95 backdrop-blur">
                                <div className="min-w-0">
                                    <p className="text-xs font-bold uppercase tracking-wider text-blue-600">{activeDesign.brandName}</p>
                                    <h2 className="text-lg sm:text-2xl font-bold text-gray-900 font-display truncate">
                                        {activeDesign.name}
                                    </h2>
                                </div>
                                <button
                                    ref={closeBtnRef}
                                    onClick={closeModal}
                                    className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors bg-gray-50 sm:bg-transparent"
                                >
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 h-full overflow-y-auto sm:overflow-visible">
                                {/* Preview */}
                                <div className="p-5 sm:p-7 bg-gray-50 border-b lg:border-b-0 lg:border-r border-gray-200">
                                    <div className="flex items-center justify-between mb-4">
                                        <p className="text-sm font-bold text-gray-900">Preview</p>
                                        <div className="flex items-center gap-2">
                                            {["front", "back"].map((side) => (
                                                <button
                                                    key={side}
                                                    onClick={() => setPreviewSide(side as "front" | "back")}
                                                    className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors capitalize ${
                                                        previewSide === side
                                                            ? "bg-blue-600 text-white border-blue-600"
                                                            : "bg-white text-gray-700 border-gray-200 hover:border-blue-300"
                                                    }`}
                                                >
                                                    {side}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-white shadow-sm border border-gray-200">
                                        <div
                                            className="absolute inset-0 bg-center bg-contain bg-no-repeat p-4 sm:p-8"
                                            style={{
                                                backgroundImage: `url('${
                                                    previewSide === "front" ? activeDesign.imageFront : activeDesign.imageBack
                                                }')`,
                                            }}
                                        ></div>
                                    </div>
                                    <p className="text-sm text-gray-500 mt-4">{activeDesign.description}</p>
                                </div>

                                {/* Options */}
                                <div className="p-5 sm:p-7 pb-24 sm:pb-7">
                                    <div className="mb-6">
                                        <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                                            Lock Technology
                                        </label>
                                        <select
                                            value={lockTechId ?? ""}
                                            onChange={(e) => setLockTechId(Number(e.target.value))}
                                            className="w-full rounded-lg bg-gray-50 border-gray-200 text-gray-900 focus:bg-white focus:border-blue-600 focus:ring-blue-600 h-12 px-4"
                                            disabled={loadingLockTechs || lockTechs.length === 0}
                                        >
                                            {lockTechs.length === 0 ? (
                                                <option value="">No lock tech available</option>
                                            ) : (
                                                lockTechs.map((l) => (
                                                    <option key={l.id} value={l.id}>
                                                        {l.name}
                                                    </option>
                                                ))
                                            )}
                                        </select>
                                    </div>

                                    <div className="mb-3">
                                        <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                                            Boxes
                                        </label>

                                        <div className="flex flex-wrap gap-2 mb-3">
                                            {[1, 2, 5, 10, 25, 50].map((n) => (
                                                <button
                                                    key={n}
                                                    onClick={() => setBoxes(n)}
                                                    className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                                                        boxes === n
                                                            ? "bg-blue-600 text-white border-blue-600"
                                                            : "bg-white text-gray-700 border-gray-200 hover:border-blue-300"
                                                    }`}
                                                >
                                                    {n} box{n === 1 ? "" : "es"}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <div className="flex w-fit items-center rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
                                                <button
                                                    onClick={() => setBoxes((q) => clampInt(q - 1, 1, 100000))}
                                                    className="h-11 w-11 flex items-center justify-center hover:bg-gray-100"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">remove</span>
                                                </button>
                                                <input
                                                    type="number"
                                                    value={boxes}
                                                    onChange={(e) => setBoxes(clampInt(Number(e.target.value), 1, 100000))}
                                                    className="h-11 w-20 border-none text-center font-bold text-gray-900 focus:ring-0"
                                                />
                                                <button
                                                    onClick={() => setBoxes((q) => clampInt(q + 1, 1, 100000))}
                                                    className="h-11 w-11 flex items-center justify-center hover:bg-gray-100"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">add</span>
                                                </button>
                                            </div>

                                            <div className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                                                <p className="text-xs text-gray-500">Cards</p>
                                                <p className="text-sm font-bold text-gray-900">
                                                    {totalCards.toLocaleString()} ({CARDS_PER_BOX}/box)
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Tier + Quote errors */}
                                    <div className="mb-6">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Tier</span>
                                            <span className="text-sm font-bold text-gray-900">
                        {quoteLoading ? "Pricing…" : tierLabel(quote?.tier ?? null)}
                      </span>
                                        </div>
                                        {quoteError && (
                                            <p className="mt-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                                                {quoteError}
                                            </p>
                                        )}
                                    </div>

                                    {/* Pricing Card */}
                                    <div className="rounded-xl border border-gray-200 bg-white shadow-sm mb-6">
                                        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between">
                                            <span className="text-sm text-gray-600">Price / box</span>
                                            <span className="text-sm font-bold text-gray-900">
                        {quoteLoading ? "…" : moneyFromCents(computedUnitCents)}
                      </span>
                                        </div>
                                        <div className="p-4 flex items-center justify-between">
                                            <span className="text-lg font-bold text-gray-900">Total</span>
                                            <span className="text-2xl font-bold text-blue-600">
                        {quoteLoading ? "…" : moneyFromCents(computedTotalCents)}
                      </span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <button
                                            onClick={handleAddToCart}
                                            disabled={!quote || !!quoteError || quoteLoading || !selectedLockTech}
                                            className={`flex-1 h-12 rounded-lg font-bold shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 ${
                                                !quote || !!quoteError || quoteLoading || !selectedLockTech
                                                    ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                                                    : "bg-blue-600 text-white hover:bg-blue-700"
                                            }`}
                                        >
                                            <span className="material-symbols-outlined">add_shopping_cart</span>
                                            Add to Cart
                                        </button>
                                        <button
                                            onClick={closeModal}
                                            className="h-12 sm:w-32 rounded-lg border border-gray-200 font-bold hover:bg-gray-50"
                                        >
                                            Cancel
                                        </button>
                                    </div>

                                    <p className="text-xs text-gray-400 mt-4">
                                        Quantity is in <b>boxes</b>. 1 box = {CARDS_PER_BOX} keycards.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default KeycardDesignsPage;
