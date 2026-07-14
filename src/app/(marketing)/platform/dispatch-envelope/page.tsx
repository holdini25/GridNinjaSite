import type { Metadata } from "next"
import Link from "next/link"

import { ArrowRightIcon, ShieldCheckIcon } from "lucide-react"

import { SectionShell } from "@/components/layout/section-shell"
import { SeoBreadcrumbs } from "@/components/seo/breadcrumbs"
import { SeoPageJsonLd } from "@/components/seo/json-ld"
import { RelatedSeoLinks } from "@/components/seo/related-seo-links"
import { PublicClaimValue } from "@/components/seo/public-claim"
import { DispatchEnvelopeVisual } from "@/components/marketing/dispatch-envelope/dispatch-envelope-visual"
import { CtaBand } from "@/components/marketing/cta-band"
import { Hero } from "@/components/marketing/hero"
import { SectionHeader } from "@/components/marketing/section-header"
import { Button } from "@/components/ui/button"
import {
  decisionLabel,
  dispatchEnvelopeHero,
  dispatchEnvelopeOutcomeCards,
  dispatchEnvelopeSections,
  dispatchScenarios,
  formatMw,
  getOrderedConstraints,
  isBindingStatus,
} from "@/content/copy/dispatch-envelope"
import { buildLeadHref, getFirstQueryValue } from "@/lib/lead"
import { createPageMetadata } from "@/lib/seo"

type DispatchEnvelopePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata(): Promise<Metadata> {
  return createPageMetadata({
    title: "Dispatch Envelope | GridNinja",
    description:
      "Inspect GridNinja's runtime-assured dispatch envelope for proof-backed virtual capacity, binding constraints, Shadow Mode evidence, and allow / repair / reject / no-proof outcomes.",
    path: "/platform/dispatch-envelope",
  })
}

