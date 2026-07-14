import { describe, expect, it } from "vitest"

import {
  LIGHTHOUSE_RESOURCE_BUDGETS,
  validateLighthouseReport,
  validateLighthouseReports,
} from "../../../scripts/seo/validate-lighthouse-budgets.mjs"

function makeReport(
  path = "/",
  overrides: {
    total?: number
    font?: number
    script?: number
    image?: number
  } = {}
) {
  return {
    lighthouseVersion: "13.0.0",
    finalUrl: `http://127.0.0.1:3000${path}`,
    audits: {
      "resource-summary": {
        details: {
          items: [
            {
              resourceType: "total",
              transferSize:
                overrides.total ?? LIGHTHOUSE_RESOURCE_BUDGETS.totalBytes,
            },
            {
              resourceType: "font",
              transferSize:
                overrides.font ?? LIGHTHOUSE_RESOURCE_BUDGETS.fontBytes,
            },
            {
              resourceType: "script",
              transferSize:
                overrides.script ??
                LIGHTHOUSE_RESOURCE_BUDGETS.insightScriptBytes,
            },
          ],
        },
      },
      "network-requests": {
        details: {
          items: [
            {
              resourceType: "Image",
              transferSize:
                overrides.image ?? LIGHTHOUSE_RESOURCE_BUDGETS.largestImageBytes,
            },
          ],
        },
      },
    },
  }
}

describe("Lighthouse resource budgets", () => {
  it("accepts values exactly at each budget", () => {
    expect(
      validateLighthouseReport(
        makeReport("/insights/virtual-capacity-control-plane")
      )
    ).toEqual([])
  })

  it("reports route-specific transfer overruns", () => {
    const violations = validateLighthouseReport(
      makeReport("/insights/virtual-capacity-control-plane", {
        total: LIGHTHOUSE_RESOURCE_BUDGETS.totalBytes + 1,
        font: LIGHTHOUSE_RESOURCE_BUDGETS.fontBytes + 1,
        script: LIGHTHOUSE_RESOURCE_BUDGETS.insightScriptBytes + 1,
        image: LIGHTHOUSE_RESOURCE_BUDGETS.largestImageBytes + 1,
      })
    )

    expect(violations).toHaveLength(4)
    expect(violations.every((message: string) => message.startsWith("/insights/"))).toBe(true)
  })

  it("fails closed when required resource measurements are missing", () => {
    const report = makeReport("/insights/virtual-capacity-control-plane")
    report.audits["resource-summary"].details.items = []

    expect(validateLighthouseReport(report)).toEqual([
      "/insights/virtual-capacity-control-plane: resource summary is missing total transferSize",
      "/insights/virtual-capacity-control-plane: resource summary is missing font transferSize",
      "/insights/virtual-capacity-control-plane: resource summary is missing script transferSize",
    ])
  })

  it("requires the configured sample count for every route", () => {
    expect(
      validateLighthouseReports([makeReport("/")], {
        expectedUrls: [
          "http://127.0.0.1:3000/",
          "http://127.0.0.1:3000/platform",
        ],
        numberOfRuns: 2,
      })
    ).toEqual([
      "/: expected at least 2 Lighthouse reports, received 1",
      "/platform: expected at least 2 Lighthouse reports, received 0",
    ])
  })
})
