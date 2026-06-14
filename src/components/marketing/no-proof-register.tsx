"use client"

import { useState } from "react"

import { CheckCircle2Icon, FileSearchIcon } from "lucide-react"

import type { NoProofGap } from "@/content/proof-artifacts"

import { EvidenceDrawer } from "@/components/marketing/evidence-drawer"
import { Button } from "@/components/ui/button"

export function NoProofRegister({ gaps }: { gaps: NoProofGap[] }) {
  const [verified, setVerified] = useState<Set<string>>(() => new Set())
  const recoveredMw = gaps.reduce(
    (total, gap) => total + (verified.has(gap.gap) ? gap.sampleDeltaMw : 0),
    0
  )

  function toggleGap(gap: string) {
    setVerified((current) => {
      const next = new Set(current)

      if (next.has(gap)) {
        next.delete(gap)
      } else {
        next.add(gap)
      }

      return next
    })
  }

  return (
    <div className="gn-panel min-w-0 p-6">
      <p className="gn-eyebrow">No-proof register</p>
      <h3 className="mt-3 text-[1.9rem] font-medium text-foreground">
        Missing evidence becomes visible remediation
      </h3>

      <div className="mt-6 grid gap-3 lg:hidden">
        {gaps.map((gap) => {
          const isVerified = verified.has(gap.gap)

          return (
            <div
              key={gap.gap}
              className="rounded-[1rem] border border-border/70 bg-background/45 px-4 py-4 data-[verified=true]:border-signal/50 data-[verified=true]:bg-signal/5"
              data-verified={isVerified}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">{gap.gap}</p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {gap.severity ?? "Open"} severity
                  </p>
                </div>
                <p className="font-mono text-sm text-warning">
                  {isVerified ? "Verified" : gap.status}
                </p>
              </div>
              <p className="mt-3 font-mono text-sm text-muted-foreground">
                {isVerified
                  ? "discount removed in sample"
                  : (gap.impact ?? "proof blocked")}
              </p>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                {gap.remediation}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <EvidenceDrawer
                  title={`${gap.gap} remediation`}
                  description={`${gap.sourceEvidence} ${gap.sampleVerifiedState}`}
                  rows={[
                    ...gap.evidenceRows,
                    { label: "impact", value: gap.impact ?? "proof blocked" },
                    { label: "sample_delta_mw", value: `+${gap.sampleDeltaMw.toFixed(1)} MW illustrative` },
                  ]}
                  proofRoot={gap.proofRoot}
                  trigger={
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      aria-label={`Inspect ${gap.gap} remediation evidence`}
                      className="border-border/80 bg-background/45 text-foreground"
                    >
                      <FileSearchIcon />
                      Inspect
                    </Button>
                  }
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-border/80 bg-background/45 text-foreground"
                  aria-pressed={isVerified}
                  onClick={() => toggleGap(gap.gap)}
                >
                  {isVerified ? "Undo sample" : "Mark verified"}
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-6 hidden max-w-full overflow-x-auto lg:block">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border/70 text-sm tracking-[0.2em] text-muted-foreground uppercase">
              <th className="py-3 pr-4 font-medium">Gap</th>
              <th className="py-3 pr-4 font-medium">Severity</th>
              <th className="py-3 pr-4 font-medium">Status</th>
              <th className="py-3 pr-4 font-medium">Impact</th>
              <th className="py-3 pr-4 font-medium">Owner</th>
              <th className="py-3 font-medium">Remediation</th>
            </tr>
          </thead>
          <tbody>
            {gaps.map((gap) => {
              const isVerified = verified.has(gap.gap)

              return (
                <tr
                  key={gap.gap}
                  className="border-b border-border/40 transition-colors last:border-b-0 data-[verified=true]:bg-signal/5"
                  data-verified={isVerified}
                >
                  <td className="py-4 pr-4 font-medium text-foreground">
                    {gap.gap}
                  </td>
                  <td className="py-4 pr-4 font-mono text-sm text-muted-foreground">
                    {gap.severity ?? "Open"}
                  </td>
                  <td className="py-4 pr-4 font-mono text-sm">
                    {isVerified ? (
                      <span className="inline-flex items-center gap-1.5 text-signal">
                        <CheckCircle2Icon className="size-4" />
                        Verified
                      </span>
                    ) : (
                      <span className="text-warning">{gap.status}</span>
                    )}
                  </td>
                  <td className="py-4 pr-4 font-mono text-sm text-muted-foreground">
                    {isVerified
                      ? "discount removed in sample"
                      : (gap.impact ?? "proof blocked")}
                  </td>
                  <td className="py-4 pr-4 text-muted-foreground">
                    {gap.owner}
                  </td>
                  <td className="py-4 text-muted-foreground">
                    <div className="flex min-w-0 flex-wrap items-center gap-3">
                      <span className="min-w-[14rem] flex-1 leading-7">
                        {gap.remediation}
                      </span>
                      <EvidenceDrawer
                        title={`${gap.gap} remediation`}
                        description={`${gap.sourceEvidence} ${gap.sampleVerifiedState}`}
                        rows={[
                          ...gap.evidenceRows,
                          {
                            label: "impact",
                            value: gap.impact ?? "proof blocked",
                          },
                          {
                            label: "sample_delta_mw",
                            value: `+${gap.sampleDeltaMw.toFixed(1)} MW illustrative`,
                          },
                        ]}
                        proofRoot={gap.proofRoot}
                        trigger={
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            aria-label={`Inspect ${gap.gap} remediation evidence`}
                            className="shrink-0 border-border/80 bg-background/45 text-foreground"
                          >
                            <FileSearchIcon />
                            Inspect
                          </Button>
                        }
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="shrink-0 border-border/80 bg-background/45 text-foreground"
                        aria-pressed={isVerified}
                        onClick={() => toggleGap(gap.gap)}
                      >
                        {isVerified ? "Undo sample" : "Mark verified"}
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-4 font-mono text-sm text-muted-foreground" aria-live="polite">
        {verified.size} of {gaps.length} gaps marked verified in this illustrative
        register. Sample recovered capacity: +{recoveredMw.toFixed(1)} MW.
      </p>
    </div>
  )
}
