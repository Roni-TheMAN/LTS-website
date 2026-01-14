import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Edit2,
  Plus,
  Image as ImageIcon,
  X,
  Upload,
  Trash2,
  Save,
  Hourglass,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Loading from "@/components/Loading.tsx";
import { adminFetch, adminUpload, adminAssetUrl } from "@/src/lib/api";

type StripeSyncStatus = "synced" | "pending" | "failed";

type ApiProduct = {
  id: number;
  type: "regular" | "keycard";
  name: string;
  description: string | null;
  active: number; // 0/1/2
  brand_id: number | null;
  category_id: number | null;
  brand_name: string | null;
  category_name: string | null;
  stripe_product_id: string | null;

  stripe_sync_status?: StripeSyncStatus | null;
  stripe_sync_error?: string | null;

  created_at: string;
  updated_at: string;
  variants_count?: number | null;
};

type ApiVariant = {
  id: number;
  product_id: number;
  sku: string | null;
  name: string;
  description: string | null;
  active: number; // 0/1
  created_at: string;
  prices_count?: number | null;
  images_count?: number | null;
};

type ApiImage = {
  id: number;
  entity_type: "product" | "variant" | "design";
  entity_id: number;
  url: string;
  alt_text: string | null;
  sort_order: number;
  created_at: string;
};

type Brand = { id: number; name: string; active: number };
type Category = { id: number; name: string; active: number; parent_id?: number | null };

type ProductStatus = "active" | "inactive" | "archived";

function statusFromActive(active: number): ProductStatus {
  if (active === 1) return "active";
  if (active === 0) return "inactive";
  return "archived";
}

function activeFromStatus(status: ProductStatus): number {
  if (status === "active") return 1;
  if (status === "inactive") return 0;
  return 2;
}

type CreateVariantPayload = {
  name: string;
  sku: string;
  description?: string | null;
  starting_price: number; // dollars (backend can convert to cents)
};

function StripeSyncBadge({
                           stripe_product_id,
                           status,
                           error,
                         }: {
  stripe_product_id: string | null;
  status?: StripeSyncStatus | null;
  error?: string | null;
}) {
  if (!stripe_product_id) return null;

  const s = status ?? "synced";

  const base =
      "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium";
  const tooltipBase =
      "pointer-events-none absolute right-0 top-full mt-2 w-72 rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-700 shadow-xl opacity-0 translate-y-1 transition-all group-hover:opacity-100 group-hover:translate-y-0";

  if (s === "pending") {
    return (
        <div className="relative group">
        <span className={`${base} border-amber-200 bg-amber-50 text-amber-800`}>
          <Hourglass className="w-4 h-4 animate-pulse" />
          Syncing
        </span>
          <div className={tooltipBase}>Stripe sync is in progress.</div>
        </div>
    );
  }

  if (s === "failed") {
    return (
        <div className="relative group">
        <span className={`${base} border-red-200 bg-red-50 text-red-700`}>
          <AlertTriangle className="w-4 h-4" />
          Failed
        </span>
          <div className={tooltipBase}>
            <div className="font-semibold text-slate-900 mb-1">Stripe sync failed</div>
            <div className="text-slate-700">
              {error?.trim() ? error : "No error message provided."}
            </div>
          </div>
        </div>
    );
  }

  return (
      <div className="relative group">
      <span className={`${base} border-emerald-200 bg-emerald-50 text-emerald-800`}>
        <CheckCircle2 className="w-4 h-4" />
        Synced
      </span>
        <div className={tooltipBase}>Stripe is up to date.</div>
      </div>
  );
}

