import type { ReactNode } from "react"

import Link from "next/link"

import { SectionShell } from "@/components/layout/section-shell"
import { ProofGridBackground } from "@/components/marketing/proof-grid-background"
import { Button } from "@/components/ui/button"
import type { SectionCopy } from "@/types/site"

type HeroProps = SectionCopy & {
  primaryCta?: { label: string; href: string }
  secondaryCta?: { label: string; href: string }
  visual?: ReactNode
  proofGrid?: boolean
  proofGridLabels?: string[]
}

export function Hero({
  eyebrow,
  headline,
  body,
  primaryCta,
  secondaryCta,
  visual,
  proofGrid = false,
  proofGridLabels,
}: HeroProps) {
  const hasVisual = Boolean(visual)
  const containerClassName = hasVisual
    ? "grid gap-10 pt-6 pb-8 lg:min-h-[calc(100svh-9rem)] lg:grid-cols-[minmax(0,1fr)_minmax(340px,520px)] lg:items-center lg:gap-14"
    : "max-w-3xl pt-10 pb-12 sm:pt-12 sm:pb-14 lg:max-w-4xl lg:pt-14 lg:pb-16"
  const headlineClassName = hasVisual
    ? "max-w-[11ch] text-balance text-[2.65rem] leading-[0.95] font-medium tracking-tight text-foreground sm:text-[3.85rem] lg:text-[4.7rem]"
    : "max-w-[13ch] text-balance text-[2.35rem] leading-[0.98] font-medium tracking-tight text-foreground sm:text-[3.05rem] lg:text-[3.7rem]"
  const bodyClassName = hasVisual
    ? "mt-5 max-w-xl text-lg leading-8 text-muted-foreground sm:text-[1.16rem]"
    : "mt-5 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-[1.14rem]"

  return (
    <section className="relative overflow-hidden border-b border-border/70 pb-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,159,26,0.12),transparent_34%),linear-gradient(180deg,rgba(19,32,43,0.34),transparent_74%)]" />
      {proofGrid ? <ProofGridBackground labels={proofGridLabels} /> : null}
      <SectionShell className="relative" containerClassName={containerClassName}>
        <div className={hasVisual ? "max-w-2xl" : "max-w-3xl"}>
          {eyebrow ? (
            <p className="mb-5 text-sm tracking-[0.28em] text-primary uppercase">
              {eyebrow}
            </p>
          ) : null}
          <h1 className={headlineClassName}>
            {headline}
          </h1>
          <p className={bodyClassName}>
            {body}
          </p>
          {(primaryCta || secondaryCta) && (
            <div className="mt-7 flex flex-wrap gap-4">
              {primaryCta ? (
                <Button asChild size="lg">
                  <Link href={primaryCta.href}>{primaryCta.label}</Link>
                </Button>
              ) : null}
              {secondaryCta ? (
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-border/80 bg-surface/60 text-foreground"
                >
                  <Link href={secondaryCta.href}>{secondaryCta.label}</Link>
                </Button>
              ) : null}
            </div>
          )}
        </div>
        {visual ? <div className="lg:pl-4">{visual}</div> : null}
      </SectionShell>
    </section>
  )
}
