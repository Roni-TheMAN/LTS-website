// admin-panel/views/Keycards.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Loading from "@/components/Loading.tsx";
import {
    Plus,
    Trash2,
    Pencil,
    X,
    Check,
    Image as ImageIcon,
    ChevronLeft,
    SplitSquareHorizontal,
    Save,
    Upload,
} from "lucide-react";
import { adminFetch, adminUpload, adminAssetUrl} from "@/src/lib/api.ts";


type ApiBrand = { id: number; name: string; active: number; created_at: string };

type ApiLockTech = {
    id: number;
    name: string;
    active: number; // 0/1
    created_at: string;
    tiers_count?: number;
};

type ApiTier = {
    id: number;
    lock_tech_id: number;
    min_boxes: number;
    max_boxes: number | null; // derived by server normalization
    currency: string;
    price_per_box_cents: number;
    active: number;
    created_at: string;
};

type ApiDesign = {
    id: number;
    brand_id: number | null;
    brand_name: string | null;
    code: string;
    name: string;
    description: string | null;
    active: number;
    created_at: string;
    image_url?: string | null; // optional server-provided preview
};

type ApiImage = {
    id: number;
    entity_type: string;
    entity_id: number;
    url: string;
    alt_text: string | null;
    sort_order: number;
    created_at: string;
};

type DraftTier = {
    min_boxes: number;
    price_per_box_cents: number;
    currency: string; // keep for future
};


function moneyCentsToStr(cents: number) {
    return (cents / 100).toFixed(2);
}
function moneyStrToCents(s: string) {
    const cleaned = (s || "").replace(/[^\d.]/g, "");
    if (!cleaned) return 0;
    const num = Number(cleaned);
    if (!Number.isFinite(num) || num < 0) return 0;
    return Math.round(num * 100);
}

// --------- Breakpoint normalize on client (matches backend) ----------
function normalizeDraftTiers(input: DraftTier[]): DraftTier[] {
    let tiers = (input || [])
        .map((t) => ({
            min_boxes: Number.isFinite(Number(t.min_boxes)) ? Math.max(1, Math.trunc(Number(t.min_boxes))) : 1,
            price_per_box_cents: Number.isFinite(Number(t.price_per_box_cents))
                ? Math.max(0, Math.trunc(Number(t.price_per_box_cents)))
                : 0,
            currency: (t.currency || "usd").trim() || "usd",
        }))
        .filter((t) => Number.isInteger(t.min_boxes) && t.min_boxes >= 1);

    if (tiers.length === 0) tiers = [{ min_boxes: 1, price_per_box_cents: 0, currency: "usd" }];

    tiers.sort((a, b) => a.min_boxes - b.min_boxes);

    tiers[0].min_boxes = 1;

    for (let i = 1; i < tiers.length; i++) {
        if (tiers[i].min_boxes <= tiers[i - 1].min_boxes) {
            tiers[i].min_boxes = tiers[i - 1].min_boxes + 1;
        }
    }
    return tiers;
}

function derivedMaxBoxes(tiers: DraftTier[], idx: number): number | null {
    const next = tiers[idx + 1];
    return next ? next.min_boxes - 1 : null;
}

function Toggle({
                    checked,
                    disabled,
                    onChange,
                }: {
    checked: boolean;
    disabled?: boolean;
    onChange: (next: boolean) => void;
}) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={[
                "relative inline-flex items-center w-12 h-7 rounded-full border transition",
                "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-300",
                disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
                checked ? "bg-emerald-500 border-emerald-600" : "bg-slate-200 border-slate-300",
            ].join(" ")}
            aria-pressed={checked}
        >
      <span
          className={[
              "absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform",
              checked ? "translate-x-5" : "translate-x-0.5",
          ].join(" ")}
      />
            <span className="sr-only">Toggle</span>
        </button>
    );
}

