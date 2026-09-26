import { defineConfig, devices } from "@playwright/test"
import { stagingCanaryConfig } from "./scripts/qa/staging-contract.mjs"

const { baseURL } = stagingCanaryConfig(process.env)

export default defineConfig({
  testDir: "./tests/staging",
  // Sequential gates: UI, provider acceptance, recipient callback and an actual
  // operator acknowledgement. This is deliberately a staffed rehearsal.
  timeout: 420_000,
  retries: 0,
  outputDir: "test-results/staging",
  reporter: [["list"], ["json", { outputFile: "test-results/staging/results.json" }], ["junit", { outputFile: "test-results/staging/junit.xml" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium-staging",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
})
