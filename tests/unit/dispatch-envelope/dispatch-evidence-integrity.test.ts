import { describe, expect, it } from "vitest"
import fc from "fast-check"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { DispatchEquivalentDataTable } from "@/components/marketing/dispatch-envelope/dispatch-equivalent-data-table"
import { buildDispatchEvidenceRecord, dispatchScenarios, getDispatchDimensions, getScenarioProofEligible } from "@/content/copy/dispatch-envelope"
import { DISPATCH_DATASET_VERSION } from "@/lib/dispatch-envelope/constants"
import { compileIllustrativeDispatchEnvelope } from "@/lib/dispatch-envelope/compile-demo-envelope"
import { constraintLimitAt, DISPATCH_EPSILON, envelopeBreakpoints, envelopeEndMinute, envelopeMwAt } from "@/lib/dispatch-envelope/curves"
import { acceptedCurveViolations, dispatchProofEligibleAt, evaluateDispatchEvidence } from "@/lib/dispatch-envelope/evidence"
import { serializeDispatchEnvelopeExport } from "@/lib/dispatch-envelope/export"
import { assertDispatchEnvelopeInvariants } from "@/lib/dispatch-envelope/invariants"
import { buildEnvelopeSamples, getVisualizationEndMinute } from "@/lib/dispatch-envelope/normalize"
import { getProofLensSnapshotAtMinute } from "@/lib/dispatch-envelope/proof-lens"
import { DispatchEnvelopeDTOSchema } from "@/schemas/dispatch-envelope.schema"
import type { DispatchDomainConstraint, DispatchEnvelopeDTO, DomainId } from "@/types/dispatch-envelope"

function fixture(id = "grid-stress") {
  return structuredClone(dispatchScenarios.find((scenario) => scenario.id === id)!)
}

function domain(dto: DispatchEnvelopeDTO, id: DomainId) {
  return dto.constraints.find((constraint) => constraint.id === id)!
}

function updateEnd(dto: DispatchEnvelopeDTO) {
  dto.proofIntervals[0].endMinute = envelopeEndMinute(dto.accepted ?? dto.request)
}

