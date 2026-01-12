import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  Edit,
  Headphones,
  ShieldCheck,
  Cable,
  X,
  Hourglass,
  CheckCheck,
  XCircle,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Loading from "@/components/Loading.tsx";
import { AnimatePresence, motion } from "framer-motion";
import { adminFetch } from "@/src/lib/api.ts";

type StripeSyncStatus = "pending" | "synced" | "failed" | null;

type ApiProduct = {
  id: number;
  name: string;
  type: string;

  brand_id?: number | null;
  category_id?: number | null;

  brand_name?: string | null;
  category_name?: string | null;

  // 0 = inactive, 1 = active, 2 = archived
  active?: number | boolean | null;

  variants_count?: number | null;

  // Stripe sync tracking
  stripe_sync_status?: StripeSyncStatus;
  stripe_sync_error?: string | null;
};

type Brand = { id: number; name: string; active: number; created_at?: string };

type Category = {
  id: number;
  name: string;
  parent_id?: number | null;
  active: number;
  created_at?: string;
};

type CreateProductPayload = {
  name: string;
  type: string;
  brand_id: number;
  category_id: number;
  description: string;
};

type CreateBrandPayload = { name: string; active?: 0 | 1 };

type UpdateBrandPayload = {
  id: number;
  name?: string;
  active?: 0 | 1;
};

type CreateCategoryPayload = { name: string; parent_id?: number | null; active?: 0 | 1 };

type UpdateCategoryPayload = {
  id: number;
  name?: string;
  parent_id?: number | null;
  active?: 0 | 1;
};

function getStatus(active: ApiProduct["active"]): 0 | 1 | 2 {
  if (typeof active === "boolean") return active ? 1 : 0;
  if (typeof active === "number" && (active === 0 || active === 1 || active === 2)) return active;
  return 1;
}

function normalizeType(type?: string) {
  const t = (type ?? "").toLowerCase().trim();
  if (t === "service") return "Service";
  if (t === "keycard" || t === "keycards") return "Keycard";
  if (t === "regular" || t === "physical" || t === "product") return "Physical";
  return type || "Physical";
}

function typeToIcon(type?: string) {
  const t = normalizeType(type);
  if (t === "Service") return ShieldCheck;
  if (t === "Keycard") return Cable;
  if (t === "Physical") return Headphones;
  return Plus;
}

// If your DB CHECK is (type IN ('regular','keycard')), map UI to DB types here.
function uiTypeToDbType(uiType: string) {
  if (uiType === "Physical") return "regular";
  if (uiType === "Keycard") return "keycard";
  if (uiType === "Service") return "service";
  return uiType;
}

function StripeSyncBadge({
  status,
  error,
  onStopPropagation,
}: {
  status?: StripeSyncStatus;
  error?: string | null;
  onStopPropagation?: (e: React.MouseEvent) => void;
}) {
  if (!status) return null;

  if (status === "pending") {
    return (
      <span
        className="inline-flex items-center justify-center"
        title="Stripe sync pending"
        onClick={onStopPropagation}
      >
        <Hourglass className="w-4 h-4" style={{ color: "#d97706" }} />
      </span>
    );
  }

  if (status === "synced") {
    return (
      <span
        className="inline-flex items-center justify-center"
        title="Stripe synced"
        onClick={onStopPropagation}
      >
        <CheckCheck className="w-4 h-4" style={{ color: "#059669" }} />
      </span>
    );
  }

  // failed
  const msg = (error ?? "").trim() || "Stripe sync failed (no error provided).";
  return (
    <span className="relative inline-flex items-center justify-center group" onClick={onStopPropagation}>
      <XCircle className="w-4 h-4" style={{ color: "#dc2626" }} />
      <span className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-50">
        <span className="block max-w-[320px] whitespace-pre-wrap rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-lg">
          {msg}
        </span>
      </span>
    </span>
  );
}

