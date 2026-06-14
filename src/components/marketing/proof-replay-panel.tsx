"use client"

import type { CSSProperties } from "react"
import { useState } from "react"

import { CheckCircle2Icon, RotateCcwIcon } from "lucide-react"

import {
  evidenceDrawerRows,
  type ReplayFixture,
} from "@/content/proof-artifacts"

import { EvidenceDrawer } from "@/components/marketing/evidence-drawer"
import { Button } from "@/components/ui/button"

export function ProofReplayPanel({ replay }: { replay: ReplayFixture }) {
  const [completedRuns, setCompletedRuns] = useState(0)
  const totalRuns = replay.replayRuns.length

  function advanceReplay() {
    setCompletedRuns((value) => (value >= totalRuns ? 0 : value + 1))
  }

  const buttonLabel =
    completedRuns === 0
      ? "Replay run 1"
      : completedRuns < totalRuns
        ? "Replay run 2"
        : "Reset replay"

  return (
    <div className="gn-panel px-6 py-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="gn-eyebrow">Same tape, same proof root</p>
          <h3 className="mt-3 text-[2rem] font-medium text-foreground">
            Replay should return the same evidence root
          </h3>
        </div>
        <Button
          type="button"
          variant="outline"
          className="border-border/80 bg-background/45 text-foreground"
          onClick={advanceReplay}
        >
          <RotateCcwIcon />
          {buttonLabel}
        </Button>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <div className="gn-proof-row">
          <p className="font-mono text-xs text-muted-foreground">Tape</p>
          <p className="font-mono text-sm text-foreground">{replay.tape}</p>
        </div>
        <div className="gn-proof-row">
          <p className="font-mono text-xs text-muted-foreground">Topology</p>
          <p className="font-mono text-sm text-foreground">{replay.topology}</p>
        </div>
        <div className="gn-proof-row">
          <p className="font-mono text-xs text-muted-foreground">Policy</p>
          <p className="font-mono text-sm text-foreground">{replay.policy}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {replay.replayRuns.map((run, runIndex) => {
          const isComplete = completedRuns > runIndex

          return (
            <div
              key={run.run}
              className="rounded-[1rem] border border-border/70 bg-background/70 p-4 data-[complete=true]:border-signal/40 data-[complete=true]:bg-signal/5"
              data-complete={isComplete}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-xs tracking-[0.16em] text-primary uppercase">
                    {run.run}
                  </p>
                  <p className="mt-1 font-mono text-sm text-muted-foreground">
                    {run.timecode}
                  </p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-surface px-3 py-1 font-mono text-xs text-muted-foreground">
                  {isComplete ? (
                    <CheckCircle2Icon className="size-4 text-signal" />
                  ) : null}
                  {isComplete ? run.status : "pending replay"}
                </span>
              </div>
              <div className="mt-4 font-mono text-sm">
                {run.rows.map((row, index) => (
                  <div
                    key={row.label}
                    className="gn-terminal-line border-b border-border/50 py-3 last:border-b-0"
                    style={{ "--line-index": index } as CSSProperties}
                  >
                    <span className="text-muted-foreground">
                      {row.label}:{" "}
                    </span>
                    <span className="text-foreground">
                      {isComplete ? row.value : "pending"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-l border-primary/70 pl-4">
        <p className="font-mono text-sm leading-7 text-foreground">
          same tape + same topology + same policy = proof_root{" "}
          <span className="text-signal">{replay.proofRoot}</span>
          {completedRuns >= totalRuns ? " in both runs" : ""}
        </p>
        <EvidenceDrawer
          title="Replay proof root"
          description="The local sample shows the same tape, topology, and policy resolving to the same proof root."
          rows={evidenceDrawerRows.replayRoot}
          proofRoot={replay.proofRoot}
          trigger={
            <Button
              type="button"
              variant="outline"
              className="border-border/80 bg-background/45 text-foreground"
            >
              Inspect replay root
            </Button>
          }
        />
      </div>
    </div>
  )
}
