import { defineConfig, devices } from "@playwright/test"
import { stagingIntakeConfig } from "./scripts/qa/staging-contract.mjs"

// Playwright's failure DOM snapshot is independent of trace/screenshot capture.
// Set this before workers and fixtures start; recipient data must stay private.
process.env.PLAYWRIGHT_NO_COPY_PROMPT = "1"

const { baseURL } = stagingIntakeConfig(process.env)

export default defineConfig({
  testDir: "./tests/staging",
  timeout: 90_000,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "off",
    screenshot: "off",
    video: "off",
    serviceWorkers: "block",
  },
  projects: [
    {
      name: "chromium-staging",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
})
