import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "@playwright/test";
import { SEED_ADMIN } from "../ej-api/src/seed";

// Own ports and a throwaway database, so E2E never touches the dev servers (3100/5174)
// or apps/ej-api/data/ej-dashboard.db. See docs/ej-dashboard/testing-strategy.md.
const API_PORT = 3110;
const WEB_PORT = 5184;

// A new empty database per run; set once so worker processes that reload this config agree
process.env.EJ_E2E_DB_PATH ??= join(mkdtempSync(join(tmpdir(), "ej-e2e-")), "e2e.db");
const dbPath = process.env.EJ_E2E_DB_PATH;

export default defineConfig({
  testDir: "./tests",
  // Tests share one database, so they run one after another
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    // Installed Google Chrome, so no browser download is needed
    channel: "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "npm run start -w @repo/ej-api",
      cwd: "../..",
      url: `http://localhost:${API_PORT}/health`,
      reuseExistingServer: false,
      env: {
        EJ_API_PORT: String(API_PORT),
        EJ_DB_PATH: dbPath,
        AUTH_SECRET: "e2e-only-secret",
        // The tests log in with SEED_ADMIN as this process sees it; pass the same values so a
        // different EJ_SEED_ADMIN_* in .env (which only the API loads) can't break login
        EJ_SEED_ADMIN_EMAIL: SEED_ADMIN.email,
        EJ_SEED_ADMIN_PASSWORD: SEED_ADMIN.password,
      },
    },
    {
      command: `npm run dev -w @repo/ej-web -- --port ${WEB_PORT} --strictPort`,
      cwd: "../..",
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
      env: { VITE_EJ_API_URL: `http://localhost:${API_PORT}` },
    },
  ],
});
