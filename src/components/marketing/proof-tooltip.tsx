import { cloneElement, type ReactElement } from "react"

export function ProofTooltip({
  label,
  children,
}: {
  label: string
  children: ReactElement
}) {
  const child = cloneElement(children, {
    title: label,
  } as Partial<unknown>)

  return (
    <span className="group/proof-tooltip relative inline-flex">
      {child}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden w-max max-w-xs -translate-x-1/2 rounded-md border border-border/80 bg-surface px-3 py-2 font-mono text-xs leading-5 text-foreground shadow-[0_24px_70px_-42px_rgba(7,17,26,0.92)] group-hover/proof-tooltip:block group-focus-within/proof-tooltip:block"
      >
        {label}
      </span>
    </span>
  )
}
