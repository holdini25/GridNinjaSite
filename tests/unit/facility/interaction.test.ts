import { describe, expect, it } from "vitest"
import { facilityPreview, facilityPreviewTarget, facilityReducer, initialFacilityPresentation } from "@/lib/facility/interaction"
import { eligibleForAutomaticFacility } from "@/lib/facility/loading-policy"
import type { FacilityLoadEnvironment } from "@/lib/facility/loading-policy"
import { cancelGesture, canvasNdc, pointerDown, pointerMove, pointerUp } from "@/lib/facility/gesture"
import { facilitySystemDescription, facilityWalkthrough, facilityTargetConnections, facilityEquipmentIdentification } from "@/lib/facility/content"
import { assessmentFixtures } from "@/content/assessments/fixtures"

describe("facility presentation lifecycle", () => {
  it("requires staged then presented, and ignores previous-session completions after close and retry", () => {
    let state = facilityReducer(initialFacilityPresentation("r1"), { type: "activate" })
    const staleToken = { release: "r1", generation: state.media.generation }
    expect(facilityReducer(state, { type: "presented", token: staleToken }).media.phase).toBe("loading")
    state = facilityReducer(state, { type: "close" })
    state = facilityReducer(state, { type: "activate" })
    expect(facilityReducer(state, { type: "failed", token: staleToken, reason: "timeout" })).toBe(state)
    expect(facilityReducer(state, { type: "staged", token: staleToken })).toBe(state)
    const token = { release: "r1", generation: state.media.generation }
    state = facilityReducer(state, { type: "staged", token })
    state = facilityReducer(state, { type: "presented", token })
    expect(state.media.phase).toBe("ready")
    expect(state.automaticAttempted).toBe(true)
  })

  it("invalidates failed generations and prevents model selection while hidden", () => {
    let state = facilityReducer(initialFacilityPresentation("r1"), { type: "activate" })
    const token = { release: "r1", generation: state.media.generation }
    state = facilityReducer(state, { type: "staged", token })
    state = facilityReducer(state, { type: "presented", token })
    expect(facilityReducer(state, { type: "select", system: "power", token }).selected).toBeNull()
    state = facilityReducer(state, { type: "visibility", inViewport: true, documentVisible: true })
    state = facilityReducer(state, { type: "select", system: "power", token })
    expect(state.selected).toBe("power")
    state = facilityReducer(state, { type: "failed", token, reason: "context_lost" })
    expect(state.media.generation).toBeGreaterThan(token.generation)
    expect(facilityReducer(state, { type: "presented", token })).toBe(state)
    expect(state.selected).toBe("power")
  })

  it("keeps preview owners independent and never lets hover replace committed selection", () => {
    let state = facilityReducer(initialFacilityPresentation("r1"), { type: "select", system: "power" })
    state = facilityReducer(state, { type: "preview", channel: "pointer", owner: "old", system: "cooling" })
    state = facilityReducer(state, { type: "preview", channel: "pointer", owner: "new", system: "storage" })
    state = facilityReducer(state, { type: "preview-end", channel: "pointer", owner: "old" })
    expect(facilityPreview(state)).toBe("storage")
    state = facilityReducer(state, { type: "preview", channel: "focus", owner: "keyboard", system: "workloads" })
    expect(facilityPreview(state)).toBe("workloads")
    expect(state.selected).toBe("power")
    state = facilityReducer(state, { type: "clear" })
    expect(facilityPreview(state)).toBeNull()
    expect(state.selected).toBeNull()
  })

  it("defaults motion by device once and preserves deliberate preferences through reset and resize", () => {
    let desktop = facilityReducer(initialFacilityPresentation("r1"), { type: "preferences", desktop: true, reducedMotion: false })
    expect(desktop.equipmentEnabled).toBe(true)
    const mobile = facilityReducer(initialFacilityPresentation("r1"), { type: "preferences", desktop: false, reducedMotion: false })
    expect(mobile.equipmentEnabled).toBe(false)
    desktop = facilityReducer(desktop, { type: "equipment", enabled: false })
    desktop = facilityReducer(desktop, { type: "pause", paused: true })
    desktop = facilityReducer(desktop, { type: "clear" })
    desktop = facilityReducer(desktop, { type: "preferences", desktop: false, reducedMotion: true })
    desktop = facilityReducer(desktop, { type: "preferences", desktop: true, reducedMotion: false })
    expect(desktop.equipmentEnabled).toBe(false)
    expect(desktop.paused).toBe(true)
  })
})

