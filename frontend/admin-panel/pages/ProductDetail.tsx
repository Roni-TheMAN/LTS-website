// import React, { useEffect, useMemo, useRef, useState } from "react";
// import { useNavigate, useParams } from "react-router-dom";
// import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
// import {
//     adminAssetUrl,
//     adminGetOrder,
//     adminUpdateOrder,
//     type FulfillmentStatus,
//     type OrderStatus,
//     type PaymentStatus,
//     type ShippingStatus,
// } from "../src/lib/api";
// import {
//     ChevronRight,
//     CheckCircle,
//     Printer,
//     Truck,
//     Image,
//     Copy,
//     CreditCard,
//     Lock,
//     Send,
//     AlertTriangle,
//     XCircle,
//     Clock,
// } from "lucide-react";
//
// type OrderItemType = "regular" | "keycard";
//
// type PriceSource = "catalog" | "override" | "custom";
//
// type AdminOrder = {
//     id: number;
//     order_number: string | null;
//
//     order_status: OrderStatus;
//     payment_status: PaymentStatus;
//     fulfillment_status: FulfillmentStatus;
//     shipping_status: ShippingStatus;
//
//     source: "web" | "phone" | "manual";
//     payment_method: "stripe" | "cash" | "check" | "invoice" | "other";
//
//     external_ref: string | null;
//
//     currency: string;
//     subtotal_cents: number;
//     tax_cents: number;
//     shipping_cents: number;
//     total_cents: number;
//
//     customer_email: string | null;
//     customer_phone: string | null;
//     customer_name: string | null;
//
//     ship_name: string | null;
//     ship_line1: string | null;
//     ship_line2: string | null;
//     ship_city: string | null;
//     ship_state: string | null;
//     ship_postal_code: string | null;
//     ship_country: string | null;
//
//     bill_name: string | null;
//     bill_line1: string | null;
//     bill_line2: string | null;
//     bill_city: string | null;
//     bill_state: string | null;
//     bill_postal_code: string | null;
//     bill_country: string | null;
//
//     stripe_checkout_session_id: string | null;
//     stripe_payment_intent_id: string | null;
//     stripe_customer_id: string | null;
//
//     notes: string | null;
//     metadata_json: string | null;
//
//     created_at: string;
//     paid_at: string | null;
//     updated_at: string;
// };
//
// type AdminOrderItem = {
//     id: number;
//     order_id: number;
//
//     item_type: OrderItemType;
//
//     product_id: number | null;
//     variant_id: number | null;
//     design_id: number | null;
//     lock_tech_id: number | null;
//     box_size: number;
//     boxes: number | null;
//
//     price_source: PriceSource;
//
//     stripe_price_id: string | null;
//     stripe_product_id: string | null;
//
//     currency: string;
//     unit_amount_cents: number;
//     quantity: number;
//     line_total_cents: number;
//
//     description: string | null;
//     metadata_json: string | null;
//
//     created_at: string;
//
//     // joined display fields from the admin controller
//     product_name?: string | null;
//     variant_name?: string | null;
//     design_name?: string | null;
//     lock_tech_name?: string | null;
//     product_image_url?: string | null;
//     product_image_alt?: string | null;
//     design_image_url?: string | null;
//     design_image_alt?: string | null;
// };
//
// type ReceiptBundle = {
//     receipt_url: string | null;
//     hosted_invoice_url: string | null;
//     invoice_pdf: string | null;
// };
//
// type AdminOrderResponse = {
//     order: AdminOrder;
//     items: AdminOrderItem[];
//     receipt_bundle?: ReceiptBundle;
// };
//
//
// const ORDER_STATUS_OPTS: OrderStatus[] = ["placed", "cancelled", "completed"];
// const PAYMENT_STATUS_OPTS: PaymentStatus[] = ["pending", "paid", "refunded"];
// const FULFILLMENT_STATUS_OPTS: FulfillmentStatus[] = ["unfulfilled", "fulfilled"];
// const SHIPPING_STATUS_OPTS: ShippingStatus[] = ["pending", "shipped", "delivered"];
//
// function moneyFromCents(cents: number, currencyRaw: string) {
//     const n = (Number(cents) || 0) / 100;
//     const code = String(currencyRaw || "usd").toUpperCase();
//     try {
//         return new Intl.NumberFormat("en-US", { style: "currency", currency: code }).format(n);
//     } catch {
//         return `$${n.toFixed(2)}`;
//     }
// }
//
// function formatDateTime(dbText: string | null | undefined) {
//     const t = String(dbText || "").trim();
//     if (!t) return "—";
//     // SQLite datetime('now') typically looks like: 2026-01-08 00:10:06
//     const isoish = t.includes("T") ? t : t.replace(" ", "T");
//     const d = new Date(isoish);
//     if (!Number.isNaN(d.getTime())) return d.toLocaleString();
//     return t;
// }
//
// function badgeForPayment(status: PaymentStatus) {
//     if (status === "paid") {
//         return {
//             className: "bg-green-50 text-green-700 border-green-200",
//             icon: <CheckCircle className="w-4 h-4" />,
//             label: "Paid",
//         };
//     }
//     if (status === "refunded") {
//         return {
//             className: "bg-slate-50 text-slate-700 border-slate-200",
//             icon: <XCircle className="w-4 h-4" />,
//             label: "Refunded",
//         };
//     }
//     return {
//         className: "bg-amber-50 text-amber-700 border-amber-200",
//         icon: <Clock className="w-4 h-4" />,
//         label: "Pending",
//     };
// }
//
// function chipClass(kind: "neutral" | "good" | "warn" | "bad" = "neutral") {
//     const base = "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border";
//     if (kind === "good") return `${base} bg-green-50 text-green-700 border-green-100`;
//     if (kind === "warn") return `${base} bg-amber-50 text-amber-700 border-amber-100`;
//     if (kind === "bad") return `${base} bg-rose-50 text-rose-700 border-rose-100`;
//     return `${base} bg-slate-50 text-slate-700 border-slate-200`;
// }
//
// const OrderDetail: React.FC = () => {
//     const navigate = useNavigate();
//     const params = useParams();
//
//     // The route param might be named id/orderId/productId depending on your router.
//     // For the admin orders API, it's /api/admin/orders/:id (numeric).
//     const rawId = (params as any)?.id ?? (params as any)?.orderId ?? (params as any)?.productId;
//     const orderId = useMemo(() => {
//         const n = Number(rawId);
//         return Number.isFinite(n) ? n : NaN;
//     }, [rawId]);
//
//     const qc = useQueryClient();
//     const qk = useMemo(() => ["admin-order", orderId] as const, [orderId]);
//
//     const orderQuery = useQuery<AdminOrderResponse, Error>({
//         queryKey: qk,
//         queryFn: async () => (await adminGetOrder(orderId)) as AdminOrderResponse,
//         enabled: Number.isFinite(orderId) && orderId > 0,
//         staleTime: 10_000,
//     });
//
//     const lastPatchRef = useRef<Record<string, any> | null>(null);
//     const updateMutation = useMutation({
//         mutationFn: async (patch: Record<string, any>) => {
//             lastPatchRef.current = patch;
//             return adminUpdateOrder(orderId, patch);
//         },
//         onMutate: async (patch: Record<string, any>) => {
//             await qc.cancelQueries({ queryKey: qk });
//             const prev = qc.getQueryData<AdminOrderResponse>(qk);
//
//             // Optimistically update the order snapshot in the cache
//             if (prev?.order) {
//                 qc.setQueryData<AdminOrderResponse>(qk, {
//                     ...prev,
//                     order: {
//                         ...prev.order,
//                         ...patch,
//                     },
//                 });
//             }
//
//             return { prev };
//         },
//         onError: (_err, _patch, ctx) => {
//             if (ctx?.prev) qc.setQueryData(qk, ctx.prev);
//         },
//         onSuccess: (data: any) => {
//             // Controller returns { order, ignored_fields }
//             const nextOrder = data?.order;
//             if (nextOrder) {
//                 const prev = qc.getQueryData<AdminOrderResponse>(qk);
//                 if (prev) qc.setQueryData<AdminOrderResponse>(qk, { ...prev, order: nextOrder });
//             }
//         },
//         onSettled: () => {
//             qc.invalidateQueries({ queryKey: qk });
//         },
//     });
//
//     const order = orderQuery.data?.order;
//     const items = orderQuery.data?.items || [];
//
//     const receiptBundle = orderQuery.data?.receipt_bundle;
//     const receiptUrl =
//         receiptBundle?.receipt_url ||
//         receiptBundle?.hosted_invoice_url ||
//         receiptBundle?.invoice_pdf ||
//         null;
//
//
//
//
//     const [notesDraft, setNotesDraft] = useState<string>("");
//     const [notesDirty, setNotesDirty] = useState(false);
//     const [notesSavedToast, setNotesSavedToast] = useState<string | null>(null);
//     const toastTimer = useRef<number | null>(null);
//
//     useEffect(() => {
//         // Only refresh the draft when:
//         // - the order id changes, or
//         // - the draft isn't dirty (i.e. not editing)
//         if (!order) return;
//         if (!notesDirty) setNotesDraft(order.notes || "");
//         // eslint-disable-next-line react-hooks/exhaustive-deps
//     }, [order?.id, order?.notes]);
//
//     useEffect(() => {
//         return () => {
//             if (toastTimer.current) window.clearTimeout(toastTimer.current);
//         };
//     }, []);
//
//     const paymentBadge = order ? badgeForPayment(order.payment_status) : null;
//
//     const headerNumber = useMemo(() => {
//         if (!order) return "";
//         return order.order_number || `#${order.id}`;
//     }, [order]);
//
//     const copyToClipboard = async (text: string, label: string) => {
//         try {
//             await navigator.clipboard.writeText(text);
//             setNotesSavedToast(`${label} copied`);
//             if (toastTimer.current) window.clearTimeout(toastTimer.current);
//             toastTimer.current = window.setTimeout(() => setNotesSavedToast(null), 1600);
//         } catch {
//             setNotesSavedToast("Copy failed (blocked by browser)");
//             if (toastTimer.current) window.clearTimeout(toastTimer.current);
//             toastTimer.current = window.setTimeout(() => setNotesSavedToast(null), 2000);
//         }
//     };
//
//     const setField = (field: string, value: any) => {
//         if (!order) return;
//         if (orderQuery.isFetching || updateMutation.isPending) {
//             // still allow, but mutation already handles cancel/refetch
//         }
//         updateMutation.mutate({ [field]: value });
//     };
//
//     const markFulfilled = () => {
//         if (!order) return;
//         if (order.fulfillment_status === "fulfilled") return;
//         setField("fulfillment_status", "fulfilled");
//     };
//
//     const saveNotes = () => {
//         if (!order) return;
//         updateMutation.mutate(
//             { notes: notesDraft },
//             {
//                 onSuccess: () => {
//                     setNotesDirty(false);
//                     setNotesSavedToast("Notes saved");
//                     if (toastTimer.current) window.clearTimeout(toastTimer.current);
//                     toastTimer.current = window.setTimeout(() => setNotesSavedToast(null), 1600);
//                 },
//             }
//         );
//     };
//
//     if (!Number.isFinite(orderId) || orderId <= 0) {
//         return (
//             <div className="max-w-3xl mx-auto py-10">
//                 <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
//                     <div className="flex items-start gap-3">
//                         <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
//                         <div>
//                             <h2 className="font-semibold text-slate-900">Invalid order id</h2>
//                             <p className="text-sm text-slate-600 mt-1">Your route should look like <code className="font-mono">/orders/:id</code>.</p>
//                             <button
//                                 className="mt-4 inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-slate-900 hover:bg-slate-800 text-white"
//                                 onClick={() => navigate("/orders")}
//                             >
//                                 Back to Orders
//                             </button>
//                         </div>
//                     </div>
//                 </div>
//             </div>
//         );
//     }
//
//     return (
//         <div className="max-w-7xl mx-auto pb-10">
//             <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
//                 <div>
//                     <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
//                         <span className="hover:text-slate-900 cursor-pointer" onClick={() => navigate("/orders")}>Orders</span>
//                         <ChevronRight className="w-4 h-4" />
//                         <span>{headerNumber || "Order"}</span>
//                     </div>
//                     <h1 className="text-2xl font-bold text-slate-900">Order Details</h1>
//                     <p className="text-slate-500 text-sm mt-1">
//                         {order ? `Placed on ${formatDateTime(order.created_at)}` : "Loading…"}
//                     </p>
//                 </div>
//
//                 <div className="flex items-center gap-3">
//                     {paymentBadge ? (
//                         <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${paymentBadge.className}`}>
//                             {paymentBadge.icon}
//                             <span className="text-xs font-semibold">{paymentBadge.label}</span>
//                         </div>
//                     ) : (
//                         <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 text-slate-700 rounded-full border border-slate-200">
//                             <Clock className="w-4 h-4" />
//                             <span className="text-xs font-semibold">Loading</span>
//                         </div>
//                     )}
//
//                     <button
//                         className={`bg-white border border-slate-200 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm transition-colors ${
//                             receiptUrl
//                                 ? "text-slate-700 hover:bg-slate-50"
//                                 : "text-slate-400 cursor-not-allowed"
//                         }`}
//                         onClick={() => {
//                             if (!receiptUrl) return;
//                             window.open(receiptUrl, "_blank", "noopener,noreferrer");
//                         }}
//                         disabled={!receiptUrl}
//                         title={receiptUrl ? "Open Stripe receipt" : "No receipt available"}
//                     >
//                         <Printer className="w-4 h-4" /> Receipt
//                     </button>
//                 </div>
//             </div>
//
//             {notesSavedToast ? (
//                 <div className="mb-4">
//                     <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 shadow-sm">
//                         <CheckCircle className="w-4 h-4 text-green-600" />
//                         <span>{notesSavedToast}</span>
//                     </div>
//                 </div>
//             ) : null}
//
//             {orderQuery.isLoading ? (
//                 <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 text-slate-600">Loading order…</div>
//             ) : orderQuery.isError ? (
//                 <div className="bg-white border border-rose-200 rounded-xl shadow-sm p-6">
//                     <div className="flex items-start gap-3">
//                         <AlertTriangle className="w-5 h-5 text-rose-600 mt-0.5" />
//                         <div>
//                             <h2 className="font-semibold text-slate-900">Failed to load order</h2>
//                             <p className="text-sm text-slate-600 mt-1">{orderQuery.error?.message || "Unknown error"}</p>
//                             <button
//                                 className="mt-4 inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-slate-900 hover:bg-slate-800 text-white"
//                                 onClick={() => orderQuery.refetch()}
//                             >
//                                 Retry
//                             </button>
//                         </div>
//                     </div>
//                 </div>
//             ) : !order ? (
//                 <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 text-slate-600">Order not found.</div>
//             ) : (
//                 <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
//                     <div className="xl:col-span-2 space-y-6">
//                         {/* Order Items */}
//                         <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
//                             <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
//                                 <h3 className="font-semibold text-slate-900">Order Items</h3>
//                                 <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded">{items.length} items</span>
//                             </div>
//
//                             <table className="w-full text-left text-sm">
//                                 <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
//                                 <tr>
//                                     <th className="px-6 py-3 w-1/2">Product</th>
//                                     <th className="px-6 py-3">Snapshot</th>
//                                     <th className="px-6 py-3 text-right">Qty</th>
//                                     <th className="px-6 py-3 text-right">Total</th>
//                                 </tr>
//                                 </thead>
//                                 <tbody className="divide-y divide-slate-100">
//                                 {items.map((it) => {
//                                     const title =
//                                         it.item_type === "keycard"
//                                             ? it.design_name || it.description || "Keycard"
//                                             : it.product_name || it.description || "Item";
//
//                                     const rawThumb =
//                                         it.item_type === "regular"
//                                             ? it.product_image_url
//                                             : it.item_type === "keycard"
//                                                 ? it.design_image_url
//                                                 : null;
//
//                                     const thumbUrl = rawThumb ? adminAssetUrl(rawThumb) : null;
//
//                                     const thumbAlt =
//                                         (it.item_type === "keycard" ? it.design_image_alt : it.product_image_alt) || title;
//
//                                     const sublineParts: string[] = [];
//                                     if (it.item_type === "regular") {
//                                         if (it.variant_name) sublineParts.push(`Variant: ${it.variant_name}`);
//                                     } else {
//                                         if (it.lock_tech_name) sublineParts.push(`Lock tech: ${it.lock_tech_name}`);
//                                         if (it.boxes) sublineParts.push(`Boxes: ${it.boxes}`);
//                                         if (it.box_size) sublineParts.push(`Box size: ${it.box_size}`);
//                                     }
//                                     if (it.description && !sublineParts.length) sublineParts.push(it.description);
//
//                                     return (
//                                         <tr key={it.id} className="group hover:bg-slate-50 transition-colors">
//                                             <td className="px-6 py-4">
//                                                 <div className="flex items-start gap-4">
//                                                     <div className="relative flex-shrink-0 group/img">
//                                                         <div className="w-10 h-10 rounded bg-slate-100 overflow-hidden flex items-center justify-center">
//                                                             {thumbUrl ? (
//                                                                 <img
//                                                                     src={thumbUrl}
//                                                                     alt={thumbAlt}
//                                                                     className="w-full h-full object-cover"
//                                                                     loading="lazy"
//                                                                 />
//                                                             ) : it.item_type === "keycard" ? (
//                                                                 <Lock className="w-5 h-5 text-slate-400" />
//                                                             ) : (
//                                                                 <Image className="w-5 h-5 text-slate-400" />
//                                                             )}
//                                                         </div>
//
//                                                         {thumbUrl ? (
//                                                             <div className="pointer-events-none hidden group-hover/img:block absolute left-12 top-0 z-50">
//                                                                 <div className="w-48 h-48 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
//                                                                     <img
//                                                                         src={thumbUrl}
//                                                                         alt={thumbAlt}
//                                                                         className="w-full h-full object-contain"
//                                                                     />
//                                                                 </div>
//                                                             </div>
//                                                         ) : null}
//                                                     </div>
//                                                     <div>
//                                                         <p className="font-medium text-slate-900">{title}</p>
//                                                         {sublineParts.length ? (
//                                                             <p className="text-xs text-slate-500 mt-0.5">{sublineParts.join(" • ")}</p>
//                                                         ) : null}
//                                                     </div>
//                                                 </div>
//                                             </td>
//                                             <td className="px-6 py-4">
//                                                 <div className="flex items-center gap-2 flex-wrap">
//                                                     <span className={chipClass(it.price_source === "catalog" ? "neutral" : it.price_source === "override" ? "warn" : "bad")}>{it.price_source}</span>
//                                                     <span className={chipClass(it.item_type === "regular" ? "neutral" : "good")}>{it.item_type}</span>
//                                                 </div>
//                                             </td>
//                                             <td className="px-6 py-4 text-right text-slate-600">{it.quantity}</td>
//                                             <td className="px-6 py-4 text-right font-medium text-slate-900">
//                                                 {moneyFromCents(it.line_total_cents, it.currency || order.currency)}
//                                             </td>
//                                         </tr>
//                                     );
//                                 })}
//
//                                 {!items.length ? (
//                                     <tr>
//                                         <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
//                                             No items on this order.
//                                         </td>
//                                     </tr>
//                                 ) : null}
//                                 </tbody>
//                             </table>
//
//                             <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
//                                 <div className="flex flex-col gap-2 max-w-xs ml-auto">
//                                     <div className="flex justify-between text-sm text-slate-600">
//                                         <span>Subtotal</span>
//                                         <span>{moneyFromCents(order.subtotal_cents, order.currency)}</span>
//                                     </div>
//                                     <div className="flex justify-between text-sm text-slate-600">
//                                         <span>Shipping</span>
//                                         <span>{moneyFromCents(order.shipping_cents, order.currency)}</span>
//                                     </div>
//                                     <div className="flex justify-between text-sm text-slate-600">
//                                         <span>Tax</span>
//                                         <span>{moneyFromCents(order.tax_cents, order.currency)}</span>
//                                     </div>
//                                     <div className="pt-2 mt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900 text-base">
//                                         <span>Total</span>
//                                         <span>{moneyFromCents(order.total_cents, order.currency)}</span>
//                                     </div>
//                                 </div>
//                             </div>
//                         </div>
//
//                         {/* Payment Snapshot */}
//                         <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 relative overflow-hidden">
//                             <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
//                                 <CreditCard className="w-24 h-24 rotate-12" />
//                             </div>
//
//                             <div className="flex items-center justify-between mb-4 relative z-10">
//                                 <h3 className="font-semibold text-slate-900 flex items-center gap-2">
//                                     <CreditCard className="w-5 h-5 text-slate-400" /> Payment
//                                 </h3>
//                                 <span className={chipClass(order.payment_status === "paid" ? "good" : order.payment_status === "pending" ? "warn" : "neutral")}>
//                   {order.payment_status}
//                 </span>
//                             </div>
//
//                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
//                                 <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
//                                     <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Payment Intent</span>
//                                     <div className="mt-1 flex items-center gap-2">
//                                         <code className="text-sm font-mono text-slate-700 break-all">
//                                             {order.stripe_payment_intent_id || "—"}
//                                         </code>
//                                         {order.stripe_payment_intent_id ? (
//                                             <button
//                                                 className="text-slate-400 hover:text-slate-900"
//                                                 onClick={() => copyToClipboard(order.stripe_payment_intent_id || "", "Payment Intent")}
//                                                 title="Copy"
//                                             >
//                                                 <Copy className="w-3.5 h-3.5" />
//                                             </button>
//                                         ) : null}
//                                     </div>
//                                 </div>
//
//                                 <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
//                                     <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Checkout Session</span>
//                                     <div className="mt-1 flex items-center gap-2">
//                                         <code className="text-sm font-mono text-slate-700 break-all">
//                                             {order.stripe_checkout_session_id || "—"}
//                                         </code>
//                                         {order.stripe_checkout_session_id ? (
//                                             <button
//                                                 className="text-slate-400 hover:text-slate-900"
//                                                 onClick={() => copyToClipboard(order.stripe_checkout_session_id || "", "Checkout Session")}
//                                                 title="Copy"
//                                             >
//                                                 <Copy className="w-3.5 h-3.5" />
//                                             </button>
//                                         ) : null}
//                                     </div>
//                                 </div>
//
//                                 <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
//                                     <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Payment Method</span>
//                                     <div className="mt-1 flex items-center gap-2">
//                                         <span className="text-sm text-slate-700">{order.payment_method}</span>
//                                     </div>
//                                 </div>
//
//                                 <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
//                                     <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Paid At</span>
//                                     <div className="mt-1 flex items-center gap-2">
//                                         <span className="text-sm text-slate-700">{formatDateTime(order.paid_at)}</span>
//                                     </div>
//                                 </div>
//                             </div>
//                         </div>
//                     </div>
//
//                     <div className="space-y-6">
//                         {/* Status Controls */}
//                         <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
//                             <div className="flex items-center justify-between mb-4">
//                                 <h3 className="font-semibold text-slate-900">Statuses</h3>
//                                 {updateMutation.isPending ? (
//                                     <span className="text-xs text-slate-500">Saving…</span>
//                                 ) : orderQuery.isFetching ? (
//                                     <span className="text-xs text-slate-500">Refreshing…</span>
//                                 ) : (
//                                     <span className="text-xs text-slate-500">Updated {formatDateTime(order.updated_at)}</span>
//                                 )}
//                             </div>
//
//                             <div className="grid grid-cols-1 gap-3">
//                                 <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
//                                     Order Status
//                                     <select
//                                         className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-slate-900/10 focus:outline-none"
//                                         value={order.order_status}
//                                         onChange={(e) => setField("order_status", e.target.value as OrderStatus)}
//                                         disabled={updateMutation.isPending}
//                                     >
//                                         {ORDER_STATUS_OPTS.map((v) => (
//                                             <option key={v} value={v}>
//                                                 {v}
//                                             </option>
//                                         ))}
//                                     </select>
//                                 </label>
//
//                                 <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
//                                     Payment Status
//                                     <select
//                                         className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-slate-900/10 focus:outline-none"
//                                         value={order.payment_status}
//                                         onChange={(e) => setField("payment_status", e.target.value as PaymentStatus)}
//                                         disabled={updateMutation.isPending}
//                                     >
//                                         {PAYMENT_STATUS_OPTS.map((v) => (
//                                             <option key={v} value={v}>
//                                                 {v}
//                                             </option>
//                                         ))}
//                                     </select>
//                                 </label>
//
//                                 <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
//                                     Fulfillment Status
//                                     <select
//                                         className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-slate-900/10 focus:outline-none"
//                                         value={order.fulfillment_status}
//                                         onChange={(e) => setField("fulfillment_status", e.target.value as FulfillmentStatus)}
//                                         disabled={updateMutation.isPending}
//                                     >
//                                         {FULFILLMENT_STATUS_OPTS.map((v) => (
//                                             <option key={v} value={v}>
//                                                 {v}
//                                             </option>
//                                         ))}
//                                     </select>
//                                 </label>
//
//                                 <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
//                                     Shipping Status
//                                     <select
//                                         className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-slate-900/10 focus:outline-none"
//                                         value={order.shipping_status}
//                                         onChange={(e) => setField("shipping_status", e.target.value as ShippingStatus)}
//                                         disabled={updateMutation.isPending}
//                                     >
//                                         {SHIPPING_STATUS_OPTS.map((v) => (
//                                             <option key={v} value={v}>
//                                                 {v}
//                                             </option>
//                                         ))}
//                                     </select>
//                                 </label>
//                             </div>
//
//                             {updateMutation.isError ? (
//                                 <div className="mt-4 flex items-start gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded-lg">
//                                     <AlertTriangle className="w-4 h-4 mt-0.5" />
//                                     <span>{(updateMutation.error as any)?.message || "Update failed."}</span>
//                                 </div>
//                             ) : null}
//
//                             <div className="mt-6 pt-4 border-t border-slate-100">
//                                 <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-100">
//                                     <AlertTriangle className="w-4 h-4" />
//                                     <span>Money totals and order items are read-only by design.</span>
//                                 </div>
//                             </div>
//                         </div>
//
//                         {/* Customer Snapshot */}
//                         <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
//                             <div className="flex items-center justify-between mb-4">
//                                 <h3 className="font-semibold text-slate-900">Customer Snapshot</h3>
//                                 <button
//                                     className="text-xs font-medium text-indigo-600 hover:underline"
//                                     onClick={() => {
//                                         // placeholder: wire this to your customer view later
//                                     }}
//                                 >
//                                     View Profile
//                                 </button>
//                             </div>
//
//                             <div className="flex items-center gap-4 mb-6">
//                                 <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
//                                     {(order.customer_name || order.customer_email || "?")
//                                         .trim()
//                                         .split(/\s+/)
//                                         .slice(0, 2)
//                                         .map((s) => s[0]?.toUpperCase())
//                                         .join("") || "?"}
//                                 </div>
//                                 <div>
//                                     <h4 className="font-bold text-slate-900">{order.customer_name || "—"}</h4>
//                                     <p className="text-sm text-slate-500">{order.customer_email || "—"}</p>
//                                 </div>
//                             </div>
//
//                             <div className="space-y-4">
//                                 <div>
//                                     <label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1">Phone</label>
//                                     <div className="bg-slate-50 px-3 py-2 rounded-lg text-sm text-slate-700 border border-slate-100">{order.customer_phone || "—"}</div>
//                                 </div>
//
//                                 <div>
//                                     <label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1">Shipping Address</label>
//                                     <div className="bg-slate-50 px-3 py-2 rounded-lg text-sm text-slate-700 border border-slate-100 leading-relaxed">
//                                         {order.ship_name ? <div>{order.ship_name}</div> : null}
//                                         {order.ship_line1 ? <div>{order.ship_line1}</div> : null}
//                                         {order.ship_line2 ? <div>{order.ship_line2}</div> : null}
//                                         <div>
//                                             {[order.ship_city, order.ship_state, order.ship_postal_code].filter(Boolean).join(", ") || "—"}
//                                         </div>
//                                         {order.ship_country ? <div>{order.ship_country}</div> : null}
//                                     </div>
//                                 </div>
//                             </div>
//
//                             <div className="mt-6 pt-4 border-t border-slate-100">
//                                 <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-100">
//                                     <AlertTriangle className="w-4 h-4" />
//                                     <span>Customer fields are a snapshot from time of purchase.</span>
//                                 </div>
//                             </div>
//                         </div>
//
//                         {/* Internal Notes */}
//                         <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
//                             <div className="flex items-center justify-between mb-4">
//                                 <h3 className="font-semibold text-slate-900">Internal Notes</h3>
//                                 <Lock className="w-4 h-4 text-slate-400" />
//                             </div>
//
//                             <div className="relative">
//                 <textarea
//                     className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-slate-900/10 focus:outline-none resize-none h-28"
//                     placeholder="Add a note…"
//                     value={notesDraft}
//                     onChange={(e) => {
//                         setNotesDraft(e.target.value);
//                         setNotesDirty(true);
//                     }}
//                     onKeyDown={(e) => {
//                         // Ctrl/Cmd+Enter to save
//                         if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
//                             e.preventDefault();
//                             if (!updateMutation.isPending) saveNotes();
//                         }
//                     }}
//                 />
//
//                                 <button
//                                     className={`absolute bottom-3 right-3 px-3 py-1.5 rounded-lg shadow-sm border text-xs font-semibold inline-flex items-center gap-2 transition-colors ${
//                                         notesDirty
//                                             ? "bg-slate-900 hover:bg-slate-800 text-white border-slate-900"
//                                             : "bg-white text-slate-500 border-slate-200"
//                                     }`}
//                                     onClick={saveNotes}
//                                     disabled={updateMutation.isPending || !notesDirty}
//                                     title={notesDirty ? "Save" : "No changes"}
//                                 >
//                                     <Send className="w-3.5 h-3.5" />
//                                     {updateMutation.isPending ? "Saving" : notesDirty ? "Save" : "Saved"}
//                                 </button>
//                             </div>
//
//                             <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
//                                 <span>{notesDirty ? "Unsaved changes" : "Tip: Ctrl/Cmd+Enter to save"}</span>
//                                 <span>Order ID: {order.id}</span>
//                             </div>
//                         </div>
//                     </div>
//                 </div>
//             )}
//         </div>
//     );
// };
//
// export default OrderDetail;


