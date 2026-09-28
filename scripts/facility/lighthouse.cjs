// collect-lighthouse.mjs applies this contract using five separate temporary
// Chrome profiles for each route/device pair and records build provenance.
const mobile = process.env.LHCI_FORM_FACTOR === "mobile"
// Lighthouse CI loads this entry point as CommonJS; Node 22 supports this ESM import.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { routeTransferBudget } = require("../../src/lib/cinematic/performance.mjs")
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { selectedCinematicReleaseId } = require("../../src/lib/cinematic/selection.mjs")
const profile = mobile ? "mobile" : "desktop"
const buildSettings = { cinematic: { selectedRelease: selectedCinematicReleaseId() || null } }
const assertions = {
  "categories:performance":["error",{minScore:.9,aggregationMethod:"median-run"}],
  "categories:accessibility":["error",{minScore:.95,aggregationMethod:"median-run"}],
  "categories:best-practices":["error",{minScore:.95,aggregationMethod:"median-run"}],
  "largest-contentful-paint":["error",{maxNumericValue:2500,aggregationMethod:"median-run"}],
  "cumulative-layout-shift":["error",{maxNumericValue:.1,aggregationMethod:"median-run"}],
  "total-blocking-time":["error",{maxNumericValue:200,aggregationMethod:"median-run"}],
  "first-contentful-paint":["error",{maxNumericValue:1800,aggregationMethod:"median-run"}],
  "heading-order":["error",{minScore:1,aggregationMethod:"pessimistic"}],
  "color-contrast":["error",{minScore:1,aggregationMethod:"pessimistic"}],
}
module.exports = {
  ci: {
    collect: {
      numberOfRuns: 5,
      url: [`${process.env.FACILITY_BASE_URL ?? "http://localhost:3000"}/`, `${process.env.FACILITY_BASE_URL ?? "http://localhost:3000"}/demo`],
      settings: {chromeFlags:"--headless", maxWaitForLoad: 45_000, ...(mobile?{formFactor:"mobile"}:{preset:"desktop"})},
    },
    assert: {
      assertMatrix: [
        { matchingUrlPattern: "^https?://[^/]+/(?:\\?.*)?$", assertions: { ...assertions, "total-byte-weight": ["error", { maxNumericValue: routeTransferBudget("/", profile, buildSettings), aggregationMethod: "pessimistic" }] } },
        { matchingUrlPattern: "^https?://[^/]+/[^?#].*", assertions: { ...assertions, "total-byte-weight": ["error", { maxNumericValue: routeTransferBudget("/demo", profile, buildSettings), aggregationMethod: "pessimistic" }] } },
      ],
    },
    upload:{target:"filesystem",outputDir:`build/facility/lighthouse-${mobile?"mobile":"desktop"}`},
  },
}
