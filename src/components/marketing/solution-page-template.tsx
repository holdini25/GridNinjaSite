import Link from "next/link"

import { ArrowRightIcon } from "lucide-react"

import { SectionShell } from "@/components/layout/section-shell"
import { Hero } from "@/components/marketing/hero"
import { SectionHeader } from "@/components/marketing/section-header"
import { Button } from "@/components/ui/button"
import { buildLeadHref } from "@/lib/lead"
import type { SolutionPageConfig } from "@/types/site"

export function SolutionPageTemplate({ config }: { config: SolutionPageConfig }) {
  return (
    <div className="space-y-24 pb-24">
      <Hero
        eyebrow={config.hero.eyebrow}
        headline={config.hero.headline}
        body={config.hero.body}
        primaryCta={{
          label: config.ctaLabel,
          href: buildLeadHref("capacity-audit", config.ctaSource),
        }}
      />

      <SectionShell>
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <SectionHeader
            eyebrow="Why this matters"
            headline="Every recoverable megawatt must become operating leverage"
            body={config.whyThisMatters}
          />
          <div className="rounded-[1.8rem] border border-border/70 bg-surface px-6 py-7">
            <p className="text-sm tracking-[0.28em] text-primary uppercase">
              Buyer anxiety
            </p>
            <p className="mt-4 text-lg leading-8 text-foreground">
              {config.buyerAnxiety}
            </p>
            <p className="mt-6 text-sm tracking-[0.28em] text-primary uppercase">
              Key pain points
            </p>
            <ul className="mt-5 space-y-3">
              {config.painPoints.map((point) => (
                <li
                  key={point}
                  className="border-l border-border/80 pl-4 text-base leading-8 text-muted-foreground"
                >
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SectionShell>

      <SectionShell>
        <div className="grid gap-8 xl:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-sm tracking-[0.28em] text-primary uppercase">
              Primary outcomes
            </p>
            <div className="mt-6 space-y-4">
              {config.outcomes.map((outcome, index) => (
                <div
                  key={outcome}
                  className="rounded-[1.4rem] border border-border/70 bg-surface px-5 py-5"
                >
                  <p className="font-mono text-sm text-primary">0{index + 1}</p>
                  <p className="mt-3 text-xl font-medium text-foreground">
                    {outcome}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-px overflow-hidden rounded-[1.8rem] border border-border/70 bg-border/70 md:grid-cols-3">
            {config.metrics.map((metric) => (
              <div key={metric.label} className="bg-surface px-5 py-6">
                <p className="text-sm tracking-[0.18em] text-muted-foreground uppercase">
                  {metric.label}
                </p>
                <p className="mt-4 font-mono text-[2.2rem] leading-none text-foreground">
                  {metric.value}
                </p>
                <p className="mt-4 text-base leading-8 text-muted-foreground">
                  {metric.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </SectionShell>

      <SectionShell>
        <div className="grid gap-8 xl:grid-cols-[0.9fr_1.1fr]">
          <SectionHeader
            eyebrow="Proof produced"
            headline={config.artifact}
            body={config.caveat}
          />
          <div className="rounded-[1.2rem] border border-border/70 bg-surface px-6 py-7">
            <p className="text-sm tracking-[0.28em] text-primary uppercase">
              Stakeholder proof
            </p>
            <ul className="mt-5 space-y-3">
              {config.stakeholderProof.map((item) => (
                <li
                  key={item}
                  className="border-l border-border/80 pl-4 text-base leading-8 text-muted-foreground"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SectionShell>

      <SectionShell>
        <div className="rounded-[1.8rem] border border-border/70 bg-surface px-6 py-8 lg:flex lg:items-end lg:justify-between lg:gap-8">
          <div className="max-w-2xl">
            <p className="text-sm tracking-[0.28em] text-primary uppercase">
              Capacity Audit
            </p>
            <h2 className="mt-4 text-balance text-[2.15rem] leading-[1.08] font-medium text-foreground sm:text-[2.35rem]">
              Translate site constraints into an operator-ready decision path
            </h2>
            <p className="mt-4 text-lg leading-9 text-muted-foreground">
              Start with Shadow Mode evidence, binding constraints, and a quantified business case before you expand control authority.
            </p>
          </div>
          <div className="mt-8 lg:mt-0">
            <Button asChild size="lg">
              <Link href={buildLeadHref("capacity-audit", config.ctaSource)}>
                {config.ctaLabel}
                <ArrowRightIcon />
              </Link>
            </Button>
          </div>
        </div>
      </SectionShell>
    </div>
  )
}
