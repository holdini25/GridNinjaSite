import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import HomePage from "@/app/(marketing)/page"
import AssessmentPage from "@/app/(marketing)/assessment/page"
import { AssessmentOfferSummary } from "@/components/marketing/assessment-offer-summary"
import { CtaBand } from "@/components/marketing/cta-band"
import { DecisionPage } from "@/components/marketing/decision-page"
import { decisionPages } from "@/content/copy/decision-pages"

vi.mock("@/lib/cinematic/releases", () => ({ getCinematicRelease: async () => null }))
vi.mock("@/lib/editorial/releases", () => ({ getEditorialRelease: async () => null }))
vi.mock("@/lib/civic/releases", () => ({ getCivicRelease: async () => null }))
vi.mock("@/lib/facility/releases", () => ({ getFacilityRelease: async () => null }))
const parse = (markup: string) => new DOMParser().parseFromString(markup, "text/html")

describe("bounded buyer journey", () => {
  it("places evidence and scope before the complete civic mission, preserving anchors", async () => {
    const document = parse(renderToStaticMarkup(await HomePage()))
    const sections = [...document.querySelector(".gn-home")!.children]
    expect(sections.map(section => section.id || section.className)).toEqual([
      "gn-home-hero", "decision-brief", "assessment-process", "solutions", "evidence", "gn-home-section gn-home-mechanism", "shared-infrastructure", "gn-home-section gn-home-research", "gn-home-invitation",
    ])
    for (const id of ["decision-brief", "assessment-process", "solutions", "evidence", "shared-infrastructure"]) expect(document.querySelectorAll(`#${id}`)).toHaveLength(1)
    expect(document.querySelector("#shared-infrastructure")?.textContent).toContain("The civic ambition does not add services or establish community benefits")
  })

  it("keeps the concise offer before the form without moving the direct scope target", () => {
    const document = parse(renderToStaticMarkup(<AssessmentPage />))
    const offer = document.querySelector("[data-assessment-offer]")!
    const form = document.querySelector("form")!
    expect(offer.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(form.querySelector("#scope")).not.toBeNull()
    expect([...form.querySelectorAll("[required]")].map(input => input.getAttribute("name"))).toEqual(["name", "email", "company"])
    expect(form.querySelector("fieldset")?.hasAttribute("disabled")).toBe(true)
    expect(document.querySelector("[data-delivery-profile]")).toBeNull()
    const summary = document.querySelector("[data-assessment-offer-summary]")!.textContent!
    expect(summary).toContain("before paid work begins")
    expect(summary).toContain("does not authorize equipment operation")
    expect(offer.querySelector("details")?.hasAttribute("open")).toBe(false)
  })

  it("uses the same input and deliverable wording in compact and full summaries", () => {
    const full = parse(renderToStaticMarkup(<AssessmentOfferSummary variant="full" headingId="assessment-offer-heading" />))
    const compact = parse(renderToStaticMarkup(<AssessmentOfferSummary variant="compact" headingId="scope-heading" />))
    expect([...compact.querySelectorAll("dd")].map(node => node.textContent)).toEqual([...full.querySelectorAll("dd")].slice(0, 2).map(node => node.textContent))
  })

  it("wires final scoping actions to the existing delegated observer", () => {
    const document = parse(renderToStaticMarkup(<CtaBand headline="One decision" body="Agree the paid scope." label="Contact Us" href="/assessment?source=demo-final#scope" analyticsEvent="assessment_cta_selected" analyticsSource="demo-final" />))
    expect(document.querySelector("a")?.dataset.analyticsEvent).toBe("assessment_cta_selected")
    expect(document.querySelector("a")?.dataset.analyticsSource).toBe("demo-final")
  })

  it("distinguishes final placements from hero attribution using existing source labels", () => {
    const document = parse(renderToStaticMarkup(<DecisionPage path="/platform" content={decisionPages.platform} />))
    const hero = document.querySelector<HTMLAnchorElement>('a[data-analytics-source="platform-hero"]')!
    const final = document.querySelector<HTMLAnchorElement>('a[data-analytics-source="platform-final"]')!
    expect(hero.getAttribute("href")).toBe("/assessment?source=platform-hero#scope")
    expect(final.getAttribute("href")).toBe("/assessment?source=platform-final#scope")
  })
})
