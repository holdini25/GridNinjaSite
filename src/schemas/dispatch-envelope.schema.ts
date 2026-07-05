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
  limitSamples: z
    .array(
      z.object({
        minute: z.number().finite().nonnegative(),
        maxMw: z.number().finite().nonnegative(),
        lowerConfidenceMw: z.number().finite().nonnegative().optional(),
        upperConfidenceMw: z.number().finite().nonnegative().optional(),
        trusted: z.boolean(),
      })
    )
    .optional(),
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
})

export const DispatchEnvelopeDTOSchema = z.object({
  schemaVersion: z.literal("dispatch-envelope.v1"),
  siteId: z.string().min(1),
  scenarioId: z.string().min(1),
  tapeId: z.string().min(1),
  topologyHash: z.string().min(1),
  policyBundleVersion: z.string().min(1),
  telemetryManifestId: z.string().min(1),
  decision: DispatchDecisionSchema,
  request: DispatchEnvelopeSpecSchema,
  accepted: DispatchEnvelopeSpecSchema.nullable(),
  constraints: z.array(DispatchDomainConstraintSchema).min(1),
  bindings: z.array(DispatchBindingSchema),
  proofRoot: z.string().min(1),
  evidenceClass: z.enum([
    "illustrative",
    "replay-validated",
    "shadow-validated",
    "operator-accepted",
  ]),
  issuedAt: z.string().min(1),
  signature: z.string().min(1),
  authority: z.enum(["illustrative-demo", "signed-read-only"]),
})
