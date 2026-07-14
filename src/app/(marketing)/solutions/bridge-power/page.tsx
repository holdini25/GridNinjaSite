import type { Metadata } from "next"

import { OutcomePillars } from "@/components/marketing/outcome-pillars"
import { SectionHeader } from "@/components/marketing/section-header"
import { TopologyMap } from "@/components/diagrams/topology-map"
import { CtaBand } from "@/components/marketing/cta-band"
import { Hero } from "@/components/marketing/hero"
import { SectionShell } from "@/components/layout/section-shell"
import { SeoBreadcrumbs } from "@/components/seo/breadcrumbs"
import { SeoPageJsonLd } from "@/components/seo/json-ld"
import { UtilityEvidencePacketPreview } from "@/components/marketing/utility-evidence-packet-preview"
import {
  bridgePowerFinalCta,
  bridgePowerHero,
  bridgePowerModes,
  bridgePowerOutcomes,
  bridgePowerProblem,
  bridgePowerTopology,
} from "@/content/copy/bridge-power"
import { buildLeadHref } from "@/lib/lead"
import { createPageMetadata } from "@/lib/seo"

export async function generateMetadata(): Promise<Metadata> {
  return createPageMetadata({
    title: "Bridge Power & DER | GridNinja",
    description:
      "Coordinate bridge power, batteries, cooling, and workload posture inside a runtime-assured control loop.",
    path: "/solutions/bridge-power",
  })
}

export default function BridgePowerPage() {
  return (
    <div className="space-y-14 pb-14 sm:space-y-16 sm:pb-16">
      <SeoPageJsonLd path="/solutions/bridge-power" />
      <SeoBreadcrumbs path="/solutions/bridge-power" />
      <Hero
        eyebrow={bridgePowerHero.eyebrow}
        headline={bridgePowerHero.headline}
        body={bridgePowerHero.body}
        primaryCta={{
          label: "Explore Bridge Power Orchestration",
          href: buildLeadHref("partnership", "bridge-power-hero"),
        }}
        secondaryCta={{
          label: "Request Capacity Audit",
          href: buildLeadHref("capacity-audit", "bridge-power-hero"),
        }}
      />

      <SectionShell>
        <div className="grid gap-8 sm:gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <SectionHeader
            eyebrow="The operating problem"
            headline={bridgePowerProblem.title}
            body={bridgePowerProblem.body}
          />
          <div className="rounded-[1.8rem] border border-border/70 bg-surface px-6 py-7">
            <p className="text-sm tracking-[0.28em] text-primary uppercase">
              Key risks
            </p>
            <ul className="mt-5 space-y-3">
              {bridgePowerProblem.bullets.map((bullet) => (
                <li
                  key={bullet}
                  className="border-l border-border/80 pl-4 text-base leading-8 text-muted-foreground"
                >
                  {bullet}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SectionShell>

      <SectionShell>
        <div className="space-y-8 sm:space-y-10">
          <SectionHeader
            eyebrow="Control topology"
            headline="One loop across utility, DER, cooling, workload, and proof"
            body="Bridge power becomes operationally useful when the site can see the control path, binding constraint, and remaining margin at the same time."
          />
          <TopologyMap items={bridgePowerTopology} />
        </div>
      </SectionShell>

      <SectionShell>
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[1.2rem] border border-border/70 bg-surface px-6 py-7">
            <p className="text-sm tracking-[0.28em] text-primary uppercase">
              Reserve-floor report
            </p>
            <h2 className="mt-4 text-[2rem] leading-[1.08] font-medium text-foreground">
              Bridge assets only count when resilience remains protected
            </h2>
            <p className="mt-4 text-base leading-8 text-muted-foreground">
              GridNinja treats UPS, BESS, and temporary generation as capacity
              only after reserve floors, transition risk, cooling response, and
              telemetry confidence are visible in the proof path.
            </p>
          </div>
          <UtilityEvidencePacketPreview />
        </div>
      </SectionShell>

      <SectionShell>
        <div className="space-y-8 sm:space-y-10">
          <SectionHeader
            eyebrow="What GridNinja adds"
            headline="Orchestration that keeps bridge power legible"
            body="Bridge assets need more than a dispatch schedule. They need a control plane that can explain transitions, preserve reserve posture, and produce proof."
          />
          <div className="grid gap-5 sm:gap-6 md:grid-cols-2 xl:grid-cols-4">
            {bridgePowerModes.map((mode) => (
              <div
                key={mode.title}
                className="rounded-[1.8rem] border border-border/70 bg-surface px-6 py-7"
              >
                <h3 className="text-[1.35rem] font-medium text-foreground">
                  {mode.title}
                </h3>
                <p className="mt-4 text-base leading-8 text-muted-foreground">
                  {mode.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </SectionShell>

      <SectionShell>
        <div className="grid gap-6 sm:gap-8 xl:grid-cols-[0.85fr_1.15fr]">
          <SectionHeader
            eyebrow="Primary outcomes"
            headline="Bridge power with a bounded operating model"
            body="The point is not just to energize sooner. It is to do so with less guesswork, tighter envelopes, and more proof."
          />
          <OutcomePillars items={bridgePowerOutcomes} />
        </div>
      </SectionShell>

      <SectionShell>
        <CtaBand
          eyebrow={bridgePowerFinalCta.eyebrow}
          headline={bridgePowerFinalCta.headline}
          body={bridgePowerFinalCta.body}
          label="Request Capacity Audit"
          href={buildLeadHref("capacity-audit", "bridge-power-final")}
        />
      </SectionShell>
    </div>
  )
}
