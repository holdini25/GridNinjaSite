import { describe, expect, it } from "vitest"
import fc from "fast-check"

import { DispatchEnvelopeDTOSchema } from "@/schemas/dispatch-envelope.schema"
import {
  dispatchScenarios,
  getDispatchDimensions,
  getOrderedConstraints,
} from "@/content/copy/dispatch-envelope"
import { DISPATCH_DOMAIN_IDS } from "@/lib/dispatch-envelope/constants"
import { assertDispatchEnvelopeInvariants } from "@/lib/dispatch-envelope/invariants"
import { compileIllustrativeDispatchEnvelope } from "@/lib/dispatch-envelope/compile-demo-envelope"
import { buildEnvelopeSamples } from "@/lib/dispatch-envelope/normalize"
import {
  buildDispatchEnvelopeGeometry,
  compactTicks,
} from "@/lib/dispatch-envelope/geometry"
import { sanitizeDispatchExportFilename, serializeDispatchEnvelopeExport } from "@/lib/dispatch-envelope/export"
import { getProofLensSnapshotAtMinute } from "@/lib/dispatch-envelope/proof-lens"
import { rankConstraints } from "@/lib/dispatch-envelope/binding-rank"
import type {
  ConstraintState,
  DispatchDomainConstraint,
  DispatchEnvelopeDTO,
  DispatchEnvelopeSpec,
  DomainId,
} from "@/types/dispatch-envelope"

const baseRequest: DispatchEnvelopeSpec = {
  startMinute: 0,
  rampUpMwPerMin: 1,
  maxMw: 3,
  holdMinutes: 12,
  rampDownMwPerMin: 1,
  recoveryMinutes: 6,
  reboundLimitMw: 0.6,
}

describe("dispatch envelope DTO fixtures", () => {
  it("validates every fixture and preserves canonical domain ids", () => {
    for (const scenario of dispatchScenarios) {
      expect(() => DispatchEnvelopeDTOSchema.parse(scenario.dto)).not.toThrow()
      expect(() => assertDispatchEnvelopeInvariants(scenario.dto)).not.toThrow()
      expect(scenario.dto.constraints.map((constraint) => constraint.id)).toEqual(
        DISPATCH_DOMAIN_IDS
      )
      expect(
        scenario.dto.constraints.some((constraint) =>
          ["cooling", "bridge", "workload", "trust"].includes(constraint.id)
        )
      ).toBe(false)
    }
  })

  it("never emits accepted capacity for reject or no-proof fixtures", () => {
    const rejected = dispatchScenarios.find(
      (scenario) => scenario.dto.decision === "reject"
    )
    const noProof = dispatchScenarios.find(
      (scenario) => scenario.dto.decision === "no-proof"
    )

    expect(rejected?.dto.accepted).toBeNull()
    expect(noProof?.dto.accepted).toBeNull()
  })

  it("reports all six dimension audit rows", () => {
    const rows = getDispatchDimensions(dispatchScenarios[0])

    expect(rows.map((row) => row.id)).toEqual([
      "mw",
      "hold",
      "ramp-up",
      "start",
      "recovery",
      "rebound",
    ])
  })

  it("marks repaired, blocked, and no-proof dimension audit states explicitly", () => {
    const repaired = getDispatchDimensions(scenarioById("grid-stress"))
    const allowed = getDispatchDimensions(scenarioById("normal"))
    const rejected = getDispatchDimensions(scenarioById("cooling-contingency"))
    const noProof = getDispatchDimensions(scenarioById("telemetry-loss"))

    expect(repaired).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "mw",
          requested: "4.0 MW",
          accepted: "2.8 MW",
          bindingSource: "UPS_RESERVE_FLOOR",
          status: "repaired",
        }),
        expect.objectContaining({
          id: "start",
          requested: "T+0",
          accepted: "T+1",
          bindingSource: "COOLING_SAFE_START",
          status: "repaired",
        }),
      ])
    )
    expect(allowed.every((row) => row.status === "clear")).toBe(true)
    expect(allowed.every((row) => row.bindingSource === "No binding repair")).toBe(
      true
    )
    expect(rejected.every((row) => row.status === "blocked")).toBe(true)
    expect(rejected.every((row) => row.accepted === "-")).toBe(true)
    expect(noProof.every((row) => row.status === "no-proof")).toBe(true)
    expect(noProof.every((row) => row.accepted === "-")).toBe(true)
  })
})

