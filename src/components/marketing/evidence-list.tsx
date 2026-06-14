import { cn } from "@/lib/utils"

export function EvidenceList({
  rows,
  className,
}: {
  rows: Array<{ label: string; value: string }>
  className?: string
}) {
  return (
    <div className={cn("grid gap-2", className)}>
      {rows.map((row) => (
        <div key={row.label} className="gn-proof-row">
          <p className="font-mono text-xs tracking-[0.16em] text-muted-foreground uppercase">
            {row.label}
          </p>
          <p className="text-base leading-7 text-foreground">{row.value}</p>
        </div>
      ))}
    </div>
  )
}
