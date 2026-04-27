import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";

// Hardened SPA Configuration
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), "");
  
  console.log("--- Build Configuration ---");
  console.log("Mode:", mode);
  console.log("Supabase URL:", env.VITE_SUPABASE_URL || env.SUPABASE_URL);
  console.log("---------------------------");

  return {
    plugins: [
      TanStackRouterVite({
        routesDirectory: "./src/routes",
        generatedRouteTree: "./src/routeTree.gen.ts",
      }),
      react(),
      tailwindcss(),
      tsconfigPaths(),
    ],
    // Explicitly define env vars to ensure they are baked into the bundle
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(env.VITE_SUPABASE_URL || env.SUPABASE_URL),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 8080,
      strictPort: true,
      host: "0.0.0.0",
      allowedHosts: [
        "lionfish-app-vrot8.ondigitalocean.app",
        ".ondigitalocean.app"
      ]
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
    }
  };
});
