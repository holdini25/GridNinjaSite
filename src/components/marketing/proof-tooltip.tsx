"use client"

import type { ReactElement } from "react"

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function ProofTooltip({
  label,
  children,
}: {
  label: string
  children: ReactElement
}) {
  return (
    <TooltipProvider delayDuration={260}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent
          sideOffset={8}
          className="border border-border/80 bg-surface px-3 py-2 font-mono text-xs leading-5 text-foreground shadow-[0_24px_70px_-42px_rgba(7,17,26,0.92)]"
        >
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
