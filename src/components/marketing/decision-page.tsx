import { Fragment, type ReactNode } from "react"
import Link from "next/link"
import { SectionShell } from "@/components/layout/section-shell"
import { AssessmentCards } from "@/components/marketing/assessment-cards"
import { DecisionBriefPreview } from "@/components/marketing/decision-brief-preview"
import { Hero } from "@/components/marketing/hero"
import { SectionHeader } from "@/components/marketing/section-header"
import { CtaBand } from "@/components/marketing/cta-band"
import { AuthorityComposition } from "@/components/marketing/authority-composition"
import { CivicComposition, CivicIllustration } from "@/components/marketing/civic-composition"
import { SeoBreadcrumbs } from "@/components/seo/breadcrumbs"
import { SeoPageJsonLd } from "@/components/seo/json-ld"
import { RelatedSeoLinks } from "@/components/seo/related-seo-links"
import { assessmentFixtures } from "@/content/assessments/fixtures"
import { assessmentScopeHref, decisionPageJourney, sampleBriefHref } from "@/lib/marketing-journeys"
import type { PublicPath } from "@/seo/route-manifest"
import type { CivicRelease } from "@/types/civic"

export type DecisionPageContent = {
  eyebrow: string; headline: string; body: string
  sections: readonly { title: string; body: string; items?: readonly { title: string; body: string }[]; link?: { label: string; href: string } }[]
}

export function DecisionPage({ path, content, facilityEntry, civicRelease }: { path: PublicPath; content: DecisionPageContent; facilityEntry?: ReactNode; civicRelease?: CivicRelease | null }) {
  const journey = decisionPageJourney[path] ?? {}
  const scopeHref = assessmentScopeHref(journey.source, journey.topic)
  const sampleHref = sampleBriefHref(journey.topic)
  const isSolutionPage = path === "/solutions/ai-cloud" || path === "/solutions/colocation" || path === "/solutions/bridge-power"
  return <div className="space-y-14 pb-16 sm:space-y-16">
    <SeoPageJsonLd path={path} />
    <SeoBreadcrumbs path={path} />
    <Hero eyebrow={content.eyebrow} headline={content.headline} body={content.body}
      primaryCta={{ label: "Scope an assessment", href: scopeHref, analyticsEvent: "assessment_cta_selected", analyticsSource: journey.source }}
      secondaryCta={{ label: "See a sample decision brief", href: sampleHref }}
      trustLine={isSolutionPage ? "Paid, bounded assessment of authorized historical inputs. No live connection or equipment control." : undefined} />
    {facilityEntry}
    {path === "/proof/proof-pack" && <SectionShell deferRendering={false}><div className="max-w-3xl"><DecisionBriefPreview record={assessmentFixtures.b} /></div></SectionShell>}
    {content.sections.map(section => <Fragment key={section.title}>
      <SectionShell deferRendering={false}>
        <div className="space-y-6">
          <SectionHeader headline={section.title} body={section.body} />
          {section.items && <AssessmentCards items={section.items} variant="rows" />}
          {section.link && <Link prefetch={false} className="inline-flex min-h-11 items-center gap-2 text-primary underline underline-offset-4" href={journey.topic && section.link.href.startsWith("/demo") ? sampleHref : section.link.href}>{section.link.label}<span aria-hidden="true">→</span></Link>}
        </div>
      </SectionShell>
      {path === "/about" && section.title === "The offer today" && <>
        <CivicComposition release={civicRelease} />
        <SectionShell deferRendering={false}><p className="gn-civic-local-boundary">GridNinja&apos;s current assessment does not establish community acceptance or public benefit. Those judgments require their own participants, evidence and scope.</p></SectionShell>
      </>}
      {path === "/proof" && section.title === "What each result means" && <SectionShell className="gn-proof-authority" deferRendering={false}><AuthorityComposition /></SectionShell>}
      {path === "/platform" && section.title === "The intended decision loop" && <SectionShell className="gn-platform-context" deferRendering={false}>
        <div className="space-y-6">
          <SectionHeader headline="Inside-the-fence decisions have an outside context." body="The development direction is to examine facility decisions within explicit technical limits while making relevant grid and local constraints visible. Any future grid-facing service would require separately validated capability, agreements and operating authority." />
          <CivicIllustration release={civicRelease} />
          <p className="gn-platform-context-boundary">The current offer remains a paid, bounded assessment of authorized historical inputs. No live connection or equipment control.</p>
        </div>
      </SectionShell>}
    </Fragment>)}
    <RelatedSeoLinks path={path} />
    <SectionShell deferRendering={false}><CtaBand eyebrow="Proof before autonomy" headline="Start with one capacity question." body="Agree the decision, evidence boundary, responsibilities, and paid scope before work begins." label="Scope an assessment" href={scopeHref} /></SectionShell>
  </div>
}
