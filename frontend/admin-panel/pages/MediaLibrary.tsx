// admin-panel/views/MediaLibrary.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Loading from "@/components/Loading.tsx";
import { Upload, Filter, Cloud, Check, X, Link } from "lucide-react";
import { adminFetch, adminUpload, adminAssetUrl } from "@/src/lib/api";


type ApiImageRow = {
    id: number;
    entity_type: "product" | "design" | "variant";
    entity_id: number;
    url: string;
    alt_text: string | null;
    sort_order: number;
    created_at: string;

    // from /api/images (listAllImages)
    unused?: boolean;
    entity_name?: string | null;
    filename?: string | null;
    file_size_bytes?: number | null;
};

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? "http://localhost:5001/api";
const API_ORIGIN = String(API_BASE).replace(/\/api\/?$/, "");

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, {
        ...init,
        credentials: "include",
        headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Request failed: ${res.status}`);
    }

    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) return {} as T;
    return res.json();
}

async function fetchMultipart<T>(url: string, form: FormData): Promise<T> {
    const res = await fetch(url, {
        method: "POST",
        body: form,
        credentials: "include",
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Upload failed: ${res.status}`);
    }

    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) return {} as T;
    return res.json();
}

function resolveImgUrl(url: string) {
    if (!url) return url;
    if (/^https?:\/\//i.test(url)) return url;
    if (url.startsWith("/")) return `${API_ORIGIN}${url}`;
    return `${API_ORIGIN}/${url}`;
}

function formatBytes(bytes?: number | null) {
    if (!Number.isFinite(bytes as number) || (bytes as number) < 0) return "-";
    const b = bytes as number;
    const units = ["B", "KB", "MB", "GB", "TB"];
    let i = 0;
    let v = b;
    while (v >= 1024 && i < units.length - 1) {
        v /= 1024;
        i++;
    }
    return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

const MediaLibrary: React.FC = () => {
    const qc = useQueryClient();

    const [filter, setFilter] = useState<"all" | "products" | "designs" | "unused">("all");
    const [selectedId, setSelectedId] = useState<number | null>(null);

    // lightbox modal
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxId, setLightboxId] = useState<number | null>(null);

    // upload modal state
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [uploadType, setUploadType] = useState<"file" | "url">("file");
    const [entityType, setEntityType] = useState<"product" | "design">("product");
    const [entityIdText, setEntityIdText] = useState("");
    const [altText, setAltText] = useState("");
    const [sortOrderText, setSortOrderText] = useState("0");
    const [urlText, setUrlText] = useState("");
    const [uploadFile, setUploadFile] = useState<File | null>(null);

    // replace input
    const replaceInputRef = useRef<HTMLInputElement | null>(null);

    // image dimensions (client-side)
    const [dimsById, setDimsById] = useState<Record<number, { w: number; h: number }>>({});

    const imagesQ = useQuery({
        queryKey: ["images", "library"],
        queryFn: () => adminFetch<ApiImageRow[]>(`/images`),
        staleTime: 5_000,
    });

    // default selection after load
    useEffect(() => {
        if (selectedId) return;
        const first = (imagesQ.data || [])[0];
        if (first?.id) setSelectedId(first.id);
    }, [imagesQ.data, selectedId]);

    const allItems = imagesQ.data || [];

    const unusedCount = useMemo(() => allItems.filter((i) => Boolean(i.unused)).length, [allItems]);

    const totalBytes = useMemo(() => {
        return allItems.reduce((sum, i) => sum + (Number(i.file_size_bytes) || 0), 0);
    }, [allItems]);

    const filteredMedia = useMemo(() => {
        switch (filter) {
            case "products":
                return allItems.filter((i) => i.entity_type === "product");
            case "designs":
                return allItems.filter((i) => i.entity_type === "design");
            case "unused":
                return allItems.filter((i) => Boolean(i.unused));
            default:
                return allItems;
        }
    }, [allItems, filter]);

    const selectedItem = allItems.find((i) => i.id === selectedId) || null;
    const lightboxItem = allItems.find((i) => i.id === lightboxId) || null;

    // close lightbox on ESC
    useEffect(() => {
        if (!lightboxOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setLightboxOpen(false);
                setLightboxId(null);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [lightboxOpen]);

    const uploadFileM = useMutation({
        mutationFn: async (payload: {
            entity_type: "product" | "design";
            entity_id: number;
            file: File;
            alt_text?: string;
            sort_order?: number;
        }) => {
            const { entity_type, entity_id, file, alt_text, sort_order } = payload;
            const fd = new FormData();
            fd.append("file", file);
            if (alt_text && alt_text.trim()) fd.append("alt_text", alt_text.trim());
            if (Number.isFinite(sort_order)) fd.append("sort_order", String(sort_order));

            const endpoint =
                entity_type === "product"
                    ? `/images/product/${entity_id}`
                    : `/images/design/${entity_id}`;

            return adminUpload<ApiImageRow>(endpoint, fd, "POST");
        },
        onSuccess: (row) => {
            qc.invalidateQueries({ queryKey: ["images", "library"] });
            setIsUploadOpen(false);
            setUploadFile(null);
            setUrlText("");
            setAltText("");
            setSortOrderText("0");
            setEntityIdText("");
            setSelectedId(row?.id ?? null);
        },
    });

    const uploadUrlM = useMutation({
        mutationFn: async (payload: {
            entity_type: "product" | "design";
            entity_id: number;
            url: string;
            alt_text?: string;
            sort_order?: number;
        }) => {
            return adminFetch<ApiImageRow>(`/images/url`, {
                method: "POST",
                body: JSON.stringify(payload),
            });
        },

        onSuccess: (row) => {
            qc.invalidateQueries({ queryKey: ["images", "library"] });
            setIsUploadOpen(false);
            setUploadFile(null);
            setUrlText("");
            setAltText("");
            setSortOrderText("0");
            setEntityIdText("");
            setSelectedId(row?.id ?? null);
        },
    });

    const deleteImageM = useMutation({
        mutationFn: async (id: number) => {
            return adminFetch(`/images/${id}`, { method: "DELETE" });
        },
        onSuccess: (_data, deletedId) => {
            qc.invalidateQueries({ queryKey: ["images", "library"] });

            if (selectedId === deletedId) {
                const remaining = allItems.filter((x) => x.id !== deletedId);
                setSelectedId(remaining[0]?.id ?? null);
            }

            if (lightboxId === deletedId) {
                setLightboxOpen(false);
                setLightboxId(null);
            }
        },
    });

    function parseEntityId(): number | null {
        const n = Number(entityIdText);
        if (!Number.isInteger(n) || n <= 0) return null;
        return n;
    }

    function parseSortOrder(): number | null {
        const n = Number(sortOrderText);
        if (!Number.isFinite(n) || n < 0) return null;
        return Math.trunc(n);
    }

    function onUploadClick() {
        const entity_id = parseEntityId();
        const sort_order = parseSortOrder();

        if (!entity_id) return;
        if (uploadType === "file") {
            if (!uploadFile) return;
            uploadFileM.mutate({
                entity_type: entityType,
                entity_id,
                file: uploadFile,
                alt_text: altText,
                sort_order: sort_order ?? undefined,
            });
        } else {
            const u = (urlText || "").trim();
            if (!u) return;
            uploadUrlM.mutate({
                entity_type: entityType,
                entity_id,
                url: u,
                alt_text: altText,
                sort_order: sort_order ?? undefined,
            });
        }
    }

    function openReplacePicker() {
        if (!selectedItem) return;
        replaceInputRef.current?.click();
    }

    function onReplacePicked(file: File | null) {
        if (!selectedItem || !file) return;
        if (selectedItem.entity_type !== "product" && selectedItem.entity_type !== "design") return;

        uploadFileM.mutate({
            entity_type: selectedItem.entity_type,
            entity_id: selectedItem.entity_id,
            file,
            alt_text: selectedItem.alt_text || undefined,
            sort_order: selectedItem.sort_order,
        });
    }

    function openLightbox(id: number) {
        setLightboxId(id);
        setLightboxOpen(true);
    }

    return (
        <div className="h-full flex flex-col relative">
            {/* hidden replace input */}
            <input
                ref={replaceInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    e.currentTarget.value = "";
                    onReplacePicked(file);
                }}
            />

            {/* Lightbox (double click) */}
            {lightboxOpen && lightboxItem && (
                <div
                    className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                    onMouseDown={(e) => {
                        // click outside to close
                        if (e.target === e.currentTarget) {
                            setLightboxOpen(false);
                            setLightboxId(null);
                        }
                    }}
                >
                    <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                            <div className="min-w-0">
                                <div className="text-sm font-semibold text-slate-900 truncate">
                                    {lightboxItem.entity_type} #{lightboxItem.entity_id} • sort {lightboxItem.sort_order}
                                </div>
                                <div className="text-xs text-slate-500 truncate">
                                    {lightboxItem.filename || lightboxItem.url}
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setLightboxOpen(false);
                                    setLightboxId(null);
                                }}
                                className="h-9 w-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 flex items-center justify-center"
                                aria-label="Close"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="bg-slate-950/5">
                            <div className="w-full flex items-center justify-center p-4">
                                <img
                                    src={adminAssetUrl(lightboxItem.url)}
                                    alt={lightboxItem.alt_text || lightboxItem.filename || ""}
                                    className="max-h-[78vh] w-auto max-w-full object-contain"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Upload Modal */}
            {isUploadOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="font-semibold text-slate-900">Upload Media</h3>
                            <button
                                onClick={() => setIsUploadOpen(false)}
                                className="text-slate-400 hover:text-slate-900 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">Entity Type</label>
                                    <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                                        {(["product", "design"] as const).map((t) => (
                                            <button
                                                key={t}
                                                onClick={() => setEntityType(t)}
                                                className={`flex-1 capitalize py-1 text-xs font-medium rounded-md transition-all ${
                                                    entityType === t
                                                        ? "bg-white text-slate-900 shadow-sm"
                                                        : "text-slate-500 hover:text-slate-900"
                                                }`}
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">Entity ID</label>
                                    <input
                                        value={entityIdText}
                                        onChange={(e) => setEntityIdText(e.target.value)}
                                        type="text"
                                        placeholder="e.g. 204"
                                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition-all placeholder:text-slate-300"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">Upload Method</label>
                                <div className="flex gap-4 border-b border-slate-100 mb-4">
                                    <button
                                        onClick={() => setUploadType("file")}
                                        className={`pb-2 text-xs font-medium border-b-2 transition-colors ${
                                            uploadType === "file"
                                                ? "border-slate-900 text-slate-900"
                                                : "border-transparent text-slate-400 hover:text-slate-600"
                                        }`}
                                    >
                                        File Upload
                                    </button>
                                    <button
                                        onClick={() => setUploadType("url")}
                                        className={`pb-2 text-xs font-medium border-b-2 transition-colors ${
                                            uploadType === "url"
                                                ? "border-slate-900 text-slate-900"
                                                : "border-transparent text-slate-400 hover:text-slate-600"
                                        }`}
                                    >
                                        External URL
                                    </button>
                                </div>

                                {uploadType === "file" ? (
                                    <label className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer group">
                                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 transition-transform">
                                            <Upload className="w-5 h-5 text-indigo-600" />
                                        </div>
                                        <p className="text-sm font-medium text-slate-900">
                                            {uploadFile ? uploadFile.name : "Click to browse"}
                                        </p>
                                        <p className="text-xs text-slate-500 mt-1">
                                            {uploadFile ? `${formatBytes(uploadFile.size)} • ${uploadFile.type || "image/*"}` : "Max depends on backend UPLOAD_MAX_MB"}
                                        </p>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => {
                                                const f = e.target.files?.[0] || null;
                                                e.currentTarget.value = "";
                                                setUploadFile(f);
                                            }}
                                        />
                                    </label>
                                ) : (
                                    <div>
                                        <div className="relative">
                                            <Link className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                            <input
                                                value={urlText}
                                                onChange={(e) => setUrlText(e.target.value)}
                                                type="text"
                                                placeholder="https://..."
                                                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition-all placeholder:text-slate-300"
                                            />
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-1.5 ml-1">Backend stores the URL as-is (no download).</p>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">Alt Text</label>
                                    <input
                                        value={altText}
                                        onChange={(e) => setAltText(e.target.value)}
                                        type="text"
                                        placeholder="Descriptive text..."
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition-all placeholder:text-slate-300"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">Sort Order</label>
                                    <input
                                        value={sortOrderText}
                                        onChange={(e) => setSortOrderText(e.target.value)}
                                        type="number"
                                        min={0}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition-all placeholder:text-slate-300"
                                    />
                                </div>
                            </div>

                            {(uploadFileM.isError || uploadUrlM.isError) && (
                                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-800 text-sm">
                                    {(uploadFileM.error as Error)?.message || (uploadUrlM.error as Error)?.message}
                                </div>
                            )}
                        </div>

                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                            <button
                                onClick={() => setIsUploadOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                disabled={
                                    uploadFileM.isPending ||
                                    uploadUrlM.isPending ||
                                    !parseEntityId() ||
                                    (uploadType === "file" ? !uploadFile : !urlText.trim())
                                }
                                onClick={onUploadClick}
                                className="px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:pointer-events-none"
                            >
                                Upload Asset
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Media Library</h1>
                    <p className="text-slate-500 mt-1 text-sm">Manage design & product images.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsUploadOpen(true)}
                        className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm transition-colors"
                    >
                        <Upload className="w-4 h-4" /> Upload
                    </button>
                    <button className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm transition-colors">
                        <Filter className="w-4 h-4" /> Filter
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 shrink-0">
                <div className="md:col-span-3 bg-white border border-slate-200 rounded-xl p-1 flex items-center shadow-sm">
                    {(["all", "designs", "products"] as const).map((t) => (
                        <button
                            key={t}
                            onClick={() => setFilter(t)}
                            className={`flex-1 capitalize py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                                filter === t ? "bg-slate-100 text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
                            }`}
                        >
                            {t === "all" ? "All Media" : t}
                        </button>
                    ))}
                    <button
                        onClick={() => setFilter("unused")}
                        className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors flex justify-center gap-2 ${
                            filter === "unused"
                                ? "bg-slate-100 text-slate-900 shadow-sm"
                                : "text-slate-500 hover:text-slate-900"
                        }`}
                    >
                        Unused{" "}
                        <span className="bg-red-100 text-red-600 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
              {unusedCount}
            </span>
                    </button>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
                    <div>
                        <p className="text-xs text-slate-500 font-medium uppercase">Total Storage</p>
                        <p className="text-lg font-bold text-slate-900">{formatBytes(totalBytes)}</p>
                    </div>
                    <div className="h-10 w-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                        <Cloud className="w-5 h-5" />
                    </div>
                </div>
            </div>

            <div className="flex gap-6 items-start h-full overflow-hidden">
                <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm p-6 overflow-y-auto h-full">
                    {imagesQ.isLoading ? (
                        <Loading />
                    ) : imagesQ.isError ? (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800 text-sm">
                            {(imagesQ.error as Error).message}
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {filteredMedia.map((item) => {
                                    const imgUrl = adminAssetUrl(item.url);
                                    const isSelected = selectedId === item.id;
                                    const label =
                                        item.entity_type === "design"
                                            ? "Design"
                                            : item.entity_type === "product"
                                                ? "Product"
                                                : item.entity_type;

                                    return (
                                        <div
                                            key={item.id}
                                            onClick={() => setSelectedId(item.id)}
                                            onDoubleClick={() => openLightbox(item.id)}
                                            title="Double-click to enlarge"
                                            className={`group relative aspect-square rounded-lg border overflow-hidden cursor-pointer flex items-center justify-center bg-slate-50 ${
                                                isSelected
                                                    ? "border-2 border-slate-900 ring-1 ring-slate-900/10"
                                                    : "border-slate-200 hover:border-slate-400"
                                            }`}
                                        >
                                            {isSelected && (
                                                <div className="absolute top-2 right-2 z-10">
                          <span className="h-6 w-6 bg-slate-900 text-white rounded-full flex items-center justify-center shadow-md">
                            <Check className="w-3 h-3" />
                          </span>
                                                </div>
                                            )}

                                            {/* CHANGE #1: FIT WHOLE IMAGE (no cropping) */}
                                            <div className="absolute inset-0 p-2 flex items-center justify-center">
                                                <img
                                                    src={imgUrl}
                                                    className="max-w-full max-h-full w-auto h-auto object-contain"
                                                    alt={item.alt_text || item.filename || ""}
                                                    draggable={false}
                                                />
                                            </div>

                                            <div className="absolute bottom-2 left-2 flex items-center gap-2">
                        <span className="bg-white/90 text-slate-800 text-[10px] font-bold px-1.5 py-0.5 rounded border border-slate-200">
                          {label} #{item.entity_id}
                        </span>
                                                <span className="bg-white/90 text-slate-600 text-[10px] font-semibold px-1.5 py-0.5 rounded border border-slate-200">
                          sort {item.sort_order}
                        </span>
                                            </div>

                                            {item.unused && (
                                                <div className="absolute top-2 left-2 bg-red-100 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded border border-red-200">
                                                    Unused
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {filteredMedia.length === 0 && (
                                <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                                    <p>No media found.</p>
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="w-80 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col h-full overflow-hidden shrink-0">
                    <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                        <h3 className="font-semibold text-slate-900">Asset Details</h3>
                    </div>

                    {selectedItem ? (
                        <div className="flex-1 p-4 space-y-6 flex flex-col">
                            <div
                                className="rounded-lg overflow-hidden border border-slate-200 bg-slate-100 aspect-video flex items-center justify-center cursor-zoom-in"
                                onDoubleClick={() => openLightbox(selectedItem.id)}
                                title="Double-click to enlarge"
                            >
                                <img
                                    src={adminAssetUrl(selectedItem.url)}
                                    className="h-full w-full object-contain"
                                    alt={selectedItem.alt_text || ""}
                                    onLoad={(e) => {
                                        const img = e.currentTarget;
                                        if (!img?.naturalWidth || !img?.naturalHeight) return;
                                        setDimsById((prev) => ({
                                            ...prev,
                                            [selectedItem.id]: { w: img.naturalWidth, h: img.naturalHeight },
                                        }));
                                    }}
                                />
                            </div>

                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-xs text-slate-500">Filename</span>
                                    <span className="text-xs font-medium text-slate-900 truncate ml-2">
                    {selectedItem.filename || "—"}
                  </span>
                                </div>

                                <div className="flex justify-between">
                                    <span className="text-xs text-slate-500">Size</span>
                                    <span className="text-xs font-medium text-slate-900">
                    {formatBytes(selectedItem.file_size_bytes ?? null)}
                  </span>
                                </div>

                                <div className="flex justify-between">
                                    <span className="text-xs text-slate-500">Dimensions</span>
                                    <span className="text-xs font-medium text-slate-900">
                    {dimsById[selectedItem.id]
                        ? `${dimsById[selectedItem.id].w} × ${dimsById[selectedItem.id].h}`
                        : "—"}
                  </span>
                                </div>

                                <div className="flex justify-between">
                                    <span className="text-xs text-slate-500">Entity</span>
                                    <span className="text-xs font-medium text-slate-900 capitalize">
                    {selectedItem.entity_type} #{selectedItem.entity_id}
                  </span>
                                </div>

                                <div className="flex justify-between">
                                    <span className="text-xs text-slate-500">Entity Name</span>
                                    <span className="text-xs font-medium text-slate-900 truncate ml-2">
                    {selectedItem.entity_name || "—"}
                  </span>
                                </div>

                                <div className="flex justify-between">
                                    <span className="text-xs text-slate-500">Sort Order</span>
                                    <span className="text-xs font-medium text-slate-900">{selectedItem.sort_order}</span>
                                </div>

                                <div className="flex justify-between">
                                    <span className="text-xs text-slate-500">Status</span>
                                    <span className={`text-xs font-medium ${selectedItem.unused ? "text-red-600" : "text-emerald-600"}`}>
                    {selectedItem.unused ? "Unused" : "In Use"}
                  </span>
                                </div>
                            </div>

                            {(uploadFileM.isError || deleteImageM.isError) && (
                                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-800 text-sm">
                                    {(uploadFileM.error as Error)?.message || (deleteImageM.error as Error)?.message}
                                </div>
                            )}

                            <div className="mt-auto p-4 border-t border-slate-200 bg-slate-50/50 flex flex-col gap-2 -mx-4 -mb-4">
                                <button
                                    onClick={openReplacePicker}
                                    disabled={uploadFileM.isPending}
                                    className="w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:pointer-events-none"
                                >
                                    Replace
                                </button>
                                <button
                                    onClick={() => {
                                        if (!confirm("Delete this image?")) return;
                                        deleteImageM.mutate(selectedItem.id);
                                    }}
                                    disabled={deleteImageM.isPending}
                                    className="w-full bg-red-50 hover:bg-red-100 text-red-600 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:pointer-events-none"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
                            Select an item to view details
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MediaLibrary;
