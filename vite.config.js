import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const appBase = "/Planning-AVD/";

export default defineConfig({
  base: appBase,
  plugins: [
    react(),
    VitePWA({
      // [ID-PWA-01] The app is installed from the GitHub Pages sub-path.
      registerType: "prompt",
      injectRegister: false,
      manifestFilename: "manifest.json",
      includeManifestIcons: false,
      includeAssets: ["apple-touch-icon.png", "icons/planning-avd-192.png", "icons/planning-avd-512.png", "offline.html"],
      manifest: {
        id: appBase,
        name: "Planning-AVD",
        short_name: "Planning-AVD",
        description: "Planning prive des auxiliaires de vie",
        lang: "fr",
        start_url: appBase,
        scope: appBase,
        display: "standalone",
        orientation: "portrait",
        background_color: "#f8f5ef",
        theme_color: "#f8f5ef",
        icons: [
          { src: `${appBase}icons/planning-avd-192.png?v=20260606-icon-safe`, sizes: "192x192", type: "image/png", purpose: "any maskable" },
          { src: `${appBase}icons/planning-avd-512.png?v=20260606-icon-safe`, sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
      workbox: {
        // [ID-PWA-02] Navigation fallback keeps the app readable offline.
        navigateFallback: `${appBase}offline.html`,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,json}"],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === self.location.origin && url.pathname.startsWith("/api/"),
            handler: "NetworkFirst",
            options: {
              cacheName: "planning-avd-api",
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 },
            },
          },
          {
            urlPattern: ({ request }) => ["font", "image", "script", "style"].includes(request.destination),
            handler: "CacheFirst",
            options: {
              cacheName: "planning-avd-static",
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
});
