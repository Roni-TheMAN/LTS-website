// src/lib/api.ts
export type ApiEnvelope<T> = { data: T };

type QueryValue = string | number | boolean | null | undefined;
type Query = Record<string, QueryValue | QueryValue[]>;

function getEnv() {
    return ((import.meta as any).env || {}) as Record<string, any>;
}

function trimTrailingSlashes(v: string) {
    return String(v || "").replace(/\/+$/, "");
}

function getApiBase() {
    // Prefer a dedicated public var; fallback to a generic one; fallback to same-origin/proxy ("")
    const env = getEnv();
    const base = env.VITE_PUBLIC_API_BASE_URL ?? env.VITE_API_BASE_URL ?? "";
    return trimTrailingSlashes(base);
}

function getMediaBase(apiBase: string) {
    /**
     * IMPORTANT:
     * Use `||` (not `??`) so empty string "" doesn't block fallbacks.
     * This matters when API_BASE is intentionally "" (Vite proxy).
     */
    const env = getEnv();
    const base =
        // env.VITE_PUBLIC_MEDIA_BASE_URL ||
        // env.VITE_MEDIA_BASE_URL ||
        // env.VITE_PUBLIC_API_BASE_URL ||
        // env.VITE_API_BASE_URL ||
        // apiBase ||
        // "http://localhost:5001" ||
        "https://api.legacytechsol.com";

    return trimTrailingSlashes(base);
}

const API_BASE = getApiBase();
const MEDIA_BASE = getMediaBase(API_BASE);

/**
 * Ensures image/media URLs work whether backend returns:
 *  - absolute: https://...  (kept)
 *  - root-relative: /images/x.jpg   -> MEDIA_BASE + /images/x.jpg
 *  - path-relative: images/x.jpg    -> MEDIA_BASE + /images/x.jpg
 */