export default async function DispatchEnvelopePage({
  searchParams,
}: DispatchEnvelopePageProps) {
  const query = await searchParams
  const dispatchQuery = getFirstQueryValue(query.dispatch)
  const initialScenarioId = dispatchScenarios.some(
    (scenario) => scenario.id === dispatchQuery
  )
    ? dispatchQuery
    : undefined

  return (
    <div className="space-y-24 pb-24">
      <SeoPageJsonLd path="/platform/dispatch-envelope" />
      <SeoBreadcrumbs path="/platform/dispatch-envelope" />
      <Hero
        eyebrow={dispatchEnvelopeHero.eyebrow}
        headline={dispatchEnvelopeHero.headline}
        body={dispatchEnvelopeHero.body}
        primaryCta={{
          label: "Request Capacity Audit",
          href: buildLeadHref("capacity-audit", "dispatch-envelope-hero"),
        }}
        secondaryCta={{
          label: "See Shadow Mode",
          href: "/proof",
        }}
        trustLine="Read-only visual: the browser renders a signed decision record preview; runtime assurance remains the authority boundary."
      />

      <SectionShell>
        <div className="grid gap-6 lg:grid-cols-[1fr_0.82fr] lg:items-start">
          <SectionHeader
            eyebrow={dispatchEnvelopeSections.roleMap.eyebrow}
            headline={dispatchEnvelopeSections.roleMap.headline}
            body={dispatchEnvelopeSections.roleMap.body}
          />
          <div className="gn-panel p-6">
            <div className="flex items-start gap-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-full border border-proof-cyan/35 bg-proof-cyan/10 text-proof-cyan">
                <ShieldCheckIcon className="size-5" />
              </span>
              <div>
                <p className="font-mono text-xs tracking-[0.18em] text-proof-cyan uppercase">
                  Authority boundary
                </p>
                <h2 className="mt-3 text-[1.45rem] font-medium text-foreground">
                  Read-only proof before autonomy
                </h2>
                <p className="mt-3 text-base leading-8 text-muted-foreground">
                  A production DispatchEnvelopeDTO is produced by telemetry,
                  topology, policy, deterministic solver / verification,
                  runtime assurance, and a signed proof record. The frontend
                  never infers accepted capacity, downgrades no-proof, or
                  becomes an approval path.
                </p>
              </div>
            </div>
          </div>
        </div>
      </SectionShell>

      <SectionShell>
        <div className="grid gap-4 md:grid-cols-3">
          {dispatchEnvelopeOutcomeCards.map((card) => (
            <div key={card.label} className="gn-panel p-5">
              <p className="font-mono text-xs tracking-[0.16em] text-muted-foreground uppercase">
                {card.label}
              </p>
              <p className="mt-3 font-mono text-[2.1rem] leading-none text-foreground">
                <PublicClaimValue claimId={card.claimId} value={card.value} />
              </p>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">
                {card.body}
              </p>
            </div>
          ))}
        </div>
      </SectionShell>

      <SectionShell containerClassName="max-w-[96rem]" deferRendering={false}>
        <DispatchEnvelopeVisual initialScenarioId={initialScenarioId} />
      </SectionShell>

      <SectionShell>
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <SectionHeader
            eyebrow={dispatchEnvelopeSections.proof.eyebrow}
            headline={dispatchEnvelopeSections.proof.headline}
            body={dispatchEnvelopeSections.proof.body}
          />
          <div className="gn-panel overflow-hidden">
            <div className="border-b border-border/70 px-5 py-4">
              <p className="font-mono text-xs tracking-[0.16em] text-primary uppercase">
                Static fallback
              </p>
              <h2 className="mt-2 text-[1.45rem] font-medium text-foreground">
                Scenario summary
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] text-left text-sm">
                <thead className="border-b border-border/70 bg-background/45 font-mono text-[0.68rem] tracking-[0.14em] text-muted-foreground uppercase">
                  <tr>
                    <th className="px-5 py-3">Scenario</th>
                    <th className="px-5 py-3">Decision</th>
                    <th className="px-5 py-3">Requested</th>
                    <th className="px-5 py-3">Accepted</th>
                    <th className="px-5 py-3">Binding evidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {dispatchScenarios.map((scenario) => {
                    const bindings = getOrderedConstraints(scenario).filter(
                      ({ constraint }) => isBindingStatus(constraint.state)
                    )

                    return (
                      <tr key={scenario.id}>
                        <td className="px-5 py-4">
                          <p className="font-medium text-foreground">
                            {scenario.label}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {scenario.subtitle}
                          </p>
                        </td>
                        <td className="px-5 py-4 font-mono text-foreground">
                          {decisionLabel(scenario.dto.decision)}
                        </td>
                        <td className="px-5 py-4 font-mono text-primary">
                          {formatMw(scenario.dto.request.maxMw)}
                        </td>
                        <td className="px-5 py-4 font-mono text-signal">
                          {scenario.dto.accepted
                            ? formatMw(scenario.dto.accepted.maxMw)
                            : "withheld"}
                        </td>
                        <td className="px-5 py-4 text-muted-foreground">
                          {bindings.length > 0
                            ? bindings
                                .map(({ meta, constraint }) =>
                                  `${meta.short}: ${constraint.evidenceArtifact}`
                                )
                                .join("; ")
                            : "No binding constraint in the illustrative request."}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </SectionShell>

      <SectionShell>
        <div className="gn-panel p-6 sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[0.86fr_1.14fr] lg:items-center">
            <div>
              <p className="gn-eyebrow">Production path</p>
              <h2 className="mt-4 text-[2.15rem] leading-tight font-medium text-foreground">
                From Shadow Mode to bounded autonomy, only after evidence
              </h2>
              <p className="mt-4 text-base leading-8 text-muted-foreground">
                The page is a public-facing preview of the operator discipline:
                use Shadow Mode to watch dispatch proposals, publish proof
                artifacts, identify proof gaps, and only then expand authority
                inside strict dispatch envelopes.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                "telemetry + topology + policy",
                "deterministic solver / verification",
                "runtime assurance gate",
                "signed DispatchEnvelopeDTO",
                "read-only visual",
                "audit-ready proof pack",
              ].map((step, index) => (
                <div
                  key={step}
                  className="rounded-[0.9rem] border border-border/70 bg-background/45 p-4"
                >
                  <p className="font-mono text-xs text-primary">
                    0{index + 1}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-foreground">
                    {step}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SectionShell>

      <RelatedSeoLinks path="/platform/dispatch-envelope" />

      <SectionShell>
        <CtaBand
          headline={dispatchEnvelopeSections.cta.headline}
          body={dispatchEnvelopeSections.cta.body}
          label="Request Capacity Audit"
          href={buildLeadHref("capacity-audit", "dispatch-envelope-final")}
          eventName="dispatch-envelope-final-cta"
        />
      </SectionShell>

      <SectionShell>
        <div className="text-center">
          <Button asChild variant="outline" className="border-border/80 bg-surface/70">
            <Link href="/platform">
              Back to platform architecture
              <ArrowRightIcon />
            </Link>
          </Button>
        </div>
      </SectionShell>
    </div>
  )
}
