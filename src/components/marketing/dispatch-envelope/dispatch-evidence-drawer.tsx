"use client"

import { useState } from "react"

import { CopyIcon, TablePropertiesIcon } from "lucide-react"

import {
  buildDispatchEvidenceRecord,
  type DispatchScenario,
} from "@/content/copy/dispatch-envelope"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

export function DispatchEvidenceDrawer({
  artifacts,
  onCopyProofRoot,
  onOpenChange,
  onShowTable,
  open,
  record,
  scenario,
}: {
  artifacts: string[]
  onCopyProofRoot: () => void
  onOpenChange: (open: boolean) => void
  onShowTable: () => void
  open: boolean
  record: ReturnType<typeof buildDispatchEvidenceRecord>
  scenario: DispatchScenario
}) {
  const [copied, setCopied] = useState(false)
  const rows = Object.entries(record)

  async function copyProofRoot() {
    onCopyProofRoot()

    try {
      await navigator.clipboard.writeText(scenario.dto.proofRoot)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  function showTable() {
    onShowTable()
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[min(92vw,40rem)] border-border/80 bg-surface p-0 sm:max-w-xl max-sm:inset-x-0 max-sm:top-auto max-sm:bottom-0 max-sm:h-[88dvh] max-sm:w-full max-sm:max-w-none max-sm:rounded-t-[1.1rem] max-sm:border-t max-sm:border-l-0"
        data-testid="dispatch-evidence-drawer"
      >
        <SheetHeader className="border-b border-border/70 px-6 py-5">
          <p className="gn-eyebrow text-proof-cyan">Evidence drawer</p>
          <SheetTitle className="text-[1.65rem]">
            Dispatch evidence record
          </SheetTitle>
          <SheetDescription className="max-w-md text-base leading-7">
            Read-only illustrative preview for {scenario.label}. The browser
            renders the record; it never grants authority or mints proof.
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 overflow-y-auto px-6 py-5">
          <div className="mb-4 flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 border-proof-cyan/35 bg-proof-cyan/5 text-proof-cyan"
              onClick={copyProofRoot}
              data-testid="dispatch-copy-proof-root"
            >
              <CopyIcon />
              {copied ? "Copied proof root" : "Copy proof root"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 border-border/80 bg-background/45 text-foreground"
              onClick={showTable}
              data-testid="dispatch-drawer-view-table"
            >
              <TablePropertiesIcon />
              View equivalent table
            </Button>
          </div>
          <dl className="divide-y divide-border/60 rounded-[1rem] border border-border/70 bg-background/55 font-mono text-sm">
            {rows.map(([key, value]) => (
              <div
                key={key}
                className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-3 px-4 py-3"
              >
                <dt className="break-words text-muted-foreground">{key}</dt>
                <dd className="break-words text-right text-foreground">
                  {Array.isArray(value)
                    ? value.join(", ")
                    : value == null
                      ? "null"
                      : String(value)}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-5 rounded-[1rem] border border-border/70 bg-background/45 p-4">
            <h3 className="font-mono text-xs tracking-[0.16em] text-primary uppercase">
              Artifact bundle
            </h3>
            <div className="mt-3 grid gap-2">
              {artifacts.map((artifact) => (
                <div
                  key={artifact}
                  className="min-h-11 rounded-[0.75rem] border border-border/60 bg-surface/70 px-3 py-2 text-left font-mono text-xs"
                  data-testid={`dispatch-artifact-${artifact.replace(/[^a-z0-9]/gi, "-")}`}
                >
                  <span className="block break-all text-foreground">{artifact}</span>
                  <span className="mt-1 block text-muted-foreground">Illustrative artifact — unavailable in this demo</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
