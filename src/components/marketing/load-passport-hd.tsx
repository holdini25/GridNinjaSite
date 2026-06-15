"use client"

import { useMemo, useState } from "react"

import {
  CheckCircle2Icon,
  FileArchiveIcon,
  FileTextIcon,
  ShieldCheckIcon,
} from "lucide-react"
import { AnimatePresence, motion } from "motion/react"

import { loadPassportSections } from "@/content/proof-artifacts"
import { runViewTransition } from "@/lib/view-transition"
import { cn } from "@/lib/utils"

export function LoadPassportHD({ className }: { className?: string }) {
  const [activeTitle, setActiveTitle] = useState(loadPassportSections[0]?.title)
  const active = useMemo(
    () =>
      loadPassportSections.find((section) => section.title === activeTitle) ??
      loadPassportSections[0],
    [activeTitle]
  )

  function selectSection(title: string) {
    runViewTransition(() => setActiveTitle(title))
  }

  if (!active) {
    return null
  }

  return (
    <section className={cn("gn-hd-panel p-6", className)}>
      <div className="gn-scanline" />
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="gn-eyebrow">AI Data Center Load Passport</p>
          <h3 className="mt-3 max-w-3xl text-[2.15rem] font-medium text-foreground">
            A capacity identity operators, utilities, partners, and reviewers
            can inspect.
          </h3>
          <p className="mt-3 max-w-2xl text-base leading-8 text-muted-foreground">
            The Load Passport binds proof-adjusted capacity, ramp limits, reserve
            floors, telemetry trust, no-proof gaps, and accepted-headroom
            evidence into one inspectable record.
          </p>
        </div>
        <div className="gn-proof-lock inline-flex items-center gap-2 rounded-full border border-signal/45 bg-signal/10 px-4 py-2 font-mono text-sm text-signal">
          <ShieldCheckIcon className="size-4" />
          sample chain verified
        </div>
      </div>

      <div className="mt-7 grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        <div className="grid gap-2">
          {loadPassportSections.map((section) => (
            <button
              key={section.title}
              type="button"
              aria-pressed={section.title === active.title}
              onClick={() => selectSection(section.title)}
              onFocus={() => selectSection(section.title)}
              className={cn(
                "rounded-[0.95rem] border bg-background/45 px-4 py-3 text-left transition-colors",
                "focus-visible:ring-3 focus-visible:ring-ring/45",
                section.title === active.title
                  ? "border-primary/65 bg-surface-2"
                  : "border-border/60 hover:border-primary/45",
                !section.verified && "gn-dashed-no-proof"
              )}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="font-mono text-sm text-foreground">
                  {section.title}
                </span>
                {section.verified ? (
                  <CheckCircle2Icon className="size-4 text-signal" />
                ) : (
                  <span className="font-mono text-[0.65rem] text-muted-foreground">
                    NO-PROOF
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={active.title}
            className="rounded-[1.15rem] border border-border/70 bg-background/50 p-5"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <p className="font-mono text-xs tracking-[0.18em] text-primary uppercase">
              selected passport section
            </p>
            <h4 className="mt-3 text-[1.65rem] font-medium text-foreground">
              {active.title}
            </h4>
            <p className="mt-3 text-base leading-8 text-muted-foreground">
              {active.evidence}
            </p>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <PassportMetric label="telemetry" value={active.telemetrySource} />
              <PassportMetric label="freshness" value={active.freshness} />
              <PassportMetric label="proof_row" value={active.proofRow} />
            </div>

            <div className="mt-5 rounded-[0.9rem] border border-border/60 bg-surface p-4">
              <p className="font-mono text-xs tracking-[0.16em] text-muted-foreground uppercase">
                envelope trend
              </p>
              <div
                className="mt-4 flex h-28 items-end gap-2"
                aria-label={`${active.title} illustrative trend`}
                role="img"
              >
                {active.chartPoints.map((height, index) => (
                  <motion.span
                    key={`${height}-${index}`}
                    className="w-full rounded-t-sm bg-primary/70"
                    initial={{ height: "8%" }}
                    animate={{ height: `${height}%` }}
                    transition={{ delay: index * 0.025, duration: 0.34 }}
                  />
                ))}
              </div>
            </div>

            <div className="mt-5 rounded-[0.9rem] border border-border/60 bg-surface p-4">
              <div className="flex items-center gap-2">
                <FileArchiveIcon className="size-5 text-primary" />
                <p className="font-mono text-xs tracking-[0.16em] text-primary uppercase">
                  proof pack export
                </p>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {active.artifactFiles.map((file, index) => (
                  <motion.div
                    key={file}
                    className="inline-flex min-w-0 items-center gap-2 rounded-[0.75rem] border border-border/70 bg-background/50 px-3 py-2 font-mono text-xs text-muted-foreground"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.045 }}
                  >
                    <FileTextIcon className="size-4 shrink-0 text-primary" />
                    <span className="min-w-0 break-all">{file}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  )
}

function PassportMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[0.85rem] border border-border/60 bg-surface px-3 py-3">
      <p className="font-mono text-[0.68rem] tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 break-words font-mono text-sm text-foreground">
        {value}
      </p>
    </div>
  )
}
