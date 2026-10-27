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
      // Same as apps/web: keep paths as written and point at the shared source
      preserveSymlinks: true,
      alias: {
        "@repo/shared": fileURLToPath(new URL("../../packages/shared/src/index.ts", import.meta.url)),
      },
    },
    server: {
      port: 5174,
      // Same-origin /api calls so the httpOnly session cookie works without CORS
      proxy: {
        "/api": env.VITE_EJ_API_URL ?? "http://localhost:3100",
      },
    },
    test: {
      name: "ej-web",
      globals: true,
      environment: "jsdom",
      setupFiles: ["./src/setupTests.ts"],
    },
  };
});
