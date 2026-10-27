import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "ej-api",
    globals: true,
    environment: "node",
  },
});
