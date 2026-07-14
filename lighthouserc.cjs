const releaseCandidate = process.env.LHCI_RELEASE_CANDIDATE === "1"

module.exports = {
  ci: {
    collect: {
      numberOfRuns: releaseCandidate ? 5 : 3,
      startServerCommand:
        "npm run start -- --hostname 127.0.0.1 --port 3000",
      startServerReadyPattern: "Ready in|Local:",
      startServerReadyTimeout: 120000,
      url: [
        "http://127.0.0.1:3000/",
        "http://127.0.0.1:3000/platform",
        "http://127.0.0.1:3000/proof",
        "http://127.0.0.1:3000/roi",
        "http://127.0.0.1:3000/insights",
      ],
      settings: {
        budgetPath: "./lighthouse/budgets.json",
        chromeFlags: "--headless --no-sandbox",
        preset: "desktop",
      },
    },
    assert: {
      assertions: {
        "categories:seo": ["error", { minScore: 1, aggregationMethod: "median-run" }],
        "categories:accessibility": ["error", { minScore: 0.95, aggregationMethod: "median-run" }],
        "categories:best-practices": ["error", { minScore: 0.95, aggregationMethod: "median-run" }],
        "categories:performance": ["error", { minScore: 0.9, aggregationMethod: "median-run" }],
        "largest-contentful-paint": ["error", { maxNumericValue: 2500, aggregationMethod: "median-run" }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1, aggregationMethod: "median-run" }],
        "total-blocking-time": ["error", { maxNumericValue: 200, aggregationMethod: "median-run" }],
        "first-contentful-paint": ["error", { maxNumericValue: 1800, aggregationMethod: "median-run" }],
      },
    },
    upload: {
      target: "filesystem",
      outputDir: "./test-results/lighthouse",
    },
  },
}
