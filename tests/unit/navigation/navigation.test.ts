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
      "How it works",
      "Solutions",
      "Sample brief",
      "Evidence",
      "Company",
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

    expect(groupedDestinations).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Capacity assessment", href: "/assessment" }),
      expect.objectContaining({ label: "Platform direction", href: "/platform" }),
      expect.objectContaining({ label: "Dispatch Envelope", href: "/platform/dispatch-envelope" }),
      expect.objectContaining({ label: "Evidence library", href: "/evidence" }),
      expect.objectContaining({ label: "About GridNinja", href: "/about" }),
    ]))
    expect(navItems.find(item => item.label === "Sample brief")).toEqual({ label: "Sample brief", href: "/demo#decision-brief" })
    expect(new Set(groupedDestinations.map(item => item.href)).size).toBe(groupedDestinations.length)
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
    expect(new Set(footerLinks.map(item => item.href)).size).toBe(footerLinks.length)
    expect(footerLinks.some(item => item.label.startsWith("Download"))).toBe(false)
    expect(headerCapacityAuditHref).toBe(
      "/assessment?source=header#scope"
    )
  })
})

describe("navigation path matching", () => {
  it("matches route boundaries and rejects similarly prefixed paths", () => {
    expect(isNavPathActive("/platform", "/platform")).toBe(true)
    expect(isNavPathActive("/platform/dispatch-envelope", "/platform")).toBe(true)
    expect(isNavPathActive("/platforms", "/platform")).toBe(false)
    expect(isNavPathActive("/demo", "/demo#decision-brief")).toBe(true)
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
