import { SectionShell } from "@/components/layout/section-shell"
import { EVIDENCE_MATURITY_LABELS } from "@/seo/evidence"
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
        introduction={<SectionShell deferRendering={false}><div className="gn-panel p-7"><h2 className="text-2xl font-medium">Four distinct evidence stages</h2><ol className="mt-6 space-y-4">{EVIDENCE_MATURITY_LABELS.map((label, index) => <li key={label} className="flex gap-4 text-base leading-8"><span className="font-mono text-primary">0{index + 1}</span><span>{label}</span></li>)}</ol><p className="mt-6 max-w-3xl text-base leading-8 text-muted-foreground">A stage applies only to its stated environment, evidence, and decision. Synthetic software examples do not establish authorized site evaluation or customer acceptance. Public claims also require exact wording, scope, evidence, owner, permission, approved surfaces, review date, and expiry.</p></div></SectionShell>}
        path="/methodology"
        eyebrow="GridNinja methodology"
        title="Methods for claims that operators can defend"
        answer="A capacity claim needs a stated scope, supporting evidence, and a responsible reviewer. This page explains the evidence stages used to distinguish a specification from tested software, site evaluation, and an accepted customer decision. The detailed methods below await publication."
        boundary="The methodology index describes intended controls. Individual candidate text and artifacts are withheld until evidence, accountable ownership, and publication permission are established. The current assessment scope and its boundaries are described on the assessment page."
        resources={methodologyResources}
      />
    </>
  )
}