describe("dispatch envelope invariants", () => {
  it("rejects unknown fields, zero ramps, malformed hashes, and incomplete canonical domains", () => {
    const valid = dispatchScenarios[0].dto
    expect(() => DispatchEnvelopeDTOSchema.parse({ ...valid, unexpected: true })).toThrow()
    expect(() => DispatchEnvelopeDTOSchema.parse({ ...valid, topologyHash: "not-a-hash" })).toThrow()
    expect(() => DispatchEnvelopeDTOSchema.parse({ ...valid, request: { ...valid.request, rampUpMwPerMin: 0 } })).toThrow()
    expect(() => DispatchEnvelopeDTOSchema.parse({ ...valid, constraints: valid.constraints.slice(1) })).toThrow()
  })

  it("rejects duplicate sample minutes and reversed confidence bounds", () => {
    const valid = dispatchScenarios[0].dto
    const constraint = valid.constraints[0]
    const duplicate = { ...constraint, limitSamples: [constraint.limitSamples![0], constraint.limitSamples![0]] }
    expect(() => DispatchEnvelopeDTOSchema.parse({ ...valid, constraints: [duplicate, ...valid.constraints.slice(1)] })).toThrow()
    const reversed = { ...constraint, limitSamples: [{ minute: 0, maxMw: 2, lowerConfidenceMw: 3, upperConfidenceMw: 4, trusted: true }] }
    expect(() => DispatchEnvelopeDTOSchema.parse({ ...valid, constraints: [reversed, ...valid.constraints.slice(1)] })).toThrow()
  })

  it("rejects incomplete confidence, discontinuous proof, and contradictory authority states", () => {
    const valid = dispatchScenarios[0].dto
    const constraint = valid.constraints[0]
    const incomplete = { ...constraint, limitSamples: [{ minute: 0, maxMw: 2, lowerConfidenceMw: 1, trusted: true }] }
    expect(() => DispatchEnvelopeDTOSchema.parse({ ...valid, constraints: [incomplete, ...valid.constraints.slice(1)] })).toThrow()
    expect(() => DispatchEnvelopeDTOSchema.parse({ ...valid, proofIntervals: [{ startMinute: 1, endMinute: 2, eligibility: "eligible", reasonCode: "GAP" }] })).toThrow()
    expect(() => DispatchEnvelopeDTOSchema.parse({ ...valid, proofIntervals: [{ startMinute: 0, endMinute: 1, eligibility: "eligible", reasonCode: "A" }, { startMinute: 2, endMinute: 3, eligibility: "eligible", reasonCode: "B" }] })).toThrow()
    expect(() => DispatchEnvelopeDTOSchema.parse({ ...valid, signature: "ed25519:abc" })).toThrow()
    expect(() => DispatchEnvelopeDTOSchema.parse({ ...valid, authority: "signed-read-only", signature: "illustrative:unsigned" })).toThrow()
  })

  it("serializes deterministic validated exports and sanitizes filenames", () => {
    const dto = dispatchScenarios[0].dto
    expect(serializeDispatchEnvelopeExport(dto)).toBe(serializeDispatchEnvelopeExport(dto))
    expect(JSON.parse(serializeDispatchEnvelopeExport(dto))).toEqual(dto)
    expect(sanitizeDispatchExportFilename(" Grid Stress / ../../ ")).toBe("grid-stress")
  })

  it("fails closed across binding, interval, authority, and accepted-limit contradictions", () => {
    const valid = dispatchScenarios.find((scenario) => scenario.id === "grid-stress")!.dto
    const cases: DispatchEnvelopeDTO[] = [
      { ...valid, bindings: [{ ...valid.bindings[0], reasonCode: "WRONG" }] },
      { ...valid, bindings: [{ ...valid.bindings[0], severity: "reject" }] },
      { ...valid, bindings: [{ ...valid.bindings[0], delta: 0 }] },
      { ...valid, proofIntervals: [{ ...valid.proofIntervals[0], endMinute: 1 }] },
      { ...valid, proofIntervals: [{ ...valid.proofIntervals[0], eligibility: "not-eligible" }] },
      { ...valid, evidenceClass: "shadow-validated", authority: "illustrative-demo" },
      { ...valid, evidenceClass: "illustrative", authority: "signed-read-only" },
      { ...valid, accepted: { ...valid.accepted!, maxMw: valid.request.maxMw + 1 } },
      { ...valid, accepted: { ...valid.accepted!, maxMw: 3 } },
    ]
    for (const dto of cases) expect(() => assertDispatchEnvelopeInvariants(dto)).toThrow()
  })
  it("rejects invalid accepted-envelope combinations", () => {
    const allowWithoutAccepted = {
      ...makeDto("allow", null, [makeConstraint("electrical")]),
      decision: "allow" as const,
    }
    const rejectWithAccepted = {
      ...makeDto("reject", baseRequest, [
        makeConstraint("cooling-water", "hard-block", { maxMw: 0 }),
      ]),
      decision: "reject" as const,
    }

    expect(() => assertDispatchEnvelopeInvariants(allowWithoutAccepted)).toThrow(
      /ALLOW requires/
    )
    expect(() => assertDispatchEnvelopeInvariants(rejectWithAccepted)).toThrow(
      /must not include accepted/
    )
  })

  it("requires decision-critical no-proof and trusted hard-block evidence", () => {
    const noProofWithoutNoProof = makeDto("no-proof", null, [
      makeConstraint("storage", "available"),
    ])
    const rejectWithoutHardBlock = makeDto("reject", null, [
      makeConstraint("cooling-water", "available"),
    ])

    expect(() => assertDispatchEnvelopeInvariants(noProofWithoutNoProof)).toThrow(
      /NO-PROOF requires/
    )
    expect(() => assertDispatchEnvelopeInvariants(rejectWithoutHardBlock)).toThrow(
      /REJECT requires/
    )
  })

  it("requires non-illustrative evidence to be signed read-only", () => {
    const dto: DispatchEnvelopeDTO = {
      ...makeDto("allow", baseRequest, [makeConstraint("electrical")]),
      evidenceClass: "shadow-validated",
      authority: "illustrative-demo",
    }

    expect(() => assertDispatchEnvelopeInvariants(dto)).toThrow(
      /signed-read-only/
    )
  })
})

