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
        answer="Planned articles will explain capacity constraints, runtime assurance, and the evidence needed before operational authority expands. The articles below are not yet published. For a current example, start with the synthetic decision brief."
        boundary="Articles remain unavailable until their sources, authors, reviewers, and publication permissions are established. The public assessment examples are synthetic."
        resources={insightResources}
      />
    </>
  )
}
