"use client"

import { useMemo, useState } from "react"

import { ArrowRightIcon, ShieldCheckIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"

import { RtaDecisionChip } from "@/components/marketing/rta-decision-chip"
import { rtaDecisionCandidates, type RtaDecisionCandidate } from "@/content/proof-artifacts"
import { runViewTransition } from "@/lib/view-transition"
import { cn } from "@/lib/utils"

const chain = ["Proposal", "Solver", "RTA", "Receipt", "Replay", "Proof"]

export function RtaDecisionTheater({
  candidates = rtaDecisionCandidates,
  compact = false,
  className,
}: {
  candidates?: RtaDecisionCandidate[]
  compact?: boolean
  className?: string
}) {
  const [activeId, setActiveId] = useState(candidates[0]?.id)
  const active = useMemo(
    () =>
      candidates.find((candidate) => candidate.id === activeId) ??
      candidates[0],
    [activeId, candidates]
  )

  function selectCandidate(id: string) {
    runViewTransition(() => setActiveId(id))
  }

  if (!active) {
    return null
  }

  return (
    <section className={cn("gn-hd-panel p-6", className)}>
      <div className="gn-scanline" />
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <p className="gn-eyebrow">Runtime Assurance Theater</p>
          <h3
            className={cn(
              "mt-3 max-w-3xl font-medium text-foreground",
              compact
                ? "text-[1.45rem] leading-tight sm:text-[1.65rem]"
                : "text-[2rem]"
            )}
          >
            Propose an action. Watch GridNinja allow, repair, reject, or
            no-proof it.
          </h3>
          <p className="mt-3 max-w-2xl text-base leading-8 text-muted-foreground">
            The UI can explain a candidate. Authority remains with deterministic
            verification, runtime assurance, receipts, and replayable proof.
          </p>
        </div>
        <RtaDecisionChip state={active.decision} />
      </div>

      <div
        className={cn(
          "mt-7 grid gap-6",
          compact
            ? "grid-cols-1"
            : "xl:grid-cols-[0.82fr_1.18fr]"
        )}
      >
        <div className={cn("grid gap-3", compact && "sm:grid-cols-2")}>
          {candidates.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              aria-pressed={candidate.id === active.id}
              onClick={() => selectCandidate(candidate.id)}
              className={cn(
                "rounded-[1rem] border bg-background/45 p-4 text-left transition-colors",
                "focus-visible:ring-3 focus-visible:ring-ring/45",
                candidate.id === active.id
                  ? "border-primary/65 bg-surface-2"
                  : "border-border/60 hover:border-primary/45"
              )}
            >
              <span className="flex min-w-0 items-start justify-between gap-4">
                <span className="min-w-0 font-medium text-foreground">
                  {candidate.label}
                </span>
                <RtaDecisionChip
                  state={candidate.decision}
                  tooltip={false}
                  focusable={false}
                  className="shrink-0 px-2.5 py-0.5"
                />
              </span>
              <span className="mt-3 block font-mono text-xs text-muted-foreground">
                requested={candidate.requestedMw.toFixed(1)}MW / target=
                {candidate.target}
              </span>
            </button>
          ))}
        </div>

        <div className="rounded-[1.15rem] border border-border/70 bg-background/45 p-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={active.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28 }}
            >
              <div className="rounded-[1rem] border border-border/70 bg-surface p-5">
                <p className="font-mono text-xs tracking-[0.18em] text-primary uppercase">
                  candidate action
                </p>
                <h4
                  className={cn(
                    "mt-3 font-medium text-foreground",
                    compact ? "text-[1.35rem]" : "text-[1.55rem]"
                  )}
                >
                  {active.label}
                </h4>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <ProofMetric label="requested" value={`${active.requestedMw.toFixed(1)} MW`} />
                  <ProofMetric label="duration" value={active.duration} />
                  <ProofMetric label="target" value={active.target} />
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-6">
                {chain.map((stage, index) => (
                  <motion.div
                    key={stage}
                    className={cn(
                      "gn-evidence-line rounded-[0.9rem] border border-border/70 bg-background/50 p-3 text-center",
                      stage === "RTA" && "border-primary/65 bg-primary/10",
                      index > 2 && active.decision === "reject" && "opacity-35",
                      index > 2 &&
                        active.decision === "no-proof" &&
                        "gn-dashed-no-proof opacity-70"
                    )}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.055 }}
                  >
                    <span className="font-mono text-[0.68rem] tracking-[0.14em] text-muted-foreground uppercase">
                      {stage}
                    </span>
                  </motion.div>
                ))}
              </div>

              <div className="mt-5 rounded-[1rem] border border-border/70 bg-surface p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">
                      rta output
                    </p>
                    <p className="mt-2 text-base leading-7 text-foreground">
                      {active.reason}
                    </p>
                  </div>
                  <ShieldCheckIcon className="size-8 text-primary" />
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <ProofMetric
                    label="accepted"
                    value={`${active.acceptedMw.toFixed(1)} MW`}
                    strong={active.acceptedMw > 0}
                  />
                  <ProofMetric label="proof_row" value={active.proofRow} />
                  <ProofMetric label="mode" value="shadow_read_only" />
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-2 font-mono text-xs text-muted-foreground">
                  <span>proposal</span>
                  <ArrowRightIcon className="size-3" />
                  <span>solver</span>
                  <ArrowRightIcon className="size-3" />
                  <span>rta</span>
                  <ArrowRightIcon className="size-3" />
                  <span>proof</span>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}

function ProofMetric({
  label,
  value,
  strong = false,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div className="min-w-0 rounded-[0.85rem] border border-border/70 bg-background/45 px-3 py-3">
      <p className="font-mono text-[0.68rem] tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 break-words font-mono text-sm",
          strong ? "text-signal" : "text-foreground"
        )}
      >
        {value}
      </p>
    </div>
  )
}