describe("illustrative compiler", () => {
  it("allows when the request is inside all trusted limits", () => {
    const dto = compileIllustrativeDispatchEnvelope({
      siteId: "demo",
      scenarioId: "allow",
      request: baseRequest,
      constraints: completeConstraints([
        makeConstraint("electrical", "available", { maxMw: 4 }),
        makeConstraint("storage", "available", { maxMw: 3.5 }),
      ]),
    })

    expect(dto.decision).toBe("allow")
    expect(dto.accepted?.maxMw).toBe(baseRequest.maxMw)
  })

  it("repairs to the tightest trusted envelope", () => {
    const dto = compileIllustrativeDispatchEnvelope({
      siteId: "demo",
      scenarioId: "repair",
      request: baseRequest,
      constraints: completeConstraints([
        makeConstraint("electrical", "available", { maxMw: 4 }),
        makeConstraint("storage", "binding", { maxMw: 2.4 }),
      ]),
    })

    expect(dto.decision).toBe("repair")
    expect(dto.accepted?.maxMw).toBe(2.4)
    expect(dto.bindings[0]).toMatchObject({
      domainId: "storage",
      field: "mw",
      requested: 3,
      accepted: 2.4,
      severity: "repair",
    })
    expect(dto.bindings[0]?.delta).toBeCloseTo(0.6)
  })

  it("derives bindings for every repairable dimension", () => {
    const dto = compileIllustrativeDispatchEnvelope({
      siteId: "demo",
      scenarioId: "all-repairs",
      request: baseRequest,
      constraints: completeConstraints([
        makeConstraint("storage", "binding", {
          maxMw: 2.5,
          maxHoldMinutes: 10,
          maxRampUpMwPerMin: 0.5,
          earliestStartMinute: 2,
          requiredRecoveryMinutes: 9,
          reboundLimitMw: 0.4,
        }),
      ]),
    })
    expect(dto.bindings.map((binding) => binding.field)).toEqual([
      "mw", "hold", "ramp-up", "start", "recovery", "rebound",
    ])
  })

  it("rejects on trusted hard block and returns no-proof on stale evidence", () => {
    const rejected = compileIllustrativeDispatchEnvelope({
      siteId: "demo",
      scenarioId: "reject",
      request: baseRequest,
      constraints: completeConstraints([
        makeConstraint("cooling-water", "hard-block", { maxMw: 0 }),
      ]),
    })
    const noProof = compileIllustrativeDispatchEnvelope({
      siteId: "demo",
      scenarioId: "no-proof",
      request: baseRequest,
      constraints: completeConstraints([
        makeConstraint("storage", "no-proof", {
          isTrusted: false,
          confidencePct: 31,
        }),
      ]),
    })

    expect(rejected.decision).toBe("reject")
    expect(rejected.accepted).toBeNull()
    expect(noProof.decision).toBe("no-proof")
    expect(noProof.accepted).toBeNull()
  })

  it("keeps accepted values within request and trusted limits for generated fixtures", () => {
    fc.assert(
      fc.property(
        fc.float({ min: 1, max: 8, noNaN: true, noDefaultInfinity: true }),
        fc.float({ min: 0.25, max: 1, noNaN: true, noDefaultInfinity: true }),
        (requestedMw, limitRatio) => {
          const maxMw = Number(requestedMw.toFixed(2))
          const limitMw = Number((maxMw * limitRatio).toFixed(2))
          const request = { ...baseRequest, maxMw }
          const dto = compileIllustrativeDispatchEnvelope({
            siteId: "demo",
            scenarioId: "generated",
            request,
            constraints: completeConstraints([
              makeConstraint("electrical", "available", { maxMw: maxMw + 1 }),
              makeConstraint("storage", "binding", { maxMw: limitMw }),
            ]),
          })

          expect(dto.accepted?.maxMw ?? 0).toBeLessThanOrEqual(request.maxMw)
          expect(dto.accepted?.maxMw ?? 0).toBeLessThanOrEqual(limitMw)

          if (limitMw < maxMw) {
            expect(dto.decision).toBe("repair")
            expect(dto.bindings.length).toBeGreaterThan(0)
          }
        }
      )
    )
  })
})