import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminAssetUrl,
  adminGetOrder,
  adminUpdateOrder,
  type FulfillmentStatus,
  type OrderStatus,
  type PaymentStatus,
  type ShippingStatus,
} from "../src/lib/api";
import {
  ChevronRight,
  CheckCircle,
  Printer,
  Image,
  Copy,
  CreditCard,
  Lock,
  Send,
  AlertTriangle,
  XCircle,
  Clock,
} from "lucide-react";

type OrderItemType = "regular" | "keycard";
type PriceSource = "catalog" | "override" | "custom";

type AdminOrder = {
  id: number;
  order_number: string | null;

  order_status: OrderStatus;
  payment_status: PaymentStatus;
  fulfillment_status: FulfillmentStatus;
  shipping_status: ShippingStatus;

  source: "web" | "phone" | "manual";
  payment_method: "stripe" | "cash" | "check" | "invoice" | "other";

  external_ref: string | null;

  currency: string;
  subtotal_cents: number;
  tax_cents: number;
  shipping_cents: number;
  total_cents: number;

  customer_email: string | null;
  customer_phone: string | null;
  customer_name: string | null;

  ship_name: string | null;
  ship_line1: string | null;
  ship_line2: string | null;
  ship_city: string | null;
  ship_state: string | null;
  ship_postal_code: string | null;
  ship_country: string | null;

  bill_name: string | null;
  bill_line1: string | null;
  bill_line2: string | null;
  bill_city: string | null;
  bill_state: string | null;
  bill_postal_code: string | null;
  bill_country: string | null;

  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_customer_id: string | null;

  notes: string | null;
  metadata_json: string | null;

  created_at: string;
  paid_at: string | null;
  updated_at: string;
};

