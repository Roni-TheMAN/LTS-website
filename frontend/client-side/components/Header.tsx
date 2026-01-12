import React, { useEffect, useMemo, useState } from "react";
import { useNavigation } from "../src/NavigationContext.tsx";
import { useCart } from "../src/CartContext.tsx";
import { useSearch } from "../SearchContext.tsx";
import { useLocation, useNavigate as useRRNavigate } from "react-router-dom";

// @ts-ignore
import logo from "../static/logo/LTSpnglogo.png";

type NavItem = {
    label: string;
    kind: "route" | "action";
    path?: string; // used when kind="route"
    icon: string;
    onClick?: () => void; // used when kind="action"
};

const Header: React.FC = () => {
    const { navigate } = useNavigation();
    const rrNavigate = useRRNavigate();
    const location = useLocation();

    const { itemCount } = useCart();
    const { searchQuery, setSearchQuery } = useSearch();

    const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isQuoteOpen, setIsQuoteOpen] = useState(false);

    const closeMobileUI = () => {
        setIsMobileMenuOpen(false);
        setIsMobileSearchOpen(false);
    };

    // Lock scroll + ESC close for mobile drawer
    useEffect(() => {
        if (!isMobileMenuOpen) return;

        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") setIsMobileMenuOpen(false);
        };
        window.addEventListener("keydown", onKeyDown);

        return () => {
            document.body.style.overflow = prevOverflow;
            window.removeEventListener("keydown", onKeyDown);
        };
    }, [isMobileMenuOpen]);

    const goTo = (label: string) => {
        // close mobile UI first so it feels instant
        closeMobileUI();

        switch (label) {
            case "Home":
                navigate("HOME");
                break;
            case "Products":
                navigate("PRODUCTS");
                break;
            case "Support":
                navigate("SUPPORT");
                break;
            case "RFID Keycards":
                // This uses React Router directly (works even if NavigationContext doesn't have a key)
                rrNavigate("/rfid-keycards");
                break;
            case "Solutions":
                rrNavigate("/solutions");
                break;
            default:
                navigate("HOME");
                break;
        }
    };

    const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            navigate("PRODUCTS");
            closeMobileUI();
        }
    };

    const handleQuoteSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        alert("Quote request submitted successfully! We'll be in touch shortly.");
        setIsQuoteOpen(false);
    };

    const desktopNav = useMemo(
        () => ["Home", "Products", "RFID Keycards", "Solutions", "Support"],
        []
    );

    const mobileNavItems: NavItem[] = useMemo(
        () => [
            { label: "Home", kind: "route", path: "/", icon: "home" },
            { label: "Products", kind: "route", path: "/products", icon: "inventory_2" },
            { label: "RFID Keycards", kind: "route", path: "/rfid-keycards", icon: "badge" },
            { label: "Solutions", kind: "route", path: "/#solutions", icon: "hub" },
            { label: "Support", kind: "route", path: "/support", icon: "support_agent" },
            {
                label: "Get Quote",
                kind: "action",
                icon: "request_quote",
                onClick: () => {
                    closeMobileUI();
                    setIsQuoteOpen(true);
                },
            },
            {
                label: "Cart",
                kind: "action",
                icon: "shopping_cart",
                onClick: () => {
                    closeMobileUI();
                    navigate("CART");
                },
            },
        ],
        [navigate]
    );

    const isActiveRoute = (path?: string) => {
        if (!path) return false;
        // Basic highlight; ignores hashes
        const p = path.split("#")[0];
        return p.length > 0 && location.pathname === p;
    };

    return (
        <>
            <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/90 backdrop-blur-md transition-all duration-300">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="flex h-20 items-center justify-between gap-4 md:gap-8">
                        {/* Logo */}
                        <div
                            className="flex items-center gap-4 cursor-pointer shrink-0"
                            onClick={() => {
                                closeMobileUI();
                                navigate("HOME");
                            }}
                        >
                            <img
                                src={logo}
                                alt="Legacy Tech Solutions"
                                className="h-12 md:h-14 w-auto object-contain"
                            />
                        </div>

                        {/* Desktop nav */}
                        <nav className="hidden md:flex items-center gap-6 lg:gap-10 h-full">
                            {desktopNav.map((item) => (
                                <button
                                    key={item}
                                    onClick={() => goTo(item)}
                                    className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors relative group py-2"
                                >
                                    {item}
                                    <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-600 transition-all duration-300 group-hover:w-full" />
                                </button>
                            ))}
                        </nav>

                        {/* Right controls */}
                        <div className="flex items-center gap-3 md:gap-5 flex-1 md:flex-none justify-end">
                            {/* Desktop Search Bar */}
                            <div className="hidden lg:block relative w-64">
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={handleSearchKeyDown}
                                    className="w-full rounded-full border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-600 focus:ring-blue-600 focus:bg-white transition-all"
                                />
                                <span className="material-symbols-outlined absolute left-3 top-2 text-gray-400 text-[20px]">
                  search
                </span>
                            </div>

                            {/* Mobile Search Toggle */}
                            <button
                                className="lg:hidden flex items-center justify-center p-2 text-gray-500 hover:text-blue-600 transition-colors"
                                onClick={() => {
                                    // if menu open, close it; search is separate UX
                                    setIsMobileMenuOpen(false);
                                    setIsMobileSearchOpen((v) => !v);
                                }}
                                aria-label="Search"
                            >
                                <span className="material-symbols-outlined">search</span>
                            </button>

                            {/* Cart */}
                            <button
                                className="flex items-center justify-center p-2 text-gray-500 hover:text-blue-600 transition-colors relative"
                                onClick={() => {
                                    closeMobileUI();
                                    navigate("CART");
                                }}
                                aria-label="Cart"
                            >
                                <span className="material-symbols-outlined">shopping_cart</span>
                                {itemCount > 0 && (
                                    <span className="absolute top-1 right-0 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">
                    {itemCount}
                  </span>
                                )}
                            </button>

                            {/* Desktop quote */}
                            <button
                                onClick={() => setIsQuoteOpen(true)}
                                className="hidden lg:flex h-11 items-center justify-center rounded-full bg-blue-600 px-6 text-sm font-bold text-white hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40"
                            >
                                Get Quote
                            </button>

                            {/* Mobile menu button */}
                            <button
                                className="md:hidden p-2 text-gray-500 hover:text-blue-600 transition-colors"
                                onClick={() => {
                                    // close search if opening menu
                                    setIsMobileSearchOpen(false);
                                    setIsMobileMenuOpen((v) => !v);
                                }}
                                aria-label="Menu"
                            >
                <span className="material-symbols-outlined">
                  {isMobileMenuOpen ? "close" : "menu"}
                </span>
                            </button>
                        </div>
                    </div>

                    {/* Mobile Search Bar Expandable */}
                    {isMobileSearchOpen && (
                        <div className="lg:hidden py-4 border-t border-gray-100 animate-fade-in-down">
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Search products..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={handleSearchKeyDown}
                                    autoFocus
                                    className="w-full rounded-lg border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-600 focus:ring-blue-600 shadow-sm"
                                />
                                <span className="material-symbols-outlined absolute left-3 top-3 text-gray-400 text-[20px]">
                  search
                </span>
                            </div>
                        </div>
                    )}
                </div>
            </header>

            {/* Mobile drawer */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-[90] md:hidden">
                    <div
                        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
                        onClick={() => setIsMobileMenuOpen(false)}
                    />

                    <div className="absolute right-0 top-0 h-full w-[86%] max-w-sm bg-white shadow-2xl border-l border-gray-200">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                            <div className="flex items-center gap-3">
                                <img src={logo} alt="LTS" className="h-10 w-auto object-contain" />
                                <div className="leading-tight">
                                    <div className="text-sm font-bold text-gray-900">Legacy Tech</div>
                                    <div className="text-xs text-gray-500">Menu</div>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="p-2 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                                aria-label="Close menu"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        {/* Drawer search */}
                        <div className="p-5 border-b border-gray-100">
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Search…"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={handleSearchKeyDown}
                                    className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-600 focus:ring-blue-600 focus:bg-white transition-all"
                                />
                                <span className="material-symbols-outlined absolute left-4 top-3.5 text-gray-400 text-[20px]">
                  search
                </span>
                            </div>
                        </div>

                        {/* Nav items */}
                        <div className="p-3">
                            {mobileNavItems.map((item) => {
                                const active = item.kind === "route" && isActiveRoute(item.path);
                                return (
                                    <button
                                        key={item.label}
                                        onClick={() => {
                                            if (item.kind === "action") {
                                                item.onClick?.();
                                                return;
                                            }
                                            goTo(item.label);
                                        }}
                                        className={`w-full flex items-center justify-between gap-3 rounded-xl px-4 py-3 transition-colors text-left ${
                                            active
                                                ? "bg-blue-50 text-blue-700 border border-blue-100"
                                                : "hover:bg-gray-50 text-gray-800"
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                      <span className={`material-symbols-outlined ${active ? "text-blue-600" : "text-gray-500"}`}>
                        {item.icon}
                      </span>
                                            <span className="font-semibold">{item.label}</span>
                                        </div>

                                        {item.label === "Cart" && item.kind === "action" && itemCount > 0 && (
                                            <span className="min-w-[28px] h-7 px-2 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
                        {itemCount}
                      </span>
                                        )}

                                        {(item.kind === "route" || item.kind === "action") && item.label !== "Cart" && (
                                            <span className="material-symbols-outlined text-[18px] text-gray-300">
                        chevron_right
                      </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Bottom helper */}
                        <div className="absolute bottom-0 left-0 right-0 p-5 border-t border-gray-100 bg-white">
                            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                                <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
                                    <span className="material-symbols-outlined text-[18px] text-blue-600">info</span>
                                    Need custom artwork?
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    Tap <span className="font-semibold text-gray-700">Get Quote</span> and we’ll handle it.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Quote Modal (unchanged) */}
            {isQuoteOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
                    <div
                        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity"
                        onClick={() => setIsQuoteOpen(false)}
                    ></div>
                    <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl sm:p-10 animate-[zoomIn_0.2s_ease-out]">
                        <button
                            onClick={() => setIsQuoteOpen(false)}
                            className="absolute right-4 top-4 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>

                        <div className="mb-6">
                            <h2 className="text-2xl font-bold text-gray-900 font-display">Request a Quote</h2>
                            <p className="text-gray-500 mt-1">
                                Tell us about your project needs and we'll send a custom quote.
                            </p>
                        </div>

                        <form onSubmit={handleQuoteSubmit}>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                                        <input
                                            required
                                            type="text"
                                            className="w-full rounded-lg border-gray-200 bg-gray-50 py-2.5 px-4 text-sm text-gray-900 focus:border-blue-600 focus:ring-blue-600 focus:bg-white transition-all"
                                            placeholder="John"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                                        <input
                                            required
                                            type="text"
                                            className="w-full rounded-lg border-gray-200 bg-gray-50 py-2.5 px-4 text-sm text-gray-900 focus:border-blue-600 focus:ring-blue-600 focus:bg-white transition-all"
                                            placeholder="Doe"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Work Email</label>
                                    <input
                                        required
                                        type="email"
                                        className="w-full rounded-lg border-gray-200 bg-gray-50 py-2.5 px-4 text-sm text-gray-900 focus:border-blue-600 focus:ring-blue-600 focus:bg-white transition-all"
                                        placeholder="john@company.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                                    <input
                                        type="text"
                                        className="w-full rounded-lg border-gray-200 bg-gray-50 py-2.5 px-4 text-sm text-gray-900 focus:border-blue-600 focus:ring-blue-600 focus:bg-white transition-all"
                                        placeholder="Acme Inc."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Project Details</label>
                                    <textarea
                                        required
                                        rows={4}
                                        className="w-full rounded-lg border-gray-200 bg-gray-50 py-2.5 px-4 text-sm text-gray-900 focus:border-blue-600 focus:ring-blue-600 focus:bg-white transition-all resize-none"
                                        placeholder="I'm interested in bulk pricing for..."
                                    ></textarea>
                                </div>
                                <button
                                    type="submit"
                                    className="w-full rounded-lg bg-blue-600 py-3 font-bold text-white hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2"
                                >
                                    <span>Submit Request</span>
                                    <span className="material-symbols-outlined text-sm">send</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
};

export default Header;