describe("dispatch teaching dataset 2.0 consistency", () => {
  it.each([["grid-stress", "storage", 2.8], ["bridge-power", "bridge-power", 3.4]] as const)("catches the former %s minute-20 violation and preserves its corrected result", (id, domainId, mw) => {
    const scenario = fixture(id)
    const original = domain(scenario.dto, domainId)
    const samples = buildEnvelopeSamples(scenario.dto)
    const at20 = samples.find((sample) => sample.minute === 20)!
    expect(at20.acceptedMw).toBe(mw)
    expect(at20.limits[domainId]).toBe(mw)
    expect(at20.proofEligible).toBe(true)
    expect(getProofLensSnapshotAtMinute(samples, 20).margins[domainId]).toBe(0)
    original.limitSamples![2].maxMw = mw * 0.98
    const evaluation = evaluateDispatchEvidence(scenario.dto)
    expect(evaluation.issues).toContainEqual(expect.objectContaining({ reason: "mw-exceeded", domainId, minute: 20 }))
    expect(getScenarioProofEligible(scenario)).toBe(false)
    expect(buildDispatchEvidenceRecord(scenario).proof_eligible).toBe(false)
    expect(buildEnvelopeSamples(scenario.dto).every((sample) => !sample.proofEligible)).toBe(true)
    expect(() => serializeDispatchEnvelopeExport(scenario.dto)).toThrow(/exceeds/)
  })

  it("corrects the ALLOW fixture's hidden recovery contradictions without changing its MW or hold", () => {
    const { dto } = fixture("normal")
    expect(dto.accepted).toEqual(dto.request)
    expect(dto.accepted).toMatchObject({ maxMw: 3, holdMinutes: 15, recoveryMinutes: 9 })
    expect(evaluateDispatchEvidence(dto).eligible).toBe(true)
    dto.request.recoveryMinutes = 6
    dto.accepted!.recoveryMinutes = 6
    updateEnd(dto)
    expect(evaluateDispatchEvidence(dto).issues.filter((issue) => issue.reason === "scalar-limit").map((issue) => issue.domainId)).toEqual(["electrical", "storage", "cooling-water", "workload-sla", "telemetry-policy"])
    expect(() => assertDispatchEnvelopeInvariants(dto)).toThrow(/limits/)
  })

  it.each([
    ["maxMw", 2.9], ["maxHoldMinutes", 14], ["maxRampUpMwPerMin", 0.7],
    ["earliestStartMinute", 1], ["requiredRecoveryMinutes", 10], ["reboundLimitMw", 0.5],
  ] as const)("honors available critical domains' %s limit", (field, value) => {
    const { dto } = fixture("normal")
    const electrical = domain(dto, "electrical")
    expect(electrical.state).toBe("available")
    electrical[field] = value
    expect(evaluateDispatchEvidence(dto).issues).toContainEqual(expect.objectContaining({ reason: "scalar-limit", domainId: "electrical" }))
    expect(() => assertDispatchEnvelopeInvariants(dto)).toThrow(/electrical limits/)
  })

  it("finds a narrow dip between regular chart samples at its exact breakpoint", () => {
    const { dto } = fixture("normal")
    domain(dto, "storage").limitSamples = [[0, 3.6], [12, 3.6], [12.125, 2.5], [12.25, 3.6], [48, 3.6]].map(([minute, maxMw]) => ({ minute, maxMw, trusted: true }))
    expect(evaluateDispatchEvidence(dto).issues).toContainEqual(expect.objectContaining({ reason: "mw-exceeded", minute: 12.125 }))
    expect(buildEnvelopeSamples(dto).find((sample) => sample.minute === 12.125)?.limits.storage).toBe(2.5)
  })

  it("checks equality and floating-point tolerance without rounding away excess MW", () => {
    const { dto } = fixture()
    const storage = domain(dto, "storage")
    storage.limitSamples = [{ minute: 0, maxMw: 2.8, trusted: true }, { minute: 48, maxMw: 2.8, trusted: true }]
    expect(evaluateDispatchEvidence(dto).eligible).toBe(true)
    storage.limitSamples[0].maxMw = storage.limitSamples[1].maxMw = 2.8 - DISPATCH_EPSILON / 2
    expect(evaluateDispatchEvidence(dto).eligible).toBe(true)
    storage.limitSamples[0].maxMw = storage.limitSamples[1].maxMw = 2.8 - DISPATCH_EPSILON * 2
    expect(evaluateDispatchEvidence(dto).eligible).toBe(false)
  })

  it("preserves deterministic exports and stable scenario/wire identities while versioning authored data", () => {
    expect(DISPATCH_DATASET_VERSION).toBe("2.0.0")
    for (const scenario of dispatchScenarios) {
      expect(scenario.dto.schemaVersion).toBe("dispatch-envelope.v1")
      expect(scenario.dto.tapeId).toBe(`demo-tape-${scenario.id}-v2.0.0`)
      expect(scenario.dto.telemetryManifestId).toBe(`telemetry-manifest-${scenario.id}-v2.0.0`)
      expect(JSON.parse(serializeDispatchEnvelopeExport(scenario.dto))).toEqual(scenario.dto)
      expect(scenario.dto.constraints.every((constraint) => constraint.confidencePct === null && constraint.limitSamples!.every((point) => point.lowerConfidenceMw === undefined && point.upperConfidenceMw === undefined))).toBe(true)
    }
  })

  it("renders the exact minute-20 breakpoint and uncalibrated uncertainty in the equivalent table", () => {
    const scenario = fixture()
    const container = document.createElement("div")
    container.innerHTML = renderToStaticMarkup(createElement(DispatchEquivalentDataTable, {
      scenario, samples: buildEnvelopeSamples(scenario.dto), dimensions: getDispatchDimensions(scenario), artifacts: [],
    }))
    expect(container.querySelector('[data-testid="dispatch-table-sample-20"]')?.textContent).toContain("2.8 MW")
    expect(container.querySelector('[data-testid="dispatch-table-sample-20"]')?.textContent).toContain("eligible")
    expect(container.querySelector('[data-testid="dispatch-table-row-storage"]')?.textContent).toContain("Not calibrated")
  })
})

