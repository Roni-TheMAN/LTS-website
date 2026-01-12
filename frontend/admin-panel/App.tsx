// import React, {useEffect, useMemo, useRef, useState} from 'react';
// import {
//     Routes,
//     Route,
//     Navigate,
//     NavLink,
//     Outlet,
//     useLocation,
//     useNavigate
// } from 'react-router-dom';
// import {loadStripe} from '@stripe/stripe-js';
// import {
//     EmbeddedCheckoutProvider,
//     EmbeddedCheckout
// } from '@stripe/react-stripe-js';
//
//
// import {
//     LayoutDashboard,
//     ShoppingCart,
//     Package,
//     Key,
//     Image as ImageIcon,
//     CreditCard,
//     Settings,
//     Search,
//     Sun,
//     ShieldCheck,
//     ChevronRight,
//     ChevronLeft,
//     Menu
// } from 'lucide-react';
// import {useQuery} from '@tanstack/react-query';
//
// import Login from './views/Login';
// import OrdersList from './views/OrdersList';
// import OrderDetail from './views/OrderDetail';
// import ProductList from './views/ProductList';
// import ProductDetail from './views/ProductDetail';
// import VariantEditor from './views/VariantEditor';
// import Keycards from './views/Keycards';
// import MediaLibrary from './views/MediaLibrary';
// import StripeAudit from './views/StripeAudit';
// import SettingsView from './views/Settings';
//
// type GlobalSearchItem = {
//     type: string;
//     id: number;
//     title: string;
//     subtitle?: string;
//     href: string;
// };
//
// type GlobalSearchGroup = {
//     key: string;
//     label: string;
//     items: GlobalSearchItem[];
// };
//
// type GlobalSearchResponse = {
//     q: string;
//     groups: GlobalSearchGroup[];
// };
//
// async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
//     const res = await fetch(url, {signal, credentials: 'include'});
//     if (!res.ok) {
//         const text = await res.text();
//         throw new Error(text || `Request failed (${res.status})`);
//     }
//     return res.json();
// }
//
//
//
// const Layout: React.FC = () => {
//     const [isSidebarOpen, setIsSidebarOpen] = useState(true);
//     const navigate = useNavigate();
//     const location = useLocation();
//
//     // Global search
//     const [search, setSearch] = useState('');
//     const [debounced, setDebounced] = useState('');
//     const [openSearch, setOpenSearch] = useState(false);
//     const searchBoxRef = useRef<HTMLDivElement | null>(null);
//     const inputRef = useRef<HTMLInputElement | null>(null);
//
//     useEffect(() => {
//         const t = setTimeout(() => setDebounced(search.trim()), 200);
//         return () => clearTimeout(t);
//     }, [search]);
//
//     useEffect(() => {
//         function onMouseDown(e: MouseEvent) {
//             const node = searchBoxRef.current;
//             if (!node) return;
//             if (!node.contains(e.target as Node)) setOpenSearch(false);
//         }
//
//         document.addEventListener('mousedown', onMouseDown);
//         return () => document.removeEventListener('mousedown', onMouseDown);
//     }, []);
//
//     useEffect(() => {
//         function onKeyDown(e: KeyboardEvent) {
//             const isK = e.key.toLowerCase() === 'k';
//             const isMod = e.metaKey || e.ctrlKey;
//             if (isMod && isK) {
//                 e.preventDefault();
//                 setOpenSearch(true);
//                 inputRef.current?.focus();
//             }
//             if (e.key === 'Escape') {
//                 setOpenSearch(false);
//                 inputRef.current?.blur();
//             }
//         }
//
//         document.addEventListener('keydown', onKeyDown);
//         return () => document.removeEventListener('keydown', onKeyDown);
//     }, []);
//
//     const {data, isFetching} = useQuery({
//         queryKey: ['globalSearch', debounced],
//         queryFn: ({signal}) =>
//             fetchJson<GlobalSearchResponse>(`/api/search?q=${encodeURIComponent(debounced)}`, signal),
//         enabled: debounced.length >= 2,
//         staleTime: 30_000
//     });
//
//     const flatResults = useMemo(() => {
//         const items: GlobalSearchItem[] = [];
//         for (const g of data?.groups ?? []) items.push(...g.items);
//         return items;
//     }, [data]);
//
//     function goTo(item: GlobalSearchItem) {
//         setOpenSearch(false);
//         setSearch('');
//         navigate(item.href);
//     }
//
//     const NavItem = ({to, icon: Icon, label}: { to: string; icon: any; label: string }) => (
//         <NavLink
//             to={to}
//             className={({isActive}) =>
//                 `flex items-center w-full gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
//                     isActive
//                         ? 'bg-neutral-100 text-neutral-900'
//                         : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50'
//                 }`
//             }
//         >
//             {({isActive}) => (
//                 <>
//                     <Icon className="w-5 h-5"/>
//                     {label}
//                     {(to === '/dashboard' || to === '/orders' || to === '/products') && isActive && (
//                         <ChevronRight className="w-4 h-4 ml-auto opacity-20"/>
//                     )}
//                 </>
//             )}
//         </NavLink>
//     );
//
//     return (
//         <div className="flex h-screen bg-neutral-50/50">
//             {/* Sidebar */}
//             <aside
//                 className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-neutral-200 transform transition-transform duration-200 ease-in-out ${
//                     isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
//                 } lg:relative lg:translate-x-0`}
//             >
//                 <div className="flex flex-col h-full">
//                     <div className="h-16 flex items-center px-6 border-b border-neutral-100">
//                         <div className="flex items-center gap-2 font-semibold text-neutral-900">
//                             <div className="p-1 bg-neutral-100 rounded border border-neutral-200">
//                                 <ShieldCheck className="w-5 h-5"/>
//                             </div>
//                             <div className="flex flex-col">
//                                 <span className="leading-none">LTS Admin</span>
//                                 <span className="text-[10px] text-neutral-400 font-normal mt-1">
//                   Catalog • Orders • Pricing
//                 </span>
//                             </div>
//                         </div>
//                     </div>
//
//                     <div className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
//                         <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard"/>
//                         <NavItem to="/orders" icon={ShoppingCart} label="Orders"/>
//                         <NavItem to="/products" icon={Package} label="Products"/>
//                         <NavItem to="/keycards" icon={Key} label="Keycards"/>
//                         <NavItem to="/media" icon={ImageIcon} label="Media"/>
//                         <NavItem to="/stripe" icon={CreditCard} label="Stripe"/>
//                         <NavItem to="/settings" icon={Settings} label="Settings"/>
//                     </div>
//
//                     <div className="p-4 border-t border-neutral-100">
//                         <div
//                             className="flex items-center justify-between text-xs font-medium text-neutral-500 mb-4 px-2">
//                             <span>QUICK ACTIONS</span>
//                         </div>
//                         <div className="grid grid-cols-2 gap-2 mb-4">
//                             <button
//                                 onClick={() => navigate('/orders')}
//                                 className="flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-neutral-700 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-lg transition-colors"
//                             >
//                                 <ShoppingCart className="w-3.5 h-3.5"/> Orders
//                             </button>
//                             <button
//                                 onClick={() => navigate('/products')}
//                                 className="flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-neutral-700 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-lg transition-colors"
//                             >
//                                 <Package className="w-3.5 h-3.5"/> Catalog
//                             </button>
//                         </div>
//
//                         <div className="bg-neutral-50 rounded-lg p-3 border border-neutral-200">
//                             <h4 className="text-xs font-semibold text-neutral-900 mb-1">Schema-aware UI</h4>
//                             <p className="text-[10px] text-neutral-500 leading-relaxed">
//                                 Variants + tiered pricing, keycard lock tech tiers, orders snapshot fields, and Stripe
//                                 audit.
//                             </p>
//                         </div>
//                     </div>
//                 </div>
//             </aside>
//
//             {/* Main Content */}
//             <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
//                 <header
//                     className="h-16 flex items-center justify-between px-6 bg-white border-b border-neutral-200 shrink-0">
//                     <div className="flex items-center gap-4 flex-1">
//                         <button
//                             onClick={() => setIsSidebarOpen(!isSidebarOpen)}
//                             className="lg:hidden p-2 text-neutral-500 hover:bg-neutral-100 rounded-md"
//                         >
//                             <Menu className="w-5 h-5"/>
//                         </button>
//
//                         <button
//                             onClick={() => navigate(-1)}
//                             className={`p-2 rounded-md transition-colors ${
//                                 location.pathname !== '/' &&
//                                 location.pathname !== '/orders' &&
//                                 location.pathname !== '/dashboard'
//                                     ? 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900'
//                                     : 'text-neutral-300 cursor-not-allowed'
//                             }`}
//                             disabled={
//                                 location.pathname === '/' ||
//                                 location.pathname === '/orders' ||
//                                 location.pathname === '/dashboard'
//                             }
//                             title="Go Back"
//                         >
//                             <ChevronLeft className="w-5 h-5"/>
//                         </button>
//
//                         {/* Global Search */}
//                         <div ref={searchBoxRef} className="relative max-w-md w-full">
//                             <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400"/>
//                             <input
//                                 ref={inputRef}
//                                 value={search}
//                                 onChange={(e) => {
//                                     setSearch(e.target.value);
//                                     setOpenSearch(true);
//                                 }}
//                                 onFocus={() => setOpenSearch(true)}
//                                 onKeyDown={(e) => {
//                                     if (e.key === 'Escape') setOpenSearch(false);
//                                     if (e.key === 'Enter' && flatResults[0]) goTo(flatResults[0]);
//                                 }}
//                                 type="text"
//                                 placeholder="Search products, variants, Stripe ids..."
//                                 className="w-full pl-9 pr-4 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-400 transition-all placeholder:text-neutral-400"
//                             />
//
//                             {openSearch && debounced.length >= 2 && (
//                                 <div
//                                     className="absolute z-50 mt-2 w-full rounded-lg border border-neutral-200 bg-white shadow-lg overflow-hidden">
//                                     <div
//                                         className="px-3 py-2 text-xs text-neutral-500 border-b border-neutral-100 flex items-center justify-between">
//                     <span>
//                       {isFetching ? 'Searching…' : data?.groups?.length ? 'Results' : 'No results'}
//                     </span>
//                                         <span className="text-[10px] text-neutral-400">
//                       Ctrl/Cmd+K • Enter opens first • Esc closes
//                     </span>
//                                     </div>
//
//                                     <div className="max-h-96 overflow-auto">
//                                         {(data?.groups ?? []).map((g) => (
//                                             <div key={g.key} className="py-1">
//                                                 <div className="px-3 py-1.5 text-[11px] font-semibold text-neutral-500">
//                                                     {g.label}
//                                                 </div>
//
//                                                 {g.items.map((it) => (
//                                                     <button
//                                                         key={`${it.type}-${it.id}`}
//                                                         onMouseDown={(ev) => ev.preventDefault()}
//                                                         onClick={() => goTo(it)}
//                                                         className="w-full text-left px-3 py-2 hover:bg-neutral-50 transition-colors"
//                                                     >
//                                                         <div
//                                                             className="text-sm font-medium text-neutral-900">{it.title}</div>
//                                                         {it.subtitle && (
//                                                             <div
//                                                                 className="text-xs text-neutral-500 mt-0.5">{it.subtitle}</div>
//                                                         )}
//                                                     </button>
//                                                 ))}
//                                             </div>
//                                         ))}
//                                     </div>
//                                 </div>
//                             )}
//                         </div>
//                     </div>
//
//                     <div className="flex items-center gap-4">
//                         <div
//                             className="flex items-center gap-2 bg-neutral-100 rounded-full p-1 border border-neutral-200">
//                             <span className="text-xs font-medium px-2 text-neutral-600">Compact</span>
//                             <button
//                                 className="w-9 h-5 bg-neutral-300 rounded-full relative transition-colors focus:outline-none">
//                                 <div className="absolute left-1 top-1 bg-white w-3 h-3 rounded-full shadow-sm"></div>
//                             </button>
//                         </div>
//                         <button className="text-neutral-500 hover:text-neutral-900">
//                             <Sun className="w-5 h-5"/>
//                         </button>
//                         <button
//                             className="bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-sm transition-colors flex items-center gap-2">
//                             Create
//                         </button>
//                     </div>
//                 </header>
//
//                 <main className="flex-1 overflow-auto p-6">
//                     <Outlet/>
//                 </main>
//             </div>
//         </div>
//     );
// };
//
// const App: React.FC = () => {
//     const [isAuthenticated, setIsAuthenticated] = useState(false);
//     const navigate = useNavigate();
//
//     const handleLogin = () => {
//         setIsAuthenticated(true);
//         navigate('/');
//     };
//
//     return (
//         <Routes>
//             <Route path="/login" element={<Login onLogin={handleLogin}/>}/>
//             <Route path="/" element={isAuthenticated ? <Layout/> : <Navigate to="/login"/>}>
//                 <Route index element={<Navigate to="/orders" replace/>}/>
//                 <Route path="dashboard" element={<Navigate to="/orders" replace/>}/>
//                 <Route path="orders" element={<OrdersList/>}/>
//                 <Route path="orders/:id" element={<OrderDetail/>}/>
//                 <Route path="products" element={<ProductList/>}/>
//                 <Route path="products/:id" element={<ProductDetail/>}/>
//                 <Route path="products/:id/variant/new" element={<VariantEditor/>}/>
//                 <Route path="products/:id/variant/:variantId" element={<VariantEditor/>}/>
//                 <Route path="keycards" element={<Keycards/>}/>
//                 <Route path="media" element={<MediaLibrary/>}/>
//                 <Route path="stripe" element={<StripeAudit/>}/>
//                 <Route path="settings" element={<SettingsView/>}/>
//             </Route>
//         </Routes>
//     );
// };
//
// export default App;


