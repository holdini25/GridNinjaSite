"use client"

import type {
  DemoMode,
  DemoModeOverlayFixture,
} from "@/content/proof-artifacts"

export function DemoModeOverlay({
  activeMode,
  overlays,
}: {
  activeMode: DemoMode
  overlays: DemoModeOverlayFixture[]
}) {
  const active =
    overlays.find((overlay) => overlay.mode === activeMode) ?? overlays[0]

  if (!active) {
    return null
  }

  return (
    <div className="gn-v2-mode-overlay mt-5 rounded-[1rem] border border-border/70 bg-background/45 p-4">
      <p className="font-mono text-xs tracking-[0.16em] text-primary uppercase">
        {active.focusLabel}
      </p>
      <h3 className="mt-3 text-[1.35rem] font-medium text-foreground">
        {active.title}
      </h3>
      <p className="mt-3 text-base leading-8 text-muted-foreground">
        {active.body}
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {active.rows.map((row) => (
          <div key={row.label} className="gn-proof-row">
            <p className="font-mono text-xs text-muted-foreground">
              {row.label}
            </p>
            <p className="font-mono text-sm text-foreground">{row.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
