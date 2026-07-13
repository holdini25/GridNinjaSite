import type { CSSProperties } from "react"

import type { WaterfallStep } from "@/content/proof-artifacts"

import { GridNinjaProofSeal } from "@/components/brand/gridninja-proof-seal"
import { ProofTooltip } from "@/components/marketing/proof-tooltip"
import { RtaDecisionChip } from "@/components/marketing/rta-decision-chip"

type CapacityWaterfallProps = {
  steps: WaterfallStep[]
  compact?: boolean
}

export function CapacityWaterfall({
  steps,
  compact = false,
}: CapacityWaterfallProps) {
  const maxValue = Math.max(
    1,
    ...steps.map((step) => Math.abs(step.capacityAfter ?? step.value))
  )
  const finalStep =
    steps.findLast((step) => step.tone === "proof") ?? steps.at(-1)

  return (
    <div
      className="gn-waterfall gn-panel p-5"
      aria-label="Illustrative capacity waterfall from nominal headroom to proof-adjusted safe capacity"
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="gn-eyebrow">Capacity Waterfall</p>
          <h3 className="mt-2 text-[1.65rem] font-medium text-foreground">
            Nominal headroom reduced to proof-adjusted capacity
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {finalStep?.evidenceChainStatus ? (
            <GridNinjaProofSeal status={finalStep.evidenceChainStatus} />
          ) : null}
          {finalStep?.decision ? (
            <RtaDecisionChip state={finalStep.decision} />
          ) : null}
          <p className="rounded-full border border-border/70 bg-surface-2 px-3 py-1 font-mono text-sm text-muted-foreground">
            illustrative
          </p>
        </div>
      </div>

      {finalStep ? (
        <div className="mb-5 rounded-[1rem] border border-border/70 bg-background/45 px-4 py-4">
          <p className="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">
            accepted headroom
          </p>
          <p className="mt-2 font-mono text-[2.3rem] leading-none text-signal">
            {(finalStep.capacityAfter ?? finalStep.value).toFixed(1)} MW
          </p>
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            proof_root: 8f4c...91a
          </p>
        </div>
      ) : null}

      <div className="space-y-3" role="list">
        {steps.map((step) => {
          const barValue = Math.abs(step.capacityAfter ?? step.value)
          const width = `${Math.max((barValue / maxValue) * 100, 12)}%`
          const isProof = step.tone === "proof"
          const isClaim = step.tone === "claim"

          return (
            <div
              key={step.label}
              className="gn-waterfall-step grid gap-3 rounded-[1rem] border border-border/50 bg-background/35 p-4 md:grid-cols-[minmax(0,0.9fr)_minmax(180px,1fr)] md:items-center"
              role="listitem"
            >
              <div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <p className="font-medium text-foreground">{step.label}</p>
                  {step.decision ? (
                    <RtaDecisionChip
                      state={step.decision}
                      className="px-2.5 py-0.5"
                      focusable={false}
                    />
                  ) : null}
                  <p
                    className={`font-mono text-lg ${
                      isProof
                        ? "text-signal"
                        : isClaim
                          ? "text-foreground"
                          : "text-warning"
                    }`}
                  >
                    {step.value > 0 && !isClaim ? "+" : ""}
                    {step.value.toFixed(1)} MW
                  </p>
                </div>
                {!compact ? (
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {step.detail}
                  </p>
                ) : null}
                {step.proofHint ? (
                  <ProofTooltip label={step.proofHint}>
                    <span className="mt-2 inline-flex cursor-help rounded-full border border-border/70 bg-surface-2 px-2.5 py-1 font-mono text-xs text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/45">
                      inspect proof hint
                    </span>
                  </ProofTooltip>
                ) : null}
              </div>
              <div>
                {typeof step.capacityAfter === "number" ? (
                  <p className="mb-2 font-mono text-xs tracking-[0.14em] text-muted-foreground uppercase">
                    capacity after:{" "}
                    <span className="text-foreground">
                      {step.capacityAfter.toFixed(1)} MW
                    </span>
                  </p>
                ) : null}
                <div className="gn-meter-track">
                  <div
                    className={`gn-meter-fill ${
                      isProof
                        ? "bg-signal"
                        : isClaim
                          ? "bg-foreground/75"
                          : "bg-warning"
                    }`}
                    style={{ "--meter-width": width } as CSSProperties}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
