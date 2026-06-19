import type { Metadata } from "next"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { ContextualShadowCTA } from "@/components/marketing/contextual-shadow-cta"
import { OfficialSourceDrawer } from "@/components/marketing/official-source-drawer"
import { SectionHeader } from "@/components/marketing/section-header"
import { WhyGridNinjaChapterNav } from "@/components/marketing/why-gridninja-chapter-nav"
import { WhyGridNinjaComparisonExplorer } from "@/components/marketing/why-gridninja-comparison-explorer"
import { WhyGridNinjaHeroTrace } from "@/components/marketing/why-gridninja-hero-trace"
import { WhyGridNinjaPersonaTabs } from "@/components/marketing/why-gridninja-persona-tabs"
import { WhyGridNinjaProofRoom } from "@/components/marketing/why-gridninja-proof-room"
import { WhyGridNinjaProofTabs } from "@/components/marketing/why-gridninja-proof-tabs"
import { WhyGridNinjaRoleExplorer } from "@/components/marketing/why-gridninja-role-explorer"
import { WhyGridNinjaScenarioSimulator } from "@/components/marketing/why-gridninja-scenario-simulator"
import { WhyGridNinjaSourceDrawerHost } from "@/components/marketing/why-gridninja-source-drawer-host"
import { SectionShell } from "@/components/layout/section-shell"
import {
  type WhyGridNinjaSourceRecord,
  whyGridNinjaBoundary,
  whyGridNinjaChapters,
  whyGridNinjaComparisonRows,
  whyGridNinjaCompetitorProfiles,
  whyGridNinjaHero,
  whyGridNinjaIndispensabilityConditions,
  whyGridNinjaPersonas,
  whyGridNinjaProofRequirements,
  whyGridNinjaProofRoomArtifacts,
  whyGridNinjaRoleCards,
  whyGridNinjaScenarios,
  whyGridNinjaSourceRecords,
  whyGridNinjaTrustItems,
} from "@/content/copy/why-gridninja"
import { buildLeadHref } from "@/lib/lead"
import { createPageMetadata } from "@/lib/seo"
import { cn } from "@/lib/utils"

export async function generateMetadata(): Promise<Metadata> {
  return createPageMetadata({
    title: "Why GridNinja | Capacity Acceptance Layer",
    description:
      "See why GridNinja turns AI data center capacity claims into safe, usable, auditable capacity with runtime assurance and proof before autonomy.",
    path: "/why-gridninja",
  })
}

