/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./App.tsx",
        "./index.tsx",
        "./pages/**/*.{js,jsx,ts,tsx}",
        "./components/**/*.{js,jsx,ts,tsx}",
    ],
    theme: {
        // Important: define colors under `theme.colors` so Tailwind uses these for blue-*
        colors: {
            transparent: "transparent",
            current: "currentColor",
            black: "#000",
            white: "#fff",

            // Keep grays intact (your UI uses lots of gray-*)
            gray: {
                50: "#f9fafb",
                100: "#f3f4f6",
                200: "#e5e7eb",
                300: "#d1d5db",
                400: "#9ca3af",
                500: "#6b7280",
                600: "#4b5563",
                700: "#374151",
                800: "#1f2937",
                900: "#111827",
                950: "#030712",
            },

            // ✅ OVERRIDE BLUE to match your logo
            // Map Tailwind "blue-600" (your main button color) to your logo cyan
            // Map "blue-700" (hover states) to your logo deep navy
            blue: {
                50:  "#f2fbff",
                100: "#e6f7ff",
                200: "#c8eeff",
                300: "#9de1fb",
                400: "#7fd3f2", // logo light
                500: "#66c2ea",
                600: "#55b7e5", // logo primary (your current bg-blue-600 becomes this)
                700: "#1f4c7a", // logo navy (your current hover:bg-blue-700 becomes this)
                800: "#14385c", // logo dark navy
                900: "#0d243c",
                950: "#071727",
            },

            // Keep these if you use them
            red: {
                50: "#fef2f2",
                100: "#fee2e2",
                200: "#fecaca",
                300: "#fca5a5",
                400: "#f87171",
                500: "#ef4444",
                600: "#dc2626",
                700: "#b91c1c",
                800: "#991b1b",
                900: "#7f1d1d",
                950: "#450a0a",
            },
            green: {
                50: "#f0fdf4",
                100: "#dcfce7",
                200: "#bbf7d0",
                300: "#86efac",
                400: "#4ade80",
                500: "#22c55e",
                600: "#16a34a",
                700: "#15803d",
                800: "#166534",
                900: "#14532d",
                950: "#052e16",
            },
            yellow: {
                50: "#fefce8",
                100: "#fef9c3",
                200: "#fef08a",
                300: "#fde047",
                400: "#facc15",
                500: "#eab308",
                600: "#ca8a04",
                700: "#a16207",
                800: "#854d0e",
                900: "#713f12",
                950: "#422006",
            },
        },
        extend: {
            fontFamily: {
                display: ["ui-sans-serif", "system-ui", "sans-serif"],
            },
        },
    },
    plugins: [],
};
