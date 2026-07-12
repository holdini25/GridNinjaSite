import { defineConfig, devices } from "@playwright/test"

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL
const baseURL = externalBaseURL ?? "http://127.0.0.1:3000"
const chromeExecutablePath = process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "test-results",
  timeout: 60_000,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [
        ["list"],
        ["html", { open: "never", outputFolder: "playwright-report" }],
        ["junit", { outputFile: "test-results/playwright-junit.xml" }],
      ]
    : [["list"], ["html", { open: "never" }]],
  expect: {
    timeout: 10_000,
  },
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
        timeout: 180_000,
        env: {
          NEXT_PUBLIC_TURNSTILE_SITE_KEY:
            process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ??
            "1x00000000000000000000AA",
        },
      },
  projects: [
    {
      name: "chrome-stable",
      use: {
        ...devices["Desktop Chrome"],
        ...(chromeExecutablePath
          ? { executablePath: chromeExecutablePath }
          : { channel: "chrome" as const }),
        viewport: { width: 1440, height: 1100 },
      },
    },
    {
      name: "chromium-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1100 },
      },
    },
    {
      name: "firefox-desktop",
      use: { ...devices["Desktop Firefox"], viewport: { width: 1440, height: 1100 } },
    },
    {
      name: "webkit-desktop",
      use: { ...devices["Desktop Safari"], viewport: { width: 1440, height: 1100 } },
    },
    {
      name: "chromium-mobile",
      use: {
        ...devices["Pixel 5"],
      },
    },
    {
      name: "webkit-mobile",
      use: {
        ...devices["iPhone 15"],
      },
    },
  ],
})
