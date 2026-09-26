import type { Metadata } from "next"
import { getFacilityRelease, facilityMode } from "@/lib/facility/releases"
import { AssessmentPreview } from "@/components/assessment/assessment-preview"
import { DeferredAssessmentExplorer } from "@/components/assessment/deferred-assessment-explorer"
import { SectionShell } from "@/components/layout/section-shell"
import { CtaBand } from "@/components/marketing/cta-band"
import { SeoPageJsonLd } from "@/components/seo/json-ld"
import { RelatedSeoLinks } from "@/components/seo/related-seo-links"
import { assessmentFixtures } from "@/content/assessments/fixtures"
import { readHypotheticalMinimumSource } from "@/lib/assessment/publications"
import { resolveAssessmentSelection } from "@/lib/assessment/selectors"
import { resolveFacilityFocus, resolveFacilityTopic } from "@/lib/facility/navigation"
import { createPageMetadata } from "@/lib/seo"
import { assessmentScopeHref } from "@/lib/marketing-journeys"

export async function generateMetadata(): Promise<Metadata> {
  return createPageMetadata({ title: "Sample capacity decision brief | GridNinja", description: "Explore a synthetic capacity assessment: the requested workload, modeled increment, governing conditions, unresolved commercial decision, and limits of the evidence.", path: "/demo" })
}

export default async function DemoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const search = await searchParams
  const selection = resolveAssessmentSelection(search)
  const [facilityRelease, hypotheticalSource] = await Promise.all([getFacilityRelease(), readHypotheticalMinimumSource(assessmentFixtures.b)])
  const visualMode = facilityMode()
  const initialTarget = resolveFacilityFocus(search, facilityRelease)
  const initialTopic = resolveFacilityTopic(search)
  const interactive = search.interactive === "1" || search.activate === "1"
  const activateInitially = search.activate === "1"
  return <div className="space-y-6 pb-16 sm:space-y-8">
    <SeoPageJsonLd path="/demo" />
    <SectionShell className="pt-6 sm:pt-8" deferRendering={false}><div className="max-w-3xl"><p className="gn-eyebrow">Proof before autonomy</p><h1 className="mt-3 text-balance text-[1.85rem] leading-tight font-medium tracking-tight sm:text-4xl">Inspect a capacity decision.</h1><p className="mt-3 text-base leading-6 text-muted-foreground">The request, modeled result, and question still to resolve.</p></div></SectionShell>
    <SectionShell deferRendering={false}><h2 className="sr-only">Sample capacity decision brief</h2>{selection.status === "ready" ? <DeferredAssessmentExplorer key={JSON.stringify([selection, search.focus, search.topic])} hypotheticalSource={hypotheticalSource} initialSelection={selection} initialTarget={initialTarget} initialTopic={initialTopic} records={assessmentFixtures} facilityRelease={facilityRelease} facilityMode={visualMode} eager={interactive} activateInitially={activateInitially} preview={<AssessmentPreview mode={visualMode} hypotheticalSource={hypotheticalSource} selection={selection} record={assessmentFixtures[selection.scenario]} release={facilityRelease} topic={initialTopic} target={initialTarget} />} /> : <section className="rounded-2xl border border-border p-6" aria-labelledby="sample-unavailable"><h2 id="sample-unavailable" className="text-2xl font-medium">Requested example unavailable</h2><p className="mt-4 leading-7 text-muted-foreground">{selection.reason}</p><a href="/demo" className="mt-5 inline-flex min-h-11 items-center text-primary underline underline-offset-4">Open the default example</a></section>}</SectionShell>
    <SectionShell><CtaBand eyebrow="Your capacity decision" headline="Put a real decision inside a clear assessment scope." body="Start with one capacity commitment, the relevant facility boundary, and the evidence available. We will discuss fit and readiness before agreeing a paid scope and price." label="Contact Us" href={assessmentScopeHref("demo-final", initialTopic)} /></SectionShell>
    <RelatedSeoLinks path="/demo" />
  </div>
}
