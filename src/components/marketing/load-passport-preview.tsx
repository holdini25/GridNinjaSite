"use client"

import { useState } from "react"

import { Clock3Icon, FileTextIcon } from "lucide-react"

import { GridNinjaProofSeal } from "@/components/brand/gridninja-proof-seal"
import { LoadPassportVerificationStatus } from "@/components/marketing/load-passport-verification-status"
import {
  getLoadPassportEvidenceChainStatus,
  loadPassportSections,
  type LoadPassportSection,
} from "@/content/proof-artifacts"
import { cn } from "@/lib/utils"

export function LoadPassportPreview({
  sections = loadPassportSections,
}: {
  sections?: readonly LoadPassportSection[]
}) {
  const [activeTitle, setActiveTitle] = useState(sections[0]?.title)
  const active =
    sections.find((section) => section.title === activeTitle) ?? sections[0]
  const evidenceChainStatus = getLoadPassportEvidenceChainStatus(sections)

  if (!active) {
    return null
  }

  return (
    <div className="gn-panel p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="gn-eyebrow">Load Passport</p>
          <h3 className="mt-3 text-[1.9rem] font-medium text-foreground">
            A capacity identity for one AI data center site
          </h3>
        </div>
        <GridNinjaProofSeal status={evidenceChainStatus} />
      </div>
      <div className="mt-6 grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="grid gap-2">
          {sections.map((section) => (
            <button
              key={section.title}
              type="button"
              aria-pressed={activeTitle === section.title}
              onClick={() => setActiveTitle(section.title)}
              onFocus={() => setActiveTitle(section.title)}
              className={cn(
                "min-h-11 rounded-[0.85rem] border border-border/70 bg-background/35 px-4 py-3 text-left transition-colors",
                "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/45",
                activeTitle === section.title && "border-primary/70 bg-surface-2",
                !section.verified && "gn-dashed-no-proof"
              )}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="font-mono text-sm text-muted-foreground">
                  {section.title}
                </span>
                <LoadPassportVerificationStatus verified={section.verified} />
              </span>
            </button>
          ))}
        </div>
        <div
          className={cn(
            "rounded-[1rem] border border-border/70 bg-background/45 px-5 py-5",
            !active.verified && "gn-dashed-no-proof"
          )}
          data-load-passport-detail-status={
            active.verified ? "verified" : "no-proof"
          }
        >
          <p className="font-mono text-xs tracking-[0.16em] text-primary uppercase">
            Source evidence
          </p>
          <h4 className="mt-3 text-[1.35rem] font-medium text-foreground">
            {active.title}
          </h4>
          <p className="mt-3 text-base leading-8 text-muted-foreground">
            {active.evidence}
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="gn-proof-row">
              <p className="font-mono text-xs text-muted-foreground">
                Telemetry source
              </p>
              <p className="mt-1 min-w-0 break-words text-sm leading-6 text-foreground">
                {active.telemetrySource}
              </p>
            </div>
            <div className="gn-proof-row">
              <p className="font-mono text-xs text-muted-foreground">
                Freshness
              </p>
              <p className="mt-1 inline-flex min-w-0 items-center gap-2 text-sm leading-6 text-foreground">
                <Clock3Icon className="size-4 text-primary" />
                <span className="min-w-0 break-words">{active.freshness}</span>
              </p>
            </div>
            <div className="gn-proof-row">
              <p className="font-mono text-xs text-muted-foreground">
                Proof row
              </p>
              <p className="mt-1 inline-flex min-w-0 items-center gap-2 font-mono text-sm leading-6 text-foreground">
                <LoadPassportVerificationStatus verified={active.verified} />
                <span className="min-w-0 break-all">{active.proofRow}</span>
              </p>
            </div>
          </div>
          <div className="mt-5 h-24 rounded-[0.8rem] border border-border/60 bg-surface-2 p-4">
            <div
              className="flex h-full items-end gap-2"
              role="img"
              aria-label={`${active.title} illustrative trend`}
            >
              {active.chartPoints.map((height, index) => (
                <span
                  key={`${height}-${index}`}
                  className="w-full rounded-t-sm bg-primary/70"
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {active.artifactFiles.map((file) => (
              <div
                key={file}
                className="inline-flex min-w-0 items-center gap-2 rounded-[0.75rem] border border-border/70 bg-surface px-3 py-2 font-mono text-xs text-muted-foreground"
              >
                <FileTextIcon className="size-4 text-primary" />
                <span className="min-w-0 break-all">{file}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
