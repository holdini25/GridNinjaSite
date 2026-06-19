"use client"

import type { ReactNode } from "react"
import { useEffect, useMemo, useState } from "react"

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import type {
  WhyGridNinjaComparisonCell,
  WhyGridNinjaComparisonRow,
  WhyGridNinjaSourceRecord,
} from "@/content/copy/why-gridninja"
import {
  getUrlParam,
  notifyWhyGridNinjaContextChange,
  setUrlParam,
} from "@/lib/url-state"
import { cn } from "@/lib/utils"

import { OfficialSourceDrawer } from "@/components/marketing/official-source-drawer"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type ComparatorKey = "dcim" | "digitalTwin" | "aiOps" | "gridFlex"

const comparators: Array<{ key: ComparatorKey; label: string }> = [
  { key: "dcim", label: "DCIM" },
  { key: "digitalTwin", label: "Digital Twin" },
  { key: "aiOps", label: "AI Operations" },
  { key: "gridFlex", label: "Grid Flex / Aggregator" },
]

export function WhyGridNinjaComparisonExplorer({
  rows,
  sources,
}: {
  rows: WhyGridNinjaComparisonRow[]
  sources: WhyGridNinjaSourceRecord[]
}) {
  const [comparator, setComparator] = useState<ComparatorKey>(() =>
    readComparatorParam()
  )
  const [activeCapabilityIndex, setActiveCapabilityIndex] = useState(0)
  const sourceMap = useMemo(
    () => new Map(sources.map((source) => [source.id, source])),
    [sources]
  )
  const selectedComparator =
    comparators.find((item) => item.key === comparator) ?? comparators[0]
  const activeRow = rows[activeCapabilityIndex] ?? rows[0]

  useEffect(() => {
    function handlePopState() {
      setComparator(readComparatorParam())
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  function selectComparator(nextComparator: ComparatorKey) {
    setComparator(nextComparator)
    setUrlParam("comparator", nextComparator, { mode: "push" })
    notifyWhyGridNinjaContextChange()
  }

  function getCell(row: WhyGridNinjaComparisonRow, key: ComparatorKey) {
    return row[key]
  }

  function moveCapability(direction: -1 | 1) {
    setActiveCapabilityIndex(
      (current) => (current + direction + rows.length) % rows.length
    )
  }

  return (
    <div className="space-y-6">
      <div className="hidden overflow-hidden rounded-[1.2rem] border border-border/70 md:block">
        <div className="grid grid-cols-[1.2fr_repeat(5,1fr)] bg-border/70 text-sm">
          <HeaderCell>Capability</HeaderCell>
          <HeaderCell>DCIM</HeaderCell>
          <HeaderCell>Digital Twin</HeaderCell>
          <HeaderCell>AI Operations</HeaderCell>
          <HeaderCell>Grid Flex</HeaderCell>
          <HeaderCell>GridNinja</HeaderCell>
          {rows.map((row) => (
            <RowCells key={row.capability} row={row} sourceMap={sourceMap} />
          ))}
        </div>
      </div>

      <div className="space-y-4 md:hidden">
        <div className="rounded-[1rem] border border-border/70 bg-surface p-4">
          <label
            htmlFor="why-gridninja-mobile-comparator"
            className="font-mono text-xs tracking-[0.16em] text-proof-cyan uppercase"
          >
            Compare GridNinja with
          </label>
          <Select
            value={comparator}
            onValueChange={(value) => selectComparator(value as ComparatorKey)}
          >
            <SelectTrigger
              id="why-gridninja-mobile-comparator"
              className="mt-3 min-h-11 border-border/80 bg-background/45 text-foreground"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {comparators.map((item) => (
                <SelectItem key={item.key} value={item.key}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="sticky top-24 z-10 rounded-[1rem] border border-border/70 bg-background/94 p-3 backdrop-blur-xl">
          <p className="font-mono text-xs tracking-[0.14em] text-muted-foreground uppercase">
            Capability {activeCapabilityIndex + 1} / {rows.length}
          </p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <h3 className="min-w-0 text-lg font-medium text-foreground">
              {activeRow.capability}
            </h3>
            <div className="flex shrink-0 gap-2">
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                className="border-border/80 bg-background/45 text-foreground"
                aria-label="Previous comparison capability"
                onClick={() => moveCapability(-1)}
              >
                <ChevronLeftIcon />
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                className="border-border/80 bg-background/45 text-foreground"
                aria-label="Next comparison capability"
                onClick={() => moveCapability(1)}
              >
                <ChevronRightIcon />
              </Button>
            </div>
          </div>
        </div>

        <div className="rounded-[1rem] border border-border/70 bg-surface p-4">
          <div className="grid gap-3">
            <MobileCell
              label={selectedComparator.label}
              cell={getCell(activeRow, comparator)}
              sourceMap={sourceMap}
            />
            <MobileCell
              label="GridNinja"
              cell={activeRow.gridNinja}
              sourceMap={sourceMap}
              pinned
            />
          </div>
        </div>
      </div>

      <p className="text-sm leading-7 text-muted-foreground">
        Public positioning reviewed as of June 18, 2026. Not central and
        public detail varies do not mean unavailable; they mean the public
        material reviewed here does not make that function the primary evidence
        standard. GridNinja claims are limited to the maturity shown.
      </p>
    </div>
  )
}

function readComparatorParam(): ComparatorKey {
  const comparator = getUrlParam("comparator")
  return comparators.some((item) => item.key === comparator)
    ? (comparator as ComparatorKey)
    : "dcim"
}

function RowCells({
  row,
  sourceMap,
}: {
  row: WhyGridNinjaComparisonRow
  sourceMap: Map<string, WhyGridNinjaSourceRecord>
}) {
  return (
    <>
      <BodyCell className="font-medium text-foreground">{row.capability}</BodyCell>
      <BodyCell>
        <ComparisonCell cell={row.dcim} sourceMap={sourceMap} />
      </BodyCell>
      <BodyCell>
        <ComparisonCell cell={row.digitalTwin} sourceMap={sourceMap} />
      </BodyCell>
      <BodyCell>
        <ComparisonCell cell={row.aiOps} sourceMap={sourceMap} />
      </BodyCell>
      <BodyCell>
        <ComparisonCell cell={row.gridFlex} sourceMap={sourceMap} />
      </BodyCell>
      <BodyCell className="bg-proof-cyan/5">
        <ComparisonCell cell={row.gridNinja} sourceMap={sourceMap} />
      </BodyCell>
    </>
  )
}

function HeaderCell({ children }: { children: ReactNode }) {
  return (
    <div className="bg-surface-2 px-4 py-3 font-mono text-xs tracking-[0.14em] text-muted-foreground uppercase">
      {children}
    </div>
  )
}

function BodyCell({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "min-w-0 bg-surface px-4 py-4 text-sm leading-6 text-muted-foreground",
        className
      )}
    >
      {children}
    </div>
  )
}

function MobileCell({
  label,
  cell,
  sourceMap,
  pinned,
}: {
  label: string
  cell: WhyGridNinjaComparisonCell
  sourceMap: Map<string, WhyGridNinjaSourceRecord>
  pinned?: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-[0.9rem] border border-border/70 bg-background/45 p-4",
        pinned && "border-proof-cyan/35 bg-proof-cyan/5"
      )}
    >
      <p className="font-mono text-xs tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </p>
      <div className="mt-3">
        <ComparisonCell cell={cell} sourceMap={sourceMap} />
      </div>
    </div>
  )
}

function ComparisonCell({
  cell,
  sourceMap,
}: {
  cell: WhyGridNinjaComparisonCell
  sourceMap: Map<string, WhyGridNinjaSourceRecord>
}) {
  const sources = (cell.sourceIds ?? [])
    .map((sourceId) => sourceMap.get(sourceId))
    .filter((source): source is WhyGridNinjaSourceRecord => Boolean(source))
  const primarySource = sources[0]

  return (
    <div className="grid gap-2">
      <span
        className={cn(
          "inline-flex w-fit rounded-full border px-2.5 py-1 font-mono text-xs leading-4 tracking-[0.08em] uppercase",
          cell.tone === "core" &&
            "border-proof-cyan/40 bg-proof-cyan/10 text-proof-cyan",
          cell.tone === "documented" &&
            "border-border/80 bg-background/45 text-muted-foreground",
          cell.tone === "input" && "border-primary/35 bg-primary/10 text-primary",
          cell.tone === "target" &&
            "border-warning/40 bg-warning/10 text-warning",
          cell.tone === "varies" &&
            "border-muted-foreground/40 border-dashed bg-background/35 text-muted-foreground"
        )}
      >
        {cell.label}
      </span>
      {primarySource ? (
        <OfficialSourceDrawer
          source={primarySource}
          trigger={
            <button
              type="button"
              className="min-h-11 w-fit rounded-full border border-proof-cyan/25 px-2.5 py-1 font-mono text-xs tracking-[0.08em] text-proof-cyan uppercase transition-colors hover:bg-proof-cyan/10 focus-visible:ring-3 focus-visible:ring-ring/45"
            >
              {sources.length} source{sources.length === 1 ? "" : "s"}
            </button>
          }
        />
      ) : null}
    </div>
  )
}