export function resolveMediaUrl(input: string | null | undefined): string | null {
    if (!input) return null;
    const s = String(input).trim();
    if (!s) return null;

    // already absolute or special schemes
    if (/^https?:\/\//i.test(s) || s.startsWith("data:") || s.startsWith("blob:")) return s;

    // protocol-relative //cdn...
    if (s.startsWith("//")) {
        const proto =
            typeof window !== "undefined" && window.location?.protocol ? window.location.protocol : "https:";
        return `${proto}${s}`;
    }

    const base = MEDIA_BASE || API_BASE || "";
    if (!base) return s;

    if (s.startsWith("/")) return `${base}${s}`;
    return `${base}/${s}`;
}

function toQueryString(query?: Query) {
    if (!query) return "";
    const sp = new URLSearchParams();

    for (const [k, v] of Object.entries(query)) {
        if (Array.isArray(v)) {
            v.forEach((item) => {
                if (item === null || item === undefined || item === "") return;
                sp.append(k, String(item));
            });
        } else {
            if (v === null || v === undefined || v === "") continue;
            sp.set(k, String(v));
        }
    }

    const qs = sp.toString();
    return qs ? `?${qs}` : "";
}

async function request<T>(path: string, opts?: RequestInit & { query?: Query }): Promise<T> {
    const url = `${API_BASE}${path}${toQueryString(opts?.query)}`;

    const res = await fetch(url, {
        ...opts,
        headers: {
            Accept: "application/json",
            ...(opts?.headers || {}),
        },
    });

    const contentType = res.headers.get("content-type") || "";

    let payload: any = null;
    if (contentType.includes("application/json")) {
        payload = await res.json().catch(() => null);
    } else {
        payload = await res.text().catch(() => null);
    }

    if (!res.ok) {
        const msg =
            (payload && payload.error) ||
            (typeof payload === "string" && payload) ||
            `Request failed (${res.status})`;
        throw new Error(msg);
    }

    return payload as T;
}

/* =====================
   PUBLIC API TYPES
   ===================== */

export type PublicBrand = {
    id: number;
    name: string;
    products_count?: number;
    active?: number;
    created_at?: string;
};

export type PublicCategory = {
    id: number;
    parent_id: number | null;
    name: string;
    products_count?: number;
    active?: number;
    created_at?: string;
};

export type PublicProduct = {
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

export type PublicProductImage = {
    id?: number;
    url: string;
    sort_order?: number;
    created_at?: string;
};

export type PublicVariantPriceTier = {
    id: number;
    min_qty: number;
    max_qty: number | null;
    currency: string;
    unit_amount_cents: number;
    active?: number;
    stripe_price_id?: string | null;
    created_at?: string;
};

export type PublicVariant = {
    id: number;
    product_id: number;
    sku: string | null;
    name: string;
    description: string | null;
    active: number; // 0/1
    image_url?: string | null;
    price_tiers?: PublicVariantPriceTier[];
};

export type PublicProductDetail = PublicProduct & {
    images?: PublicProductImage[];
    variants?: PublicVariant[];
};

/* =====================
   PUBLIC ORDER TYPES
   ===================== */

export type PublicReceipt = {
    invoice_pdf: string | null;
    hosted_invoice_url: string | null;
    receipt_url: string | null;
};

export type PublicOrderItem = {
    id: number;

    // tolerate older/older DB values
    item_type: "product" | "regular" | "keycard";

    product_id: number | null;
    variant_id: number | null;
    design_id: number | null;
    lock_tech_id: number | null;

    box_size: number;
    boxes: number | null;

    currency: string;
    unit_amount_cents: number;
    quantity: number;
    line_total_cents: number;
    description: string | null;
};

export type PublicOrder = {
    id: number;
    order_number: string;

    /**
     * Legacy summary (kept for backward compatibility).
     * Your updated controller maps this to `payment_status`.
     */
    status?: string;

    // ✅ New schema-based statuses
    order_status: string | null;
    payment_status: string | null;
    fulfillment_status: string | null;
    shipping_status: string | null;

    source?: string | null;
    payment_method?: string | null;

    currency: string;
    subtotal_cents: number;
    tax_cents: number;
    shipping_cents: number;
    total_cents: number;

    created_at: string;
    paid_at: string | null;
    updated_at?: string | null;

    customer: {
        email: string | null;
        name: string | null;
        phone: string | null;
    };

    shipping: {
        ship_name: string | null;
        ship_line1: string | null;
        ship_line2: string | null;
        ship_city: string | null;
        ship_state: string | null;
        ship_postal_code: string | null;
        ship_country: string | null;
    };

    items: PublicOrderItem[];

    // Optional: added by controller when available
    receipt?: PublicReceipt | null;
};

export type PublicOrderResponse =
    | { ok: true; order: PublicOrder }
    | { ok: false; error: string };

export type StripeSessionStatusResponse = {
    status: string | null;
    customer_email: string | null;
    payment_status: string | null;
    order_number: string | null;
    amount_subtotal: number | null;
    amount_total: number | null;
    customer_name: string | null;
    business_name: string | null;
    shipping_details: any | null;
};

/* =====================
   NORMALIZERS
   ===================== */

function normalizeProduct(p: PublicProduct): PublicProduct {
    return { ...p, image_url: resolveMediaUrl(p.image_url) };
}

function normalizeImage(i: PublicProductImage): PublicProductImage {
    const fixed = resolveMediaUrl(i.url);
    return { ...i, url: fixed ?? i.url };
}

function normalizeVariant(v: PublicVariant): PublicVariant {
    return {
        ...v,
        image_url: resolveMediaUrl(v.image_url ?? null),
        price_tiers: Array.isArray(v.price_tiers) ? v.price_tiers : [],
    };
}

function normalizeProductDetail(p: PublicProductDetail): PublicProductDetail {
    const base = normalizeProduct(p);
    return {
        ...base,
        images: Array.isArray(p.images) ? p.images.map(normalizeImage) : [],
        variants: Array.isArray(p.variants) ? p.variants.map(normalizeVariant) : [],
    };
}

/* =====================
   PUBLIC API FUNCTIONS
   ===================== */

export const publicApi = {
    brands: {
        list: () => request<ApiEnvelope<PublicBrand[]>>("/api/public/brands"),
    },

    categories: {
        list: () => request<ApiEnvelope<PublicCategory[]>>("/api/public/categories"),
    },

    products: {
        list: (filters?: {
            brands?: number[]; // repeated params
            categories?: number[];
            min_price?: number; // dollars
            max_price?: number; // dollars
            q?: string;
        }) =>
            request<ApiEnvelope<PublicProduct[]>>("/api/public/products", {
                query: filters
                    ? {
                        brands: filters.brands,
                        categories: filters.categories,
                        min_price: filters.min_price,
                        max_price: filters.max_price,
                        q: filters.q,
                    }
                    : undefined,
            }).then((r) => ({ ...r, data: (r.data ?? []).map(normalizeProduct) })),

        // lightweight single product (kept for compatibility)
        byId: (id: number) =>
            request<ApiEnvelope<PublicProduct>>(`/api/public/products/${id}`).then((r) => ({
                ...r,
                data: normalizeProduct(r.data),
            })),

        // full detail used by ProductDetailPage (variants, tiers, images)
        detail: async (id: number) => {
            // Try /detail first (common pattern), then fallback to /:id if your backend uses that.
            try {
                const r = await request<ApiEnvelope<PublicProductDetail>>(`/api/public/products/${id}/detail`);
                return { ...r, data: normalizeProductDetail(r.data) };
            } catch (e: any) {
                const msg = String(e?.message ?? "");
                const looksLikeMissingRoute = msg.includes("(404)") || /not found/i.test(msg);
                if (!looksLikeMissingRoute) throw e;

                const r2 = await request<ApiEnvelope<PublicProductDetail>>(`/api/public/products/${id}`);
                return { ...r2, data: normalizeProductDetail(r2.data) };
            }
        },
    },

    orders: {
        bySession: (sessionId: string) =>
            request<PublicOrderResponse>(`/api/public/orders/by-session/${encodeURIComponent(sessionId)}`),

        // ✅ includes zip; POST so email/zip aren’t in the URL
        lookup: (params: { order_number: string; email: string; zip: string }) =>
            request<PublicOrderResponse>(`/api/public/orders/lookup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(params),
            }),
    },

    stripe: {
        /**
         * Your code historically used `/session-status?session_id=...`.
         * If you later move it under `/api/public/...`, this fallback keeps the frontend working.
         */
        sessionStatus: async (sessionId: string) => {
            try {
                return await request<StripeSessionStatusResponse>(`/session-status`, {
                    query: { session_id: sessionId },
                });
            } catch (e: any) {
                const msg = String(e?.message ?? "");
                const looksLikeMissingRoute = msg.includes("(404)") || /not found/i.test(msg);
                if (!looksLikeMissingRoute) throw e;

                // fallback path (optional)
                return await request<StripeSessionStatusResponse>(`/api/public/stripe/session-status`, {
                    query: { session_id: sessionId },
                });
            }
        },
    },
};

// Optional: export these if you ever need them elsewhere
export const PUBLIC_API_BASE_URL = API_BASE;
export const PUBLIC_MEDIA_BASE_URL = MEDIA_BASE;