type AdminOrderItem = {
  id: number;
  order_id: number;

  item_type: OrderItemType;

  product_id: number | null;
  variant_id: number | null;
  design_id: number | null;
  lock_tech_id: number | null;
  box_size: number;
  boxes: number | null;

  price_source: PriceSource;

  stripe_price_id: string | null;
  stripe_product_id: string | null;

  currency: string;
  unit_amount_cents: number;
  quantity: number;
  line_total_cents: number;

  description: string | null;
  metadata_json: string | null;

  created_at: string;

  // joined display fields from the admin controller
  product_name?: string | null;
  variant_name?: string | null;
  design_name?: string | null;
  lock_tech_name?: string | null;
  product_image_url?: string | null;
  product_image_alt?: string | null;
  design_image_url?: string | null;
  design_image_alt?: string | null;
};

type ReceiptBundle = {
  receipt_url: string | null;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
};

type AdminOrderResponse = {
  order: AdminOrder;
  items: AdminOrderItem[];
  receipt_bundle?: ReceiptBundle;
};

const ORDER_STATUS_OPTS: OrderStatus[] = ["placed", "cancelled", "completed"];
const PAYMENT_STATUS_OPTS: PaymentStatus[] = ["pending", "paid", "refunded"];
const FULFILLMENT_STATUS_OPTS: FulfillmentStatus[] = ["unfulfilled", "fulfilled"];
const SHIPPING_STATUS_OPTS: ShippingStatus[] = ["pending", "shipped", "delivered"];

