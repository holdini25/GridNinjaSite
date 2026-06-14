export function AutonomyLadder({
  steps,
}: {
  steps: Array<{ title: string; body: string }>
}) {
  const artifacts = [
    "read-only tape",
    "operator review",
    "dispatch envelope",
    "evidence gate",
  ]

  return (
    <div className="gn-deployment-ladder grid gap-4 lg:grid-cols-4">
      {steps.map((step, index) => (
        <div
          key={step.title}
          className="gn-panel relative px-6 py-7"
        >
          <div className="flex items-center gap-4">
            <span className="inline-flex size-10 items-center justify-center rounded-full border border-primary/50 bg-primary font-mono text-base text-primary-foreground">
              0{index + 1}
            </span>
            <div className="h-px flex-1 bg-border/80" />
          </div>
          <h3 className="mt-6 text-[1.35rem] font-medium text-foreground">{step.title}</h3>
          <p className="mt-3 text-base leading-8 text-muted-foreground">
            {step.body}
          </p>
          <p className="mt-5 rounded-full border border-border/70 bg-background/45 px-3 py-1 font-mono text-xs text-muted-foreground">
            unlock: {artifacts[index] ?? "proof artifact"}
          </p>
        </div>
      ))}
    </div>
  )
}
