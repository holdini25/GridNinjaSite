import Link from "next/link"
import { assessmentScopeHref } from "@/lib/marketing-journeys"
import type { ReactNode } from "react"

import { SectionShell } from "@/components/layout/section-shell"
import { RelatedSeoLinks } from "@/components/seo/related-seo-links"
import { Button } from "@/components/ui/button"
import type { SeoResource } from "@/content/seo-resources"
import { isPublicationPromotable } from "@/seo/publication-eligibility"

type ResourceHubProps = {
  path: "/insights" | "/evidence" | "/methodology"
  eyebrow: string
  title: string
  answer: string
  boundary: string
  resources: readonly SeoResource[]
  introduction?: ReactNode
}

export function SeoResourceHub({
  path,
  eyebrow,
  title,
  answer,
  boundary,
  resources,
  introduction,
}: ResourceHubProps) {
  const published = resources.filter(resource => isPublicationPromotable(resource.publicationStatus))
  const pending = resources.filter(resource => !isPublicationPromotable(resource.publicationStatus))
  return (
    <div className="space-y-16 pb-20 sm:space-y-20 sm:pb-24">
      <header className="border-b border-border/70 py-10 sm:py-14">
        <SectionShell>
          <p className="gn-eyebrow">{eyebrow}</p>
          <h1 className="mt-5 max-w-[15ch] text-balance text-[2.25rem] leading-[0.98] font-medium tracking-tight text-foreground sm:text-[3rem] lg:text-[3.5rem]">
            {title}
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-9 text-muted-foreground">
            {answer}
          </p>
        </SectionShell>
      </header>

      {introduction}

      <SectionShell>
        <section className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="gn-eyebrow">How to use this evidence</p>
            <h2 className="mt-4 text-balance text-[2.1rem] leading-tight font-medium text-foreground">
              Read the scope with the result
            </h2>
          </div>
          <p className="text-lg leading-9 text-muted-foreground">{boundary}</p>
        </section>
      </SectionShell>

      <SectionShell>
        {published.length > 0 && <section aria-labelledby="resource-index-heading" className="space-y-6">
          <h2 id="resource-index-heading" className="text-2xl font-medium">Published resources</h2>
          <div className="grid gap-5 lg:grid-cols-2">{published.map(resource => <article key={resource.path} className="rounded-xl border border-border bg-surface p-6"><p className="text-sm text-muted-foreground">{resource.eyebrow} · Published{resource.evidence ? ` · v${resource.evidence.version}` : ""}</p><h3 className="mt-3 text-xl font-medium"><Link className="hover:text-primary" href={resource.path}>{resource.h1}</Link></h3><p className="mt-3 leading-7 text-muted-foreground">{resource.shortAnswer}</p><Link className="mt-3 inline-flex min-h-11 items-center text-primary underline underline-offset-4" href={resource.path}>Read this resource</Link></article>)}</div>
        </section>}
        {pending.length > 0 && <details className="mt-6 rounded-xl border border-border bg-surface p-5"><summary className="min-h-11 cursor-pointer content-center text-lg font-medium">Resources awaiting publication ({pending.length})</summary><p className="mt-3 max-w-prose text-base leading-7 text-muted-foreground">These resources are not yet published. Their status pages explain what is available today; they are not technical evidence.</p><ul className="mt-4 divide-y divide-divider">{pending.map(resource => <li key={resource.path} className="py-3"><Link className="inline-flex min-h-11 items-center text-primary underline underline-offset-4" href={resource.path}>{resource.h1}</Link><p className="text-sm text-muted-foreground">Not yet available</p></li>)}</ul></details>}
      </SectionShell>

      <RelatedSeoLinks path={path} />

      <SectionShell>
        <section className="rounded-xl border border-border/80 bg-surface px-6 py-8 sm:px-8 lg:flex lg:items-end lg:justify-between lg:gap-10">
          <div className="max-w-2xl">
            <p className="gn-eyebrow">Capacity assessment</p>
            <h2 className="mt-4 text-balance text-[2.2rem] font-medium text-foreground">
              Bring the operator question before the capacity claim
            </h2>
            <p className="mt-4 text-base leading-8 text-muted-foreground">
              A bounded assessment reviews one capacity question, its evidence, constraints, and unresolved commercial decisions.
            </p>
          </div>
          <Button asChild size="lg" className="mt-8 lg:mt-0">
            <Link href={assessmentScopeHref(path === "/insights" ? "insights-hub" : path === "/evidence" ? "evidence-hub" : "methodology-hub")}>
              Contact Us
            </Link>
          </Button>
        </section>
      </SectionShell>
    </div>
  )
}
