import type { FacilityMode } from "@/types/facility"

export type FacilityConnection = { saveData?: boolean; effectiveType?: string }
export type FacilityLoadEnvironment = {
  mode: FacilityMode
  automaticAttempted: boolean
  desktop: boolean
  preferencesReady: boolean
  reducedMotion: boolean
  inViewport: boolean
  documentVisible: boolean
  pageLoaded: boolean
  posterDecoded: boolean
  posterPainted?: boolean
  connection?: FacilityConnection
}

export function eligibleForAutomaticFacility(environment: FacilityLoadEnvironment): boolean {
  const { connection } = environment
  const adaptive = environment.mode === "auto-adaptive"
  const deviceEligible = adaptive || (environment.mode === "auto-desktop" && environment.desktop && !environment.reducedMotion)
  return deviceEligible && (!adaptive || environment.posterPainted === true) && !environment.automaticAttempted && environment.preferencesReady && environment.inViewport && environment.documentVisible && environment.pageLoaded && environment.posterDecoded && !connection?.saveData && !["slow-2g", "2g", "3g"].includes(connection?.effectiveType ?? "")
}

/** Safari has no Network Information API; absence alone is not a rejection. */
export function facilityConnection(): FacilityConnection | undefined {
  return (navigator as Navigator & { connection?: FacilityConnection }).connection
}
