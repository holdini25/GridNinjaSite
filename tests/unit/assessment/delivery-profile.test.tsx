import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { deliveryResponsibilityCopy, getApprovedDeliveryProfile, type DeliveryProfilePublication } from "@/content/delivery-profile"
import * as deliveryContent from "@/content/delivery-profile"
import { DeliveryProfile } from "@/components/marketing/delivery-profile"
import { DecisionPage } from "@/components/marketing/decision-page"
import { decisionPages } from "@/content/copy/decision-pages"

afterEach(() => vi.restoreAllMocks())

const publication: DeliveryProfilePublication = {
  status: "approved", surfaces: ["home", "assessment", "about"],
  profile: { name: "Fictional review fixture", role: "Assessment delivery lead", relationshipDisclosure: "Fictional test relationship, not a public credential.", relevantExperience: "Fictional experience for rendering tests.", engagementResponsibility: "Own the agreed assessment review.", professionalUrl: "https://example.test/profile" },
}

describe("approved delivery facts only", () => {
  it("renders no placeholder by default or for draft/unapproved surfaces", () => {
    expect(getApprovedDeliveryProfile("assessment")).toBeNull()
    expect(renderToStaticMarkup(<DeliveryProfile profile={null} />)).toBe("")
    expect(getApprovedDeliveryProfile("assessment", { ...publication, status: "draft" })).toBeNull()
    expect(getApprovedDeliveryProfile("home", { ...publication, surfaces: ["about"] })).toBeNull()
  })
  it("requires complete wording and safe approved professional links", () => {
    expect(getApprovedDeliveryProfile("about", { ...publication, profile: { ...publication.profile, relevantExperience: " " } })).toBeNull()
    expect(getApprovedDeliveryProfile("about", { ...publication, profile: { ...publication.profile, professionalUrl: "javascript:alert(1)" } })).toBeNull()
    expect(getApprovedDeliveryProfile("about", { ...publication, profile: { ...publication.profile, professionalUrl: "" } })).toBeNull()
  })
  it("shows ownership, experience and relationship without contradictory unpublished copy", () => {
    const profile = getApprovedDeliveryProfile("assessment", publication)
    const markup = renderToStaticMarkup(<DeliveryProfile profile={profile} compact />)
    expect(markup).toContain(publication.profile.relevantExperience)
    expect(markup).toContain(publication.profile.engagementResponsibility)
    expect(markup).toContain(publication.profile.relationshipDisclosure)
    expect(deliveryResponsibilityCopy(profile)).not.toContain("Public team credentials and customer outcomes are not yet published")
    expect(deliveryResponsibilityCopy(null)).toContain("Founder profiles do not establish an engagement assignment")
    expect(deliveryResponsibilityCopy(null)).toContain("Customer outcomes are not yet published")
  })
  it("publishes the founder introduction while keeping engagement staffing unpublished", () => {
    const markup = renderToStaticMarkup(<DecisionPage path="/about" content={decisionPages.about} />)
    expect(markup).toContain("Holden Chung")
    expect(markup).toContain("Jonathan Malone")
    expect(markup).toContain('href="/about/founders"')
    expect(markup).toContain("Establish the delivery team during scoping")
    expect(markup).toContain("A founder profile does not establish assignment or availability")
    expect(markup).not.toContain("Named team biographies and verified customer case studies are not yet published")
    expect(getApprovedDeliveryProfile("about")).toBeNull()
  })
  it("replaces the About disclosure atomically when approved facts are available", () => {
    vi.spyOn(deliveryContent, "getApprovedDeliveryProfile").mockReturnValue(publication.profile)
    const markup = renderToStaticMarkup(<DecisionPage path="/about" content={decisionPages.about} />)
    expect(markup).toContain(publication.profile.name)
    expect(markup).toContain("Holden Chung")
    expect(markup).toContain("Jonathan Malone")
    expect(markup).toContain('href="/about/founders"')
    expect(markup).not.toContain("Named team biographies and verified customer case studies are not yet published")
    expect(markup).not.toContain("Establish the delivery team during scoping")
  })
})
