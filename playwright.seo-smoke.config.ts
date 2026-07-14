import { defineConfig, devices } from "@playwright/test"

const baseURL = process.env.SEO_SMOKE_BASE_URL

if (!baseURL) {
  throw new Error("SEO_SMOKE_BASE_URL is required for deployment SEO smoke tests.")
}

export default defineConfig({
  testDir: "./tests/seo-smoke",
  outputDir: "test-results/seo-smoke",
  timeout: 90_000,
  retries: 1,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report/seo-smoke" }],
    ["junit", { outputFile: "test-results/seo-smoke-junit.xml" }],
  ],
  use: {
    baseURL,
    ...devices["Pixel 5"],
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [{ name: "seo-deployment-smoke" }],
})