function moneyFromCents(cents: number, currencyRaw: string) {
  const n = (Number(cents) || 0) / 100;
  const code = String(currencyRaw || "usd").toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: code }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

function formatDateTime(dbText: string | null | undefined) {
  const t = String(dbText || "").trim();
  if (!t) return "—";
  const isoish = t.includes("T") ? t : t.replace(" ", "T");
  const d = new Date(isoish);
  if (!Number.isNaN(d.getTime())) return d.toLocaleString();
  return t;
}

function badgeForPayment(status: PaymentStatus) {
  if (status === "paid") {
    return {
      className: "bg-green-50 text-green-700 border-green-200",
      icon: <CheckCircle className="w-4 h-4" />,
      label: "Paid",
    };
  }
  if (status === "refunded") {
    return {
      className: "bg-slate-50 text-slate-700 border-slate-200",
      icon: <XCircle className="w-4 h-4" />,
      label: "Refunded",
    };
  }
  return {
    className: "bg-amber-50 text-amber-700 border-amber-200",
    icon: <Clock className="w-4 h-4" />,
    label: "Pending",
  };
}

function chipClass(kind: "neutral" | "good" | "warn" | "bad" = "neutral") {
  const base = "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border";
  if (kind === "good") return `${base} bg-green-50 text-green-700 border-green-100`;
  if (kind === "warn") return `${base} bg-amber-50 text-amber-700 border-amber-100`;
  if (kind === "bad") return `${base} bg-rose-50 text-rose-700 border-rose-100`;
  return `${base} bg-slate-50 text-slate-700 border-slate-200`;
}