const ProductDetail: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const productId = Number(id);

  const [isAddVariantOpen, setIsAddVariantOpen] = useState(false);
  const [isAddMediaOpen, setIsAddMediaOpen] = useState(false);
  const [isManageMediaOpen, setIsManageMediaOpen] = useState(false);
  const [isEditingInfo, setIsEditingInfo] = useState(false);

  const [productStatus, setProductStatus] = useState<ProductStatus>("active");

  // Variants filter:
  const [variantsActiveFilter, setVariantsActiveFilter] = useState<"" | "1" | "0">("");

  const [form, setForm] = useState<{
    name: string;
    type: "regular" | "keycard";
    brand_id: number | null;
    category_id: number | null;
    description: string;
  }>({
    name: "",
    type: "regular",
    brand_id: null,
    category_id: null,
    description: "",
  });

  const [variantForm, setVariantForm] = useState<{
    name: string;
    sku: string;
    startingPrice: string;
    description: string;
  }>({
    name: "",
    sku: "",
    startingPrice: "",
    description: "",
  });

  // Media upload state (bulk)
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaAlt, setMediaAlt] = useState("");
  const [mediaPreviewUrls, setMediaPreviewUrls] = useState<string[]>([]);

  useEffect(() => {
    const urls = mediaFiles.map((f) => URL.createObjectURL(f));
    setMediaPreviewUrls(urls);
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [mediaFiles]);

  const resetVariantForm = () => {
    setVariantForm({ name: "", sku: "", startingPrice: "", description: "" });
  };

  const resetMediaForm = () => {
    setMediaFiles([]);
    setMediaAlt("");
    setIsAddMediaOpen(false);
  };

  const parseStartingPrice = (raw: string) => {
    const cleaned = raw.replace(/[^0-9.]/g, "");
    const num = Number.parseFloat(cleaned);
    return Number.isFinite(num) ? num : NaN;
  };

  // Product fetch
  const productQuery = useQuery({
    queryKey: ["product", productId],
    enabled: Number.isInteger(productId) && productId > 0,
    queryFn: () => adminFetch<ApiProduct>(`/products/${productId}`),
  });

  // Variants fetch
  const variantsQuery = useQuery({
    queryKey: ["variants", productId, variantsActiveFilter],
    enabled: Number.isInteger(productId) && productId > 0,
    queryFn: () => {
      const qs = variantsActiveFilter ? `?active=${variantsActiveFilter}` : "";
      return adminFetch<ApiVariant[]>(`/variants/product/${productId}${qs}`);
    },
  });

  // ✅ Images fetch
  const imagesQuery = useQuery({
    queryKey: ["images", "product", productId],
    enabled: Number.isInteger(productId) && productId > 0,
    queryFn: () => adminFetch<ApiImage[]>(`/images/product/${productId}`),
  });

  const images = imagesQuery.data ?? [];
  const topImages = images.slice(0, 3);

  // --- Image viewer (lightbox) ---
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const closeViewer = () => setViewerIndex(null);

  const openViewer = (idx: number) => {
    if (!Number.isFinite(idx)) return;
    if (idx < 0 || idx >= images.length) return;
    setViewerIndex(idx);
  };

  const goPrev = () => {
    setViewerIndex((cur) => {
      if (cur === null) return cur;
      const len = images.length || 1;
      return (cur - 1 + len) % len;
    });
  };

  const goNext = () => {
    setViewerIndex((cur) => {
      if (cur === null) return cur;
      const len = images.length || 1;
      return (cur + 1) % len;
    });
  };

  // Close viewer if images list changes and index becomes invalid
  useEffect(() => {
    if (viewerIndex === null) return;
    if (viewerIndex < 0 || viewerIndex >= images.length) setViewerIndex(null);
  }, [images.length, viewerIndex]);

  // Keyboard support (Esc / arrows)
  useEffect(() => {
    if (viewerIndex === null) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setViewerIndex(null);
        return;
      }
      if (e.key === "ArrowLeft") {
        setViewerIndex((cur) => {
          if (cur === null) return cur;
          const len = images.length || 1;
          return (cur - 1 + len) % len;
        });
      }
      if (e.key === "ArrowRight") {
        setViewerIndex((cur) => {
          if (cur === null) return cur;
          const len = images.length || 1;
          return (cur + 1) % len;
        });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [viewerIndex, images.length]);

  const brandsQuery = useQuery({
    queryKey: ["brands"],
    queryFn: () => adminFetch<Brand[]>(`/brands`),
    staleTime: 5 * 60 * 1000,
  });

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => adminFetch<Category[]>(`/categories`),
    staleTime: 5 * 60 * 1000,
  });

  const product = productQuery.data;

  // Hydrate form when product loads
  useEffect(() => {
    if (!product) return;

    setProductStatus(statusFromActive(Number(product.active)));

    setForm({
      name: product.name ?? "",
      type: product.type ?? "regular",
      brand_id: product.brand_id ?? null,
      category_id: product.category_id ?? null,
      description: product.description ?? "",
    });
  }, [product?.id]);

  const brandOptions = useMemo(() => {
    const list = brandsQuery.data?.filter((b) => b.active === 1) ?? [];
    if (list.length) return list;

    if (product?.brand_id) {
      return [
        {
          id: product.brand_id,
          name: product.brand_name || `Brand #${product.brand_id}`,
          active: 1,
        },
      ];
    }
    return [];
  }, [brandsQuery.data, product?.brand_id, product?.brand_name]);

  const categoryOptions = useMemo(() => {
    const list = categoriesQuery.data?.filter((c) => c.active === 1) ?? [];
    if (list.length) return list;

    if (product?.category_id) {
      return [
        {
          id: product.category_id,
          name: product.category_name || `Category #${product.category_id}`,
          active: 1,
        },
      ];
    }
    return [];
  }, [categoriesQuery.data, product?.category_id, product?.category_name]);

  // --- helpers for optimistic stripe status ---
  const snapshotProductsList = () => queryClient.getQueryData<ApiProduct[]>(["products"]) ?? null;

  const setStripePendingEverywhere = (patch?: Partial<ApiProduct>) => {
    queryClient.setQueryData<ApiProduct>(["product", productId], (old) => {
      if (!old) return old as any;
      return {
        ...old,
        ...patch,
        stripe_sync_status: old.stripe_product_id ? "pending" : old.stripe_sync_status,
        stripe_sync_error: old.stripe_product_id ? null : old.stripe_sync_error,
      };
    });

    queryClient.setQueryData<ApiProduct[]>(["products"], (old) => {
      if (!old) return old as any;
      return old.map((p) =>
          p.id === productId
              ? {
                ...p,
                ...patch,
                stripe_sync_status: p.stripe_product_id ? ("pending" as const) : p.stripe_sync_status,
                stripe_sync_error: p.stripe_product_id ? null : p.stripe_sync_error,
              }
              : p
      );
    });
  };

  // PATCH /api/products/:id (status)
  const updateStatusMutation = useMutation({
    mutationFn: (nextStatus: ProductStatus) =>
        adminFetch<ApiProduct>(`/products/${productId}`, {
          method: "PATCH",
          body: JSON.stringify({ active: activeFromStatus(nextStatus) }),
        }),
    onMutate: async (nextStatus) => {
      await queryClient.cancelQueries({ queryKey: ["product", productId] });
      const prevProduct = queryClient.getQueryData<ApiProduct>(["product", productId]) ?? null;
      const prevProducts = snapshotProductsList();

      setStripePendingEverywhere({ active: activeFromStatus(nextStatus) });

      return { prevProduct, prevProducts };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prevProduct) queryClient.setQueryData(["product", productId], ctx.prevProduct);
      if (ctx?.prevProducts) queryClient.setQueryData(["products"], ctx.prevProducts);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["product", productId] });
      await queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });

  // PATCH /api/products/:id (basic info)
  const updateInfoMutation = useMutation({
    mutationFn: (payload: Partial<ApiProduct>) =>
        adminFetch<ApiProduct>(`/products/${productId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        }),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ["product", productId] });
      const prevProduct = queryClient.getQueryData<ApiProduct>(["product", productId]) ?? null;
      const prevProducts = snapshotProductsList();

      setStripePendingEverywhere(payload);

      return { prevProduct, prevProducts };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prevProduct) queryClient.setQueryData(["product", productId], ctx.prevProduct);
      if (ctx?.prevProducts) queryClient.setQueryData(["products"], ctx.prevProducts);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["product", productId] });
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      setIsEditingInfo(false);
    },
  });

  // ✅ POST /api/variants/product/:productId  -> create variant
  const createVariantMutation = useMutation({
    mutationFn: (payload: CreateVariantPayload) =>
        adminFetch<ApiVariant>(`/variants/product/${productId}`, {
          method: "POST",
          body: JSON.stringify(payload),
        }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["variants", productId] });
      await queryClient.invalidateQueries({ queryKey: ["product", productId] });
      setIsAddVariantOpen(false);
      resetVariantForm();
    },
  });

  // PATCH /api/variants/:variantId  (variant id) -> toggle/update
  const updateVariantActiveMutation = useMutation({
    mutationFn: (vars: { variantId: number; nextActive: 0 | 1 }) =>
        adminFetch<ApiVariant>(`/variants/${vars.variantId}`, {
          method: "PATCH",
          body: JSON.stringify({ active: vars.nextActive }),
        }),
    onMutate: async ({ variantId, nextActive }) => {
      await queryClient.cancelQueries({ queryKey: ["variants", productId] });

      const previous = queryClient.getQueriesData<ApiVariant[]>({
        queryKey: ["variants", productId],
      });

      for (const [key, data] of previous) {
        if (!data) continue;

        const filter = (key as any[])[2] as "" | "1" | "0";

        const next = data
            .map((v) => (v.id === variantId ? { ...v, active: nextActive } : v))
            .filter((v) => {
              if (filter === "1") return Number(v.active) === 1;
              if (filter === "0") return Number(v.active) === 0;
              return true;
            });

        queryClient.setQueryData(key, next);
      }

      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx?.previous) return;
      for (const [key, data] of ctx.previous) {
        queryClient.setQueryData(key, data);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["variants", productId] });
    },
  });

  // ✅ Upload product images (bulk)
  const uploadProductImagesMutation = useMutation({
    mutationFn: async (vars: { files: File[]; alt_text?: string | null }) => {
      const fd = new FormData();
      for (const f of vars.files) fd.append("files", f);
      if (vars.alt_text && vars.alt_text.trim()) fd.append("alt_text", vars.alt_text.trim());
      return adminUpload<{ ok: boolean; created: number; images: ApiImage[] }>(
          `/images/product/${productId}/bulk`,
          fd,
          "POST"
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["images", "product", productId] });
      resetMediaForm();
    },
  });

  // ✅ Delete image
  const deleteImageMutation = useMutation({
    mutationFn: (imageId: number) =>
        adminFetch<{ ok: boolean; id: number }>(`/images/${imageId}`, { method: "DELETE" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["images", "product", productId] });
    },
  });

  const onToggleVariantActive = (e: React.MouseEvent, v: ApiVariant) => {
    e.stopPropagation();
    const nextActive = Number(v.active) === 1 ? 0 : 1;
    updateVariantActiveMutation.mutate({ variantId: v.id, nextActive });
  };

  const onClickSaveInfo = () => {
    updateInfoMutation.mutate({
      name: form.name,
      type: form.type,
      description: form.description,
      brand_id: form.brand_id,
      category_id: form.category_id,
    });
  };

  const onCreateVariant = () => {
    const name = variantForm.name.trim();
    const sku = variantForm.sku.trim();
    const starting_price = parseStartingPrice(variantForm.startingPrice);

    if (!name || !sku || !Number.isFinite(starting_price)) return;

    createVariantMutation.mutate({
      name,
      sku,
      description: variantForm.description.trim() ? variantForm.description.trim() : null,
      starting_price,
    });
  };

  const onUploadMedia = () => {
    if (!mediaFiles.length || uploadProductImagesMutation.isPending) return;
    uploadProductImagesMutation.mutate({ files: mediaFiles, alt_text: mediaAlt || null });
  };

  if (!Number.isInteger(productId) || productId <= 0) {
    return (
        <div className="max-w-6xl mx-auto p-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="text-slate-900 font-semibold">Invalid product id in URL.</div>
            <div className="text-sm text-slate-500 mt-1">Expected /products/:id</div>
          </div>
        </div>
    );
  }

  if (productQuery.isLoading) {
    return (
        <div className="max-w-6xl mx-auto p-6">
          <Loading />
        </div>
    );
  }

  if (productQuery.isError) {
    return (
        <div className="max-w-6xl mx-auto p-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="text-slate-900 font-semibold">Failed to load product.</div>
            <div className="text-sm text-slate-500 mt-1">
              {(productQuery.error as Error)?.message || "Unknown error"}
            </div>
            <button
                onClick={() => navigate("/products")}
                className="mt-4 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800"
            >
              Back to Catalog
            </button>
          </div>
        </div>
    );
  }

  if (!product) return null;

  const variants = variantsQuery.data ?? [];

  const startingPriceNum = parseStartingPrice(variantForm.startingPrice);
  const canCreateVariant =
      !!variantForm.name.trim() &&
      !!variantForm.sku.trim() &&
      Number.isFinite(startingPriceNum) &&
      !createVariantMutation.isPending;

  const canUploadMedia = mediaFiles.length > 0 && !uploadProductImagesMutation.isPending;

  return (
      <div className="max-w-6xl mx-auto pb-10 relative">
        {/* Add Media Modal */}
        {isAddMediaOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">Upload Media</h3>
                  <button
                      onClick={() => {
                        resetMediaForm();
                      }}
                      className="text-slate-400 hover:text-slate-900 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  {uploadProductImagesMutation.isError && (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {(uploadProductImagesMutation.error as Error)?.message || "Failed to upload"}
                      </div>
                  )}

                  <label className="block">
                    <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer">
                      <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mb-3">
                        <Upload className="w-5 h-5 text-indigo-600" />
                      </div>

                      <p className="text-sm font-medium text-slate-900">
                        {mediaFiles.length ? "Change images" : "Click to upload"}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        SVG, PNG, JPG, WEBP or GIF (max per-file size enforced by server)
                      </p>

                      <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            setMediaFiles(files);
                            e.currentTarget.value = "";
                          }}
                      />
                    </div>
                  </label>

                  {mediaPreviewUrls.length > 0 && (
                      <div className="rounded-xl border border-slate-200 overflow-hidden">
                        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                          <div className="text-sm font-medium text-slate-900">
                            Selected: {mediaFiles.length} file{mediaFiles.length === 1 ? "" : "s"}
                          </div>
                          <button
                              type="button"
                              onClick={() => setMediaFiles([])}
                              className="text-xs font-medium text-slate-600 hover:text-slate-900"
                          >
                            Clear
                          </button>
                        </div>

                        <div className="p-3 grid grid-cols-3 sm:grid-cols-4 gap-3">
                          {mediaPreviewUrls.map((u, idx) => (
                              <div
                                  key={`${u}-${idx}`}
                                  className="group relative aspect-square rounded-lg bg-white border border-slate-200 overflow-hidden"
                              >
                                <img src={u} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                                <button
                                    type="button"
                                    onClick={() => setMediaFiles((prev) => prev.filter((_, i) => i !== idx))}
                                    className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-white/90 hover:bg-white text-slate-700 rounded-full shadow"
                                    title="Remove"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                          ))}
                        </div>
                      </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">
                      Alt text (optional)
                    </label>
                    <input
                        value={mediaAlt}
                        onChange={(e) => setMediaAlt(e.target.value)}
                        placeholder="e.g. Front view of RFID lock"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition-all placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                  <button
                      onClick={() => resetMediaForm()}
                      className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                      disabled={uploadProductImagesMutation.isPending}
                  >
                    Cancel
                  </button>
                  <button
                      onClick={onUploadMedia}
                      disabled={!canUploadMedia}
                      className="px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {uploadProductImagesMutation.isPending ? "Uploading..." : "Upload"}
                  </button>
                </div>
              </div>
            </div>
        )}

        {/* Manage Media Modal */}
        {isManageMediaOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">Manage Media</h3>
                  <button
                      onClick={() => setIsManageMediaOpen(false)}
                      className="text-slate-400 hover:text-slate-900 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6">
                  {imagesQuery.isLoading ? (
                      <div className="py-8">
                        <Loading />
                      </div>
                  ) : imagesQuery.isError ? (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {(imagesQuery.error as Error)?.message || "Failed to load images"}
                      </div>
                  ) : (
                      <>
                        {deleteImageMutation.isError && (
                            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                              {(deleteImageMutation.error as Error)?.message || "Failed to delete image"}
                            </div>
                        )}

                        <div className="grid grid-cols-4 gap-4">
                          {images.map((img, idx) => {
                            const isDeleting =
                                deleteImageMutation.isPending && deleteImageMutation.variables === img.id;

                            return (
                                <div
                                    key={img.id}
                                    className="group relative aspect-square rounded-lg bg-slate-100 overflow-hidden border border-slate-200 cursor-zoom-in"
                                    onClick={() => openViewer(idx)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === " ") openViewer(idx);
                                    }}
                                    title={img.alt_text || "Click to enlarge"}
                                >
                                  <img
                                      src={adminAssetUrl(img.url)}
                                      className="w-full h-full object-contain"
                                      alt={img.alt_text || ""}
                                  />
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                    <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          deleteImageMutation.mutate(img.id);
                                        }}
                                        disabled={isDeleting}
                                        className="p-2 bg-white text-red-600 rounded-full shadow-sm hover:bg-red-50 transition-colors disabled:opacity-60"
                                        title="Delete"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                            );
                          })}

                          <button
                              type="button"
                              onClick={() => {
                                setIsManageMediaOpen(false);
                                setIsAddMediaOpen(true);
                              }}
                              className="aspect-square rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 hover:border-slate-400 hover:text-slate-500 transition-colors"
                          >
                            <ImageIcon className="w-5 h-5 mb-1" />
                            <span className="text-xs font-medium">Add</span>
                          </button>
                        </div>

                        {images.length === 0 && (
                            <div className="text-sm text-slate-500 mt-4">No images yet. Add one.</div>
                        )}
                      </>
                  )}
                </div>

                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                  <button
                      onClick={() => setIsManageMediaOpen(false)}
                      className="px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
        )}

        {/* Add Variant Modal */}
        {isAddVariantOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">Add New Variant</h3>
                  <button
                      onClick={() => {
                        setIsAddVariantOpen(false);
                        resetVariantForm();
                      }}
                      className="text-slate-400 hover:text-slate-900 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  {createVariantMutation.isError && (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {(createVariantMutation.error as Error)?.message || "Failed to create variant"}
                      </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">
                      Variant Name
                    </label>
                    <input
                        type="text"
                        placeholder="e.g. Midnight Blue / Large"
                        value={variantForm.name}
                        onChange={(e) => setVariantForm((f) => ({ ...f, name: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition-all placeholder:text-slate-400"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">
                        SKU
                      </label>
                      <input
                          type="text"
                          placeholder="PROD-VAR-001"
                          value={variantForm.sku}
                          onChange={(e) => setVariantForm((f) => ({ ...f, sku: e.target.value }))}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition-all placeholder:text-slate-400"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">
                        Starting Price
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-slate-400 text-sm">$</span>
                        <input
                            type="text"
                            inputMode="decimal"
                            placeholder="0.00"
                            value={variantForm.startingPrice}
                            onChange={(e) =>
                                setVariantForm((f) => ({ ...f, startingPrice: e.target.value }))
                            }
                            className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition-all placeholder:text-slate-400"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">
                      Description
                    </label>
                    <textarea
                        rows={3}
                        placeholder="Specific details for this variant..."
                        value={variantForm.description}
                        onChange={(e) => setVariantForm((f) => ({ ...f, description: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition-all resize-none placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                  <button
                      onClick={() => {
                        setIsAddVariantOpen(false);
                        resetVariantForm();
                      }}
                      disabled={createVariantMutation.isPending}
                      className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-60"
                  >
                    Cancel
                  </button>

                  <button
                      onClick={onCreateVariant}
                      disabled={!canCreateVariant}
                      className="px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {createVariantMutation.isPending ? "Creating..." : "Create Variant"}
                  </button>
                </div>
              </div>
            </div>
        )}

        {/* Image Viewer Overlay */}
        {viewerIndex !== null && images[viewerIndex] && (
            <div
                className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
                onClick={closeViewer}
                aria-modal="true"
                role="dialog"
            >
              <div className="relative w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
                <button
                    type="button"
                    onClick={closeViewer}
                    className="absolute -top-3 -right-3 sm:top-2 sm:right-2 z-10 p-2 rounded-full bg-white/95 hover:bg-white shadow"
                    title="Close"
                >
                  <X className="w-5 h-5" />
                </button>

                {images.length > 1 && (
                    <>
                      <button
                          type="button"
                          onClick={goPrev}
                          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white/95 hover:bg-white shadow"
                          title="Previous"
                      >
                        <ChevronLeft className="w-6 h-6" />
                      </button>

                      <button
                          type="button"
                          onClick={goNext}
                          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white/95 hover:bg-white shadow"
                          title="Next"
                      >
                        <ChevronRight className="w-6 h-6" />
                      </button>
                    </>
                )}

                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                    <div className="text-sm font-medium text-slate-900 truncate">
                      {images[viewerIndex].alt_text?.trim()
                          ? images[viewerIndex].alt_text
                          : `Image ${viewerIndex + 1} of ${images.length}`}
                    </div>
                    <div className="text-xs text-slate-500">
                      {viewerIndex + 1}/{images.length}
                    </div>
                  </div>

                  <div className="p-3 sm:p-4 bg-slate-50">
                    <img
                        src={adminAssetUrl(images[viewerIndex].url)}
                        alt={images[viewerIndex].alt_text || ""}
                        className="w-full max-h-[80vh] object-contain rounded-xl bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <span className="hover:text-slate-900 cursor-pointer" onClick={() => navigate("/products")}>
            Catalog
          </span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-900 font-medium">Product #{product.id}</span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <h1 className="text-3xl font-bold text-slate-900">{product.name}</h1>

            <StripeSyncBadge
                stripe_product_id={product.stripe_product_id}
                status={product.stripe_sync_status}
                error={product.stripe_sync_error}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm transition-all">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Basic Information</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    ID: <span className="font-medium text-slate-700">{product.id}</span> • Type:{" "}
                    <span className="font-medium text-slate-700">{product.type}</span> • Stripe_p_ID:{" "}
                    <span className="font-medium text-slate-700">
                    {product.stripe_product_id || "—"}
                  </span>
                  </p>
                </div>

                <button
                    onClick={() => setIsEditingInfo((v) => !v)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                  {isEditingInfo ? "Cancel" : "Edit"}
                </button>
              </div>

              {updateInfoMutation.isError && (
                  <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {(updateInfoMutation.error as Error)?.message || "Failed to update product"}
                  </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">
                    Name
                  </label>
                  <input
                      value={form.name}
                      disabled={!isEditingInfo}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      className={`w-full px-3 py-2 rounded-lg text-sm border transition-all placeholder:text-slate-400 ${
                          isEditingInfo
                              ? "bg-slate-50 border-slate-200 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                              : "bg-slate-100 border-slate-200 text-slate-700 cursor-not-allowed"
                      }`}
                      placeholder="Product name"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">
                      Brand
                    </label>
                    <select
                        disabled={!isEditingInfo}
                        value={form.brand_id ?? ""}
                        onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              brand_id: e.target.value ? Number(e.target.value) : null,
                            }))
                        }
                        className={`w-full px-3 py-2 rounded-lg text-sm border transition-all ${
                            isEditingInfo
                                ? "bg-slate-50 border-slate-200 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                                : "bg-slate-100 border-slate-200 text-slate-700 cursor-not-allowed"
                        }`}
                    >
                      <option value="">—</option>
                      {brandOptions.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">
                      Category
                    </label>
                    <select
                        disabled={!isEditingInfo}
                        value={form.category_id ?? ""}
                        onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              category_id: e.target.value ? Number(e.target.value) : null,
                            }))
                        }
                        className={`w-full px-3 py-2 rounded-lg text-sm border transition-all ${
                            isEditingInfo
                                ? "bg-slate-50 border-slate-200 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                                : "bg-slate-100 border-slate-200 text-slate-700 cursor-not-allowed"
                        }`}
                    >
                      <option value="">—</option>
                      {categoryOptions.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">
                    Description
                  </label>
                  <textarea
                      rows={4}
                      value={form.description}
                      disabled={!isEditingInfo}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      className={`w-full px-3 py-2 rounded-lg text-sm border transition-all resize-none placeholder:text-slate-400 ${
                          isEditingInfo
                              ? "bg-slate-50 border-slate-200 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                              : "bg-slate-100 border-slate-200 text-slate-700 cursor-not-allowed"
                      }`}
                      placeholder="Short description"
                  />
                </div>

                {isEditingInfo && (
                    <div className="flex justify-end">
                      <button
                          onClick={onClickSaveInfo}
                          disabled={updateInfoMutation.isPending}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-60"
                      >
                        <Save className="w-4 h-4" />
                        {updateInfoMutation.isPending ? "Saving..." : "Save"}
                      </button>
                    </div>
                )}
              </div>
            </div>

            {/* Variants */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Variants</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Manage SKUs, pricing tiers, and active status.
                  </p>
                </div>

                <button
                    onClick={() => setIsAddVariantOpen(true)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Variant
                </button>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-slate-500">Filter:</span>
                <select
                    value={variantsActiveFilter}
                    onChange={(e) => setVariantsActiveFilter(e.target.value as any)}
                    className="text-xs px-2 py-1 rounded-lg border border-slate-200 bg-slate-50"
                >
                  <option value="">All</option>
                  <option value="1">Active</option>
                  <option value="0">Inactive</option>
                </select>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                {variantsQuery.isLoading ? (
                    <div className="py-8">
                      <Loading />
                    </div>
                ) : variantsQuery.isError ? (
                    <div className="p-4 text-sm text-red-700 bg-red-50 border-t border-red-200">
                      {(variantsQuery.error as Error)?.message || "Failed to load variants"}
                    </div>
                ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                      <tr className="text-left text-xs text-slate-500 uppercase">
                        <th className="py-3 pl-4 font-medium">Variant</th>
                        <th className="py-3 font-medium">SKU</th>
                        <th className="py-3 font-medium">Pricing</th>
                        <th className="py-3 font-medium">Images</th>
                        <th className="py-3 pr-4 text-right font-medium">Active</th>
                      </tr>
                      </thead>
                      <tbody>
                      {variants.length === 0 ? (
                          <tr>
                            <td className="py-6 text-slate-500" colSpan={5}>
                              No variants found.
                            </td>
                          </tr>
                      ) : (
                          variants.map((v) => {
                            const isActive = Number(v.active) === 1;
                            const sku = v.sku?.trim() ? v.sku : "—";
                            const pricesCount = typeof v.prices_count === "number" ? v.prices_count : 0;

                            const isThisTogglePending =
                                updateVariantActiveMutation.isPending &&
                                updateVariantActiveMutation.variables?.variantId === v.id;

                            return (
                                <tr
                                    key={v.id}
                                    className="border-b border-dashed border-slate-200 last:border-0 hover:bg-slate-50 transition-colors cursor-pointer group"
                                    onClick={() => navigate(`variant/${v.id}`)}
                                >
                                  <td className="py-4 pl-4 flex items-center gap-3">
                                    <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-slate-500 font-semibold">
                                      {(v.name?.[0] || "V").toUpperCase()}
                                    </div>

                                    <div className="flex flex-col">
                                <span
                                    className={`font-medium ${
                                        isActive ? "text-slate-900" : "text-slate-500"
                                    }`}
                                >
                                  {v.name}
                                </span>
                                      {v.description ? (
                                          <span className="text-xs text-slate-500 line-clamp-1">
                                    {v.description}
                                  </span>
                                      ) : null}
                                    </div>
                                  </td>

                                  <td className="py-4 text-slate-500">{sku}</td>

                                  <td className="py-4 font-medium text-slate-900">
                                    {pricesCount > 0 ? `${pricesCount} tier(s)` : "—"}
                                  </td>

                                  <td className="py-4">
                              <span className="px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                —
                              </span>
                                  </td>

                                  <td className="py-4 text-right pr-4">
                                    <button
                                        type="button"
                                        onClick={(e) => onToggleVariantActive(e, v)}
                                        disabled={isThisTogglePending}
                                        className={`inline-flex items-center justify-center p-2 -m-2 rounded-md focus:outline-none ${
                                            isThisTogglePending ? "opacity-60 cursor-not-allowed" : ""
                                        }`}
                                        aria-label={`Set ${v.name} ${isActive ? "inactive" : "active"}`}
                                        aria-pressed={isActive}
                                    >
                                <span
                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                        isActive ? "bg-emerald-500" : "bg-slate-200"
                                    }`}
                                >
                                  <span
                                      className={`${
                                          isActive ? "translate-x-4" : "translate-x-0.5"
                                      } inline-block h-4 w-4 transform rounded-full bg-white transition shadow-sm`}
                                  />
                                </span>
                                    </button>
                                  </td>
                                </tr>
                            );
                          })
                      )}
                      </tbody>
                    </table>
                )}
              </div>
            </div>
          </div>

          {/* Right */}
          <div className="space-y-6">
            {/* Status */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900 mb-4">Status</h2>

              {updateStatusMutation.isError && (
                  <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {(updateStatusMutation.error as Error)?.message || "Failed to update status"}
                  </div>
              )}

              <div className="space-y-4">
                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                  {(["active", "inactive", "archived"] as const).map((status) => (
                      <button
                          key={status}
                          onClick={() => {
                            setProductStatus(status);
                            updateStatusMutation.mutate(status);
                          }}
                          disabled={updateStatusMutation.isPending}
                          className={`flex-1 capitalize py-1.5 text-xs font-medium rounded-md transition-all disabled:opacity-60 ${
                              productStatus === status
                                  ? "bg-white text-slate-900 shadow-sm"
                                  : "text-slate-500 hover:text-slate-900"
                          }`}
                      >
                        {status}
                      </button>
                  ))}
                </div>

                <div className="text-xs text-slate-500">
                  Updated: <span className="font-medium text-slate-700">{product.updated_at}</span>
                </div>
              </div>
            </div>

            {/* ✅ Media (API-backed) */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-slate-900">Media</h2>
                <button
                    onClick={() => setIsManageMediaOpen(true)}
                    className="text-xs text-indigo-600 hover:underline font-medium"
                >
                  Manage
                </button>
              </div>

              {imagesQuery.isLoading ? (
                  <div className="py-6">
                    <Loading />
                  </div>
              ) : imagesQuery.isError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {(imagesQuery.error as Error)?.message || "Failed to load images"}
                  </div>
              ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {topImages.map((img, idx) => (
                        <div
                            key={img.id}
                            className="aspect-square rounded-lg bg-slate-100 overflow-hidden relative group border border-slate-200 cursor-zoom-in"
                            title={img.alt_text || ""}
                            onClick={() => openViewer(idx)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") openViewer(idx);
                            }}
                        >
                          <img
                              src={adminAssetUrl(img.url)}
                              className="w-full h-full object-cover"
                              alt={img.alt_text || ""}
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                        </div>
                    ))}

                    <button
                        type="button"
                        onClick={() => setIsAddMediaOpen(true)}
                        className="aspect-square rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 hover:border-slate-400 hover:text-slate-500 transition-colors"
                    >
                      <ImageIcon className="w-5 h-5 mb-1" />
                      <span className="text-xs font-medium">Add</span>
                    </button>

                    {images.length === 0 && (
                        <div className="col-span-2 text-xs text-slate-500 mt-1">
                          No images yet. Upload the first one.
                        </div>
                    )}
                  </div>
              )}
            </div>
          </div>
        </div>
      </div>
  );
};

export default ProductDetail;
