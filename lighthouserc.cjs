const releaseCandidate = process.env.LHCI_RELEASE_CANDIDATE === "1"

const commonAssertions = {
  "categories:accessibility": ["error", { minScore: 0.95, aggregationMethod: "median-run" }],
  "categories:best-practices": ["error", { minScore: 0.95, aggregationMethod: "median-run" }],
  "categories:performance": ["error", { minScore: 0.9, aggregationMethod: "median-run" }],
  "largest-contentful-paint": ["error", { maxNumericValue: 2500, aggregationMethod: "median-run" }],
  "cumulative-layout-shift": ["error", { maxNumericValue: 0.1, aggregationMethod: "median-run" }],
  "total-blocking-time": ["error", { maxNumericValue: 200, aggregationMethod: "median-run" }],
  "first-contentful-paint": ["error", { maxNumericValue: 1800, aggregationMethod: "median-run" }],
  "heading-order": ["error", { minScore: 1, aggregationMethod: "pessimistic" }],
  "color-contrast": ["error", { minScore: 1, aggregationMethod: "pessimistic" }],
}

const insightArticlePattern =
  "^https?://[^/]+/insights/virtual-capacity-control-plane/?$"
const indexableRoutePattern =
  "^(?!https?://[^/]+/insights/virtual-capacity-control-plane/?$).*$"

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
        "http://127.0.0.1:3000/insights/virtual-capacity-control-plane",
      ],
      settings: {
        chromeFlags: "--headless --no-sandbox",
        preset: "desktop",
      },
    },
    assert: {
      assertMatrix: [
        {
          matchingUrlPattern: indexableRoutePattern,
          assertions: {
            ...commonAssertions,
            "categories:seo": ["error", { minScore: 1, aggregationMethod: "median-run" }],
          },
        },
        {
          matchingUrlPattern: insightArticlePattern,
          assertions: commonAssertions,
        },
      ],
    },
    upload: {
      target: "filesystem",
      outputDir: "./test-results/lighthouse",
    },
  },
}
