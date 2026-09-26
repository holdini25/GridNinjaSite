// collect-lighthouse.mjs applies this contract using five separate temporary
// Chrome profiles for each route/device pair and records build provenance.
const mobile = process.env.LHCI_FORM_FACTOR === "mobile"
module.exports = {
  ci: {
    collect: {
      numberOfRuns: 5,
      url: [`${process.env.FACILITY_BASE_URL ?? "http://localhost:3000"}/`, `${process.env.FACILITY_BASE_URL ?? "http://localhost:3000"}/demo`],
      settings: {chromeFlags:"--headless", maxWaitForLoad: 45_000, ...(mobile?{formFactor:"mobile"}:{preset:"desktop"})},
    },
    assert: {
      assertions: {
        "categories:performance":["error",{minScore:.9,aggregationMethod:"median-run"}],
        "categories:accessibility":["error",{minScore:.95,aggregationMethod:"median-run"}],
        "categories:best-practices":["error",{minScore:.95,aggregationMethod:"median-run"}],
        "largest-contentful-paint":["error",{maxNumericValue:2500,aggregationMethod:"median-run"}],
        "cumulative-layout-shift":["error",{maxNumericValue:.1,aggregationMethod:"median-run"}],
        "total-blocking-time":["error",{maxNumericValue:200,aggregationMethod:"median-run"}],
        "first-contentful-paint":["error",{maxNumericValue:1800,aggregationMethod:"median-run"}],
        "heading-order":["error",{minScore:1,aggregationMethod:"pessimistic"}],
        "color-contrast":["error",{minScore:1,aggregationMethod:"pessimistic"}],
        "total-byte-weight":["error",{maxNumericValue:1_572_864,aggregationMethod:"pessimistic"}],
      },
    },
    upload:{target:"filesystem",outputDir:`build/facility/lighthouse-${mobile?"mobile":"desktop"}`},
  },
}
