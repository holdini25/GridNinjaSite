import type { FacilityQuality, FacilityView } from "@/types/facility"

/** Preferences are retained independently of the motion that can currently run. */
export function facilityMotionStatus({ ready, loading, reducedMotion, paused, equipmentEnabled, quality, view, readingHold = false }: {
  ready: boolean; loading: boolean; reducedMotion: boolean; paused: boolean; equipmentEnabled: boolean; quality: FacilityQuality | null; view: FacilityView; readingHold?: boolean
}) {
  if (!ready) return { label: loading ? "Loading 3D…" : "Static illustration", canPause: false, active: false }
  if (reducedMotion) return { label: "Reduced motion", canPause: false, active: false }
  if (paused) return { label: "Paused", canPause: true, active: false }
  if (!equipmentEnabled) return { label: "Equipment motion off", canPause: false, active: false }
  if (quality === "still") return { label: "Still for performance", canPause: false, active: false }
  if (readingHold) return { label: "Activity paused while reading", canPause: true, active: false }
  if (view.kind === "specimen" && (view.pose !== "closed" || view.rack?.door === "open" || view.rack?.cutaway || view.rack?.tray === "extended")) return { label: "Still for inspection", canPause: true, active: false }
  return { label: "Illustrative activity on", canPause: true, active: true }
}
