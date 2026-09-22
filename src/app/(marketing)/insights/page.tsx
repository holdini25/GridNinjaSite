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
        path="/insights"
        eyebrow="GridNinja insights"
        title="Virtual capacity insights for constrained AI infrastructure"
        answer="This library defines the AI Data Center Virtual Capacity Control Plane in operator terms: what capacity can be accepted, which constraint binds it, what remains unproven, and how evidence accumulates from Shadow Mode toward bounded autonomy. It avoids commodity AI summaries and separates physical capacity, modeled headroom, and safe, usable, auditable capacity."
        boundary="This is a map of intended operator questions. Candidate articles are withheld while named authors, reviewers, evidence, and publication permissions remain unassigned. Public examples remain explicitly synthetic."
        resources={insightResources}
      />
    </>
  )
}
