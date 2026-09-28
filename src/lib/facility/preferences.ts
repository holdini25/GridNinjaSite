/** Small tab-session preferences; storage denial falls back to this window's memory. */
export type FacilityPreferences = { paused?: boolean; equipmentEnabled?: boolean; closedReleases: string[] }
const KEY = "gridninja.facility.preferences.v1"
const EVENT = "gridninja:facility-preferences"
let storageDenied = false
let memory: FacilityPreferences = { closedReleases: [] }

function valid(value: unknown): value is FacilityPreferences {
  if (!value || typeof value !== "object") return false
  const item = value as FacilityPreferences
  return (item.paused === undefined || typeof item.paused === "boolean") &&
    (item.equipmentEnabled === undefined || typeof item.equipmentEnabled === "boolean") &&
    Array.isArray(item.closedReleases) && item.closedReleases.length <= 32 && item.closedReleases.every(id => typeof id === "string" && id.length <= 120)
}
export function readFacilityPreferences(): FacilityPreferences {
  try {
    if (storageDenied) return { ...memory, closedReleases: [...memory.closedReleases] }
    const raw = window.sessionStorage.getItem(KEY)
    if (raw) {
      try { const value: unknown = JSON.parse(raw); memory = valid(value) ? value : { closedReleases: [] } } catch { memory = { closedReleases: [] } }
    }
    else memory = { closedReleases: [] }
  } catch { /* Private browsing, policy restrictions, or malformed storage. */ }
  return { ...memory, closedReleases: [...memory.closedReleases] }
}
export function writeFacilityPreferences(update: Partial<Pick<FacilityPreferences, "paused" | "equipmentEnabled">> & { closeRelease?: string; openRelease?: string }) {
  const previous = readFacilityPreferences()
  const closed = new Set(previous.closedReleases)
  if (update.closeRelease) closed.add(update.closeRelease)
  if (update.openRelease) closed.delete(update.openRelease)
  memory = { ...previous, ...(update.paused !== undefined ? { paused: update.paused } : {}), ...(update.equipmentEnabled !== undefined ? { equipmentEnabled: update.equipmentEnabled } : {}), closedReleases: [...closed].slice(-32) }
  try { window.sessionStorage.setItem(KEY, JSON.stringify(memory)) } catch { storageDenied = true /* Memory remains authoritative when writes are denied. */ }
  window.dispatchEvent(new Event(EVENT))
}
export function subscribeFacilityPreferences(listener: () => void) {
  window.addEventListener(EVENT, listener)
  return () => window.removeEventListener(EVENT, listener)
}
