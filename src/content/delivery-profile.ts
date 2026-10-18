import "server-only"

export type DeliveryProfileSurface = "home" | "assessment" | "about"
export type PublicDeliveryProfile = {
  name: string
  role: string
  relationshipDisclosure: string
  relevantExperience: string
  engagementResponsibility: string
  professionalUrl: string
}
export type DeliveryProfilePublication = {
  status: "draft" | "approved"
  surfaces: readonly DeliveryProfileSurface[]
  profile: PublicDeliveryProfile
}

// Publish only after exact wording, credentials and permission are reviewed.
// Keep private consent and supporting evidence outside the repository and bundle.
// A delivery role does not confer authorship, independent review or certification.
const deliveryProfilePublication: DeliveryProfilePublication | null = null

export function getApprovedDeliveryProfile(surface: DeliveryProfileSurface, publication: DeliveryProfilePublication | null = deliveryProfilePublication): PublicDeliveryProfile | null {
  if (publication?.status !== "approved" || !publication.surfaces.includes(surface)) return null
  const profile = publication.profile
  if (![profile.name, profile.role, profile.relationshipDisclosure, profile.relevantExperience, profile.engagementResponsibility].every(value => value.trim().length > 0)) return null
  try {
    const link = new URL(profile.professionalUrl)
    if (link.protocol !== "https:" || link.username || link.password) return null
  } catch { return null }
  return profile
}

export function deliveryResponsibilityCopy(profile: PublicDeliveryProfile | null) {
  return profile
    ? `${profile.name} is the published delivery contact. Engagement responsibilities, relevant experience and reviewer availability are confirmed during scoping. Customer outcomes are not yet published.`
    : "Delivery responsibilities, relevant experience and reviewer availability are established during scoping. Founder profiles do not establish an engagement assignment. Customer outcomes are not yet published."
}

export const unpublishedDeliveryTeam = {
  title: "Establish the delivery team during scoping",
  body: "Founder biographies describe the people behind GridNinja. Engagement staffing is agreed separately: before a paid engagement, establish the accountable delivery lead, technical reviewer, relevant experience, availability, and customer decision owner. A founder profile does not establish assignment or availability for a particular engagement. Verified customer case studies are not yet published.",
} as const
