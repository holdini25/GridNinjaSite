import { defineConfig, devices } from "@playwright/test"

const baseURL = process.env.STAGING_BASE_URL

if (!baseURL) {
  throw new Error("STAGING_BASE_URL is required for the contact staging canary.")
}

export default defineConfig({
  testDir: "./tests/staging",
  timeout: 90_000,
  retries: 1,
  reporter: [["list"]],
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