describe("dispatch envelope math", () => {
  it("rejects malformed geometry inputs deterministically", () => {
    const samples = buildEnvelopeSamples(dispatchScenarios[0].dto, 4)
    const dimensions = { width: 860, height: 520, margin: { top: 54, right: 26, bottom: 58, left: 62 } }
    expect(() => buildDispatchEnvelopeGeometry({ samples: [], domainIds: [], dimensions })).toThrow(/at least two/)
    expect(() => buildDispatchEnvelopeGeometry({ samples, domainIds: [], dimensions: { ...dimensions, width: 0 } })).toThrow(/positive/)
    expect(() => buildDispatchEnvelopeGeometry({ samples, domainIds: [], dimensions: { ...dimensions, height: Number.NaN } })).toThrow(/finite/)
    expect(() => buildDispatchEnvelopeGeometry({ samples, domainIds: ["storage", "storage"], dimensions })).toThrow(/unique/)
    expect(() => buildDispatchEnvelopeGeometry({ samples: [samples[0], samples[0]], domainIds: [], dimensions })).toThrow(/strictly increasing/)
    expect(() => buildDispatchEnvelopeGeometry({ samples: [{ ...samples[0], requestedMw: Number.POSITIVE_INFINITY }, samples[1]], domainIds: [], dimensions })).toThrow(/finite nonnegative/)
  })

  it("rejects invalid sampling counts and infeasible ramp semantics", () => {
    expect(() => buildEnvelopeSamples(dispatchScenarios[0].dto, 1)).toThrow(/at least two/)
    expect(() => buildEnvelopeSamples({ ...dispatchScenarios[0].dto, request: { ...dispatchScenarios[0].dto.request, rampUpMwPerMin: 0 } }, 4)).toThrow(/positive ramp/)
  })
  it("builds non-empty paths and repair geometry for repair fixtures", () => {
    const scenario = scenarioById("grid-stress")
    const samples = buildEnvelopeSamples(scenario.dto)
    const geometry = buildDispatchEnvelopeGeometry({
      samples,
      domainIds: DISPATCH_DOMAIN_IDS,
      dimensions: {
        width: 860,
        height: 520,
        margin: { top: 54, right: 26, bottom: 58, left: 62 },
      },
    })

    expect(geometry.requestedLinePath).toMatch(/^M/)
    expect(geometry.acceptedLinePath).toMatch(/^M/)
    expect(geometry.repairDeltaAreaPath).toMatch(/^M/)
    expect(geometry.domainLinePaths.storage).toMatch(/^M/)
  })

  it("builds valid compact geometry with reduced visible tick density", () => {
    const scenario = scenarioById("grid-stress")
    const samples = buildEnvelopeSamples(scenario.dto)
    const compactGeometry = buildDispatchEnvelopeGeometry({
      samples,
      domainIds: DISPATCH_DOMAIN_IDS,
      dimensions: {
        width: 360,
        height: 360,
        margin: { top: 38, right: 14, bottom: 40, left: 42 },
      },
    })

    expect(compactGeometry.plotWidth).toBe(304)
    expect(compactGeometry.plotHeight).toBe(282)
    expect(compactGeometry.requestedLinePath).toMatch(/^M/)
    expect(compactGeometry.acceptedLinePath).toMatch(/^M/)
    expect(compactTicks(compactGeometry.xTicks, 3)).toHaveLength(3)
    expect(compactTicks(compactGeometry.yTicks, 4).length).toBeLessThanOrEqual(4)
    expect(compactTicks([0, 1, 2, 3, 4], 3)).toEqual([0, 2, 4])
  })

  it("keeps repair deltas positive only where a repair clips the request", () => {
    const repairedSamples = buildEnvelopeSamples(scenarioById("grid-stress").dto)
    const allowedSamples = buildEnvelopeSamples(scenarioById("normal").dto)
    const repairedDeltas = repairedSamples.map((sample) => sample.repairDeltaMw)

    expect(Math.max(...repairedDeltas)).toBeGreaterThan(1)
    expect(
      repairedSamples.every(
        (sample) => sample.acceptedMw <= sample.requestedMw + 0.000001
      )
    ).toBe(true)
    expect(repairedSamples[0].repairDeltaMw).toBe(0)
    expect(allowedSamples.every((sample) => sample.repairDeltaMw === 0)).toBe(true)
  })

  it("builds a no-proof mask and withholds proof eligibility for stale evidence", () => {
    const scenario = scenarioById("telemetry-loss")
    const samples = buildEnvelopeSamples(scenario.dto)
    const geometry = buildDispatchEnvelopeGeometry({
      samples,
      domainIds: DISPATCH_DOMAIN_IDS,
      dimensions: {
        width: 860,
        height: 520,
        margin: { top: 54, right: 26, bottom: 58, left: 62 },
      },
    })
    const snapshot = getProofLensSnapshotAtMinute(samples, 8)

    expect(samples.every((sample) => !sample.proofEligible)).toBe(true)
    expect(samples.every((sample) => sample.acceptedMw === 0)).toBe(true)
    expect(snapshot.proofEligible).toBe(false)
    expect(snapshot.repairDeltaMw).toBeGreaterThan(0)
    expect(geometry.noProofMaskPath).toMatch(/^M/)
  })

  it("uses nearest-sample proof lens lookup with margins and binding domain", () => {
    const scenario = scenarioById("grid-stress")
    const samples = buildEnvelopeSamples(scenario.dto)
    const snapshot = getProofLensSnapshotAtMinute(samples, 8)

    expect(snapshot.minute).toBeGreaterThan(0)
    expect(snapshot.requestedMw).toBeGreaterThan(0)
    expect(snapshot.repairDeltaMw).toBeGreaterThan(0)
    expect(snapshot.margins.storage).toBeDefined()
    expect(snapshot.bindingDomainId).toBeTruthy()
  })

  it("samples canonical limits once and honors sample-level trust", () => {
    const dto = makeDto("repair", { ...baseRequest, maxMw: 1 }, [
      makeConstraint("electrical", "available", {
        maxMw: 3,
        limitSamples: [
          {
            minute: 0,
            maxMw: 3,
            lowerConfidenceMw: 2.9,
            upperConfidenceMw: 3.1,
            trusted: true,
          },
          {
            minute: 60,
            maxMw: 3,
            lowerConfidenceMw: 2.9,
            upperConfidenceMw: 3.1,
            trusted: true,
          },
        ],
      }),
      makeConstraint("storage", "binding", {
        maxMw: 1,
        isTrusted: true,
        limitSamples: [
          {
            minute: 0,
            maxMw: 1,
            lowerConfidenceMw: 0.9,
            upperConfidenceMw: 1.1,
            trusted: false,
          },
          {
            minute: 60,
            maxMw: 1,
            lowerConfidenceMw: 0.9,
            upperConfidenceMw: 1.1,
            trusted: false,
          },
        ],
      }),
    ])
    const sample = buildEnvelopeSamples(dto, 3)[1]

    expect(Object.keys(sample.limits)).toEqual(DISPATCH_DOMAIN_IDS)
    expect(sample.limits.storage).toBe(1)
    expect(sample.lowerConfidence.storage).toBe(0.9)
    expect(sample.upperConfidence.storage).toBe(1.1)
    expect(sample.trusted.storage).toBe(false)
    expect(sample.bindingDomainId).not.toBe("storage")
  })

  it("ranks hard-block, no-proof, and binding constraints first", () => {
    const cooling = scenarioById("cooling-contingency")
    const telemetry = scenarioById("telemetry-loss")
    const bridge = scenarioById("bridge-power")

    expect(getOrderedConstraints(cooling)[0].id).toBe("cooling-water")
    expect(getOrderedConstraints(telemetry)[0].constraint.state).toBe("no-proof")
    expect(getOrderedConstraints(bridge)[0].id).toBe("bridge-power")

    const ranked = rankConstraints({
      samples: buildEnvelopeSamples(bridge.dto),
      constraints: bridge.dto.constraints,
    })

    expect(ranked[0].domainId).toBe("bridge-power")
  })

  it("uses state weight before pressure, then pressure before label for ranking", () => {
    const dto = makeDto("repair", { ...baseRequest, maxMw: 1 }, [
      makeConstraint("electrical", "binding", { maxMw: 0.5 }),
      makeConstraint("storage", "binding", { maxMw: 1.5 }),
      makeConstraint("cooling-water", "no-proof", {
        isTrusted: false,
        maxMw: 4,
      }),
      makeConstraint("bridge-power", "hard-block", { maxMw: 0 }),
    ])
    const ranked = rankConstraints({
      samples: buildEnvelopeSamples(dto),
      constraints: dto.constraints,
    })

    expect(ranked.map((constraint) => constraint.domainId).slice(0, 4)).toEqual([
      "bridge-power",
      "cooling-water",
      "electrical",
      "storage",
    ])
    expect(ranked[2].score).toBeGreaterThan(ranked[3].score)
  })
})

