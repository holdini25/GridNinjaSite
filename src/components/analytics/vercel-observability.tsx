"use client"

import { useEffect } from "react"

import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"

import {
  isAnalyticsEventName,
  trackGridNinjaEvent,
  normalizeAnalyticsRoute,
  sanitizeTelemetryUrl,
} from "@/lib/analytics"

export function VercelObservability() {
  useAnalyticsClickObserver()

  return (
    <>
      <Analytics
        beforeSend={(event) => ({
          ...event,
          url: sanitizeTelemetryUrl(event.url),
        })}
      />
      <SpeedInsights beforeSend={(event) => ({
        ...event, url: sanitizeTelemetryUrl(event.url),
        ...(event.route ? { route: normalizeAnalyticsRoute(event.route) } : {}),
      })} />
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
        scenario: trackedElement.dataset.analyticsScenario,
        perspective: trackedElement.dataset.analyticsPerspective,
        maturity: trackedElement.dataset.analyticsMaturity,
        success: trackedElement.dataset.analyticsSuccess === "true" || undefined,
      })
    }

    document.addEventListener("click", handleClick)

    return () => document.removeEventListener("click", handleClick)
  }, [])
}
