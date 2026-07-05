import type {
  DispatchBinding,
  DispatchDecision,
  DispatchDomainConstraint,
  DispatchEnvelopeDTO,
  DispatchEnvelopeSpec,
} from "@/types/dispatch-envelope"

export function compileIllustrativeDispatchEnvelope(input: {
  siteId: string
  scenarioId: string
  request: DispatchEnvelopeSpec
  constraints: DispatchDomainConstraint[]
}): DispatchEnvelopeDTO {
  const { request, constraints } = input
  const trustedHardBlock = constraints.find(
    (constraint) => constraint.isTrusted && constraint.state === "hard-block"
  )

  if (trustedHardBlock) {
    return buildDto({
      ...input,
      decision: "reject",
      accepted: null,
      bindings: [
        bindingFromConstraint({
          constraint: trustedHardBlock,
          field: "mw",
          requested: request.maxMw,
          accepted: 0,
          severity: "reject",
        }),
      ],
    })
  }

  const missingCriticalEvidence = constraints.find(
    (constraint) =>
      constraint.isDecisionCritical &&
      (!constraint.isTrusted || constraint.state === "no-proof")
  )

  if (missingCriticalEvidence) {
    return buildDto({
      ...input,
      decision: "no-proof",
      accepted: null,
      bindings: [
        bindingFromConstraint({
          constraint: missingCriticalEvidence,
          field: "trust",
          requested: "trusted evidence",
          accepted: "no-proof",
          severity: "no-proof",
        }),
      ],
    })
  }

  const trusted = constraints.filter((constraint) => constraint.isTrusted)
  const accepted: DispatchEnvelopeSpec = {
    startMinute: Math.max(
      request.startMinute,
      ...trusted.map((constraint) => constraint.earliestStartMinute)
    ),
    maxMw: Math.min(request.maxMw, ...trusted.map((constraint) => constraint.maxMw)),
    holdMinutes: Math.min(
      request.holdMinutes,
      ...trusted.map((constraint) => constraint.maxHoldMinutes)
    ),
    rampUpMwPerMin: Math.min(
      request.rampUpMwPerMin,
      ...trusted.map((constraint) => constraint.maxRampUpMwPerMin)
    ),
    rampDownMwPerMin: request.rampDownMwPerMin,
    recoveryMinutes: Math.max(
      request.recoveryMinutes,
      ...trusted.map((constraint) => constraint.requiredRecoveryMinutes)
    ),
    reboundLimitMw: Math.min(
      request.reboundLimitMw,
      ...trusted.map((constraint) => constraint.reboundLimitMw)
    ),
  }
  const intersectionEmpty =
    accepted.maxMw <= 0 ||
    accepted.holdMinutes <= 0 ||
    accepted.rampUpMwPerMin <= 0

  if (intersectionEmpty) {
    return buildDto({
      ...input,
      decision: "reject",
      accepted: null,
      bindings: trusted.map((constraint) =>
        bindingFromConstraint({
          constraint,
          field: "mw",
          requested: request.maxMw,
          accepted: accepted.maxMw,
          severity: "reject",
        })
      ),
    })
  }

  const bindings = deriveBindings(request, accepted, trusted)
  const decision: DispatchDecision = bindings.length > 0 ? "repair" : "allow"

  return buildDto({
    ...input,
    decision,
    accepted,
    bindings,
  })
}

