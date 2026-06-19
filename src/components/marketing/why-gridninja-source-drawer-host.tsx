"use client"

import { useEffect, useMemo, useState } from "react"

import { CheckIcon, CopyIcon, ExternalLinkIcon } from "lucide-react"

import type { WhyGridNinjaSourceRecord } from "@/content/copy/why-gridninja"
import {
  getUrlParam,
  notifyWhyGridNinjaContextChange,
  setUrlParam,
} from "@/lib/url-state"
import { useMediaQuery } from "@/lib/use-media-query"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

const sourceDrawerEvent = "why-gridninja-source"

export function openWhyGridNinjaSourceDrawer(sourceId: string) {
  if (typeof window === "undefined") {
    return
  }

  window.dispatchEvent(
    new CustomEvent(sourceDrawerEvent, { detail: { sourceId } })
  )
}

export function WhyGridNinjaSourceDrawerHost({
  sources,
}: {
  sources: WhyGridNinjaSourceRecord[]
}) {
  const [sourceId, setSourceId] = useState<string | null>(() => {
    const initialSource = getUrlParam("source")
    return initialSource && sources.some((source) => source.id === initialSource)
      ? initialSource
      : null
  })
  const [copied, setCopied] = useState(false)
  const isMobile = useMediaQuery("(max-width: 767px)")
  const sourceMap = useMemo(
    () => new Map(sources.map((source) => [source.id, source])),
    [sources]
  )
  const source = sourceId ? sourceMap.get(sourceId) : undefined

  useEffect(() => {
    function handleSourceEvent(event: Event) {
      const sourceEvent = event as CustomEvent<{ sourceId?: string }>
      const nextSourceId = sourceEvent.detail?.sourceId
      if (!nextSourceId || !sourceMap.has(nextSourceId)) {
        return
      }

      setSourceId(nextSourceId)
      setUrlParam("source", nextSourceId, { mode: "push" })
      notifyWhyGridNinjaContextChange()
    }

    function handlePopState() {
      const nextSource = getUrlParam("source")
      setSourceId(nextSource && sourceMap.has(nextSource) ? nextSource : null)
      notifyWhyGridNinjaContextChange()
    }

    window.addEventListener(sourceDrawerEvent, handleSourceEvent)
    window.addEventListener("popstate", handlePopState)

    return () => {
      window.removeEventListener(sourceDrawerEvent, handleSourceEvent)
      window.removeEventListener("popstate", handlePopState)
    }
  }, [sourceMap])

  const snippet = useMemo(() => {
    if (!source) {
      return ""
    }

    return [
      `${source.organization}: ${source.title}`,
      `URL: ${source.url}`,
      `retrieved: ${source.retrievalDate}`,
      `establishes: ${source.establishes}`,
      `does_not_establish: ${source.doesNotEstablish}`,
    ].join("\n")
  }, [source])

  function copyCitation() {
    if (!navigator.clipboard || !snippet) {
      return
    }

    navigator.clipboard.writeText(snippet).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    })
  }

  function setOpen(open: boolean) {
    if (!open) {
      setSourceId(null)
      setUrlParam("source", undefined, { mode: "replace" })
      notifyWhyGridNinjaContextChange()
    }
  }

  return (
    <Sheet open={Boolean(source)} onOpenChange={setOpen}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className="max-h-[92vh] w-[min(94vw,40rem)] border-border/80 bg-surface p-0 data-[side=bottom]:w-full data-[side=bottom]:max-w-none data-[side=bottom]:rounded-t-[1.2rem] sm:max-w-xl"
      >
        {source ? (
          <>
            <SheetHeader className="border-b border-border/70 px-6 py-5">
              <p className="font-mono text-xs tracking-[0.16em] text-proof-cyan uppercase">
                Official source
              </p>
              <SheetTitle className="text-[1.55rem]">{source.title}</SheetTitle>
              <SheetDescription className="max-w-md text-base leading-7">
                {source.organization} / {source.sourceType} / retrieved{" "}
                {source.retrievalDate}
              </SheetDescription>
            </SheetHeader>

            <div className="min-h-0 overflow-y-auto px-6 py-5">
              <div className="space-y-4">
                <SourceBlock label="Official claim" value={source.officialClaim} />
                <SourceBlock
                  label="What this establishes"
                  value={source.establishes}
                />
                <SourceBlock
                  label="What this does not establish"
                  value={source.doesNotEstablish}
                />
                <SourceBlock
                  label="GridNinja interpretation"
                  value={source.gridNinjaInterpretation}
                />
                <div className="rounded-[1rem] border border-border/70 bg-background/45 p-4">
                  <p className="font-mono text-xs tracking-[0.16em] text-muted-foreground uppercase">
                    Comparison confidence
                  </p>
                  <p className="mt-2 text-base text-foreground">
                    {source.confidence}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-auto grid gap-3 border-t border-border/70 px-6 py-4 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                className="border-border/80 bg-background/45 text-foreground"
                onClick={copyCitation}
              >
                {copied ? <CheckIcon /> : <CopyIcon />}
                {copied ? "Copied citation" : "Copy citation"}
              </Button>
              <Button asChild>
                <a href={source.url} target="_blank" rel="noreferrer">
                  Open source
                  <ExternalLinkIcon />
                </a>
              </Button>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function SourceBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] border border-border/70 bg-background/45 p-4">
      <p className="font-mono text-xs tracking-[0.16em] text-proof-cyan uppercase">
        {label}
      </p>
      <p className="mt-2 text-base leading-7 text-muted-foreground">{value}</p>
    </div>
  )
}
