// @vitest-environment node
import { expect, it } from "vitest"
import { captureCases } from "../../../scripts/qa/offline-facility-capture.mjs"
import { estimateOfflineFramebuffer } from "../../../scripts/qa/offline-adopt-posters.mjs"
import { rackServiceCommandError } from "@/lib/facility/rack-service-view"
import { rackTarget } from "@/lib/facility/rack-motion"
import type { FacilityView } from "@/types/facility"

const manifest = { profile: { inspection: { details: { "air-path": {} } } }, specimens: { rack: {}, cooling: {} } }
it("the private contact sequence obeys existing detail-entry mechanical guards", () => {
  let current: FacilityView = { kind: "overview" }
  let joints: { door: number; tray: number; moving: boolean } | null = null
  const cases = captureCases("contact", "mobile-native", manifest)
  expect(cases.map(item => item.id)).toEqual(["neutral", "air-path", "rack-closed", "rack-service", "rack-service-cutaway", "rack-service-connection", "cooling-closed"])
  for (const item of cases) {
    const requested = item.view as FacilityView
    expect(rackServiceCommandError(requested, current, null, joints, true), item.id).toBeNull()
    current = requested
    if (current.kind === "specimen" && current.specimen === "rack") {
      const target = rackTarget(current)
      joints = { door: Number(target.door === "open"), tray: Number(target.tray === "extended"), moving: false }
    } else joints = null
  }
})
it("retains the thirteen release references and rejects an unknown private capture scope", () => {
  expect(captureCases("release", "desktop-poster", manifest)).toHaveLength(11)
  expect(captureCases("release", "mobile-native", manifest)).toHaveLength(1)
  expect(captureCases("release", "mobile-supersampled", manifest)).toHaveLength(1)
  expect(() => captureCases("unbounded", "mobile-native", manifest)).toThrow()
})
it("separates offline MSAA framebuffer estimates from the asset allocation gate", () => {
  const estimate = estimateOfflineFramebuffer({ drawingBuffer: [1360, 800], graphics: { samples: 4, antialias: true } })
  expect(estimate.estimatedBytes).toBe(39_168_000)
  expect(estimate.measuredDepthBits).toBeNull(); expect(estimate.measuredStencilBits).toBeNull()
  expect(estimate.estimatedMiB).toBeCloseTo(37.3535, 3)
  expect(estimateOfflineFramebuffer({ drawingBuffer: [680, 510], graphics: { samples: 0, antialias: false } }).estimatedBytes).toBe(680 * 510 * 8)
})
