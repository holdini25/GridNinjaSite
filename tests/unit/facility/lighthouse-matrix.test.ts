// @vitest-environment node
import { describe, expect, it } from "vitest"
import { assertLighthouseMatrixIndex, lighthouseGroups, lighthouseRoutePolicy, lighthouseSlug, performanceMatrix } from "../../../scripts/facility/lighthouse-matrix.mjs"

const completedIndex = (name = "premium-civic") => {
  const matrix = performanceMatrix(name)
  return { result: "pass", matrix: matrix.name, runs: matrix.profiles.flatMap(profile => matrix.routes.flatMap(route => Array.from({ length: matrix.runs }, (_, index) => ({ route, profile, run: index + 1, complete: true })))) }
}

describe("release performance route coverage", () => {
  it("adds founder coverage while preserving all thirteen existing release routes without duplicates", () => {
    const matrix = performanceMatrix("premium-civic")
    expect(matrix.reviewedRoutes).toHaveLength(10)
    expect(matrix.routes).toHaveLength(14)
    expect(new Set(matrix.routes).size).toBe(14)
    expect(matrix.routes).toEqual(expect.arrayContaining(["/", "/assessment", "/demo", "/platform", "/proof", "/evidence", "/about", "/solutions/ai-cloud", "/solutions/colocation", "/solutions/bridge-power", "/contact", "/insights", "/evidence/assessments/demo-01-b/v1.0.0", "/about/founders"]))
    expect(matrix.reviewedRoutes.length * matrix.profiles.length * matrix.runs).toBe(100)
    expect(matrix.routes.length * matrix.profiles.length * matrix.runs).toBe(140)
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

  it("runs complete mobile Home and Contact groups first while preserving the exact 140 release samples", () => {
    const matrix = performanceMatrix("premium-civic")
    const groups = lighthouseGroups(matrix.name)
    expect(groups).toHaveLength(28)
    expect(groups.slice(0, 2)).toEqual([
      { profile: "mobile", route: "/" },
      { profile: "mobile", route: "/contact" },
    ])
    const runs = groups.flatMap(({ profile, route }) => Array.from({ length: matrix.runs }, (_, index) => ({ profile, route, run: index + 1, complete: true })))
    const key = ({ profile, route, run }: { profile: string; route: string; run: number }) => `${profile}|${route}|${run}`
    expect(runs).toHaveLength(140)
    expect(new Set(runs.map(key)).size).toBe(140)
    expect(runs.map(key).sort()).toEqual(completedIndex().runs.map(key).sort())
    expect(() => assertLighthouseMatrixIndex({ matrix: matrix.name, result: "pass", runs }, matrix)).not.toThrow()
    const originalGroups = matrix.profiles.flatMap(profile => matrix.routes.map(route => ({ profile, route })))
    expect(groups.slice(2)).toEqual(originalGroups.filter(({ profile, route }) => profile !== "mobile" || (route !== "/" && route !== "/contact")))
  })

  it("keeps the core collector's original desktop-then-mobile route order", () => {
    expect(lighthouseGroups()).toEqual([
      { profile: "desktop", route: "/" },
      { profile: "desktop", route: "/demo" },
      { profile: "desktop", route: "/assessment" },
      { profile: "mobile", route: "/" },
      { profile: "mobile", route: "/demo" },
      { profile: "mobile", route: "/assessment" },
    ])
    expect(() => lighthouseGroups("premium-civc")).toThrow("Unknown")
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
    expect(lighthouseRoutePolicy("/about/founders")).toMatchObject({ lcp: 2500, cls: .1, seo: 100 })
  })
})
