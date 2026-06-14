"use client"

import type { CSSProperties, ReactElement } from "react"
import { useMemo, useState } from "react"

import { CheckIcon, CopyIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

type EvidenceDrawerRow = {
  label: string
  value: string
}

export function EvidenceDrawer({
  title,
  description,
  rows,
  proofRoot,
  trigger,
}: {
  title: string
  description: string
  rows: EvidenceDrawerRow[]
  proofRoot?: string
  trigger: ReactElement
}) {
  const [copied, setCopied] = useState(false)
  const snippet = useMemo(
    () =>
      [
        `# ${title}`,
        ...rows.map((row) => `${row.label}: ${row.value}`),
        proofRoot ? `proof_root: ${proofRoot}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    [proofRoot, rows, title]
  )

  function copySnippet() {
    if (!navigator.clipboard) {
      return
    }

    navigator.clipboard.writeText(snippet).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    })
  }

  return (
    <Sheet>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        side="right"
        className="w-[min(92vw,38rem)] border-border/80 bg-surface p-0 sm:max-w-xl"
      >
        <SheetHeader className="border-b border-border/70 px-6 py-5">
          <SheetTitle className="text-[1.55rem]">{title}</SheetTitle>
          <SheetDescription className="max-w-md text-base leading-7">
            {description}
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 overflow-y-auto px-6 py-5">
          <div className="rounded-[1rem] border border-border/70 bg-background/70 p-4 font-mono text-sm">
            {rows.map((row, index) => (
              <div
                key={row.label}
                className="gn-terminal-line border-b border-border/50 py-3 last:border-b-0"
                style={{ "--line-index": index } as CSSProperties}
              >
                <span className="text-muted-foreground">{row.label}: </span>
                <span className="text-foreground">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-auto border-t border-border/70 px-6 py-4">
          {proofRoot ? (
            <p className="font-mono text-sm text-muted-foreground">
              proof_root: <span className="text-foreground">{proofRoot}</span>
            </p>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="mt-4 border-border/80 bg-background/45 text-foreground"
            onClick={copySnippet}
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
            {copied ? "Copied proof snippet" : "Copy proof snippet"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
