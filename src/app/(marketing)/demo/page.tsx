import type { Metadata } from "next"
import { AssessmentExplorer } from "@/components/assessment/assessment-explorer"
import { SectionShell } from "@/components/layout/section-shell"
import { CtaBand } from "@/components/marketing/cta-band"
import { SeoPageJsonLd } from "@/components/seo/json-ld"
import { RelatedSeoLinks } from "@/components/seo/related-seo-links"
import { assessmentFixtures } from "@/content/assessments/fixtures"
import { resolveAssessmentSelection } from "@/lib/assessment/selectors"
import { createPageMetadata } from "@/lib/seo"

export async function generateMetadata(): Promise<Metadata> {
  return createPageMetadata({ title: "Sample capacity decision brief | GridNinja", description: "Explore a synthetic capacity assessment: the requested workload, modeled increment, governing conditions, unresolved commercial decision, and limits of the evidence.", path: "/demo" })
}

export default async function DemoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const selection = resolveAssessmentSelection(await searchParams)
  return <div className="space-y-16 pb-24">
    <SeoPageJsonLd path="/demo" />
    <SectionShell className="pt-12 sm:pt-16" deferRendering={false}><div className="max-w-3xl"><p className="gn-eyebrow">Proof before autonomy</p><h1 className="mt-4 text-balance text-4xl leading-tight font-medium tracking-tight sm:text-5xl">See the decision, the conditions, and the unanswered question.</h1><p className="mt-5 text-lg leading-8 text-muted-foreground">A synthetic decision brief for a bounded capacity assessment. Explore how a workload request compares with a modeled increment, then see what still needs operational and commercial review.</p><p className="mt-4 text-sm leading-6 text-muted-foreground">This is an authored teaching example. It uses no customer data, demonstrates no live control, and grants no operational authority.</p></div></SectionShell>
    <SectionShell deferRendering={false}><h2 className="sr-only">Sample capacity decision brief</h2><AssessmentExplorer key={JSON.stringify(selection)} initialSelection={selection} records={assessmentFixtures} /></SectionShell>
    <SectionShell><CtaBand eyebrow="Your capacity decision" headline="Put a real decision inside a clear assessment scope." body="Start with one capacity commitment, the relevant facility boundary, and the evidence available. We will discuss fit and readiness before agreeing a paid scope and price." label="Scope an assessment" href="/assessment#scope" /></SectionShell>
    <RelatedSeoLinks path="/demo" />
  </div>
}