const OrderDetail: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams();

  const rawId = (params as any)?.id ?? (params as any)?.orderId ?? (params as any)?.productId;
  const orderId = useMemo(() => {
    const n = Number(rawId);
    return Number.isFinite(n) ? n : NaN;
  }, [rawId]);

  const qc = useQueryClient();
  const qk = useMemo(() => ["admin-order", orderId] as const, [orderId]);

  const orderQuery = useQuery<AdminOrderResponse, Error>({
    queryKey: qk,
    queryFn: async () => (await adminGetOrder(orderId)) as AdminOrderResponse,
    enabled: Number.isFinite(orderId) && orderId > 0,
    staleTime: 10_000,
  });

  const updateMutation = useMutation({
    mutationFn: async (patch: Record<string, any>) => adminUpdateOrder(orderId, patch),
    onMutate: async (patch: Record<string, any>) => {
      await qc.cancelQueries({ queryKey: qk });
      const prev = qc.getQueryData<AdminOrderResponse>(qk);

      if (prev?.order) {
        qc.setQueryData<AdminOrderResponse>(qk, {
          ...prev,
          order: { ...prev.order, ...patch },
        });
      }

      return { prev };
    },
    onError: (_err, _patch, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk, ctx.prev);
    },
    onSuccess: (data: any) => {
      const nextOrder = data?.order;
      if (nextOrder) {
        const prev = qc.getQueryData<AdminOrderResponse>(qk);
        if (prev) qc.setQueryData<AdminOrderResponse>(qk, { ...prev, order: nextOrder });
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk });
    },
  });

  const order = orderQuery.data?.order;
  const items = orderQuery.data?.items || [];

  const receiptBundle = orderQuery.data?.receipt_bundle;
  const receiptUrl =
      receiptBundle?.receipt_url ||
      receiptBundle?.hosted_invoice_url ||
      receiptBundle?.invoice_pdf ||
      null;

  const [notesDraft, setNotesDraft] = useState<string>("");
  const [notesDirty, setNotesDirty] = useState(false);
  const [notesSavedToast, setNotesSavedToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!order) return;
    if (!notesDirty) setNotesDraft(order.notes || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id, order?.notes]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  const paymentBadge = order ? badgeForPayment(order.payment_status) : null;

  const headerNumber = useMemo(() => {
    if (!order) return "";
    return order.order_number || `#${order.id}`;
  }, [order]);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotesSavedToast(`${label} copied`);
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
      toastTimer.current = window.setTimeout(() => setNotesSavedToast(null), 1600);
    } catch {
      setNotesSavedToast("Copy failed (blocked by browser)");
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
      toastTimer.current = window.setTimeout(() => setNotesSavedToast(null), 2000);
    }
  };

  const setField = (field: string, value: any) => {
    if (!order) return;
    updateMutation.mutate({ [field]: value });
  };

  const saveNotes = () => {
    if (!order) return;
    updateMutation.mutate(
        { notes: notesDraft },
        {
          onSuccess: () => {
            setNotesDirty(false);
            setNotesSavedToast("Notes saved");
            if (toastTimer.current) window.clearTimeout(toastTimer.current);
            toastTimer.current = window.setTimeout(() => setNotesSavedToast(null), 1600);
          },
        }
    );
  };

  if (!Number.isFinite(orderId) || orderId <= 0) {
    return (
        <div className="max-w-3xl mx-auto py-10">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <h2 className="font-semibold text-slate-900">Invalid order id</h2>
                <p className="text-sm text-slate-600 mt-1">
                  Your route should look like <code className="font-mono">/orders/:id</code>.
                </p>
                <button
                    className="mt-4 inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-slate-900 hover:bg-slate-800 text-white"
                    onClick={() => navigate("/orders")}
                >
                  Back to Orders
                </button>
              </div>
            </div>
          </div>
        </div>
    );
  }

  return (
      <div className="max-w-7xl mx-auto pb-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <span className="hover:text-slate-900 cursor-pointer" onClick={() => navigate("/orders")}>
              Orders
            </span>
              <ChevronRight className="w-4 h-4" />
              <span>{headerNumber || "Order"}</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Order Details</h1>
            <p className="text-slate-500 text-sm mt-1">
              {order ? `Placed on ${formatDateTime(order.created_at)}` : "Loading…"}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {paymentBadge ? (
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${paymentBadge.className}`}>
                  {paymentBadge.icon}
                  <span className="text-xs font-semibold">{paymentBadge.label}</span>
                </div>
            ) : (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 text-slate-700 rounded-full border border-slate-200">
                  <Clock className="w-4 h-4" />
                  <span className="text-xs font-semibold">Loading</span>
                </div>
            )}
            <button
                className={`bg-white border border-slate-200 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm transition-colors ${
                    receiptUrl ? "text-slate-700 hover:bg-slate-50" : "text-slate-400 cursor-not-allowed"
                }`}
                onClick={() => {
                  if (!receiptUrl) return;
                  window.open(receiptUrl, "_blank", "noopener,noreferrer");
                }}
                disabled={!receiptUrl}
                title={receiptUrl ? "Open Stripe receipt" : "No receipt available"}
            >
              <Printer className="w-4 h-4" /> Receipt
            </button>
          </div>
        </div>

        {notesSavedToast ? (
            <div className="mb-4">
              <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 shadow-sm">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span>{notesSavedToast}</span>
              </div>
            </div>
        ) : null}

        {orderQuery.isLoading ? (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 text-slate-600">
              Loading order…
            </div>
        ) : orderQuery.isError ? (
            <div className="bg-white border border-rose-200 rounded-xl shadow-sm p-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 mt-0.5" />
                <div>
                  <h2 className="font-semibold text-slate-900">Failed to load order</h2>
                  <p className="text-sm text-slate-600 mt-1">{orderQuery.error?.message || "Unknown error"}</p>
                  <button
                      className="mt-4 inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-slate-900 hover:bg-slate-800 text-white"
                      onClick={() => orderQuery.refetch()}
                  >
                    Retry
                  </button>
                </div>
              </div>
            </div>
        ) : !order ? (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 text-slate-600">
              Order not found.
            </div>
        ) : (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 space-y-6">
                {/* Order Items */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
                    <h3 className="font-semibold text-slate-900">Order Items</h3>
                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded">
                  {items.length} items
                </span>
                  </div>

                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 w-1/2">Product</th>
                      <th className="px-6 py-3">Snapshot</th>
                      <th className="px-6 py-3 text-right">Qty</th>
                      <th className="px-6 py-3 text-right">Total</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                    {items.map((it) => {
                      const title =
                          it.item_type === "keycard"
                              ? it.design_name || it.description || "Keycard"
                              : it.product_name || it.description || "Item";

                      const rawThumb =
                          it.item_type === "regular"
                              ? it.product_image_url
                              : it.item_type === "keycard"
                                  ? it.design_image_url
                                  : null;

                      const thumbUrl = rawThumb ? adminAssetUrl(rawThumb) : null;

                      const thumbAlt =
                          (it.item_type === "keycard" ? it.design_image_alt : it.product_image_alt) || title;

                      const sublineParts: string[] = [];
                      if (it.item_type === "regular") {
                        if (it.variant_name) sublineParts.push(`Variant: ${it.variant_name}`);
                      } else {
                        if (it.lock_tech_name) sublineParts.push(`Lock tech: ${it.lock_tech_name}`);
                        if (it.boxes) sublineParts.push(`Boxes: ${it.boxes}`);
                        if (it.box_size) sublineParts.push(`Box size: ${it.box_size}`);
                      }
                      if (it.description && !sublineParts.length) sublineParts.push(it.description);

                      return (
                          <tr key={it.id} className="group hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-start gap-4">
                                <div className="relative flex-shrink-0 group/img">
                                  <div className="w-10 h-10 rounded bg-slate-100 overflow-hidden flex items-center justify-center">
                                    {thumbUrl ? (
                                        <img
                                            src={thumbUrl}
                                            alt={thumbAlt}
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                        />
                                    ) : it.item_type === "keycard" ? (
                                        <Lock className="w-5 h-5 text-slate-400" />
                                    ) : (
                                        <Image className="w-5 h-5 text-slate-400" />
                                    )}
                                  </div>

                                  {thumbUrl ? (
                                      <div className="pointer-events-none hidden group-hover/img:block absolute left-12 top-0 z-50">
                                        <div className="w-48 h-48 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                                          <img src={thumbUrl} alt={thumbAlt} className="w-full h-full object-contain" />
                                        </div>
                                      </div>
                                  ) : null}
                                </div>
                                <div>
                                  <p className="font-medium text-slate-900">{title}</p>
                                  {sublineParts.length ? (
                                      <p className="text-xs text-slate-500 mt-0.5">{sublineParts.join(" • ")}</p>
                                  ) : null}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2 flex-wrap">
                            <span
                                className={chipClass(
                                    it.price_source === "catalog"
                                        ? "neutral"
                                        : it.price_source === "override"
                                            ? "warn"
                                            : "bad"
                                )}
                            >
                              {it.price_source}
                            </span>
                                <span className={chipClass(it.item_type === "regular" ? "neutral" : "good")}>
                              {it.item_type}
                            </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right text-slate-600">{it.quantity}</td>
                            <td className="px-6 py-4 text-right font-medium text-slate-900">
                              {moneyFromCents(it.line_total_cents, it.currency || order.currency)}
                            </td>
                          </tr>
                      );
                    })}

                    {!items.length ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                            No items on this order.
                          </td>
                        </tr>
                    ) : null}
                    </tbody>
                  </table>

                  <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
                    <div className="flex flex-col gap-2 max-w-xs ml-auto">
                      <div className="flex justify-between text-sm text-slate-600">
                        <span>Subtotal</span>
                        <span>{moneyFromCents(order.subtotal_cents, order.currency)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-slate-600">
                        <span>Shipping</span>
                        <span>{moneyFromCents(order.shipping_cents, order.currency)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-slate-600">
                        <span>Tax</span>
                        <span>{moneyFromCents(order.tax_cents, order.currency)}</span>
                      </div>
                      <div className="pt-2 mt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900 text-base">
                        <span>Total</span>
                        <span>{moneyFromCents(order.total_cents, order.currency)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Payment Snapshot */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                    <CreditCard className="w-24 h-24 rotate-12" />
                  </div>

                  <div className="flex items-center justify-between mb-4 relative z-10">
                    <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-slate-400" /> Payment
                    </h3>
                    <span
                        className={chipClass(
                            order.payment_status === "paid" ? "good" : order.payment_status === "pending" ? "warn" : "neutral"
                        )}
                    >
                  {order.payment_status}
                </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Payment Intent</span>
                      <div className="mt-1 flex items-center gap-2">
                        <code className="text-sm font-mono text-slate-700 break-all">
                          {order.stripe_payment_intent_id || "—"}
                        </code>
                        {order.stripe_payment_intent_id ? (
                            <button
                                className="text-slate-400 hover:text-slate-900"
                                onClick={() => copyToClipboard(order.stripe_payment_intent_id || "", "Payment Intent")}
                                title="Copy"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Checkout Session</span>
                      <div className="mt-1 flex items-center gap-2">
                        <code className="text-sm font-mono text-slate-700 break-all">
                          {order.stripe_checkout_session_id || "—"}
                        </code>
                        {order.stripe_checkout_session_id ? (
                            <button
                                className="text-slate-400 hover:text-slate-900"
                                onClick={() => copyToClipboard(order.stripe_checkout_session_id || "", "Checkout Session")}
                                title="Copy"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Payment Method</span>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-sm text-slate-700">{order.payment_method}</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Paid At</span>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-sm text-slate-700">{formatDateTime(order.paid_at)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {/* Status Controls */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-slate-900">Statuses</h3>
                    {updateMutation.isPending ? (
                        <span className="text-xs text-slate-500">Saving…</span>
                    ) : orderQuery.isFetching ? (
                        <span className="text-xs text-slate-500">Refreshing…</span>
                    ) : (
                        <span className="text-xs text-slate-500">Updated {formatDateTime(order.updated_at)}</span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                      Order Status
                      <select
                          className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-slate-900/10 focus:outline-none"
                          value={order.order_status}
                          onChange={(e) => setField("order_status", e.target.value as OrderStatus)}
                          disabled={updateMutation.isPending}
                      >
                        {ORDER_STATUS_OPTS.map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                        ))}
                      </select>
                    </label>

                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                      Payment Status
                      <select
                          className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-slate-900/10 focus:outline-none"
                          value={order.payment_status}
                          onChange={(e) => setField("payment_status", e.target.value as PaymentStatus)}
                          disabled={updateMutation.isPending}
                      >
                        {PAYMENT_STATUS_OPTS.map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                        ))}
                      </select>
                    </label>

                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                      Fulfillment Status
                      <select
                          className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-slate-900/10 focus:outline-none"
                          value={order.fulfillment_status}
                          onChange={(e) => setField("fulfillment_status", e.target.value as FulfillmentStatus)}
                          disabled={updateMutation.isPending}
                      >
                        {FULFILLMENT_STATUS_OPTS.map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                        ))}
                      </select>
                    </label>

                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                      Shipping Status
                      <select
                          className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-slate-900/10 focus:outline-none"
                          value={order.shipping_status}
                          onChange={(e) => setField("shipping_status", e.target.value as ShippingStatus)}
                          disabled={updateMutation.isPending}
                      >
                        {SHIPPING_STATUS_OPTS.map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {updateMutation.isError ? (
                      <div className="mt-4 flex items-start gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded-lg">
                        <AlertTriangle className="w-4 h-4 mt-0.5" />
                        <span>{(updateMutation.error as any)?.message || "Update failed."}</span>
                      </div>
                  ) : null}

                  <div className="mt-6 pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-100">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Money totals and order items are read-only by design.</span>
                    </div>
                  </div>
                </div>

                {/* Customer Snapshot */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-slate-900">Customer Snapshot</h3>
                    <button className="text-xs font-medium text-indigo-600 hover:underline" onClick={() => {}}>
                      View Profile
                    </button>
                  </div>

                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
                      {(order.customer_name || order.customer_email || "?")
                          .trim()
                          .split(/\s+/)
                          .slice(0, 2)
                          .map((s) => s[0]?.toUpperCase())
                          .join("") || "?"}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">{order.customer_name || "—"}</h4>
                      <p className="text-sm text-slate-500">{order.customer_email || "—"}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1">Phone</label>
                      <div className="bg-slate-50 px-3 py-2 rounded-lg text-sm text-slate-700 border border-slate-100">
                        {order.customer_phone || "—"}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1">
                        Shipping Address
                      </label>
                      <div className="bg-slate-50 px-3 py-2 rounded-lg text-sm text-slate-700 border border-slate-100 leading-relaxed">
                        {order.ship_name ? <div>{order.ship_name}</div> : null}
                        {order.ship_line1 ? <div>{order.ship_line1}</div> : null}
                        {order.ship_line2 ? <div>{order.ship_line2}</div> : null}
                        <div>
                          {[order.ship_city, order.ship_state, order.ship_postal_code].filter(Boolean).join(", ") || "—"}
                        </div>
                        {order.ship_country ? <div>{order.ship_country}</div> : null}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-100">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Customer fields are a snapshot from time of purchase.</span>
                    </div>
                  </div>
                </div>

                {/* Internal Notes */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-slate-900">Internal Notes</h3>
                    <Lock className="w-4 h-4 text-slate-400" />
                  </div>

                  <div className="relative">
                <textarea
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-slate-900/10 focus:outline-none resize-none h-28"
                    placeholder="Add a note…"
                    value={notesDraft}
                    onChange={(e) => {
                      setNotesDraft(e.target.value);
                      setNotesDirty(true);
                    }}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                        e.preventDefault();
                        if (!updateMutation.isPending) saveNotes();
                      }
                    }}
                />

                    <button
                        className={`absolute bottom-3 right-3 px-3 py-1.5 rounded-lg shadow-sm border text-xs font-semibold inline-flex items-center gap-2 transition-colors ${
                            notesDirty
                                ? "bg-slate-900 hover:bg-slate-800 text-white border-slate-900"
                                : "bg-white text-slate-500 border-slate-200"
                        }`}
                        onClick={saveNotes}
                        disabled={updateMutation.isPending || !notesDirty}
                        title={notesDirty ? "Save" : "No changes"}
                    >
                      <Send className="w-3.5 h-3.5" />
                      {updateMutation.isPending ? "Saving" : notesDirty ? "Save" : "Saved"}
                    </button>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                    <span>{notesDirty ? "Unsaved changes" : "Tip: Ctrl/Cmd+Enter to save"}</span>
                    <span>Order ID: {order.id}</span>
                  </div>
                </div>
              </div>
            </div>
        )}
      </div>
  );
};

export default OrderDetail;
