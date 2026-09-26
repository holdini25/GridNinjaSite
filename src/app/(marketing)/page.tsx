import type { Metadata } from "next"
import Link from "next/link"
import { DeferredHomeInspection } from "@/components/facility/deferred-home-inspection"
import { HomeInspectionShell } from "@/components/facility/home-inspection-shell"
import { getFacilityRelease, facilityMode } from "@/lib/facility/releases"
import { AssessmentSummary } from "@/components/assessment/assessment-summary"
import { assessmentFixtures } from "@/content/assessments/fixtures"
import { SectionShell } from "@/components/layout/section-shell"
import { CtaBand } from "@/components/marketing/cta-band"
import { DecisionBriefPreview } from "@/components/marketing/decision-brief-preview"
import { Hero } from "@/components/marketing/hero"
import { SectionHeader } from "@/components/marketing/section-header"
import { SeoPageJsonLd } from "@/components/seo/json-ld"
import { RelatedSeoLinks } from "@/components/seo/related-seo-links"
import { assessmentSteps } from "@/content/copy/assessment"
import { assessmentScopeHref, sampleBriefHref } from "@/lib/marketing-journeys"
import { createPageMetadata } from "@/lib/seo"

export async function generateMetadata(): Promise<Metadata> { return createPageMetadata({ path: "/" }) }

