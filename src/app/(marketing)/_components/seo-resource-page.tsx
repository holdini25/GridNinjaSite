import Link from "next/link"

import { SectionShell } from "@/components/layout/section-shell"
import { SeoPageJsonLd } from "@/components/seo/json-ld"
import { Button } from "@/components/ui/button"
import type { SeoEvidenceRecord, SeoResource } from "@/content/seo-resources"
import { buildLeadHref } from "@/lib/lead"

function DetailList({
  title,
  items,
}: {
  title: string
  items: readonly string[]
}) {
  return (
    <section className="rounded-[1.8rem] border border-border/70 bg-surface px-6 py-7">
      <h2 className="text-xl font-medium text-foreground">{title}</h2>
      <ul className="mt-5 space-y-3">
        {items.map((item) => (
          <li
            key={item}
            className="border-l border-border/80 pl-4 text-base leading-8 text-muted-foreground"
          >
            {item}
          </li>
        ))}
      </ul>
    </section>
  )
}

function EvidenceRecord({ evidence }: { evidence: SeoEvidenceRecord }) {
  const rows = [
    ["Claim", evidence.claim],
    ["Maturity", evidence.maturity],
    ["Environment", evidence.environment],
    ["Measurement window", evidence.measurementWindow],
    ["Sample size", evidence.sampleSize],
    ["Version", evidence.version],
    ["Artifact hash", evidence.artifactHash],
    ["Result", evidence.result],
    ["Uncertainty", evidence.uncertainty],
    ["Interpretation", evidence.interpretation],
    ["Technical owner", evidence.technicalOwner],
    ["Reviewer", evidence.reviewer],
    ["Next review", evidence.nextReviewDate],
  ] as const

  return (
    <section aria-labelledby="evidence-record-heading" className="space-y-8">
      <div>
        <p className="gn-eyebrow">Evidence record</p>
        <h2
          id="evidence-record-heading"
          className="mt-4 text-balance text-[2.05rem] leading-tight font-medium text-foreground"
        >
          Scope before result
        </h2>
        <p className="mt-4 max-w-3xl text-base leading-8 text-muted-foreground">
          This record keeps the claim, environment, evidence maturity, and
          review boundary together. Publication status is not a substitute for
          named technical ownership or independent review.
        </p>
      </div>

      <dl className="overflow-hidden rounded-[1.8rem] border border-border/70 bg-surface">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="grid gap-2 border-b border-border/60 px-6 py-5 last:border-b-0 md:grid-cols-[13rem_minmax(0,1fr)]"
          >
            <dt className="font-mono text-xs tracking-[0.16em] text-proof-cyan uppercase">
              {label}
            </dt>
            <dd className="text-base leading-8 text-muted-foreground">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-2">
        <DetailList title="Assumptions" items={evidence.assumptions} />
        <DetailList title="Method" items={evidence.method} />
        <DetailList title="Negative and no-proof cases" items={evidence.negativeCases} />
        <DetailList title="Reproduction procedure" items={evidence.reproduction} />
      </div>

      <Button asChild variant="outline" className="border-border/80 bg-surface/60">
        <Link
          href={evidence.downloadHref}
          data-analytics-event="evidence_artifact_view"
          data-analytics-source="evidence-resource"
          data-analytics-artifact={evidence.downloadHref}
          data-analytics-version={evidence.version}
        >
          Download the versioned artifact
        </Link>
      </Button>
    </section>
  )
}