function scenarioById(id: string) {
  const scenario = dispatchScenarios.find((item) => item.id === id)

  if (!scenario) {
    throw new Error(`Missing dispatch scenario fixture: ${id}`)
  }

  return scenario
}

function makeConstraint(
  id: DomainId,
  state: ConstraintState = "available",
  overrides: Partial<DispatchDomainConstraint> = {}
): DispatchDomainConstraint {
  const maxMw = overrides.maxMw ?? (state === "hard-block" ? 0 : 4)

  return {
    id,
    label: id,
    shortLabel: id,
    state,
    isDecisionCritical: overrides.isDecisionCritical ?? true,
    isTrusted: overrides.isTrusted ?? state !== "no-proof",
    maxMw,
    maxHoldMinutes: overrides.maxHoldMinutes ?? (state === "hard-block" ? 0 : 20),
    maxRampUpMwPerMin:
      overrides.maxRampUpMwPerMin ?? (state === "hard-block" ? 0 : 1),
    earliestStartMinute: overrides.earliestStartMinute ?? 0,
    requiredRecoveryMinutes: overrides.requiredRecoveryMinutes ?? 6,
    reboundLimitMw: overrides.reboundLimitMw ?? 0.8,
    telemetryAgeMs: overrides.telemetryAgeMs ?? 120,
    confidencePct: overrides.confidencePct ?? 99,
    reason: overrides.reason ?? `${id} reason`,
    reasonCode: overrides.reasonCode ?? `${id.toUpperCase()}_REASON`,
    evidenceArtifact: overrides.evidenceArtifact ?? `${id}.json`,
    proofEligibility:
      overrides.proofEligibility ?? (state === "no-proof" ? "not-eligible" : "eligible"),
    limitSamples: overrides.limitSamples,
  }
}

