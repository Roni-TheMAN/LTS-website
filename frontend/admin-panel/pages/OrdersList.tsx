import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Download,
  Plus,
  TrendingUp,
  Filter,
  Search,
  MoreHorizontal,
  CheckCircle,
  AlertCircle,
  RotateCcw,
  X,
  User,
  MapPin,
  Truck,
  ShoppingCart,
  Trash2,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  adminFetch,
  adminListOrders,
  type AdminOrderListRow,
  type FulfillmentStatus,
  type PaymentStatus,
} from "../src/lib/api";

// Tailwind won't pick up `bg-${color}-50` reliably. Keep it explicit.
const STAT_COLOR_CLASSES: Record<string, { bg: string; dot: string }> = {
  blue: { bg: "bg-blue-50", dot: "bg-blue-500" },
  amber: { bg: "bg-amber-50", dot: "bg-amber-500" },
  red: { bg: "bg-red-50", dot: "bg-red-500" },
  emerald: { bg: "bg-emerald-50", dot: "bg-emerald-500" },
  slate: { bg: "bg-slate-50", dot: "bg-slate-500" },
};

type ProductRow = { id: number; name: string; type: "regular" | "keycard" };
type VariantRow = { id: number; product_id: number; name: string; sku?: string | null; active: number };

type KeycardDesignRow = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  active: number;
};

type LockTechRow = {
  id: number;
  name: string;
  active: number;
};

type KeycardTierRow = {
  id: number;
  lock_tech_id: number;
  min_boxes: number;
  max_boxes: number | null;
  currency: string;
  price_per_box_cents: number;
  active: number;
};

type WizardItem =
    | {
  id: number;
  kind: "variant";
  product_id: number;
  variant_id: number;
  label: string;
  qty: number;
  unit_amount_cents: number;
  currency: string;
  price_source: "catalog" | "override";
}
    | {
  id: number;
  kind: "custom";
  name: string;
  description: string;
  qty: number;
  unit_amount_cents: number;
  currency: string;
}
    | {
  id: number;
  kind: "keycard";
  design_id: number;
  lock_tech_id: number;
  label: string;
  boxes: number; // displayed in Qty column
  unit_amount_cents: number; // per box
  currency: string;
};

const moneyFromCents = (cents: number, currency = "usd") => {
  const n = (Number(cents) || 0) / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: String(currency || "usd").toUpperCase(),
  }).format(n);
};

function pickKeycardTier(tiers: KeycardTierRow[], boxes: number) {
  const b = Math.max(1, Math.floor(Number(boxes) || 1));
  const match = (tiers || [])
      .filter((t) => Number(t.active) === 1)
      .filter((t) => Number(t.min_boxes) <= b && (t.max_boxes == null || Number(t.max_boxes) >= b))
      .sort((a, b) => Number(b.min_boxes) - Number(a.min_boxes))[0];
  return match || null;
}

