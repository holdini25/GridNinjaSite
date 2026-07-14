import type { Metadata } from "next"
import Link from "next/link"

import { ArrowRightIcon } from "lucide-react"

import { AuthorityBoundary } from "@/components/marketing/authority-boundary"
import { ConstraintBraid } from "@/components/marketing/constraint-braid"
import { CtaBand } from "@/components/marketing/cta-band"
import {
  DeferredDataCenterXrayHD,
  DeferredFleetOSTimeTravelMap,
  DeferredLoadPassportHD,
  DeferredRtaDecisionTheater,
} from "@/components/marketing/deferred-proof-visuals"
import { Hero } from "@/components/marketing/hero"
import { ProductBoundaryToggle } from "@/components/marketing/product-boundary-toggle"
import { ProofArtifactGrid } from "@/components/marketing/proof-artifact-grid"
import { ProofChainTrail } from "@/components/marketing/proof-chain-trail"
import { SafetyBoundaryWall } from "@/components/marketing/safety-boundary-wall"
import { SectionHeader } from "@/components/marketing/section-header"
import { TopologyMap } from "@/components/diagrams/topology-map"
import { SectionShell } from "@/components/layout/section-shell"
import { SeoPageJsonLd } from "@/components/seo/json-ld"
import { Button } from "@/components/ui/button"
import {
  architectureFlow,
  platformHero,
  platformModules,
  platformProofSection,
} from "@/content/copy/platform"
import {
  constraintBraidDomains,
  proofArtifacts,
  proofChainStages,
  trustBoundaryItems,
} from "@/content/proof-artifacts"
import { buildLeadHref } from "@/lib/lead"
import { createPageMetadata } from "@/lib/seo"

export async function generateMetadata(): Promise<Metadata> {
  return createPageMetadata({
    title: "Platform | GridNinja",
    description:
      "See the runtime-assured virtual capacity platform architecture that turns constrained AI data center infrastructure into proof-backed capacity.",
    path: "/platform",
  })
}

export default function PlatformPage() {
  return (
    <div className="space-y-24 pb-24">
      <SeoPageJsonLd path="/platform" />
      <Hero
        eyebrow={platformHero.eyebrow}
        headline={platformHero.headline}
        body={platformHero.body}
        primaryCta={{
          label: "Request Capacity Audit",
          href: buildLeadHref("capacity-audit", "platform-hero"),
        }}
        secondaryCta={{
          label: "Inspect Proof Demo",
          href: "/demo",
        }}
      />

      <SectionShell>
        <DeferredDataCenterXrayHD />
      </SectionShell>

      <SectionShell>
        <div className="space-y-10">
          <SectionHeader
            eyebrow="Product modules"
            headline="One control plane, multiple operator-ready proof surfaces"
            body="Each module exists to make extra MW usable, explainable, and auditable before autonomy expands."
          />
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {platformModules.map((module) => (
              <div
                key={module.title}
                className="rounded-[1.8rem] border border-border/70 bg-surface px-6 py-7"
              >
                <h3 className="text-[1.35rem] font-medium text-foreground">
                  {module.title}
                </h3>
                <p className="mt-4 text-base leading-8 text-muted-foreground">
                  {module.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </SectionShell>

      <SectionShell>
        <ProductBoundaryToggle />
      </SectionShell>

      <SectionShell>
        <div className="space-y-10">
          <SectionHeader
            eyebrow="Platform architecture"
            headline="Telemetry to proof, in one bounded chain"
            body="The platform is structured so the same path that ranks and gates action bundles also generates audit-ready evidence."
          />
          <TopologyMap items={architectureFlow} />
          <ProofChainTrail stages={proofChainStages} />
        </div>
      </SectionShell>

      <SectionShell>
        <AuthorityBoundary items={trustBoundaryItems} />
      </SectionShell>

      <SectionShell>
        <DeferredRtaDecisionTheater />
      </SectionShell>

      <SectionShell>
        <div className="gn-panel px-6 py-7 sm:px-8 lg:flex lg:items-end lg:justify-between lg:gap-10">
          <div className="max-w-2xl">
            <p className="gn-eyebrow">Dispatch Envelope</p>
            <h2 className="mt-4 text-balance text-[2.05rem] leading-[1.08] font-medium text-foreground sm:text-[2.45rem] sm:leading-[1.06]">
              Inspect the runtime-assured capacity aperture
            </h2>
            <p className="mt-4 max-w-xl text-[1.02rem] leading-8 text-muted-foreground sm:text-lg sm:leading-9">
              See how GridNinja turns requested virtual capacity into an
              allow / repair / reject / no-proof dispatch envelope with binding
              constraints, evidence artifacts, and read-only Shadow Mode proof.
            </p>
          </div>
          <div className="mt-8 lg:mt-0">
            <Button asChild size="lg" variant="outline" className="group border-border/80 bg-background/45 text-foreground">
              <Link href="/platform/dispatch-envelope">
                Inspect Dispatch Envelope
                <ArrowRightIcon className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Button>
          </div>
        </div>
      </SectionShell>

      <SectionShell>
        <DeferredLoadPassportHD />
      </SectionShell>

      <SectionShell>
        <div className="space-y-10">
          <SectionHeader
            eyebrow="Constraint braid"
            headline="Capacity is accepted only after every binding constraint is visible"
            body="The braid links power, cooling, storage, workloads, and telemetry trust to the runtime assurance outcome so virtual capacity is not treated as a generic optimizer score."
          />
          <ConstraintBraid domains={constraintBraidDomains} />
        </div>
      </SectionShell>

      <SectionShell>
        <SafetyBoundaryWall />
      </SectionShell>

      <SectionShell>
        <div className="space-y-10">
          <SectionHeader
            eyebrow="Fleet evidence"
            headline="Fleet views aggregate evidence; local authority still gates action"
            body="FleetOS can compare proof posture across sites, but site policy, operators, and runtime assurance remain the approval boundary."
          />
          <DeferredFleetOSTimeTravelMap />
        </div>
      </SectionShell>

      <SectionShell>
        <div className="space-y-10">
          <SectionHeader
            eyebrow="Artifact surfaces"
            headline="Proof objects are part of the platform, not presentation polish"
            body="Each artifact exists so operators and stakeholders can inspect capacity claims, refusal logic, and evidence quality without treating a dashboard as authority."
          />
          <ProofArtifactGrid artifacts={proofArtifacts} />
        </div>
      </SectionShell>

      <SectionShell>
        <CtaBand
          headline={platformProofSection.headline}
          body={platformProofSection.body}
          label="Request Capacity Audit"
          href={buildLeadHref("capacity-audit", "platform-final")}
        />
      </SectionShell>
    </div>
  )
}
