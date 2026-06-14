"use client"

import type { CSSProperties } from "react"
import { useState } from "react"

import {
  artifactFiles,
  type ProofArtifact,
} from "@/content/proof-artifacts"
import { runViewTransition } from "@/lib/view-transition"
import { cn } from "@/lib/utils"

import { EvidenceDrawer } from "@/components/marketing/evidence-drawer"

export function ProofArtifactStack({
  artifacts,
}: {
  artifacts: ProofArtifact[]
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const active = artifacts[activeIndex] ?? artifacts[0]
  const activeEvidence = active
    ? artifactFiles.find((item) => item.artifactTitle === active.title)
    : undefined

  function selectArtifact(index: number) {
    runViewTransition(() => setActiveIndex(index))
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
      <div className="gn-artifact-stack" aria-label="Proof artifact stack">
        {artifacts.map((artifact, index) => {
          const evidence = artifactFiles.find(
            (item) => item.artifactTitle === artifact.title
          )

          return (
            <EvidenceDrawer
              key={artifact.title}
              title={`${artifact.title} evidence`}
              description={
                evidence
                  ? `${evidence.whoCares}. ${evidence.caveat}`
                  : artifact.body
              }
              rows={[
                ...(evidence?.rows ?? []),
                ...(evidence?.sampleFiles ?? []).map((file) => ({
                  label: "sample_file",
                  value: file,
                })),
              ]}
              proofRoot="8f4c...91a"
              trigger={
                <button
                  type="button"
                  aria-pressed={activeIndex === index}
                  onClick={() => selectArtifact(index)}
                  onFocus={() => selectArtifact(index)}
                  onMouseEnter={() => selectArtifact(index)}
                  className={cn(
                    "gn-artifact-card gn-panel gn-panel-interactive w-full px-5 py-5 text-left",
                    "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/45",
                    activeIndex === index && "border-primary/70 bg-surface-2"
                  )}
                  style={{ "--stack-index": index } as CSSProperties}
                >
                  <p className="font-mono text-xs tracking-[0.18em] text-primary uppercase">
                    {artifact.audience}
                  </p>
                  <h3 className="mt-3 text-[1.18rem] font-medium text-foreground">
                    {artifact.title}
                  </h3>
                  <span className="mt-3 block font-mono text-xs text-muted-foreground">
                    Open evidence drawer
                  </span>
                </button>
              }
            />
          )
        })}
      </div>
      {active ? (
        <div className="gn-panel gn-vt-proof-artifact px-6 py-7">
          <p className="gn-eyebrow">Selected artifact</p>
          <h3 className="mt-3 text-[2rem] font-medium text-foreground">
            {active.title}
          </h3>
          <p className="mt-4 text-base leading-8 text-muted-foreground">
            {active.body}
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="gn-proof-row">
              <p className="font-mono text-xs text-muted-foreground">
                Who cares
              </p>
              <p className="text-foreground">{active.audience}</p>
            </div>
            <div className="gn-proof-row">
              <p className="font-mono text-xs text-muted-foreground">
                Status
              </p>
              <p className="text-foreground">sample shape, illustrative</p>
            </div>
            {activeEvidence ? (
              <div className="gn-proof-row sm:col-span-2">
                <p className="font-mono text-xs text-muted-foreground">
                  Caveat
                </p>
                <p className="text-foreground">{activeEvidence.caveat}</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