export function SeoResourcePage({ resource }: { resource: SeoResource }) {
  const hubPath =
    resource.kind === "methodology"
      ? "/methodology"
      : resource.kind === "evidence"
        ? "/evidence"
        : "/insights"
  const hubLabel =
    resource.kind === "methodology"
      ? "Methodology"
      : resource.kind === "evidence"
        ? "Evidence"
        : "Insights"

  return (
    <>
      <SeoPageJsonLd path={resource.path} />
      <article className="space-y-16 pb-20 sm:space-y-20 sm:pb-24">
      <header className="border-b border-border/70 py-10 sm:py-14">
        <SectionShell>
          <nav aria-label="Breadcrumb" className="mb-7">
            <ol className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <li><Link className="hover:text-foreground" href="/">Home</Link></li>
              <li aria-hidden="true">/</li>
              <li><Link className="hover:text-foreground" href={hubPath}>{hubLabel}</Link></li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="text-foreground">{resource.h1}</li>
            </ol>
          </nav>
          <p className="gn-eyebrow">{resource.eyebrow}</p>
          <h1 className="mt-5 max-w-[15ch] text-balance text-[2.4rem] leading-[0.98] font-medium tracking-tight text-foreground sm:text-[3.5rem] lg:text-[4.2rem]">
            {resource.h1}
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-9 text-muted-foreground">
            {resource.shortAnswer}
          </p>
          <aside className="mt-8 max-w-3xl rounded-[1.35rem] border border-primary/35 bg-primary/8 px-5 py-4">
            <p className="font-mono text-xs tracking-[0.16em] text-primary uppercase">
              Publication gate · noindex
            </p>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              This technical resource is available for review but is not
              eligible for indexing until real named author and reviewer
              profiles, affiliations, disclosures, and approval ownership are
              supplied. No independent validation is implied.
            </p>
          </aside>
        </SectionShell>
      </header>

      <SectionShell>
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="gn-panel px-6 py-7">
            <p className="gn-eyebrow">Definition</p>
            <h2 className="mt-4 text-[1.7rem] font-medium text-foreground">
              What it is
            </h2>
            <p className="mt-4 text-base leading-8 text-muted-foreground">
              {resource.definition}
            </p>
          </section>
          <section className="gn-panel px-6 py-7">
            <p className="gn-eyebrow">Category boundary</p>
            <h2 className="mt-4 text-[1.7rem] font-medium text-foreground">
              What it is not
            </h2>
            <p className="mt-4 text-base leading-8 text-muted-foreground">
              {resource.notDefinition}
            </p>
          </section>
        </div>
      </SectionShell>

      <SectionShell>
        <section className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="gn-eyebrow">Operational significance</p>
            <h2 className="mt-4 text-balance text-[2.15rem] leading-tight font-medium text-foreground">
              Why operators care
            </h2>
          </div>
          <p className="text-lg leading-9 text-muted-foreground">
            {resource.operationalSignificance}
          </p>
        </section>
      </SectionShell>

      <SectionShell>
        <section className="space-y-7">
          <div>
            <p className="gn-eyebrow">Mechanism</p>
            <h2 className="mt-4 text-balance text-[2.15rem] leading-tight font-medium text-foreground">
              How the decision path works
            </h2>
          </div>
          <ol className="grid gap-px overflow-hidden rounded-[1.8rem] border border-border/70 bg-border/70 lg:grid-cols-2">
            {resource.mechanism.map((step, index) => (
              <li key={step} className="bg-surface px-6 py-6">
                <span className="font-mono text-xs tracking-[0.16em] text-proof-cyan uppercase">
                  Step {String(index + 1).padStart(2, "0")}
                </span>
                <p className="mt-3 text-base leading-8 text-muted-foreground">
                  {step}
                </p>
              </li>
            ))}
          </ol>
        </section>
      </SectionShell>

      <SectionShell>
        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[1.8rem] border border-proof-cyan/25 bg-proof-cyan/5 px-6 py-7">
            <p className="gn-eyebrow">Textual diagram equivalent</p>
            <h2 className="mt-4 text-[1.7rem] font-medium text-foreground">
              Decision flow
            </h2>
            <p className="mt-5 font-mono text-sm leading-8 text-proof-cyan">
              {resource.textDiagram}
            </p>
          </div>
          <div className="rounded-[1.8rem] border border-border/70 bg-surface px-6 py-7">
            <p className="gn-eyebrow">{resource.example.label}</p>
            <h2 className="mt-4 text-[1.7rem] font-medium text-foreground">
              Visibly scoped example
            </h2>
            <p className="mt-5 text-base leading-8 text-muted-foreground">
              {resource.example.summary}
            </p>
          </div>
        </section>
      </SectionShell>

      {resource.evidence ? (
        <SectionShell>
          <EvidenceRecord evidence={resource.evidence} />
        </SectionShell>
      ) : null}

      <SectionShell>
        <div className="grid gap-6 lg:grid-cols-2">
          <DetailList title="Failure and no-proof cases" items={resource.failureCases} />
          <DetailList title="Limitations" items={resource.limitations} />
        </div>
      </SectionShell>

      <SectionShell>
        <section className="grid gap-8 xl:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="gn-eyebrow">Evidence and sources</p>
            <h2 className="mt-4 text-balance text-[2.15rem] leading-tight font-medium text-foreground">
              Inspect the basis, not just the answer
            </h2>
            <p className="mt-4 max-w-xl text-base leading-8 text-muted-foreground">
              Local evidence objects show the GridNinja proof contract. Primary
              sources provide external standards and risk-management context;
              they do not validate GridNinja performance.
            </p>
          </div>
          <div className="space-y-6">
            <ul className="rounded-[1.8rem] border border-border/70 bg-surface px-6 py-3">
              {resource.evidenceLinks.map((link) => (
                <li key={link.href} className="border-b border-border/60 py-4 last:border-b-0">
                  <Link className="font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-primary" href={link.href}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <ul className="rounded-[1.8rem] border border-border/70 bg-surface px-6 py-3">
              {resource.primarySources.map((source) => (
                <li key={source.href} className="border-b border-border/60 py-4 last:border-b-0">
                  <a
                    className="font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-primary"
                    href={source.href}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {source.label}
                  </a>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {source.organization}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </SectionShell>

      <SectionShell>
        <section className="rounded-[2rem] border border-border/80 bg-surface px-6 py-8 sm:px-8 lg:flex lg:items-end lg:justify-between lg:gap-10">
          <div className="max-w-2xl">
            <p className="gn-eyebrow">Proof before autonomy</p>
            <h2 className="mt-4 text-balance text-[2.25rem] font-medium text-foreground">
              Test the evidence boundary against your capacity question
            </h2>
            <p className="mt-4 text-base leading-8 text-muted-foreground">
              Start with a Capacity Audit or read-only Shadow Mode discussion.
              GridNinja does not require control authority to identify where a
              capacity claim remains unproven.
            </p>
          </div>
          <div className="mt-8 flex flex-wrap gap-4 lg:mt-0">
            <Button asChild size="lg">
              <Link href={buildLeadHref("capacity-audit", `${resource.kind}-${resource.slug}`)}>
                Request Capacity Audit
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-border/80 bg-background/45">
              <Link href="/proof">See Shadow Mode</Link>
            </Button>
          </div>
        </section>
      </SectionShell>
      </article>
    </>
  )
}
