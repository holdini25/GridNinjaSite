import { z } from "zod"

export const DispatchDecisionSchema = z.enum([
  "allow",
  "repair",
  "reject",
  "no-proof",
])

export const DomainIdSchema = z.enum([
  "electrical",
  "storage",
  "cooling-water",
  "bridge-power",
  "workload-sla",
  "telemetry-policy",
])

export const DispatchEnvelopeSpecSchema = z.object({
  startMinute: z.number().finite().min(0),
  rampUpMwPerMin: z.number().finite().nonnegative(),
  maxMw: z.number().finite().nonnegative(),
  holdMinutes: z.number().finite().nonnegative(),
  rampDownMwPerMin: z.number().finite().nonnegative(),
  recoveryMinutes: z.number().finite().nonnegative(),
  reboundLimitMw: z.number().finite().nonnegative(),
}).strict().superRefine((spec, ctx) => {
  if (spec.maxMw > 0 && spec.rampUpMwPerMin <= 0) ctx.addIssue({ code: "custom", path: ["rampUpMwPerMin"], message: "Positive envelopes require a positive ramp-up rate" })
  if (spec.maxMw > 0 && spec.rampDownMwPerMin <= 0) ctx.addIssue({ code: "custom", path: ["rampDownMwPerMin"], message: "Positive envelopes require a positive ramp-down rate" })
})

const DispatchLimitSampleSchema = z.object({
  minute: z.number().finite().nonnegative(),
  maxMw: z.number().finite().nonnegative(),
  lowerConfidenceMw: z.number().finite().nonnegative().optional(),
  upperConfidenceMw: z.number().finite().nonnegative().optional(),
  trusted: z.boolean(),
}).strict().superRefine((sample, ctx) => {
  const hasLower = sample.lowerConfidenceMw != null
  const hasUpper = sample.upperConfidenceMw != null
  if (hasLower !== hasUpper) ctx.addIssue({ code: "custom", message: "Confidence bounds must be provided together" })
  if (hasLower && hasUpper && !(sample.lowerConfidenceMw! <= sample.maxMw && sample.maxMw <= sample.upperConfidenceMw!)) {
    ctx.addIssue({ code: "custom", message: "Confidence bounds must contain maxMw" })
  }
})

export const DispatchDomainConstraintSchema = z.object({
  id: DomainIdSchema,
  label: z.string().min(1),
  shortLabel: z.string().min(1),
  state: z.enum([
    "binding",
    "available",
    "repair",
    "hard-block",
    "no-proof",
    "unknown",
  ]),
  isDecisionCritical: z.boolean(),
  isTrusted: z.boolean(),
  maxMw: z.number().finite().nonnegative(),
  maxHoldMinutes: z.number().finite().nonnegative(),
  maxRampUpMwPerMin: z.number().finite().nonnegative(),
  earliestStartMinute: z.number().finite().nonnegative(),
  requiredRecoveryMinutes: z.number().finite().nonnegative(),
  reboundLimitMw: z.number().finite().nonnegative(),
  telemetryAgeMs: z.number().finite().nonnegative().nullable(),
  confidencePct: z.number().finite().min(0).max(100).nullable(),
  reason: z.string().min(1),
  reasonCode: z.string().min(1),
  evidenceArtifact: z.string().min(1),
  proofEligibility: z.enum([
    "eligible",
    "not-eligible",
    "partial",
    "illustrative-only",
  ]),
  limitSamples: z.array(DispatchLimitSampleSchema).optional(),
}).strict().superRefine((constraint, ctx) => {
  const samples = constraint.limitSamples ?? []
  for (let index = 1; index < samples.length; index += 1) {
    if (samples[index].minute <= samples[index - 1].minute) ctx.addIssue({ code: "custom", path: ["limitSamples", index, "minute"], message: "Sample minutes must be unique and strictly increasing" })
  }
  if (constraint.state === "no-proof" && (constraint.isTrusted || constraint.proofEligibility === "eligible")) ctx.addIssue({ code: "custom", message: "No-proof constraints cannot be trusted or eligible" })
  if (constraint.state === "hard-block" && !constraint.isDecisionCritical) ctx.addIssue({ code: "custom", message: "Hard blocks must be decision-critical" })
})

