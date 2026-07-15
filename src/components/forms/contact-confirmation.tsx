"use client"

import { useSyncExternalStore } from "react"

import { contactSubmissionStorageKey } from "@/components/forms/contact-attribution"
import { leadIntents, intentLabels } from "@/lib/constants"
import type { LeadIntent } from "@/types/site"

type StoredConfirmation = {
  submissionId: string
  intent: LeadIntent
}

export function ContactConfirmation() {
  const stored = useSyncExternalStore(
    subscribeToConfirmation,
    readStoredConfirmation,
    readServerConfirmation,
  )
  const confirmation = stored ? parseConfirmation(stored) : null

  return (
    <div className="mt-6 min-h-20 rounded-xl border border-white/10 bg-background/35 px-4 py-4">
      {confirmation ? (
        <>
          <p className="text-sm text-muted-foreground">
            {intentLabels[confirmation.intent]}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Reference:{" "}
            <span className="font-mono text-foreground">
              {confirmation.submissionId}
            </span>
          </p>
        </>
      ) : (
        <p className="text-sm leading-6 text-muted-foreground">
          The request reference is available only in the browser tab that
          submitted the assessment.
        </p>
      )}
    </div>
  )
}

function subscribeToConfirmation() {
  return () => undefined
}

function readStoredConfirmation() {
  try {
    return window.sessionStorage.getItem(contactSubmissionStorageKey)
  } catch {
    return null
  }
}

function readServerConfirmation() {
  return null
}

function parseConfirmation(value: string): StoredConfirmation | null {
  try {
    const parsed = JSON.parse(value) as {
      submissionId?: unknown
      intent?: unknown
    }

    if (
      typeof parsed.submissionId !== "string" ||
      !/^[0-9a-f-]{8,64}$/i.test(parsed.submissionId) ||
      typeof parsed.intent !== "string" ||
      !(leadIntents as readonly string[]).includes(parsed.intent)
    ) {
      return null
    }

    return {
      submissionId: parsed.submissionId,
      intent: parsed.intent as LeadIntent,
    }
  } catch {
    return null
  }
}