const ProductList: React.FC = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Filters
  const [search, setSearch] = useState("");
  const [brandId, setBrandId] = useState("all");
  const [catId, setCatId] = useState("all");
  const [status, setStatus] = useState<"all" | "active" | "inactive" | "archived">("all");

  // Add Product Modal
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: "",
    type: "Physical",
    brand_id: "",
    category_id: "",
    description: "",
  });

  // Brand/Category Managers
  const [isBrandMgrOpen, setIsBrandMgrOpen] = useState(false);
  const [isCategoryMgrOpen, setIsCategoryMgrOpen] = useState(false);

  const [brandMgrTab, setBrandMgrTab] = useState<"active" | "archived" | "all">("active");
  const [brandMgrSearch, setBrandMgrSearch] = useState("");
  const [newBrandName, setNewBrandName] = useState("");
  const [editingBrandId, setEditingBrandId] = useState<number | null>(null);
  const [editingBrandName, setEditingBrandName] = useState("");

  const [categoryMgrTab, setCategoryMgrTab] = useState<"active" | "archived" | "all">("active");
  const [categoryMgrSearch, setCategoryMgrSearch] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryParentId, setNewCategoryParentId] = useState<string>("");
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [editingCategoryParentId, setEditingCategoryParentId] = useState<string>("");

  const closeBrandMgr = () => {
    setIsBrandMgrOpen(false);
    setBrandMgrSearch("");
    setNewBrandName("");
    setEditingBrandId(null);
    setEditingBrandName("");
  };

  const closeCategoryMgr = () => {
    setIsCategoryMgrOpen(false);
    setCategoryMgrSearch("");
    setNewCategoryName("");
    setNewCategoryParentId("");
    setEditingCategoryId(null);
    setEditingCategoryName("");
    setEditingCategoryParentId("");
  };

  // ✅ Load products on page load
  const productsQ = useQuery<ApiProduct[]>({
    queryKey: ["products"],
    queryFn: () => adminFetch<ApiProduct[]>("/products"),
    retry: false,
  });

  // Active-only lists for filters + create product
  const brandsQ = useQuery<Brand[]>({
    queryKey: ["brands"],
    queryFn: () => adminFetch<Brand[]>("/brands?active=1"),
    staleTime: 1000 * 60 * 10,
    retry: false,
  });

  const categoriesQ = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: () => adminFetch<Category[]>("/categories?active=1"),
    staleTime: 1000 * 60 * 10,
    retry: false,
  });

  // All (active + archived) lists for managers (lazy-load)
  const brandsAllQ = useQuery<Brand[]>({
    queryKey: ["brandsAll"],
    queryFn: () => adminFetch<Brand[]>("/brands"),
    enabled: isBrandMgrOpen,
    staleTime: 0,
    retry: false,
  });

  const categoriesAllQ = useQuery<Category[]>({
    queryKey: ["categoriesAll"],
    queryFn: () => adminFetch<Category[]>("/categories"),
    enabled: isCategoryMgrOpen,
    staleTime: 0,
    retry: false,
  });

  const products = productsQ.data ?? [];
  const brands = useMemo(
    () => (brandsQ.data ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)),
    [brandsQ.data]
  );
  const categories = useMemo(
    () => (categoriesQ.data ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)),
    [categoriesQ.data]
  );

  const brandById = useMemo(() => {
    const m = new Map<number, Brand>();
    for (const b of brandsAllQ.data ?? []) m.set(b.id, b);
    return m;
  }, [brandsAllQ.data]);

  const categoryById = useMemo(() => {
    const m = new Map<number, Category>();
    for (const c of categoriesAllQ.data ?? []) m.set(c.id, c);
    return m;
  }, [categoriesAllQ.data]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();

    return products.filter((p) => {
      const matchSearch = !s || (p.name ?? "").toLowerCase().includes(s);
      const matchBrand = brandId === "all" || (p.brand_id?.toString() ?? "") === brandId;
      const matchCat = catId === "all" || (p.category_id?.toString() ?? "") === catId;

      const st = getStatus(p.active);
      let matchStatus = true;
      if (status === "active") matchStatus = st === 1;
      if (status === "inactive") matchStatus = st === 0;
      if (status === "archived") matchStatus = st === 2;

      return matchSearch && matchBrand && matchCat && matchStatus;
    });
  }, [products, search, brandId, catId, status]);

  // ========= Debounced toggle (Map-based, TS-safe) =========
  const debounceTimersRef = useRef<Map<number, number>>(new Map());
  const pendingActiveRef = useRef<Map<number, 0 | 1>>(new Map());
  const abortControllersRef = useRef<Map<number, AbortController>>(new Map());

  useEffect(() => {
    return () => {
      for (const t of debounceTimersRef.current.values()) window.clearTimeout(t);
      for (const c of abortControllersRef.current.values()) c.abort();
    };
  }, []);

  const updateActive = useMutation({
    mutationFn: ({
      id,
      nextActive,
      signal,
    }: {
      id: number;
      nextActive: 0 | 1 | 2;
      signal?: AbortSignal;
    }) =>
      adminFetch<ApiProduct>(`/products/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: nextActive }),
        signal,
      }),
    onSuccess: (updated) => {
      qc.setQueryData<ApiProduct[]>(["products"], (old = []) =>
        old.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))
      );
    },
    onError: (err) => {
      if ((err as any)?.name === "AbortError") return;
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });

  const scheduleActivePatch = (id: number, next: 0 | 1) => {
    // Optimistic UI:
    qc.setQueryData<ApiProduct[]>(["products"], (old = []) =>
      old.map((p) =>
        p.id === id
          ? {
              ...p,
              active: next,
              stripe_sync_status: "pending",
              stripe_sync_error: null,
            }
          : p
      )
    );

    pendingActiveRef.current.set(id, next);

    const existingTimer = debounceTimersRef.current.get(id);
    if (existingTimer) window.clearTimeout(existingTimer);

    const timerId = window.setTimeout(() => {
      debounceTimersRef.current.delete(id);

      const finalValue = pendingActiveRef.current.get(id);
      pendingActiveRef.current.delete(id);
      if (finalValue === undefined) return;

      const prevController = abortControllersRef.current.get(id);
      if (prevController) prevController.abort();

      const controller = new AbortController();
      abortControllersRef.current.set(id, controller);

      updateActive.mutate({ id, nextActive: finalValue, signal: controller.signal });
    }, 450);

    debounceTimersRef.current.set(id, timerId);
  };

  // ✅ POST /api/admin/products on create
  const createProduct = useMutation({
    mutationFn: (payload: CreateProductPayload) =>
      adminFetch<ApiProduct>("/products", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      setIsAddProductOpen(false);
      setSubmitAttempted(false);
      setNewProduct({ name: "", type: "Physical", brand_id: "", category_id: "", description: "" });
      await qc.invalidateQueries({ queryKey: ["products"] });
    },
  });

  // Brand mutations
  const createBrand = useMutation({
    mutationFn: (payload: CreateBrandPayload) =>
      adminFetch<Brand>("/brands", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      setNewBrandName("");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["brands"] }),
        qc.invalidateQueries({ queryKey: ["brandsAll"] }),
        qc.invalidateQueries({ queryKey: ["products"] }),
      ]);
    },
  });

  const updateBrand = useMutation({
    mutationFn: (payload: UpdateBrandPayload) =>
      adminFetch<Brand>(`/brands/${payload.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: payload.name, active: payload.active }),
      }),
    onSuccess: async () => {
      setEditingBrandId(null);
      setEditingBrandName("");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["brands"] }),
        qc.invalidateQueries({ queryKey: ["brandsAll"] }),
        qc.invalidateQueries({ queryKey: ["products"] }),
      ]);
    },
  });

  // Category mutations
  const createCategory = useMutation({
    mutationFn: (payload: CreateCategoryPayload) =>
      adminFetch<Category>("/categories", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      setNewCategoryName("");
      setNewCategoryParentId("");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["categories"] }),
        qc.invalidateQueries({ queryKey: ["categoriesAll"] }),
        qc.invalidateQueries({ queryKey: ["products"] }),
      ]);
    },
  });

  const updateCategory = useMutation({
    mutationFn: (payload: UpdateCategoryPayload) =>
      adminFetch<Category>(`/categories/${payload.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: payload.name, parent_id: payload.parent_id, active: payload.active }),
      }),
    onSuccess: async () => {
      setEditingCategoryId(null);
      setEditingCategoryName("");
      setEditingCategoryParentId("");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["categories"] }),
        qc.invalidateQueries({ queryKey: ["categoriesAll"] }),
        qc.invalidateQueries({ queryKey: ["products"] }),
      ]);
    },
  });

  // ✅ required fields (don’t let them create if anything is missing)
  const required = useMemo(() => {
    const nameOk = newProduct.name.trim().length > 0;
    const typeOk = newProduct.type.trim().length > 0;
    const brandOk = newProduct.brand_id.trim().length > 0;
    const catOk = newProduct.category_id.trim().length > 0;
    const descOk = newProduct.description.trim().length > 0;

    return {
      nameOk,
      typeOk,
      brandOk,
      catOk,
      descOk,
      allOk: nameOk && typeOk && brandOk && catOk && descOk,
    };
  }, [newProduct]);

  const openAddProduct = () => {
    setIsAddProductOpen(true);
    setSubmitAttempted(false);
  };

  const closeAddProduct = () => {
    setIsAddProductOpen(false);
    setSubmitAttempted(false);
  };

  const handleCreate = () => {
    setSubmitAttempted(true);
    if (!required.allOk) return;

    const payload: CreateProductPayload = {
      name: newProduct.name.trim(),
      type: uiTypeToDbType(newProduct.type),
      brand_id: Number(newProduct.brand_id),
      category_id: Number(newProduct.category_id),
      description: newProduct.description.trim(),
    };

    createProduct.mutate(payload);
  };

  const brandMgrItems = useMemo(() => {
    const list = (brandsAllQ.data ?? []).slice().sort((a, b) => a.name.localeCompare(b.name));
    const s = brandMgrSearch.trim().toLowerCase();

    return list.filter((b) => {
      const matchSearch = !s || b.name.toLowerCase().includes(s);
      const matchTab =
        brandMgrTab === "all" ? true : brandMgrTab === "active" ? b.active === 1 : b.active === 0;
      return matchSearch && matchTab;
    });
  }, [brandsAllQ.data, brandMgrSearch, brandMgrTab]);

  const categoryMgrItems = useMemo(() => {
    const list = (categoriesAllQ.data ?? []).slice().sort((a, b) => a.name.localeCompare(b.name));
    const s = categoryMgrSearch.trim().toLowerCase();

    return list.filter((c) => {
      const matchSearch = !s || c.name.toLowerCase().includes(s);
      const matchTab =
        categoryMgrTab === "all" ? true : categoryMgrTab === "active" ? c.active === 1 : c.active === 0;
      return matchSearch && matchTab;
    });
  }, [categoriesAllQ.data, categoryMgrSearch, categoryMgrTab]);

  if (productsQ.isPending) return <Loading />;
  if (productsQ.error) return <div className="text-sm text-red-600">Error: {(productsQ.error as Error).message}</div>;

  return (
    <div className="flex flex-col h-full relative">
      {/* Brand Manager Modal */}
      <AnimatePresence>
        {isBrandMgrOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) closeBrandMgr();
            }}
          >
            <motion.div
              className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden border border-slate-200"
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 10 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900">Manage Brands</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Add, rename, or archive brands.</p>
                </div>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={closeBrandMgr}
                  className="text-slate-400 hover:text-slate-900"
                >
                  <X className="w-5 h-5" />
                </motion.button>
              </div>

              <div className="p-6 space-y-4">
                {brandsAllQ.isPending ? (
                  <div className="text-sm text-slate-500">Loading brands…</div>
                ) : brandsAllQ.error ? (
                  <div className="text-sm text-red-600">{(brandsAllQ.error as Error).message}</div>
                ) : (
                  <>
                    {/* Add */}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        value={newBrandName}
                        onChange={(e) => setNewBrandName(e.target.value)}
                        className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
                        placeholder="New brand name…"
                      />
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          const name = newBrandName.trim();
                          if (!name) return;
                          createBrand.mutate({ name });
                        }}
                        disabled={createBrand.isPending || !newBrandName.trim()}
                        className="px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm disabled:opacity-50"
                      >
                        {createBrand.isPending ? "Adding…" : "Add brand"}
                      </motion.button>
                    </div>

                    {(createBrand.error || updateBrand.error) && (
                      <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                        {(createBrand.error as Error)?.message || (updateBrand.error as Error)?.message}
                      </div>
                    )}

                    {/* Controls */}
                    <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
                        <input
                          value={brandMgrSearch}
                          onChange={(e) => setBrandMgrSearch(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-md py-2 pl-9 pr-3 text-sm focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                          placeholder="Search brands…"
                        />
                      </div>
                      <select
                        value={brandMgrTab}
                        onChange={(e) => setBrandMgrTab(e.target.value as any)}
                        className="bg-white border border-slate-200 text-slate-600 text-sm rounded-md py-2 pl-3 pr-8 focus:ring-1 focus:ring-slate-900 cursor-pointer hover:border-slate-300"
                      >
                        <option value="active">Active</option>
                        <option value="archived">Archived</option>
                        <option value="all">All</option>
                      </select>
                    </div>

                    {/* List */}
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <div className="max-h-[360px] overflow-auto">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-slate-50 sticky top-0 z-10">
                            <tr>
                              <th className="py-2 px-4 font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-xs">
                                Name
                              </th>
                              <th className="py-2 px-4 font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-xs">
                                Status
                              </th>
                              <th className="py-2 px-4 border-b border-slate-200"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {brandMgrItems.map((b) => {
                              const isEditing = editingBrandId === b.id;
                              const isArchived = b.active === 0;
                              return (
                                <tr key={b.id} className="hover:bg-slate-50">
                                  <td className="py-2 px-4">
                                    {isEditing ? (
                                      <input
                                        value={editingBrandName}
                                        onChange={(e) => setEditingBrandName(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                                      />
                                    ) : (
                                      <span className="font-medium text-slate-900">{b.name}</span>
                                    )}
                                  </td>
                                  <td className="py-2 px-4">
                                    <span
                                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                                        isArchived
                                          ? "bg-slate-100 text-slate-700 border-slate-200"
                                          : "bg-emerald-50 text-emerald-800 border-emerald-200"
                                      }`}
                                    >
                                      {isArchived ? "Archived" : "Active"}
                                    </span>
                                  </td>
                                  <td className="py-2 px-4 text-right whitespace-nowrap">
                                    {isEditing ? (
                                      <div className="inline-flex gap-2">
                                        <button
                                          className="px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                                          onClick={() => {
                                            const name = editingBrandName.trim();
                                            if (!name) return;
                                            updateBrand.mutate({ id: b.id, name });
                                          }}
                                          disabled={updateBrand.isPending || !editingBrandName.trim()}
                                        >
                                          Save
                                        </button>
                                        <button
                                          className="px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                                          onClick={() => {
                                            setEditingBrandId(null);
                                            setEditingBrandName("");
                                          }}
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="inline-flex gap-2">
                                        <button
                                          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                                          onClick={() => {
                                            setEditingBrandId(b.id);
                                            setEditingBrandName(b.name);
                                          }}
                                        >
                                          <Edit className="w-4 h-4" />
                                          Rename
                                        </button>
                                        <button
                                          className="px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                                          onClick={() => updateBrand.mutate({ id: b.id, active: isArchived ? 1 : 0 })}
                                          disabled={updateBrand.isPending}
                                        >
                                          {isArchived ? "Restore" : "Archive"}
                                        </button>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                            {brandMgrItems.length === 0 && (
                              <tr>
                                <td colSpan={3} className="py-6 text-center text-slate-500 text-sm">
                                  No brands.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Category Manager Modal */}
      <AnimatePresence>
        {isCategoryMgrOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) closeCategoryMgr();
            }}
          >
            <motion.div
              className="bg-white rounded-xl shadow-xl w-full max-w-3xl overflow-hidden border border-slate-200"
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 10 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900">Manage Categories</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Add, rename, set parent, or archive categories.</p>
                </div>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={closeCategoryMgr}
                  className="text-slate-400 hover:text-slate-900"
                >
                  <X className="w-5 h-5" />
                </motion.button>
              </div>

              <div className="p-6 space-y-4">
                {categoriesAllQ.isPending ? (
                  <div className="text-sm text-slate-500">Loading categories…</div>
                ) : categoriesAllQ.error ? (
                  <div className="text-sm text-red-600">{(categoriesAllQ.error as Error).message}</div>
                ) : (
                  <>
                    {/* Add */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        className="sm:col-span-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                        placeholder="New category name…"
                      />
                      <select
                        value={newCategoryParentId}
                        onChange={(e) => setNewCategoryParentId(e.target.value)}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm cursor-pointer"
                      >
                        <option value="">Parent: None</option>
                        {(categoriesAllQ.data ?? [])
                          .filter((c) => c.active === 1)
                          .slice()
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        const name = newCategoryName.trim();
                        if (!name) return;
                        const parent_id = newCategoryParentId ? Number(newCategoryParentId) : null;
                        createCategory.mutate({ name, parent_id });
                      }}
                      disabled={createCategory.isPending || !newCategoryName.trim()}
                      className="px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm disabled:opacity-50"
                    >
                      {createCategory.isPending ? "Adding…" : "Add category"}
                    </motion.button>

                    {(createCategory.error || updateCategory.error) && (
                      <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                        {(createCategory.error as Error)?.message || (updateCategory.error as Error)?.message}
                      </div>
                    )}

                    {/* Controls */}
                    <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
                        <input
                          value={categoryMgrSearch}
                          onChange={(e) => setCategoryMgrSearch(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-md py-2 pl-9 pr-3 text-sm focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                          placeholder="Search categories…"
                        />
                      </div>
                      <select
                        value={categoryMgrTab}
                        onChange={(e) => setCategoryMgrTab(e.target.value as any)}
                        className="bg-white border border-slate-200 text-slate-600 text-sm rounded-md py-2 pl-3 pr-8 focus:ring-1 focus:ring-slate-900 cursor-pointer hover:border-slate-300"
                      >
                        <option value="active">Active</option>
                        <option value="archived">Archived</option>
                        <option value="all">All</option>
                      </select>
                    </div>

                    {/* List */}
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <div className="max-h-[420px] overflow-auto">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-slate-50 sticky top-0 z-10">
                            <tr>
                              <th className="py-2 px-4 font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-xs">
                                Name
                              </th>
                              <th className="py-2 px-4 font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-xs">
                                Parent
                              </th>
                              <th className="py-2 px-4 font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-xs">
                                Status
                              </th>
                              <th className="py-2 px-4 border-b border-slate-200"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {categoryMgrItems.map((c) => {
                              const isEditing = editingCategoryId === c.id;
                              const isArchived = c.active === 0;
                              const parentName = c.parent_id ? categoryById.get(c.parent_id)?.name : "—";

                              return (
                                <tr key={c.id} className="hover:bg-slate-50">
                                  <td className="py-2 px-4">
                                    {isEditing ? (
                                      <input
                                        value={editingCategoryName}
                                        onChange={(e) => setEditingCategoryName(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                                      />
                                    ) : (
                                      <span className="font-medium text-slate-900">{c.name}</span>
                                    )}
                                  </td>
                                  <td className="py-2 px-4 text-slate-600">
                                    {isEditing ? (
                                      <select
                                        value={editingCategoryParentId}
                                        onChange={(e) => setEditingCategoryParentId(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm cursor-pointer"
                                      >
                                        <option value="">None</option>
                                        {(categoriesAllQ.data ?? [])
                                          .filter((x) => x.id !== c.id)
                                          .slice()
                                          .sort((a, b) => a.name.localeCompare(b.name))
                                          .map((x) => (
                                            <option key={x.id} value={x.id}>
                                              {x.name}
                                            </option>
                                          ))}
                                      </select>
                                    ) : (
                                      parentName || "—"
                                    )}
                                  </td>
                                  <td className="py-2 px-4">
                                    <span
                                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                                        isArchived
                                          ? "bg-slate-100 text-slate-700 border-slate-200"
                                          : "bg-emerald-50 text-emerald-800 border-emerald-200"
                                      }`}
                                    >
                                      {isArchived ? "Archived" : "Active"}
                                    </span>
                                  </td>
                                  <td className="py-2 px-4 text-right whitespace-nowrap">
                                    {isEditing ? (
                                      <div className="inline-flex gap-2">
                                        <button
                                          className="px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                                          onClick={() => {
                                            const name = editingCategoryName.trim();
                                            if (!name) return;
                                            const parent_id = editingCategoryParentId
                                              ? Number(editingCategoryParentId)
                                              : null;
                                            updateCategory.mutate({ id: c.id, name, parent_id });
                                          }}
                                          disabled={updateCategory.isPending || !editingCategoryName.trim()}
                                        >
                                          Save
                                        </button>
                                        <button
                                          className="px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                                          onClick={() => {
                                            setEditingCategoryId(null);
                                            setEditingCategoryName("");
                                            setEditingCategoryParentId("");
                                          }}
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="inline-flex gap-2">
                                        <button
                                          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                                          onClick={() => {
                                            setEditingCategoryId(c.id);
                                            setEditingCategoryName(c.name);
                                            setEditingCategoryParentId(c.parent_id ? String(c.parent_id) : "");
                                          }}
                                        >
                                          <Edit className="w-4 h-4" />
                                          Edit
                                        </button>
                                        <button
                                          className="px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                                          onClick={() => updateCategory.mutate({ id: c.id, active: isArchived ? 1 : 0 })}
                                          disabled={updateCategory.isPending}
                                        >
                                          {isArchived ? "Restore" : "Archive"}
                                        </button>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}

                            {categoryMgrItems.length === 0 && (
                              <tr>
                                <td colSpan={4} className="py-6 text-center text-slate-500 text-sm">
                                  No categories.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Product Modal */}
      <AnimatePresence>
        {isAddProductOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) closeAddProduct();
            }}
          >
            <motion.div
              className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200"
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 10 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">Add New Product</h3>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={closeAddProduct}
                  className="text-slate-400 hover:text-slate-900"
                >
                  <X className="w-5 h-5" />
                </motion.button>
              </div>

              <div className="p-6 space-y-4">
                {submitAttempted && !required.allOk && (
                  <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    Fill all fields before creating the product.
                  </div>
                )}

                {createProduct.error && (
                  <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                    Failed to create: {(createProduct.error as Error).message}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">
                    Product Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                    className={`w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm focus:outline-none focus:ring-1 ${
                      submitAttempted && !required.nameOk
                        ? "border-red-300 focus:ring-red-300"
                        : "border-slate-200 focus:border-slate-400 focus:ring-slate-400"
                    }`}
                    placeholder="e.g. Wireless Keyboard"
                  />
                  {submitAttempted && !required.nameOk && (
                    <p className="mt-1 text-xs text-red-600">Name is required.</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">
                      Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={newProduct.type}
                      onChange={(e) => setNewProduct({ ...newProduct, type: e.target.value })}
                      className={`w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm cursor-pointer ${
                        submitAttempted && !required.typeOk ? "border-red-300" : "border-slate-200"
                      }`}
                    >
                      <option value="Physical">Physical</option>
                      <option value="Service">Service</option>
                      <option value="Keycard">Keycard</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={newProduct.category_id}
                      onChange={(e) => setNewProduct({ ...newProduct, category_id: e.target.value })}
                      disabled={categoriesQ.isPending || !!categoriesQ.error}
                      className={`w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm cursor-pointer disabled:opacity-60 ${
                        submitAttempted && !required.catOk ? "border-red-300" : "border-slate-200"
                      }`}
                    >
                      <option value="">{categoriesQ.isPending ? "Loading..." : "Select Category"}</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    {submitAttempted && !required.catOk && (
                      <p className="mt-1 text-xs text-red-600">Category is required.</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">
                    Brand <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={newProduct.brand_id}
                    onChange={(e) => setNewProduct({ ...newProduct, brand_id: e.target.value })}
                    disabled={brandsQ.isPending || !!brandsQ.error}
                    className={`w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm cursor-pointer disabled:opacity-60 ${
                      submitAttempted && !required.brandOk ? "border-red-300" : "border-slate-200"
                    }`}
                  >
                    <option value="">{brandsQ.isPending ? "Loading..." : "Select Brand"}</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  {submitAttempted && !required.brandOk && (
                    <p className="mt-1 text-xs text-red-600">Brand is required.</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={newProduct.description}
                    onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                    className={`w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm resize-none focus:outline-none focus:ring-1 ${
                      submitAttempted && !required.descOk
                        ? "border-red-300 focus:ring-red-300"
                        : "border-slate-200 focus:border-slate-400 focus:ring-slate-400"
                    }`}
                    placeholder="Product description..."
                  />
                  {submitAttempted && !required.descOk && (
                    <p className="mt-1 text-xs text-red-600">Description is required.</p>
                  )}
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={closeAddProduct}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </motion.button>

                <motion.button
                  type="button"
                  whileTap={{ scale: required.allOk ? 0.97 : 1 }}
                  onClick={handleCreate}
                  disabled={!required.allOk || createProduct.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createProduct.isPending ? "Creating..." : "Create Product"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Products</h2>
          <p className="text-sm text-slate-500 mt-1">Manage your catalog, inventory, and variants.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 justify-end">
          <button
            type="button"
            onClick={() => setIsBrandMgrOpen(true)}
            className="px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            Manage Brands
          </button>
          <button
            type="button"
            onClick={() => setIsCategoryMgrOpen(true)}
            className="px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            Manage Categories
          </button>

          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={openAddProduct}
            className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add product
          </motion.button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm flex flex-col flex-1 overflow-hidden">
        {/* Filters */}
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row gap-3 items-center bg-slate-50/50">
          <div className="relative flex-1 w-full md:w-auto">
            <Search className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-md py-2 pl-9 pr-3 text-sm focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
              placeholder="Filter by name..."
            />
          </div>

          <div className="flex gap-2 w-full md:w-auto overflow-x-auto">
            <select
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              className="bg-white border border-slate-200 text-slate-600 text-sm rounded-md py-2 pl-3 pr-8 focus:ring-1 focus:ring-slate-900 cursor-pointer hover:border-slate-300"
              disabled={brandsQ.isPending}
            >
              <option value="all">{brandsQ.isPending ? "Loading..." : "All Brands"}</option>
              {(brandsQ.data ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

            <select
              value={catId}
              onChange={(e) => setCatId(e.target.value)}
              className="bg-white border border-slate-200 text-slate-600 text-sm rounded-md py-2 pl-3 pr-8 focus:ring-1 focus:ring-slate-900 cursor-pointer hover:border-slate-300"
              disabled={categoriesQ.isPending}
            >
              <option value="all">{categoriesQ.isPending ? "Loading..." : "All Categories"}</option>
              {(categoriesQ.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="bg-white border border-slate-200 text-slate-600 text-sm rounded-md py-2 pl-3 pr-8 focus:ring-1 focus:ring-slate-900 cursor-pointer hover:border-slate-300"
            >
              <option value="all">Status: All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-auto flex-1">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="py-3 px-6 font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-xs">
                  Name
                </th>
                <th className="py-3 px-6 font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-xs">
                  Type
                </th>
                <th className="py-3 px-6 font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-xs">
                  Brand
                </th>
                <th className="py-3 px-6 font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-xs">
                  Category
                </th>
                <th className="py-3 px-6 font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-xs text-center">
                  Status / Stripe
                </th>
                <th className="py-3 px-6 font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-xs text-right">
                  Variants
                </th>
                <th className="py-3 px-6 border-b border-slate-200"></th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filtered.map((product) => {
                const Icon = typeToIcon(product.type);
                const typeLabel = normalizeType(product.type);

                const st = getStatus(product.active);
                const archived = st === 2;
                const active = st === 1;

                return (
                  <tr
                    key={product.id}
                    className="hover:bg-slate-50 group transition-colors cursor-pointer"
                    onClick={() => navigate(`/products/${product.id}`)}
                  >
                    <td className="py-3 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-slate-400">
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="font-medium text-slate-900">{product.name}</span>
                      </div>
                    </td>

                    <td className="py-3 px-6">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                          typeLabel === "Service"
                            ? "bg-amber-50 text-amber-800 border-amber-200"
                            : typeLabel === "Keycard"
                            ? "bg-indigo-50 text-indigo-800 border-indigo-200"
                            : "bg-slate-100 text-slate-800 border-slate-200"
                        }`}
                      >
                        {typeLabel}
                      </span>
                    </td>

                    <td className="py-3 px-6 text-slate-600">{product.brand_name || "Unknown"}</td>

                    <td className="py-3 px-6">
                      <span className="px-2 py-1 rounded text-xs border bg-slate-50 text-slate-700 border-slate-200">
                        {product.category_name || "Uncategorized"}
                      </span>
                    </td>

                    {/* List toggle: ONLY active <-> inactive. Archived is disabled. */}
                    <td className="py-3 px-6 text-center">
                      <div className="inline-flex items-center justify-center gap-2">
                        {archived ? (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs border bg-slate-100 text-slate-700 border-slate-200">
                            Archived
                          </span>
                        ) : (
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.98 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              const next: 0 | 1 = active ? 0 : 1;
                              scheduleActivePatch(product.id, next);
                            }}
                            className="inline-flex items-center justify-center p-3 -m-3 rounded-md"
                            aria-label={active ? "Set inactive" : "Set active"}
                          >
                            <span
                              className={`w-9 h-5 rounded-full relative inline-flex items-center transition-colors ${
                                active ? "bg-emerald-500" : "bg-slate-200"
                              }`}
                            >
                              <span
                                className={`w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${
                                  active ? "translate-x-4" : "translate-x-0.5"
                                }`}
                              />
                            </span>
                          </motion.button>
                        )}

                        <StripeSyncBadge
                          status={product.stripe_sync_status}
                          error={product.stripe_sync_error}
                          onStopPropagation={(e) => e.stopPropagation()}
                        />
                      </div>
                    </td>

                    <td className="py-3 px-6 text-right font-mono text-slate-600">{product.variants_count ?? 0}</td>

                    <td className="py-3 px-6 text-right">
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.95 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/products/${product.id}`);
                        }}
                        className="text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Edit className="w-4 h-4" />
                      </motion.button>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 text-sm">
                    No products found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing {filtered.length} of {products.length} products
          </span>
          <div className="flex gap-2">
            <button className="px-2 py-1 border border-slate-200 rounded hover:bg-white bg-white" disabled>
              Prev
            </button>
            <button className="px-2 py-1 border border-slate-200 rounded hover:bg-white bg-white" disabled>
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductList;
