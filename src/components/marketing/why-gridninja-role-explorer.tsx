"use client"

import { useState } from "react"

import { ChevronDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type RoleCard = {
  code: string
  title: string
  body: string
  output: string
  gridNinjaUse: string
}

export function WhyGridNinjaRoleExplorer({
  roles,
}: {
  roles: ReadonlyArray<RoleCard>
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {roles.map((card, index) => (
          <div
            key={card.title}
            className={cn(
              "gn-panel gn-panel-interactive px-5 py-6",
              index >= 3 && !expanded && "hidden md:block"
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-lg border border-border/70 bg-background/45 px-2.5 py-1.5 font-mono text-xs text-proof-cyan">
                {card.code}
              </span>
              <span className="font-mono text-xs text-muted-foreground uppercase">
                Output: {card.output}
              </span>
            </div>
            <h3 className="mt-5 text-xl font-medium text-foreground">
              {card.title}
            </h3>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              {card.body}
            </p>
            <p className="mt-5 border-t border-border/60 pt-4 font-mono text-xs leading-6 text-proof-cyan">
              GridNinja use: {card.gridNinjaUse}
            </p>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-border/80 bg-surface px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-2 focus-visible:ring-3 focus-visible:ring-ring/45 md:hidden"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded ? "Show fewer roles" : "View all acceptance inputs"}
        <ChevronDownIcon
          className={cn("size-4 transition-transform", expanded && "rotate-180")}
        />
      </button>
    </div>
  )
}
