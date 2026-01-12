// pages/OrdersPage.tsx  (Order Lookup — no login)
import React, { useEffect, useMemo, useState } from "react";
import { useNavigation } from "../src/NavigationContext.tsx";
import { publicApi, type PublicOrder } from "../src/lib/api.ts";

type PaymentStatus = "paid" | "unpaid" | "processing" | "failed" | "refunded";
type FulfillmentStatus = "unfulfilled" | "processing" | "shipped" | "delivered" | "canceled";

type OrderItem = {
    id: string;
    kind: "product" | "keycard";
    title: string;
    sku?: string | null;
    image_url?: string | null;
    quantity: number;
    unit_amount_cents: number;
    meta?: Record<string, any>;
};

type ReceiptInfo = {
    invoice_pdf: string | null;
    hosted_invoice_url: string | null;
    receipt_url: string | null;
};

type Statuses = {
    order_status?: string | null;
    payment_status?: string | null;
    fulfillment_status?: string | null;
    shipping_status?: string | null;
};

type Order = {
    id: string;
    number: string;
    created_at: string;
    currency: "usd";
    customer_email: string;
    customer_name?: string;

    payment_status: PaymentStatus;
    fulfillment_status: FulfillmentStatus;

    payment_method?: string | null;
    subtotal_cents: number;
    tax_cents: number;
    shipping_cents: number;
    total_cents: number;

    stripe_session_id?: string | null; // not returned publicly (kept for UI)
    shipping_address?: {
        line1: string;
        line2?: string;
        city: string;
        state: string;
        postal: string;
        country: string;
    };
    items: OrderItem[];
    receipt?: ReceiptInfo | null;
    statuses?: Statuses;
};

const moneyFromCents = (cents: number, currency: "usd" = "usd") => {
    const n = (Number(cents) || 0) / 100;
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
};

const formatDateTime = (iso: string) => {
    try {
        return new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "2-digit",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
        }).format(new Date(iso));
    } catch {
        return iso;
    }
};

