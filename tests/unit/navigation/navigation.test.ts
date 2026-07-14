import { describe, expect, it } from "vitest"

import {
  footerGroups,
  headerCapacityAuditHref,
  navItems,
} from "@/content/nav"
import type { NavDestination } from "@/content/nav"
import {
  getMostSpecificActiveHref,
  isNavPathActive,
} from "@/lib/navigation"

describe("primary navigation contract", () => {
  it("contains the five approved buyer-journey choices", () => {
    expect(navItems.map((item) => item.label)).toEqual([
      "Platform",
      "Solutions",
      "Proof",
      "Resources",
      "Why GridNinja",
    ])
    expect(navItems.map((item) => item.label)).not.toContain("DCII")
    expect(navItems.map((item) => item.label)).not.toContain("About")
    expect(navItems.map((item) => item.label)).not.toContain("Contact")
  })

  it("provides every grouped destination with a label, route, and explanation", () => {
    const groupedDestinations: NavDestination[] = []
    for (const item of navItems) {
      if ("children" in item) {
        groupedDestinations.push(...item.children)
      }
    }

    expect(groupedDestinations.map(({ label, href }) => ({ label, href }))).toEqual([
      { label: "Platform Overview", href: "/platform" },
      { label: "Dispatch Envelope", href: "/platform/dispatch-envelope" },
      { label: "AI Cloud Providers", href: "/solutions/ai-cloud" },
      { label: "Colocation & REITs", href: "/solutions/colocation" },
      { label: "Bridge Power & DER", href: "/solutions/bridge-power" },
      { label: "Proof Before Autonomy", href: "/proof" },
      { label: "Proof Pack", href: "/proof/proof-pack" },
      { label: "Interactive Proof Demo", href: "/demo" },
      { label: "Insights", href: "/insights" },
      { label: "Evidence Library", href: "/evidence" },
      { label: "Methodology", href: "/methodology" },
      { label: "Capacity Audit & ROI", href: "/roi" },
      { label: "DCII Project", href: "/dcii" },
    ])
    expect(groupedDestinations.every((item) => item.description.trim().length > 0)).toBe(
      true
    )
  })

  it("keeps About and Contact in the footer and shares the exact header CTA", () => {
    const footerLinks: Array<{ label: string; href: string }> = []
    for (const group of footerGroups) {
      footerLinks.push(...group.links)
    }

    expect(footerLinks).toContainEqual({ label: "About", href: "/about" })
    expect(footerLinks).toContainEqual({ label: "Contact", href: "/contact" })
    expect(headerCapacityAuditHref).toBe(
      "/contact?intent=capacity-audit&source=header"
    )
  })
})

describe("navigation path matching", () => {
  it("matches route boundaries and rejects similarly prefixed paths", () => {
    expect(isNavPathActive("/platform", "/platform")).toBe(true)
    expect(isNavPathActive("/platform/dispatch-envelope", "/platform")).toBe(true)
    expect(isNavPathActive("/platforms", "/platform")).toBe(false)
  })

  it("selects only the longest matching destination", () => {
    expect(
      getMostSpecificActiveHref("/platform/dispatch-envelope", [
        "/platform",
        "/platform/dispatch-envelope",
      ])
    ).toBe("/platform/dispatch-envelope")
    expect(getMostSpecificActiveHref("/contact", ["/proof", "/demo"])).toBeUndefined()
  })
})
