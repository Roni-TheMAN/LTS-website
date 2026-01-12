import React, { useEffect, useMemo, useState } from "react";
import { useNavigation } from "../src/NavigationContext.tsx";

type Solution = {
    id: string;
    title: string;
    subtitle: string;
    icon: string; // material symbol name
    bullets: string[];
    tag: string;
    audience: string;
};

const SOLUTIONS: Solution[] = [
    {
        id: "rfid-access",
        title: "RFID Access Control",
        subtitle: "Hotel-grade locks, readers, encoding, and deployment support.",
        icon: "badge",
        tag: "Most Popular",
        audience: "Hotels • Apartments • Campuses",
        bullets: [
            "Compatible with major lock ecosystems",
            "On-site + remote setup guidance",
            "Bulk keycards + custom designs",
            "Upgrade paths for legacy installs",
        ],
    },
    {
        id: "surveillance",
        title: "IP Surveillance Systems",
        subtitle: "PoE cameras, NVRs, storage sizing, and clean installs.",
        icon: "videocam",
        tag: "Security",
        audience: "Hotels • Retail • Warehouses",
        bullets: [
            "Unifi & enterprise-grade options",
            "Night vision + coverage planning",
            "Network + storage sizing",
            "Monitoring + best-practice layouts",
        ],
    },
    {
        id: "networking",
        title: "Networking & Wi-Fi",
        subtitle: "Switching, PoE, APs, VLANs, and reliable connectivity.",
        icon: "wifi",
        tag: "Infrastructure",
        audience: "Hotels • Offices • Multi-site",
        bullets: [
            "PoE switching + rack cleanup",
            "VLAN segmentation for security",
            "Wi-Fi heatmaps + AP placement",
            "Troubleshooting & optimization",
        ],
    },
    {
        id: "automation",
        title: "Operations Automation",
        subtitle: "Simple systems that reduce repetitive work and support scale.",
        icon: "auto_awesome",
        tag: "Efficiency",
        audience: "Management • IT • Ops",
        bullets: [
            "Inventory tracking and reporting",
            "Alerts + monitoring dashboards",
            "Integrations (Stripe, email, etc.)",
            "Custom workflows for your property",
        ],
    },
    {
        id: "keycards",
        title: "Bulk RFID Keycards",
        subtitle: "Fast turnaround, consistent QA, better pricing at scale.",
        icon: "inventory_2",
        tag: "Bulk Pricing",
        audience: "Hotels • Resorts • Chains",
        bullets: [
            "Tiered pricing by lock technology",
            "Custom designs and branding",
            "Quality checks + print alignment",
            "Rush options available",
        ],
    },
    {
        id: "consulting",
        title: "Consulting & Implementation",
        subtitle: "We help you pick the right setup and execute it right.",
        icon: "support_agent",
        tag: "Guidance",
        audience: "Owners • IT • Contractors",
        bullets: [
            "Project scoping and roadmap",
            "Vendor selection support",
            "Cost planning + timeline",
            "Deployment checklists",
        ],
    },
];

