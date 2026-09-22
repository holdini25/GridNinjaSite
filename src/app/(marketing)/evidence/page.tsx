import Link from "next/link"
import { SectionShell } from "@/components/layout/section-shell"
import type { Metadata } from "next"

import { SeoResourceHub } from "@/app/(marketing)/_components/seo-resource-hub"
import { SeoPageJsonLd } from "@/components/seo/json-ld"
import { evidenceResources } from "@/content/seo-resources"
import { createPageMetadata } from "@/lib/seo"

export async function generateMetadata(): Promise<Metadata> {
  return createPageMetadata({ path: "/evidence" })
}

export default function EvidencePage() {
  return (
    <>
      <SeoPageJsonLd path="/evidence" />

      <SeoResourceHub
        introduction={<SectionShell deferRendering={false}><div className="gn-panel p-7"><h2 className="text-2xl font-medium">Published synthetic assessment</h2><p className="mt-3 text-base leading-8 text-muted-foreground">DEMO-01 offers four authored scenarios and matched decision briefs. These examples show record consistency, not physical validation or customer outcomes.</p><Link className="mt-5 inline-flex min-h-11 items-center text-primary underline underline-offset-4" href="/demo#decision-brief">Inspect the decision brief and versioned downloads →</Link></div></SectionShell>}
        path="/evidence"
        eyebrow="GridNinja evidence"
        title="Evidence for safe, usable, auditable capacity"
        answer="GridNinja evidence pages connect a precise capacity claim to its maturity, environment, measurement window, sample, version, method, uncertainty, negative cases, reproduction steps, and review boundary. The first release is deliberately synthetic and sanitized. It demonstrates the proposed proof contract without implying customer, pilot, production, certification, or independent-validation results."
        boundary="The synthetic assessment publication has exact versioned HTML, PDF, and technical-export paths. Other candidate resources and artifacts are withheld pending named ownership, evidence review, and publication approval. A noindex label alone is not publication permission."
        resources={evidenceResources}
      />
    </>
  )
}
