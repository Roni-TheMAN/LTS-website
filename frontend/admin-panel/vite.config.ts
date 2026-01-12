import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // Load .env, .env.development, etc.
  const env = loadEnv(mode, process.cwd(), "");

  const apiBase = env.VITE_ADMIN_API_BASE_URL;

  if (!apiBase) {
    // Make the error obvious instead of failing later with "Must provide a proper URL"
    throw new Error(
        "VITE_ADMIN_API_BASE_URL is missing. Check admin-panel/.env.development"
    );
  }

  return {
    server: {
      port: 3000,
      host: "0.0.0.0",
      allowedHosts: true,
      proxy: {
        "/api": {
          target: apiBase,
          changeOrigin: true,
        },
        "/images": {
          target: apiBase,
          changeOrigin: true,
        },
      },
    },
    plugins: [react()],
    define: {
      "process.env.API_KEY": JSON.stringify(env.GEMINI_API_KEY),
      "process.env.GEMINI_API_KEY": JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
  };
});
