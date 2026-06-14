import type { Metadata } from "next"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { AuthorityBoundary } from "@/components/marketing/authority-boundary"
import { AutonomyLadder } from "@/components/marketing/autonomy-ladder"
import { ConstraintBraid } from "@/components/marketing/constraint-braid"
import { CtaBand } from "@/components/marketing/cta-band"
import { FleetSwarmMap } from "@/components/marketing/fleet-swarm-map"
import { Hero } from "@/components/marketing/hero"
import { NoProofRegister } from "@/components/marketing/no-proof-register"
import { ProofLog } from "@/components/marketing/proof-log"
import { ProofArtifactGrid } from "@/components/marketing/proof-artifact-grid"
import { ProofChainTrail } from "@/components/marketing/proof-chain-trail"
import { ProofReplayPanel } from "@/components/marketing/proof-replay-panel"
import { SectionHeader } from "@/components/marketing/section-header"
import { UtilityEvidencePacketPreview } from "@/components/marketing/utility-evidence-packet-preview"
import { SectionShell } from "@/components/layout/section-shell"
import {
  cisoFaqs,
  ladderSteps,
  operatorFaqs,
  proofHero,
  proofLog,
  proofSafetyCopy,
} from "@/content/copy/proof"
import { proofPackDownloadHref } from "@/content/copy/proof-pack"
import {
  constraintBraidDomains,
  fleetSwarmSites,
  noProofGaps,
  proofArtifacts,
  proofChainStages,
  replayFixture,
  trustBoundaryItems,
} from "@/content/proof-artifacts"
import { buildLeadHref } from "@/lib/lead"
import { createPageMetadata } from "@/lib/seo"

export async function generateMetadata(): Promise<Metadata> {
  return createPageMetadata({
    title: "Proof Before Autonomy | GridNinja",
    description:
      "See the Shadow Mode evidence, authority boundaries, no-proof behavior, and audit artifacts that establish trust before autonomy expands.",
    path: "/proof",
  })
}