describe("evidence coverage, trust, and decision windows", () => {
  it.each(["start", "end"])("never extrapolates missing %s evidence", (side) => {
    const { dto } = fixture()
    const storage = domain(dto, "storage")
    storage.limitSamples = [{ minute: side === "start" ? 1 : 0, maxMw: 2.8, trusted: true }, { minute: side === "end" ? 30 : 48, maxMw: 2.8, trusted: true }]
    expect(constraintLimitAt(storage, side === "start" ? 0 : 38.5)).toBeNull()
    expect(evaluateDispatchEvidence(dto).issues.some((issue) => issue.reason === "missing-coverage")).toBe(true)
  })

  it("requires trusted recovery evidence but not evidence through the longer request or display padding", () => {
    const { dto } = fixture("bridge-power")
    for (const constraint of dto.constraints) constraint.limitSamples = [{ minute: 0, maxMw: constraint.maxMw, trusted: true }, { minute: 40, maxMw: constraint.maxMw, trusted: true }]
    const evaluation = evaluateDispatchEvidence(dto)
    expect(evaluation).toMatchObject({ eligible: true, decisionEndMinute: 40 })
    expect(envelopeEndMinute(dto.request)).toBe(41)
    expect(getVisualizationEndMinute(dto.request, dto.accepted)).toBe(45)
    expect(dispatchProofEligibleAt(evaluation, 40)).toBe(true)
    expect(dispatchProofEligibleAt(evaluation, 40.001)).toBe(false)
    expect(buildEnvelopeSamples(dto).filter((sample) => sample.minute > 40).every((sample) => !sample.proofEligible)).toBe(true)
    domain(dto, "storage").limitSamples![1].trusted = false
    expect(evaluateDispatchEvidence(dto).eligible).toBe(false)
  })

  it("combines parent trust with endpoint trust, including interpolation intervals", () => {
    const { dto } = fixture()
    const storage = domain(dto, "storage")
    storage.isTrusted = false
    expect(constraintLimitAt(storage, 20)?.trusted).toBe(false)
    expect(evaluateDispatchEvidence(dto).eligible).toBe(false)
    storage.isTrusted = true
    storage.limitSamples![2].trusted = false
    expect(constraintLimitAt(storage, 14)?.trusted).toBe(false)
    expect(evaluateDispatchEvidence(dto).issues).toContainEqual(expect.objectContaining({ reason: "untrusted", minute: 14 }))
  })

  it("keeps omitted curves as scalar limits without fabricated confidence bands", () => {
    const { dto } = fixture("normal")
    for (const constraint of dto.constraints) delete constraint.limitSamples
    expect(evaluateDispatchEvidence(dto).eligible).toBe(true)
    expect(constraintLimitAt(domain(dto, "storage"), 20)).toEqual({ minute: 20, maxMw: 3.6, trusted: true })
    expect(buildEnvelopeSamples(dto).every((sample) => Object.keys(sample.lowerConfidence).length === 0 && Object.keys(sample.upperConfidence).length === 0)).toBe(true)
  })

  it.each([[], [{ minute: 0, maxMw: 3, trusted: true }], [{ minute: 0, maxMw: 3, trusted: true }, { minute: 0, maxMw: 3, trusted: true }], [{ minute: 20, maxMw: 3, trusted: true }, { minute: 0, maxMw: 3, trusted: true }], [{ minute: 0, maxMw: Number.NaN, trusted: true }, { minute: 20, maxMw: 3, trusted: true }]])("rejects malformed supplied curves instead of falling back", (...points) => {
    const { dto } = fixture("normal")
    domain(dto, "storage").limitSamples = points as DispatchDomainConstraint["limitSamples"]
    expect(DispatchEnvelopeDTOSchema.safeParse(dto).success).toBe(false)
    expect(evaluateDispatchEvidence(dto).eligible).toBe(false)
    expect(constraintLimitAt(domain(dto, "storage"), 1)).toBeNull()
  })

  it("excludes noncritical domains from both the scalar compiler and controlling margin", () => {
    const { dto } = fixture("normal")
    const bridge = domain(dto, "bridge-power")
    Object.assign(bridge, { maxMw: 0, maxHoldMinutes: 0, maxRampUpMwPerMin: 0, earliestStartMinute: 100, requiredRecoveryMinutes: 100, reboundLimitMw: 0 })
    delete bridge.limitSamples
    expect(evaluateDispatchEvidence(dto).eligible).toBe(true)
    expect(buildEnvelopeSamples(dto).every((sample) => sample.bindingDomainId !== "bridge-power")).toBe(true)
    expect(compileIllustrativeDispatchEnvelope({ siteId: dto.siteId, scenarioId: dto.scenarioId, request: dto.request, constraints: dto.constraints }).decision).toBe("allow")
    dto.constraints.forEach((constraint) => { constraint.isDecisionCritical = false })
    expect(evaluateDispatchEvidence(dto).eligible).toBe(false)
  })
})