export default async function HomePage() {
  const facilityRelease = await getFacilityRelease()
  return <><SeoPageJsonLd path="/" includeSiteIdentity /><div className="space-y-16 pb-16 sm:space-y-20">
    <Hero
      eyebrow="Capacity decisions · proof before autonomy"
      headline="Make your next capacity decision with confidence."
      body="Evaluate one capacity commitment through a paid, bounded assessment of authorized historical inputs. Receive a decision brief with the modeled result, its conditions, and what still needs review."
      primaryCta={{ label: "Contact Us", href: assessmentScopeHref("home-hero"), analyticsEvent: "assessment_cta_selected", analyticsSource: "home-hero" }}
      secondaryCta={{ label: "See a sample decision brief", href: sampleBriefHref() }}
      trustLine="Historical inputs. No live connection or equipment control."
      layout={facilityRelease ? "facility" : "standard"}
      visualClassName={facilityRelease ? "min-w-0" : "hidden lg:block lg:pl-4"}
      visual={facilityRelease ? <DeferredHomeInspection record={assessmentFixtures.b} release={facilityRelease} mode={facilityMode()} shell={<HomeInspectionShell record={assessmentFixtures.b} release={facilityRelease} mode={facilityMode()} />} /> : <AssessmentSummary record={assessmentFixtures.b} compact showLinks={false} />}
    />

    <SectionShell id="decision-brief" deferRendering={false}>
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-8 lg:grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)] lg:gap-12">
        <div className="space-y-6">
          <SectionHeader eyebrow="A worked decision · synthetic" headline="A smaller profile still needs a business decision." body="Inspect the requested increment, modeled limit, and recorded revision together. The commercial question remains explicit." />
          <div className="border-l-2 border-primary pl-5"><h3 className="font-medium">Decision still to make</h3><p className="mt-2 leading-7 text-muted-foreground">{assessmentFixtures.b.commercial.question}</p></div>
          <Link prefetch={false} className="inline-flex min-h-11 items-center gap-2 text-primary underline underline-offset-4" href={sampleBriefHref()}>Compare the four scenarios <span aria-hidden="true">→</span></Link>
        </div>
        <DecisionBriefPreview record={assessmentFixtures.b} />
      </div>
    </SectionShell>

    <SectionShell id="solutions" deferRendering={false}>
      <div className="space-y-8">
        <SectionHeader eyebrow="Start with your decision" headline="What are you ready to commit?" body="Define the commitment and the person accountable for it. The assessment follows that question." />
        <div className="grid gap-6 md:grid-cols-2">{[
          { title: "Admit the next AI workload", body: "Compare a requested workload profile with modeled constraints before a service commitment.", audience: "AI cloud infrastructure and operations", href: "/solutions/ai-cloud" },
          { title: "Commit colocation capacity", body: "Review a proposed tenant increment against declared facility conditions before a commercial commitment.", audience: "Colocation operators and infrastructure executives", href: "/solutions/colocation" },
        ].map(item => <article className="border-t border-divider py-6" key={item.href}><p className="text-sm text-muted-foreground">{item.audience}</p><h3 className="mt-3 text-2xl font-medium">{item.title}</h3><p className="mt-3 max-w-prose leading-7 text-muted-foreground">{item.body}</p><Link prefetch={false} className="mt-4 inline-flex min-h-11 items-center gap-2 text-primary underline underline-offset-4" href={item.href}>Explore the decision <span aria-hidden="true">→</span></Link></article>)}</div>
        <p className="max-w-3xl text-sm leading-7 text-muted-foreground">Considering cooling investment or <Link prefetch={false} className="text-foreground underline underline-offset-4" href="/solutions/bridge-power">bridge power and on-site generation</Link>? Feasibility and economics require a separate assessment scope.</p>
      </div>
    </SectionShell>

    <SectionShell id="assessment-process" deferRendering={false}>
      <div className="space-y-8">
        <SectionHeader eyebrow="How an assessment starts" headline="One question. An agreed scope. A reviewable answer." body="Confirm fit, evidence, and responsibilities before paid work begins. Schedule and price are agreed during scoping." />
        <ol className="grid gap-7 md:grid-cols-3">{assessmentSteps.map((step, index) => <li className="border-t border-divider pt-5" key={step.title}><p className="font-mono text-sm text-primary" aria-hidden="true">0{index + 1}</p><h3 className="mt-3 text-xl font-medium">{step.title}</h3><p className="mt-3 leading-7 text-muted-foreground">{step.body}</p></li>)}</ol>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm"><Link href="/assessment#deliverables" prefetch={false} className="inline-flex min-h-11 items-center text-primary underline underline-offset-4">Review the deliverables</Link><Link href="/data-handling" prefetch={false} className="inline-flex min-h-11 items-center text-primary underline underline-offset-4">Data handling and permissions</Link></div>
      </div>
    </SectionShell>

    <SectionShell id="evidence" deferRendering={false}>
      <div className="grid gap-8 border-y border-divider py-8 lg:grid-cols-2">
        <SectionHeader eyebrow="Inspect the basis" headline="Follow the evidence to its limits." body="Public examples are synthetic. They demonstrate the assessment record and its review process; they do not establish site performance or operating authority." />
        <div className="space-y-5 leading-7 text-muted-foreground"><p>GridNinja is developing an AI Data Center Virtual Capacity Control Plane: a runtime-assured virtual capacity engine for inside-the-fence orchestration.</p><p>Named delivery responsibilities, relevant experience, and reviewer availability are established during scoping. Public team credentials and customer outcomes are not yet published.</p><div className="flex flex-wrap gap-x-6 gap-y-1 text-sm"><Link prefetch={false} className="inline-flex min-h-11 items-center text-primary underline underline-offset-4" href="/evidence">Inspect public evidence</Link><Link prefetch={false} className="inline-flex min-h-11 items-center text-primary underline underline-offset-4" href="/about">About the work</Link><Link prefetch={false} className="inline-flex min-h-11 items-center text-primary underline underline-offset-4" href="/proof/proof-pack">Review the proof pack</Link></div></div>
      </div>
    </SectionShell>
    <RelatedSeoLinks path="/" />
    <SectionShell deferRendering={false}><CtaBand eyebrow="Your next capacity decision" headline="Bring the question before the commitment." body="Start with fit and data readiness. Paid work begins after scope, responsibilities, price, and deliverables are agreed." label="Contact Us" href={assessmentScopeHref("home-final")} /></SectionShell>
  </div></>
}
