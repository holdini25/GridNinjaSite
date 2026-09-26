import { describe, expect, it } from "vitest"
import { assessmentFixtures } from "@/content/assessments/fixtures"
import { ecosystemDiagramPresentation, ecosystemNarrative, ecosystemRepresentativeRack, ECOSYSTEM_CHAPTER_SECONDS } from "@/lib/facility/ecosystem-narrative"
import { createEcosystemActivity } from "@/lib/facility/ecosystem-activity"
import type { FacilityEcosystemProfile, FacilityTopology } from "@/types/facility"
import topologySource from "./fixtures/ecosystem-topology.json"

describe("record-backed ecosystem narrative", () => {
  it("retains every authoritative result and versioned publication through the six chapters", () => {
    const original = JSON.stringify(assessmentFixtures)
    expect(ECOSYSTEM_CHAPTER_SECONDS.reduce((sum, seconds) => sum + seconds, 0)).toBe(24)
    for (const record of Object.values(assessmentFixtures)) {
      const story = ecosystemNarrative(record)
      expect(story.chapters).toHaveLength(6)
      expect(story.chapters[0].body).toContain("whole facility")
      expect(story.chapters[0].body).toContain("20.0 MW")
      expect(story.chapters[0].body).toContain("no share")
      expect(story.chapters[4].body).toContain(record.conclusion)
      expect(story.links.brief).toBe(`/evidence/assessments/demo-01-${record.scenario}/v1.0.0`)
      expect(story.storage).toContain("unassessed")
      expect(story.storage).not.toMatch(/\d|binding|support duration/i)
    }
    expect(JSON.stringify(assessmentFixtures)).toBe(original)
  })

  it("offers only the recorded B revision and never fabricates a D result", () => {
    const b = ecosystemNarrative(assessmentFixtures.b)
    expect(b.comparison).toEqual({ requested: "7.0 MW", revised: "5.8 MW", question: assessmentFixtures.b.commercial.question })
    for (const scenario of ["a", "c", "d"] as const) expect(ecosystemNarrative(assessmentFixtures[scenario]).comparison).toBeNull()
    const d = ecosystemNarrative(assessmentFixtures.d)
    expect(d.missingCooling).toBe(true)
    expect(d.chapters[2].body).toContain("Playback stops here")
    expect(d.chapters[4].body).toContain("Unknown")
    expect(JSON.stringify(d)).not.toContain("5.8 MW")
    expect(ecosystemNarrative(assessmentFixtures.c).chapters[4].body).toContain("6.5 MW minimum")
  })

  it("accepts only an authored rack as the representative inspection anchor", () => {
    const topology: FacilityTopology = { schemaVersion: "facility-topology.v1", equipment: [
      { id: "rack-08", index: 0, label: "Rack 09", system: "workloads", role: "server_rack", bounds: { min: [0, 0, 0], max: [1, 1, 1] }, diagram: [0, 0] },
      { id: "reserve-0", index: 1, label: "Reserve 1", system: "storage", role: "illustrative_reserve", bounds: { min: [0, 0, 0], max: [1, 1, 1] }, diagram: [0, 1] },
    ], ports: [], routes: [], internalLinks: [] }
    expect(ecosystemRepresentativeRack({ system: "workloads", equipmentId: "rack-08" }, topology)).toBe("rack-08")
    expect(ecosystemRepresentativeRack({ system: "storage", equipmentId: "reserve-0" }, topology)).toBe("rack-02")
    expect(ecosystemRepresentativeRack({ system: "workloads", equipmentId: "rack-invented" }, topology)).toBe("rack-02")
    expect(ecosystemRepresentativeRack(null)).toBe("rack-02")
  })

  it("keeps diagram route segments in parity with every runtime chapter and D's missing cooling", () => {
    const topology = topologySource as FacilityTopology
    const profile: FacilityEcosystemProfile = { version: 1, seed: 1, ambientIntervalSeconds: [12, 18], sequenceSeconds: 8, chapterSeconds: [4, 4, 5, 4, 4, 3], colors: { electrical: "#eeeeee", cooling: "#77aabb", heat: "#aa8866" }, fanModulation: .1, maxEquipment: 96, maxRoutes: 128, maxTraces: 2 }
    const original = JSON.stringify(topology)
    for (const coolingEvidence of ["available", "missing"] as const) for (let chapter = 0; chapter < 6; chapter++) {
      const command = { revision: 1, seekRevision: 1, chapter, rackId: "rack-02", coolingEvidence, playing: false }
      const diagram = ecosystemDiagramPresentation(command, topology)!
      const runtime = createEcosystemActivity(topology, profile, () => {})
      runtime.command(command)
      const output = runtime.sample(0, 0, false, new Float32Array(144))
      const active = topology.routes.filter(route => output.routes[route.index] > 0)
      expect(new Set(diagram.routes.map(route => route.routeId))).toEqual(new Set(active.map(route => route.id)))
      expect(diagram.equipmentId).toBe("rack-02")
      for (const segment of diagram.routes) {
        const route = topology.routes.find(route => route.id === segment.routeId)!
        expect(segment.fromS).toBeCloseTo(output.routeFrom[route.index], 5)
        expect(segment.toS).toBeCloseTo(output.routeTo[route.index], 5)
        expect(route.medium).not.toBe("reserve-illustrative")
      }
      if (chapter === 1) {
        expect(diagram.routes.some(route => route.toS < 1)).toBe(true)
        expect(diagram.routes.some(route => route.routeId === "rack-feed-0-0")).toBe(false)
      }
      if (chapter === 2 && coolingEvidence === "missing") expect(diagram.routes).toEqual([])
    }
    expect(ecosystemDiagramPresentation({ chapter: null, rackId: "rack-02", coolingEvidence: "available" }, topology)).toBeNull()
    expect(JSON.stringify(topology)).toBe(original)
  })
})
