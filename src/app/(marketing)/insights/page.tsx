import type { Metadata } from "next"

import { SeoResourceHub } from "@/app/(marketing)/_components/seo-resource-hub"
import { SeoPageJsonLd } from "@/components/seo/json-ld"
import { insightResources } from "@/content/seo-resources"
import { createPageMetadata } from "@/lib/seo"

export async function generateMetadata(): Promise<Metadata> {
  return createPageMetadata({ path: "/insights" })
}

export default function InsightsPage() {
  return (
    <>
      <SeoPageJsonLd path="/insights" />
      <SeoResourceHub
        eyebrow="GridNinja insights"
        title="Virtual capacity insights for constrained AI infrastructure"
        answer="This library defines the AI Data Center Virtual Capacity Control Plane in operator terms: what capacity can be accepted, which constraint binds it, what remains unproven, and how evidence accumulates from Shadow Mode toward bounded autonomy. It avoids commodity AI summaries and separates physical capacity, modeled headroom, and safe, usable, auditable capacity."
        boundary="The hub is a crawlable map of the core operator questions. Technical leaves remain noindex while named authors, affiliations, disclosures, and reviewers are unassigned. That publication gate prevents polished but unowned explanations from becoming search-visible claims."
        resources={insightResources}
      />
    </>
  )
}
