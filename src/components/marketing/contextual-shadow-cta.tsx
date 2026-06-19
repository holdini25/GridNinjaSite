"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"

import { ArrowRightIcon, XIcon } from "lucide-react"

import { buildLeadHref } from "@/lib/lead"
import {
  getWhyGridNinjaContextParams,
  notifyWhyGridNinjaContextChange,
} from "@/lib/url-state"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"

const reviewedProofsKey = "why-gridninja-reviewed-proofs"

export function noteWhyGridNinjaProofReviewed(proofId: string) {
  if (typeof window === "undefined") {
    return
  }

  const existing = new Set(
    window.sessionStorage.getItem(reviewedProofsKey)?.split(",").filter(Boolean)
  )
  existing.add(proofId)
  window.sessionStorage.setItem(reviewedProofsKey, Array.from(existing).join(","))
  notifyWhyGridNinjaContextChange()
}

export function ContextualShadowCTA() {
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [context, setContext] = useState<Record<string, string>>({})
  const [reviewedProofCount, setReviewedProofCount] = useState(0)

  useEffect(() => {
    function refreshContext() {
      setContext(getWhyGridNinjaContextParams())
      setReviewedProofCount(
        window.sessionStorage
          .getItem(reviewedProofsKey)
          ?.split(",")
          .filter(Boolean).length ?? 0
      )
    }

    function handleScroll() {
      const proofStandard = document.getElementById("proof-standard")
      if (!proofStandard) {
        return
      }

      setVisible(window.scrollY > proofStandard.offsetTop + 280)
    }

    refreshContext()
    handleScroll()
    window.addEventListener("scroll", handleScroll, { passive: true })
    window.addEventListener("popstate", refreshContext)
    window.addEventListener("why-gridninja-context", refreshContext)

    return () => {
      window.removeEventListener("scroll", handleScroll)
      window.removeEventListener("popstate", refreshContext)
      window.removeEventListener("why-gridninja-context", refreshContext)
    }
  }, [])

  const label = useMemo(() => {
    if (context.source) {
      return `Source reviewed: ${context.source}`
    }

    if (context.persona) {
      return `Proof path: ${context.persona}`
    }

    if (context.scenario) {
      return `Scenario: ${context.scenario}`
    }

    if (reviewedProofCount > 0) {
      return `${reviewedProofCount} proof item${
        reviewedProofCount === 1 ? "" : "s"
      } reviewed`
    }

    return "Turn this diligence path into a read-only Capacity Audit"
  }, [context.persona, context.scenario, context.source, reviewedProofCount])

  const href = buildLeadHref("capacity-audit", "why-gridninja-contextual", {
    ...context,
    reviewed_proofs: reviewedProofCount ? String(reviewedProofCount) : undefined,
  })

  return (
    <div
      className={cn(
        "fixed inset-x-3 bottom-3 z-40 mx-auto max-w-4xl transition-all duration-200 sm:bottom-5",
        visible && !dismissed
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-6 opacity-0"
      )}
      aria-live="polite"
    >
      <div className="flex flex-col gap-3 rounded-[1.1rem] border border-primary/35 bg-background/94 p-3 shadow-[0_18px_80px_-42px_rgba(255,159,26,0.8)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-xs tracking-[0.16em] text-primary uppercase">
            Shadow comparison
          </p>
          <p className="mt-1 truncate text-sm text-muted-foreground sm:text-base">
            {label}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm">
            <Link href={href}>
              Request Capacity Audit
              <ArrowRightIcon />
            </Link>
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="text-muted-foreground"
            aria-label="Dismiss contextual Capacity Audit prompt"
            onClick={() => setDismissed(true)}
          >
            <XIcon />
          </Button>
        </div>
      </div>
    </div>
  )
}
