import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { VitePWA } from "vite-plugin-pwa";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CLOUD_DEFAULTS = {
  VITE_SUPABASE_PROJECT_ID: "aeyhgdlacoqsabsbrzia",
  VITE_SUPABASE_URL: "https://aeyhgdlacoqsabsbrzia.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFleWhnZGxhY29xc2Fic2JyemlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MDQ4MjMsImV4cCI6MjA5MjI4MDgyM30.s9ht6_cvQYmvkSlhhU5re-JbSlsv637cTe72lghRSco",
};

function getGitInfo() {
  try {
    return {
      commit: execSync("git rev-parse --short HEAD", { cwd: __dirname }).toString().trim(),
      buildNumber: execSync("git rev-list --count HEAD", { cwd: __dirname }).toString().trim(),
    };
  } catch {
    return { commit: "unknown", buildNumber: String(Date.now()) };
  }
}

const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, "package.json"), "utf-8"));
const gitInfo = getGitInfo();
const version = pkg.version || "0.0.0";
const buildTime = new Date().toISOString();
const buildId = String(Date.now());
const buildNumber = gitInfo.buildNumber;
const commit = gitInfo.commit;
const fullVersion = `${version}+${buildNumber}.${commit}`;

const versionJson = {
  version,
  commit,
  buildTime,
  buildId,
  buildNumber,
  fullVersion,
};

function versionJsonPlugin() {
  return {
    name: "version-json",
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        if (req.url === "/version.json") {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(versionJson));
          return;
        }
        next();
      });
    },
    writeBundle() {
      const out = path.resolve(__dirname, "dist/version.json");
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, JSON.stringify(versionJson, null, 2));
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const cloudEnv = {
    VITE_SUPABASE_PROJECT_ID:
      env.VITE_SUPABASE_PROJECT_ID || CLOUD_DEFAULTS.VITE_SUPABASE_PROJECT_ID,
    VITE_SUPABASE_URL: env.VITE_SUPABASE_URL || CLOUD_DEFAULTS.VITE_SUPABASE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY:
      env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      env.VITE_SUPABASE_ANON_KEY ||
      CLOUD_DEFAULTS.VITE_SUPABASE_PUBLISHABLE_KEY,
  };

  return ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    versionJsonPlugin(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: { enabled: false },
      includeAssets: ["favicon.ico", "robots.txt", "pwa-512x512.png"],
      manifest: {
        name: "ARSHNAZ — ارشناز · مدیریت تسک با عشق",
        short_name: "ARSHNAZ",
        description: "ارشناز — مدیریت وظایف، یادداشت‌ها و سلامت روان با AI. تقدیم با عشق.",
        theme_color: "#0F172A",
        background_color: "#0F172A",
        display: "standalone",
        orientation: "portrait",
        start_url: "/app/today",
        scope: "/",
        lang: "fa",
        dir: "rtl",
        icons: [
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        // Home-screen shortcuts (Android long-press menu) — closest thing PWA has to widgets
        shortcuts: [
          {
            name: "تسک امروز",
            short_name: "امروز",
            description: "تسک‌های امروز را ببین",
            url: "/app/today",
            icons: [{ src: "/pwa-512x512.png", sizes: "512x512" }],
          },
          {
            name: "Check-in روزانه",
            short_name: "Check-in",
            description: "حال‌وهوای امروز را ثبت کن",
            url: "/app/checkin",
            icons: [{ src: "/pwa-512x512.png", sizes: "512x512" }],
          },
          {
            name: "Pomodoro",
            short_name: "تمرکز",
            description: "شروع جلسه تمرکز",
            url: "/app/pomodoro",
            icons: [{ src: "/pwa-512x512.png", sizes: "512x512" }],
          },
          {
            name: "SOS / بحران",
            short_name: "SOS",
            description: "دسترسی سریع به ابزارهای بحران",
            url: "/app/crisis",
            icons: [{ src: "/pwa-512x512.png", sizes: "512x512" }],
          },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/~oauth/, /^\/api/, /^\/version\.json/],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        clientsClaim: true,
        skipWaiting: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/assets/"),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "static-assets",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            urlPattern: ({ url }) =>
              url.hostname.endsWith("supabase.co") && url.pathname.includes("/rest/"),
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-rest",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) =>
              url.hostname.endsWith("supabase.co") && url.pathname.includes("/storage/"),
            handler: "CacheFirst",
            options: {
              cacheName: "supabase-storage",
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  esbuild: {
    // Drop noisy logs from production bundles (faster parse + smaller JS)
    drop: mode === "production" ? ["console", "debugger"] : [],
  },
  build: {
    target: "es2020",
    cssCodeSplit: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
    // NOTE: Custom manualChunks was removed — it caused Radix to load before
    // React in production, breaking the app with "Cannot read properties of
    // undefined (reading 'forwardRef')". Vite's default chunking is safe and
    // already splits per-route via the lazy() dynamic imports in App.tsx.
  },
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(version),
    "import.meta.env.VITE_BUILD_TIME": JSON.stringify(buildTime),
    "import.meta.env.VITE_BUILD_ID": JSON.stringify(buildId),
    "import.meta.env.VITE_BUILD_NUMBER": JSON.stringify(buildNumber),
    "import.meta.env.VITE_GIT_COMMIT": JSON.stringify(commit),
    "import.meta.env.VITE_FULL_VERSION": JSON.stringify(fullVersion),
    "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(cloudEnv.VITE_SUPABASE_PROJECT_ID),
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(cloudEnv.VITE_SUPABASE_URL),
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(cloudEnv.VITE_SUPABASE_PUBLISHABLE_KEY),
    "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(cloudEnv.VITE_SUPABASE_PUBLISHABLE_KEY),
  },
});
});