describe("automatic facility loading", () => {
  const eligible: FacilityLoadEnvironment = { mode: "auto-desktop", automaticAttempted: false, desktop: true, preferencesReady: true, reducedMotion: false, inViewport: true, documentVisible: true, pageLoaded: true, posterDecoded: true }
  it("permits eligible Safari without Network Information and checks every activation prerequisite", () => {
    expect(eligibleForAutomaticFacility(eligible)).toBe(true)
    for (const flag of ["desktop", "preferencesReady", "inViewport", "documentVisible", "pageLoaded", "posterDecoded"] as const) expect(eligibleForAutomaticFacility({ ...eligible, [flag]: false })).toBe(false)
    expect(eligibleForAutomaticFacility({ ...eligible, reducedMotion: true })).toBe(false)
    expect(eligibleForAutomaticFacility({ ...eligible, automaticAttempted: true })).toBe(false)
    expect(eligibleForAutomaticFacility({ ...eligible, mode: "manual" })).toBe(false)
    expect(eligibleForAutomaticFacility({ ...eligible, mode: "poster" })).toBe(false)
  })
  it("respects Save-Data and slow connections without excluding a known fast connection", () => {
    expect(eligibleForAutomaticFacility({ ...eligible, connection: { effectiveType: "4g" } })).toBe(true)
    expect(eligibleForAutomaticFacility({ ...eligible, connection: { saveData: true, effectiveType: "4g" } })).toBe(false)
    for (const effectiveType of ["slow-2g", "2g", "3g"]) expect(eligibleForAutomaticFacility({ ...eligible, connection: { effectiveType } })).toBe(false)
  })
})

describe("model gestures in CSS pixels", () => {
  it("rejects an excursion followed by a return, cancellation, another pointer, or another system", () => {
    const down = pointerDown(1, "cooling", 100, 100)
    expect(pointerUp(down, 1, "cooling", 106, 100)).toBe("cooling")
    const excursion = pointerMove(down, 1, 107, 100)
    expect(pointerUp(excursion, 1, "cooling", 100, 100)).toBeNull()
    expect(pointerUp(cancelGesture(down), 1, "cooling", 100, 100)).toBeNull()
    expect(pointerUp(down, 2, "cooling", 100, 100)).toBeNull()
    expect(pointerUp(down, 1, "power", 100, 100)).toBeNull()
  })
  it("normalizes the measured canvas rect and excludes out-of-bounds or zero-size hits", () => {
    const rect = { left: 10, top: 20, width: 200, height: 100 }
    expect(canvasNdc(110, 70, rect)).toEqual([0, 0])
    expect(canvasNdc(9, 70, rect)).toBeNull()
    expect(canvasNdc(110, 70, { ...rect, width: 0 })).toBeNull()
  })
})

describe("assessment-backed facility explanation", () => {
  it("describes missing cooling and unassessed storage without inventing an independent capacity bound", () => {
    expect(facilitySystemDescription(assessmentFixtures.d, "cooling")).toEqual({ label: "Cooling evidence missing", body: "No cooling evidence is supplied for this fixture’s assessment window." })
    for (const record of Object.values(assessmentFixtures)) {
      const storage = facilitySystemDescription(record, "storage")
      expect(storage.body).toContain("unassessed")
      expect(storage.body).toContain("Contribution and duration unassessed.")
      expect(storage.body).not.toMatch(/MW|binding|accepted increment/)
    }
  })
  it("uses each record's workload revision, minimum and commercial question", () => {
    expect(facilitySystemDescription(assessmentFixtures.b, "workloads").body).toContain("5.8 MW proposed revision")
    expect(facilitySystemDescription(assessmentFixtures.c, "workloads").body).toContain("6.5 MW stated minimum")
    expect(facilitySystemDescription(assessmentFixtures.d, "workloads").body).not.toContain("5.8 MW")
  })
})

