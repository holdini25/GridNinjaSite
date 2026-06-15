import type { Metadata } from "next"

import { CapacityAuditForm } from "@/components/forms/capacity-audit-form"
import { AnimatedMw } from "@/components/marketing/animated-mw"
import { CapacityWaterfall } from "@/components/marketing/capacity-waterfall"
import { Hero } from "@/components/marketing/hero"
import { LoadPassportHD } from "@/components/marketing/load-passport-hd"
import { NoProofRegister } from "@/components/marketing/no-proof-register"
import { ProofArtifactStack } from "@/components/marketing/proof-artifact-stack"
import { ProofComparisonSlider } from "@/components/marketing/proof-comparison-slider"
import { RtaDecisionTheater } from "@/components/marketing/rta-decision-theater"
import { SectionHeader } from "@/components/marketing/section-header"
import { SectionShell } from "@/components/layout/section-shell"
import { roiOutputs, roiAssumptions } from "@/content/roi-assumptions"
import { roiArchetypes, roiDeliverables, roiHero } from "@/content/copy/roi"
import {
  illustrativeWaterfall,
  noProofGaps,
  proofComparison,
  proofArtifacts,
} from "@/content/proof-artifacts"
import { createPageMetadata } from "@/lib/seo"

export async function generateMetadata(): Promise<Metadata> {
  return createPageMetadata({
    title: "ROI / Capacity Audit | GridNinja",
    description:
      "Quantify proof-adjusted virtual capacity, no-proof gaps, and the Capacity Audit business case before you promise flexible MW.",
    path: "/roi",
  })
}

export default function RoiPage() {
  return (
    <div className="space-y-24 pb-24">
      <Hero
        eyebrow={roiHero.eyebrow}
        headline={roiHero.headline}
        body={roiHero.body}
      />

      <SectionShell>
        <div className="space-y-10">
          <SectionHeader
            eyebrow="ROI archetypes"
            headline="Three ways constrained infrastructure turns into financial drag"
            body="Phase one keeps the ROI page analytical and conversion-oriented: clear archetypes, fixed scenario outputs, and a direct path to the audit intake."
          />
          <div className="grid gap-6 lg:grid-cols-3">
            {roiArchetypes.map((archetype) => (
              <div
                key={archetype.title}
                className="rounded-[1.8rem] border border-border/70 bg-surface px-6 py-7"
              >
                <h3 className="text-[1.35rem] font-medium text-foreground">
                  {archetype.title}
                </h3>
                <p className="mt-4 text-base leading-8 text-muted-foreground">
                  {archetype.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </SectionShell>

      <SectionShell>
        <CapacityWaterfall steps={illustrativeWaterfall} />
      </SectionShell>

      <SectionShell>
        <LoadPassportHD />
      </SectionShell>

      <SectionShell>
        <ProofComparisonSlider comparison={proofComparison} />
      </SectionShell>

      <SectionShell>
        <div className="space-y-10">
          <SectionHeader
            eyebrow="Audit proof outputs"
            headline="The business case is tied to artifacts, not optimistic MW"
            body="The Capacity Audit should produce the same proof objects a reviewer can inspect before GridNinja moves beyond Shadow Mode."
          />
          <ProofArtifactStack artifacts={proofArtifacts} />
        </div>
      </SectionShell>

      <SectionShell>
        <div className="space-y-8">
          <div className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="min-w-0 space-y-6">
              <SectionHeader
                eyebrow="Illustrative scenario outputs"
                headline="Output shape first, real calibration during the audit"
                body="This release avoids overpromising with a heavy live calculator. It shows sample outputs, assumptions, and the intake that moves the buyer into a real Capacity Audit."
              />
              <div className="grid gap-px overflow-hidden rounded-[1.8rem] border border-border/70 bg-border/70 md:grid-cols-2">
                {roiOutputs.map((output) => (
                  <div key={output.label} className="bg-surface px-5 py-6">
                    <p className="text-sm tracking-[0.18em] text-muted-foreground uppercase">
                      {output.label}
                    </p>
                    {typeof output.numericValue === "number" ? (
                      <AnimatedMw
                        value={output.numericValue}
                        className="mt-4 block font-mono text-3xl text-foreground"
                      />
                    ) : (
                      <p className="mt-4 font-mono text-3xl text-foreground">
                        {output.value}
                      </p>
                    )}
                    <p className="mt-4 text-base leading-8 text-muted-foreground">
                      {output.body}
                    </p>
                  </div>
                ))}
              </div>
              <div className="rounded-[1.8rem] border border-border/70 bg-surface px-6 py-7">
                <p className="text-sm tracking-[0.28em] text-primary uppercase">
                  Assumptions
                </p>
                <ul className="mt-4 space-y-3">
                  {roiAssumptions.map((assumption) => (
                    <li
                      key={assumption}
                      className="border-l border-border/80 pl-4 text-base leading-8 text-muted-foreground"
                    >
                      {assumption}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="min-w-0 space-y-6">
              <RtaDecisionTheater compact />
              <CapacityAuditForm
                intent="capacity-audit"
                source="roi-page"
              />
              <div className="rounded-[1.8rem] border border-border/70 bg-surface px-6 py-7">
                <p className="text-sm tracking-[0.28em] text-primary uppercase">
                  Capacity Audit deliverables
                </p>
                <ul className="mt-4 space-y-3">
                  {roiDeliverables.map((deliverable) => (
                    <li
                      key={deliverable}
                      className="border-l border-border/80 pl-4 text-base leading-8 text-muted-foreground"
                    >
                      {deliverable}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <NoProofRegister gaps={noProofGaps} />
        </div>
      </SectionShell>
    </div>
  )
}
