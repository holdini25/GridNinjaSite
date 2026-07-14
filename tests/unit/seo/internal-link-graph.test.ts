import { describe, expect, it } from "vitest"

import {
  analyzeLinkGraph,
  buildLinkGraph,
  classifyInternalHref,
  reconstructDestinationPath,
  reconstructPredecessorPath,
} from "@/seo/internal-link-graph.mjs"

const origin = "https://gridninja.ai"
const previewOrigin = "https://gridninja-preview.vercel.app"

describe("internal-link normalization", () => {
  const knownPaths = new Set(["/", "/platform", "/proof", "/contact"])

  it.each([
    ["/platform", "/platform", "", ""],
    ["platform/", "/platform", "", ""],
    ["/platform?intent=audit#proof", "/platform", "?intent=audit", "#proof"],
    [`${origin}/proof/`, "/proof", "", ""],
    [`${previewOrigin}/contact?source=hero`, "/contact", "?source=hero", ""],
  ])("normalizes internal href %s", (href, path, search, hash) => {
    expect(
      classifyInternalHref(href, {
        sourcePath: "/",
        deploymentOrigin: previewOrigin,
        productionOrigin: origin,
        knownPaths,
      })
    ).toMatchObject({ kind: "internal", path, search, hash })
  })

  it("classifies fragments, external links, artifacts, unknown paths, and malformed hrefs", () => {
    const classify = (href: unknown) =>
      classifyInternalHref(href, {
        sourcePath: "/platform",
        deploymentOrigin: previewOrigin,
        productionOrigin: origin,
        knownPaths,
      })

    expect(classify("#runtime-assurance")).toMatchObject({
      kind: "same-page-fragment",
    })
    expect(classify("mailto:proof@gridninja.ai")).toMatchObject({
      kind: "external",
    })
    expect(classify("https://example.com/platform")).toMatchObject({
      kind: "external",
    })
    expect(classify("/downloads/sample-proof-pack")).toMatchObject({
      kind: "excluded",
      path: "/downloads/sample-proof-pack",
    })
    expect(classify("/not-in-the-manifest")).toMatchObject({
      kind: "unknown",
      path: "/not-in-the-manifest",
    })
    expect(classify("")).toMatchObject({ kind: "malformed" })
    expect(classify("http://[")).toMatchObject({ kind: "malformed" })
  })
})

describe("directed internal-link graph", () => {
  it("finds deterministic shortest paths through cycles with forward and reverse BFS", () => {
    const graph = buildLinkGraph(
      ["/", "/platform", "/proof", "/contact"],
      [
        { source: "/", target: "/platform" },
        { source: "/platform", target: "/proof" },
        { source: "/proof", target: "/platform" },
        { source: "/proof", target: "/contact" },
        { source: "/contact", target: "/proof" },
      ]
    )
    const analysis = analyzeLinkGraph({
      graph,
      routes: graph.nodes.map((path) => ({ path, tier: 1 as const })),
      destinationPaths: ["/contact"],
    })

    expect(analysis.forwardDistance.get("/contact")).toBe(3)
    expect(
      reconstructPredecessorPath(analysis.forwardPredecessor, "/contact")
    ).toEqual(["/", "/platform", "/proof", "/contact"])
    expect(analysis.destinationDistance.get("/")).toBe(3)
    expect(reconstructDestinationPath(analysis.nextHopToDestination, "/")).toEqual([
      "/",
      "/platform",
      "/proof",
      "/contact",
    ])
    expect(analysis.violations).toEqual([])
  })

  it("uses the nearest of multiple proof or conversion destinations", () => {
    const graph = buildLinkGraph(
      ["/", "/a", "/proof", "/contact"],
      [
        { source: "/", target: "/a" },
        { source: "/a", target: "/proof" },
        { source: "/a", target: "/contact" },
        { source: "/proof", target: "/contact" },
        { source: "/contact", target: "/proof" },
      ]
    )
    const analysis = analyzeLinkGraph({
      graph,
      routes: graph.nodes.map((path) => ({ path, tier: 1 as const })),
      destinationPaths: ["/contact", "/proof"],
    })

    expect(analysis.destinationDistance.get("/a")).toBe(1)
    expect(["/contact", "/proof"]).toContain(
      analysis.nextHopToDestination.get("/a")
    )
  })

  it("reports disconnected, dead-end, orphan, self, duplicate, unknown, and missing declared edges", () => {
    const graph = buildLinkGraph(
      ["/", "/proof", "/orphan", "/dead-end"],
      [
        { source: "/", target: "/proof" },
        { source: "/", target: "/proof" },
        { source: "/proof", target: "/proof" },
        { source: "/proof", target: "/dead-end" },
        { source: "/proof", target: "/unknown" },
        { source: "/orphan", target: "/proof" },
      ]
    )
    const analysis = analyzeLinkGraph({
      graph,
      routes: graph.nodes.map((path) => ({ path, tier: 0 as const })),
      destinationPaths: ["/proof"],
      missingDeclaredEdges: [{ source: "/", target: "/contact" }],
    })
    const codes = analysis.violations.map((violation) => violation.code)

    expect(codes).toEqual(
      expect.arrayContaining([
        "unreachable-from-root",
        "orphan",
        "dead-end",
        "self-link",
        "duplicate-edge",
        "unknown-target",
        "missing-declared-edge",
      ])
    )
    expect(
      analysis.violations.find(
        (violation) => violation.code === "missing-declared-edge"
      )?.message
    ).toContain("initial main DOM")
  })

  it("reports over-depth shortest paths with the offending trace", () => {
    const graph = buildLinkGraph(
      ["/", "/a", "/b", "/proof"],
      [
        { source: "/", target: "/a" },
        { source: "/a", target: "/b" },
        { source: "/b", target: "/proof" },
        { source: "/proof", target: "/b" },
      ]
    )
    const analysis = analyzeLinkGraph({
      graph,
      routes: graph.nodes.map((path) => ({ path, tier: 0 as const })),
      destinationPaths: ["/proof"],
    })

    expect(analysis.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "root-depth-exceeded",
          path: "/proof",
          pathTrace: ["/", "/a", "/b", "/proof"],
        }),
        expect.objectContaining({
          code: "destination-depth-exceeded",
          path: "/",
          pathTrace: ["/", "/a", "/b", "/proof"],
        }),
      ])
    )
  })
})
