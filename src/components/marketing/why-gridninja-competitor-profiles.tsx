"use client"

import type { KeyboardEvent } from "react"
import { useMemo, useRef, useState } from "react"

import { ChevronDownIcon, ExternalLinkIcon } from "lucide-react"

import type {
  WhyGridNinjaCompetitorClaim,
  WhyGridNinjaCompetitorProfile,
  WhyGridNinjaResponsibilityStageId,
  WhyGridNinjaSourceRecord,
} from "@/content/copy/why-gridninja"
import { whyGridNinjaResponsibilityStages } from "@/content/copy/why-gridninja"
import { cn } from "@/lib/utils"

const claimOrder = [
  "publicMaterials",
  "sharedTerrain",
  "gridNinjaResponsibility",
  "proofThreshold",
] as const

const ownerLabels = {
  profile: "Publicly emphasized responsibility",
  shared: "Shared terrain",
  gridNinja: "GridNinja responsibility",
} as const

type StageOwner = keyof typeof ownerLabels | "unassigned"

export function WhyGridNinjaCompetitorProfiles({
  profiles,
  sources,
}: {
  profiles: readonly WhyGridNinjaCompetitorProfile[]
  sources: readonly WhyGridNinjaSourceRecord[]
}) {
  const [activeId, setActiveId] = useState(() => profiles[0]?.id ?? "")
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const sourceMap = useMemo(
    () => new Map(sources.map((source) => [source.id, source])),
    [sources]
  )
  const activeProfile =
    profiles.find((profile) => profile.id === activeId) ?? profiles[0]
  const activeSources = useMemo(
    () =>
      activeProfile
        ? getProfileSources(activeProfile, sourceMap)
        : ([] as WhyGridNinjaSourceRecord[]),
    [activeProfile, sourceMap]
  )

  if (!activeProfile) {
    return null
  }

  function selectProfile(profileId: string) {
    setActiveId(profileId)
    setSourcesOpen(false)
  }

  function activateByIndex(index: number) {
    const normalizedIndex = (index + profiles.length) % profiles.length
    const profile = profiles[normalizedIndex]

    if (!profile) {
      return
    }

    selectProfile(profile.id)
    tabRefs.current[normalizedIndex]?.focus()
  }

  function handleTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number
  ) {
    switch (event.key) {
      case "ArrowDown":
      case "ArrowRight":
        event.preventDefault()
        activateByIndex(currentIndex + 1)
        break
      case "ArrowUp":
      case "ArrowLeft":
        event.preventDefault()
        activateByIndex(currentIndex - 1)
        break
      case "Home":
        event.preventDefault()
        activateByIndex(0)
        break
      case "End":
        event.preventDefault()
        activateByIndex(profiles.length - 1)
        break
      default:
        break
    }
  }

  return (
    <div data-testid="competitor-profiles" className="space-y-6">
      <div className="rounded-[1.2rem] border border-primary/35 bg-primary/10 px-5 py-4 text-center sm:text-left">
        <p className="font-mono text-xs tracking-[0.15em] text-primary uppercase">
          Positioning invariant
        </p>
        <p className="mt-2 max-w-4xl text-base leading-7 text-foreground">
          Models rank. Solvers verify. Runtime assurance decides. Proof makes
          the capacity claim durable.
        </p>
      </div>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(17rem,0.42fr)_minmax(0,1fr)] lg:items-start">
        <nav
          aria-label="Competitor profiles"
          role="tablist"
          data-testid="competitor-rail"
          className="-mx-4 flex min-w-0 snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6 lg:sticky lg:top-44 lg:mx-0 lg:grid lg:gap-2 lg:overflow-visible lg:px-0 lg:pb-0"
        >
          {profiles.map((profile, index) => {
            const selected = profile.id === activeProfile.id
            const profileSources = getProfileSources(profile, sourceMap)

            return (
              <button
                key={profile.id}
                ref={(node) => {
                  tabRefs.current[index] = node
                }}
                id={`competitor-tab-${profile.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`competitor-panel-${profile.id}`}
                tabIndex={selected ? 0 : -1}
                className={cn(
                  "grid min-h-24 min-w-[17rem] snap-start grid-cols-[2rem_minmax(0,1fr)_auto] items-start gap-3 rounded-[1rem] border px-4 py-4 text-left transition-colors motion-reduce:transition-none lg:min-w-0",
                  selected
                    ? "border-primary/55 bg-primary/10 shadow-[0_18px_42px_-32px_rgba(255,159,26,0.88)]"
                    : "border-border/70 bg-surface/70 hover:border-proof-cyan/30 hover:bg-surface-2/85"
                )}
                onClick={() => selectProfile(profile.id)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "pt-0.5 font-mono text-xs tracking-[0.14em]",
                    selected ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0">
                  <span className="block text-base font-medium text-foreground">
                    {profile.name}
                  </span>
                  <span className="mt-1 block text-sm leading-5 text-muted-foreground">
                    {profile.category}
                  </span>
                </span>
                <span className="rounded-full border border-proof-cyan/25 px-2 py-1 font-mono text-[0.65rem] tracking-[0.08em] text-proof-cyan uppercase">
                  {profileSources.length}
                </span>
              </button>
            )
          })}
        </nav>

        <article
          key={activeProfile.id}
          id={`competitor-panel-${activeProfile.id}`}
          role="tabpanel"
          aria-labelledby={`competitor-tab-${activeProfile.id}`}
          tabIndex={0}
          data-testid="competitor-panel"
          className="animate-in fade-in slide-in-from-bottom-1 min-w-0 rounded-[1.45rem] border border-border/70 bg-[radial-gradient(circle_at_90%_8%,rgba(97,228,255,0.07),transparent_23rem),linear-gradient(145deg,rgba(19,30,41,0.96),rgba(8,13,18,0.96))] p-5 shadow-[0_30px_90px_-48px_rgba(0,0,0,0.9)] duration-[180ms] motion-reduce:animate-none sm:p-6"
        >
          <div className="flex flex-col gap-5 border-b border-border/65 pb-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="font-mono text-xs tracking-[0.15em] text-primary uppercase">
                Active profile
              </p>
              <h3 className="mt-3 text-2xl font-medium text-foreground sm:text-[1.75rem]">
                {activeProfile.name}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {activeProfile.category}
              </p>
            </div>
            <button
              type="button"
              aria-expanded={sourcesOpen}
              aria-controls={`competitor-sources-${activeProfile.id}`}
              onClick={() => setSourcesOpen((open) => !open)}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start rounded-full border border-proof-cyan/30 bg-proof-cyan/5 px-3.5 py-2 font-mono text-xs tracking-[0.09em] text-proof-cyan uppercase transition-colors hover:bg-proof-cyan/12 focus-visible:ring-3 focus-visible:ring-ring/45 motion-reduce:transition-none"
            >
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-proof-cyan shadow-[0_0_12px_rgba(97,228,255,0.7)]"
              />
              {activeSources.length} source
              {activeSources.length === 1 ? "" : "s"}
              <ChevronDownIcon
                aria-hidden="true"
                className={cn(
                  "size-4 transition-transform motion-reduce:transition-none",
                  sourcesOpen && "rotate-180"
                )}
              />
            </button>
          </div>

          <p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground">
            {activeProfile.summary}
          </p>

          <ResponsibilityMap profile={activeProfile} />

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {claimOrder.map((claimKey) => (
              <ClaimCard
                key={claimKey}
                claim={activeProfile.claims[claimKey]}
              />
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-2" aria-label="Profile tags">
            {activeProfile.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-border/70 bg-background/35 px-3 py-1.5 font-mono text-xs tracking-[0.07em] text-muted-foreground uppercase"
              >
                {tag}
              </span>
            ))}
          </div>

          {sourcesOpen ? (
            <aside
              id={`competitor-sources-${activeProfile.id}`}
              aria-label={`${activeProfile.name} source notes`}
              data-testid="competitor-sources"
              className="animate-in fade-in slide-in-from-bottom-1 mt-5 rounded-[1rem] border border-proof-cyan/25 bg-background/55 p-4 duration-[180ms] motion-reduce:animate-none"
            >
              <div className="flex flex-col gap-2 border-b border-border/65 pb-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="font-mono text-xs tracking-[0.15em] text-proof-cyan uppercase">
                    Source discipline
                  </p>
                  <h4 className="mt-2 text-lg font-medium text-foreground">
                    Claims are scoped to what each source supports.
                  </h4>
                </div>
                <p className="font-mono text-xs tracking-[0.08em] text-muted-foreground uppercase">
                  Reviewed {latestReviewDate(activeSources)}
                </p>
              </div>

              <ul className="mt-4 grid gap-3">
                {activeSources.map((source) => (
                  <li
                    key={source.id}
                    className="rounded-[0.8rem] border border-border/65 bg-surface/60 p-4"
                  >
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-medium text-foreground transition-colors hover:text-proof-cyan focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/45"
                    >
                      {source.title}
                      <ExternalLinkIcon aria-hidden="true" className="size-4" />
                    </a>
                    <p className="mt-2 font-mono text-[0.68rem] tracking-[0.08em] text-proof-cyan uppercase">
                      {source.organization} · {source.sourceType} · reviewed{" "}
                      {source.retrievalDate}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      {source.establishes}
                    </p>
                  </li>
                ))}
              </ul>
            </aside>
          ) : null}
        </article>
      </div>

      <div className="rounded-[1.1rem] border border-border/70 bg-surface/65 px-5 py-4">
        <p className="font-mono text-xs tracking-[0.15em] text-muted-foreground uppercase">
          Category boundary
        </p>
        <p className="mt-2 text-base leading-7 text-foreground">
          Others optimize, simulate, monitor, aggregate, or bundle. GridNinja
          verifies what can safely become usable capacity.
        </p>
      </div>
    </div>
  )
}

function ClaimCard({ claim }: { claim: WhyGridNinjaCompetitorClaim }) {
  return (
    <section
      data-kind={claim.kind}
      className={cn(
        "rounded-[0.95rem] border p-4",
        claim.kind === "public-materials" &&
          "border-border/75 bg-background/35",
        claim.kind === "shared-terrain" &&
          "border-sky-300/30 bg-sky-400/10",
        (claim.kind === "gridninja-responsibility" ||
          claim.kind === "proof-threshold") &&
          "border-primary/35 bg-primary/8"
      )}
    >
      <p
        className={cn(
          "font-mono text-xs tracking-[0.14em] uppercase",
          claim.kind === "public-materials" && "text-muted-foreground",
          claim.kind === "shared-terrain" && "text-sky-200",
          (claim.kind === "gridninja-responsibility" ||
            claim.kind === "proof-threshold") && "text-primary"
        )}
      >
        {claim.eyebrow}
      </p>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {claim.body}
      </p>
    </section>
  )
}

function ResponsibilityMap({
  profile,
}: {
  profile: WhyGridNinjaCompetitorProfile
}) {
  return (
    <section
      aria-labelledby={`responsibility-map-title-${profile.id}`}
      className="mt-6 rounded-[1rem] border border-border/70 bg-background/35 p-4"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs tracking-[0.15em] text-primary uppercase">
            Responsibility map
          </p>
          <h4
            id={`responsibility-map-title-${profile.id}`}
            className="mt-2 text-lg font-medium text-foreground"
          >
            Where the public profile ends and GridNinja begins.
          </h4>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <span className="size-2 rounded-full bg-slate-300/65" /> Public profile
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="size-2 rounded-full bg-sky-300/85" /> Shared
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="size-2 rounded-full bg-primary" /> GridNinja
          </span>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto pb-1">
        <ol className="grid min-w-[43rem] grid-cols-7 gap-2">
          {whyGridNinjaResponsibilityStages.map((stage, index) => {
            const owner = stageOwner(profile, stage.id)

            return (
              <li
                key={stage.id}
                aria-label={`${stage.fullLabel}: ${owner === "unassigned" ? "Not emphasized" : ownerLabels[owner]}`}
                className={cn(
                  "min-h-20 rounded-[0.8rem] border px-3 py-3",
                  owner === "profile" &&
                    "border-slate-300/25 bg-slate-300/8 text-slate-100",
                  owner === "shared" &&
                    "border-sky-300/35 bg-sky-400/10 text-sky-100",
                  owner === "gridNinja" &&
                    "border-primary/45 bg-primary/12 text-primary",
                  owner === "unassigned" &&
                    "border-border/65 bg-background/25 text-muted-foreground"
                )}
              >
                <span className="block font-mono text-[0.65rem] tracking-[0.1em] opacity-75">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="mt-2 block text-sm font-medium">
                  {stage.shortLabel}
                </span>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}

function getProfileSources(
  profile: WhyGridNinjaCompetitorProfile,
  sourceMap: Map<string, WhyGridNinjaSourceRecord>
) {
  const sourceIds = new Set(
    claimOrder.flatMap((claimKey) => profile.claims[claimKey].sourceIds)
  )

  return [...sourceIds]
    .map((sourceId) => sourceMap.get(sourceId))
    .filter((source): source is WhyGridNinjaSourceRecord => Boolean(source))
}

function stageOwner(
  profile: WhyGridNinjaCompetitorProfile,
  stageId: WhyGridNinjaResponsibilityStageId
): StageOwner {
  if (profile.responsibilityMap.shared.includes(stageId)) {
    return "shared"
  }

  if (profile.responsibilityMap.gridNinja.includes(stageId)) {
    return "gridNinja"
  }

  if (profile.responsibilityMap.profile.includes(stageId)) {
    return "profile"
  }

  return "unassigned"
}

function latestReviewDate(sources: readonly WhyGridNinjaSourceRecord[]) {
  return sources.at(-1)?.retrievalDate ?? "unknown"
}
