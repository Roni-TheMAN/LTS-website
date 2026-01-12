// pages/CheckoutReturnPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigation } from "../src/NavigationContext.tsx";
import {
    publicApi,
    type PublicOrder,
    type PublicOrderResponse,
    type StripeSessionStatusResponse,
} from "../src/lib/api.ts";

type PaymentStatus = "paid" | "unpaid" | "processing" | "failed";
type FulfillmentStatus = "unfulfilled" | "processing" | "shipped" | "delivered";

type ReceiptInfo = {
    invoice_pdf: string | null;
    hosted_invoice_url: string | null;
    receipt_url: string | null;
};

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

type Statuses = {
    order_status?: string | null;
    payment_status?: string | null;
    fulfillment_status?: string | null;
    shipping_status?: string | null;
};

type Order = {
    id: string; // internal
    number: string; // customer-facing
    created_at: string; // ISO
    currency: "usd";
    customer_email: string;
    customer_name?: string;
    payment_status: PaymentStatus;
    fulfillment_status: FulfillmentStatus;
    subtotal_cents: number;
    tax_cents: number;
    shipping_cents: number;
    total_cents: number;
    items: OrderItem[];
    stripe_session_id?: string | null;
    shipping_address?: {
        line1: string;
        line2?: string;
        city: string;
        state: string;
        postal: string;
        country: string;
    };
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

function statusBadge(payment: PaymentStatus) {
    switch (payment) {
        case "paid":
            return { label: "Paid", cls: "bg-green-50 text-green-700 border-green-200", icon: "check_circle" };
        case "processing":
            return { label: "Processing", cls: "bg-blue-50 text-blue-700 border-blue-200", icon: "sync" };
        case "unpaid":
            return { label: "Pending", cls: "bg-yellow-50 text-yellow-800 border-yellow-200", icon: "hourglass_empty" };
        case "failed":
            return { label: "Failed", cls: "bg-red-50 text-red-700 border-red-200", icon: "error" };
    }
}

function heroFor(payment: PaymentStatus) {
    if (payment === "paid") {
        return {
            title: "Payment confirmed.",
            subtitle: "Your order is in the system — we’ll start processing it right away.",
            icon: "verified",
            accent: "from-blue-700 via-blue-600 to-blue-400",
        };
    }
    if (payment === "processing" || payment === "unpaid") {
        return {
            title: "We’re verifying your payment.",
            subtitle: "This can take a moment. If it stays pending, check your email or contact support.",
            icon: "hourglass_top",
            accent: "from-blue-700 via-blue-600 to-blue-400",
        };
    }
    return {
        title: "Payment didn’t go through.",
        subtitle: "No worries — you can try again, or contact us and we’ll help immediately.",
        icon: "report",
        accent: "from-red-700 via-red-600 to-red-400",
    };
}

function normalizePaymentStatus(raw: unknown): PaymentStatus {
    const s = String(raw ?? "").toLowerCase();

    if (s === "paid" || s === "succeeded") return "paid";
    if (s === "refunded" || s === "partially_refunded") return "failed";
    if (s === "failed" || s === "canceled" || s === "cancelled" || s === "expired") return "failed";

    if (s === "unpaid" || s === "pending" || s === "requires_payment_method" || s === "requires_action") return "unpaid";
    if (s === "processing") return "processing";

    return "processing";
}

function normalizeFulfillmentStatus(rawFulfillment: unknown, rawShipping: unknown): FulfillmentStatus {
    const f = String(rawFulfillment ?? "").toLowerCase();
    const sh = String(rawShipping ?? "").toLowerCase();

    if (sh === "delivered") return "delivered";
    if (sh === "shipped" || sh === "in_transit") return "shipped";

    if (f === "fulfilled") return "delivered";
    if (f === "shipped") return "shipped";
    if (f === "processing") return "processing";
    if (f === "unfulfilled" || f === "pending") return "unfulfilled";

    return "unfulfilled";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function totalsLookIncomplete(o: Order | null) {
    if (!o) return false;
    const subtotal = Number(o.subtotal_cents || 0);
    const total = Number(o.total_cents || 0);
    const tax = Number(o.tax_cents || 0);
    const ship = Number(o.shipping_cents || 0);

    // common race: total already known (from Stripe) but DB tax+shipping still 0
    return total > subtotal && tax === 0 && ship === 0;
}

const CheckoutReturnPage: React.FC = () => {
    const { navigate } = useNavigation();

    const [loading, setLoading] = useState(true);
    const [syncingTotals, setSyncingTotals] = useState(false);
    const [copied, setCopied] = useState<string | null>(null);
    const [order, setOrder] = useState<Order | null>(null);
    const [error, setError] = useState<string | null>(null);

    const query = useMemo(() => new URLSearchParams(window.location.search), []);
    const sessionId = query.get("session_id") || query.get("session") || "";
    const orderId = query.get("order_id") || query.get("order") || "";
    const statusParam = (query.get("status") || "").toLowerCase();

    const initialPaymentStatus: PaymentStatus = useMemo(() => {
        if (statusParam === "paid" || statusParam === "success") return "paid";
        if (statusParam === "processing") return "processing";
        if (statusParam === "unpaid" || statusParam === "pending") return "unpaid";
        if (statusParam === "failed" || statusParam === "canceled" || statusParam === "cancelled") return "failed";
        return sessionId ? "processing" : "unpaid";
    }, [sessionId, statusParam]);

    function mapStripeToPaymentStatus(s: StripeSessionStatusResponse | null): PaymentStatus {
        const sessionStatus = (s?.status || "").toLowerCase();
        const pay = (s?.payment_status || "").toLowerCase();

        if (sessionStatus === "expired") return "failed";
        if (pay === "paid") return "paid";
        if (pay === "unpaid") return sessionStatus === "complete" ? "processing" : "unpaid";
        if (sessionStatus === "complete") return "processing";
        return "processing";
    }

    function mapPublicOrderToUi(o: PublicOrder, stripe: StripeSessionStatusResponse | null): Order {
        const v2 = o as any;

        const rawPayment = v2.payment_status ?? o.status;
        const rawFulfillment = v2.fulfillment_status ?? null;
        const rawShipping = v2.shipping_status ?? null;

        const dbPayment = normalizePaymentStatus(rawPayment);
        const payment_status = stripe ? mapStripeToPaymentStatus(stripe) : dbPayment;

        const fulfillment_status = normalizeFulfillmentStatus(rawFulfillment, rawShipping);

        const shippingFromOrder = o.shipping;
        const shippingFromStripe = stripe?.shipping_details?.address || null;

        const shipping_address = shippingFromOrder?.ship_line1
            ? {
                line1: String(shippingFromOrder.ship_line1 || ""),
                line2: shippingFromOrder.ship_line2 || undefined,
                city: String(shippingFromOrder.ship_city || ""),
                state: String(shippingFromOrder.ship_state || ""),
                postal: String(shippingFromOrder.ship_postal_code || ""),
                country: String(shippingFromOrder.ship_country || ""),
            }
            : shippingFromStripe
                ? {
                    line1: String(shippingFromStripe.line1 || ""),
                    line2: shippingFromStripe.line2 || undefined,
                    city: String(shippingFromStripe.city || ""),
                    state: String(shippingFromStripe.state || ""),
                    postal: String(shippingFromStripe.postal_code || ""),
                    country: String(shippingFromStripe.country || ""),
                }
                : undefined;

        const items: OrderItem[] = (o.items || []).map((it) => {
            const isKeycard = it.item_type === "keycard";
            const title =
                it.description?.trim() ||
                (isKeycard
                    ? `RFID Keycards (Box of ${it.box_size || 200})`
                    : it.variant_id
                        ? `Variant #${it.variant_id}`
                        : it.product_id
                            ? `Product #${it.product_id}`
                            : `Item #${it.id}`);

            return {
                id: String(it.id),
                kind: isKeycard ? "keycard" : "product",
                title,
                sku: null,
                image_url: null,
                quantity: Number(it.quantity || 0),
                unit_amount_cents: Number(it.unit_amount_cents || 0),
                meta: {
                    product_id: it.product_id,
                    variant_id: it.variant_id,
                    design_id: it.design_id,
                    lock_tech_id: it.lock_tech_id,
                    boxes: it.boxes,
                },
            };
        });

        const subtotal = Number(o.subtotal_cents ?? (stripe as any)?.amount_subtotal ?? 0);
        const total = Number((stripe as any)?.amount_total ?? subtotal);

        // If you later return these from /session-status, this will instantly populate tax/shipping.
        const stripeTax = Number((stripe as any)?.amount_tax ?? (stripe as any)?.total_details?.amount_tax ?? 0);
        const stripeShipping = Number((stripe as any)?.amount_shipping ?? (stripe as any)?.total_details?.amount_shipping ?? 0);

        const orderTax = Number(o.tax_cents || 0);
        const orderShip = Number(o.shipping_cents || 0);

        const receipt: ReceiptInfo | null = (v2.receipt ?? null) as any;

        return {
            id: String(o.id),
            number: o.order_number || (stripe as any)?.order_number || orderId || "—",
            created_at: o.created_at || new Date().toISOString(),
            currency: "usd",
            customer_email: (stripe?.customer_email || o.customer?.email || "").toString(),
            customer_name: ((stripe as any)?.customer_name ?? o.customer?.name) ?? undefined,
            payment_status,
            fulfillment_status,
            subtotal_cents: subtotal,
            tax_cents: orderTax > 0 ? orderTax : stripeTax || 0,
            shipping_cents: orderShip > 0 ? orderShip : stripeShipping || 0,
            total_cents: total,
            items,
            stripe_session_id: sessionId || null,
            shipping_address,
            receipt,
            statuses: {
                order_status: v2.order_status ?? null,
                payment_status: v2.payment_status ?? (o.status ?? null),
                fulfillment_status: v2.fulfillment_status ?? null,
                shipping_status: v2.shipping_status ?? null,
            },
        };
    }

    const goToPrefilledOrderLookup = () => {
        const orderNumber = (order?.number || "").trim();
        const customerEmail = (order?.customer_email || "").trim().toLowerCase();
        const postal = (order?.shipping_address?.postal || "").trim();

        const qs = new URLSearchParams();
        if (orderNumber) qs.set("order", orderNumber);
        if (customerEmail) qs.set("email", customerEmail);
        if (postal) qs.set("zip", postal);
        qs.set("src", "return");

        try {
            sessionStorage.setItem("lts_orders_prefill_from_return", "1");
        } catch {
            // ignore
        }

        window.location.assign(`/orders?${qs.toString()}`);
    };

    useEffect(() => {
        window.scrollTo(0, 0);
        let cancelled = false;

        const pollForTotals = async (stripe: StripeSessionStatusResponse | null, current: Order | null) => {
            if (!sessionId) return;
            if (!totalsLookIncomplete(current)) return;

            setSyncingTotals(true);

            // ~14 seconds max
            for (let i = 0; i < 12; i++) {
                if (cancelled) return;
                await sleep(1200);
                if (cancelled) return;

                const latest = await publicApi.orders.bySession(sessionId).catch(() => null);
                if (cancelled) return;

                if (latest && (latest as any).ok) {
                    const next = mapPublicOrderToUi((latest as any).order, stripe);
                    setOrder(next);

                    if (!totalsLookIncomplete(next)) break;
                }
            }

            if (!cancelled) setSyncingTotals(false);
        };

        const run = async () => {
            setLoading(true);
            setError(null);

            if (!sessionId && !orderId) {
                setOrder(null);
                setError("Missing session_id in the return URL.");
                setLoading(false);
                return;
            }

            const stripeP = sessionId ? publicApi.stripe.sessionStatus(sessionId) : Promise.resolve(null);
            const orderP = sessionId ? publicApi.orders.bySession(sessionId) : Promise.resolve(null);

            const [stripeR, orderR] = await Promise.allSettled([stripeP, orderP]);
            if (cancelled) return;

            const stripe = stripeR.status === "fulfilled" ? stripeR.value : null;
            const orderRes: PublicOrderResponse | null =
                orderR.status === "fulfilled" ? (orderR.value as PublicOrderResponse) : null;

            if (orderRes && (orderRes as any).ok) {
                const mapped = mapPublicOrderToUi((orderRes as any).order, stripe);
                setOrder(mapped);
                setLoading(false);
                void pollForTotals(stripe, mapped);
                return;
            }

            // fallback: Stripe only
            if (stripe) {
                const fallback: Order = {
                    id: orderId || "—",
                    number: (stripe as any).order_number || orderId || "—",
                    created_at: new Date().toISOString(),
                    currency: "usd",
                    customer_email: stripe.customer_email || "",
                    customer_name: (stripe as any).customer_name || undefined,
                    payment_status: mapStripeToPaymentStatus(stripe),
                    fulfillment_status: "unfulfilled",
                    subtotal_cents: Number((stripe as any).amount_subtotal ?? 0),
                    tax_cents: Number((stripe as any).amount_tax ?? (stripe as any).total_details?.amount_tax ?? 0),
                    shipping_cents: Number((stripe as any).amount_shipping ?? (stripe as any).total_details?.amount_shipping ?? 0),
                    total_cents: Number((stripe as any).amount_total ?? (stripe as any).amount_subtotal ?? 0),
                    items: [],
                    stripe_session_id: sessionId || null,
                    shipping_address: stripe.shipping_details?.address
                        ? {
                            line1: String(stripe.shipping_details.address.line1 || ""),
                            line2: stripe.shipping_details.address.line2 || undefined,
                            city: String(stripe.shipping_details.address.city || ""),
                            state: String(stripe.shipping_details.address.state || ""),
                            postal: String(stripe.shipping_details.address.postal_code || ""),
                            country: String(stripe.shipping_details.address.country || ""),
                        }
                        : undefined,
                    receipt: null,
                    statuses: undefined,
                };

                setOrder(fallback);
                setLoading(false);
                void pollForTotals(stripe, fallback);
                return;
            }

            setOrder(null);
            setError("Could not load order details. Please refresh, or contact support with your session ID.");
            setLoading(false);
        };

        run();
        return () => {
            cancelled = true;
        };
    }, [orderId, sessionId]);

    const hero = heroFor(order?.payment_status ?? initialPaymentStatus);
    const badge = statusBadge(order?.payment_status ?? initialPaymentStatus);

    const steps = useMemo(() => {
        const paid = (order?.payment_status ?? initialPaymentStatus) === "paid";
        const failed = (order?.payment_status ?? initialPaymentStatus) === "failed";
        return [
            { title: "Order created", done: true, icon: "receipt_long" },
            { title: "Payment", done: paid, icon: paid ? "check_circle" : failed ? "error" : "hourglass_empty" },
            { title: "Processing", done: paid, icon: "inventory_2" },
            {
                title: "Shipped",
                done: (order?.fulfillment_status ?? "unfulfilled") === "shipped" || (order?.fulfillment_status ?? "unfulfilled") === "delivered",
                icon: "local_shipping",
            },
        ];
    }, [initialPaymentStatus, order?.payment_status, order?.fulfillment_status]);

    const copy = async (label: string, value: string) => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(label);
            window.setTimeout(() => setCopied(null), 900);
        } catch {
            // ignore
        }
    };

    const receiptUrl =
        order?.receipt?.invoice_pdf ||
        order?.receipt?.hosted_invoice_url ||
        order?.receipt?.receipt_url ||
        null;

    const totalsPending = syncingTotals || totalsLookIncomplete(order);

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Hero */}
            <div className="relative overflow-hidden">
                <div className={`absolute inset-0 bg-gradient-to-r ${hero.accent}`} />
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_15%_20%,white_0%,transparent_45%),radial-gradient(circle_at_80%_30%,white_0%,transparent_40%)]" />
                <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
                    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
                        <div className="max-w-3xl">
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-4 py-1.5 text-xs font-bold text-white w-fit backdrop-blur">
                                <span className="material-symbols-outlined text-[16px]">{hero.icon}</span>
                                Checkout Return
                            </div>

                            <h1 className="mt-4 text-4xl sm:text-5xl font-bold text-white tracking-tight font-display">
                                {hero.title}
                            </h1>
                            <p className="mt-3 text-blue-100 text-lg max-w-2xl">{hero.subtitle}</p>

                            {/* Breadcrumb */}
                            <div className="mt-8 flex flex-wrap gap-2 text-sm">
                                <button onClick={() => navigate("HOME")} className="text-blue-100 hover:text-white transition-colors font-medium">
                                    Home
                                </button>
                                <span className="text-blue-100/60 font-medium">/</span>
                                <button onClick={() => navigate("CHECKOUT")} className="text-blue-100 hover:text-white transition-colors font-medium">
                                    Checkout
                                </button>
                                <span className="text-blue-100/60 font-medium">/</span>
                                <span className="text-white font-semibold">Return</span>
                            </div>
                        </div>

                        {/* Status pill */}
                        <div className="w-full lg:w-[420px]">
                            <div className="bg-white/10 border border-white/20 rounded-2xl p-4 backdrop-blur-md">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="text-white">
                                        <div className="text-xs font-bold uppercase tracking-wider text-white/80">Payment status</div>
                                        <div className="mt-1 text-2xl font-bold">{badge.label}</div>
                                    </div>
                                    <div className="size-12 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-white">{badge.icon}</span>
                                    </div>
                                </div>

                                <div className="mt-4 grid grid-cols-4 gap-2">
                                    {steps.map((s) => (
                                        <div
                                            key={s.title}
                                            className={`rounded-xl border px-3 py-3 text-center ${
                                                s.done ? "border-white/25 bg-white/15" : "border-white/15 bg-white/10"
                                            }`}
                                        >
                                            <div className="flex justify-center">
                        <span className={`material-symbols-outlined text-[18px] ${s.done ? "text-white" : "text-white/70"}`}>
                          {s.icon}
                        </span>
                                            </div>
                                            <div className={`mt-1 text-[10px] font-bold uppercase tracking-wider ${s.done ? "text-white" : "text-white/70"}`}>
                                                {s.title}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {loading ? (
                                    <div className="mt-4 text-xs text-blue-100 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                                        Verifying order details…
                                    </div>
                                ) : totalsPending ? (
                                    <div className="mt-4 text-xs text-blue-100 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                                        Finalizing tax & shipping…
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-6">
                {error ? (
                    <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 sm:p-5 text-red-900">
                        <div className="flex items-start gap-3">
                            <span className="material-symbols-outlined mt-0.5">error</span>
                            <div className="min-w-0">
                                <div className="font-bold">We couldn’t load your full order details.</div>
                                <div className="mt-1 text-sm text-red-800">{error}</div>
                                {sessionId ? (
                                    <div className="mt-2 text-xs text-red-800">
                                        Session ID: <code className="font-mono">{sessionId}</code>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>
                ) : null}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-4">
                    {/* Left: main card */}
                    <section className="lg:col-span-8">
                        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                            <div className="px-6 sm:px-8 py-6 border-b border-gray-100">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                    <div>
                                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Order</div>
                                        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 font-display">
                                            {order?.number ?? "—"}
                                        </h2>
                                        <p className="text-gray-500 mt-2">
                                            Placed {order ? formatDateTime(order.created_at) : "—"} •{" "}
                                            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold ${badge.cls}`}>
                        <span className="material-symbols-outlined text-[16px]">{badge.icon}</span>
                                                {badge.label}
                      </span>
                                        </p>

                                        {order?.statuses ? (
                                            <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <span className="px-3 py-1 rounded-full border bg-gray-50 text-gray-700 border-gray-200 font-semibold">
                          Order: {prettyStatus(order.statuses.order_status)}
                        </span>
                                                <span className="px-3 py-1 rounded-full border bg-gray-50 text-gray-700 border-gray-200 font-semibold">
                          Payment: {prettyStatus(order.statuses.payment_status)}
                        </span>
                                                <span className="px-3 py-1 rounded-full border bg-gray-50 text-gray-700 border-gray-200 font-semibold">
                          Fulfillment: {prettyStatus(order.statuses.fulfillment_status)}
                        </span>
                                                <span className="px-3 py-1 rounded-full border bg-gray-50 text-gray-700 border-gray-200 font-semibold">
                          Shipping: {prettyStatus(order.statuses.shipping_status)}
                        </span>
                                            </div>
                                        ) : null}
                                    </div>

                                    <div className="mt-8 flex flex-col sm:flex-row gap-3">
                                        {receiptUrl ? (
                                            <button
                                                onClick={() => window.open(receiptUrl, "_blank", "noopener,noreferrer")}
                                                className="h-11 w-36 px-5 rounded-xl border border-gray-200 bg-white text-gray-800 font-bold hover:bg-gray-50 transition-colors "
                                            >
                                               View Receipt

                                            </button>
                                        ) : null}

                                        <button
                                            onClick={goToPrefilledOrderLookup}
                                            className="h-11 w-36 px-5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20"
                                        >
                                            View  order
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 sm:p-8">
                                {/* IDs */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Order ID</div>
                                        <div className="mt-2 flex items-center justify-between gap-3">
                                            <div className="font-mono text-sm text-gray-900 break-all">{order?.id ?? (orderId || "—")}</div>
                                            <button
                                                onClick={() => copy("order", (order?.id ?? orderId) as string)}
                                                className="shrink-0 px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-800 font-bold hover:bg-gray-50 transition-colors text-xs"
                                                disabled={!(order?.id || orderId)}
                                            >
                                                {copied === "order" ? "Copied" : "Copy"}
                                            </button>
                                        </div>
                                        <div className="mt-2 text-xs text-gray-500">Use this when contacting support.</div>
                                    </div>

                                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Stripe Session</div>
                                        <div className="mt-2 flex items-center justify-between gap-3">
                                            <div className="font-mono text-sm text-gray-900 break-all">{order?.stripe_session_id ?? (sessionId || "—")}</div>
                                            <button
                                                onClick={() => copy("session", (order?.stripe_session_id ?? sessionId) as string)}
                                                className="shrink-0 px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-800 font-bold hover:bg-gray-50 transition-colors text-xs"
                                                disabled={!(order?.stripe_session_id || sessionId)}
                                            >
                                                {copied === "session" ? "Copied" : "Copy"}
                                            </button>
                                        </div>
                                        <div className="mt-2 text-xs text-gray-500">Backend should verify using this value.</div>
                                    </div>
                                </div>

                                {/* Items */}
                                <div className="mt-8">
                                    <h3 className="text-lg font-bold text-gray-900 font-display">Order summary</h3>
                                    <div className="mt-4 rounded-2xl border border-gray-200 overflow-hidden">
                                        <div className="divide-y divide-gray-200">
                                            {(order?.items ?? []).map((it) => (
                                                <div key={it.id} className="p-4 sm:p-5 flex items-center gap-4 bg-white">
                                                    <div className="h-14 w-14 rounded-xl border border-gray-200 bg-gray-50 p-2 overflow-hidden flex items-center justify-center">
                                                        {it.image_url ? (
                                                            <img src={it.image_url} alt={it.title} className="h-full w-full object-contain mix-blend-multiply" />
                                                        ) : (
                                                            <span className="material-symbols-outlined text-gray-400">image</span>
                                                        )}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <div className="font-bold text-gray-900 truncate">{it.title}</div>
                                                            {it.kind === "keycard" ? (
                                                                <span className="text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider border bg-blue-50 text-blue-700 border-blue-200">
                                  Keycards
                                </span>
                                                            ) : (
                                                                <span className="text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider border bg-gray-50 text-gray-700 border-gray-200">
                                  Product
                                </span>
                                                            )}
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

                                    {/* Totals */}
                                    <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="rounded-2xl border border-gray-200 bg-white p-5">
                                            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Customer</div>
                                            <div className="mt-2 font-bold text-gray-900">{order?.customer_name ?? "Customer"}</div>
                                            <div className="text-sm text-gray-600">{order?.customer_email ?? "—"}</div>

                                            {order?.shipping_address ? (
                                                <div className="mt-4 text-sm text-gray-600">
                                                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Shipping</div>
                                                    <div className="mt-2">
                                                        {order.shipping_address.line1}
                                                        {order.shipping_address.line2 ? `, ${order.shipping_address.line2}` : ""}
                                                    </div>
                                                    <div>
                                                        {order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.postal}
                                                    </div>
                                                    <div>{order.shipping_address.country}</div>
                                                </div>
                                            ) : null}
                                        </div>

                                        <div className="rounded-2xl border border-gray-200 bg-white p-5">
                                            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Totals</div>
                                            <div className="mt-4 space-y-3 text-sm">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-gray-500">Subtotal</span>
                                                    <span className="font-bold text-gray-900">{moneyFromCents(order?.subtotal_cents ?? 0)}</span>
                                                </div>

                                                <div className="flex items-center justify-between">
                                                    <span className="text-gray-500">Shipping</span>
                                                    <span className="font-bold text-gray-900">
                            {totalsPending ? (
                                <span className="text-gray-500">Finalizing…</span>
                            ) : (order?.shipping_cents ?? 0) === 0 ? (
                                <span className="text-green-600">Free</span>
                            ) : (
                                moneyFromCents(order?.shipping_cents ?? 0)
                            )}
                          </span>
                                                </div>

                                                <div className="flex items-center justify-between">
                                                    <span className="text-gray-500">Tax</span>
                                                    <span className="font-bold text-gray-900">
                            {totalsPending ? <span className="text-gray-500">Finalizing…</span> : moneyFromCents(order?.tax_cents ?? 0)}
                          </span>
                                                </div>

                                                <div className="pt-3 border-t border-gray-200 flex items-end justify-between">
                                                    <span className="text-gray-900 font-semibold">Total</span>
                                                    <span className="text-2xl font-bold text-gray-900">{moneyFromCents(order?.total_cents ?? 0)}</span>
                                                </div>
                                            </div>

                                            {totalsPending ? (
                                                <p className="mt-3 text-xs text-gray-400 flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                                                    We’re syncing the final breakdown from Stripe/webhook.
                                                </p>
                                            ) : (
                                                <p className="mt-3 text-xs text-gray-400">If available, receipt links are shown above.</p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Action row */}
                                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                                    {(order?.payment_status ?? initialPaymentStatus) === "failed" ? (
                                        <button
                                            onClick={() => navigate("CART")}
                                            className="h-12 px-6 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                                        >
                                            Try again
                                            <span className="material-symbols-outlined text-[20px]">refresh</span>
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => navigate("PRODUCTS")}
                                            className="h-12 px-6 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                                        >
                                            Continue shopping
                                            <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                                        </button>
                                    )}

                                    <button
                                        onClick={() => navigate("SUPPORT")}
                                        className="h-12 px-6 rounded-xl border border-gray-200 bg-white text-gray-800 font-bold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                                    >
                                        Contact support
                                        <span className="material-symbols-outlined text-[20px]">support_agent</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Right: tips / next steps */}
                    <aside className="lg:col-span-4">
                        <div className="sticky top-24 space-y-4">
                            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                                <h3 className="text-lg font-bold text-gray-900 font-display">What happens next</h3>
                                <div className="mt-4 space-y-4">
                                    {[
                                        { icon: "mail", title: "Email receipt", desc: "You’ll get a receipt + order confirmation email." },
                                        { icon: "inventory_2", title: "We process your order", desc: "We verify items and prep fulfillment." },
                                        { icon: "local_shipping", title: "Shipping updates", desc: "Tracking is sent once the label is created." },
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
                            </div>

                            <div className="rounded-2xl bg-blue-600 p-6 text-white relative overflow-hidden">
                                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_20%,white_0%,transparent_45%),radial-gradient(circle_at_80%_40%,white_0%,transparent_40%)]" />
                                <div className="relative">
                                    <div className="flex items-center gap-2 text-white/90 text-xs font-bold uppercase tracking-wider">
                                        <span className="material-symbols-outlined text-[18px]">bolt</span>
                                        Pro tip
                                    </div>
                                    <h3 className="mt-2 text-2xl font-bold font-display">Save time on repeat orders</h3>
                                    <p className="mt-2 text-blue-100">Your Orders page can show “Reorder” for your common bundles.</p>
                                    <button
                                        onClick={() => navigate("ORDERS")}
                                        className="mt-4 h-12 px-6 rounded-xl bg-white text-blue-700 font-bold hover:bg-blue-50 transition-colors shadow-lg shadow-blue-900/20"
                                    >
                                        Go to Orders
                                    </button>
                                </div>
                            </div>

                            <p className="text-xs text-gray-400">If you’re ever unsure, send us the Order ID and we’ll help fast.</p>
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    );
};

export default CheckoutReturnPage;
