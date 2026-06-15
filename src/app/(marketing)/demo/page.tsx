import type { Metadata } from "next"

import { CtaBand } from "@/components/marketing/cta-band"
import { DemoInspectionRoom } from "@/components/marketing/demo-inspection-room"
import { FleetOSTimeTravelMap } from "@/components/marketing/fleetos-time-travel-map"
import { Hero } from "@/components/marketing/hero"
import { LoadPassportHD } from "@/components/marketing/load-passport-hd"
import { ProofStorySnap } from "@/components/marketing/proof-story-snap"
import { RtaDecisionTheater } from "@/components/marketing/rta-decision-theater"
import { SectionHeader } from "@/components/marketing/section-header"
import { SectionShell } from "@/components/layout/section-shell"
import { demoFinalCta, demoHero, demoScenario } from "@/content/copy/demo"
import { fleetSwarmSites, proofStorySteps } from "@/content/proof-artifacts"
import { buildLeadHref } from "@/lib/lead"
import { createPageMetadata } from "@/lib/seo"

export async function generateMetadata(): Promise<Metadata> {
  return createPageMetadata({
    title: "Proof Demo | GridNinja",
    description:
      "Inspect an illustrative GridNinja proof flow from nominal headroom to proof-adjusted virtual capacity and RTA trace.",
    path: "/demo",
  })
}

export default function DemoPage() {
  return (
    <div className="space-y-24 pb-24">
      <Hero
        eyebrow={demoHero.eyebrow}
        headline={demoHero.headline}
        body={demoHero.body}
        primaryCta={{
          label: "Request Capacity Audit",
          href: buildLeadHref("capacity-audit", "demo-hero"),
          eventName: "demo-hero-capacity-audit",
        }}
        secondaryCta={{
          label: "Book Demo",
          href: buildLeadHref("book-demo", "demo-hero"),
          eventName: "demo-hero-book-demo",
        }}
        trustLine="Every accepted MW must point to a proof row. All sample values are illustrative until validated in a Capacity Audit."
        proofGrid
      />

      <SectionShell>
        <div className="space-y-10">
          <SectionHeader
            eyebrow="Sales engineering inspection room"
            headline="One scenario, four stakeholder lenses, four runtime assurance outcomes"
            body="The demo is ungated and illustrative. It shows how GridNinja should explain claimed headroom, binding constraints, candidate actions, and no-proof behavior before a site-specific deployment."
          />
          <DemoInspectionRoom scenario={demoScenario} />
        </div>
      </SectionShell>

      <SectionShell>
        <RtaDecisionTheater />
      </SectionShell>

      <SectionShell>
        <ProofStorySnap steps={proofStorySteps} />
      </SectionShell>

      <SectionShell>
        <LoadPassportHD />
      </SectionShell>

      <SectionShell>
        <FleetOSTimeTravelMap sites={fleetSwarmSites} />
      </SectionShell>

      <SectionShell>
        <CtaBand
          eyebrow={demoFinalCta.eyebrow}
          headline={demoFinalCta.headline}
          body={demoFinalCta.body}
          label="Request Capacity Audit"
          href={buildLeadHref("capacity-audit", "demo-final")}
        />
      </SectionShell>
    </div>
  )
}
