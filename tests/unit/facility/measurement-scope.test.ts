// @vitest-environment node
import { describe, expect, it } from "vitest"
import { assertQualificationScope, measurementScope } from "../../../scripts/facility/measurement-scope.mjs"

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
