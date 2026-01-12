import React, {useEffect, useMemo, useState} from "react";
import {useNavigate, useParams} from "react-router-dom";
import {
    ChevronRight,
    Info,
    QrCode,
    Link as LinkIcon,
    ExternalLink,
    PlusCircle,
    ShoppingBag,
    DollarSign,
    Trash2,
    X,
    Edit2,
    Save,
    Hourglass,
    CheckCheck,
    XCircle,
    AlertTriangle, // ✅ add this

} from "lucide-react";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import Loading from "@/components/Loading.tsx";
import { adminFetch} from "@/src/lib/api.ts";


type StripeSyncStatus = "pending" | "synced" | "failed" | null;

type ApiVariant = {
    id: number;
    product_id: number;
    sku: string | null;
    name: string;
    description: string | null;
    active: number; // 0/1/2
    created_at?: string;
    updated_at?: string;
};

type ApiVariantPriceRow = {
    id: number;
    variant_id: number;
    min_qty: number;
    max_qty: number | null;
    currency: string;
    unit_amount_cents: number;
    active: number; // 0/1

    stripe_price_id: string | null;

    // ✅ NEW
    stripe_sync_status: StripeSyncStatus;
    stripe_sync_error: string | null;
};

type VariantForm = {
    sku: string;
    name: string;
    description: string;
    active: number; // 0/1/2
};

type TierDraft = {
    // breakpoint tier: authoritative
    min_qty: number;
    // dollars string (UI friendly)
    unit_price: string;
    currency: string;
};


function statusFromActive(active: number): "active" | "inactive" | "archived" {
    if (active === 2) return "archived";
    if (active === 0) return "inactive";
    return "active";
}

function activeFromStatus(s: "active" | "inactive" | "archived"): number {
    if (s === "archived") return 2;
    if (s === "inactive") return 0;
    return 1;
}

function centsToDollarsString(cents: number): string {
    const v = Number.isFinite(cents) ? cents : 0;
    return (v / 100).toFixed(2);
}

function parseDollarsToCents(input: string): number | null {
    const s = (input ?? "").toString().trim();
    if (!s) return null;
    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    const cents = Math.round(n * 100);
    if (!Number.isInteger(cents) || cents < 0) return null;
    return cents;
}

function normalizeBreakpoints(tiers: TierDraft[], currencyFallback = "usd"): TierDraft[] {
    if (!Array.isArray(tiers) || tiers.length === 0) {
        return [{min_qty: 1, unit_price: "0.00", currency: currencyFallback}];
    }

    const cleaned = tiers
        .map((t) => {
            const min = Math.max(1, Math.floor(Number(t.min_qty)));
            return {
                min_qty: Number.isFinite(min) ? min : 1,
                unit_price: (t.unit_price ?? "").toString(),
                currency: (t.currency ?? currencyFallback).toString().trim() || currencyFallback,
            };
        })
        .sort((a, b) => a.min_qty - b.min_qty);

    // dedupe mins (keep last)
    const dedup: TierDraft[] = [];
    for (const t of cleaned) {
        const last = dedup[dedup.length - 1];
        if (last && last.min_qty === t.min_qty) dedup[dedup.length - 1] = t;
        else dedup.push(t);
    }

    // enforce first starts at 1
    dedup[0].min_qty = 1;

    // enforce strictly increasing mins
    for (let i = 1; i < dedup.length; i++) {
        const prev = dedup[i - 1].min_qty;
        if (dedup[i].min_qty <= prev) dedup[i].min_qty = prev + 1;
    }

    return dedup;
}

function computeMaxQty(tiers: TierDraft[], idx: number): number | null {
    const next = tiers[idx + 1];
    if (!next) return null;
    return next.min_qty - 1;
}

