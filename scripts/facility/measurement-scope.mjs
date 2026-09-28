import assert from "node:assert/strict"

/** CI software rendering proves behavior and transfer, never device cadence. */
export function measurementScope(value = "qualification") {
  assert(["qualification", "ci-functional"].includes(value), "Unknown facility measurement scope")
  const functional = value === "ci-functional"
  return Object.freeze({
    name: value, functional,
    output: `build/facility/${functional ? "ci-functional-measurements" : "page-measurements"}.json`,
    hardwareQualification: functional ? "not-performed" : "required",
  })
}

export function assertQualificationScope(settings) {
  assert.notEqual(settings?.measurementScope, "ci-functional", "CI functional evidence cannot qualify device performance")
}
