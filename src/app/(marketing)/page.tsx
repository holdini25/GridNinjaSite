import type { Metadata } from "next"
import Link from "next/link"

import { AutonomyLadder } from "@/components/marketing/autonomy-ladder"
import { CapacityWaterfall } from "@/components/marketing/capacity-waterfall"
import { ClaimToProofCards } from "@/components/marketing/claim-to-proof-cards"
import { ComparisonGrid } from "@/components/marketing/comparison-grid"
import { CtaBand } from "@/components/marketing/cta-band"
import { Hero } from "@/components/marketing/hero"
import { KpiPreview } from "@/components/marketing/kpi-preview"
import { LoadPassportPreview } from "@/components/marketing/load-passport-preview"
import { OutcomePillars } from "@/components/marketing/outcome-pillars"
import { ProofArtifactStack } from "@/components/marketing/proof-artifact-stack"
import { ProofStatStrip } from "@/components/marketing/proof-stat-strip"
import { SectionHeader } from "@/components/marketing/section-header"
import { PowerWallChart } from "@/components/diagrams/power-wall-chart"
import { RtaLoopDiagram } from "@/components/diagrams/rta-loop-diagram"
import { SectionShell } from "@/components/layout/section-shell"
import { homeKpis, proofStats, solutionTeasers, eventLog } from "@/content/metrics"
import {
  comparisonRows,
  comparisonSection,
  controlLoopSection,
  enginePillars,
  engineSection,
  homeFinalCta,
  homeHero,
  powerWallSection,
} from "@/content/copy/home"
import { ladderSteps } from "@/content/copy/proof"
import {
  claimToProofCards,
  illustrativeWaterfall,
  proofArtifactIntro,
  proofArtifacts,
} from "@/content/proof-artifacts"
import { buildLeadHref } from "@/lib/lead"
import { createPageMetadata } from "@/lib/seo"

export async function generateMetadata(): Promise<Metadata> {
  return createPageMetadata({
    title: "GridNinja | Virtual Capacity Control Plane for AI Data Centers",
    description:
      "GridNinja proves safe, usable, auditable virtual capacity for AI data centers before control, dispatch, or grid commitments are trusted.",
    path: "/",
  })
}

export default function HomePage() {
  return (
    <div className="space-y-24 pb-24">
      <Hero
        eyebrow={homeHero.eyebrow}
        headline={homeHero.headline}
        body={homeHero.body}
        primaryCta={{
          label: homeHero.primaryCtaLabel,
          href: buildLeadHref("capacity-audit", "home-hero"),
        }}
        secondaryCta={{
          label: homeHero.secondaryCtaLabel,
          href: "/demo",
        }}
        visual={<CapacityWaterfall steps={illustrativeWaterfall} compact />}
        proofGrid
      />

      <SectionShell>
        <ProofStatStrip items={proofStats} />
      </SectionShell>

      <SectionShell>
        <div className="space-y-10">
          <SectionHeader
            eyebrow="Claim to proof"
            headline="Available capacity becomes usable only after runtime assurance"
            body="Touch each domain to see how a nominal claim turns into allow / repair / reject / no-proof evidence."
          />
          <ClaimToProofCards cards={claimToProofCards} />
        </div>
      </SectionShell>

      <SectionShell>
        <div className="space-y-10">
          <SectionHeader
            eyebrow={proofArtifactIntro.eyebrow}
            headline={proofArtifactIntro.headline}
            body={proofArtifactIntro.body}
          />
          <ProofArtifactStack artifacts={proofArtifacts} />
        </div>
      </SectionShell>

      <SectionShell>
        <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <SectionHeader
            eyebrow={powerWallSection.eyebrow}
            headline={powerWallSection.headline}
            body={powerWallSection.body}
          />
          <div className="space-y-4">
            <PowerWallChart />
            <ul className="grid gap-3">
              {powerWallSection.bullets.map((bullet) => (
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
        <div className="space-y-10">
          <SectionHeader
            eyebrow={comparisonSection.eyebrow}
            headline={comparisonSection.headline}
            body={comparisonSection.body}
          />
          <ComparisonGrid rows={comparisonRows} />
        </div>
      </SectionShell>

      <SectionShell>
        <div className="space-y-10">
          <SectionHeader
            eyebrow={engineSection.eyebrow}
            headline={engineSection.headline}
            body={engineSection.body}
          />
          <OutcomePillars items={enginePillars} />
        </div>
      </SectionShell>

      <SectionShell>
        <LoadPassportPreview />
      </SectionShell>

      <SectionShell>
        <div className="space-y-10">
          <SectionHeader
            eyebrow={controlLoopSection.eyebrow}
            headline={controlLoopSection.headline}
            body={controlLoopSection.body}
          />
          <RtaLoopDiagram steps={controlLoopSection.steps} />
        </div>
      </SectionShell>

      <SectionShell>
        <div className="space-y-10">
          <SectionHeader
            eyebrow="KPI preview"
            headline="See safe headroom, binding constraints, and proof in one view"
            body="The operating surface should explain why an action is allowed, repaired, or rejected before autonomy expands."
          />
          <KpiPreview cards={homeKpis} eventLog={eventLog} />
        </div>
      </SectionShell>

      <SectionShell>
        <div className="space-y-10">
          <SectionHeader
            eyebrow="Proof Before Autonomy"
            headline="Trust is earned before control is expanded"
            body="GridNinja proves the decision path in Shadow Mode before it touches live controls."
          />
          <AutonomyLadder steps={ladderSteps} />
        </div>
      </SectionShell>

      <SectionShell>
        <div className="space-y-10">
          <SectionHeader
            eyebrow="Built for the Operators Under the Most Pressure"
            headline="Designed for AI cloud and colocation operators under hard infrastructure limits"
            body="Phase one stays focused on the buyers who need the business case, the assurance model, and the proof workflow immediately."
          />
          <div className="grid gap-6 lg:grid-cols-3">
            {solutionTeasers.map((solution) => (
              <Link
                key={solution.href}
                href={solution.href}
                className="gn-panel gn-panel-interactive px-6 py-7"
              >
                <p className="text-sm tracking-[0.28em] text-primary uppercase">
                  Solution
                </p>
                <h3 className="mt-4 text-[1.75rem] font-medium text-foreground">
                  {solution.title}
                </h3>
                <p className="mt-4 max-w-md text-base leading-8 text-muted-foreground">
                  {solution.body}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </SectionShell>

      <SectionShell>
        <CtaBand
          headline={homeFinalCta.headline}
          body={homeFinalCta.body}
          label={homeFinalCta.label}
          href={buildLeadHref("capacity-audit", "home-final")}
        />
      </SectionShell>
    </div>
  )
}
