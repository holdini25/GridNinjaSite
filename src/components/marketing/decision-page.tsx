import type { ReactNode } from "react"
import Link from "next/link"
import { SectionShell } from "@/components/layout/section-shell"
import { AssessmentCards } from "@/components/marketing/assessment-cards"
import { DecisionBriefPreview } from "@/components/marketing/decision-brief-preview"
import { Hero } from "@/components/marketing/hero"
import { SectionHeader } from "@/components/marketing/section-header"
import { CtaBand } from "@/components/marketing/cta-band"
import { SeoBreadcrumbs } from "@/components/seo/breadcrumbs"
import { SeoPageJsonLd } from "@/components/seo/json-ld"
import { RelatedSeoLinks } from "@/components/seo/related-seo-links"
import { assessmentFixtures } from "@/content/assessments/fixtures"
import { assessmentScopeHref, decisionPageJourney, sampleBriefHref } from "@/lib/marketing-journeys"
import type { PublicPath } from "@/seo/route-manifest"

export type DecisionPageContent = {
  eyebrow: string; headline: string; body: string
  sections: readonly { title: string; body: string; items?: readonly { title: string; body: string }[]; link?: { label: string; href: string } }[]
}

export function DecisionPage({ path, content, facilityEntry }: { path: PublicPath; content: DecisionPageContent; facilityEntry?: ReactNode }) {
  const journey = decisionPageJourney[path] ?? {}
  const scopeHref = assessmentScopeHref(journey.source, journey.topic)
  const sampleHref = sampleBriefHref(journey.topic)
  return <div className="space-y-14 pb-16 sm:space-y-16">
    <SeoPageJsonLd path={path} />
    <SeoBreadcrumbs path={path} />
    <Hero eyebrow={content.eyebrow} headline={content.headline} body={content.body}
      primaryCta={{ label: "Contact Us", href: scopeHref, analyticsEvent: "assessment_cta_selected", analyticsSource: journey.source }}
      secondaryCta={{ label: "See a sample decision brief", href: sampleHref }} />
    {facilityEntry}
    {path === "/proof/proof-pack" && <SectionShell deferRendering={false}><div className="max-w-3xl"><DecisionBriefPreview record={assessmentFixtures.b} /></div></SectionShell>}
    {content.sections.map(section => <SectionShell key={section.title} deferRendering={false}>
      <div className="space-y-6">
        <SectionHeader headline={section.title} body={section.body} />
        {section.items && <AssessmentCards items={section.items} variant="rows" />}
        {section.link && <Link prefetch={false} className="inline-flex min-h-11 items-center gap-2 text-primary underline underline-offset-4" href={journey.topic && section.link.href.startsWith("/demo") ? sampleHref : section.link.href}>{section.link.label}<span aria-hidden="true">→</span></Link>}
      </div>
    </SectionShell>)}
    <RelatedSeoLinks path={path} />
    <SectionShell deferRendering={false}><CtaBand eyebrow="Proof before autonomy" headline="Start with one capacity question." body="Agree the decision, evidence boundary, responsibilities, and paid scope before work begins." label="Contact Us" href={scopeHref} /></SectionShell>
  </div>
}
