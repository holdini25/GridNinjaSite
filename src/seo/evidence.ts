export const EVIDENCE_MATURITY_LABELS = [
  "Specified",
  "Implemented and tested in a stated environment",
  "Evaluated with authorized site data",
  "Accepted for a stated customer decision",
] as const
export type EvidenceMaturity = (typeof EVIDENCE_MATURITY_LABELS)[number]
export const SYNTHETIC_SCENARIO_CAVEAT =
  "Synthetic illustrative scenario—not a customer or production result." as const