const SolutionsPage: React.FC = () => {
    const { navigate } = useNavigation();

    const [activeId, setActiveId] = useState<string>(SOLUTIONS[0]?.id ?? "rfid-access");
    const [query, setQuery] = useState("");

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return SOLUTIONS;
        return SOLUTIONS.filter(
            (s) =>
                s.title.toLowerCase().includes(q) ||
                s.subtitle.toLowerCase().includes(q) ||
                s.bullets.some((b) => b.toLowerCase().includes(q)) ||
                s.audience.toLowerCase().includes(q) ||
                s.tag.toLowerCase().includes(q)
        );
    }, [query]);

    const active = useMemo(
        () => SOLUTIONS.find((s) => s.id === activeId) ?? filtered[0] ?? SOLUTIONS[0],
        [activeId, filtered]
    );

    return (
        <div className="min-h-screen bg-gray-50 pb-20" id="solutions">
            {/* Hero */}
            <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-700 via-blue-600 to-blue-400" />
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_15%_20%,white_0%,transparent_45%),radial-gradient(circle_at_80%_30%,white_0%,transparent_40%)]" />
                <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
                    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
                        <div className="max-w-2xl">
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-4 py-1.5 text-xs font-bold text-white w-fit backdrop-blur">
                                <span className="material-symbols-outlined text-[16px]">hub</span>
                                Solutions
                            </div>

                            <h1 className="mt-4 text-4xl sm:text-5xl font-bold text-white tracking-tight font-display">
                                Hardware + systems that <span className="text-blue-100">don’t break at scale.</span>
                            </h1>

                            <p className="mt-3 text-blue-100 text-lg max-w-xl">
                                Pick what you need. We’ll recommend the cleanest setup that works, not the fanciest one.
                            </p>

                            <div className="mt-6 flex flex-col sm:flex-row gap-3">
                                <button
                                    onClick={() => navigate("PRODUCTS")}
                                    className="h-12 px-6 rounded-xl bg-white text-blue-700 font-bold hover:bg-blue-50 transition-colors shadow-lg shadow-blue-900/20"
                                >
                                    Browse Products
                                </button>
                                <button
                                    onClick={() => {
                                        // If your Header uses the quote modal, keep that there.
                                        // For now, route to support or just go home.
                                        navigate("SUPPORT");
                                    }}
                                    className="h-12 px-6 rounded-xl border border-white/30 bg-white/10 text-white font-bold hover:bg-white/15 transition-colors backdrop-blur"
                                >
                                    Talk to Us
                                </button>
                            </div>
                        </div>

                        {/* Search */}
                        <div className="w-full lg:w-[420px]">
                            <div className="bg-white/10 border border-white/20 rounded-2xl p-4 backdrop-blur-md">
                                <div className="relative">
                                    <input
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        placeholder="Search solutions (e.g. RFID, cameras, Wi-Fi)…"
                                        className="w-full rounded-xl border border-white/20 bg-white/15 py-3 pl-11 pr-4 text-sm text-white placeholder-blue-100/80 focus:outline-none focus:ring-2 focus:ring-white/30"
                                    />
                                    <span className="material-symbols-outlined absolute left-4 top-3.5 text-white/80 text-[20px]">
                    search
                  </span>
                                </div>
                                <div className="mt-3 flex items-center justify-between text-xs text-blue-100">
                  <span>
                    Showing <span className="font-bold text-white">{filtered.length}</span> solutions
                  </span>
                                    <button
                                        onClick={() => setQuery("")}
                                        className="font-bold text-white hover:underline"
                                        type="button"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Breadcrumb */}
                    <div className="mt-8 flex flex-wrap gap-2 text-sm">
                        <button
                            onClick={() => navigate("HOME")}
                            className="text-blue-100 hover:text-white transition-colors font-medium"
                        >
                            Home
                        </button>
                        <span className="text-blue-100/60 font-medium">/</span>
                        <span className="text-white font-semibold">Solutions</span>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-10">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left list */}
                    <aside className="lg:col-span-5">
                        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                                <h2 className="text-lg font-bold text-gray-900 font-display">All Solutions</h2>
                                <span className="text-xs font-bold text-gray-500 bg-gray-50 border border-gray-200 px-3 py-1 rounded-full uppercase tracking-wider">
                  Pick one
                </span>
                            </div>

                            <div className="p-3">
                                {filtered.map((s) => {
                                    const active = s.id === activeId;
                                    return (
                                        <button
                                            key={s.id}
                                            onClick={() => setActiveId(s.id)}
                                            className={`w-full text-left rounded-xl px-4 py-4 mb-2 border transition-all ${
                                                active
                                                    ? "border-blue-600 bg-blue-50 shadow-sm"
                                                    : "border-gray-200 bg-white hover:bg-gray-50"
                                            }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div
                                                    className={`p-2 rounded-xl ${
                                                        active ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"
                                                    } transition-colors`}
                                                >
                                                    <span className="material-symbols-outlined">{s.icon}</span>
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <h3 className="font-bold text-gray-900 truncate">{s.title}</h3>
                                                        <span
                                                            className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider border ${
                                                                active
                                                                    ? "bg-white text-blue-700 border-blue-200"
                                                                    : "bg-gray-50 text-gray-600 border-gray-200"
                                                            }`}
                                                        >
                              {s.tag}
                            </span>
                                                    </div>
                                                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{s.subtitle}</p>
                                                    <div className="mt-2 text-xs text-gray-500 flex items-center gap-2">
                            <span className="material-symbols-outlined text-[16px] text-gray-400">
                              group
                            </span>
                                                        <span className="truncate">{s.audience}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}

                                {filtered.length === 0 && (
                                    <div className="p-6 text-center">
                                        <span className="material-symbols-outlined text-5xl text-gray-300">search_off</span>
                                        <p className="mt-2 text-gray-600 font-bold">No matches</p>
                                        <p className="text-sm text-gray-500 mt-1">Try different keywords.</p>
                                        <button
                                            onClick={() => setQuery("")}
                                            className="mt-4 px-5 py-2 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors"
                                        >
                                            Clear search
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Mini stats */}
                        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {[
                                { icon: "schedule", title: "Fast Turnaround", desc: "Most orders ship in days" },
                                { icon: "verified", title: "Reliable Gear", desc: "Enterprise-quality options" },
                                { icon: "support_agent", title: "Real Support", desc: "Not a chatbot loop" },
                            ].map((c) => (
                                <div key={c.title} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                                    <div className="flex items-center gap-2 font-bold text-gray-900">
                                        <span className="material-symbols-outlined text-blue-600 text-[20px]">{c.icon}</span>
                                        {c.title}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">{c.desc}</p>
                                </div>
                            ))}
                        </div>
                    </aside>

                    {/* Right detail */}
                    <section className="lg:col-span-7">
                        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                            <div className="px-6 sm:px-8 py-6 border-b border-gray-100">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                    <div>
                                        <div className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                                            {active?.tag}
                                        </div>
                                        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 font-display">
                                            {active?.title}
                                        </h2>
                                        <p className="text-gray-500 mt-2">{active?.subtitle}</p>
                                    </div>

                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => navigate("SUPPORT")}
                                            className="h-11 px-5 rounded-xl border border-gray-200 bg-white text-gray-800 font-bold hover:bg-gray-50 transition-colors"
                                        >
                                            Get Help
                                        </button>
                                        <button
                                            onClick={() => navigate("PRODUCTS")}
                                            className="h-11 px-5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20"
                                        >
                                            See Products
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 sm:p-8">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {(active?.bullets ?? []).map((b) => (
                                        <div
                                            key={b}
                                            className="rounded-2xl border border-gray-200 bg-gray-50 p-4 flex items-start gap-3"
                                        >
                                            <div className="p-2 rounded-xl bg-blue-600 text-white">
                                                <span className="material-symbols-outlined text-[18px]">check</span>
                                            </div>
                                            <div className="text-sm font-semibold text-gray-800">{b}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* “How it works” steps */}
                                <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6">
                                    <h3 className="text-lg font-bold text-gray-900 font-display">How it works</h3>
                                    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                                        {[
                                            {
                                                icon: "format_list_bulleted",
                                                title: "Scope",
                                                desc: "We map what you have, what you need, and what to skip.",
                                            },
                                            {
                                                icon: "architecture",
                                                title: "Design",
                                                desc: "We propose a setup that’s stable and serviceable.",
                                            },
                                            {
                                                icon: "rocket_launch",
                                                title: "Deploy",
                                                desc: "We help you implement cleanly and verify it works.",
                                            },
                                        ].map((s) => (
                                            <div key={s.title} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                                                <div className="flex items-center gap-2 font-bold text-gray-900">
                                                    <span className="material-symbols-outlined text-blue-600">{s.icon}</span>
                                                    {s.title}
                                                </div>
                                                <p className="text-xs text-gray-500 mt-2">{s.desc}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Big CTA */}
                                <div className="mt-8 rounded-2xl bg-blue-600 p-6 sm:p-8 text-white relative overflow-hidden">
                                    <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_20%,white_0%,transparent_45%),radial-gradient(circle_at_80%_40%,white_0%,transparent_40%)]" />
                                    <div className="relative">
                                        <div className="flex items-center gap-2 text-white/90 text-xs font-bold uppercase tracking-wider">
                                            <span className="material-symbols-outlined text-[18px]">bolt</span>
                                            Next step
                                        </div>
                                        <h3 className="mt-2 text-2xl sm:text-3xl font-bold font-display">
                                            Want a clean recommendation for your property?
                                        </h3>
                                        <p className="mt-2 text-blue-100 max-w-2xl">
                                            Tell us your building type and what you’re trying to fix. We’ll recommend the simplest setup that actually works.
                                        </p>
                                        <div className="mt-5 flex flex-col sm:flex-row gap-3">
                                            <button
                                                onClick={() => navigate("SUPPORT")}
                                                className="h-12 px-6 rounded-xl bg-white text-blue-700 font-bold hover:bg-blue-50 transition-colors shadow-lg shadow-blue-900/20"
                                            >
                                                Contact Support
                                            </button>
                                            <button
                                                onClick={() => navigate("PRODUCTS")}
                                                className="h-12 px-6 rounded-xl border border-white/30 bg-white/10 text-white font-bold hover:bg-white/15 transition-colors backdrop-blur"
                                            >
                                                Browse Products
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer note */}
                                <p className="mt-6 text-xs text-gray-400">
                                    Need a quote? Use “Get Quote” in the header for faster turnaround.
                                </p>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default SolutionsPage;
