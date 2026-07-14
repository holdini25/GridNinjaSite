import type { Metadata } from "next"
import Link from "next/link"

import { GridNinjaProofSeal } from "@/components/brand/gridninja-proof-seal"
import { Button } from "@/components/ui/button"
import { CapacityWaterfall } from "@/components/marketing/capacity-waterfall"
import { Hero } from "@/components/marketing/hero"
import { LoadPassportPreview } from "@/components/marketing/load-passport-preview"
import { ProofArtifactStack } from "@/components/marketing/proof-artifact-stack"
import { ProofStorySnap } from "@/components/marketing/proof-story-snap"
import { ProofLoadingSteps } from "@/components/marketing/proof-loading-steps"
import { ProofLog } from "@/components/marketing/proof-log"
import { SectionHeader } from "@/components/marketing/section-header"
import { UtilityEvidencePacketPreview } from "@/components/marketing/utility-evidence-packet-preview"
import { SectionShell } from "@/components/layout/section-shell"
import { SeoBreadcrumbs } from "@/components/seo/breadcrumbs"
import { SeoPageJsonLd } from "@/components/seo/json-ld"
import {
  proofPackChecklist,
  proofPackDownloadHref,
  proofPackFinalCta,
  proofPackHero,
  proofPackIncludes,
  proofPackPreview,
  proofPackSampleLog,
} from "@/content/copy/proof-pack"
import {
  illustrativeWaterfall,
  proofPackEvidenceChainStatus,
  proofArtifacts,
  proofLoadingSteps,
  proofStorySteps,
} from "@/content/proof-artifacts"
import { buildLeadHref } from "@/lib/lead"
import { createPageMetadata } from "@/lib/seo"

export async function generateMetadata(): Promise<Metadata> {
  return createPageMetadata({
    title: "Proof Pack | GridNinja",
    description:
      "Download a sample proof pack to see Load Passports, capacity waterfalls, RTA traces, reserve-floor reports, and utility evidence packets.",
    path: "/proof/proof-pack",
  })
}

