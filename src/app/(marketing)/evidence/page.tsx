import { SectionShell } from "@/components/layout/section-shell"
import { PublishedAssessmentLibrary } from "@/components/assessment/published-assessment-library"
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
        introduction={<SectionShell deferRendering={false}><PublishedAssessmentLibrary /></SectionShell>}
        path="/evidence"
        eyebrow="GridNinja evidence"
        title="Evidence for safe, usable, auditable capacity"
        answer="Start with a versioned decision brief. Check its requested increment, modeled result, conditions, and unresolved question, then inspect the matching technical record. These synthetic examples explain the assessment method; they do not establish customer results or physical validation."
        boundary="The synthetic assessment has a versioned decision brief, PDF, and technical record. Other resources remain unavailable until their evidence, accountable reviewers, and publication approval are established."
        resources={evidenceResources}
      />
    </>
  )
}
