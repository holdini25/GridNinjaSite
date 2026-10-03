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

/** Software startup is a poster path; a later native click must be accounted
 * separately and never relabelled as automatic readiness or device evidence. */
export function assertSoftwareAcquisition(result) {
  assert.equal(result.automaticAcquisition?.kind, "poster")
  assert.equal(result.automaticAcquisition?.reason, "software")
  assert.equal(result.automaticAcquisition?.graphics, "software")
  assert.equal(result.throughReady, false, "Software fallback cannot claim automatic 3D readiness")
  assert.equal(result.manualThroughReady, true, "Manual 3D functionality was not verified")
  assert.equal(result.renderingClass, "software-emulation", "Fallback disagrees with actual renderer")
  assert(result.automaticTransfer?.complete && Number.isFinite(result.automaticTransfer.bytes), "Missing complete automatic transfer")
  assert(Array.isArray(result.automaticTransfer.requests), "Missing automatic request inventory")
  assert(!result.automaticTransfer.requests.some(request => /\.glb$/.test(new URL(request.url).pathname)), "Software fallback downloaded a model automatically")
  assert(result.transfer?.complete && result.transfer.bytes >= result.automaticTransfer.bytes, "Manual transfer omitted automatic bytes")
}
