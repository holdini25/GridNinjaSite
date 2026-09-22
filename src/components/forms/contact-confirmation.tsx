"use client"

import { useSyncExternalStore } from "react"

import { contactSubmissionStorageKey } from "@/components/forms/contact-attribution"
import { parseStoredReceipt, readContactStorage } from "@/components/forms/contact-receipt"
import { intentLabels } from "@/lib/constants"

export function ContactConfirmation() {
  const stored = useSyncExternalStore(subscribeToConfirmation, readStoredConfirmation, () => null)
  const confirmation = parseStoredReceipt(stored)

  return (
    <div className="mt-6 min-h-20 rounded-xl border border-white/10 bg-background/35 px-4 py-4">
      {confirmation ? (
        <>
          <h2 className="text-xl font-medium">Inquiry received</h2>
          <p className="mt-3 text-sm text-muted-foreground">{intentLabels[confirmation.intent]}</p>
          <p className="mt-2 break-all text-sm text-muted-foreground">
            Reference: <span className="font-mono text-foreground">{confirmation.submissionId}</span>
          </p>
          <p className="mt-3 leading-7 text-muted-foreground">This saved receipt confirms intake for review. It does not confirm email delivery, engagement fit, a paid assessment, or operational authority.</p>
        </>
      ) : (
        <p className="text-base leading-7 text-muted-foreground">
          No current receipt is available in this tab. Opening this page does not submit an inquiry. A receipt may be unavailable because this is a different tab, storage is blocked, or its 24-hour recovery period has expired; absence does not prove nonreceipt.
        </p>
      )}
    </div>
  )
}

function subscribeToConfirmation(onChange: () => void) {
  const receipt = parseStoredReceipt(readStoredConfirmation())
  const timer = receipt ? window.setTimeout(onChange, Math.max(1, receipt.expiresAt - Date.now())) : null
  window.addEventListener("storage", onChange)
  return () => {
    if (timer !== null) window.clearTimeout(timer)
    window.removeEventListener("storage", onChange)
  }
}

function readStoredConfirmation() {
  const stored = readContactStorage(contactSubmissionStorageKey)
  return parseStoredReceipt(stored) ? stored : null
}
