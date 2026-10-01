import { defineConfig, devices } from "@playwright/test"
import { stagingIntakeConfig } from "./scripts/qa/staging-contract.mjs"

const { baseURL } = stagingIntakeConfig(process.env)

export default defineConfig({
  testDir: "./tests/staging",
  timeout: 90_000,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    serviceWorkers: "block",
  },
  projects: [
    {
      name: "chromium-staging",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
})
