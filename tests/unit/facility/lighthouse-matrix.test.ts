// @vitest-environment node
import { describe, expect, it } from "vitest"
import { assertLighthouseMatrixIndex, lighthouseRoutePolicy, lighthouseSlug, performanceMatrix } from "../../../scripts/facility/lighthouse-matrix.mjs"

const completedIndex = (name = "premium-civic") => {
  const matrix = performanceMatrix(name)
  return { result: "pass", matrix: matrix.name, runs: matrix.profiles.flatMap(profile => matrix.routes.flatMap(route => Array.from({ length: matrix.runs }, (_, index) => ({ route, profile, run: index + 1, complete: true })))) }
}

describe("release performance route coverage", () => {
  it("includes the ten reviewed routes and preserves mandatory contact, insights and frozen-brief coverage without duplicates", () => {
    const matrix = performanceMatrix("premium-civic")
    expect(matrix.reviewedRoutes).toHaveLength(10)
    expect(matrix.routes).toHaveLength(13)
    expect(new Set(matrix.routes).size).toBe(13)
    expect(matrix.routes).toEqual(expect.arrayContaining(["/evidence", "/about", "/solutions/ai-cloud", "/solutions/colocation", "/solutions/bridge-power", "/contact", "/insights", "/evidence/assessments/demo-01-b/v1.0.0"]))
    expect(matrix.reviewedRoutes.length * matrix.profiles.length * matrix.runs).toBe(100)
    expect(matrix.routes.length * matrix.profiles.length * matrix.runs).toBe(130)
  })

  it("uses unambiguous output names for nested routes and frozen publication versions", () => {
    const matrix = performanceMatrix("premium-civic")
    expect(new Set(matrix.routes.map(lighthouseSlug)).size).toBe(matrix.routes.length)
    expect(lighthouseSlug("/evidence/assessments/demo-01-b/v1.0.0")).toBe("evidence--assessments--demo-01-b--v1.0.0")
    expect(() => lighthouseSlug("/../../outside")).toThrow()
  })

  it("retains the original thirty-run core matrix and rejects unknown names", () => {
    const matrix = performanceMatrix()
    expect(matrix.routes).toEqual(["/", "/demo", "/assessment"])
    expect(matrix.routes.length * matrix.profiles.length * matrix.runs).toBe(30)
    expect(() => performanceMatrix("premium-civc")).toThrow("Unknown")
  })

  it("does not relabel partial, duplicate, failed or differently scoped captures as a complete release matrix", () => {
    const matrix = performanceMatrix("premium-civic")
    expect(() => assertLighthouseMatrixIndex(completedIndex(), matrix)).not.toThrow()
    const missing = completedIndex(); missing.runs.pop()
    expect(() => assertLighthouseMatrixIndex(missing, matrix)).toThrow()
    const duplicate = completedIndex(); duplicate.runs[1] = { ...duplicate.runs[0] }
    expect(() => assertLighthouseMatrixIndex(duplicate, matrix)).toThrow()
    const incomplete = completedIndex(); incomplete.runs[0].complete = false
    expect(() => assertLighthouseMatrixIndex(incomplete, matrix)).toThrow()
    const extra = completedIndex(); extra.runs.push({ route: "/invented", profile: "desktop", run: 1, complete: true })
    expect(() => assertLighthouseMatrixIndex(extra, matrix)).toThrow()
    expect(() => assertLighthouseMatrixIndex(completedIndex("core"), matrix)).toThrow()
    expect(() => assertLighthouseMatrixIndex({ ...completedIndex(), result: "fail" }, matrix)).toThrow()
  })

  it("keeps contact stricter and the 2200ms design aim separate from the unchanged hard gates", () => {
    expect(lighthouseRoutePolicy("/")).toMatchObject({ lcp: 2500, cls: .1, lcpAim: 2200, seo: 100 })
    expect(lighthouseRoutePolicy("/contact")).toMatchObject({ lcp: 2000, cls: .05, seo: 100 })
    expect(lighthouseRoutePolicy("/evidence/assessments/demo-01-b/v1.0.0").seo).toBeNull()
    expect(lighthouseRoutePolicy("/evidence").seo).toBe(100)
  })
})