export const DispatchBindingSchema = z.object({
  domainId: DomainIdSchema,
  field: z.enum([
    "mw",
    "hold",
    "ramp-up",
    "start",
    "recovery",
    "rebound",
    "trust",
  ]),
  requested: z.union([z.number(), z.string()]),
  accepted: z.union([z.number(), z.string()]),
  delta: z.union([z.number(), z.string()]),
  reasonCode: z.string().min(1),
  severity: z.enum(["info", "repair", "reject", "no-proof"]),
}).strict()

export const DispatchProofIntervalSchema = z.object({
  startMinute: z.number().finite().nonnegative(),
  endMinute: z.number().finite().positive(),
  eligibility: z.enum(["eligible", "not-eligible"]),
  reasonCode: z.string().min(1),
}).strict().refine((interval) => interval.endMinute > interval.startMinute, {
  message: "Proof intervals require endMinute greater than startMinute",
})

const sha256 = z.string().regex(/^sha256:[a-f0-9]{64}$/)

export const DispatchEnvelopeDTOSchema = z.object({
  schemaVersion: z.literal("dispatch-envelope.v1"),
  siteId: z.string().min(1),
  scenarioId: z.string().min(1),
  tapeId: z.string().min(1),
  topologyHash: sha256,
  policyBundleVersion: z.string().min(1),
  telemetryManifestId: z.string().min(1),
  decision: DispatchDecisionSchema,
  request: DispatchEnvelopeSpecSchema,
  accepted: DispatchEnvelopeSpecSchema.nullable(),
  constraints: z.array(DispatchDomainConstraintSchema).min(1),
  bindings: z.array(DispatchBindingSchema),
  proofIntervals: z.array(DispatchProofIntervalSchema).min(1),
  proofRoot: sha256,
  evidenceClass: z.enum([
    "illustrative",
    "replay-validated",
    "shadow-validated",
    "operator-accepted",
  ]),
  issuedAt: z.string().datetime({ offset: true }),
  signature: z.union([z.literal("illustrative:unsigned"), z.string().regex(/^ed25519:[A-Za-z0-9_-]+$/)]),
  authority: z.enum(["illustrative-demo", "signed-read-only"]),
}).strict().superRefine((dto, ctx) => {
  const canonical = DomainIdSchema.options
  if (dto.constraints.length !== canonical.length || dto.constraints.some((constraint, index) => constraint.id !== canonical[index])) ctx.addIssue({ code: "custom", path: ["constraints"], message: "Constraints must contain every canonical domain exactly once and in canonical order" })
  const intervals = dto.proofIntervals
  if (intervals[0]?.startMinute !== 0) ctx.addIssue({ code: "custom", path: ["proofIntervals"], message: "Proof intervals must begin at minute zero" })
  for (let index = 1; index < intervals.length; index += 1) if (intervals[index].startMinute !== intervals[index - 1].endMinute) ctx.addIssue({ code: "custom", path: ["proofIntervals", index], message: "Proof intervals must be ordered, contiguous, and nonoverlapping" })
  if (dto.authority === "illustrative-demo" && dto.signature !== "illustrative:unsigned") ctx.addIssue({ code: "custom", path: ["signature"], message: "Illustrative DTOs must be unsigned" })
  if (dto.authority === "signed-read-only" && !dto.signature.startsWith("ed25519:")) ctx.addIssue({ code: "custom", path: ["signature"], message: "Signed DTOs require an Ed25519 signature" })
})

export const DispatchEnvelopeExportSchema = DispatchEnvelopeDTOSchema