const OrdersList: React.FC = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const [quickFilter, setQuickFilter] = useState<"all" | "paid" | "unpaid" | "fulfilled">("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => setSearchQuery(searchInput.trim()), 250);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => setCurrentPage(1), [quickFilter, searchQuery]);

  const offset = (currentPage - 1) * itemsPerPage;

  const listParams = useMemo(() => {
    let payment_status: PaymentStatus | undefined;
    let fulfillment_status: FulfillmentStatus | undefined;

    if (quickFilter === "paid") payment_status = "paid";
    if (quickFilter === "unpaid") payment_status = "pending";
    if (quickFilter === "fulfilled") fulfillment_status = "fulfilled";

    return {
      q: searchQuery || undefined,
      payment_status,
      fulfillment_status,
      limit: itemsPerPage,
      offset,
      sort: "created_at:desc",
    };
  }, [quickFilter, searchQuery, itemsPerPage, offset]);

  const ordersQ = useQuery({
    queryKey: ["adminOrders", listParams],
    queryFn: () => adminListOrders(listParams),
    staleTime: 5_000,
  });

  const orders: AdminOrderListRow[] = ordersQ.data?.rows || [];
  const totalOrders = Number(ordersQ.data?.total || 0);
  const totalPages = Math.max(1, Math.ceil(totalOrders / itemsPerPage));

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  const showingFrom = totalOrders === 0 ? 0 : offset + 1;
  const showingTo = offset + orders.length;

  const formatCreatedAt = (createdAt: string) => {
    if (!createdAt) return { date: "—", time: "" };
    const d = new Date(createdAt.replace(" ", "T"));
    if (Number.isNaN(d.getTime())) {
      const [date, time] = String(createdAt).split(" ");
      return { date: date || "—", time: time || "" };
    }
    return {
      date: d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
      time: d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    };
  };

  const statusUi = (o: AdminOrderListRow) => {
    if (o.order_status === "cancelled") return { label: "Cancelled", cls: "bg-red-100 text-red-800 border-red-200" };
    if (o.fulfillment_status === "fulfilled")
      return { label: "Fulfilled", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" };
    if (o.payment_status === "paid") return { label: "Processing", cls: "bg-amber-100 text-amber-800 border-amber-200" };
    return { label: "Unfulfilled", cls: "bg-slate-100 text-slate-800 border-slate-200" };
  };

  const paymentUi = (o: AdminOrderListRow) => {
    if (o.payment_status === "paid") return { label: "Paid", Icon: CheckCircle, iconClass: "text-emerald-500" };
    if (o.payment_status === "refunded") return { label: "Refunded", Icon: RotateCcw, iconClass: "text-slate-500" };
    return { label: "Unpaid", Icon: AlertCircle, iconClass: "text-red-500" };
  };

  // -------------------------
  // Wizard State
  // -------------------------
  const [customer, setCustomer] = useState({
    name: "",
    phone: "",
    email: "",
    fulfillment: "shipping" as "shipping" | "pickup",
    address: "",
    city: "",
    state: "",
    zip: "",
    notes: "",
    source: "manual" as "manual" | "phone" | "web",
  });

  const [items, setItems] = useState<WizardItem[]>([]);
  const [payment, setPayment] = useState({
    shippingCost: 0, // dollars in UI
    taxCents: 0, // cents (manual override)
    status: "pending" as "pending" | "paid",
    method: "invoice" as "invoice" | "cash" | "check" | "stripe" | "other",
    externalRef: "",
  });

  // Product/Variant selection for catalog items
  const [selectedProductId, setSelectedProductId] = useState<number | "">("");
  const [selectedVariantId, setSelectedVariantId] = useState<number | "">("");
  const [selectedQty, setSelectedQty] = useState(1);
  const [variantUnitCents, setVariantUnitCents] = useState<number | null>(null);
  const [variantCurrency, setVariantCurrency] = useState("usd");
  const [priceLoading, setPriceLoading] = useState(false);

  // -------------------------
  // RFID Keycard quick-add state
  // -------------------------
  const [showKeycardPanel, setShowKeycardPanel] = useState(false);
  const [kcDesignId, setKcDesignId] = useState<number | "">("");
  const [kcLockTechId, setKcLockTechId] = useState<number | "">("");
  const [kcBoxes, setKcBoxes] = useState(1);

  // Line-item repricing state (for tiered pricing polish)
  const [repricing, setRepricing] = useState<Record<number, boolean>>({});
  const repriceTimersRef = useRef<Record<number, number>>({});
  const repriceReqRef = useRef<Record<number, number>>({});

  useEffect(() => {
    // cleanup timers on unmount
    return () => {
      Object.values(repriceTimersRef.current).forEach((t) => window.clearTimeout(t));
    };
  }, []);

  const productsQ = useQuery({
    queryKey: ["adminProductsMinimal"],
    queryFn: async () => {
      const rows = await adminFetch<any[]>("/products");
      // keep only regular products for variant-based ordering
      return (rows || [])
          .filter((p) => p?.type === "regular" && Number(p?.active) === 1)
          .map((p) => ({ id: Number(p.id), name: String(p.name), type: p.type })) as ProductRow[];
    },
    enabled: isWizardOpen,
    staleTime: 30_000,
  });

  const variantsQ = useQuery({
    queryKey: ["adminVariantsByProduct", selectedProductId],
    queryFn: async () => {
      if (!selectedProductId) return [] as VariantRow[];
      const rows = await adminFetch<any[]>(`/variants/product/${selectedProductId}?active=1`);
      return (rows || []).map((v) => ({
        id: Number(v.id),
        product_id: Number(v.product_id),
        name: String(v.name),
        sku: v.sku ?? null,
        active: Number(v.active),
      })) as VariantRow[];
    },
    enabled: isWizardOpen && !!selectedProductId,
    staleTime: 15_000,
  });

  const keycardDesignsQ = useQuery({
    queryKey: ["adminKeycardsDesigns"],
    queryFn: async () => {
      const rows = await adminFetch<any[]>(`/keycards/designs?active=1`);
      return (rows || []).map((d) => ({
        id: Number(d.id),
        code: String(d.code),
        name: String(d.name),
        description: d.description ?? null,
        active: Number(d.active),
      })) as KeycardDesignRow[];
    },
    enabled: isWizardOpen,
    staleTime: 30_000,
  });

  const lockTechQ = useQuery({
    queryKey: ["adminKeycardsLockTech"],
    queryFn: async () => {
      const rows = await adminFetch<any[]>(`/keycards/lock-tech?active=1`);
      return (rows || []).map((lt) => ({
        id: Number(lt.id),
        name: String(lt.name),
        active: Number(lt.active),
      })) as LockTechRow[];
    },
    enabled: isWizardOpen,
    staleTime: 30_000,
  });

  const keycardTiersQ = useQuery({
    queryKey: ["adminKeycardsTiers", kcLockTechId],
    queryFn: async () => {
      if (!kcLockTechId) return [] as KeycardTierRow[];
      const rows = await adminFetch<any[]>(`/keycards/lock-tech/${kcLockTechId}/tiers?active=1`);
      return (rows || []).map((t) => ({
        id: Number(t.id),
        lock_tech_id: Number(t.lock_tech_id),
        min_boxes: Number(t.min_boxes),
        max_boxes: t.max_boxes == null ? null : Number(t.max_boxes),
        currency: String(t.currency || "usd"),
        price_per_box_cents: Number(t.price_per_box_cents),
        active: Number(t.active),
      })) as KeycardTierRow[];
    },
    enabled: isWizardOpen && kcLockTechId !== "",
    staleTime: 60_000,
  });

  const selectedKcTier = useMemo(() => pickKeycardTier(keycardTiersQ.data || [], kcBoxes), [keycardTiersQ.data, kcBoxes]);
  const kcUnitCents = selectedKcTier?.price_per_box_cents ?? null;
  const kcCurrency = selectedKcTier?.currency ?? "usd";

  // When variant or qty changes -> fetch tier price for qty (selection row)
  useEffect(() => {
    (async () => {
      if (!isWizardOpen) return;
      if (!selectedVariantId || !selectedQty) {
        setVariantUnitCents(null);
        return;
      }
      setPriceLoading(true);
      try {
        const data = await adminFetch<{ unit_amount_cents: number; currency: string }>(
            `/variants/${selectedVariantId}/price?qty=${selectedQty}`
        );

        setVariantUnitCents(Number(data.unit_amount_cents));
        setVariantCurrency(String(data.currency || "usd"));
      } catch {
        setVariantUnitCents(null);
      } finally {
        setPriceLoading(false);
      }
    })();
  }, [isWizardOpen, selectedVariantId, selectedQty]);

  const lineTotalCents = useMemo(() => {
    return items.reduce((sum, it) => {
      if (it.kind === "keycard") return sum + Number(it.unit_amount_cents) * Number(it.boxes);
      return sum + Number(it.unit_amount_cents) * Number(it.qty);
    }, 0);
  }, [items]);

  const subtotal_cents = lineTotalCents;

  const shipping_cents = useMemo(() => Math.max(0, Math.round(Number(payment.shippingCost || 0) * 100)), [payment.shippingCost]);
  const tax_cents = useMemo(() => Math.max(0, Math.floor(Number(payment.taxCents || 0))), [payment.taxCents]);
  const total_cents = subtotal_cents + shipping_cents + tax_cents;

  const handleRemoveItem = (id: number) => setItems((prev) => prev.filter((x) => x.id !== id));

  const handleClose = () => {
    // clear repricing timers
    Object.values(repriceTimersRef.current).forEach((t) => window.clearTimeout(t));
    repriceTimersRef.current = {};
    repriceReqRef.current = {};
    setRepricing({});

    setIsWizardOpen(false);
    setStep(1);
    setItems([]);
    setCustomer({
      name: "",
      phone: "",
      email: "",
      fulfillment: "shipping",
      address: "",
      city: "",
      state: "",
      zip: "",
      notes: "",
      source: "manual",
    });
    setPayment({ shippingCost: 0, taxCents: 0, status: "pending", method: "invoice", externalRef: "" });

    setSelectedProductId("");
    setSelectedVariantId("");
    setSelectedQty(1);
    setVariantUnitCents(null);
    setVariantCurrency("usd");

    setShowKeycardPanel(false);
    setKcDesignId("");
    setKcLockTechId("");
    setKcBoxes(1);
  };

  const addSelectedVariantToItems = () => {
    if (!selectedProductId || !selectedVariantId) return;
    if (variantUnitCents == null) return;

    const p = productsQ.data?.find((x) => x.id === selectedProductId);
    const v = variantsQ.data?.find((x) => x.id === selectedVariantId);
    if (!p || !v) return;

    const label = `${p.name} — ${v.name}${v.sku ? ` (${v.sku})` : ""}`;

    setItems((prev) => [
      ...prev,
      {
        id: Date.now(),
        kind: "variant",
        product_id: Number(selectedProductId),
        variant_id: Number(selectedVariantId),
        label,
        qty: selectedQty,
        unit_amount_cents: variantUnitCents,
        currency: variantCurrency,
        price_source: "catalog",
      },
    ]);

    // reset quick add
    setSelectedVariantId("");
    setSelectedQty(1);
    setVariantUnitCents(null);
  };

  const addCustomItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: Date.now(),
        kind: "custom",
        name: "Temporary Item",
        description: "",
        qty: 1,
        unit_amount_cents: 0,
        currency: "usd",
      },
    ]);
  };

  const addKeycardItem = () => {
    if (!kcDesignId || !kcLockTechId) return;
    if (kcUnitCents == null) return;

    const design = keycardDesignsQ.data?.find((d) => d.id === Number(kcDesignId));
    const lt = lockTechQ.data?.find((l) => l.id === Number(kcLockTechId));
    if (!design || !lt) return;

    const label = `RFID Keycards — ${design.code} — ${design.name} • ${lt.name}`;

    setItems((prev) => [
      ...prev,
      {
        id: Date.now(),
        kind: "keycard",
        design_id: Number(kcDesignId),
        lock_tech_id: Number(kcLockTechId),
        label,
        boxes: Math.max(1, Number(kcBoxes || 1)),
        unit_amount_cents: kcUnitCents,
        currency: kcCurrency,
      },
    ]);

    // reset keycard quick add
    setKcDesignId("");
    setKcLockTechId("");
    setKcBoxes(1);
    setShowKeycardPanel(false);
  };

  // Debounced repricing for variant line items (tier pricing polish)
  const scheduleRepriceVariantLineItem = (itemId: number, variantId: number, qty: number) => {
    // clear previous debounce for this line
    const existing = repriceTimersRef.current[itemId];
    if (existing) window.clearTimeout(existing);

    const t = window.setTimeout(async () => {
      // mark loading
      setRepricing((prev) => ({ ...prev, [itemId]: true }));

      // monotonic request token (prevents stale responses applying)
      const token = (repriceReqRef.current[itemId] || 0) + 1;
      repriceReqRef.current[itemId] = token;

      try {
        const data = await adminFetch<{ unit_amount_cents: number; currency: string }>(`/variants/${variantId}/price?qty=${qty}`);

        // only apply if still latest request for that item, and qty didn't change again
        if (repriceReqRef.current[itemId] !== token) return;

        setItems((prev) =>
            prev.map((x) => {
              if (x.id !== itemId) return x;
              if (x.kind !== "variant") return x;
              if (x.price_source !== "catalog") return x;
              if (x.qty !== qty) return x; // user changed qty since request started
              return {
                ...x,
                unit_amount_cents: Number(data.unit_amount_cents),
                currency: String(data.currency || x.currency || "usd"),
              };
            })
        );
      } catch {
        // keep previous unit price (server will still price correctly on final create)
      } finally {
        // only clear loading if this request is still the latest
        if (repriceReqRef.current[itemId] === token) {
          setRepricing((prev) => {
            const next = { ...prev };
            delete next[itemId];
            return next;
          });
        }
      }
    }, 160);

    repriceTimersRef.current[itemId] = t;
  };

  // Debounced repricing for KEYCARD line items (boxes-tier pricing polish)
  const scheduleRepriceKeycardLineItem = (itemId: number, lockTechId: number, boxes: number) => {
    const existing = repriceTimersRef.current[itemId];
    if (existing) window.clearTimeout(existing);

    const t = window.setTimeout(async () => {
      setRepricing((prev) => ({ ...prev, [itemId]: true }));

      const token = (repriceReqRef.current[itemId] || 0) + 1;
      repriceReqRef.current[itemId] = token;

      try {
        const tiers = await qc.fetchQuery({
          queryKey: ["adminKeycardsTiers", lockTechId],
          queryFn: async () => {
            const rows = await adminFetch<any[]>(`/keycards/lock-tech/${lockTechId}/tiers?active=1`);
            return (rows || []).map((t) => ({
              id: Number(t.id),
              lock_tech_id: Number(t.lock_tech_id),
              min_boxes: Number(t.min_boxes),
              max_boxes: t.max_boxes == null ? null : Number(t.max_boxes),
              currency: String(t.currency || "usd"),
              price_per_box_cents: Number(t.price_per_box_cents),
              active: Number(t.active),
            })) as KeycardTierRow[];
          },
          staleTime: 60_000,
        });

        if (repriceReqRef.current[itemId] !== token) return;

        const match = pickKeycardTier(tiers || [], boxes);
        if (!match) return;

        setItems((prev) =>
            prev.map((x) => {
              if (x.id !== itemId) return x;
              if (x.kind !== "keycard") return x;
              if (x.boxes !== boxes) return x;
              return {
                ...x,
                unit_amount_cents: Number(match.price_per_box_cents),
                currency: String(match.currency || x.currency || "usd"),
              };
            })
        );
      } catch {
        // ignore, keep last UI price (backend prices truth on create)
      } finally {
        if (repriceReqRef.current[itemId] === token) {
          setRepricing((prev) => {
            const next = { ...prev };
            delete next[itemId];
            return next;
          });
        }
      }
    }, 160);

    repriceTimersRef.current[itemId] = t;
  };

  const handleLineQtyChange = (it: WizardItem, nextQty: number) => {
    const qty = Math.max(1, Number(nextQty || 1));

    if (it.kind === "keycard") {
      // Update boxes immediately
      setItems((prev) => prev.map((x) => (x.id === it.id && x.kind === "keycard" ? { ...x, boxes: qty } : x)));

      // Reprice from tiers (debounced)
      scheduleRepriceKeycardLineItem(it.id, it.lock_tech_id, qty);
      return;
    }

    // Update qty immediately for snappy UI
    setItems((prev) => prev.map((x) => (x.id === it.id ? ({ ...x, qty } as any) : x)));

    // If it's a catalog variant, re-derive tier unit price for this qty (debounced)
    if (it.kind === "variant" && it.price_source === "catalog") {
      scheduleRepriceVariantLineItem(it.id, it.variant_id, qty);
    }
  };

  const createOrderM = useMutation({
    mutationFn: async () => {
      const payload = {
        source: customer.source,
        payment_method: payment.method,
        payment_status: payment.status,
        external_ref: payment.externalRef || null,
        shipping_cents,
        tax_cents,
        notes: customer.notes || null,
        customer: {
          name: customer.name || null,
          email: customer.email || null,
          phone: customer.phone || null,
        },
        shipping:
            customer.fulfillment === "shipping"
                ? {
                  name: customer.name || null,
                  line1: customer.address || null,
                  line2: null,
                  city: customer.city || null,
                  state: customer.state || null,
                  postal_code: customer.zip || null,
                  country: "US",
                }
                : {},
        items: items.map((it) => {
          if (it.kind === "variant") {
            return {
              kind: "variant",
              variant_id: it.variant_id,
              qty: it.qty,
            };
          }

          if (it.kind === "keycard") {
            return {
              kind: "keycard",
              lock_tech_id: it.lock_tech_id,
              boxes: it.boxes,
              design_id: it.design_id,
            };
          }

          return {
            kind: "custom",
            name: it.name,
            description: it.description || null,
            unit_amount_cents: it.unit_amount_cents,
            qty: it.qty,
            currency: it.currency,
          };
        }),
      };

      return adminFetch<{ order: { id: number } }>(`/orders`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: async (data) => {
      await qc.invalidateQueries({ queryKey: ["adminOrders"] });
      handleClose();

      const id = (data as any)?.order?.id;
      if (!id) return;

      // If admin selected Stripe + Pending, jump straight into embedded Checkout.
      if (payment.method === "stripe" && payment.status === "pending") {
        navigate(`/orders/${id}/checkout`, { replace: true });
        return;
      }

      navigate(`/orders/${id}`, { replace: true });
    },
  });

  const canNextStep1 = customer.email.trim() || customer.name.trim();
  const canNextStep2 = items.length > 0;

  const totalItemCount = useMemo(() => {
    return items.reduce((a, b) => {
      if (b.kind === "keycard") return a + Number(b.boxes || 0);
      return a + Number(b.qty || 0);
    }, 0);
  }, [items]);

  return (
      <div className="max-w-7xl mx-auto pb-10 relative">
        {/* --- WIZARD MODAL --- */}
        {isWizardOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">Create New Order</h3>
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mt-1">
                      <span className={step >= 1 ? "text-indigo-600" : ""}>1. Customer</span>
                      <ChevronRight className="w-3 h-3" />
                      <span className={step >= 2 ? "text-indigo-600" : ""}>2. Line Items</span>
                      <ChevronRight className="w-3 h-3" />
                      <span className={step >= 3 ? "text-indigo-600" : ""}>3. Review & Pay</span>
                    </div>
                  </div>
                  <button
                      onClick={handleClose}
                      className="text-slate-400 hover:text-slate-900 transition-colors bg-white p-1 rounded-full border border-slate-200 hover:border-slate-300"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
                  {/* STEP 1 */}
                  {step === 1 && (
                      <div className="space-y-6">
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                          <h4 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                            <User className="w-4 h-4 text-indigo-500" /> Customer Details
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                              <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">Full Name</label>
                              <input
                                  type="text"
                                  value={customer.name}
                                  onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                                  placeholder="Jane Doe"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">Email</label>
                              <input
                                  type="email"
                                  value={customer.email}
                                  onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                                  placeholder="jane@example.com"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">Phone</label>
                              <input
                                  type="tel"
                                  value={customer.phone}
                                  onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                                  placeholder="(555) 123-4567"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                              <Truck className="w-4 h-4 text-indigo-500" /> Fulfillment
                            </h4>
                            <div className="flex bg-slate-100 p-1 rounded-lg">
                              <button
                                  onClick={() => setCustomer({ ...customer, fulfillment: "shipping" })}
                                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                                      customer.fulfillment === "shipping" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                                  }`}
                              >
                                Shipping
                              </button>
                              <button
                                  onClick={() => setCustomer({ ...customer, fulfillment: "pickup" })}
                                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                                      customer.fulfillment === "pickup" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                                  }`}
                              >
                                Pickup
                              </button>
                            </div>
                          </div>

                          {customer.fulfillment === "shipping" ? (
                              <div className="grid grid-cols-1 md:grid-cols-6 gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="md:col-span-6">
                                  <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">Street Address</label>
                                  <input
                                      type="text"
                                      value={customer.address}
                                      onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
                                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                                      placeholder="123 Main St"
                                  />
                                </div>
                                <div className="md:col-span-3">
                                  <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">City</label>
                                  <input
                                      type="text"
                                      value={customer.city}
                                      onChange={(e) => setCustomer({ ...customer, city: e.target.value })}
                                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                                      placeholder="New York"
                                  />
                                </div>
                                <div className="md:col-span-2">
                                  <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">State</label>
                                  <input
                                      type="text"
                                      value={customer.state}
                                      onChange={(e) => setCustomer({ ...customer, state: e.target.value })}
                                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                                      placeholder="NY"
                                  />
                                </div>
                                <div className="md:col-span-1">
                                  <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">Zip</label>
                                  <input
                                      type="text"
                                      value={customer.zip}
                                      onChange={(e) => setCustomer({ ...customer, zip: e.target.value })}
                                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                                      placeholder="10001"
                                  />
                                </div>
                              </div>
                          ) : (
                              <div className="p-4 bg-slate-50 rounded-lg text-sm text-slate-500 flex items-center gap-2">
                                <MapPin className="w-4 h-4" /> Customer will pick up the order at the main warehouse.
                              </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <label className="block text-xs font-medium text-slate-500 uppercase mb-2">Order Source</label>
                            <select
                                value={customer.source}
                                onChange={(e) => setCustomer({ ...customer, source: e.target.value as any })}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 cursor-pointer"
                            >
                              <option value="manual">Manual Entry</option>
                              <option value="phone">Phone Call</option>
                              <option value="web">Web</option>
                            </select>
                          </div>
                          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <label className="block text-xs font-medium text-slate-500 uppercase mb-2">Notes</label>
                            <textarea
                                value={customer.notes}
                                onChange={(e) => setCustomer({ ...customer, notes: e.target.value })}
                                rows={1}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 resize-none"
                                placeholder="Internal notes..."
                            />
                          </div>
                        </div>
                      </div>
                  )}

                  {/* STEP 2 */}
                  {step === 2 && (
                      <div className="space-y-6">
                        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
                          <div className="flex flex-col md:flex-row gap-3 md:items-end">
                            <div className="flex-1">
                              <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">Product</label>
                              <select
                                  value={selectedProductId}
                                  onChange={(e) => {
                                    const next = e.target.value ? Number(e.target.value) : "";
                                    setSelectedProductId(next as any);
                                    setSelectedVariantId("");
                                    setSelectedQty(1);
                                    setVariantUnitCents(null);
                                  }}
                                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400"
                              >
                                <option value="">Select a product…</option>
                                {(productsQ.data || []).map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name}
                                    </option>
                                ))}
                              </select>
                            </div>

                            <div className="flex-1">
                              <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">Variant</label>
                              <select
                                  value={selectedVariantId}
                                  onChange={(e) => setSelectedVariantId(e.target.value ? Number(e.target.value) : "")}
                                  disabled={!selectedProductId}
                                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 disabled:opacity-60"
                              >
                                <option value="">Select a variant…</option>
                                {(variantsQ.data || []).map((v) => (
                                    <option key={v.id} value={v.id}>
                                      {v.name}
                                      {v.sku ? ` (${v.sku})` : ""}
                                    </option>
                                ))}
                              </select>
                            </div>

                            <div className="w-32">
                              <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">Qty</label>
                              <input
                                  type="number"
                                  min={1}
                                  value={selectedQty}
                                  onChange={(e) => setSelectedQty(Math.max(1, Number(e.target.value || 1)))}
                                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400"
                              />
                            </div>

                            <div className="w-44">
                              <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">Unit Price</label>
                              <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                                {priceLoading ? "…" : variantUnitCents == null ? "—" : moneyFromCents(variantUnitCents, variantCurrency)}
                              </div>
                            </div>

                            <button
                                onClick={addSelectedVariantToItems}
                                disabled={!selectedVariantId || !selectedProductId || !variantUnitCents || priceLoading}
                                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium shadow-sm hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Add Variant
                            </button>

                            <button
                                onClick={addCustomItem}
                                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium shadow-sm hover:bg-slate-50"
                            >
                              <Plus className="w-4 h-4 inline-block mr-2" />
                              Temp Item
                            </button>

                            <button
                                onClick={() => setShowKeycardPanel((v) => !v)}
                                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium shadow-sm hover:bg-slate-50"
                            >
                              <Plus className="w-4 h-4 inline-block mr-2" />
                              RFID Keycard
                            </button>
                          </div>

                          {showKeycardPanel && (
                              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 animate-in fade-in slide-in-from-top-2 duration-150">
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 md:items-end">
                                  <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">Design</label>
                                    <select
                                        value={kcDesignId}
                                        onChange={(e) => setKcDesignId(e.target.value ? Number(e.target.value) : "")}
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400"
                                    >
                                      <option value="">Select a design…</option>
                                      {(keycardDesignsQ.data || []).map((d) => (
                                          <option key={d.id} value={d.id}>
                                            {d.code} — {d.name}
                                          </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div>
                                    <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">Lock Tech</label>
                                    <select
                                        value={kcLockTechId}
                                        onChange={(e) => {
                                          const next = e.target.value ? Number(e.target.value) : "";
                                          setKcLockTechId(next as any);
                                          setKcBoxes(1);
                                        }}
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400"
                                    >
                                      <option value="">Select lock tech…</option>
                                      {(lockTechQ.data || []).map((lt) => (
                                          <option key={lt.id} value={lt.id}>
                                            {lt.name}
                                          </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div className="w-32">
                                    <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">Boxes</label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={kcBoxes}
                                        onChange={(e) => setKcBoxes(Math.max(1, Number(e.target.value || 1)))}
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400"
                                    />
                                  </div>

                                  <div className="w-44">
                                    <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">Unit Price / box</label>
                                    <div className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm">
                                      {!kcLockTechId ? "—" : keycardTiersQ.isLoading ? "…" : kcUnitCents == null ? "—" : moneyFromCents(kcUnitCents, kcCurrency)}
                                    </div>
                                  </div>
                                </div>

                                <div className="mt-3 flex items-center justify-between">
                                  <div className="text-xs text-slate-500">
                                    {kcLockTechId && kcUnitCents == null && !keycardTiersQ.isLoading ? (
                                        <span className="text-red-600">No price tier found for this box quantity.</span>
                                    ) : kcUnitCents != null ? (
                                        <>
                                          Line total:{" "}
                                          <span className="font-semibold text-slate-900">{moneyFromCents(kcUnitCents * Math.max(1, kcBoxes), kcCurrency)}</span>
                                        </>
                                    ) : (
                                        <span />
                                    )}
                                  </div>

                                  <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                          setShowKeycardPanel(false);
                                          setKcDesignId("");
                                          setKcLockTechId("");
                                          setKcBoxes(1);
                                        }}
                                        className="px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium shadow-sm hover:bg-slate-50"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                        onClick={addKeycardItem}
                                        disabled={!kcDesignId || !kcLockTechId || kcUnitCents == null}
                                        className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium shadow-sm hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      Add Keycard
                                    </button>
                                  </div>
                                </div>
                              </div>
                          )}
                        </div>

                        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden min-h-[300px] flex flex-col">
                          <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase">
                            <tr>
                              <th className="px-6 py-3 font-medium w-1/2">Item</th>
                              <th className="px-6 py-3 font-medium text-center w-24">Qty</th>
                              <th className="px-6 py-3 font-medium text-right w-40">Unit</th>
                              <th className="px-6 py-3 font-medium text-right w-32">Total</th>
                              <th className="px-6 py-3 w-10"></th>
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                            {items.map((it) => {
                              const qtyValue = it.kind === "keycard" ? it.boxes : it.qty;
                              const total = it.kind === "keycard" ? it.unit_amount_cents * it.boxes : it.unit_amount_cents * it.qty;

                              return (
                                  <tr key={it.id} className="group hover:bg-slate-50">
                                    <td className="px-6 py-3">
                                      {it.kind === "variant" ? (
                                          <div>
                                            <div className="font-medium text-slate-900">{it.label}</div>
                                            <div className="text-xs text-slate-500">
                                              Tier pricing auto-derived by qty
                                              {repricing[it.id] ? <span className="ml-2 text-slate-400">• repricing…</span> : null}
                                            </div>
                                          </div>
                                      ) : it.kind === "keycard" ? (
                                          <div>
                                            <div className="font-medium text-slate-900">{it.label}</div>
                                            <div className="text-xs text-slate-500">
                                              Tier pricing auto-derived by boxes
                                              {repricing[it.id] ? <span className="ml-2 text-slate-400">• repricing…</span> : null}
                                            </div>
                                          </div>
                                      ) : (
                                          <div className="space-y-2">
                                            <input
                                                type="text"
                                                value={it.name}
                                                onChange={(e) =>
                                                    setItems((prev) =>
                                                        prev.map((x) => (x.id === it.id && x.kind === "custom" ? { ...x, name: e.target.value } : x))
                                                    )
                                                }
                                                className="w-full bg-transparent border-b border-slate-200 focus:border-slate-400 focus:outline-none px-1 py-0.5"
                                            />
                                            <input
                                                type="text"
                                                value={it.description}
                                                onChange={(e) =>
                                                    setItems((prev) =>
                                                        prev.map((x) =>
                                                            x.id === it.id && x.kind === "custom" ? { ...x, description: e.target.value } : x
                                                        )
                                                    )
                                                }
                                                placeholder="Short description…"
                                                className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-xs focus:outline-none focus:border-slate-400"
                                            />
                                          </div>
                                      )}
                                    </td>

                                    <td className="px-6 py-3">
                                      <input
                                          type="number"
                                          min="1"
                                          value={qtyValue}
                                          onChange={(e) => handleLineQtyChange(it, Number(e.target.value || 1))}
                                          className="w-full text-center bg-slate-50 border border-slate-200 rounded-md py-1 focus:outline-none focus:border-slate-400"
                                      />
                                    </td>

                                    <td className="px-6 py-3 text-right">
                                      {it.kind === "custom" ? (
                                          <div className="relative">
                                            <span className="absolute left-2 top-1 text-slate-400 text-xs">$</span>
                                            <input
                                                type="number"
                                                value={(it.unit_amount_cents / 100).toFixed(2)}
                                                onChange={(e) => {
                                                  const dollars = Number(e.target.value || 0);
                                                  const cents = Math.max(0, Math.round(dollars * 100));
                                                  setItems((prev) =>
                                                      prev.map((x) => (x.id === it.id && x.kind === "custom" ? { ...x, unit_amount_cents: cents } : x))
                                                  );
                                                }}
                                                className="w-full text-right pl-5 pr-2 py-1 bg-transparent border border-transparent hover:border-slate-200 focus:bg-white focus:border-slate-400 rounded-md focus:outline-none"
                                            />
                                          </div>
                                      ) : (
                                          <span className="font-medium text-slate-900">{repricing[it.id] ? "…" : moneyFromCents(it.unit_amount_cents, it.currency)}</span>
                                      )}
                                    </td>

                                    <td className="px-6 py-3 text-right font-medium text-slate-900">{moneyFromCents(total, it.currency)}</td>

                                    <td className="px-6 py-3 text-right">
                                      <button onClick={() => handleRemoveItem(it.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </td>
                                  </tr>
                              );
                            })}

                            {items.length === 0 && (
                                <tr>
                                  <td colSpan={5} className="py-12 text-center text-slate-400">
                                    <div className="flex flex-col items-center">
                                      <ShoppingCart className="w-8 h-8 mb-2 opacity-20" />
                                      <span>No items added yet.</span>
                                    </div>
                                  </td>
                                </tr>
                            )}
                            </tbody>
                          </table>

                          {items.length > 0 && (
                              <div className="mt-auto p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-6 text-sm">
                                <div className="text-slate-500">
                                  Subtotal: <span className="font-semibold text-slate-900 ml-1">{moneyFromCents(subtotal_cents)}</span>
                                </div>
                                <div className="text-slate-500">
                                  Items: <span className="font-semibold text-slate-900 ml-1">{totalItemCount}</span>
                                </div>
                              </div>
                          )}
                        </div>
                      </div>
                  )}

                  {/* STEP 3 */}
                  {step === 3 && (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
                        <div className="lg:col-span-2 space-y-6">
                          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-4">Order Summary</h4>

                            <div className="space-y-3 mb-6">
                              {items.map((it) => {
                                const qtyValue = it.kind === "keycard" ? it.boxes : it.qty;
                                const label =
                                    it.kind === "variant"
                                        ? it.label
                                        : it.kind === "keycard"
                                            ? it.label
                                            : `${it.name}${it.description ? ` — ${it.description}` : ""}`;

                                const total = it.kind === "keycard" ? it.unit_amount_cents * it.boxes : it.unit_amount_cents * it.qty;

                                return (
                                    <div key={it.id} className="flex justify-between text-sm">
                                      <div className="flex items-center gap-3">
                                        <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                                          {qtyValue}x
                                        </div>
                                        <span className="text-slate-700">{label}</span>
                                      </div>
                                      <span className="font-medium text-slate-900">{moneyFromCents(total, it.currency)}</span>
                                    </div>
                                );
                              })}
                            </div>

                            <div className="border-t border-dashed border-slate-200 pt-4 space-y-2">
                              <div className="flex justify-between text-sm text-slate-500">
                                <span>Subtotal</span>
                                <span>{moneyFromCents(subtotal_cents)}</span>
                              </div>

                              <div className="flex justify-between text-sm text-slate-500 items-center">
                                <span>Shipping</span>
                                <div className="flex items-center gap-1 w-28">
                                  <span className="text-xs">$</span>
                                  <input
                                      type="number"
                                      value={payment.shippingCost}
                                      onChange={(e) => setPayment({ ...payment, shippingCost: Number(e.target.value || 0) })}
                                      className="w-full text-right bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-sm focus:outline-none focus:border-slate-400"
                                  />
                                </div>
                              </div>

                              <div className="flex justify-between text-sm text-slate-500 items-center">
                                <span>Tax (manual cents)</span>
                                <input
                                    type="number"
                                    value={payment.taxCents}
                                    onChange={(e) => setPayment({ ...payment, taxCents: Number(e.target.value || 0) })}
                                    className="w-28 text-right bg-slate-50 border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-slate-400"
                                />
                              </div>

                              <div className="flex justify-between text-lg font-bold text-slate-900 pt-2 border-t border-slate-100 mt-2">
                                <span>Total</span>
                                <span>{moneyFromCents(total_cents)}</span>
                              </div>
                            </div>
                          </div>

                          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-4">Customer</h4>
                            <div className="text-sm text-slate-600">
                              <p className="font-semibold text-slate-900">{customer.name || "No Name"}</p>
                              <p>{customer.email}</p>
                              <p>{customer.phone}</p>
                              {customer.fulfillment === "shipping" ? (
                                  <p className="mt-2 text-slate-500">
                                    {customer.address}, {customer.city}, {customer.state} {customer.zip}
                                  </p>
                              ) : (
                                  <p className="mt-2 text-indigo-600 font-medium flex items-center gap-1">
                                    <MapPin className="w-3 h-3" /> Pickup Order
                                  </p>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-6">
                          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-4">Payment Details</h4>

                            <div className="space-y-4">
                              <div>
                                <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">Status</label>
                                <select
                                    value={payment.status}
                                    onChange={(e) => setPayment({ ...payment, status: e.target.value as any })}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 cursor-pointer"
                                >
                                  <option value="pending">Pending</option>
                                  <option value="paid">Paid</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">Payment Method</label>
                                <div className="grid grid-cols-2 gap-2">
                                  {["invoice", "stripe", "cash", "check", "other"].map((m) => (
                                      <button
                                          key={m}
                                          onClick={() => setPayment({ ...payment, method: m as any })}
                                          className={`px-3 py-2 rounded-lg text-xs font-medium border capitalize transition-all ${
                                              payment.method === m
                                                  ? "bg-slate-900 text-white border-slate-900"
                                                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                                          }`}
                                      >
                                        {m}
                                      </button>
                                  ))}
                                </div>

                                <div className="mt-2 text-xs text-slate-500">
                                  If you pick <span className="font-semibold">Stripe</span> + <span className="font-semibold">Pending</span>, you’ll be redirected to Checkout immediately.
                                </div>
                              </div>

                              <div>
                                <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">External Reference</label>
                                <input
                                    type="text"
                                    value={payment.externalRef}
                                    onChange={(e) => setPayment({ ...payment, externalRef: e.target.value })}
                                    placeholder="PO # / Receipt # / Note"
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400"
                                />
                              </div>

                              {createOrderM.isError && (
                                  <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">
                                    {(createOrderM.error as any)?.message || "Failed to create order."}
                                  </div>
                              )}
                            </div>
                          </div>

                          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex gap-3">
                            <AlertCircle className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                            <div className="text-xs text-indigo-800">
                              <span className="font-bold block mb-0.5">Server-side pricing</span>
                              Variant + keycard tier prices are recalculated on the backend. Custom items are stored as “custom price_source”.
                            </div>
                          </div>
                        </div>
                      </div>
                  )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 bg-white flex justify-between items-center shrink-0">
                  {step > 1 ? (
                      <button
                          onClick={() => setStep(step - 1)}
                          className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-2"
                      >
                        <ChevronLeft className="w-4 h-4" /> Back
                      </button>
                  ) : (
                      <button
                          onClick={handleClose}
                          className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                  )}

                  {step < 3 ? (
                      <button
                          onClick={() => setStep(step + 1)}
                          disabled={(step === 1 && !canNextStep1) || (step === 2 && !canNextStep2)}
                          className="px-6 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next Step <ChevronRight className="w-4 h-4" />
                      </button>
                  ) : (
                      <button
                          onClick={() => createOrderM.mutate()}
                          disabled={createOrderM.isPending || items.length === 0}
                          className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md transition-colors flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <CheckCircle className="w-4 h-4" />
                        {createOrderM.isPending ? "Creating…" : "Create Order"}
                      </button>
                  )}
                </div>
              </div>
            </div>
        )}

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Orders</h1>
            <p className="text-slate-500 mt-1 text-sm">Manage and track all customer orders, payments, and fulfillment status.</p>
          </div>
          <div className="flex gap-3">
            <button className="inline-flex items-center px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm">
              <Download className="w-4 h-4 mr-2 text-slate-500" /> Export
            </button>
            <button
                onClick={() => setIsWizardOpen(true)}
                className="inline-flex items-center px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" /> New Order
            </button>
          </div>
        </div>

        {/* Stats Cards (still mock visuals) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[
            { title: "Total Orders", value: String(totalOrders), change: "", color: "blue" },
            { title: "Pending", value: "—", sub: "Requires action", color: "amber" },
            { title: "Unpaid", value: "—", sub: "Outstanding", color: "red" },
            { title: "Revenue (MTD)", value: "—", change: "", color: "emerald" },
          ].map((stat, i) => (
              <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-slate-500">{stat.title}</p>
                    <h3 className="text-2xl font-bold text-slate-900 mt-2">{stat.value}</h3>
                  </div>
                  {(() => {
                    const c = STAT_COLOR_CLASSES[stat.color] || STAT_COLOR_CLASSES.slate;
                    return (
                        <div className={`p-2 ${c.bg} rounded-lg`}>
                          <div className={`w-4 h-4 ${c.dot} rounded-sm opacity-20`} />
                        </div>
                    );
                  })()}
                </div>
                <div className={`mt-2 text-xs ${stat.change ? "text-emerald-600 flex items-center" : "text-slate-500"}`}>
                  {stat.change && <TrendingUp className="w-3 h-3 mr-1" />}
                  {stat.change || stat.sub}
                </div>
              </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          {/* Controls */}
          <div className="p-4 border-b border-slate-200 flex flex-wrap gap-4 items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              <button
                  onClick={() => setQuickFilter("all")}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      quickFilter === "all" ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:bg-slate-50"
                  }`}
              >
                All Orders
              </button>
              <button
                  onClick={() => setQuickFilter("paid")}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1 ${
                      quickFilter === "paid" ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:bg-slate-50"
                  }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Paid
              </button>
              <button
                  onClick={() => setQuickFilter("unpaid")}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1 ${
                      quickFilter === "unpaid" ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:bg-slate-50"
                  }`}
              >
                <span className="w-2 h-2 rounded-full bg-red-500" /> Unpaid
              </button>
              <button
                  onClick={() => setQuickFilter("fulfilled")}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1 ${
                      quickFilter === "fulfilled" ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:bg-slate-50"
                  }`}
              >
                <span className="w-2 h-2 rounded-full bg-blue-500" /> Fulfilled
              </button>
              <div className="h-6 w-px bg-slate-200 mx-2" />
              <button className="px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-50 rounded-md flex items-center gap-1">
                <Filter className="w-4 h-4" /> More Filters
              </button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-9 pr-4 py-1.5 text-sm rounded-md border border-slate-200 focus:ring-1 focus:ring-slate-900 w-64"
                  placeholder="Search orders..."
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 w-12">
                  <input type="checkbox" className="rounded border-slate-300 text-slate-900 focus:ring-slate-900" />
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Order ID</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Payment</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Created At</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</th>
              </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
              {ordersQ.isError && (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-sm text-red-600">
                      {(ordersQ.error as any)?.message || "Failed to load orders."}
                    </td>
                  </tr>
              )}

              {ordersQ.isLoading && (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-500">
                      Loading orders…
                    </td>
                  </tr>
              )}

              {!ordersQ.isLoading && !ordersQ.isError && orders.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-500">
                      No orders found.
                    </td>
                  </tr>
              )}

              {orders.map((order) => {
                const s = statusUi(order);
                const p = paymentUi(order);
                const { date, time } = formatCreatedAt(order.created_at);
                const orderLabel = order.order_number || `#${order.id}`;
                const customerLabel = order.customer_name || order.customer_email || "—";

                return (
                    <tr
                        key={order.id}
                        className="hover:bg-slate-50 transition-colors cursor-pointer group"
                        onClick={() => navigate(`/orders/${order.id}`)}
                    >
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" className="rounded border-slate-300 text-slate-900 focus:ring-slate-900" />
                      </td>

                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-slate-900 hover:text-indigo-600">{orderLabel}</div>
                        <div className="text-xs text-slate-500">{customerLabel}</div>
                      </td>

                      <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${s.cls}`}>
                        {s.label}
                      </span>
                        <div className="text-xs text-slate-500 mt-1">
                          {order.order_status}
                          {order.shipping_status ? ` • ${order.shipping_status}` : ""}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <p.Icon className={`w-4 h-4 ${p.iconClass}`} />
                          <span className="text-sm text-slate-700">{p.label}</span>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-sm font-medium text-slate-900">{moneyFromCents(order.total_cents, order.currency)}</td>

                      <td className="px-6 py-4 text-sm text-slate-500">
                        {date} <span className="text-xs opacity-70 ml-1">{time}</span>
                      </td>

                      <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button className="text-slate-400 hover:text-slate-900">
                          <MoreHorizontal className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                );
              })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="text-sm text-slate-500">
              Showing <span className="font-medium">{showingFrom}</span> to <span className="font-medium">{showingTo}</span> of{" "}
              <span className="font-medium">{totalOrders}</span> results
            </div>

            <div className="flex items-center gap-2">
              <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-2 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed bg-white text-slate-600 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {[...Array(totalPages)].map((_, i) => (
                  <button
                      key={i}
                      onClick={() => handlePageChange(i + 1)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                          currentPage === i + 1 ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                  >
                    {i + 1}
                  </button>
              ))}

              <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="p-2 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed bg-white text-slate-600 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
  );
};

export default OrdersList;
