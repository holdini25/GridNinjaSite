import type { Metadata } from "next"

import { SeoResourceHub } from "@/app/(marketing)/_components/seo-resource-hub"
import { SeoPageJsonLd } from "@/components/seo/json-ld"
import { methodologyResources } from "@/content/seo-resources"
import { createPageMetadata } from "@/lib/seo"

export async function generateMetadata(): Promise<Metadata> {
  return createPageMetadata({ path: "/methodology" })
}

export default function MethodologyPage() {
  return (
    <>
      <SeoPageJsonLd path="/methodology" />
      <SeoResourceHub
        path="/methodology"
        eyebrow="GridNinja methodology"
        title="Methods for claims that operators can defend"
        answer="These methods define how GridNinja scopes public claims, comparisons, corrections, and Capacity Audit outputs. The governing principle is proof before autonomy and proof before promotion: exact wording stays tied to an environment, maturity, evidence object, caveat, approved surface, owner, and review date, while no-proof remains a valid published outcome."
        boundary="The methodology index is public so evaluators can see the intended controls. Individual methods remain noindex until real editorial and technical owners accept public profiles, disclosures, and review responsibility. Until then, the pages are publication candidates—not a claim of an independently operated editorial program."
        resources={methodologyResources}
      />
    </>
  )
}
