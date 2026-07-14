import { describe, expect, it } from "vitest"

import {
  getSeoRoute,
  indexableSeoRoutes,
  seoRoutes,
  validateSeoRouteManifest,
} from "@/seo/route-manifest"
import { expectUnique, expectValidatorToPass } from "../../support/seo-contracts"

const requiredTitles = new Map([
  ["/", "AI Data Center Virtual Capacity Control Plane | GridNinja"],
  ["/platform", "Virtual Capacity Control Plane Platform | GridNinja"],
  [
    "/platform/dispatch-envelope",
    "Data Center Dispatch Envelopes & Runtime Assurance | GridNinja",
  ],
  [
    "/solutions/ai-cloud",
    "AI Cloud Time-to-Power & Virtual Capacity | GridNinja",
  ],
  [
    "/solutions/colocation",
    "Proof-Backed Sellable Capacity for Colocation | GridNinja",
  ],
  [
    "/solutions/bridge-power",
    "Bridge Power & DER for AI Data Centers | GridNinja",
  ],
  ["/proof", "Proof Before Autonomy for AI Data Centers | GridNinja"],
  [
    "/why-gridninja",
    "Capacity Acceptance vs DCIM & Digital Twins | GridNinja",
  ],
  [
    "/proof/proof-pack",
    "AI Data Center Virtual Capacity Proof Pack | GridNinja",
  ],
  ["/demo", "Virtual Capacity Proof Demo | GridNinja"],
  ["/dcii", "GridNinja DCII Project | Proof-Backed AI Capacity"],
  ["/roi", "AI Data Center Capacity Audit & ROI | GridNinja"],
  ["/about", "About GridNinja | Proof-First AI Infrastructure"],
  [
    "/contact",
    "Request an AI Data Center Capacity Audit | GridNinja",
  ],
] as const)

describe("SEO route manifest", () => {
  it("passes its fail-closed validator", () => {
    expectValidatorToPass(validateSeoRouteManifest, "route manifest")
  })

  it("has one stable, complete contract per path", () => {
    expect(seoRoutes.length).toBeGreaterThanOrEqual(requiredTitles.size)
    expectUnique(
      seoRoutes.map((route) => route.key),
      "route keys"
    )
    expectUnique(
      seoRoutes.map((route) => route.path),
      "route paths"
    )

    for (const route of seoRoutes) {
      expect(route.path).toMatch(/^\/(?!\/)/)
      expect(route.title.trim()).toBe(route.title)
      expect(route.description.trim().length).toBeGreaterThan(40)
      expect(route.h1.trim().length).toBeGreaterThan(0)
      expect(route.contentUpdatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(route.schemaTypes.length).toBeGreaterThan(0)
      expect(route.targetQuestions.length).toBeGreaterThan(0)
      expect(route.socialImageKey).not.toMatch(/placeholder|todo|tbd/i)
      expect(JSON.stringify(route)).not.toMatch(
        /https?:\/\/(?:www\.)?gridninja\.ai|vercel\.app|placeholder|lorem ipsum/i
      )
    }
  })

  it("preserves the approved titles for the established public routes", () => {
    for (const [path, title] of requiredTitles) {
      expect(getSeoRoute(path).title, path).toBe(title)
    }
  })

  it("derives the indexable projection and resolves every relationship", () => {
    expect(indexableSeoRoutes).toEqual(
      seoRoutes.filter((route) => route.indexable)
    )

    const allPaths = new Set<string>(seoRoutes.map((route) => route.path))
    for (const route of seoRoutes) {
      for (const relatedPath of route.relatedPaths) {
        expect(allPaths.has(relatedPath), `${route.path} -> ${relatedPath}`).toBe(
          true
        )
        expect(relatedPath, `${route.path} must not recommend itself`).not.toBe(
          route.path
        )
      }
      for (const crumb of route.breadcrumbs) {
        const breadcrumbPath = crumb.path.split("#")[0] || "/"
        expect(
          allPaths.has(breadcrumbPath),
          `${route.path} breadcrumb ${crumb.path}`
        ).toBe(true)
      }
    }
  })

  it("keeps every Tier 0 and Tier 1 publishing route indexable", () => {
    for (const route of seoRoutes.filter((candidate) => candidate.tier <= 1)) {
      expect(route.indexable, route.path).toBe(true)
    }
  })
})
