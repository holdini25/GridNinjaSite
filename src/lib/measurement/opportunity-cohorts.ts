import { z } from "zod"

/** Private commercial reporting only. Never import opportunity records into a public page. */
export const ASSESSMENT_OBSERVATION_DAYS = 90
export const opportunitySources = ["website-sourced", "website-assisted", "other-known", "unknown"] as const
export type OpportunitySource = (typeof opportunitySources)[number]

export interface AssessmentOpportunity {
  id: string
  qualifiedAt: string
  qualification: {
    namedDecision: boolean
    boundedScope: boolean
    decisionOwner: boolean
    agreedNextStep: boolean
  }
  source: OpportunitySource
  /** Commercial owner explicitly merges records; company/email similarity is not sufficient. */
  mergedInto?: string
  agreementExecutedAt: string | null
  paidScopeConfirmed: boolean
  /** A voided/corrected agreement is not a paid-assessment conversion. */
  agreementVoided?: boolean
  outcomeKnownThrough: string | null
}

function timestamp(value: string, label: string): number {
  if (!z.iso.datetime({ offset: true }).safeParse(value).success) {
    throw new Error(`Invalid ${label}; use a valid calendar date with an explicit time zone`)
  }
  return Date.parse(value)
}

export function qualificationEndpoint(qualifiedAt: string): string {
  return new Date(timestamp(qualifiedAt, "qualifiedAt") + ASSESSMENT_OBSERVATION_DAYS * 86_400_000).toISOString()
}

/** Counts decisions, uses each decision's endpoint, and never treats missing follow-up as failure. */
export function summarizeOpportunityCohort(
  records: readonly AssessmentOpportunity[],
  options: { month: string; asOf: string; source?: OpportunitySource },
) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(options.month)) throw new Error("Invalid qualification month")
  const now = timestamp(options.asOf, "asOf")
  if (options.source !== undefined && !opportunitySources.includes(options.source)) throw new Error("Unknown attribution category")
  const byId = new Map<string, AssessmentOpportunity>()
  for (const record of records) {
    if (!record.id || byId.has(record.id)) throw new Error("Opportunity IDs must be unique")
    if (!opportunitySources.includes(record.source)) throw new Error("Unknown attribution category")
    if (!record.qualification || Object.keys(record.qualification).length !== 4
      || !["namedDecision", "boundedScope", "decisionOwner", "agreedNextStep"].every(
        key => record.qualification[key as keyof AssessmentOpportunity["qualification"]] === true)) {
      throw new Error("An opportunity requires all four qualification facts")
    }
    const qualified = timestamp(record.qualifiedAt, "qualifiedAt")
    if (qualified > now) throw new Error("Qualification cannot occur after the report date")
    if (typeof record.paidScopeConfirmed !== "boolean" || (record.agreementVoided !== undefined && typeof record.agreementVoided !== "boolean")) {
      throw new Error("Agreement flags must be explicit booleans")
    }
    if (record.agreementExecutedAt !== null) {
      const agreement = timestamp(record.agreementExecutedAt, "agreementExecutedAt")
      if (agreement < qualified) throw new Error("Agreement predates qualification; correct or exclude pre-existing business")
      if (agreement > now) throw new Error("Agreement cannot occur after the report date")
    }
    if (record.outcomeKnownThrough !== null) {
      const followUp = timestamp(record.outcomeKnownThrough, "outcomeKnownThrough")
      if (followUp < qualified) throw new Error("Follow-up cannot predate qualification")
      if (followUp > now) throw new Error("Follow-up cannot occur after the report date")
    }
    byId.set(record.id, record)
  }
  for (const record of records.filter((item) => item.mergedInto)) {
    const visited = new Set([record.id])
    let target = record
    while (target.mergedInto) {
      const next = byId.get(target.mergedInto)
      if (!next || visited.has(next.id)) throw new Error("Invalid opportunity merge")
      visited.add(next.id)
      target = next
    }
    if (timestamp(target.qualifiedAt, "qualifiedAt") > timestamp(record.qualifiedAt, "qualifiedAt")) {
      throw new Error("Merged opportunity must preserve the earliest factual qualification timestamp")
    }
    // Merging is an explicit commercial correction, not an inference from contacts.
    // The survivor owns attribution, but cannot silently lose a paid agreement or
    // documented observation from an alias. Reconcile those facts before reporting.
    if (record.agreementExecutedAt && record.paidScopeConfirmed && !record.agreementVoided) {
      if (!target.agreementExecutedAt || !target.paidScopeConfirmed || target.agreementVoided
        || timestamp(target.agreementExecutedAt, "agreementExecutedAt") > timestamp(record.agreementExecutedAt, "agreementExecutedAt")) {
        throw new Error("Merged opportunity must reconcile the earliest paid agreement on its survivor")
      }
    }
    if (record.outcomeKnownThrough && (!target.outcomeKnownThrough
      || timestamp(target.outcomeKnownThrough, "outcomeKnownThrough") < timestamp(record.outcomeKnownThrough, "outcomeKnownThrough"))) {
      throw new Error("Merged opportunity must reconcile follow-up coverage on its survivor")
    }
  }

  const cohort = records.filter((record) => !record.mergedInto
    && new Date(timestamp(record.qualifiedAt, "qualifiedAt")).toISOString().startsWith(options.month)
    && (!options.source || record.source === options.source))
  let pending = 0
  let converted = 0
  let notConverted = 0
  let unknownFollowUp = 0
  let lateConversions = 0
  for (const record of cohort) {
    const endpoint = timestamp(qualificationEndpoint(record.qualifiedAt), "endpoint")
    const agreement = record.agreementExecutedAt ? timestamp(record.agreementExecutedAt, "agreementExecutedAt") : null
    const paid = agreement !== null && record.paidScopeConfirmed && !record.agreementVoided
    if (paid && agreement > endpoint) lateConversions += 1
    if (now < endpoint) { pending += 1; continue }
    if (paid && agreement <= endpoint) { converted += 1; continue }
    const knownThrough = record.outcomeKnownThrough ? timestamp(record.outcomeKnownThrough, "outcomeKnownThrough") : null
    if (knownThrough !== null && knownThrough >= endpoint) notConverted += 1
    else unknownFollowUp += 1
  }
  const denominator = cohort.length
  const estimable = denominator > 0 && pending === 0 && unknownFollowUp === 0
  return {
    metric: "contracted-paid-assessment-within-90-days" as const,
    month: options.month,
    source: options.source ?? "all",
    denominator, pending, converted, notConverted, unknownFollowUp, lateConversions,
    fixedAgeRate: estimable ? converted / denominator : null,
    status: estimable ? "estimable" as const : "not-yet-estimable" as const,
    followUpCoverage: denominator > pending ? (converted + notConverted) / (denominator - pending) : null,
  }
}
