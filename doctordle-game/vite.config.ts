import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],

  // Capacitor loads the built bundle from the device filesystem,
  // so assets must use relative paths (base = "./").
  base: "./",

  build: {
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: false,
    // Keep chunk size small for faster WebView load
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes("node_modules")) {
            if (id.includes("react")) {
              return "react";
            }
            if (id.includes("@clerk")) {
              return "clerk";
            }
          }
        },
      },
    },
  },

  server: {
    // For live-reload on device: set host to your machine's LAN IP
    // and update capacitor.config.ts server.url to match.
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
