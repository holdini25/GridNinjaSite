import type { AssessmentRecord } from "@/types/assessment"

/** Issued by the server only after the complete frozen publication passes validation. */
export type HypotheticalMinimumSource = Readonly<{
  publicationId: "demo-01-b"
  version: "1.0.0"
  snapshotSha256: string
  basisId: string
  requestedKW: number
  modeledKW: number
}>

export type HypotheticalMinimum = Readonly<{
  origin: "visitor-assumption"
  source: HypotheticalMinimumSource
  minimumKW: number
}>

export const HYPOTHETICAL_MINIMUM_PRESETS = ["5.0", "5.8", "6.0", "6.5", "7.0"] as const

type ParsedMinimum = { ok: true; minimumKW: number } | { ok: false; error: string }

/** Decimal digit arithmetic: neither exponent notation nor floating MW multiplication. */
export function parseHypotheticalMinimum(input: string): ParsedMinimum {
  const text = input.trim()
  if (!text) return { ok: false, error: "Enter a hypothetical minimum from 0 to 7.0 MW." }
  const match = /^(\d{1,2})(?:\.(\d+))?$/.exec(text)
  if (!match) return { ok: false, error: "Use a decimal number from 0 to 7.0 MW, in steps of 0.1 MW." }
  const fraction = match[2] ?? ""
  if (fraction.length > 12 || /[1-9]/.test(fraction.slice(1))) return { ok: false, error: "Use steps of 0.1 MW." }
  const tenths = Number(match[1]) * 10 + Number(fraction[0] ?? "0")
  if (tenths > 70) return { ok: false, error: "The hypothetical minimum must be between 0 and 7.0 MW." }
  return { ok: true, minimumKW: tenths * 100 }
}

export function canCompareHypotheticalMinimum(record: AssessmentRecord, source: HypotheticalMinimumSource | null | undefined): source is HypotheticalMinimumSource {
  return Boolean(source && source.publicationId === "demo-01-b" && source.version === "1.0.0"
    && /^[a-f0-9]{64}$/.test(source.snapshotSha256)
    && record.scenario === "b" && record.publication.id === source.publicationId
    && record.publication.version === source.version && record.basis.id === source.basisId
    && record.requestedProfile.basisId === source.basisId && record.modeledEligible.basisId === source.basisId
    && record.requestedProfile.incrementKW === source.requestedKW && source.requestedKW === 7_000
    && record.modeledEligible.status === "known" && record.modeledEligible.valueKW === source.modeledKW
    && record.revisedProfile?.incrementKW === source.modeledKW && source.modeledKW === 5_800
    && record.revisedProfile.basisId === source.basisId && record.minimumViableIncrementKW === null)
}

/** A presentation comparison, deliberately not an AssessmentRecord or screening result. */
export function compareHypotheticalMinimum(record: AssessmentRecord, source: HypotheticalMinimumSource, assumption: HypotheticalMinimum) {
  if (assumption.origin !== "visitor-assumption" || !canCompareHypotheticalMinimum(record, source)
    || assumption.source.publicationId !== source.publicationId || assumption.source.version !== source.version
    || assumption.source.snapshotSha256 !== source.snapshotSha256 || assumption.source.basisId !== source.basisId
    || assumption.source.requestedKW !== source.requestedKW || assumption.source.modeledKW !== source.modeledKW
    || !Number.isInteger(assumption.minimumKW) || assumption.minimumKW < 0
    || assumption.minimumKW > assumption.source.requestedKW || assumption.minimumKW % 100 !== 0) return null
  const marginKW = assumption.source.modeledKW - assumption.minimumKW
  return { minimumKW: assumption.minimumKW, recordedRevisionKW: assumption.source.modeledKW, marginKW,
    relation: marginKW > 0 ? "above" as const : marginKW < 0 ? "below" as const : "equal" as const }
}
