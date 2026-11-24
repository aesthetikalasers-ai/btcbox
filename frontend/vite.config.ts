import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(rootDir, "src") } },
  build: {
    // Keep React bundles separate from the legacy BTCBOX admin assets at /assets.
    assetsDir: "frontend-assets",
    rollupOptions: {
      output: {
        // Cache the stable React/router runtime independently of application edits.
        manualChunks(id) {
          if (/\/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return "react-runtime";
        },
      },
    },
  },
  server: {
    hmr: process.env.DISABLE_HMR !== "true",
    watch: process.env.DISABLE_HMR === "true" ? null : {},
  },
});