export default function ProofPage() {
  const logLines = [
    { label: "14:05:12", value: `${proofLog.action} ${proofLog.summary}` },
    { label: "Reason", value: proofLog.reason },
    { label: "Binding constraint", value: proofLog.constraint },
    { label: "Post-action margin", value: proofLog.margin },
    { label: "SLA impact", value: proofLog.impact },
  ]

  return (
    <div className="space-y-24 pb-24">
      <Hero
        eyebrow={proofHero.eyebrow}
        headline={proofHero.headline}
        body={proofHero.body}
        primaryCta={{
          label: "Request Capacity Audit",
          href: buildLeadHref("shadow-mode", "proof-hero"),
        }}
        secondaryCta={{
          label: "Inspect Proof Demo",
          href: "/demo",
        }}
      />

      <SectionShell>
        <div className="space-y-10">
          <SectionHeader
            eyebrow="The autonomy ladder"
            headline="Shadow to bounded autonomy, with visible evidence at every step"
            body="Control authority expands only after operators can inspect the recommendation path, the remaining margin, and the rollback posture."
          />
          <AutonomyLadder steps={ladderSteps} />
        </div>
      </SectionShell>

      <SectionShell>
        <AuthorityBoundary items={trustBoundaryItems} />
      </SectionShell>

      <SectionShell>
        <ProofChainTrail stages={proofChainStages} proofRoot={replayFixture.proofRoot} />
      </SectionShell>

      <SectionShell>
        <ProofReplayPanel replay={replayFixture} />
      </SectionShell>

      <SectionShell>
        <div className="space-y-10">
          <SectionHeader
            eyebrow="Constraint braid"
            headline="The RTA decision inherits every active constraint"
            body="The proof chain stays legible by showing which power, cooling, storage, workload, or telemetry trust constraint produced allow, repair, reject, or no-proof."
          />
          <ConstraintBraid domains={constraintBraidDomains} />
        </div>
      </SectionShell>

      <SectionShell>
        <div className="space-y-10">
          <SectionHeader
            eyebrow="Fleet evidence"
            headline="A fleet panel can compare proof posture without approving actions"
            body="This view is read-only evidence aggregation. Local site policy, operator review, and runtime assurance remain the authority boundary."
          />
          <FleetSwarmMap sites={fleetSwarmSites} />
        </div>
      </SectionShell>

      <SectionShell>
        <div className="space-y-10">
          <SectionHeader
            eyebrow="Artifact gallery"
            headline="Operator-readable proof objects, not just recommendations"
            body="GridNinja produces the Load Passports, ledgers, reports, registers, and packets needed to evaluate virtual capacity before bounded autonomy."
          />
          <ProofArtifactGrid artifacts={proofArtifacts} />
        </div>
      </SectionShell>

      <SectionShell>
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <NoProofRegister gaps={noProofGaps} />
          <UtilityEvidencePacketPreview />
        </div>
      </SectionShell>

      <SectionShell>
        <div className="grid gap-8 xl:grid-cols-[0.85fr_1.15fr]">
          <SectionHeader
            eyebrow="Audit log example"
            headline="Readable, attributable, and grounded in the active constraint"
            body="Every repair or rejection is logged in plain operator language, with the relevant envelope and predicted impact attached."
          />
          <ProofLog lines={logLines} />
        </div>
      </SectionShell>

      <SectionShell>
        <div className="rounded-[1.8rem] border border-border/70 bg-surface px-6 py-8">
          <p className="text-sm tracking-[0.28em] text-primary uppercase">
            Safety and rollback
          </p>
          <p className="mt-4 max-w-4xl text-lg leading-8 text-muted-foreground">
            {proofSafetyCopy}
          </p>
        </div>
      </SectionShell>

      <SectionShell>
        <div className="grid gap-8 xl:grid-cols-2">
          <div className="rounded-[1.35rem] border border-border/70 bg-surface px-6 py-7">
            <p className="text-sm tracking-[0.28em] text-primary uppercase">
              Operator FAQ
            </p>
            <div className="mt-5 space-y-5">
              {operatorFaqs.map((item) => (
                <div key={item.question}>
                  <h3 className="text-lg font-medium text-foreground">
                    {item.question}
                  </h3>
                  <p className="mt-2 text-base leading-8 text-muted-foreground">
                    {item.answer}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[1.35rem] border border-border/70 bg-surface px-6 py-7">
            <p className="text-sm tracking-[0.28em] text-primary uppercase">
              CISO FAQ
            </p>
            <div className="mt-5 space-y-5">
              {cisoFaqs.map((item) => (
                <div key={item.question}>
                  <h3 className="text-lg font-medium text-foreground">
                    {item.question}
                  </h3>
                  <p className="mt-2 text-base leading-8 text-muted-foreground">
                    {item.answer}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SectionShell>

      <SectionShell>
        <div className="rounded-[1.8rem] border border-border/70 bg-surface px-6 py-8 lg:flex lg:items-end lg:justify-between lg:gap-10">
          <div className="max-w-2xl">
            <p className="text-sm tracking-[0.28em] text-primary uppercase">
              Sample proof pack
            </p>
            <h2 className="mt-4 text-balance text-[2.25rem] font-medium text-foreground">
              Review the artifact stack before the first call
            </h2>
            <p className="mt-4 text-lg leading-9 text-muted-foreground">
              Open the full proof-pack surface or download the sample bundle to
              inspect logs, envelopes, and Shadow Mode artifacts before a live demo.
            </p>
          </div>
          <div className="mt-8 flex flex-wrap gap-4 lg:mt-0">
            <Button asChild size="lg">
              <Link href="/proof/proof-pack">Open proof pack</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-border/80 bg-surface/60 text-foreground"
            >
              <Link href="/demo">Inspect proof demo</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-border/80 bg-surface/60 text-foreground"
            >
              <Link href={proofPackDownloadHref}>Download sample</Link>
            </Button>
          </div>
        </div>
      </SectionShell>

      <SectionShell>
        <CtaBand
          headline="Start with Shadow Mode evidence, then expand control with proof in hand"
          body="Use Capacity Audit and Shadow Mode outputs to establish the business case, the active constraints, and the operating guardrails before bounded autonomy."
          label="Request Capacity Audit"
          href={buildLeadHref("shadow-mode", "proof-final")}
        />
      </SectionShell>
    </div>
  )
}