describe("rejection, missing proof, and degenerate capacity", () => {
  it("does not render eligible proof for contradictory decision, binding, or authority metadata", () => {
    const { dto } = fixture("normal")
    const cases: DispatchEnvelopeDTO[] = [
      { ...dto, decision: "repair" },
      { ...dto, authority: "signed-read-only" },
      { ...dto, constraints: dto.constraints.map((constraint) => constraint.id === "electrical" ? { ...constraint, state: "hard-block" } : constraint) },
      { ...fixture().dto, bindings: [{ ...fixture().dto.bindings[0], reasonCode: "WRONG" }] },
    ]
    for (const value of cases) {
      expect(evaluateDispatchEvidence(value).eligible).toBe(false)
      expect(() => serializeDispatchEnvelopeExport(value)).toThrow()
    }
  })

  it("exports legitimate rejection evidence without testing the rejected request for acceptance", () => {
    const { dto } = fixture("cooling-contingency")
    expect(dto.accepted).toBeNull()
    expect(dto.request.maxMw).toBeGreaterThan(domain(dto, "cooling-water").maxMw)
    expect(evaluateDispatchEvidence(dto).eligible).toBe(true)
    expect(() => serializeDispatchEnvelopeExport(dto)).not.toThrow()
    domain(dto, "storage").isTrusted = false
    expect(() => evaluateDispatchEvidence(dto)).not.toThrow()
    expect(evaluateDispatchEvidence(dto).eligible).toBe(false)
    expect(() => serializeDispatchEnvelopeExport(dto)).toThrow(/untrusted/)
  })

  it("preserves NO-PROOF as a null capacity record and an ineligible decision", () => {
    const scenario = fixture("telemetry-loss")
    expect(evaluateDispatchEvidence(scenario.dto).eligible).toBe(false)
    expect(buildEnvelopeSamples(scenario.dto).every((sample) => !sample.proofEligible)).toBe(true)
    expect(JSON.parse(serializeDispatchEnvelopeExport(scenario.dto)).accepted).toBeNull()
  })

  it("requires complete contiguous NO-PROOF windows while allowing explicitly unknown capacity", () => {
    const { dto } = fixture("telemetry-loss")
    const end = envelopeEndMinute(dto.request)
    const interval = dto.proofIntervals[0]
    const contiguous = [
      { ...interval, startMinute: 0, endMinute: 5, eligibility: "eligible" as const },
      { ...interval, startMinute: 5, endMinute: end, eligibility: "not-eligible" as const },
    ]
    dto.proofIntervals = contiguous
    expect(() => assertDispatchEnvelopeInvariants(dto)).not.toThrow()
    expect(JSON.parse(serializeDispatchEnvelopeExport(dto)).accepted).toBeNull()
    expect(evaluateDispatchEvidence(dto).eligible).toBe(false)
    for (const intervals of [
      [{ ...interval, startMinute: 1, endMinute: end }],
      [contiguous[0], { ...contiguous[1], startMinute: 6 }],
      [contiguous[0], { ...contiguous[1], startMinute: 4 }],
      [contiguous[1], contiguous[0]],
      [{ ...interval, startMinute: 0, endMinute: end - 1 }],
    ]) {
      dto.proofIntervals = intervals
      expect(() => assertDispatchEnvelopeInvariants(dto)).toThrow()
      expect(() => serializeDispatchEnvelopeExport(dto)).toThrow()
    }
  })

  it.each(["normal", "grid-stress"])("rejects zero-capacity success in %s while zero geometry stays finite", (id) => {
    const { dto } = fixture(id)
    Object.assign(dto.accepted!, { maxMw: 0, rampUpMwPerMin: 0, rampDownMwPerMin: 0 })
    if (dto.decision === "allow") dto.request = { ...dto.accepted! }
    updateEnd(dto)
    expect(envelopeMwAt(dto.accepted!, 10)).toBe(0)
    expect(envelopeBreakpoints(dto.accepted!).every(Number.isFinite)).toBe(true)
    expect(evaluateDispatchEvidence(dto).eligible).toBe(false)
    expect(() => assertDispatchEnvelopeInvariants(dto)).toThrow(/positive accepted envelope/)
  })

  it("detects arbitrary sub-MW depressions at authored breakpoints", () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 1000 }), (dropKW) => {
      const { dto } = fixture("normal")
      domain(dto, "storage").limitSamples = [{ minute: 0, maxMw: 3.6, trusted: true }, { minute: 12.125, maxMw: 3 - dropKW / 1000, trusted: true }, { minute: 48, maxMw: 3.6, trusted: true }]
      expect(evaluateDispatchEvidence(dto).issues).toContainEqual(expect.objectContaining({ reason: "mw-exceeded", minute: 12.125 }))
    }))
  })

  it("keeps the illustrative compiler bounded instead of inventing repairs or rejection evidence", () => {
    const { dto } = fixture("normal")
    const input = { siteId: dto.siteId, scenarioId: dto.scenarioId, request: dto.request, constraints: dto.constraints }
    expect(() => compileIllustrativeDispatchEnvelope({ ...input, request: { ...dto.request, maxMw: 0 } })).toThrow(/positive requested/)
    domain(dto, "storage").maxMw = 0
    expect(() => compileIllustrativeDispatchEnvelope(input)).toThrow(/authored trusted hard block/)
    domain(dto, "storage").maxMw = 3.6
    domain(dto, "storage").limitSamples = [{ minute: 0, maxMw: 3.6, trusted: true }, { minute: 12.125, maxMw: 2.5, trusted: true }, { minute: 48, maxMw: 3.6, trusted: true }]
    expect(() => compileIllustrativeDispatchEnvelope(input)).toThrow(/curve/)
  })
})


