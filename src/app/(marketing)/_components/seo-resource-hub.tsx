import Link from "next/link"

import { SectionShell } from "@/components/layout/section-shell"
import { Button } from "@/components/ui/button"
import type { SeoResource } from "@/content/seo-resources"
import { buildLeadHref } from "@/lib/lead"

type ResourceHubProps = {
  eyebrow: string
  title: string
  answer: string
  boundary: string
  resources: readonly SeoResource[]
}

export function SeoResourceHub({
  eyebrow,
  title,
  answer,
  boundary,
  resources,
}: ResourceHubProps) {
  return (
    <div className="space-y-16 pb-20 sm:space-y-20 sm:pb-24">
      <header className="border-b border-border/70 py-10 sm:py-14">
        <SectionShell>
          <p className="gn-eyebrow">{eyebrow}</p>
          <h1 className="mt-5 max-w-[15ch] text-balance text-[2.5rem] leading-[0.98] font-medium tracking-tight text-foreground sm:text-[3.65rem] lg:text-[4.4rem]">
            {title}
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-9 text-muted-foreground">
            {answer}
          </p>
        </SectionShell>
      </header>

      <SectionShell>
        <section className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="gn-eyebrow">Publication boundary</p>
            <h2 className="mt-4 text-balance text-[2.1rem] leading-tight font-medium text-foreground">
              Evidence earns visibility
            </h2>
          </div>
          <p className="text-lg leading-9 text-muted-foreground">{boundary}</p>
        </section>
      </SectionShell>

      <SectionShell>
        <section aria-labelledby="resource-index-heading" className="space-y-8">
          <div>
            <p className="gn-eyebrow">Resource index</p>
            <h2 id="resource-index-heading" className="mt-4 text-balance text-[2.1rem] leading-tight font-medium text-foreground">
              Stable questions, scoped answers, explicit limits
            </h2>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            {resources.map((resource) => (
              <article key={resource.path} className="rounded-[1.8rem] border border-border/70 bg-surface px-6 py-7">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-mono text-xs tracking-[0.16em] text-proof-cyan uppercase">
                    {resource.eyebrow}
                  </p>
                  <span className="rounded-full border border-primary/30 bg-primary/8 px-3 py-1 font-mono text-[0.68rem] tracking-[0.12em] text-primary uppercase">
                    Publication gated
                  </span>
                </div>
                <h3 className="mt-5 text-balance text-[1.45rem] leading-tight font-medium text-foreground">
                  <Link className="hover:text-primary" href={resource.path}>
                    {resource.h1}
                  </Link>
                </h3>
                <p className="mt-4 line-clamp-4 text-base leading-8 text-muted-foreground">
                  {resource.shortAnswer}
                </p>
                <Link className="mt-6 inline-flex font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-primary" href={resource.path}>
                  Inspect resource
                </Link>
              </article>
            ))}
          </div>
        </section>
      </SectionShell>

      <SectionShell>
        <section className="rounded-[2rem] border border-border/80 bg-surface px-6 py-8 sm:px-8 lg:flex lg:items-end lg:justify-between lg:gap-10">
          <div className="max-w-2xl">
            <p className="gn-eyebrow">Capacity Audit</p>
            <h2 className="mt-4 text-balance text-[2.2rem] font-medium text-foreground">
              Bring the operator question before the capacity claim
            </h2>
            <p className="mt-4 text-base leading-8 text-muted-foreground">
              A Capacity Audit maps constrained infrastructure to proof-adjusted
              opportunities, refusal conditions, and a read-only Shadow Mode
              plan.
            </p>
          </div>
          <Button asChild size="lg" className="mt-8 lg:mt-0">
            <Link href={buildLeadHref("capacity-audit", `${eyebrow.toLowerCase().replaceAll(" ", "-")}-hub`)}>
              Request Capacity Audit
            </Link>
          </Button>
        </section>
      </SectionShell>
    </div>
  )
}
