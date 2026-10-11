import assert from "node:assert/strict"

export const REVIEWED_ROUTES = Object.freeze(["/", "/assessment", "/demo", "/platform", "/proof", "/evidence", "/about", "/solutions/ai-cloud", "/solutions/colocation", "/solutions/bridge-power"])
export const MANDATORY_ADDITIONAL_ROUTES = Object.freeze(["/contact", "/insights", "/evidence/assessments/demo-01-b/v1.0.0"])
const coreRoutes = Object.freeze(["/", "/demo", "/assessment"])

/** The 100 reviewed-route captures are a subset of the 130 release captures,
 * never added a second time to the original 30 core-route captures. */
export function performanceMatrix(name = "core") {
  assert(["core", "premium-civic"].includes(name), "Unknown performance matrix")
  return Object.freeze({
    name,
    reviewedRoutes: name === "core" ? coreRoutes : REVIEWED_ROUTES,
    routes: name === "core" ? coreRoutes : Object.freeze([...REVIEWED_ROUTES, ...MANDATORY_ADDITIONAL_ROUTES]),
    profiles: Object.freeze(["desktop", "mobile"]),
    runs: 5,
  })
}

/** Prioritize the two known mobile LCP gates without reducing release coverage.
 * Each group still owns its five runs; all other groups retain their order. */
export function lighthouseGroups(name = "core") {
  const matrix = performanceMatrix(name)
  const groups = matrix.profiles.flatMap(profile => matrix.routes.map(route => Object.freeze({ profile, route })))
  if (matrix.name !== "premium-civic") return Object.freeze(groups)
  const priority = group => group.profile === "mobile" && ["/", "/contact"].includes(group.route)
  return Object.freeze([...groups.filter(priority), ...groups.filter(group => !priority(group))])
}

export function lighthouseRoutePolicy(route) {
  return Object.freeze({
    lcp: route === "/contact" ? 2000 : 2500,
    fcp: 1800, tbt: 200, cls: route === "/contact" ? .05 : .1,
    performance: 90, accessibility: 95, bestPractices: 95,
    seo: route.startsWith("/evidence/assessments/") ? null : 100,
    // An improvement aim is reported separately and never alters hard gates.
    lcpAim: route === "/contact" ? 2000 : 2200,
  })
}

export function lighthouseSlug(route) {
  assert(route === "/" || /^\/[a-z0-9/-]+(?:\.[0-9]+)*$/.test(route), "Unsupported Lighthouse route")
  return route === "/" ? "home" : route.slice(1).replaceAll("/", "--")
}

export function assertLighthouseMatrixIndex(index, matrix) {
  assert.equal(index.result, "pass", "Lighthouse collection did not complete")
  assert.equal(index.matrix ?? "core", matrix.name, "Lighthouse collection used a different matrix")
  const expected = new Set(matrix.profiles.flatMap(profile => matrix.routes.flatMap(route => Array.from({ length: matrix.runs }, (_, i) => `${profile}|${route}|${i + 1}`))))
  assert.equal(index.runs.length, expected.size, "Missing or additional Lighthouse matrix captures")
  const observed = new Set()
  for (const run of index.runs) {
    const key = `${run.profile}|${run.route}|${run.run}`
    assert(run.complete, `Incomplete Lighthouse capture: ${key}`)
    assert(expected.has(key), `Unexpected Lighthouse capture: ${key}`)
    assert(!observed.has(key), `Duplicate Lighthouse capture: ${key}`)
    observed.add(key)
  }
}
