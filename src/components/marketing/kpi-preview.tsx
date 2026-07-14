import { KpiLineChart } from "@/components/charts/kpi-line-chart"
import { PublicClaimValue } from "@/components/seo/public-claim"
import type { StatItem } from "@/types/site"

export function KpiPreview({
  cards,
  eventLog,
}: {
  cards: StatItem[]
  eventLog: string[]
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-[1.8rem] border border-border/70 bg-surface px-5 py-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-base text-muted-foreground">KPI preview</p>
            <h3 className="mt-1 text-2xl font-medium text-foreground">
              Runtime-assured operating view
            </h3>
          </div>
          <div className="rounded-full border border-border/80 bg-surface-2 px-3 py-1.5">
            <span className="font-mono text-[0.7rem] tracking-[0.22em] text-primary uppercase">
              RTA Gate
            </span>
          </div>
        </div>
        <div className="mt-6 grid gap-px overflow-hidden rounded-[1.2rem] border border-border/70 bg-border/70 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <div key={card.label} className="bg-surface-2 px-4 py-4">
              <p className="text-sm tracking-[0.18em] text-muted-foreground uppercase">
                {card.label}
              </p>
              <p className="mt-3 font-mono text-[1.9rem] text-foreground">
                {card.value ? (
                  <PublicClaimValue claimId={card.claimId} value={card.value} />
                ) : null}
              </p>
              <p className="mt-3 text-base leading-8 text-muted-foreground">
                {card.body}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-6 rounded-[1.4rem] border border-border/70 bg-background/60 p-3">
          <KpiLineChart />
        </div>
      </div>
      <div className="rounded-[1.8rem] border border-border/70 bg-surface px-5 py-5">
        <p className="text-base text-muted-foreground">Operator event log</p>
        <h3 className="mt-1 text-2xl font-medium text-foreground">
          Action gating in plain language
        </h3>
        <div className="mt-6 space-y-3">
          {eventLog.map((entry) => (
            <div
              key={entry}
              className="rounded-[1.2rem] border border-border/70 bg-surface-2 px-4 py-4"
            >
              <p className="font-mono text-base leading-8 text-foreground">{entry}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
