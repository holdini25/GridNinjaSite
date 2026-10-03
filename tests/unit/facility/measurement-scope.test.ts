// @vitest-environment node
import { describe, expect, it } from "vitest"
import { assertQualificationScope, assertSoftwareAcquisition, measurementScope } from "../../../scripts/facility/measurement-scope.mjs"

describe("functional CI cannot masquerade as device performance", () => {
  it("keeps qualification as the default and its report path unchanged", () => {
    expect(measurementScope()).toEqual({ name: "qualification", functional: false, output: "build/facility/page-measurements.json", hardwareQualification: "required" })
  })
  it("isolates functional output and explicitly records missing hardware qualification", () => {
    expect(measurementScope("ci-functional")).toEqual({ name: "ci-functional", functional: true, output: "build/facility/ci-functional-measurements.json", hardwareQualification: "not-performed" })
    expect(() => assertQualificationScope({ measurementScope: "ci-functional" })).toThrow("cannot qualify device performance")
  })
  it("fails closed on a misspelled or unsupported scope", () => {
    expect(() => measurementScope("software-pass")).toThrow("Unknown")
    expect(() => measurementScope("")).toThrow("Unknown")
  })
})


describe("software poster acquisition accounting", () => {
  const valid = () => ({
    automaticAcquisition: { kind: "poster", reason: "software", graphics: "software" },
    throughReady: false, manualThroughReady: true, renderingClass: "software-emulation",
    automaticTransfer: { complete: true, bytes: 400_000, requests: [{ url: "https://gridninja.example/poster.webp" }] },
    transfer: { complete: true, bytes: 1_400_000 },
  })
  it("accepts complete automatic poster bytes and separately verified manual software rendering", () => {
    expect(() => assertSoftwareAcquisition(valid())).not.toThrow()
  })
  it("rejects automatic model acquisition, missing manual coverage and misleading hardware/readiness claims", () => {
    for (const mutate of [
      (r: ReturnType<typeof valid>) => { r.automaticTransfer.requests.push({ url: "https://gridninja.example/facility.glb" }) },
      (r: ReturnType<typeof valid>) => { r.manualThroughReady = false },
      (r: ReturnType<typeof valid>) => { r.throughReady = true },
      (r: ReturnType<typeof valid>) => { r.renderingClass = "hardware" },
      (r: ReturnType<typeof valid>) => { r.transfer.bytes = 1 },
      (r: ReturnType<typeof valid>) => { r.automaticTransfer.complete = false },
      (r: ReturnType<typeof valid>) => { r.transfer.complete = false },
    ]) { const result = valid(); mutate(result); expect(() => assertSoftwareAcquisition(result)).toThrow() }
  })
})
