export type EvidenceMaturity =
  | "DESIGN TARGET"
  | "IMPLEMENTED"
  | "REPLAY-VALIDATED"
  | "SHADOW-VALIDATED"
  | "PILOT-VALIDATED"
  | "PRODUCTION-VALIDATED"
  | "OPERATOR-ACCEPTED"
  | "THIRD-PARTY-VALIDATED"
  | "PLANNED"

export const SYNTHETIC_SCENARIO_CAVEAT =
  "Synthetic illustrative scenario—not a customer or production result." as const