export default function ProofPackPage() {
  return (
    <div className="space-y-16 pb-16 sm:space-y-20 sm:pb-20">
      <SeoPageJsonLd path="/proof/proof-pack" />
      <SeoBreadcrumbs path="/proof/proof-pack" />
      <Hero
        eyebrow={proofPackHero.eyebrow}
        headline={proofPackHero.headline}
        body={proofPackHero.body}
        primaryCta={{
          label: "Download sample proof pack",
          href: proofPackDownloadHref,
          analyticsEvent: "proof_pack_download",
          analyticsSource: "proof-pack-hero",
          analyticsArtifact: "sample-proof-pack",
          analyticsVersion: "1.0",
        }}
        secondaryCta={{
          label: "Request Capacity Audit",
          href: buildLeadHref("capacity-audit", "proof-pack-hero"),
        }}
      />

      <SectionShell>
        <div className="grid gap-8 xl:grid-cols-[0.9fr_1.1fr]">
          <SectionHeader
            eyebrow="What is inside"
            headline="See the artifact stack before anyone asks for trust"
            body="The sample pack shows how GridNinja turns telemetry, constraints, and decisions into operator-readable proof before bounded autonomy is on the table."
          />
          <div className="rounded-[1.8rem] border border-border/70 bg-surface px-6 py-7">
            <p className="text-sm tracking-[0.28em] text-primary uppercase">
              Included artifacts
            </p>
            <ul className="mt-5 space-y-3">
              {proofPackIncludes.map((item) => (
                <li
                  key={item}
                  className="border-l border-border/80 pl-4 text-base leading-8 text-muted-foreground"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SectionShell>

      <SectionShell>
        <ProofArtifactStack artifacts={proofArtifacts} />
      </SectionShell>

      <SectionShell>
        <ProofStorySnap steps={proofStorySteps} />
      </SectionShell>

      <SectionShell>
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <CapacityWaterfall steps={illustrativeWaterfall} />
          <LoadPassportPreview />
        </div>
      </SectionShell>

      <SectionShell>
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="gn-vt-proof-export rounded-[1.8rem] border border-border/70 bg-surface px-6 py-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm tracking-[0.28em] text-primary uppercase">
                Sample download
              </p>
              <GridNinjaProofSeal status={proofPackEvidenceChainStatus} />
            </div>
            <h2 className="mt-4 text-[2.2rem] font-medium text-foreground">
              Review the evidence package on your own terms
            </h2>
            <p className="mt-4 text-base leading-8 text-muted-foreground">
              Use the sample bundle to inspect the decision path, envelope
              margins, and rollback posture before you commit to a live review.
            </p>
            <div className="mt-6 flex flex-wrap gap-4">
              <Button asChild size="lg">
                <Link
                  href={proofPackDownloadHref}
                  data-analytics-event="proof_pack_download"
                  data-analytics-source="proof-pack-sample"
                  data-analytics-artifact="sample-proof-pack"
                  data-analytics-version="1.0"
                >
                  Download sample proof pack
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-border/80 bg-surface/60 text-foreground"
              >
                <Link href="/demo">
                  Inspect proof demo
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-border/80 bg-surface/60 text-foreground"
              >
                <Link href={buildLeadHref("load-passport", "proof-pack-sample")}>
                  Request Load Passport
                </Link>
              </Button>
            </div>
          </div>
          <div className="grid gap-px overflow-hidden rounded-[1.8rem] border border-border/70 bg-border/70 md:grid-cols-3">
            {proofPackPreview.map((item) => (
              <div key={item.label} className="bg-surface px-5 py-6">
                <p className="text-sm tracking-[0.18em] text-muted-foreground uppercase">
                  {item.label}
                </p>
                <p className="mt-4 text-[1.35rem] font-medium text-foreground">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
          <ProofLoadingSteps steps={proofLoadingSteps} />
        </div>
      </SectionShell>

      <SectionShell>
        <div className="grid gap-8 xl:grid-cols-[0.85fr_1.15fr]">
          <SectionHeader
            eyebrow="Example log"
            headline="A short log should explain the operating decision"
            body="The proof pack should let a reviewer understand what changed, why it changed, and what margin remained without opening a dashboard."
          />
          <ProofLog
            lines={proofPackSampleLog.map((line) => ({
              label: line.label,
              value: line.value,
              claimId: "claimId" in line ? line.claimId : undefined,
            }))}
          />
        </div>
      </SectionShell>

      <SectionShell>
        <UtilityEvidencePacketPreview />
      </SectionShell>

      <SectionShell>
        <div className="rounded-[1.8rem] border border-border/70 bg-surface px-6 py-8">
          <p className="text-sm tracking-[0.28em] text-primary uppercase">
            Review checklist
          </p>
          <ul className="mt-5 space-y-3">
            {proofPackChecklist.map((item) => (
              <li
                key={item}
                className="border-l border-border/80 pl-4 text-base leading-8 text-muted-foreground"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      </SectionShell>

      <SectionShell>
        <div className="rounded-[2rem] border border-border/80 bg-surface px-6 py-8 sm:px-8 lg:flex lg:items-end lg:justify-between lg:gap-10">
          <div className="max-w-2xl">
            <p className="text-sm tracking-[0.28em] text-primary uppercase">
              Proof before autonomy
            </p>
            <h2 className="mt-4 text-balance text-[2.35rem] font-medium text-foreground">
              {proofPackFinalCta.headline}
            </h2>
            <p className="mt-4 max-w-xl text-lg leading-9 text-muted-foreground">
              {proofPackFinalCta.body}
            </p>
          </div>
          <div className="mt-8 flex flex-wrap gap-4 lg:mt-0">
            <Button asChild size="lg">
              <Link href={buildLeadHref("capacity-audit", "proof-pack-final")}>
                Request Capacity Audit
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-border/80 bg-surface/60 text-foreground"
            >
              <Link href="/demo">Inspect Proof Demo</Link>
            </Button>
          </div>
        </div>
      </SectionShell>
    </div>
  )
}