import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    Routes,
    Route,
    Navigate,
    NavLink,
    Outlet,
    useLocation,
    useNavigate,
    useParams,
} from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";

import {
    LayoutDashboard,
    ShoppingCart,
    Package,
    Key,
    Image as ImageIcon,
    CreditCard,
    Settings,
    Search,
    Sun,
    ShieldCheck,
    ChevronRight,
    ChevronLeft,
    Menu,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import Login from "@/pages/Login";
import OrdersList from "@/pages/OrdersList";
import OrderDetail from "@/pages/OrderDetail";
import ProductList from "@/pages/ProductList";
import ProductDetail from "@/pages/ProductDetail";
import VariantEditor from "@/pages/VariantEditor";
import Keycards from "@/pages/Keycards";
import MediaLibrary from "@/pages/MediaLibrary";
import StripeAudit from "@/pages/StripeAudit";
import SettingsView from "@/pages/Settings";

type GlobalSearchItem = {
    type: string;
    id: number;
    title: string;
    subtitle?: string;
    href: string;
};

type GlobalSearchGroup = {
    key: string;
    label: string;
    items: GlobalSearchItem[];
};

type GlobalSearchResponse = {
    q: string;
    groups: GlobalSearchGroup[];
};

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
    const res = await fetch(url, { signal, credentials: "include" });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Request failed (${res.status})`);
    }
    return res.json();
}

// Stripe publishable key (admin app)
const stripePromise = (() => {
    const pk = (import.meta as any).env?.VITE_STRIPE_PUBLISHABLE_KEY;
    return pk ? loadStripe(pk) : null;
})();

type AdminCreateCheckoutSessionResponse = {
    clientSecret: string;
    sessionId: string;
    orderId: number;
    orderNumber: string | null;
    reused?: boolean;
};

const AdminStripeCheckoutPage: React.FC = () => {
    const navigate = useNavigate();
    const params = useParams();

    const rawId = (params as any)?.id;
    const orderId = useMemo(() => {
        const n = Number(rawId);
        return Number.isFinite(n) ? n : NaN;
    }, [rawId]);

    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function run() {
            if (!Number.isFinite(orderId) || orderId <= 0) {
                setErr("Invalid order id.");
                return;
            }
            if (!stripePromise) {
                setErr("Missing VITE_STRIPE_PUBLISHABLE_KEY in the admin app env.");
                return;
            }

            setLoading(true);
            setErr(null);
            setClientSecret(null);
            setSessionId(null);

            try {
                const res = await fetch("/api/admin/create-checkout-session", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ orderId }),
                });

                if (!res.ok) {
                    const text = await res.text();
                    throw new Error(text || `Request failed (${res.status})`);
                }

                const data = (await res.json()) as AdminCreateCheckoutSessionResponse;

                if (!cancelled) {
                    setClientSecret(data.clientSecret);
                    setSessionId(data.sessionId);
                }
            } catch (e: any) {
                if (!cancelled) setErr(e?.message || "Failed to create Stripe session.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        run();
        return () => {
            cancelled = true;
        };
    }, [orderId]);

    if (!Number.isFinite(orderId) || orderId <= 0) {
        return (
            <div className="max-w-3xl mx-auto">
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                    <div className="text-slate-900 font-semibold">Invalid order id</div>
                    <button
                        onClick={() => navigate("/orders")}
                        className="mt-4 inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-slate-900 hover:bg-slate-800 text-white"
                    >
                        Back to Orders
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <div className="text-sm text-slate-500">Order #{orderId}</div>
                    <h1 className="text-2xl font-bold text-slate-900">Collect payment</h1>
                </div>
                <button
                    onClick={() => navigate(`/orders/${orderId}`)}
                    className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-white border border-slate-200 hover:bg-slate-50 text-slate-800"
                >
                    Back to Order
                </button>
            </div>

            {loading ? (
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 text-slate-600">
                    Creating Stripe session…
                </div>
            ) : err ? (
                <div className="bg-white border border-rose-200 rounded-xl shadow-sm p-6">
                    <div className="text-rose-700 font-semibold">Stripe checkout failed</div>
                    <div className="text-slate-700 text-sm mt-2 whitespace-pre-wrap">{err}</div>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-4 inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-slate-900 hover:bg-slate-800 text-white"
                    >
                        Retry
                    </button>
                </div>
            ) : clientSecret && stripePromise ? (
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                    <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
                        <EmbeddedCheckout />
                    </EmbeddedCheckoutProvider>
                </div>
            ) : (
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 text-slate-600">
                    Waiting for Stripe…
                </div>
            )}

            {sessionId ? (
                <div className="mt-3 text-xs text-slate-500">
                    Session: <span className="font-mono">{sessionId}</span>
                </div>
            ) : null}
        </div>
    );
};

type SessionStatusResponse = {
    status: "open" | "complete" | string;
    payment_status: "paid" | "unpaid" | "no_payment_required" | string;
    order_id: string | null;
    order_number: string | null;
};

const AdminStripeReturnPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const sessionId = useMemo(() => {
        const sp = new URLSearchParams(location.search);
        return sp.get("session_id");
    }, [location.search]);

    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<SessionStatusResponse | null>(null);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function run() {
            if (!sessionId) {
                setErr("Missing session_id.");
                return;
            }

            setLoading(true);
            setErr(null);

            try {
                const res = await fetch(`/api/admin/session-status?session_id=${encodeURIComponent(sessionId)}`, {
                    credentials: "include",
                });
                if (!res.ok) {
                    const text = await res.text();
                    throw new Error(text || `Request failed (${res.status})`);
                }
                const json = (await res.json()) as SessionStatusResponse;

                if (cancelled) return;

                setData(json);

                const orderId = json.order_id ? Number(json.order_id) : NaN;

                // If complete, go straight back to the order detail page
                if (json.status === "complete" && Number.isFinite(orderId) && orderId > 0) {
                    navigate(`/orders/${orderId}`, { replace: true });
                    return;
                }

                // If open (user backed out), send them back to checkout for that order (if known)
                if (json.status === "open" && Number.isFinite(orderId) && orderId > 0) {
                    // keep them on this page with a button; do not auto-redirect
                    return;
                }
            } catch (e: any) {
                if (!cancelled) setErr(e?.message || "Failed to verify Stripe session.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        run();
        return () => {
            cancelled = true;
        };
    }, [sessionId, navigate]);

    const orderId = data?.order_id ? Number(data.order_id) : NaN;

    return (
        <div className="max-w-3xl mx-auto">
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                <h1 className="text-xl font-bold text-slate-900">Returning from Stripe…</h1>

                {loading ? (
                    <div className="mt-2 text-slate-600">Verifying payment…</div>
                ) : err ? (
                    <div className="mt-2">
                        <div className="text-rose-700 font-semibold">Verification failed</div>
                        <div className="text-slate-700 text-sm mt-1 whitespace-pre-wrap">{err}</div>
                        <button
                            onClick={() => navigate("/orders")}
                            className="mt-4 inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-slate-900 hover:bg-slate-800 text-white"
                        >
                            Back to Orders
                        </button>
                    </div>
                ) : data ? (
                    <div className="mt-3 space-y-2">
                        <div className="text-sm text-slate-700">
                            Session status: <span className="font-semibold">{data.status}</span>
                        </div>
                        <div className="text-sm text-slate-700">
                            Payment: <span className="font-semibold">{data.payment_status}</span>
                        </div>

                        {data.status === "open" && Number.isFinite(orderId) && orderId > 0 ? (
                            <div className="pt-3 flex gap-3">
                                <button
                                    onClick={() => navigate(`/orders/${orderId}/checkout`, { replace: true })}
                                    className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-slate-900 hover:bg-slate-800 text-white"
                                >
                                    Continue Checkout
                                </button>
                                <button
                                    onClick={() => navigate(`/orders/${orderId}`, { replace: true })}
                                    className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-white border border-slate-200 hover:bg-slate-50 text-slate-800"
                                >
                                    Back to Order
                                </button>
                            </div>
                        ) : (
                            <div className="pt-3">
                                <button
                                    onClick={() => navigate("/orders", { replace: true })}
                                    className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-white border border-slate-200 hover:bg-slate-50 text-slate-800"
                                >
                                    Back to Orders
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="mt-2 text-slate-600">No session data.</div>
                )}
            </div>
        </div>
    );
};

const Layout: React.FC = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const navigate = useNavigate();
    const location = useLocation();

    // Global search
    const [search, setSearch] = useState("");
    const [debounced, setDebounced] = useState("");
    const [openSearch, setOpenSearch] = useState(false);
    const searchBoxRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        const t = setTimeout(() => setDebounced(search.trim()), 200);
        return () => clearTimeout(t);
    }, [search]);

    useEffect(() => {
        function onMouseDown(e: MouseEvent) {
            const node = searchBoxRef.current;
            if (!node) return;
            if (!node.contains(e.target as Node)) setOpenSearch(false);
        }

        document.addEventListener("mousedown", onMouseDown);
        return () => document.removeEventListener("mousedown", onMouseDown);
    }, []);

    useEffect(() => {
        function onKeyDown(e: KeyboardEvent) {
            const isK = e.key.toLowerCase() === "k";
            const isMod = e.metaKey || e.ctrlKey;
            if (isMod && isK) {
                e.preventDefault();
                setOpenSearch(true);
                inputRef.current?.focus();
            }
            if (e.key === "Escape") {
                setOpenSearch(false);
                inputRef.current?.blur();
            }
        }

        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, []);

    const { data, isFetching } = useQuery({
        queryKey: ["globalSearch", debounced],
        queryFn: ({ signal }) =>
            fetchJson<GlobalSearchResponse>(`/api/search?q=${encodeURIComponent(debounced)}`, signal),
        enabled: debounced.length >= 2,
        staleTime: 30_000,
    });

    const flatResults = useMemo(() => {
        const items: GlobalSearchItem[] = [];
        for (const g of data?.groups ?? []) items.push(...g.items);
        return items;
    }, [data]);

    function goTo(item: GlobalSearchItem) {
        setOpenSearch(false);
        setSearch("");
        navigate(item.href);
    }

    const NavItem = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => (
        <NavLink
            to={to}
            className={({ isActive }) =>
                `flex items-center w-full gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    isActive
                        ? "bg-neutral-100 text-neutral-900"
                        : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50"
                }`
            }
        >
            {({ isActive }) => (
                <>
                    <Icon className="w-5 h-5" />
                    {label}
                    {(to === "/dashboard" || to === "/orders" || to === "/products") && isActive && (
                        <ChevronRight className="w-4 h-4 ml-auto opacity-20" />
                    )}
                </>
            )}
        </NavLink>
    );

    return (
        <div className="flex h-screen bg-neutral-50/50">
            {/* Sidebar */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-neutral-200 transform transition-transform duration-200 ease-in-out ${
                    isSidebarOpen ? "translate-x-0" : "-translate-x-full"
                } lg:relative lg:translate-x-0`}
            >
                <div className="flex flex-col h-full">
                    <div className="h-16 flex items-center px-6 border-b border-neutral-100">
                        <div className="flex items-center gap-2 font-semibold text-neutral-900">
                            <div className="p-1 bg-neutral-100 rounded border border-neutral-200">
                                <ShieldCheck className="w-5 h-5" />
                            </div>
                            <div className="flex flex-col">
                                <span className="leading-none">LTS Admin</span>
                                <span className="text-[10px] text-neutral-400 font-normal mt-1">
                  Catalog • Orders • Pricing
                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
                        <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
                        <NavItem to="/orders" icon={ShoppingCart} label="Orders" />
                        <NavItem to="/products" icon={Package} label="Products" />
                        <NavItem to="/keycards" icon={Key} label="Keycards" />
                        <NavItem to="/media" icon={ImageIcon} label="Media" />
                        <NavItem to="/stripe" icon={CreditCard} label="Stripe" />
                        <NavItem to="/settings" icon={Settings} label="Settings" />
                    </div>

                    <div className="p-4 border-t border-neutral-100">
                        <div className="flex items-center justify-between text-xs font-medium text-neutral-500 mb-4 px-2">
                            <span>QUICK ACTIONS</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mb-4">
                            <button
                                onClick={() => navigate("/orders")}
                                className="flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-neutral-700 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-lg transition-colors"
                            >
                                <ShoppingCart className="w-3.5 h-3.5" /> Orders
                            </button>
                            <button
                                onClick={() => navigate("/products")}
                                className="flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-neutral-700 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-lg transition-colors"
                            >
                                <Package className="w-3.5 h-3.5" /> Catalog
                            </button>
                        </div>

                        <div className="bg-neutral-50 rounded-lg p-3 border border-neutral-200">
                            <h4 className="text-xs font-semibold text-neutral-900 mb-1">Schema-aware UI</h4>
                            <p className="text-[10px] text-neutral-500 leading-relaxed">
                                Variants + tiered pricing, keycard lock tech tiers, orders snapshot fields, and Stripe audit.
                            </p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <header className="h-16 flex items-center justify-between px-6 bg-white border-b border-neutral-200 shrink-0">
                    <div className="flex items-center gap-4 flex-1">
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="lg:hidden p-2 text-neutral-500 hover:bg-neutral-100 rounded-md"
                        >
                            <Menu className="w-5 h-5" />
                        </button>

                        <button
                            onClick={() => navigate(-1)}
                            className={`p-2 rounded-md transition-colors ${
                                location.pathname !== "/" && location.pathname !== "/orders" && location.pathname !== "/dashboard"
                                    ? "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                                    : "text-neutral-300 cursor-not-allowed"
                            }`}
                            disabled={location.pathname === "/" || location.pathname === "/orders" || location.pathname === "/dashboard"}
                            title="Go Back"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>

                        {/* Global Search */}
                        <div ref={searchBoxRef} className="relative max-w-md w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                            <input
                                ref={inputRef}
                                value={search}
                                onChange={(e) => {
                                    setSearch(e.target.value);
                                    setOpenSearch(true);
                                }}
                                onFocus={() => setOpenSearch(true)}
                                onKeyDown={(e) => {
                                    if (e.key === "Escape") setOpenSearch(false);
                                    if (e.key === "Enter" && flatResults[0]) goTo(flatResults[0]);
                                }}
                                type="text"
                                placeholder="Search products, variants, Stripe ids..."
                                className="w-full pl-9 pr-4 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-400 transition-all placeholder:text-neutral-400"
                            />

                            {openSearch && debounced.length >= 2 && (
                                <div className="absolute z-50 mt-2 w-full rounded-lg border border-neutral-200 bg-white shadow-lg overflow-hidden">
                                    <div className="px-3 py-2 text-xs text-neutral-500 border-b border-neutral-100 flex items-center justify-between">
                                        <span>{isFetching ? "Searching…" : data?.groups?.length ? "Results" : "No results"}</span>
                                        <span className="text-[10px] text-neutral-400">Ctrl/Cmd+K • Enter opens first • Esc closes</span>
                                    </div>

                                    <div className="max-h-96 overflow-auto">
                                        {(data?.groups ?? []).map((g) => (
                                            <div key={g.key} className="py-1">
                                                <div className="px-3 py-1.5 text-[11px] font-semibold text-neutral-500">{g.label}</div>

                                                {g.items.map((it) => (
                                                    <button
                                                        key={`${it.type}-${it.id}`}
                                                        onMouseDown={(ev) => ev.preventDefault()}
                                                        onClick={() => goTo(it)}
                                                        className="w-full text-left px-3 py-2 hover:bg-neutral-50 transition-colors"
                                                    >
                                                        <div className="text-sm font-medium text-neutral-900">{it.title}</div>
                                                        {it.subtitle && <div className="text-xs text-neutral-500 mt-0.5">{it.subtitle}</div>}
                                                    </button>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 bg-neutral-100 rounded-full p-1 border border-neutral-200">
                            <span className="text-xs font-medium px-2 text-neutral-600">Compact</span>
                            <button className="w-9 h-5 bg-neutral-300 rounded-full relative transition-colors focus:outline-none">
                                <div className="absolute left-1 top-1 bg-white w-3 h-3 rounded-full shadow-sm"></div>
                            </button>
                        </div>
                        <button className="text-neutral-500 hover:text-neutral-900">
                            <Sun className="w-5 h-5" />
                        </button>
                        <button className="bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-sm transition-colors flex items-center gap-2">
                            Create
                        </button>
                    </div>
                </header>

                <main className="flex-1 overflow-auto p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

const App: React.FC = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const navigate = useNavigate();

    const handleLogin = () => {
        setIsAuthenticated(true);
        navigate("/");
    };

    return (
        <Routes>
            <Route path="/login" element={<Login onLogin={handleLogin} />} />
            <Route path="/" element={isAuthenticated ? <Layout /> : <Navigate to="/login" />}>
                <Route index element={<Navigate to="/orders" replace />} />
                <Route path="dashboard" element={<Navigate to="/orders" replace />} />

                <Route path="orders" element={<OrdersList />} />
                <Route path="orders/:id" element={<OrderDetail />} />

                {/* ✅ Stripe admin checkout flow */}
                <Route path="orders/:id/checkout" element={<AdminStripeCheckoutPage />} />
                <Route path="stripe/return" element={<AdminStripeReturnPage />} />

                <Route path="products" element={<ProductList />} />
                <Route path="products/:id" element={<ProductDetail />} />
                <Route path="products/:id/variant/new" element={<VariantEditor />} />
                <Route path="products/:id/variant/:variantId" element={<VariantEditor />} />
                <Route path="keycards" element={<Keycards />} />
                <Route path="media" element={<MediaLibrary />} />
                <Route path="stripe" element={<StripeAudit />} />
                <Route path="settings" element={<SettingsView />} />
            </Route>
        </Routes>
    );
};

export default App;
