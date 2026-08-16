import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src/service-worker",
      filename: "firebase-messaging-sw.js",
      injectRegister: null,
      manifest: false,
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico,webmanifest,woff,woff2}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],

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
    port: 8081,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