export default function WhyGridNinjaPage() {
  const sourceMap = new Map(
    whyGridNinjaSourceRecords.map((source) => [source.id, source])
  )

  return (
    <div className="pb-24">
      <WhyGridNinjaChapterNav chapters={whyGridNinjaChapters} />
      <WhyGridNinjaSourceDrawerHost sources={whyGridNinjaSourceRecords} />
      <ContextualShadowCTA />

      <div className="space-y-24">
        <SectionShell
          id="thesis"
          className="scroll-mt-32 pt-16 md:pt-24"
          containerClassName="max-w-7xl"
        >
          <div className="grid gap-10 xl:grid-cols-[1fr_0.9fr] xl:items-center">
            <div>
              <p className="gn-eyebrow">{whyGridNinjaHero.eyebrow}</p>
              <h1 className="mt-5 max-w-4xl text-balance text-[clamp(3rem,7vw,6.4rem)] leading-[0.95] font-medium text-foreground">
                <span className="md:hidden">
                  Before you trust another megawatt, ask for proof.
                </span>
                <span className="hidden md:inline">
                  {whyGridNinjaHero.headline}
                </span>
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-9 text-muted-foreground md:text-xl">
                {whyGridNinjaHero.body}
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Button asChild size="lg">
                  <Link href="#proof-standard">
                    {whyGridNinjaHero.primaryCtaLabel}
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-border/80 bg-surface/60 text-foreground"
                >
                  <Link href="#proof-room">
                    {whyGridNinjaHero.secondaryCtaLabel}
                  </Link>
                </Button>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                {["official-source comparisons", "evidence maturity shown", "read-only first"].map(
                  (item) => (
                    <span
                      key={item}
                      className="rounded-full border border-border/70 bg-surface px-3 py-1.5 font-mono text-xs tracking-[0.1em] text-muted-foreground uppercase"
                    >
                      {item}
                    </span>
                  )
                )}
              </div>
            </div>
            <WhyGridNinjaHeroTrace />
          </div>
        </SectionShell>

        <SectionShell containerClassName="max-w-7xl">
          <div className="grid overflow-hidden rounded-[1.2rem] border border-border/70 bg-surface md:grid-cols-5">
            {whyGridNinjaTrustItems.map((item) => (
              <div
                key={item}
                className="flex min-h-16 items-center justify-center gap-2 border-b border-border/70 px-4 py-4 text-center font-mono text-xs tracking-[0.12em] text-muted-foreground uppercase last:border-b-0 md:border-r md:border-b-0 md:last:border-r-0"
              >
                <span className="size-2 rounded-full bg-proof-cyan shadow-[0_0_18px_rgba(97,228,255,0.55)]" />
                {item}
              </div>
            ))}
          </div>
        </SectionShell>

        <SectionShell
          id="roles"
          className="scroll-mt-32"
          containerClassName="max-w-7xl"
        >
          <div className="space-y-10">
            <SectionHeader
              eyebrow="Category role map"
              headline="Strong systems already solve important parts of the problem"
              body="GridNinja works with the data-center stack. Its distinct responsibility begins where a capacity claim needs a site-local acceptance decision."
            />
            <WhyGridNinjaRoleExplorer roles={whyGridNinjaRoleCards} />
            <div className="rounded-[1.2rem] border border-primary/35 bg-primary/10 px-5 py-4 text-center font-mono text-sm tracking-[0.14em] text-primary uppercase">
              GridNinja acceptance boundary: verify / RTA / policy / proof
            </div>
          </div>
        </SectionShell>

        <SectionShell
          id="acceptance-boundary"
          className="scroll-mt-32"
          containerClassName="max-w-7xl"
        >
          <div className="space-y-10">
            <SectionHeader
              eyebrow="The missing layer"
              headline="A useful recommendation still needs a site-local acceptance decision"
              body="GridNinja does not need to own every sensor, model, controller, or market relationship. It owns the acceptance contract linking a claim to local evidence."
            />
            <div className="grid gap-5 lg:grid-cols-3">
              <BoundaryColumn
                label="Inputs"
                title="Existing systems and requests"
                items={whyGridNinjaBoundary.inputs}
              />
              <BoundaryColumn
                label="GridNinja boundary"
                title="Local acceptance logic"
                items={whyGridNinjaBoundary.logic}
                emphasized
              />
              <BoundaryColumn
                label="Outputs"
                title="Accepted evidence objects"
                items={whyGridNinjaBoundary.outputs}
              />
            </div>
          </div>
        </SectionShell>

        <SectionShell
          id="proof-standard"
          className="scroll-mt-32"
          containerClassName="max-w-7xl"
        >
          <div className="space-y-10">
            <SectionHeader
              eyebrow="Buyer diligence"
              headline="The 10-point Virtual Capacity Proof Test"
              body="GridNinja should be judged by the same evidence standard it asks buyers to apply to the market."
            />
            <WhyGridNinjaProofTabs requirements={whyGridNinjaProofRequirements} />
          </div>
        </SectionShell>

        <SectionShell
          id="comparison"
          className="scroll-mt-32"
          containerClassName="max-w-7xl"
        >
          <div className="space-y-10">
            <SectionHeader
              eyebrow="Fair comparison"
              headline="Compare roles, evidence, and authority boundaries"
              body="Cells summarize primary public positioning, not every possible vendor capability. Source drawers sit behind the comparison so diligence does not depend on marketing shorthand."
            />
            <WhyGridNinjaComparisonExplorer
              rows={whyGridNinjaComparisonRows}
              sources={whyGridNinjaSourceRecords}
            />
          </div>
        </SectionShell>

        <SectionShell
          id="competitors"
          className="gn-content-auto scroll-mt-32"
          containerClassName="max-w-7xl"
        >
          <div className="space-y-10">
            <SectionHeader
              eyebrow="Named profiles"
              headline="Respect the strengths. Define the responsibility."
              body="Each profile separates what official materials clearly establish from GridNinja's narrower acceptance-layer thesis."
            />
            <div className="grid gap-5 lg:grid-cols-2">
              {whyGridNinjaCompetitorProfiles.map((profile, index) => (
                <details
                  key={profile.id}
                  className="gn-panel group"
                  open={index === 0}
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 focus-visible:ring-3 focus-visible:ring-ring/45 [&::-webkit-details-marker]:hidden">
                    <div>
                      <h3 className="text-[1.45rem] font-medium text-foreground">
                        {profile.name}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {profile.category}
                      </p>
                    </div>
                    <span className="rounded-full border border-proof-cyan/30 px-3 py-1.5 font-mono text-xs text-proof-cyan">
                      {profile.sourceIds.length} sources
                    </span>
                  </summary>
                  <div className="grid gap-4 px-6 pb-6 md:grid-cols-2">
                    <ProfileBlock
                      label="What public materials show"
                      value={profile.publicMaterialsShow}
                    />
                    <ProfileBlock
                      label="GridNinja distinction"
                      value={profile.gridNinjaDistinction}
                    />
                    <ProfileBlock label="Overlap" value={profile.overlap} />
                    <ProfileBlock
                      label="What GridNinja must prove"
                      value={profile.gridNinjaMustProve}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 border-t border-border/70 px-6 py-4">
                    {profile.sourceIds
                      .map((sourceId) => sourceMap.get(sourceId))
                      .filter(
                        (source): source is WhyGridNinjaSourceRecord =>
                          Boolean(source)
                      )
                      .map((source) => (
                        <OfficialSourceDrawer
                          key={source.id}
                          source={source}
                          trigger={
                            <button
                              type="button"
                              className="min-h-11 rounded-full border border-proof-cyan/30 px-3 py-1.5 font-mono text-xs text-proof-cyan transition-colors hover:bg-proof-cyan/10 focus-visible:ring-3 focus-visible:ring-ring/45"
                            >
                              {source.organization}
                            </button>
                          }
                        />
                      ))}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </SectionShell>

        <SectionShell
          className="gn-content-auto"
          containerClassName="max-w-7xl"
        >
          <div className="space-y-10">
            <SectionHeader
              eyebrow="Architecture of dependence"
              headline="A common acceptance record turns multiple tools into one defensible decision"
              body="The strongest indispensability claim is architectural: remove the record and the stack loses a shared definition of trusted capacity."
            />
            <WhyGridNinjaScenarioSimulator scenarios={whyGridNinjaScenarios} />
          </div>
        </SectionShell>

        <SectionShell
          className="gn-content-auto"
          containerClassName="max-w-7xl"
        >
          <div className="space-y-10">
            <SectionHeader
              eyebrow="Indispensability conditions"
              headline="When the acceptance layer becomes operationally essential"
              body="Dependence emerges when multiple stakeholders need the same bounded, inspectable definition of capacity."
            />
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {whyGridNinjaIndispensabilityConditions.map((condition) => (
                <div
                  key={condition.label}
                  className="rounded-[1.2rem] border border-border/70 bg-surface px-5 py-6"
                >
                  <p className="font-mono text-xs tracking-[0.16em] text-proof-cyan uppercase">
                    {condition.label}
                  </p>
                  <h3 className="mt-4 text-[1.35rem] font-medium text-foreground">
                    {condition.title}
                  </h3>
                  <p className="mt-3 text-base leading-7 text-muted-foreground">
                    {condition.body}
                  </p>
                  <p className="mt-5 font-mono text-xs tracking-[0.12em] text-primary uppercase">
                    {condition.artifact}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </SectionShell>

        <SectionShell
          id="proof-room"
          className="gn-content-auto scroll-mt-32"
          containerClassName="max-w-7xl"
        >
          <div className="space-y-10">
            <SectionHeader
              eyebrow="Proof room"
              headline="Every differentiating claim should open into evidence"
              body="A claim without scope, maturity, date, artifact, and caveat should not appear on the public page."
            />
            <WhyGridNinjaProofRoom artifacts={whyGridNinjaProofRoomArtifacts} />
          </div>
        </SectionShell>

        <SectionShell
          className="gn-content-auto"
          containerClassName="max-w-7xl"
        >
          <div className="space-y-10">
            <SectionHeader
              eyebrow="Why it matters"
              headline="One acceptance record, different stakeholder value"
              body="The page lets each audience find its own proof path without changing the underlying product truth."
            />
            <WhyGridNinjaPersonaTabs personas={whyGridNinjaPersonas} />
          </div>
        </SectionShell>

        <SectionShell
          className="gn-content-auto"
          containerClassName="max-w-7xl"
        >
          <details className="rounded-[1.2rem] border border-border/70 bg-surface px-6 py-5">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-[1.3rem] font-medium text-foreground focus-visible:ring-3 focus-visible:ring-ring/45 [&::-webkit-details-marker]:hidden">
              Comparison methodology and source governance
              <span className="rounded-full border border-border/70 px-3 py-1.5 font-mono text-xs text-muted-foreground uppercase">
                disclosure
              </span>
            </summary>
            <div className="mt-4 lg:flex lg:items-center lg:justify-between lg:gap-8">
              <p className="max-w-3xl text-base leading-8 text-muted-foreground">
                Comparisons describe primary public positioning reviewed on the
                stated date. They do not assert that a vendor lacks every
                capability absent from public materials. GridNinja claims show
                evidence maturity, scope, validation date, and caveats.
              </p>
              <Button
                asChild
                variant="outline"
                className="mt-6 border-border/80 bg-background/45 text-foreground lg:mt-0"
              >
                <Link href="#comparison">Review sources</Link>
              </Button>
            </div>
          </details>
        </SectionShell>

        <SectionShell
          id="site-specific-proof"
          className="gn-content-auto scroll-mt-32"
          containerClassName="max-w-7xl"
        >
          <div className="rounded-[1.6rem] border border-primary/35 bg-[linear-gradient(135deg,rgba(255,159,26,0.14),rgba(97,228,255,0.04)),var(--surface)] px-6 py-8 md:px-8 lg:grid lg:grid-cols-[1fr_0.72fr] lg:gap-8">
            <div>
              <p className="gn-eyebrow">Site-specific proof</p>
              <h2 className="mt-4 max-w-3xl text-balance text-[2.55rem] leading-tight font-medium text-foreground">
                Compare GridNinja on your site, not on a feature sheet.
              </h2>
              <p className="mt-4 max-w-3xl text-lg leading-9 text-muted-foreground">
                Start with a read-only shadow assessment. Map constraints,
                identify no-proof gaps, replay candidate actions, and produce an
                operator-reviewable capacity evidence packet.
              </p>
              <div className="mt-7 flex flex-wrap gap-4">
                <Button asChild size="lg">
                  <Link
                    href={buildLeadHref("capacity-audit", "why-gridninja-final", {
                      scenario: "site-specific-proof",
                    })}
                  >
                    Run a shadow comparison
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-border/80 bg-background/45 text-foreground"
                >
                  <Link href="/proof/proof-pack">Inspect sample proof pack</Link>
                </Button>
              </div>
            </div>
            <div className="mt-8 rounded-[1.2rem] border border-border/70 bg-background/45 p-5 lg:mt-0">
              <p className="font-mono text-xs tracking-[0.16em] text-proof-cyan uppercase">
                Shadow assessment boundary
              </p>
              <ul className="mt-5 grid gap-3">
                {[
                  "No command VLAN",
                  "No write credentials",
                  "No live actuation",
                  "Operator-readable proof artifacts",
                  "Evidence maturity and caveats shown",
                ].map((item) => (
                  <li key={item} className="gn-proof-row text-base text-foreground">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </SectionShell>
      </div>
    </div>
  )
}

function BoundaryColumn({
  label,
  title,
  items,
  emphasized,
}: {
  label: string
  title: string
  items: string[]
  emphasized?: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-[1.2rem] border border-border/70 bg-surface px-5 py-6",
        emphasized && "border-proof-cyan/35 bg-proof-cyan/5"
      )}
    >
      <p
        className={cn(
          "font-mono text-xs tracking-[0.16em] uppercase",
          emphasized ? "text-proof-cyan" : "text-muted-foreground"
        )}
      >
        {label}
      </p>
      <h3 className="mt-3 text-[1.45rem] font-medium text-foreground">{title}</h3>
      <div className="mt-5 grid gap-2">
        {items.map((item) => (
          <div
            key={item}
            className="rounded-[0.85rem] border border-border/70 bg-background/45 px-4 py-3 text-sm leading-6 text-muted-foreground"
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  )
}

function ProfileBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] border border-border/70 bg-background/45 p-4">
      <p className="font-mono text-xs tracking-[0.16em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-2 text-base leading-7 text-muted-foreground">{value}</p>
    </div>
  )
}
