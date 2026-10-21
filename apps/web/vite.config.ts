/// <reference types="vitest/config" />
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Read .env from the monorepo root
const envDir = "../..";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, "VITE_");

  return {
    plugins: [react()],
    envDir,
    resolve: {
      // Keep paths as written instead of resolving to realpath; the realpath of this
      // folder (an app-virtualized location) can't be loaded by Vitest's setupFiles
      preserveSymlinks: true,
      // preserveSymlinks stops the workspace symlink from resolving, so point at the source
      alias: {
        "@repo/shared": fileURLToPath(new URL("../../packages/shared/src/index.ts", import.meta.url)),
      },
    },
    server: {
      // Same-origin /api calls so the httpOnly session cookie works without CORS
      proxy: {
        "/api": env.VITE_API_URL ?? "http://localhost:3000",
      },
    },
    test: {
      name: "web",
      globals: true,
      environment: "jsdom",
      setupFiles: ["./src/setupTests.ts"],
    },
  };
});
