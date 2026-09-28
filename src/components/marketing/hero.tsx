import type { ReactNode } from "react"

import Link from "next/link"

import { SectionShell } from "@/components/layout/section-shell"
import { ProofGridBackground } from "@/components/marketing/proof-grid-background"
import { Button } from "@/components/ui/button"
import type { AnalyticsEventName } from "@/lib/analytics"
import type { SectionCopy } from "@/types/site"

type HeroCta = {
  label: string
  href: string
  eventName?: string
  analyticsEvent?: AnalyticsEventName
  analyticsSource?: string
  analyticsIntent?: string
  analyticsArtifact?: string
  analyticsVersion?: string
}

type HeroProps = SectionCopy & {
  primaryCta?: HeroCta
  secondaryCta?: HeroCta
  trustLine?: string
  visual?: ReactNode
  visualClassName?: string
  proofGrid?: boolean
  proofGridLabels?: string[]
  layout?: "standard" | "facility" | "compact"
}

export function Hero({
  eyebrow,
  headline,
  body,
  primaryCta,
  secondaryCta,
  trustLine,
  visual,
  visualClassName,
  proofGrid = false,
  proofGridLabels,
  layout = "standard",
}: HeroProps) {
  const hasVisual = Boolean(visual)
  const compact = layout === "compact" && !hasVisual
  const containerClassName = layout === "facility"
    ? "grid grid-cols-[minmax(0,1fr)] gap-8 pt-6 pb-7 sm:gap-10 lg:grid-cols-[minmax(0,.88fr)_minmax(0,1.12fr)] lg:items-start lg:gap-8 lg:pt-8 lg:pb-8"
    : compact
    ? "max-w-3xl pt-6 pb-6 sm:pt-8 sm:pb-8 lg:max-w-4xl"
    : hasVisual
    ? "grid grid-cols-[minmax(0,1fr)] gap-8 pt-4 pb-7 sm:gap-10 sm:pt-6 sm:pb-8 lg:min-h-[34rem] lg:grid-cols-[minmax(0,1fr)_minmax(340px,520px)] lg:items-center lg:gap-14"
    : "max-w-3xl pt-8 pb-10 sm:pt-12 sm:pb-14 lg:max-w-4xl lg:pt-14 lg:pb-16"
  const headlineClassName = hasVisual
    ? "max-w-[17ch] text-balance text-[2.25rem] leading-[1.05] font-medium tracking-tight text-foreground sm:text-[3rem] lg:text-[3.125rem]"
    : "max-w-[19ch] text-balance text-[2.25rem] leading-[1.05] font-medium tracking-tight text-foreground sm:text-[3rem] lg:text-[3.125rem]"
  const bodyClassName = hasVisual
    ? "mt-4 max-w-xl text-base leading-7 text-muted-foreground"
    : "mt-4 max-w-2xl text-base leading-7 text-muted-foreground"

  return (
    <div
      role="region"
      aria-label={eyebrow ?? "Page introduction"}
      className={`relative overflow-hidden border-b border-divider ${compact ? "" : "pb-6"}`}
    >
      {proofGrid ? <ProofGridBackground labels={proofGridLabels} /> : null}
      <SectionShell
        className="relative"
        containerClassName={containerClassName}
        deferRendering={false}
      >
        <div className={hasVisual ? "min-w-0 max-w-2xl [overflow-wrap:anywhere]" : "min-w-0 max-w-3xl [overflow-wrap:anywhere]"}>
          {eyebrow ? (
            <p className="mb-4 text-xs leading-6 tracking-[0.16em] text-primary uppercase">
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
            <div className={`${compact ? "mt-5" : "mt-7"} flex flex-wrap gap-3`}>
              {primaryCta ? (
                <Button asChild size="lg" className="h-auto min-h-12 max-w-full whitespace-normal py-3 text-center">
                  <Link
                    prefetch={false}
                    href={primaryCta.href}
                    data-gn-event={primaryCta.eventName ?? "hero-primary-cta"}
                    data-analytics-event={primaryCta.analyticsEvent}
                    data-analytics-source={primaryCta.analyticsSource}
                    data-analytics-intent={primaryCta.analyticsIntent}
                    data-analytics-artifact={primaryCta.analyticsArtifact}
                    data-analytics-version={primaryCta.analyticsVersion}
                  >
                    {primaryCta.label}
                  </Link>
                </Button>
              ) : null}
              {secondaryCta ? (
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-auto min-h-12 max-w-full whitespace-normal bg-surface py-3 text-center text-foreground"
                >
                  <Link
                    prefetch={false}
                    href={secondaryCta.href}
                    data-gn-event={secondaryCta.eventName ?? "hero-secondary-cta"}
                    data-analytics-event={secondaryCta.analyticsEvent}
                    data-analytics-source={secondaryCta.analyticsSource}
                    data-analytics-intent={secondaryCta.analyticsIntent}
                    data-analytics-artifact={secondaryCta.analyticsArtifact}
                    data-analytics-version={secondaryCta.analyticsVersion}
                  >
                    {secondaryCta.label}
                  </Link>
                </Button>
              ) : null}
            </div>
          )}
          {trustLine ? (
            <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
              {trustLine}
            </p>
          ) : null}
        </div>
        {visual ? <div className={`min-w-0 ${visualClassName ?? "lg:pl-4"}`}>{visual}</div> : null}
      </SectionShell>
    </div>
  )
}