describe("adaptive facility policy", () => {
  const environment: FacilityLoadEnvironment = { mode: "auto-adaptive", automaticAttempted: false, desktop: false, preferencesReady: true, reducedMotion: false, inViewport: true, documentVisible: true, pageLoaded: true, posterDecoded: true, posterPainted: true }
  it("allows narrow/coarse devices and reduced-motion still 3D only after the poster has painted", () => {
    expect(eligibleForAutomaticFacility(environment)).toBe(true)
    expect(eligibleForAutomaticFacility({ ...environment, reducedMotion: true })).toBe(true)
    expect(eligibleForAutomaticFacility({ ...environment, posterPainted: false })).toBe(false)
    expect(eligibleForAutomaticFacility({ ...environment, posterPainted: undefined })).toBe(false)
    for (const environmentPatch of [{ connection: { saveData: true } }, { connection: { effectiveType: "3g" } }, { documentVisible: false }, { inViewport: false }, { automaticAttempted: true }]) expect(eligibleForAutomaticFacility({ ...environment, ...environmentPatch })).toBe(false)
  })
  it("defaults adaptive equipment motion on, then restores explicit tab preferences without changing reduced motion", () => {
    let state = facilityReducer(initialFacilityPresentation("facility-v4"), { type: "preferences", desktop: false, reducedMotion: true, adaptive: true })
    expect(state.equipmentEnabled).toBe(true)
    state = facilityReducer(state, { type: "restore-preferences", paused: true, equipmentEnabled: false, closed: true })
    expect(state).toMatchObject({ paused: true, equipmentEnabled: false, reducedMotion: true, automaticAttempted: true })
    state = facilityReducer(state, { type: "clear" })
    expect(state).toMatchObject({ paused: true, equipmentEnabled: false, automaticAttempted: true })
  })
})


describe("authored targets and walkthrough", () => {
  it("keeps equipment/route/part previews independent even within a selected system", () => {
    let state = facilityReducer(initialFacilityPresentation("facility-v4"), { type: "select", system: "workloads", target: { system: "workloads", equipmentId: "rack-1" } })
    state = facilityReducer(state, { type: "preview", channel: "pointer", owner: "diagram", system: "workloads", target: { system: "workloads", equipmentId: "rack-2" } })
    expect(state.target?.equipmentId).toBe("rack-1")
    expect(facilityPreviewTarget(state)?.equipmentId).toBe("rack-2")
    state = facilityReducer(state, { type: "preview", channel: "focus", owner: "part", system: "workloads", target: { system: "workloads", partId: "server-module" } })
    expect(facilityPreviewTarget(state)?.partId).toBe("server-module")
    state = facilityReducer(state, { type: "preview-end", channel: "focus", owner: "old-part" })
    expect(facilityPreviewTarget(state)?.partId).toBe("server-module")
    expect(facilityReducer(state, { type: "clear" }).target).toBeNull()
  })
  it("keeps the four manual walkthrough steps tied to every authoritative fixture", () => {
    const original = JSON.stringify(assessmentFixtures)
    for (const record of Object.values(assessmentFixtures)) {
      const steps = facilityWalkthrough(record)
      expect(steps).toHaveLength(4)
      expect(steps.map(step => step.title)).toEqual(["Request", "Conditions", "Screening result", "Evidence"])
      expect(steps[2].body).toContain(record.screeningOutcome)
      expect(steps[2].body).toContain(record.commercial.question)
      expect(steps[3].links.brief).toBe(`/evidence/assessments/${record.publication.id}/v${record.publication.version}`)
      expect(steps[3].links.pdf).toBe(`/downloads/assessment/${record.publication.id}/v${record.publication.version}/pdf`)
      expect(steps[3].links.json).toBe(`/downloads/assessment/${record.publication.id}/v${record.publication.version}/json`)
      if (record.scenario === "d") { expect(steps[1].evidence[1].body).toContain("No cooling evidence"); expect(steps[2].body).toContain("Unknown"); expect(steps[2].body).not.toContain("5.8 MW") }
    }
    expect(JSON.stringify(assessmentFixtures)).toBe(original)
  })
})