function makeDto(
  decision: DispatchEnvelopeDTO["decision"],
  accepted: DispatchEnvelopeSpec | null,
  constraints: DispatchDomainConstraint[]
): DispatchEnvelopeDTO {
  const canonicalConstraints = DISPATCH_DOMAIN_IDS.map(
    (id) => constraints.find((constraint) => constraint.id === id) ?? makeConstraint(id)
  )
  const endMinute = accepted
    ? accepted.startMinute + accepted.maxMw / accepted.rampUpMwPerMin + accepted.holdMinutes + accepted.maxMw / accepted.rampDownMwPerMin + accepted.recoveryMinutes
    : baseRequest.startMinute + baseRequest.maxMw / baseRequest.rampUpMwPerMin + baseRequest.holdMinutes + baseRequest.maxMw / baseRequest.rampDownMwPerMin + baseRequest.recoveryMinutes
  return {
    schemaVersion: "dispatch-envelope.v1",
    siteId: "demo",
    scenarioId: `invariant-${decision}`,
    tapeId: "demo-tape",
    topologyHash: `sha256:${"1".repeat(64)}`,
    policyBundleVersion: "policy",
    telemetryManifestId: "telemetry",
    decision,
    request: baseRequest,
    accepted,
    constraints: canonicalConstraints,
    bindings: [],
    proofIntervals: [{ startMinute: 0, endMinute, eligibility: decision === "no-proof" ? "not-eligible" : "eligible", reasonCode: decision === "no-proof" ? "DECISION_EVIDENCE_INCOMPLETE" : "EVIDENCE_COMPLETE" }],
    proofRoot: `sha256:${"2".repeat(64)}`,
    evidenceClass: "illustrative",
    issuedAt: "2026-06-18T00:00:00.000Z",
    signature: "illustrative:unsigned",
    authority: "illustrative-demo",
  }
}

function completeConstraints(constraints: DispatchDomainConstraint[]) {
  return DISPATCH_DOMAIN_IDS.map(
    (id) => constraints.find((constraint) => constraint.id === id) ?? makeConstraint(id, "available", { maxMw: 20, maxHoldMinutes: 60, maxRampUpMwPerMin: 10, requiredRecoveryMinutes: 0, reboundLimitMw: 20 })
  )
}
