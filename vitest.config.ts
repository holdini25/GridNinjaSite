import { fileURLToPath } from "node:url"

import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: [
      "tests/unit/**/*.test.{ts,tsx}",
      "tests/unit/**/*.spec.{ts,tsx}",
    ],
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: [
        "src/schemas/dispatch-envelope.schema.ts",
        "src/lib/dispatch-envelope/{compile-demo-envelope,invariants,normalize,geometry,export}.ts",
      ],
      thresholds: { statements: 90, lines: 90, functions: 90, branches: 85 },
    },
  },
})
