import Link from "next/link"
import { assessmentOffer } from "@/content/copy/assessment"
import { sampleBriefHref } from "@/lib/marketing-journeys"

/** Server-rendered in both placements; optional detail never delays the form. */
export type AssessmentOfferSummaryProps = { variant: "compact" | "full"; headingId: string }

export function AssessmentOfferSummary({ variant, headingId }: AssessmentOfferSummaryProps) {
  if (variant === "compact") return <div data-assessment-offer="compact" role="group" aria-labelledby={headingId}>
    <p className="gn-home-scope-lead">Agree the decision, evidence and responsibilities before analysis begins.</p>
    <dl><div><dt>You bring</dt><dd>{assessmentOffer.bring}</dd></div><div><dt>You receive</dt><dd>{assessmentOffer.receive}</dd></div></dl>
    <p className="gn-home-scope-note">{assessmentOffer.agreement} {assessmentOffer.privacy}</p>
    <div className="gn-home-scope-links"><Link href="/assessment#deliverables" prefetch={false} data-seo-related-target="/assessment">Review the deliverables <span aria-hidden="true">→</span></Link><Link href="/data-handling" prefetch={false}>Data handling and permissions <span aria-hidden="true">→</span></Link></div>
  </div>

  return <aside aria-labelledby={headingId} className="min-w-0 space-y-4" data-assessment-offer="full">
    <div data-assessment-offer-summary className="space-y-4 text-sm leading-6 text-muted-foreground">
      <h2 id={headingId} className="text-2xl font-medium text-foreground">{assessmentOffer.heading}</h2>
      <p>{assessmentOffer.introduction}</p>
      <dl className="space-y-4">
        <div><dt className="font-medium text-foreground">You bring</dt><dd>{assessmentOffer.bring}</dd></div>
        <div><dt className="font-medium text-foreground">You receive</dt><dd>{assessmentOffer.receive}</dd></div>
        <div><dt className="font-medium text-foreground">Agreement</dt><dd>{assessmentOffer.agreement}</dd></div>
      </dl>
      <p>{assessmentOffer.boundary}</p>
      <p>{assessmentOffer.privacy}</p>
    </div>
    <details className="border-t border-divider pt-2 text-sm leading-6 text-muted-foreground"><summary className="min-h-11 cursor-pointer content-center font-medium text-foreground">What affects the scope and price?</summary><p className="pb-2">{assessmentOffer.pricing}</p></details>
    <div className="flex flex-wrap gap-x-6 text-sm"><a href="#deliverables" className="inline-flex min-h-11 items-center text-primary underline underline-offset-4">Review the deliverables</a><Link prefetch={false} href={sampleBriefHref()} className="inline-flex min-h-11 items-center text-primary underline underline-offset-4">See a sample decision brief</Link></div>
  </aside>
}
