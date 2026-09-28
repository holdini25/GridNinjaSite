import { afterEach, describe, expect, it, vi } from "vitest"
import { readFacilityPreferences, subscribeFacilityPreferences, writeFacilityPreferences } from "@/lib/facility/preferences"

afterEach(() => { vi.restoreAllMocks(); window.sessionStorage.clear() })

describe("tab-session facility preferences", () => {
  it("stores explicit motion preferences, scopes Close to a release, and notifies mounted viewers", () => {
    const changed = vi.fn(), unsubscribe = subscribeFacilityPreferences(changed)
    writeFacilityPreferences({ paused: true, equipmentEnabled: false, closeRelease: "facility-v4" })
    expect(readFacilityPreferences()).toEqual({ paused: true, equipmentEnabled: false, closedReleases: ["facility-v4"] })
    writeFacilityPreferences({ closeRelease: "facility-v5" })
    writeFacilityPreferences({ openRelease: "facility-v4" })
    expect(readFacilityPreferences().closedReleases).toEqual(["facility-v5"])
    expect(changed).toHaveBeenCalledTimes(3)
    unsubscribe()
    writeFacilityPreferences({ paused: false })
    expect(changed).toHaveBeenCalledTimes(3)
  })
  it("does not trust malformed or unbounded saved values", () => {
    for (const value of ['{"paused":"yes","closedReleases":[]}', '{"closedReleases":[3]}', '{broken', JSON.stringify({ closedReleases: Array(40).fill("r") })]) {
      window.sessionStorage.setItem("gridninja.facility.preferences.v1", value)
      expect(readFacilityPreferences()).toEqual({ closedReleases: [] })
    }
  })
  it("keeps explicit choices in memory when browser storage is denied", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Denied", "SecurityError") })
    writeFacilityPreferences({ paused: true, closeRelease: "private-tab" })
    expect(readFacilityPreferences()).toEqual({ paused: true, closedReleases: ["private-tab"] })
    writeFacilityPreferences({ equipmentEnabled: false, openRelease: "private-tab" })
    expect(readFacilityPreferences()).toEqual({ paused: true, equipmentEnabled: false, closedReleases: [] })
  })
})
