"use client"

import { useEffect } from "react"

import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"

import {
  isAnalyticsEventName,
  trackGridNinjaEvent,
} from "@/lib/analytics"

export function VercelObservability() {
  useAnalyticsClickObserver()

  return (
    <>
      <Analytics
        beforeSend={(event) => ({
          ...event,
          url: stripQueryAndFragment(event.url),
        })}
      />
      <SpeedInsights />
    </>
  )
}

function useAnalyticsClickObserver() {
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target

      if (!(target instanceof Element)) return

      const trackedElement = target.closest<HTMLElement>("[data-analytics-event]")

      if (!trackedElement) return

      const eventName = trackedElement.dataset.analyticsEvent

      if (!eventName || !isAnalyticsEventName(eventName)) return

      trackGridNinjaEvent(eventName, {
        source: trackedElement.dataset.analyticsSource,
        intent: trackedElement.dataset.analyticsIntent,
        artifact: trackedElement.dataset.analyticsArtifact,
        version: trackedElement.dataset.analyticsVersion,
        success: trackedElement.dataset.analyticsSuccess === "true" || undefined,
      })
    }

    document.addEventListener("click", handleClick)

    return () => document.removeEventListener("click", handleClick)
  }, [])
}

function stripQueryAndFragment(value: string) {
  try {
    const url = new URL(value)
    url.search = ""
    url.hash = ""
    return url.toString()
  } catch {
    return value.split(/[?#]/, 1)[0]
  }
}
