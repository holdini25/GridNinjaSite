import type { CSSProperties } from "react"

import {
  instrumentEvents,
  type InstrumentEvent,
} from "@/content/proof-artifacts"

export function ProofLoadingSteps({
  steps,
  events = instrumentEvents,
}: {
  steps: string[]
  events?: InstrumentEvent[]
}) {
  return (
    <div className="gn-panel px-5 py-5">
      <p className="gn-eyebrow">Deterministic progress</p>
      <div className="mt-4 grid gap-3">
        {steps.map((step, index) => (
          <p
            key={step}
            className="gn-loading-step font-mono text-sm text-muted-foreground"
            style={{ "--line-index": index } as CSSProperties}
          >
            {step}
          </p>
        ))}
      </div>
      <div className="mt-5 grid gap-2">
        {events.map((event, index) => (
          <div
            key={`${event.timecode}-${event.label}`}
            className="gn-instrument-event rounded-[0.85rem] border border-border/70 bg-background/45 px-3 py-3"
            data-state={event.state}
            style={{ "--line-index": index } as CSSProperties}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-xs text-muted-foreground">
                {event.timecode}
              </p>
              <div className="flex shrink-0 items-center gap-2">
                <p className="font-mono text-xs tracking-[0.16em] text-primary uppercase">
                  {event.state}
                </p>
                <span
                  aria-hidden="true"
                  className="gn-instrument-event-status size-2 shrink-0 rounded-full"
                />
              </div>
            </div>
            <p className="mt-2 text-sm font-medium text-foreground">
              {event.label}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {event.detail}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
