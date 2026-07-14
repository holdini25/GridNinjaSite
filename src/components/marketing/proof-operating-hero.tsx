import Link from "next/link"

import { ProofOperatingHeroVisual } from "@/components/marketing/proof-operating-hero-visual"
import { Button } from "@/components/ui/button"
import {
  illustrativeWaterfall,
  type WaterfallStep,
} from "@/content/proof-artifacts"
import { buildLeadHref } from "@/lib/lead"

const HERO_SECTION_ID = "proof-operating-hero"

export function ProofOperatingHero({
  steps = illustrativeWaterfall,
}: {
  steps?: WaterfallStep[]
}) {
  return (
    <div
      id={HERO_SECTION_ID}
      role="region"
      className="relative min-h-[calc(100svh-4rem)] border-b border-border/70 lg:min-h-[145svh]"
      aria-label="GridNinja proof operating system hero"
    >
      <div className="z-10 mx-auto grid min-h-[calc(100svh-4rem)] max-w-7xl items-center gap-10 px-4 py-10 sm:px-6 lg:sticky lg:top-16 lg:grid-cols-[minmax(0,0.92fr)_minmax(380px,560px)] lg:px-8">
        <div>
          <p className="gn-eyebrow">
            AI Data Center Virtual Capacity Control Plane
          </p>
          <h1 className="mt-5 max-w-[11ch] text-balance text-[2.65rem] leading-[0.95] font-medium tracking-tight text-foreground sm:text-[4.1rem] lg:text-[5.2rem]">
            Claimed headroom is not proven capacity.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            GridNinja is the runtime-assured virtual capacity engine for AI data
            centers.
          </p>
          <p className="mt-1 max-w-2xl text-lg leading-8 text-muted-foreground">
            It proves safe, usable, auditable capacity to accelerate
            time-to-power while protecting infrastructure.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link
                href={buildLeadHref("capacity-audit", "proof-operating-hero")}
                data-gn-event="proof-operating-hero-capacity-audit"
              >
                Request Capacity Audit
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-border/80 bg-surface/60 text-foreground"
            >
              <Link href="/demo" data-gn-event="proof-operating-hero-demo">
                Inspect proof demo
              </Link>
            </Button>
          </div>

          <div className="mt-5 flex flex-wrap gap-2 font-mono text-xs text-muted-foreground">
            <span className="rounded-full border border-border/70 bg-surface px-3 py-1">
              Shadow Mode first
            </span>
            <span className="rounded-full border border-border/70 bg-surface px-3 py-1">
              no command VLAN
            </span>
            <span className="rounded-full border border-border/70 bg-surface px-3 py-1">
              no write credentials
            </span>
          </div>
        </div>

        <ProofOperatingHeroVisual sectionId={HERO_SECTION_ID} steps={steps} />
      </div>
    </div>
  )
}
