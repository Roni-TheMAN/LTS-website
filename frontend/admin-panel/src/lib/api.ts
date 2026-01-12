// admin-panel/src/lib/api.ts

const BASE = String(import.meta.env.VITE_ADMIN_API_BASE_URL || "").replace(/\/+$/, "");

// Build /api/admin + your path, safely
function adminApiUrl(path: string) {
    const p = path.startsWith("/") ? path : `/${path}`;
    return `${BASE}/api/admin${p}`;
}

async function parseError(res: Response) {
    try {
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
            const j: any = await res.json();
            return j?.error || j?.message || `Request failed (${res.status})`;
        }
        const t = await res.text().catch(() => "");
        return t || `Request failed (${res.status})`;
    } catch {
        return `Request failed (${res.status})`;
    }
}

export async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(adminApiUrl(path), {
        ...init,
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            ...(init.headers || {}),
        },
    });

    if (!res.ok) throw new Error(await parseError(res));

    const text = await res.text().catch(() => "");
    return (text ? JSON.parse(text) : (null as any)) as T;
}

export async function adminUpload<T>(
    path: string,
    form: FormData,
    method: "POST" | "PUT" = "POST"
): Promise<T> {
    const res = await fetch(adminApiUrl(path), {
        method,
        body: form,
        credentials: "include",
    });

    if (!res.ok) throw new Error(await parseError(res));

    const text = await res.text().catch(() => "");
    return (text ? JSON.parse(text) : (null as any)) as T;
}

// For image URLs returned as "/uploads/..." etc
export function adminAssetUrl(url: string) {
    if (!url) return url;
    if (/^https?:\/\//i.test(url)) return url;
    return `${BASE}${url.startsWith("/") ? url : `/${url}`}`;
}

// -----------------------------
// Admin Orders API
// -----------------------------

export type OrderStatus = "placed" | "cancelled" | "completed";
export type PaymentStatus = "pending" | "paid" | "refunded";
export type FulfillmentStatus = "unfulfilled" | "fulfilled";
export type ShippingStatus = "pending" | "shipped" | "delivered";
export type OrderSource = "web" | "phone" | "manual";
export type PaymentMethod = "stripe" | "cash" | "check" | "invoice" | "other";

export interface AdminOrderListRow {
    id: number;
    order_number: string | null;
    source: OrderSource;
    order_status: OrderStatus;
    payment_status: PaymentStatus;
    fulfillment_status: FulfillmentStatus;
    shipping_status: ShippingStatus;
    payment_method: PaymentMethod;
    external_ref: string | null;

    currency: string;
    subtotal_cents: number;
    tax_cents: number;
    shipping_cents: number;
    total_cents: number;

    customer_email: string | null;
    customer_phone: string | null;
    customer_name: string | null;

    created_at: string;
    paid_at: string | null;
    updated_at: string;
}

export interface AdminOrderListResponse {
    rows: AdminOrderListRow[];
    total: number;
    limit: number;
    offset: number;
}

function toQuery(params: Record<string, any>) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null || v === "") continue;
        sp.set(k, String(v));
    }
    const qs = sp.toString();
    return qs ? `?${qs}` : "";
}

export async function adminListOrders(
    params: {
        q?: string;
        order_status?: OrderStatus;
        payment_status?: PaymentStatus;
        fulfillment_status?: FulfillmentStatus;
        shipping_status?: ShippingStatus;
        source?: OrderSource;
        payment_method?: PaymentMethod;
        limit?: number;
        offset?: number;
        sort?: string; // e.g. "created_at:desc"
    } = {}
): Promise<AdminOrderListResponse> {
    return adminFetch<AdminOrderListResponse>(`/orders${toQuery(params as any)}`);
}

export async function adminGetOrder(id: number) {
    return adminFetch<any>(`/orders/${id}`);
}

export async function adminUpdateOrder(id: number, patch: Record<string, any>) {
    return adminFetch<any>(`/orders/${id}`, {
        method: "PUT",
        body: JSON.stringify(patch || {}),
    });
}

export async function adminDeleteOrder(id: number) {
    return adminFetch<{ ok: true }>(`/orders/${id}`, {
        method: "DELETE",
    });
}

// -----------------------------
// Admin Catalog helpers (Products / Variants)
// -----------------------------

export interface AdminProductMinimal {
    id: number;
    name: string;
    type: string;
    active?: number;
}

export interface AdminVariantMinimal {
    id: number;
    product_id: number;
    name: string;
    sku?: string | null;
    active: number;
}

export async function adminListProductsMinimal(): Promise<AdminProductMinimal[]> {
    return adminFetch<AdminProductMinimal[]>("/products");
}

export async function adminListVariantsByProduct(productId: number, active: 0 | 1 | 2 | "all" = 1) {
    return adminFetch<AdminVariantMinimal[]>(`/variants/product/${productId}?active=${active}`);
}

export async function adminGetVariantUnitPrice(variantId: number, qty: number) {
    return adminFetch<{ unit_amount_cents: number; currency: string }>(`/variants/${variantId}/price?qty=${qty}`);
}

// -----------------------------
// Admin RFID Keycards helpers (Designs / Lock Tech / Tiers)
// -----------------------------

export interface AdminKeycardDesign {
    id: number;
    brand_id: number | null;
    code: string;
    name: string;
    description: string | null;
    active: number;
    created_at: string;
    brand_name?: string | null;
    image_url?: string | null;
}

export interface AdminLockTech {
    id: number;
    name: string;
    active: number;
    created_at: string;
    tiers_count?: number; // returned by your query
}

export interface AdminKeycardPriceTier {
    id: number;
    lock_tech_id: number;
    min_boxes: number;
    max_boxes: number | null;
    currency: string;
    price_per_box_cents: number;
    active: number;
    created_at: string;
}

export async function adminListKeycardDesigns(params: { active?: 0 | 1; brand_id?: number } = {}) {
    return adminFetch<AdminKeycardDesign[]>(`/keycards/designs${toQuery(params as any)}`);
}

export async function adminListLockTech(params: { active?: 0 | 1 } = {}) {
    return adminFetch<AdminLockTech[]>(`/keycards/lock-tech${toQuery(params as any)}`);
}

export async function adminListKeycardTiers(lockTechId: number, params: { active?: 0 | 1 } = {}) {
    return adminFetch<AdminKeycardPriceTier[]>(`/keycards/lock-tech/${lockTechId}/tiers${toQuery(params as any)}`);
}

// -----------------------------
// Admin Manual Order Create
// -----------------------------

export type ManualOrderItem =
    | { kind: "variant"; variant_id: number; qty: number; override_unit_amount_cents?: number; currency?: string }
    | { kind: "custom"; name: string; description?: string | null; unit_amount_cents: number; qty: number; currency?: string }
    | { kind: "keycard"; lock_tech_id: number; boxes: number; design_id?: number | null };

export interface ManualOrderCreatePayload {
    source: OrderSource;
    payment_method: PaymentMethod;
    payment_status: PaymentStatus;
    external_ref?: string | null;

    shipping_cents?: number;
    tax_cents?: number;
    notes?: string | null;

    customer?: { name?: string | null; email?: string | null; phone?: string | null };
    shipping?: {
        name?: string | null;
        line1?: string | null;
        line2?: string | null;
        city?: string | null;
        state?: string | null;
        postal_code?: string | null;
        country?: string | null;
    };

    items: ManualOrderItem[];
}

export async function adminCreateManualOrder(payload: ManualOrderCreatePayload) {
    return adminFetch<{ order: { id: number } }>(`/orders`, {
        method: "POST",
        body: JSON.stringify(payload),
    });
}