describe("unvalidated dispatch input fails closed", () => {
  it.each(["maxMw", "maxHoldMinutes", "maxRampUpMwPerMin", "earliestStartMinute", "requiredRecoveryMinutes", "reboundLimitMw"] as const)("rejects malformed %s in every domain, including noncritical domains", (field) => {
    for (const id of ["electrical", "bridge-power"] as const) for (const value of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
      const { dto } = fixture("normal")
      domain(dto, id)[field] = value
      expect(evaluateDispatchEvidence(dto).eligible).toBe(false)
      expect(() => assertDispatchEnvelopeInvariants(dto)).toThrow()
      expect(() => serializeDispatchEnvelopeExport(dto)).toThrow()
    }
  })

  it.each(["normal", "telemetry-loss"])("validates supplied noncritical curves even for %s", (id) => {
    const { dto } = fixture(id)
    const bridge = domain(dto, "bridge-power")
    bridge.isDecisionCritical = false
    bridge.limitSamples = [{ minute: 0, maxMw: 3, trusted: true }, { minute: 0, maxMw: 3, trusted: true }]
    expect(evaluateDispatchEvidence(dto)).toMatchObject({ eligible: false, issues: [expect.objectContaining({ reason: "invalid-curve" })] })
    expect(() => assertDispatchEnvelopeInvariants(dto)).toThrow(/strictly increasing/)
    expect(() => serializeDispatchEnvelopeExport(dto)).toThrow()
  })

  it("rejects unknown decisions and invalid metadata before evaluating evidence", () => {
    const { dto } = fixture("cooling-contingency")
    for (const value of [{ ...dto, decision: "approved" }, { ...dto, authority: "live-control" }, { ...dto, evidenceClass: "operational" }, { ...dto, signature: "ed25519:" }, null]) {
      expect(() => evaluateDispatchEvidence(value as DispatchEnvelopeDTO)).not.toThrow()
      expect(evaluateDispatchEvidence(value as DispatchEnvelopeDTO).eligible).toBe(false)
      expect(() => serializeDispatchEnvelopeExport(value)).toThrow()
    }
  })

  it("rejects malformed confidence bounds without presenting a usable curve", () => {
    for (const bounds of [{ lowerConfidenceMw: 2 }, { lowerConfidenceMw: 4, upperConfidenceMw: 5 }, { lowerConfidenceMw: 2, upperConfidenceMw: Number.NaN }, { lowerConfidenceMw: -1, upperConfidenceMw: 5 }]) {
      const { dto } = fixture("normal")
      const constraint = domain(dto, "storage")
      Object.assign(constraint.limitSamples![0], bounds)
      expect(evaluateDispatchEvidence(dto).eligible).toBe(false)
      expect(constraintLimitAt(constraint, 0)).toBeNull()
      expect(() => serializeDispatchEnvelopeExport(dto)).toThrow()
    }
  })

  it("rejects absent geometry fields and timing overflow in the pure helpers", () => {
    const { dto } = fixture("normal")
    const absentRamp = { ...dto.request }
    delete (absentRamp as Partial<typeof absentRamp>).rampUpMwPerMin
    expect(() => envelopeBreakpoints(absentRamp)).toThrow(/finite/)
    expect(() => envelopeMwAt(absentRamp, 1)).toThrow(/finite/)
    expect(() => envelopeBreakpoints({ ...dto.request, rampUpMwPerMin: Number.MIN_VALUE })).toThrow(/timing must be finite/)
    expect(() => envelopeMwAt(dto.request, Number.NaN)).toThrow(/minute must be finite/)
    expect(dispatchProofEligibleAt(evaluateDispatchEvidence(dto), Number.NaN)).toBe(false)
  })
})


