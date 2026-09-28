import { describe, expect, it } from "vitest"
import { routeTransferBudget } from "@/lib/cinematic/performance.mjs"
import { assertCompleteTransfer } from "../../../scripts/facility/performance-contract.mjs"

describe("route-specific cinematic budgets", () => {
  const buildSettings = { cinematic: { selectedRelease: "cinematic-v1", mode: "auto" } }
  it("confines the new cap to the selected cinematic homepage and known profiles", () => {
    expect(routeTransferBudget("/", "desktop", buildSettings)).toBe(4_194_304)
    expect(routeTransferBudget("/", "mobile-emulation", buildSettings)).toBe(2_097_152)
    expect(routeTransferBudget("/demo", "desktop", buildSettings)).toBe(1_572_864)
    expect(routeTransferBudget("/assessment", "mobile", buildSettings)).toBe(1_572_864)
    expect(routeTransferBudget("/", "desktop", {})).toBe(1_572_864)
    expect(routeTransferBudget("/", "unknown", buildSettings)).toBe(1_572_864)
  })
  it("still rejects incomplete transfers and exceeding the selected cap", () => {
    const context = { route: "/", profile: "mobile", buildSettings }
    expect(() => assertCompleteTransfer({ complete: true, issues: [], bytes: 2_097_152 }, context)).not.toThrow()
    expect(() => assertCompleteTransfer({ complete: true, issues: [], bytes: 2_097_153 }, context)).toThrow("exceeds")
    expect(() => assertCompleteTransfer({ complete: false, issues: ["aborted"], bytes: 1024 }, context)).toThrow("incomplete")
  })
})