it("describes authored adjacency from route endpoints and part metadata without inventing connections", () => {
  const bounds = { min: [0, 0, 0] as [number, number, number], max: [1, 1, 1] as [number, number, number] }
  const metadata = { topology: {
    schemaVersion: "facility-topology.v1" as const,
    equipment: [{ id: "distribution", index: 0, label: "Electrical distribution", system: "power" as const, role: "switchgear", bounds, diagram: [0, 0] as [number, number] }, { id: "rack", index: 1, label: "Server rack 01", system: "workloads" as const, role: "rack", bounds, diagram: [1, 1] as [number, number] }],
    ports: [{ id: "feed", equipmentId: "distribution", service: "electrical", position: [0, 0, 0] as [number, number, number] }, { id: "tap", equipmentId: "rack", service: "electrical", position: [1, 1, 1] as [number, number, number] }],
    routes: [{ id: "busway", index: 0, system: "power" as const, service: "single_feed", from: "feed", to: "tap", path: [], lengthMetres: 1 }], internalLinks: [],
  } }
  expect(facilityEquipmentIdentification("facility-v4", "power", metadata)).toBe("Shown: Electrical distribution.")
  expect(facilityEquipmentIdentification("facility-v4", "workloads", metadata)).toBe("Shown: Server rack 01.")
  expect(facilityEquipmentIdentification("facility-v4", "cooling", metadata)).toBeNull()
  const pose = { camera: { camera: [3, 3, 3] as [number, number, number], target: [0, 1, 0] as [number, number, number], padding: 1.12 }, transforms: [] }
  const specimen = { schemaVersion: "facility-specimen.v1" as const, kind: "rack" as const, system: "workloads" as const, parts: [], poses: { closed: pose, cutaway: pose, service: pose } }
  // The retained facility topology supplies return context, not the visible assembly inventory.
  expect(facilityEquipmentIdentification("facility-v11", "workloads", { ...metadata, specimen })).toBe("Shown: a representative illustrative rack assembly.")
  expect(facilityEquipmentIdentification("facility-v11", "power", { ...metadata, specimen })).toBeNull()
  expect(facilityEquipmentIdentification("facility-v11", "cooling", { ...metadata, specimen: { ...specimen, kind: "cooling", system: "cooling" } })).toBe("Shown: a representative illustrative cooling assembly.")
  expect(facilityEquipmentIdentification("facility-v11", "workloads", metadata)).toBe("Shown: Server rack 01.")
  expect(facilityTargetConnections(metadata, { system: "power", equipmentId: "distribution" })).toEqual([{ label: "single feed → Server rack 01", target: { system: "power", routeId: "busway" } }])
  expect(facilityTargetConnections({ topology: { ...metadata.topology, schemaVersion: "facility-topology.v2" } }, { system: "power", equipmentId: "distribution" })).toEqual([{ label: "single feed · Server rack 01", target: { system: "power", routeId: "busway" } }])
  expect(facilityTargetConnections(metadata, { system: "power", routeId: "busway" }).map(item => item.label)).toEqual(["Electrical distribution", "Server rack 01"])
  expect(facilityTargetConnections(metadata, { system: "cooling", equipmentId: "not-authored" })).toEqual([])
  expect(facilityTargetConnections({}, { system: "power" })).toEqual([])
})