describe("acceptedCurveViolations public contract", () => {
  it.each([["grid-stress", "storage", 2.8], ["bridge-power", "bridge-power", 3.4]] as const)("reports the former %s violation using shared evidence math", (id, domainId, mw) => {
    const { dto } = fixture(id)
    expect(acceptedCurveViolations(dto)).toEqual([])
    domain(dto, domainId).limitSamples![2].maxMw = mw * 0.98
    const violations = acceptedCurveViolations(dto)
    expect(violations).toContainEqual(expect.objectContaining({ reason: "mw-exceeded", domainId, minute: 20 }))
    expect(violations).toEqual(evaluateDispatchEvidence(dto).issues.filter((issue) => issue.reason === "mw-exceeded"))
  })

  it("reports exact narrow dips, missing recovery coverage, and untrusted interpolation", () => {
    const { dto } = fixture("normal")
    const storage = domain(dto, "storage")
    storage.limitSamples = [[0, 3.6], [12, 3.6], [12.125, 2.5], [12.25, 3.6], [30, 3.6]].map(([minute, maxMw]) => ({ minute, maxMw, trusted: true }))
    expect(acceptedCurveViolations(dto)).toContainEqual(expect.objectContaining({ reason: "mw-exceeded", domainId: "storage", minute: 12.125 }))
    expect(acceptedCurveViolations(dto)).toContainEqual(expect.objectContaining({ reason: "missing-coverage", domainId: "storage", minute: 32 }))
    storage.limitSamples[2].trusted = false
    expect(acceptedCurveViolations(dto)).toContainEqual(expect.objectContaining({ reason: "untrusted", domainId: "storage", minute: 12.0625 }))
    expect(acceptedCurveViolations(dto).every((violation) => typeof violation.domainId === "string" && Number.isFinite(violation.minute))).toBe(true)
  })

  it.each(["cooling-contingency", "telemetry-loss"])("has no accepted-curve violations for legitimate null-capacity %s", (id) => {
    const { dto } = fixture(id)
    expect(acceptedCurveViolations(dto)).toEqual([])
    expect(() => serializeDispatchEnvelopeExport(dto)).not.toThrow()
  })

  it("does not confuse curve-only diagnostics with proof eligibility or conceal malformed inputs", () => {
    const { dto } = fixture("normal")
    domain(dto, "storage").requiredRecoveryMinutes = 10
    expect(acceptedCurveViolations(dto)).toEqual([])
    expect(evaluateDispatchEvidence(dto).eligible).toBe(false)
    domain(dto, "storage").maxHoldMinutes = Number.NaN
    expect(() => acceptedCurveViolations(dto)).toThrow(/Cannot evaluate accepted curve/)
    const missingProof = fixture("telemetry-loss").dto
    domain(missingProof, "bridge-power").limitSamples = []
    expect(() => acceptedCurveViolations(missingProof)).toThrow(/Cannot evaluate accepted curve/)
  })
})
