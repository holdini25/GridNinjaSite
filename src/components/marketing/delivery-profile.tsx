import type { PublicDeliveryProfile } from "@/content/delivery-profile"

/** No card, placeholder or extra request exists until approved public facts exist. */
export function DeliveryProfile({ profile, compact = false }: { profile: PublicDeliveryProfile | null; compact?: boolean }) {
  if (!profile) return null
  return <section aria-label="Assessment delivery responsibility" data-delivery-profile className="space-y-3 border-t border-divider py-6">
    <p className="text-sm text-muted-foreground">Delivery responsibility</p>
    <h2 className="text-2xl font-medium">{profile.name}</h2>
    <p className="font-medium">{profile.role}</p>
    <p className="text-sm leading-6 text-muted-foreground">{profile.relationshipDisclosure}</p>
    <p className="leading-7 text-muted-foreground">{profile.engagementResponsibility}</p>
    <p className={compact ? "text-sm leading-6 text-muted-foreground" : "leading-7 text-muted-foreground"}>{profile.relevantExperience}</p>
    {profile.professionalUrl && <a className="inline-flex min-h-11 items-center text-primary underline underline-offset-4" href={profile.professionalUrl}>Professional background</a>}
  </section>
}