export default function Keycards() {
    const qc = useQueryClient();

    const [tab, setTab] = useState<"techs" | "designs" | "brands">("techs");
    const [selectedTechId, setSelectedTechId] = useState<number | null>(null);

    // design image previews (local cache so uploads show immediately even if /keycards/designs doesn't return image_url)
    const [designPreviewById, setDesignPreviewById] = useState<Record<number, string | null>>({});
    // second image preview (used for hover swap)
    const [designPreview2ById, setDesignPreview2ById] = useState<Record<number, string | null>>({});
    // avoid spamming prefetch requests
    const prefetchedDesignIdsRef = useRef<Set<number>>(new Set());

    // -------- queries --------
    const lockTechQ = useQuery({
        queryKey: ["keycards", "lock-tech"],
        queryFn: () => adminFetch<ApiLockTech[]>(`/keycards/lock-tech`),
    });

    const brandsQ = useQuery({
        queryKey: ["keycards", "brands"],
        queryFn: () => adminFetch<ApiBrand[]>(`/keycards/brands`),
    });

    const designsQ = useQuery({
        queryKey: ["keycards", "designs"],
        queryFn: () => adminFetch<ApiDesign[]>(`/keycards/designs`),
    });

    const tiersQ = useQuery({
        queryKey: ["keycards", "tiers", selectedTechId],
        enabled: !!selectedTechId,
        queryFn: () =>
            adminFetch<ApiTier[]>(`/keycards/lock-tech/${selectedTechId}/tiers?active=1`),
    });

    const techs = lockTechQ.data || [];
    const brands = brandsQ.data || [];
    const designs = designsQ.data || [];

    const selectedTech = useMemo(
        () => techs.find((t) => t.id === selectedTechId) || null,
        [techs, selectedTechId]
    );

    // -------- local draft tiers (editable) --------
    const [draftTiers, setDraftTiers] = useState<DraftTier[]>([
        { min_boxes: 1, price_per_box_cents: 0, currency: "usd" },
    ]);

    useEffect(() => {
        if (!tiersQ.data) return;
        const mapped: DraftTier[] = (tiersQ.data || []).map((t) => ({
            min_boxes: t.min_boxes,
            price_per_box_cents: t.price_per_box_cents,
            currency: t.currency || "usd",
        }));
        setDraftTiers(normalizeDraftTiers(mapped));
    }, [tiersQ.data]);

    // -------- mutations --------
    const createTechM = useMutation({
        mutationFn: (payload: { name: string }) =>
            adminFetch<ApiLockTech>(`/keycards/lock-tech`, {
                method: "POST",
                body: JSON.stringify(payload),
            }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["keycards", "lock-tech"] }),
    });

    const updateTechM = useMutation({
        mutationFn: ({
                         id,
                         patch,
                     }: {
            id: number;
            patch: Partial<Pick<ApiLockTech, "name" | "active">>;
        }) =>
            adminFetch<ApiLockTech>(`/keycards/lock-tech/${id}`, {
                method: "PATCH",
                body: JSON.stringify(patch),
            }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["keycards", "lock-tech"] }),
    });

    const deleteTechM = useMutation({
        mutationFn: (id: number) => adminFetch(`${`/keycards/lock-tech/${id}`}`, { method: "DELETE" }),
        onSuccess: () => {
            setSelectedTechId(null);
            qc.invalidateQueries({ queryKey: ["keycards", "lock-tech"] });
        },
    });

    const saveTiersM = useMutation({
        mutationFn: ({ lockTechId, tiers }: { lockTechId: number; tiers: DraftTier[] }) =>
            adminFetch<{ ok: true; lock_tech_id: number; tiers: ApiTier[] }>(
                `/keycards/lock-tech/${lockTechId}/tiers`,
                { method: "PUT", body: JSON.stringify({ tiers }) }
            )
        ,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["keycards", "tiers", selectedTechId] });
            qc.invalidateQueries({ queryKey: ["keycards", "lock-tech"] });
        },
    });

    const createBrandM = useMutation({
        mutationFn: (payload: { name: string }) =>
            adminFetch<ApiBrand>(`/keycards/brands`, { method: "POST", body: JSON.stringify(payload) }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["keycards", "brands"] }),
    });

    const updateBrandM = useMutation({
        mutationFn: ({ id, patch }: { id: number; patch: Partial<Pick<ApiBrand, "name" | "active">> }) =>
            adminFetch<ApiBrand>(`/keycards/brands/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["keycards", "brands"] }),
    });

    const deleteBrandM = useMutation({
        mutationFn: (id: number) => adminFetch(`/keycards/brands/${id}`, { method: "DELETE" }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["keycards", "brands"] });
            qc.invalidateQueries({ queryKey: ["keycards", "designs"] });
        },
    });

    const updateDesignM = useMutation({
        mutationFn: ({
                         id,
                         patch,
                     }: {
            id: number;
            patch: Partial<Pick<ApiDesign, "brand_id" | "code" | "name" | "description" | "active">>;
        }) =>
            adminFetch<ApiDesign>(`/keycards/designs/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["keycards", "designs"] }),
    });

    const deleteDesignM = useMutation({
        mutationFn: (id: number) => adminFetch(`/keycards/designs/${id}`, { method: "DELETE" }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["keycards", "designs"] }),
    });

    // -------- design images (max 2 per design) --------
    const [imagesModalOpen, setImagesModalOpen] = useState(false);
    const [imagesModalDesign, setImagesModalDesign] = useState<ApiDesign | null>(null);
    const imagesModalDesignId = imagesModalDesign?.id ?? null;

    const designImagesQ = useQuery({
        queryKey: ["images", "design", imagesModalDesignId],
        enabled: imagesModalOpen && !!imagesModalDesignId,
        queryFn: () => adminFetch<ApiImage[]>(`/images/design/${imagesModalDesignId}`),
    });

    function sortImages(imgs: ApiImage[]) {
        return [...(imgs || [])].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
    }

    const ensureDesignImagePreviews = async (designId: number) => {
        if (!designId) return;
        if (prefetchedDesignIdsRef.current.has(designId)) return;
        prefetchedDesignIdsRef.current.add(designId);

        try {
            const imgs = await qc.fetchQuery({
                queryKey: ["images", "design", designId],
                queryFn: () => adminFetch<ApiImage[]>(`/images/design/${designId}`),
                staleTime: 30_000,
            });

            const sorted = sortImages(imgs || []);
            setDesignPreviewById((prev) => ({ ...prev, [designId]: sorted[0]?.url || null }));
            setDesignPreview2ById((prev) => ({ ...prev, [designId]: sorted[1]?.url || null }));
        } catch {
            // allow retry on next hover / next render
            prefetchedDesignIdsRef.current.delete(designId);
        }
    };

    useEffect(() => {
        if (!imagesModalDesignId) return;
        const sorted = sortImages(designImagesQ.data || []);
        setDesignPreviewById((prev) => ({ ...prev, [imagesModalDesignId]: sorted[0]?.url || null }));
        setDesignPreview2ById((prev) => ({ ...prev, [imagesModalDesignId]: sorted[1]?.url || null }));
    }, [imagesModalDesignId, designImagesQ.data]);

    // prefetch image lists for designs so hover swap is instant
    useEffect(() => {
        let cancelled = false;
        const ids = (designsQ.data || [])
            .map((d) => d.id)
            .filter((id) => Number.isInteger(id) && id > 0);
        if (ids.length === 0) return;

        const concurrency = 4;
        const queue = [...ids];

        (async () => {
            const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
                while (!cancelled && queue.length) {
                    const id = queue.shift()!;
                    await ensureDesignImagePreviews(id);
                }
            });
            await Promise.all(workers);
        })();

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [designsQ.data]);

    const uploadDesignImageM = useMutation({
        mutationFn: async ({ designId, file }: { designId: number; file: File }) => {
            const fd = new FormData();
            fd.append("file", file);
            return adminUpload<ApiImage>(`/images/design/${designId}`, fd, "POST");
        },
        onSuccess: (_row, vars) => {
            qc.invalidateQueries({ queryKey: ["images", "design", vars.designId] });
            qc.invalidateQueries({ queryKey: ["keycards", "designs"] });
            // refresh previews immediately
            prefetchedDesignIdsRef.current.delete(vars.designId);
            void ensureDesignImagePreviews(vars.designId);
        },
    });

    const deleteImageM = useMutation({
        mutationFn: (id: number) => adminFetch(`/images/${id}`, { method: "DELETE" }),
        onSuccess: () => {
            if (imagesModalDesignId) qc.invalidateQueries({ queryKey: ["images", "design", imagesModalDesignId] });
            qc.invalidateQueries({ queryKey: ["keycards", "designs"] });

            if (imagesModalDesignId) {
                prefetchedDesignIdsRef.current.delete(imagesModalDesignId);
                void ensureDesignImagePreviews(imagesModalDesignId);
            }
        },
    });

    // -------- UI state for modals/forms --------
    const [newTechName, setNewTechName] = useState("");
    const [newBrandName, setNewBrandName] = useState("");

    const [designModalOpen, setDesignModalOpen] = useState(false);
    const [editingDesignId, setEditingDesignId] = useState<number | null>(null);
    const [designForm, setDesignForm] = useState<{ brand_id: string; code: string; name: string; description: string }>({
        brand_id: "",
        code: "",
        name: "",
        description: "",
    });

    // ✅ NEW: allow selecting up to 2 images while ADDING a design
    const [designUploadFiles, setDesignUploadFiles] = useState<File[]>([]);

    const createDesignWithImagesM = useMutation({
        mutationFn: async ({
                               payload,
                               files,
                           }: {
            payload: { brand_id: number | null; code: string; name: string; description: string | null };
            files: File[];
        }) => {
            // 1) create design
            const design = await adminFetch<ApiDesign>(`/keycards/designs`, {
                method: "POST",
                body: JSON.stringify(payload),
            });

            // 2) upload up to 2 images (best effort; if one fails, throw but design still exists)
            const toUpload = (files || []).slice(0, 2);
// in createDesignWithImagesM loop (Keycards.tsx)
            for (let i = 0; i < toUpload.length; i++) {
                const fd = new FormData();
                fd.append("file", toUpload[i]);
                fd.append("sort_order", String(i)); // 0=Primary, 1=Hover
                await adminUpload(`/images/design/${design.id}`, fd);
            }

            return design;
        },
        onSuccess: async (design) => {
            // refresh lists + previews
            qc.invalidateQueries({ queryKey: ["keycards", "designs"] });
            qc.invalidateQueries({ queryKey: ["images", "design", design.id] });

            prefetchedDesignIdsRef.current.delete(design.id);
            await ensureDesignImagePreviews(design.id);

            // close modal + reset
            setDesignModalOpen(false);
            setEditingDesignId(null);
            setDesignForm({ brand_id: "", code: "", name: "", description: "" });
            setDesignUploadFiles([]);
        },
    });

    // -------- shared styles --------
    const cardClass = "bg-white border border-slate-200 rounded-xl shadow-sm";
    const inputClass =
        "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200";
    const btnBase =
        "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium border transition active:scale-[0.99]";
    const btnPrimary = `${btnBase} bg-slate-900 text-white border-slate-900 hover:bg-slate-800`;
    const btnGhost = `${btnBase} bg-white text-slate-900 border-slate-200 hover:bg-slate-50`;
    const btnDanger = `${btnBase} bg-white text-rose-700 border-rose-200 hover:bg-rose-50`;

    // -------- loading/error --------
    const anyLoading =
        lockTechQ.isLoading || brandsQ.isLoading || designsQ.isLoading || (selectedTechId ? tiersQ.isLoading : false);
    if (anyLoading) return <Loading />;

    const anyError = lockTechQ.error || brandsQ.error || designsQ.error || tiersQ.error;
    if (anyError) {
        const msg = (anyError as Error)?.message || "Failed to load.";
        return (
            <div className="p-6">
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800">{msg}</div>
            </div>
        );
    }

    // ---------------- TECH LIST ----------------
    const renderTechList = () => (
        <div className={cardClass}>
            <div className="p-5 border-b border-slate-200 flex items-center justify-between gap-4">
                <div>
                    <div className="text-lg font-semibold text-slate-900">Lock Technologies</div>
                    <div className="text-sm text-slate-600">
                        Each lock tech has breakpoint-based pricing tiers (no gaps/overlaps).
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <input
                        className={inputClass}
                        value={newTechName}
                        onChange={(e) => setNewTechName(e.target.value)}
                        placeholder="New tech name..."
                    />
                    <button
                        className={btnPrimary}
                        disabled={!newTechName.trim() || createTechM.isPending}
                        onClick={() => {
                            const name = newTechName.trim();
                            if (!name) return;
                            createTechM.mutate({ name });
                            setNewTechName("");
                        }}
                    >
                        <Plus className="w-4 h-4" /> Add
                    </button>
                </div>
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {techs.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setSelectedTechId(t.id)}
                        className="text-left bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-sm transition p-5"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <div className="text-base font-semibold text-slate-900">{t.name}</div>
                                <div className="text-sm text-slate-600 mt-1">
                                    {t.tiers_count ?? 0} tier{(t.tiers_count ?? 0) === 1 ? "" : "s"} active
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className={["w-2 h-2 rounded-full", t.active === 1 ? "bg-emerald-500" : "bg-slate-300"].join(" ")} />
                                <div className="text-xs text-slate-600">{t.active === 1 ? "Active" : "Inactive"}</div>
                            </div>
                        </div>
                        <div className="mt-4 text-xs text-slate-500">Click to manage tiers →</div>
                    </button>
                ))}
                {techs.length === 0 && <div className="text-sm text-slate-600">No lock tech yet.</div>}
            </div>
        </div>
    );

    // ---------------- TECH DETAIL + TIERS EDITOR ----------------
    const renderTechDetail = () => {
        if (!selectedTech) return null;

        const norm = normalizeDraftTiers(draftTiers);

        const setTierMin = (idx: number, nextMin: number) => {
            const updated = norm.map((t, i) => (i === idx ? { ...t, min_boxes: nextMin } : t));
            setDraftTiers(normalizeDraftTiers(updated));
        };

        const setTierPrice = (idx: number, cents: number) => {
            const updated = norm.map((t, i) => (i === idx ? { ...t, price_per_box_cents: cents } : t));
            setDraftTiers(normalizeDraftTiers(updated));
        };

        // Editing MAX means adjusting next tier MIN = max + 1
        const setTierMax = (idx: number, desiredMax: number) => {
            if (idx >= norm.length - 1) return; // last tier max is ∞
            const clampedMax = Math.max(norm[idx].min_boxes, Math.trunc(desiredMax));
            const updated = norm.map((t) => ({ ...t }));
            updated[idx + 1].min_boxes = clampedMax + 1;
            setDraftTiers(normalizeDraftTiers(updated));
        };

        const splitTier = (idx: number) => {
            const base = norm[idx];
            const next = norm[idx + 1];
            let splitMin: number;

            if (next && next.min_boxes - base.min_boxes > 1) {
                splitMin = base.min_boxes + Math.floor((next.min_boxes - base.min_boxes) / 2);
                if (splitMin <= base.min_boxes) splitMin = base.min_boxes + 1;
            } else {
                splitMin = base.min_boxes + 10; // last tier split
            }

            const inserted = [
                ...norm.slice(0, idx + 1),
                { min_boxes: splitMin, price_per_box_cents: base.price_per_box_cents, currency: base.currency },
                ...norm.slice(idx + 1),
            ];
            setDraftTiers(normalizeDraftTiers(inserted));
        };

        const deleteTier = (idx: number) => {
            const remaining = norm.filter((_, i) => i !== idx);
            setDraftTiers(normalizeDraftTiers(remaining));
        };

        const canSave = !saveTiersM.isPending && norm.length > 0;

        return (
            <div className="space-y-6">
                <button
                    className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
                    onClick={() => setSelectedTechId(null)}
                >
                    <ChevronLeft className="w-4 h-4" /> Back to Technologies
                </button>

                <div className={cardClass}>
                    <div className="p-5 border-b border-slate-200 flex items-center justify-between gap-4">
                        <div className="flex-1">
                            <div className="text-xs font-semibold text-slate-600 uppercase">Technology</div>
                            <input
                                className="mt-2 w-full text-2xl font-semibold text-slate-900 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-slate-400 focus:outline-none pb-1"
                                value={selectedTech.name}
                                onChange={(e) => updateTechM.mutate({ id: selectedTech.id, patch: { name: e.target.value } })}
                            />
                            <div className="text-sm text-slate-600 mt-2">Tiers are breakpoints: MAX is derived from next MIN.</div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <Toggle
                                    checked={selectedTech.active === 1}
                                    onChange={(next) => updateTechM.mutate({ id: selectedTech.id, patch: { active: next ? 1 : 0 } })}
                                />
                                <div className="text-sm text-slate-700">{selectedTech.active === 1 ? "Active" : "Inactive"}</div>
                            </div>

                            <button
                                className={btnPrimary}
                                disabled={!canSave}
                                onClick={() => {
                                    saveTiersM.mutate({
                                        lockTechId: selectedTech.id,
                                        tiers: normalizeDraftTiers(norm).map((t) => ({
                                            min_boxes: t.min_boxes,
                                            price_per_box_cents: t.price_per_box_cents,
                                            currency: t.currency || "usd",
                                        })),
                                    });
                                }}
                            >
                                <Save className="w-4 h-4" /> Save tiers
                            </button>

                            <button
                                className={btnDanger}
                                disabled={deleteTechM.isPending}
                                onClick={() => {
                                    if (!confirm(`Delete "${selectedTech.name}"? This also deletes its tiers.`)) return;
                                    deleteTechM.mutate(selectedTech.id);
                                }}
                            >
                                <Trash2 className="w-4 h-4" /> Delete
                            </button>
                        </div>
                    </div>

                    <div className="p-5">
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <div>
                                <div className="text-lg font-semibold text-slate-900">Pricing tiers</div>
                                <div className="text-sm text-slate-600">
                                    Edit <span className="font-medium">MIN + PRICE</span>. MAX is derived. If you edit MAX, we set next MIN =
                                    MAX+1.
                                </div>
                            </div>
                            <button className={btnGhost} onClick={() => splitTier(Math.max(0, norm.length - 1))}>
                                <SplitSquareHorizontal className="w-4 h-4" /> Split last tier
                            </button>
                        </div>

                        <div className="grid grid-cols-12 gap-3 text-xs font-semibold text-slate-500 uppercase px-2 mb-2">
                            <div className="col-span-3">Min boxes</div>
                            <div className="col-span-3">Max boxes (derived)</div>
                            <div className="col-span-4">Price / box (USD)</div>
                            <div className="col-span-2 text-right">Actions</div>
                        </div>

                        <div className="space-y-2">
                            {norm.map((t, idx) => {
                                const max = derivedMaxBoxes(norm, idx);
                                const maxDisplay = max === null ? "∞" : String(max);

                                return (
                                    <div
                                        key={idx}
                                        className="grid grid-cols-12 gap-3 items-center bg-slate-50/60 border border-slate-200 rounded-xl p-2"
                                    >
                                        {/* MIN */}
                                        <div className="col-span-3">
                                            <input
                                                className={inputClass + " text-center"}
                                                type="number"
                                                value={t.min_boxes}
                                                disabled={idx === 0}
                                                onChange={(e) => setTierMin(idx, Number(e.target.value))}
                                            />
                                            {idx === 0 && <div className="text-[11px] text-slate-500 mt-1 text-center">forced to 1</div>}
                                        </div>

                                        {/* MAX (edits next MIN) */}
                                        <div className="col-span-3">
                                            <input
                                                className={[
                                                    inputClass,
                                                    "text-center",
                                                    max === null ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "",
                                                ].join(" ")}
                                                type="number"
                                                value={maxDisplay}
                                                disabled={max === null}
                                                onChange={(e) => setTierMax(idx, Number(e.target.value))}
                                            />
                                            <div className="text-[11px] text-slate-500 mt-1 text-center">
                                                {max === null ? "and up" : "updates next MIN"}
                                            </div>
                                        </div>

                                        {/* PRICE */}
                                        <div className="col-span-4 relative">
                                            <span className="absolute left-3 top-2.5 text-slate-400 text-sm">$</span>
                                            <input
                                                className={inputClass + " pl-6 text-right font-medium"}
                                                value={moneyCentsToStr(t.price_per_box_cents)}
                                                onChange={(e) => setTierPrice(idx, moneyStrToCents(e.target.value))}
                                            />
                                            <div className="text-[11px] text-slate-500 mt-1 text-right">{t.price_per_box_cents} cents</div>
                                        </div>

                                        {/* ACTIONS */}
                                        <div className="col-span-2 flex justify-end gap-2">
                                            <button className={btnGhost} onClick={() => splitTier(idx)} title="Split this tier">
                                                <SplitSquareHorizontal className="w-4 h-4" />
                                            </button>
                                            <button
                                                className={btnDanger}
                                                disabled={norm.length === 1}
                                                onClick={() => deleteTier(idx)}
                                                title={norm.length === 1 ? "Need at least 1 tier" : "Delete tier"}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {saveTiersM.isError && <div className="mt-4 text-sm text-rose-700">{(saveTiersM.error as Error).message}</div>}
                    </div>
                </div>
            </div>
        );
    };

    // ---------------- BRANDS ----------------
    const renderBrands = () => (
        <div className={cardClass}>
            <div className="p-5 border-b border-slate-200 flex items-center justify-between gap-4">
                <div>
                    <div className="text-lg font-semibold text-slate-900">Keycard Brands</div>
                    <div className="text-sm text-slate-600">Used by designs.</div>
                </div>

                <div className="flex items-center gap-2">
                    <input
                        className={inputClass}
                        value={newBrandName}
                        onChange={(e) => setNewBrandName(e.target.value)}
                        placeholder="New brand name..."
                    />
                    <button
                        className={btnPrimary}
                        disabled={!newBrandName.trim() || createBrandM.isPending}
                        onClick={() => {
                            const name = newBrandName.trim();
                            if (!name) return;
                            createBrandM.mutate({ name });
                            setNewBrandName("");
                        }}
                    >
                        <Plus className="w-4 h-4" /> Add
                    </button>
                </div>
            </div>

            <div className="p-5 space-y-2">
                {brands.map((b) => (
                    <div key={b.id} className="flex items-center justify-between gap-4 border border-slate-200 rounded-xl p-3 bg-white">
                        <div className="flex-1">
                            <div className="font-medium text-slate-900">{b.name}</div>
                            <div className="text-xs text-slate-500">id: {b.id}</div>
                        </div>

                        <div className="flex items-center gap-3">
                            <Toggle checked={b.active === 1} onChange={(next) => updateBrandM.mutate({ id: b.id, patch: { active: next ? 1 : 0 } })} />
                            <button
                                className={btnDanger}
                                onClick={() => {
                                    if (!confirm(`Delete brand "${b.name}"? Designs will be detached (brand_id → NULL).`)) return;
                                    deleteBrandM.mutate(b.id);
                                }}
                            >
                                <Trash2 className="w-4 h-4" /> Delete
                            </button>
                        </div>
                    </div>
                ))}
                {brands.length === 0 && <div className="text-sm text-slate-600">No brands yet.</div>}
            </div>
        </div>
    );

    // ---------------- DESIGNS ----------------
    const openAddDesign = () => {
        setEditingDesignId(null);
        setDesignForm({ brand_id: "", code: "", name: "", description: "" });
        setDesignUploadFiles([]); // ✅ reset files
        setDesignModalOpen(true);
    };

    const openEditDesign = (d: ApiDesign) => {
        setEditingDesignId(d.id);
        setDesignForm({
            brand_id: d.brand_id ? String(d.brand_id) : "",
            code: d.code,
            name: d.name,
            description: d.description || "",
        });
        setDesignUploadFiles([]); // keep empty (edits still use Images modal)
        setDesignModalOpen(true);
    };

    const openImagesModal = (d: ApiDesign) => {
        setImagesModalDesign(d);
        setImagesModalOpen(true);
    };

    const closeImagesModal = () => {
        setImagesModalOpen(false);
        setImagesModalDesign(null);
    };

    const renderDesigns = () => (
        <div className={cardClass}>
            <div className="p-5 border-b border-slate-200 flex items-center justify-between gap-4">
                <div>
                    <div className="text-lg font-semibold text-slate-900">Designs</div>
                    <div className="text-sm text-slate-600">Upload up to 2 images per design. Hover shows the 2nd image.</div>
                </div>
                <button className={btnPrimary} onClick={openAddDesign}>
                    <Plus className="w-4 h-4" /> Add design
                </button>
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {designs.map((d) => {
                    const preview = (designPreviewById[d.id] ?? d.image_url) || null;
                    const hoverPreview = (designPreview2ById[d.id] ?? null);

                    return (
                        <div key={d.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                            <div
                                className="aspect-[16/9] bg-slate-50 relative group flex items-center justify-center p-2"
                                onMouseEnter={() => void ensureDesignImagePreviews(d.id)}
                            >
                                {preview ? (
                                    <>
                                        <img
                                            src={adminAssetUrl(preview)}                                            alt={d.name}
                                            className={[
                                                "absolute inset-0 w-full h-full object-contain transition-opacity duration-200",
                                                hoverPreview ? "opacity-100 group-hover:opacity-0" : "opacity-100",
                                            ].join(" ")}
                                            loading="lazy"
                                        />
                                        {hoverPreview && (
                                            <img
                                                src={adminAssetUrl(hoverPreview)}                                                 alt={`${d.name} (alt)`}
                                                className="absolute inset-0 w-full h-full object-contain opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                                                loading="lazy"
                                            />
                                        )}
                                    </>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                                        <ImageIcon className="w-6 h-6" />
                                    </div>
                                )}
                                <div className="absolute top-2 right-2 flex items-center gap-2 bg-white/80 backdrop-blur rounded-lg px-2 py-1 border border-white">
                                    <div className={["w-2 h-2 rounded-full", d.active === 1 ? "bg-emerald-500" : "bg-slate-300"].join(" ")} />
                                    <div className="text-xs text-slate-700">{d.active === 1 ? "Active" : "Inactive"}</div>
                                </div>
                            </div>

                            <div className="p-4 space-y-2">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="font-semibold text-slate-900">{d.name}</div>
                                        <div className="text-xs text-slate-600 font-mono break-all">{d.code}</div>
                                        <div className="text-xs text-slate-500 mt-1">{d.brand_name || "—"}</div>
                                    </div>
                                </div>

                                <div className="text-sm text-slate-600 line-clamp-2 min-h-[40px]">{d.description || "No description"}</div>

                                <div className="flex items-center justify-between gap-2 pt-2">
                                    <div className="flex items-center gap-2">
                                        <Toggle checked={d.active === 1} onChange={(next) => updateDesignM.mutate({ id: d.id, patch: { active: next ? 1 : 0 } })} />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button className={btnGhost} onClick={() => openEditDesign(d)}>
                                            <Pencil className="w-4 h-4" /> Edit
                                        </button>
                                        <button className={btnGhost} onClick={() => openImagesModal(d)} title="Manage images (max 2)">
                                            <ImageIcon className="w-4 h-4" /> Images
                                        </button>
                                        <button
                                            className={btnDanger}
                                            onClick={() => {
                                                if (!confirm(`Delete design "${d.name}"? This also deletes its images.`)) return;
                                                deleteDesignM.mutate(d.id);
                                            }}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {designs.length === 0 && <div className="text-sm text-slate-600">No designs yet.</div>}
            </div>

            {/* Design Modal */}
            {designModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200">
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                            <div className="font-semibold text-slate-900">{editingDesignId ? "Edit Design" : "Add Design"}</div>
                            <button
                                onClick={() => {
                                    setDesignModalOpen(false);
                                    setDesignUploadFiles([]);
                                }}
                                className="text-slate-400 hover:text-slate-900 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Brand (optional)</label>
                                <select
                                    className={inputClass}
                                    value={designForm.brand_id}
                                    onChange={(e) => setDesignForm((s) => ({ ...s, brand_id: e.target.value }))}
                                >
                                    <option value="">No brand</option>
                                    {brands.map((b) => (
                                        <option key={b.id} value={String(b.id)}>
                                            {b.name} {b.active === 0 ? "(inactive)" : ""}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Code (unique)</label>
                                <input
                                    className={inputClass}
                                    value={designForm.code}
                                    onChange={(e) => setDesignForm((s) => ({ ...s, code: e.target.value }))}
                                    placeholder="KC-ONITY-001"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Name</label>
                                <input
                                    className={inputClass}
                                    value={designForm.name}
                                    onChange={(e) => setDesignForm((s) => ({ ...s, name: e.target.value }))}
                                    placeholder="Onity Classic Black"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
                                <textarea
                                    className={inputClass}
                                    rows={4}
                                    value={designForm.description}
                                    onChange={(e) => setDesignForm((s) => ({ ...s, description: e.target.value }))}
                                />
                            </div>

                            {/* ✅ Upload images while ADDING a design */}
                            {!editingDesignId && (
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="text-sm font-semibold text-slate-900">Images (optional)</div>
                                            <div className="text-xs text-slate-600">Pick up to 2. First = default preview, second = hover preview.</div>
                                        </div>
                                        <div className="text-xs text-slate-600">{designUploadFiles.length}/2</div>
                                    </div>

                                    <div className="mt-3 flex items-center gap-3">
                                        <input
                                            id="design-images-add"
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            className="hidden"
                                            onChange={(e) => {
                                                const incoming = Array.from(e.target.files || []);
                                                e.currentTarget.value = "";
                                                if (incoming.length === 0) return;
                                                setDesignUploadFiles((prev) => [...prev, ...incoming].slice(0, 2));
                                            }}
                                        />
                                        <label
                                            htmlFor="design-images-add"
                                            className={[
                                                btnPrimary,
                                                designUploadFiles.length >= 2 ? "opacity-50 pointer-events-none" : "",
                                            ].join(" ")}
                                            title={designUploadFiles.length >= 2 ? "Max 2 images reached" : "Select images"}
                                        >
                                            <Upload className="w-4 h-4" /> Select images
                                        </label>

                                        {designUploadFiles.length > 0 && (
                                            <button className={btnGhost} onClick={() => setDesignUploadFiles([])}>
                                                Clear
                                            </button>
                                        )}
                                    </div>

                                    {designUploadFiles.length > 0 && (
                                        <div className="mt-3 space-y-2">
                                            {designUploadFiles.map((f, idx) => (
                                                <div
                                                    key={`${f.name}-${idx}`}
                                                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
                                                >
                                                    <div className="min-w-0">
                                                        <div className="text-xs font-semibold text-slate-700">
                                                            {idx === 0 ? "Primary" : "Hover"}
                                                        </div>
                                                        <div className="text-sm text-slate-900 truncate">{f.name}</div>
                                                        <div className="text-xs text-slate-500">{Math.round(f.size / 1024)} KB</div>
                                                    </div>
                                                    <button
                                                        className="text-rose-700 hover:text-rose-900 text-sm"
                                                        onClick={() =>
                                                            setDesignUploadFiles((prev) => prev.filter((_, i) => i !== idx))
                                                        }
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="mt-3 text-[11px] text-slate-500">
                                        If your upload fails with “File too large”, lower the image size or bump Multer’s limit on backend.
                                    </div>
                                </div>
                            )}

                            {createDesignWithImagesM.isError && (
                                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-800 text-sm">
                                    {(createDesignWithImagesM.error as Error).message}
                                    <div className="text-xs text-rose-700 mt-1">
                                        Note: design may have been created even if an image upload failed. Use the Images button to finish.
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                            <button
                                className={btnGhost}
                                onClick={() => {
                                    setDesignModalOpen(false);
                                    setDesignUploadFiles([]);
                                }}
                            >
                                Cancel
                            </button>

                            <button
                                className={btnPrimary}
                                disabled={
                                    !designForm.code.trim() ||
                                    !designForm.name.trim() ||
                                    updateDesignM.isPending ||
                                    createDesignWithImagesM.isPending
                                }
                                onClick={() => {
                                    const payload = {
                                        brand_id: designForm.brand_id ? Number(designForm.brand_id) : null,
                                        code: designForm.code.trim(),
                                        name: designForm.name.trim(),
                                        description: designForm.description.trim() || null,
                                    };

                                    if (editingDesignId) {
                                        // edits stay lightweight; images managed via Images modal
                                        updateDesignM.mutate({ id: editingDesignId, patch: payload });
                                        setDesignModalOpen(false);
                                        setDesignUploadFiles([]);
                                    } else {
                                        // ✅ create + upload selected images in one go
                                        createDesignWithImagesM.mutate({ payload, files: designUploadFiles });
                                    }
                                }}
                            >
                                <Check className="w-4 h-4" />
                                {createDesignWithImagesM.isPending ? "Saving..." : "Save"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Images Modal */}
            {imagesModalOpen && imagesModalDesign && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden border border-slate-200">
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <div className="font-semibold text-slate-900">Images — {imagesModalDesign.name}</div>
                                <div className="text-xs text-slate-600">Max 2 images per design.</div>
                            </div>
                            <button onClick={closeImagesModal} className="text-slate-400 hover:text-slate-900 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5">
                            {designImagesQ.isLoading ? (
                                <div className="text-sm text-slate-600">Loading images...</div>
                            ) : designImagesQ.isError ? (
                                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800 text-sm">
                                    {(designImagesQ.error as Error).message}
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {(designImagesQ.data || []).map((img) => (
                                            <div key={img.id} className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                                                <div className="aspect-[16/9] bg-slate-50 flex items-center justify-center p-2">
                                                    <img
                                                        src={img.url}
                                                        alt={img.alt_text || imagesModalDesign.name}
                                                        className="w-full h-full object-contain"
                                                        loading="lazy"
                                                    />
                                                </div>
                                                <div className="p-3 flex items-center justify-between gap-3">
                                                    <div className="text-xs text-slate-500">
                                                        id: {img.id} • sort: {img.sort_order}
                                                    </div>
                                                    <button
                                                        className={btnDanger}
                                                        disabled={deleteImageM.isPending}
                                                        onClick={() => {
                                                            if (!confirm("Delete this image?")) return;
                                                            deleteImageM.mutate(img.id);
                                                        }}
                                                    >
                                                        <Trash2 className="w-4 h-4" /> Delete
                                                    </button>
                                                </div>
                                            </div>
                                        ))}

                                        {(designImagesQ.data || []).length === 0 && (
                                            <div className="sm:col-span-2 text-sm text-slate-600">No images yet.</div>
                                        )}
                                    </div>

                                    <div className="mt-5 flex items-center justify-between gap-3">
                                        <div className="text-xs text-slate-600">
                                            {(designImagesQ.data || []).length}/2 used
                                            {uploadDesignImageM.isError && (
                                                <span className="ml-2 text-rose-700">{(uploadDesignImageM.error as Error).message}</span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <input
                                                key={imagesModalDesignId || "x"}
                                                id={`design-upload-${imagesModalDesignId || "x"}`}
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    e.currentTarget.value = "";
                                                    if (!file || !imagesModalDesignId) return;
                                                    const currentCount = (designImagesQ.data || []).length;
                                                    if (currentCount >= 2) return;
                                                    uploadDesignImageM.mutate({ designId: imagesModalDesignId, file });
                                                }}
                                            />

                                            <label
                                                htmlFor={`design-upload-${imagesModalDesignId || "x"}`}
                                                className={[
                                                    btnPrimary,
                                                    uploadDesignImageM.isPending || (designImagesQ.data || []).length >= 2
                                                        ? "opacity-50 pointer-events-none"
                                                        : "",
                                                ].join(" ")}
                                                title={(designImagesQ.data || []).length >= 2 ? "Max 2 images reached" : "Upload image"}
                                            >
                                                <Upload className="w-4 h-4" /> Upload
                                            </label>

                                            <button className={btnGhost} onClick={closeImagesModal}>
                                                Close
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-semibold text-slate-900">Keycards</h1>
                <p className="text-sm text-slate-600 mt-1">
                    Breakpoint-based tiers per lock tech (max is derived, backend enforced).
                </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
                <button
                    className={[
                        "px-4 py-2 rounded-lg text-sm font-medium border transition",
                        tab === "techs"
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
                    ].join(" ")}
                    onClick={() => setTab("techs")}
                >
                    Technologies
                </button>
                <button
                    className={[
                        "px-4 py-2 rounded-lg text-sm font-medium border transition",
                        tab === "designs"
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
                    ].join(" ")}
                    onClick={() => setTab("designs")}
                >
                    Designs
                </button>
                <button
                    className={[
                        "px-4 py-2 rounded-lg text-sm font-medium border transition",
                        tab === "brands"
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
                    ].join(" ")}
                    onClick={() => setTab("brands")}
                >
                    Brands
                </button>
            </div>

            {/* Content */}
            {tab === "techs" && (selectedTechId ? renderTechDetail() : renderTechList())}
            {tab === "designs" && renderDesigns()}
            {tab === "brands" && renderBrands()}
        </div>
    );
}
