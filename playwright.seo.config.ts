import { defineConfig, devices } from "@playwright/test"

const externalBaseURL = process.env.SEO_TEST_BASE_URL
const baseURL = externalBaseURL ?? "http://127.0.0.1:3000"

export default defineConfig({
  testDir: "./tests/seo",
  outputDir: "test-results/seo",
  timeout: 90_000,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [
        ["list"],
        ["html", { open: "never", outputFolder: "playwright-report/seo" }],
        ["junit", { outputFile: "test-results/seo-junit.xml" }],
      ]
    : [["list"], ["html", { open: "never", outputFolder: "playwright-report/seo" }]],
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: externalBaseURL
    ? undefined
    : {
        command: "npm run build && npm run start -- --hostname 127.0.0.1",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
        env: {
          NEXT_PUBLIC_TURNSTILE_SITE_KEY:
            process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ??
            "1x00000000000000000000AA",
        },
      },
  projects: [
    {
      name: "seo-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1100 },
      },
    },
    {
      name: "seo-raw-html",
      use: {
        ...devices["Desktop Chrome"],
        javaScriptEnabled: false,
        viewport: { width: 1440, height: 1100 },
      },
    },
    {
      name: "seo-googlebot-smartphone",
      use: {
        ...devices["Pixel 5"],
        userAgent:
          "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) " +
          "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile " +
          "Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      },
    },
    {
      name: "seo-reduced-motion",
      use: {
        ...devices["Desktop Chrome"],
        contextOptions: { reducedMotion: "reduce" },
        viewport: { width: 1440, height: 1100 },
      },
    },
  ],
})