function prettyStatus(s?: string | null) {
    if (!s) return "—";
    return String(s).replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function normalizePaymentStatus(raw: unknown): PaymentStatus {
    const s = String(raw ?? "").toLowerCase();

    if (s === "paid" || s === "succeeded") return "paid";
    if (s === "refunded" || s === "partially_refunded") return "refunded";
    if (s === "failed" || s === "canceled" || s === "cancelled" || s === "expired") return "failed";

    if (s === "unpaid" || s === "pending" || s === "requires_payment_method" || s === "requires_action") return "unpaid";
    if (s === "processing") return "processing";

    return "unpaid";
}

function normalizeFulfillmentStatus(rawFulfillment: unknown, rawShipping: unknown): FulfillmentStatus {
    const f = String(rawFulfillment ?? "").toLowerCase();
    const sh = String(rawShipping ?? "").toLowerCase();

    if (f === "canceled" || f === "cancelled") return "canceled";

    if (sh === "delivered") return "delivered";
    if (sh === "shipped" || sh === "in_transit") return "shipped";

    if (f === "fulfilled") return "delivered";
    if (f === "shipped") return "shipped";
    if (f === "processing") return "processing";
    if (f === "unfulfilled" || f === "pending") return "unfulfilled";

    return "unfulfilled";
}

function pill(payment: PaymentStatus, fulfillment: FulfillmentStatus) {
    if (payment === "failed")
        return { label: "Payment failed", cls: "bg-red-50 text-red-700 border-red-200", icon: "error" };

    if (fulfillment === "canceled")
        return { label: "Canceled", cls: "bg-gray-50 text-gray-700 border-gray-200", icon: "block" };

    if (payment === "refunded")
        return { label: "Refunded", cls: "bg-yellow-50 text-yellow-800 border-yellow-200", icon: "undo" };

    if (payment === "paid" && fulfillment === "delivered")
        return { label: "Delivered", cls: "bg-green-50 text-green-700 border-green-200", icon: "check_circle" };

    if (payment === "paid" && fulfillment === "shipped")
        return { label: "Shipped", cls: "bg-blue-50 text-blue-700 border-blue-200", icon: "local_shipping" };

    if (payment === "paid" && (fulfillment === "processing" || fulfillment === "unfulfilled"))
        return { label: "Processing", cls: "bg-blue-50 text-blue-700 border-blue-200", icon: "sync" };

    if (payment === "processing")
        return { label: "Payment processing", cls: "bg-blue-50 text-blue-700 border-blue-200", icon: "hourglass_top" };

    if (payment === "unpaid")
        return { label: "Pending payment", cls: "bg-yellow-50 text-yellow-800 border-yellow-200", icon: "hourglass_empty" };

    return { label: "Order created", cls: "bg-gray-50 text-gray-700 border-gray-200", icon: "receipt_long" };
}

function mapPublicOrderToUi(o: PublicOrder): Order {
    const v2 = o as any;

    const rawPayment = v2.payment_status ?? o.status;
    const rawFulfillment = v2.fulfillment_status ?? null;
    const rawShipping = v2.shipping_status ?? null;

    const payment_status = normalizePaymentStatus(rawPayment);
    const fulfillment_status = normalizeFulfillmentStatus(rawFulfillment, rawShipping);

    const ship = o.shipping || ({} as any);
    const shipping_address =
        ship.ship_line1 || ship.ship_city || ship.ship_postal_code
            ? {
                line1: ship.ship_line1 ?? "",
                line2: ship.ship_line2 ?? undefined,
                city: ship.ship_city ?? "",
                state: ship.ship_state ?? "",
                postal: ship.ship_postal_code ?? "",
                country: ship.ship_country ?? "",
            }
            : undefined;

    const items: OrderItem[] = (o.items || []).map((it) => {
        const kind = it.item_type === "keycard" ? "keycard" : "product";

        let title =
            (it.description && String(it.description).trim()) ||
            (kind === "keycard" ? `RFID Keycards (Box of ${it.box_size || 200})` : "Item");

        if (kind === "keycard" && it.design_id) title += ` — Design #${it.design_id}`;

        return {
            id: String(it.id),
            kind,
            title,
            sku: null,
            image_url: null,
            quantity: Number(it.quantity || 0),
            unit_amount_cents: Number(it.unit_amount_cents || 0),
            meta: undefined,
        };
    });

    const totalFallback = Number(o.subtotal_cents || 0) + Number(o.tax_cents || 0) + Number(o.shipping_cents || 0);

    return {
        id: String(o.id),
        number: o.order_number,
        created_at: o.created_at,
        currency: "usd",
        customer_email: o.customer?.email ?? "",
        customer_name: o.customer?.name ?? undefined,

        payment_status,
        fulfillment_status,
        payment_method: null,

        subtotal_cents: Number(o.subtotal_cents || 0),
        tax_cents: Number(o.tax_cents || 0),
        shipping_cents: Number(o.shipping_cents || 0),
        total_cents: Number(o.total_cents ?? totalFallback),

        stripe_session_id: null, // controller intentionally doesn’t expose it
        shipping_address,
        items,

        receipt: (v2.receipt ?? null) as any,
        statuses: {
            order_status: v2.order_status ?? null,
            payment_status: v2.payment_status ?? (o.status ?? null),
            fulfillment_status: v2.fulfillment_status ?? null,
            shipping_status: v2.shipping_status ?? null,
        },
    };
}

const OrdersPage: React.FC = () => {
    const { navigate } = useNavigation();

    const params = useMemo(() => new URLSearchParams(window.location.search), []);

    const allowPrefill = useMemo(() => {
        const srcOk = (params.get("src") || "").toLowerCase() === "return";
        let flagOk = false;

        try {
            flagOk = sessionStorage.getItem("lts_orders_prefill_from_return") === "1";
        } catch {
            flagOk = false;
        }

        return srcOk && flagOk;
    }, [params]);

    const preOrder = allowPrefill ? (params.get("order") ?? "") : "";
    const preEmail = allowPrefill ? (params.get("email") ?? "") : "";
    const preZip = allowPrefill ? (params.get("zip") ?? "") : "";

    const [orderNumber, setOrderNumber] = useState(preOrder);
    const [email, setEmail] = useState(preEmail);
    const [zip, setZip] = useState(preZip);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<Order | null>(null);

    useEffect(() => {
        window.scrollTo(0, 0);
        if (preOrder && preEmail && preZip) {
            void handleLookup();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!allowPrefill) return;
        try {
            sessionStorage.removeItem("lts_orders_prefill_from_return");
        } catch {
            // ignore
        }
    }, [allowPrefill]);

    const normalized = (v: string) => v.trim().toLowerCase();
    const normalizeOrder = (v: string) => v.trim().toUpperCase().replace(/\s+/g, "");

    const handleLookup = async () => {
        const o = normalizeOrder(orderNumber);
        const e = normalized(email);
        const z = zip.trim();

        setError(null);
        setResult(null);

        if (!o || o.length < 10) return setError("Enter a valid order number (ex: LTS-2026-000123).");
        if (!e.includes("@")) return setError("Enter the email used during checkout.");
        if (z.length < 4) return setError("Enter your billing/shipping ZIP/Postal code.");

        setLoading(true);

        try {
            const resp = await publicApi.orders.lookup({ order_number: o, email: e, zip: z });

            if (!(resp as any).ok) {
                setError((resp as any).error || "We couldn’t find that order with those details. Double-check and try again.");
                return;
            }

            setResult(mapPublicOrderToUi((resp as any).order));
        } catch (err: any) {
            const msg = String(err?.message ?? "Lookup failed");
            if (/order not found/i.test(msg)) {
                setError("We couldn’t find that order with those details. Double-check and try again.");
            } else {
                setError(msg);
            }
        } finally {
            setLoading(false);
        }
    };

    const receiptUrl =
        result?.receipt?.invoice_pdf ||
        result?.receipt?.hosted_invoice_url ||
        result?.receipt?.receipt_url ||
        null;

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Hero */}
            <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-700 via-blue-600 to-blue-400" />
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_15%_20%,white_0%,transparent_45%),radial-gradient(circle_at_80%_30%,white_0%,transparent_40%)]" />
                <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
                    <div className="max-w-3xl">
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-4 py-1.5 text-xs font-bold text-white w-fit backdrop-blur">
                            <span className="material-symbols-outlined text-[16px]">receipt_long</span>
                            Order Lookup
                        </div>
                        <h1 className="mt-4 text-4xl sm:text-5xl font-bold text-white tracking-tight font-display">
                            Find your order.
                        </h1>
                        <p className="mt-3 text-blue-100 text-lg max-w-2xl">
                            No account needed — just confirm details to securely view your order.
                        </p>

                        <div className="mt-8 flex flex-wrap gap-2 text-sm">
                            <button onClick={() => navigate("HOME")} className="text-blue-100 hover:text-white transition-colors font-medium">
                                Home
                            </button>
                            <span className="text-blue-100/60 font-medium">/</span>
                            <span className="text-white font-semibold">Orders</span>
                        </div>
                    </div>

                    {/* Lookup card */}
                    <div className="mt-10 bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6 max-w-3xl">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Lookup</div>
                                <div className="text-2xl font-bold text-gray-900 font-display">Enter your order details</div>
                                <p className="text-sm text-gray-500 mt-1">Use the order number + email + ZIP/Postal code from checkout.</p>
                            </div>
                            <div className="size-12 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
                                <span className="material-symbols-outlined">lock</span>
                            </div>
                        </div>

                        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="sm:col-span-1">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Order #</label>
                                <input
                                    value={orderNumber}
                                    onChange={(e) => setOrderNumber(e.target.value)}
                                    placeholder="LTS-2026-000123"
                                    className="mt-2 w-full h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                                />
                            </div>

                            <div className="sm:col-span-1">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Email</label>
                                <input
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="guest@customer.com"
                                    className="mt-2 w-full h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                                />
                            </div>

                            <div className="sm:col-span-1">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">ZIP / Postal</label>
                                <input
                                    value={zip}
                                    onChange={(e) => setZip(e.target.value)}
                                    placeholder="46601"
                                    className="mt-2 w-full h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                                />
                            </div>
                        </div>

                        {error ? (
                            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 font-semibold flex items-start gap-2">
                                <span className="material-symbols-outlined text-[20px]">error</span>
                                <div>{error}</div>
                            </div>
                        ) : null}

                        <div className="mt-5 flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={handleLookup}
                                disabled={loading}
                                className="h-12 px-6 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 disabled:opacity-60"
                            >
                                {loading ? (
                                    <>
                                        <span className="material-symbols-outlined text-[20px] animate-spin">sync</span>
                                        Looking up…
                                    </>
                                ) : (
                                    <>
                                        View order
                                        <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                                    </>
                                )}
                            </button>

                            <button
                                onClick={() => navigate("SUPPORT")}
                                className="h-12 px-6 rounded-xl border border-gray-200 bg-white text-gray-800 font-bold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                            >
                                Contact support
                                <span className="material-symbols-outlined text-[20px]">support_agent</span>
                            </button>
                        </div>

                        <div className="mt-4 text-xs text-gray-400">
                            Security note: this page should be backed by server-side verification + rate limiting.
                        </div>
                    </div>
                </div>
            </div>

            {/* Result */}
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-8">
                {!result ? (
                    <div className="max-w-3xl text-sm text-gray-500">
                        Tip: put a <b>“Manage order”</b> link in the confirmation email that opens this page prefilled (order + email + zip),
                        or better, with a <b>secure token</b>.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* Main */}
                        <section className="lg:col-span-8">
                            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                                <div className="px-6 sm:px-8 py-6 border-b border-gray-100">
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                        <div>
                                            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Order</div>
                                            <div className="text-2xl sm:text-3xl font-bold text-gray-900 font-display">{result.number}</div>
                                            <div className="mt-2 text-gray-500">Placed {formatDateTime(result.created_at)}</div>

                                            {result.statuses ? (
                                                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          <span className="px-3 py-1 rounded-full border bg-gray-50 text-gray-700 border-gray-200 font-semibold">
                            Order: {prettyStatus(result.statuses.order_status)}
                          </span>
                                                    <span className="px-3 py-1 rounded-full border bg-gray-50 text-gray-700 border-gray-200 font-semibold">
                            Payment: {prettyStatus(result.statuses.payment_status)}
                          </span>
                                                    <span className="px-3 py-1 rounded-full border bg-gray-50 text-gray-700 border-gray-200 font-semibold">
                            Fulfillment: {prettyStatus(result.statuses.fulfillment_status)}
                          </span>
                                                    <span className="px-3 py-1 rounded-full border bg-gray-50 text-gray-700 border-gray-200 font-semibold">
                            Shipping: {prettyStatus(result.statuses.shipping_status)}
                          </span>
                                                </div>
                                            ) : null}
                                        </div>

                                        {(() => {
                                            const s = pill(result.payment_status, result.fulfillment_status);
                                            return (
                                                <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold ${s.cls}`}>
                          <span className="material-symbols-outlined text-[16px]">{s.icon}</span>
                                                    {s.label}
                        </span>
                                            );
                                        })()}
                                    </div>
                                </div>

                                <div className="p-6 sm:p-8">
                                    <h3 className="text-lg font-bold text-gray-900 font-display">Items</h3>
                                    <div className="mt-4 rounded-2xl border border-gray-200 overflow-hidden">
                                        <div className="divide-y divide-gray-200">
                                            {result.items.map((it) => (
                                                <div key={it.id} className="p-4 sm:p-5 flex items-center gap-4 bg-white">
                                                    <div className="h-14 w-14 rounded-xl border border-gray-200 bg-gray-50 p-2 overflow-hidden flex items-center justify-center">
                                                        {it.image_url ? (
                                                            <img src={it.image_url} alt={it.title} className="h-full w-full object-contain mix-blend-multiply" />
                                                        ) : (
                                                            <span className="material-symbols-outlined text-gray-400">image</span>
                                                        )}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="font-bold text-gray-900 truncate">{it.title}</div>
                                                        <div className="mt-1 text-xs text-gray-500 space-y-1">
                                                            {it.sku ? <div>SKU: {it.sku}</div> : null}
                                                            {it.kind === "keycard" && it.meta?.lockTechName ? <div>Lock tech: {it.meta.lockTechName}</div> : null}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-sm font-bold text-gray-900">
                                                            {moneyFromCents(it.unit_amount_cents)}{" "}
                                                            <span className="text-xs text-gray-400 font-medium">× {it.quantity}</span>
                                                        </div>
                                                        <div className="text-xs text-gray-500 mt-1">{moneyFromCents(it.unit_amount_cents * it.quantity)}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="rounded-2xl border border-gray-200 bg-white p-5">
                                            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Customer</div>
                                            <div className="mt-2 font-bold text-gray-900">{result.customer_name ?? "Customer"}</div>
                                            <div className="text-sm text-gray-600">{result.customer_email}</div>

                                            {result.shipping_address ? (
                                                <div className="mt-4 text-sm text-gray-600">
                                                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Shipping</div>
                                                    <div className="mt-2">
                                                        {result.shipping_address.line1}
                                                        {result.shipping_address.line2 ? `, ${result.shipping_address.line2}` : ""}
                                                    </div>
                                                    <div>
                                                        {result.shipping_address.city}, {result.shipping_address.state} {result.shipping_address.postal}
                                                    </div>
                                                    <div>{result.shipping_address.country}</div>
                                                </div>
                                            ) : null}
                                        </div>

                                        <div className="rounded-2xl border border-gray-200 bg-white p-5">
                                            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Totals</div>
                                            <div className="mt-4 space-y-3 text-sm">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-gray-500">Subtotal</span>
                                                    <span className="font-bold text-gray-900">{moneyFromCents(result.subtotal_cents)}</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-gray-500">Shipping</span>
                                                    <span className="font-bold text-gray-900">
                            {result.shipping_cents === 0 ? <span className="text-green-600">Free</span> : moneyFromCents(result.shipping_cents)}
                          </span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-gray-500">Tax</span>
                                                    <span className="font-bold text-gray-900">{moneyFromCents(result.tax_cents)}</span>
                                                </div>
                                                <div className="pt-3 border-t border-gray-200 flex items-end justify-between">
                                                    <span className="text-gray-900 font-semibold">Total</span>
                                                    <span className="text-2xl font-bold text-gray-900">{moneyFromCents(result.total_cents)}</span>
                                                </div>
                                            </div>

                                            <div className="mt-4 text-xs text-gray-400 font-mono break-all">
                                                Order ID: {result.id}
                                                <br />
                                                Stripe: {result.stripe_session_id ?? "—"}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-8 flex flex-col sm:flex-row gap-3">
                                        <button
                                            type="button"
                                            onClick={() => receiptUrl && window.open(receiptUrl, "_blank", "noopener,noreferrer")}
                                            disabled={!receiptUrl}
                                            className="h-12 px-6 rounded-xl border border-gray-200 bg-white text-gray-800 font-bold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            View Receipt
                                            <span className="material-symbols-outlined text-[20px]">link</span>
                                        </button>

                                        <button
                                            onClick={() => alert("Coming soon: Reorder")}
                                            className="h-12 px-6 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                                        >
                                            Reorder
                                            <span className="material-symbols-outlined text-[20px]">shopping_cart</span>
                                        </button>

                                        <button
                                            onClick={() => navigate("PRODUCTS")}
                                            className="h-12 px-6 rounded-xl border border-gray-200 bg-white text-gray-800 font-bold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                                        >
                                            Continue shopping
                                            <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Side */}
                        <aside className="lg:col-span-4">
                            <div className="sticky top-24 space-y-4">
                                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                                    <h3 className="text-lg font-bold text-gray-900 font-display">Need changes?</h3>
                                    <div className="mt-4 space-y-4">
                                        {[
                                            { icon: "edit", title: "Edit shipping details", desc: "Allowed only before fulfillment begins." },
                                            { icon: "undo", title: "Refund / cancel", desc: "Depends on payment + fulfillment status." },
                                            { icon: "support_agent", title: "Talk to support", desc: "Fastest way to fix edge cases." },
                                        ].map((x) => (
                                            <div key={x.title} className="flex items-start gap-3">
                                                <div className="size-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
                                                    <span className="material-symbols-outlined">{x.icon}</span>
                                                </div>
                                                <div>
                                                    <div className="font-bold text-gray-900">{x.title}</div>
                                                    <div className="text-sm text-gray-500">{x.desc}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        onClick={() => navigate("SUPPORT")}
                                        className="mt-5 w-full h-12 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors"
                                    >
                                        Contact support
                                    </button>
                                </div>

                                <p className="text-xs text-gray-400">
                                    Backend must: verify lookup details, rate-limit requests, and return a generic “not found” response to prevent enumeration.
                                </p>
                            </div>
                        </aside>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OrdersPage;
