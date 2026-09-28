// @vitest-environment node
import { describe, expect, it } from "vitest"
import { QUERY_STARTUP_CASES, assertQueryPresentation, localQueryBase } from "../../../scripts/qa/query-startup.mjs"
import { assessmentFixtures } from "../../../src/content/assessments/fixtures"
import { selectAssessment } from "../../../src/lib/assessment/selectors"

describe("query startup diagnostics keep identity and truth separate from speed", () => {
  it("allows only a bare loopback origin", () => {
    expect(localQueryBase("http://127.0.0.1:3000/")).toBe("http://127.0.0.1:3000")
    for (const url of ["https://gridninja.ai", "http://localhost.evil.test", "http://name:secret@localhost", "http://localhost:3000/demo", "http://localhost:3000/?token=private"]) expect(() => localQueryBase(url)).toThrow()
  })
  it("includes selected publication, focus/topic, campaign and inquiry cases without private inquiry data", () => {
    expect(QUERY_STARTUP_CASES).toHaveLength(5)
    expect(new Set(QUERY_STARTUP_CASES.map(item => item.id)).size).toBe(5)
    expect(QUERY_STARTUP_CASES.find(item => item.scenario === "d")?.route).toContain("version=1.0.0")
    expect(QUERY_STARTUP_CASES.find(item => item.focus)?.route).toContain("focus=rack-02&topic=ai-cloud")
    expect(QUERY_STARTUP_CASES.some(item => item.route.includes("utm_source=qa"))).toBe(true)
    expect(QUERY_STARTUP_CASES.some(item => item.route.startsWith("/assessment?topic=ai-cloud&source=demo-final"))).toBe(true)
    expect(QUERY_STARTUP_CASES.some(item => /(?:email|name|message|inquiry)=/.test(item.route))).toBe(false)
  })
  it("rejects substituted capacity and destinations for fixture D before and after graphics", () => {
    const testCase = QUERY_STARTUP_CASES.find(item => item.scenario === "d")!
    const expected = selectAssessment(assessmentFixtures.d)
    const state = { url: "http://localhost:3000" + testCase.route, summary: { requested: expected.requested, modeled: "Unknown", scenario: "d", text: "Model screen: NO-PROOF" }, links: Object.values(expected.links), perspective: "engineering" }
    expect(() => assertQueryPresentation(testCase, state, expected)).not.toThrow()
    expect(() => assertQueryPresentation(testCase, { ...state, summary: { ...state.summary, modeled: "5.8 MW" } }, expected)).toThrow()
    expect(() => assertQueryPresentation(testCase, { ...state, links: Object.values(selectAssessment(assessmentFixtures.b).links) }, expected)).toThrow(/publication/)
  })
  it("requires focus identity to remain committed after enhancement and query context to persist", () => {
    const testCase = QUERY_STARTUP_CASES.find(item => item.focus)!
    const expected = { ...selectAssessment(assessmentFixtures.b), targetLabel: "Rack 03" }
    const state = { url: "http://localhost:3000" + testCase.route, summary: { requested: expected.requested, modeled: expected.modeled, scenario: "b", text: "Model screen: REPAIR" }, links: Object.values(expected.links), perspective: "business", targetText: "Selected equipment: Rack 03", selectedEquipment: ["rack-02"] }
    expect(() => assertQueryPresentation(testCase, state, expected, { enhanced: true })).not.toThrow()
    expect(() => assertQueryPresentation(testCase, { ...state, selectedEquipment: [] }, expected, { enhanced: true })).toThrow(/committed/)
    expect(() => assertQueryPresentation(testCase, { ...state, url: "http://localhost:3000/demo?scenario=b" }, expected)).toThrow(/query/)
  })
  it("keeps the inquiry topic editable and the form free of a graphics session", () => {
    const testCase = QUERY_STARTUP_CASES.find(item => !item.scenario)!
    const state = { url: "http://localhost:3000" + testCase.route, topic: "ai-cloud", canvases: 0 }
    expect(() => assertQueryPresentation(testCase, state, null)).not.toThrow()
    expect(() => assertQueryPresentation(testCase, { ...state, topic: "" }, null)).toThrow(/topic/)
    expect(() => assertQueryPresentation(testCase, { ...state, canvases: 1 }, null)).toThrow(/graphics/)
  })
  it("records pre-hydration attribution without accepting an unsettled final form", () => {
    const testCase = QUERY_STARTUP_CASES.find(item => !item.scenario)!
    const state = { url: "http://localhost:3000" + testCase.route, topic: "", canvases: 0 }
    expect(() => assertQueryPresentation(testCase, state, null, { settled: false })).not.toThrow()
    expect(() => assertQueryPresentation(testCase, state, null)).toThrow(/topic/)
    expect(() => assertQueryPresentation(testCase, { ...state, canvases: 1 }, null, { settled: false })).toThrow(/graphics/)
  })
})
