import type { Metadata } from "next"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { AuthorityBoundary } from "@/components/marketing/authority-boundary"
import { AutonomyLadder } from "@/components/marketing/autonomy-ladder"
import { CtaBand } from "@/components/marketing/cta-band"
import { Hero } from "@/components/marketing/hero"
import { ProofArtifactGrid } from "@/components/marketing/proof-artifact-grid"
import { SectionHeader } from "@/components/marketing/section-header"
import { SectionShell } from "@/components/layout/section-shell"
import {
  dciiEvidenceOutputs,
  dciiFundingCopy,
  dciiHero,
  dciiMilestones,
  dciiRisks,
  dciiSourceNotes,
  dciiSummary,
} from "@/content/copy/dcii"
import { ladderSteps } from "@/content/copy/proof"
import { proofArtifacts, trustBoundaryItems } from "@/content/proof-artifacts"
import { buildLeadHref } from "@/lib/lead"
import { createPageMetadata } from "@/lib/seo"

export async function generateMetadata(): Promise<Metadata> {
  return createPageMetadata({
    title: "DCII Project | GridNinja",
    description:
      "Review GridNinja's source-validated DCII project framing for read-only proof-backed AI data center capacity validation.",
    path: "/dcii",
  })
}

export default function DciiPage() {
  return (
    <div className="space-y-24 pb-24">
      <Hero
        eyebrow={dciiHero.eyebrow}
        headline={dciiHero.headline}
        body={dciiHero.body}
        primaryCta={{
          label: "Request DCII Memo",
          href: buildLeadHref("dcii-memo", "dcii-hero"),
        }}
        secondaryCta={{
          label: "Inspect Proof Demo",
          href: "/demo",
        }}
        proofGrid
      />

      <SectionShell>
        <div className="grid gap-8 xl:grid-cols-[0.95fr_1.05fr]">
          <SectionHeader
            eyebrow={dciiSummary.eyebrow}
            headline={dciiSummary.headline}
            body={dciiSummary.body}
          />
          <div className="rounded-[1.2rem] border border-border/70 bg-surface px-6 py-7">
            <p className="text-sm tracking-[0.28em] text-primary uppercase">
              Funding source note
            </p>
            <p className="mt-4 text-base leading-8 text-muted-foreground">
              {dciiFundingCopy}
            </p>
            <Button asChild className="mt-6" size="lg">
              <Link href={buildLeadHref("dcii-memo", "dcii-source-note")}>
                Request DCII Memo
              </Link>
            </Button>
          </div>
        </div>
      </SectionShell>

      <SectionShell>
        <AuthorityBoundary items={trustBoundaryItems} />
      </SectionShell>

      <SectionShell>
        <div className="space-y-10">
          <SectionHeader
            eyebrow="Evidence outputs"
            headline="The project produces deployment evidence, not autonomy theater"
            body="These are the proof objects the DCII project should validate in read-only Shadow Mode before any deeper control or dispatch posture is considered."
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {dciiEvidenceOutputs.map((output) => (
              <div
                key={output}
                className="rounded-[1rem] border border-border/70 bg-surface px-5 py-5 text-lg font-medium text-foreground"
              >
                {output}
              </div>
            ))}
          </div>
          <ProofArtifactGrid artifacts={proofArtifacts} />
        </div>
      </SectionShell>

      <SectionShell>
        <div className="space-y-10">
          <SectionHeader
            eyebrow="Milestones"
            headline="A conservative validation path over 18 months"
            body="Each milestone is designed to produce technical, operational, commercial, or stakeholder evidence without hiding authority transfer inside the project."
          />
          <div className="overflow-hidden rounded-[1.2rem] border border-border/70">
            <div className="grid gap-px bg-border/70">
              {dciiMilestones.map((milestone) => (
                <div
                  key={milestone.phase}
                  className="grid gap-3 bg-surface px-5 py-5 md:grid-cols-[0.8fr_0.45fr_1.2fr]"
                >
                  <p className="font-medium text-foreground">{milestone.phase}</p>
                  <p className="font-mono text-sm text-primary">
                    {milestone.timing}
                  </p>
                  <p className="text-base leading-7 text-muted-foreground">
                    {milestone.output}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SectionShell>

      <SectionShell>
        <div className="space-y-10">
          <SectionHeader
            eyebrow="Deployment ladder"
            headline="Autonomy remains gated by proof artifacts"
            body="The DCII path is a validation program: Shadow Mode first, advisory review next, and bounded autonomy only after the evidence chain supports it."
          />
          <AutonomyLadder steps={ladderSteps} />
        </div>
      </SectionShell>

      <SectionShell>
        <div className="grid gap-8 xl:grid-cols-[0.85fr_1.15fr]">
          <SectionHeader
            eyebrow="Risk register"
            headline="Make the deployment risk explicit"
            body="The page should show reviewers that GridNinja understands operator trust, infrastructure fit, and impact-claim discipline."
          />
          <div className="grid gap-4">
            {dciiRisks.map((item) => (
              <div
                key={item.risk}
                className="rounded-[1rem] border border-border/70 bg-surface px-5 py-5"
              >
                <h3 className="text-lg font-medium text-foreground">
                  {item.risk}
                </h3>
                <p className="mt-2 text-base leading-8 text-muted-foreground">
                  {item.mitigation}
                </p>
              </div>
            ))}
          </div>
        </div>
      </SectionShell>

      <SectionShell>
        <div className="rounded-[1.2rem] border border-border/70 bg-surface px-6 py-7">
          <p className="text-sm tracking-[0.28em] text-primary uppercase">
            Source notes
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {dciiSourceNotes.map((source) => (
              <a
                key={source.href}
                href={source.href}
                className="rounded-[1rem] border border-border/70 bg-background/35 px-5 py-5 transition-colors hover:bg-surface-2"
              >
                <h3 className="text-lg font-medium text-foreground">
                  {source.label}
                </h3>
                <p className="mt-2 text-base leading-7 text-muted-foreground">
                  {source.detail}
                </p>
              </a>
            ))}
          </div>
        </div>
      </SectionShell>

      <SectionShell>
        <CtaBand
          headline="Review the DCII project as a proof-first validation program"
          body="Request the memo to discuss scope, evidence outputs, deployment boundary, and stakeholder review path."
          label="Request DCII Memo"
          href={buildLeadHref("dcii-memo", "dcii-final")}
        />
      </SectionShell>
    </div>
  )
}