function deriveBindings(
  request: DispatchEnvelopeSpec,
  accepted: DispatchEnvelopeSpec,
  constraints: DispatchDomainConstraint[]
): DispatchBinding[] {
  const bindings: DispatchBinding[] = []

  if (accepted.maxMw < request.maxMw) {
    bindings.push(
      bindingFromConstraint({
        constraint: minBy(constraints, (constraint) => constraint.maxMw),
        field: "mw",
        requested: request.maxMw,
        accepted: accepted.maxMw,
        severity: "repair",
      })
    )
  }

  if (accepted.holdMinutes < request.holdMinutes) {
    bindings.push(
      bindingFromConstraint({
        constraint: minBy(constraints, (constraint) => constraint.maxHoldMinutes),
        field: "hold",
        requested: request.holdMinutes,
        accepted: accepted.holdMinutes,
        severity: "repair",
      })
    )
  }

  if (accepted.rampUpMwPerMin < request.rampUpMwPerMin) {
    bindings.push(
      bindingFromConstraint({
        constraint: minBy(
          constraints,
          (constraint) => constraint.maxRampUpMwPerMin
        ),
        field: "ramp-up",
        requested: request.rampUpMwPerMin,
        accepted: accepted.rampUpMwPerMin,
        severity: "repair",
      })
    )
  }

  if (accepted.startMinute > request.startMinute) {
    bindings.push(
      bindingFromConstraint({
        constraint: maxBy(
          constraints,
          (constraint) => constraint.earliestStartMinute
        ),
        field: "start",
        requested: `T+${request.startMinute}`,
        accepted: `T+${accepted.startMinute}`,
        severity: "repair",
      })
    )
  }

  if (accepted.recoveryMinutes > request.recoveryMinutes) {
    bindings.push(
      bindingFromConstraint({
        constraint: maxBy(
          constraints,
          (constraint) => constraint.requiredRecoveryMinutes
        ),
        field: "recovery",
        requested: request.recoveryMinutes,
        accepted: accepted.recoveryMinutes,
        severity: "repair",
      })
    )
  }

  if (accepted.reboundLimitMw < request.reboundLimitMw) {
    bindings.push(
      bindingFromConstraint({
        constraint: minBy(constraints, (constraint) => constraint.reboundLimitMw),
        field: "rebound",
        requested: request.reboundLimitMw,
        accepted: accepted.reboundLimitMw,
        severity: "repair",
      })
    )
  }

  return bindings
}

function bindingFromConstraint(args: {
  constraint: DispatchDomainConstraint
  field: DispatchBinding["field"]
  requested: number | string
  accepted: number | string
  severity: DispatchBinding["severity"]
}): DispatchBinding {
  return {
    domainId: args.constraint.id,
    field: args.field,
    requested: args.requested,
    accepted: args.accepted,
    delta:
      typeof args.requested === "number" && typeof args.accepted === "number"
        ? Math.abs(args.requested - args.accepted)
        : "changed",
    reasonCode: args.constraint.reasonCode,
    severity: args.severity,
  }
}

function buildDto(args: {
  siteId: string
  scenarioId: string
  request: DispatchEnvelopeSpec
  accepted: DispatchEnvelopeSpec | null
  constraints: DispatchDomainConstraint[]
  bindings: DispatchBinding[]
  decision: DispatchDecision
}): DispatchEnvelopeDTO {
  return {
    schemaVersion: "dispatch-envelope.v1",
    siteId: args.siteId,
    scenarioId: args.scenarioId,
    tapeId: "demo-tape-illustrative",
    topologyHash: "topology-demo-83c4-91f",
    policyBundleVersion: "operator-policy-v14-demo",
    telemetryManifestId: "telemetry-demo-manifest",
    decision: args.decision,
    request: args.request,
    accepted: args.accepted,
    constraints: args.constraints,
    bindings: args.bindings,
    proofRoot: "demo-proof-root-83c4-91f",
    evidenceClass: "illustrative",
    issuedAt: new Date("2026-06-18T00:00:00.000Z").toISOString(),
    signature: "illustrative-demo-only",
    authority: "illustrative-demo",
  }
}

function minBy<T>(items: T[], accessor: (item: T) => number): T {
  return items.reduce((best, item) =>
    accessor(item) < accessor(best) ? item : best
  )
}

function maxBy<T>(items: T[], accessor: (item: T) => number): T {
  return items.reduce((best, item) =>
    accessor(item) > accessor(best) ? item : best
  )
}