function StripeSyncBadge({
                             status,
                             error,
                             stripePriceId,
                         }: {
    status?: StripeSyncStatus;
    error?: string | null;
    stripePriceId?: string | null;
}) {
    if (!status) return null;

    if (status === "pending") {
        return (
            <span
                className="inline-flex items-center justify-center"
                title="Stripe sync pending"
            >
<Hourglass className="w-4 h-4" style={{color: "#d97706"}}/> {/* amber-ish */}
      </span>
        );
    }

    if (status === "synced") {
        return (
            <span
                className="inline-flex items-center justify-center"
                title={stripePriceId ? `Stripe synced (${stripePriceId})` : "Stripe synced"}
            >
<CheckCheck className="w-4 h-4" style={{color: "#059669"}}/> {/* green-ish */}
      </span>
        );
    }

    // failed
    const msg = (error ?? "").trim() || "Stripe sync failed (no error provided).";
    return (
        <span className="relative inline-flex items-center justify-center group">
<XCircle className="w-4 h-4" style={{color: "#dc2626"}}/> {/* red-ish */}
            <span
                className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-50">
        <span
            className="block max-w-[340px] whitespace-pre-wrap rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-lg">
          {msg}
        </span>
      </span>
    </span>
    );
}

const VariantEditor: React.FC = () => {
    const navigate = useNavigate();
    const {variantId} = useParams<{ variantId: string }>();
    const queryClient = useQueryClient();

    const variantIdNum = useMemo(() => {
        const n = Number(variantId);
        return Number.isInteger(n) && n > 0 ? n : null;
    }, [variantId]);

    // Pricing modal
    const [isAddTierOpen, setIsAddTierOpen] = useState(false);
    const [addTierMin, setAddTierMin] = useState<string>("");
    const [addTierPrice, setAddTierPrice] = useState<string>("");

    // General info edit/save only
    const [isEditingGeneral, setIsEditingGeneral] = useState(false);
    const [generalError, setGeneralError] = useState<string | null>(null);

    // Pricing edit/save
    const [isEditingPricing, setIsEditingPricing] = useState(false);
    const [pricingError, setPricingError] = useState<string | null>(null);

    const [form, setForm] = useState<VariantForm>({
        sku: "",
        name: "",
        description: "",
        active: 1,
    });

    const status = statusFromActive(form.active);

    const getStatusColor = () => {
        switch (status) {
            case "active":
                return "bg-emerald-50 text-emerald-700 border-emerald-100";
            case "inactive":
                return "bg-slate-100 text-slate-600 border-slate-200";
            case "archived":
                return "bg-amber-50 text-amber-700 border-amber-100";
        }
    };

    const getStatusDot = () => {
        switch (status) {
            case "active":
                return "bg-emerald-500";
            case "inactive":
                return "bg-slate-400";
            case "archived":
                return "bg-amber-500";
        }
    };

    // GET /api/variants/:variantId
    const variantQuery = useQuery({
        queryKey: ["variant", variantIdNum],
        enabled: !!variantIdNum,
        queryFn: async () => {
            return adminFetch<ApiVariant>(`/variants/${variantIdNum}`);
        },
    });

    useEffect(() => {
        if (!variantQuery.data) return;
        const v = variantQuery.data;

        setForm({
            sku: v.sku ?? "",
            name: v.name ?? "",
            description: v.description ?? "",
            active: typeof v.active === "number" ? v.active : 1,
        });

        setIsEditingGeneral(false);
        setGeneralError(null);
    }, [variantQuery.data]);

    // PATCH /api/variants/:variantId
    const patchVariant = useMutation({
        mutationFn: async (payload: Partial<ApiVariant>) => {
            if (!variantIdNum) throw new Error("Invalid variant id.");
            return adminFetch<ApiVariant>(`/variants/${variantIdNum}`, {
                method: "PATCH",
                body: JSON.stringify(payload),
            });
        },
        onSuccess: async (updated) => {
            setGeneralError(null);
            setIsEditingGeneral(false);

            queryClient.setQueryData(["variant", variantIdNum], updated);

            await queryClient.invalidateQueries({queryKey: ["variant", variantIdNum]});
            await queryClient.invalidateQueries({queryKey: ["variants"]});
            await queryClient.invalidateQueries({queryKey: ["variantsByProduct"]});
            await queryClient.invalidateQueries({queryKey: ["product"]});
        },
        onError: (e: any) => {
            setGeneralError(e?.message || "Failed to save changes.");
        },
    });

    const canSaveGeneral = form.sku.trim().length > 0 && form.name.trim().length > 0;

    const onSaveGeneral = () => {
        setGeneralError(null);
        patchVariant.mutate({
            sku: form.sku.trim() || null,
            name: form.name.trim(),
            description: form.description.trim() || null,
            active: form.active,
        });
    };

    const onCancelGeneral = () => {
        const v = variantQuery.data;
        if (!v) return;

        setForm({
            sku: v.sku ?? "",
            name: v.name ?? "",
            description: v.description ?? "",
            active: typeof v.active === "number" ? v.active : 1,
        });

        setGeneralError(null);
        setIsEditingGeneral(false);
    };

    // -----------------------------
    // Tiered Pricing
    // -----------------------------
    const variantPricesQuery = useQuery({
        queryKey: ["variantPrices", variantIdNum],
        enabled: !!variantIdNum,
        queryFn: async () => {
            if (!variantIdNum) throw new Error("Invalid variant id.");
            return adminFetch<ApiVariantPriceRow[]>(
                `/variants/${variantIdNum}/prices?active=1`
            );
        },

        // ✅ Auto-poll while anything is pending (keeps icons current)
        refetchInterval: (q) => {
            const data = q.state.data as ApiVariantPriceRow[] | undefined;
            const hasPending = (data ?? []).some((r) => r.stripe_sync_status === "pending");
            return hasPending ? 2000 : false;
        },
        refetchIntervalInBackground: true,
    });

    // quick lookup by min_qty for rendering icons beside tiers
    const serverRowByMin = useMemo(() => {
        const map = new Map<number, ApiVariantPriceRow>();
        for (const r of variantPricesQuery.data || []) map.set(r.min_qty, r);
        return map;
    }, [variantPricesQuery.data]);

    const serverTiersDraft = useMemo<TierDraft[]>(() => {
        const rows = variantPricesQuery.data || [];
        const mapped = rows
            .slice()
            .sort((a, b) => a.min_qty - b.min_qty)
            .map((r) => ({
                min_qty: r.min_qty,
                unit_price: centsToDollarsString(r.unit_amount_cents),
                currency: r.currency || "usd",
            }));
        return normalizeBreakpoints(mapped, "usd");
    }, [variantPricesQuery.data]);

    const [draftTiers, setDraftTiers] = useState<TierDraft[]>([
        {min_qty: 1, unit_price: "0.00", currency: "usd"},
    ]);

    // keep draft in sync when NOT editing pricing
    useEffect(() => {
        if (isEditingPricing) return;
        if (serverTiersDraft.length) setDraftTiers(serverTiersDraft);
    }, [serverTiersDraft, isEditingPricing]);

    const replaceVariantPrices = useMutation({
        mutationFn: async (payload: {
            currency?: string;
            tiers: { min_qty: number; unit_amount_cents: number; currency?: string }[];
        }) => {
            if (!variantIdNum) throw new Error("Invalid variant id.");
            return adminFetch<{ variant_id: number; tiers: ApiVariantPriceRow[] }>(
                `/variants/${variantIdNum}/prices`,
                { method: "PUT", body: JSON.stringify(payload) }
            );
        },
        onSuccess: async (data) => {
            setPricingError(null);
            setIsEditingPricing(false);

            // update cache immediately (includes stripe_sync_status/error)
            queryClient.setQueryData(["variantPrices", variantIdNum], data.tiers);

            await queryClient.invalidateQueries({queryKey: ["variantPrices", variantIdNum]});
            await queryClient.invalidateQueries({queryKey: ["variant", variantIdNum]});
        },
        onError: (e: any) => {
            setPricingError(e?.message || "Failed to save tiered pricing.");
        },
    });

    function beginEditPricing() {
        setPricingError(null);
        setDraftTiers(serverTiersDraft);
        setIsEditingPricing(true);
    }

    function cancelEditPricing() {
        setPricingError(null);
        setIsEditingPricing(false);
        setDraftTiers(serverTiersDraft);
        setIsAddTierOpen(false);
        setAddTierMin("");
        setAddTierPrice("");
    }

    function validateDraftPricing(
        tiers: TierDraft[]
    ): { ok: true; payload: any } | { ok: false; error: string } {
        if (!tiers || tiers.length === 0) return {ok: false, error: "At least one tier is required."};

        const normalized = normalizeBreakpoints(tiers, "usd");
        if (normalized[0].min_qty !== 1) return {ok: false, error: "First tier must start at quantity 1."};

        const tierPayload = normalized.map((t) => {
            const cents = parseDollarsToCents(t.unit_price);
            if (cents === null) return null;
            return {
                min_qty: t.min_qty,
                unit_amount_cents: cents,
                currency: (t.currency || "usd").toLowerCase(),
            };
        });

        if (tierPayload.some((x) => x === null)) {
            return {ok: false, error: "All tiers must have a valid Unit Price (e.g., 249.00)."};
        }

        for (let i = 0; i < tierPayload.length; i++) {
            const row = tierPayload[i]!;
            if (row.unit_amount_cents <= 0) {
                return {ok: false, error: "Unit Price must be greater than 0 for all tiers."};
            }
        }

        return {
            ok: true,
            payload: {currency: (normalized[0].currency || "usd").toLowerCase(), tiers: tierPayload as any},
        };
    }

    function savePricing() {
        setPricingError(null);
        const v = validateDraftPricing(draftTiers);
        if (!v.ok) {
            setPricingError(v.error);
            return;
        }
        replaceVariantPrices.mutate(v.payload);
    }

    function setTierPrice(idx: number, value: string) {
        setDraftTiers((prev) => {
            const next = prev.slice();
            next[idx] = {...next[idx], unit_price: value};
            return next;
        });
    }

    // Max Qty edit => update next tier min = max + 1 (so no gaps/overlaps)
    function setTierMax(idx: number, maxStr: string) {
        setDraftTiers((prev) => {
            const tiers = normalizeBreakpoints(prev, "usd").slice();
            if (idx < 0 || idx >= tiers.length) return tiers;
            if (idx === tiers.length - 1) return tiers; // last is ∞

            const min = tiers[idx].min_qty;
            const parsed = Math.floor(Number(maxStr));
            if (!Number.isFinite(parsed)) return tiers;

            const safeMax = Math.max(min, parsed);
            const nextMin = safeMax + 1;

            tiers[idx + 1] = {...tiers[idx + 1], min_qty: nextMin};
            return normalizeBreakpoints(tiers, "usd");
        });
    }

    function deleteTier(idx: number) {
        setDraftTiers((prev) => {
            const tiers = normalizeBreakpoints(prev, "usd").slice();
            if (tiers.length <= 1) return tiers;
            if (idx < 0 || idx >= tiers.length) return tiers;

            tiers.splice(idx, 1);
            return normalizeBreakpoints(tiers, "usd");
        });
    }

    function addTier() {
        setPricingError(null);

        const min = Math.floor(Number(addTierMin));
        if (!Number.isFinite(min) || min < 2) {
            setPricingError("Start Qty must be a number >= 2.");
            return;
        }

        const cents = parseDollarsToCents(addTierPrice);
        if (cents === null || cents <= 0) {
            setPricingError("Unit Price must be a valid number > 0 (e.g., 199.00).");
            return;
        }

        setDraftTiers((prev) => {
            const tiers = normalizeBreakpoints(prev, "usd");
            const currency = (tiers[0]?.currency || "usd").toLowerCase();

            const inserted: TierDraft = {
                min_qty: min,
                unit_price: centsToDollarsString(cents),
                currency,
            };

            const next = normalizeBreakpoints([...tiers, inserted], currency);
            return next;
        });

        setIsAddTierOpen(false);
        setAddTierMin("");
        setAddTierPrice("");
    }

    if (!variantIdNum) {
        return (
            <div className="max-w-6xl mx-auto">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h1 className="text-lg font-semibold text-slate-900">Invalid Variant ID</h1>
                    <p className="text-sm text-slate-500 mt-1">URL must contain a positive integer variant id.</p>
                    <button
                        onClick={() => navigate(-1)}
                        className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800"
                    >
                        <ChevronRight className="w-4 h-4 rotate-180"/>
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    if (variantQuery.isLoading) return <Loading/>;

    if (variantQuery.isError) {
        return (
            <div className="max-w-6xl mx-auto">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h1 className="text-lg font-semibold text-slate-900">Failed to load variant</h1>
                    <p className="text-sm text-red-600 mt-2">{(variantQuery.error as any)?.message || "Unknown error"}</p>
                    <button
                        onClick={() => variantQuery.refetch()}
                        className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800"
                    >
                        <Save className="w-4 h-4"/>
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    const variant = variantQuery.data!;
    const tiersToRender = isEditingPricing ? draftTiers : serverTiersDraft;

    return (
        <div className="max-w-6xl mx-auto relative">
            {/* Add Tier Modal */}
            {isAddTierOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
                    <div
                        className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="font-semibold text-slate-900">Add Pricing Tier</h3>
                            <button
                                onClick={() => setIsAddTierOpen(false)}
                                className="text-slate-400 hover:text-slate-900 transition-colors"
                                disabled={replaceVariantPrices.isPending}
                            >
                                <X className="w-5 h-5"/>
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">Start
                                        Qty</label>
                                    <input
                                        type="number"
                                        value={addTierMin}
                                        onChange={(e) => setAddTierMin(e.target.value)}
                                        placeholder="e.g. 11"
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition-all placeholder:text-slate-400"
                                    />
                                    <p className="mt-1 text-[11px] text-slate-500">This tier starts at this quantity
                                        (breakpoint).</p>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">Unit
                                        Price ($)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2 text-slate-400 text-sm">$</span>
                                        <input
                                            type="text"
                                            value={addTierPrice}
                                            onChange={(e) => setAddTierPrice(e.target.value)}
                                            placeholder="0.00"
                                            className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition-all placeholder:text-slate-400"
                                        />
                                    </div>
                                    <p className="mt-1 text-[11px] text-slate-500">
                                        Price applies from Start Qty and up until next tier.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                            <button
                                onClick={() => setIsAddTierOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                                disabled={replaceVariantPrices.isPending}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={addTier}
                                disabled={replaceVariantPrices.isPending}
                                className="px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors disabled:opacity-60"
                            >
                                Add Tier
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <nav className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <span className="hover:text-slate-900 cursor-pointer" onClick={() => navigate("/products")}>
              Catalog
            </span>
                        <ChevronRight className="w-4 h-4"/>
                        <span className="hover:text-slate-900 cursor-pointer" onClick={() => navigate(-1)}>
              Products
            </span>
                        <ChevronRight className="w-4 h-4"/>
                        <span className="text-slate-900 font-medium">Edit Variant</span>
                    </nav>
                    <h1 className="text-2xl font-bold text-slate-900">Variant #{variant.id}</h1>
                    <p className="text-slate-500 mt-1">Manage details, tiered pricing, and Stripe integration for this
                        SKU.</p>
                </div>

                <div className="flex items-center gap-3">
          <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor()}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${getStatusDot()}`}/>
              {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {/* General Information */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <h3 className="font-semibold text-slate-900">General Information</h3>
                                <Info className="w-5 h-5 text-slate-400"/>
                            </div>

                            {!isEditingGeneral ? (
                                <button
                                    onClick={() => {
                                        setGeneralError(null);
                                        setIsEditingGeneral(true);
                                    }}
                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                >
                                    <Edit2 className="w-4 h-4"/>
                                    Edit
                                </button>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={onCancelGeneral}
                                        disabled={patchVariant.isPending}
                                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={onSaveGeneral}
                                        disabled={!canSaveGeneral || patchVariant.isPending}
                                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-60"
                                    >
                                        <Save className="w-4 h-4"/>
                                        {patchVariant.isPending ? "Saving..." : "Save"}
                                    </button>
                                </div>
                            )}
                        </div>

                        {generalError && (
                            <div
                                className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                {generalError}
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1.5 uppercase">SKU</label>
                                <div className="relative">
                                    <QrCode className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/>
                                    <input
                                        type="text"
                                        value={form.sku}
                                        onChange={(e) => setForm((p) => ({...p, sku: e.target.value}))}
                                        disabled={!isEditingGeneral}
                                        className={`w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-colors ${
                                            isEditingGeneral ? "bg-white border-slate-200" : "bg-slate-50 border-slate-200 text-slate-600"
                                        }`}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1.5 uppercase">Display
                                    Name</label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={(e) => setForm((p) => ({...p, name: e.target.value}))}
                                    disabled={!isEditingGeneral}
                                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-colors ${
                                        isEditingGeneral ? "bg-white border-slate-200" : "bg-slate-50 border-slate-200 text-slate-600"
                                    }`}
                                />
                            </div>

                            <div className="col-span-2">
                                <label
                                    className="block text-xs font-medium text-slate-700 mb-1.5 uppercase">Description</label>
                                <textarea
                                    rows={3}
                                    value={form.description}
                                    onChange={(e) => setForm((p) => ({...p, description: e.target.value}))}
                                    disabled={!isEditingGeneral}
                                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 resize-none transition-colors ${
                                        isEditingGeneral ? "bg-white border-slate-200" : "bg-slate-50 border-slate-200 text-slate-600"
                                    }`}
                                />
                                <p className="mt-1.5 text-xs text-slate-400">Visible to customers during checkout.</p>
                            </div>
                        </div>

                        <div className="mt-6 pt-6 border-t border-slate-100">
                            <div className="flex items-center justify-between mb-3">
                                <span className="block text-sm font-medium text-slate-900">Status</span>
                                <span
                                    className="text-xs text-slate-500">Products are hidden from catalog when inactive.</span>
                            </div>

                            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                                {(["active", "inactive", "archived"] as const).map((s) => {
                                    const isSelected = status === s;
                                    const disabled = !isEditingGeneral || patchVariant.isPending;

                                    return (
                                        <button
                                            key={s}
                                            onClick={() => setForm((p) => ({...p, active: activeFromStatus(s)}))}
                                            disabled={disabled}
                                            className={`flex-1 capitalize py-2 text-sm font-medium rounded-md transition-all ${
                                                isSelected
                                                    ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                                                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-200/50"
                                            } ${
                                                disabled ? "opacity-70 cursor-not-allowed hover:bg-transparent hover:text-slate-500" : ""
                                            }`}
                                        >
                                            {s}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Tiered Pricing */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="font-semibold text-slate-900">Tiered Pricing</h3>
                                <p className="text-sm text-slate-500">Volume discounts based on quantity.</p>

                                {/* tiny legend */}
                                <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                                    <span className="inline-flex items-center gap-1"><Hourglass
                                        className="w-3.5 h-3.5 text-amber-600"/> pending</span>
                                    <span className="inline-flex items-center gap-1"><CheckCheck
                                        className="w-3.5 h-3.5 text-emerald-600"/> synced</span>
                                    <span className="inline-flex items-center gap-1"><XCircle
                                        className="w-3.5 h-3.5 text-red-600"/> failed</span>
                                </div>
                            </div>

                            {!isEditingPricing ? (
                                <button
                                    onClick={beginEditPricing}
                                    className="text-xs font-medium text-slate-700 hover:text-slate-900 flex items-center gap-1 transition-colors"
                                    disabled={variantPricesQuery.isLoading || variantPricesQuery.isError}
                                >
                                    <Edit2 className="w-3.5 h-3.5"/> Edit
                                </button>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setIsAddTierOpen(true)}
                                        className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                                        disabled={replaceVariantPrices.isPending}
                                    >
                                        <PlusCircle className="w-3.5 h-3.5"/> Add Tier
                                    </button>
                                    <button
                                        onClick={cancelEditPricing}
                                        disabled={replaceVariantPrices.isPending}
                                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                                    >
                                        Cancel
                                    </button>
                                    <span className="relative inline-flex group">
  <button
      onClick={savePricing}
      disabled={replaceVariantPrices.isPending}
      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-60"
  >
    <Save className="w-4 h-4"/>
      {replaceVariantPrices.isPending ? "Saving..." : "Save"}
  </button>

                                        {/* ✅ Hover warning */}
                                        <span
                                            className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-50">
    <span
        className="block max-w-[360px] whitespace-pre-wrap rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 shadow-lg">
      <span className="inline-flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 mt-[1px]"/>
        <span>
Save always recreates tiers and archives old prices.        </span>
      </span>
    </span>
  </span>
</span>

                                </div>
                            )}
                        </div>

                        {pricingError && (
                            <div
                                className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                {pricingError}
                            </div>
                        )}

                        {variantPricesQuery.isLoading ? (
                            <div className="py-6 text-sm text-slate-500">Loading pricing tiers…</div>
                        ) : variantPricesQuery.isError ? (
                            <div className="py-6">
                                <div className="text-sm text-red-600">
                                    {(variantPricesQuery.error as any)?.message || "Failed to load tiers."}
                                </div>
                                <button
                                    onClick={() => variantPricesQuery.refetch()}
                                    className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800"
                                >
                                    <Save className="w-4 h-4"/>
                                    Retry
                                </button>
                            </div>
                        ) : (
                            <>
                                <div
                                    className="grid grid-cols-10 gap-4 mb-2 px-2 text-xs font-medium text-slate-500 uppercase tracking-wider">
                                    <div className="col-span-3">Min Qty</div>
                                    <div className="col-span-3">Max Qty</div>
                                    <div className="col-span-3">Unit Price ($)</div>
                                    <div className="col-span-1 text-center">Stripe</div>
                                </div>

                                <div className="space-y-2">
                                    {tiersToRender.map((tier, i) => {
                                        const max = computeMaxQty(tiersToRender, i);

                                        // show Stripe status based on SERVER rows only (not draft edits)
                                        const serverRow = !isEditingPricing ? serverRowByMin.get(tier.min_qty) : undefined;

                                        return (
                                            <div
                                                key={`${tier.min_qty}-${i}`}
                                                className={`group grid grid-cols-10 gap-4 items-center bg-slate-50/50 p-2 rounded-lg border border-transparent hover:border-slate-200 transition-all ${
                                                    isEditingPricing ? "hover:bg-slate-50" : ""
                                                }`}
                                            >
                                                {/* Min Qty */}
                                                <div className="col-span-3">
                                                    <input
                                                        type="text"
                                                        value={tier.min_qty}
                                                        disabled
                                                        className="w-full text-center px-3 py-1.5 text-sm border rounded-md bg-transparent border-transparent text-slate-700"
                                                    />
                                                </div>

                                                {/* Max Qty */}
                                                <div className="col-span-3">
                                                    {max === null ? (
                                                        <input
                                                            type="text"
                                                            value="∞"
                                                            disabled
                                                            className="w-full text-center px-3 py-1.5 text-sm border rounded-md bg-slate-100 text-slate-400 border-slate-200"
                                                        />
                                                    ) : (
                                                        <input
                                                            type="number"
                                                            value={max}
                                                            disabled={!isEditingPricing || replaceVariantPrices.isPending}
                                                            onChange={(e) => setTierMax(i, e.target.value)}
                                                            className={`w-full text-center px-3 py-1.5 text-sm border rounded-md transition-colors ${
                                                                isEditingPricing
                                                                    ? "bg-white border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                                                                    : "bg-slate-100 text-slate-400 border-slate-200"
                                                            }`}
                                                        />
                                                    )}
                                                </div>

                                                {/* Unit Price */}
                                                <div className="col-span-3 relative">
                                                    <div className="relative">
                                                        <span
                                                            className="absolute left-3 top-2 text-slate-400 text-sm">$</span>
                                                        <input
                                                            type="text"
                                                            value={tier.unit_price}
                                                            disabled={!isEditingPricing || replaceVariantPrices.isPending}
                                                            onChange={(e) => setTierPrice(i, e.target.value)}
                                                            className={`w-full pl-7 pr-3 text-right px-3 py-1.5 text-sm border rounded-md font-medium transition-colors ${
                                                                isEditingPricing
                                                                    ? "bg-white border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                                                                    : "bg-transparent border-transparent text-slate-700"
                                                            }`}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Stripe status icon (view mode) OR delete (edit mode) */}
                                                <div className="col-span-1 flex justify-center">
                                                    {!isEditingPricing ? (
                                                        <StripeSyncBadge
                                                            status={serverRow?.stripe_sync_status ?? null}
                                                            error={serverRow?.stripe_sync_error ?? null}
                                                            stripePriceId={serverRow?.stripe_price_id ?? null}
                                                        />
                                                    ) : (
                                                        <button
                                                            onClick={() => deleteTier(i)}
                                                            disabled={replaceVariantPrices.isPending || tiersToRender.length <= 1}
                                                            className={`text-slate-400 hover:text-red-500 transition-colors ${
                                                                tiersToRender.length <= 1 ? "opacity-40 cursor-not-allowed" : ""
                                                            }`}
                                                            title={tiersToRender.length <= 1 ? "At least one tier is required" : "Delete tier"}
                                                        >
                                                            <Trash2 className="w-4 h-4"/>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="mt-4 text-[11px] text-slate-500">
                                    Max Qty is derived from the next tier’s Start Qty (breakpoints). Editing Max Qty
                                    automatically
                                    adjusts the next tier start so there are no gaps or overlaps.
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Stripe Mapping */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 relative overflow-hidden">
                        <div
                            className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-bl-3xl"/>
                        <div className="flex items-center gap-2 mb-6">
                            <LinkIcon className="w-5 h-5 text-indigo-500"/>
                            <h3 className="font-semibold text-slate-900">Stripe Mapping</h3>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label
                                    className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">
                                    Variant ID
                                </label>
                                <div className="flex items-center gap-2">
                                    <code
                                        className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono text-slate-600">
                                        {variant.id}
                                    </code>
                                </div>
                            </div>
                            <div>
                                <label
                                    className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">
                                    Product ID
                                </label>
                                <div className="flex items-center gap-2">
                                    <code
                                        className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono text-slate-600">
                                        {variant.product_id}
                                    </code>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 pt-4 border-t border-slate-100">
                            <a
                                href="#"
                                className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                            >
                                View in Stripe Dashboard <ExternalLink className="w-3 h-3"/>
                            </a>
                        </div>
                    </div>

                    {/* Performance */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                        <h3 className="text-sm font-semibold text-slate-900 mb-4">Performance</h3>
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                                    <ShoppingBag className="w-4 h-4"/>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500">Total Sold</p>
                                    <p className="text-sm font-bold text-slate-900">1,204</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                                <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                                    <DollarSign className="w-4 h-4"/>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500">Revenue</p>
                                    <p className="text-sm font-bold text-slate-900">$342,192</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Danger Zone */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                        <h3 className="text-sm font-semibold text-slate-900 mb-3">Danger Zone</h3>
                        <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                            Deleting this variant will remove it from all associated products. This action cannot be
                            undone.
                        </p>
                        <button
                            className="w-full py-2 px-4 border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-sm font-medium transition-colors">
                            Delete Variant
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VariantEditor;
