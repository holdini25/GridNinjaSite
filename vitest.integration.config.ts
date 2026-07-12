import { fileURLToPath } from "node:url"

import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["tests/integration/**/*.integration.test.ts"],
    environment: "node",
    globals: true,
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
})

