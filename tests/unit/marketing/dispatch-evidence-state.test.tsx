import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { useDispatchEnvelopeState } from "@/components/marketing/dispatch-envelope/use-dispatch-envelope-state"

afterEach(cleanup)

describe("dispatch evidence drawer state", () => {
  it("opens atomically, suppresses duplicate events, and restores the exact trigger", () => {
    const evidenceEvents: CustomEvent[] = []
    const listener = (event: Event) => {
      const dispatchEvent = event as CustomEvent<{ name?: string }>

      if (dispatchEvent.detail?.name === "dispatch_evidence_drawer_open") {
        evidenceEvents.push(dispatchEvent)
      }
    }
    const firstTrigger = document.createElement("button")
    const secondTrigger = document.createElement("button")

    document.body.append(firstTrigger, secondTrigger)
    window.addEventListener("gridninja:dispatch-envelope", listener)

    try {
      const { result } = renderHook(() => useDispatchEnvelopeState({}))

      act(() => result.current.openEvidence(firstTrigger))
      expect(result.current.proofOpen).toBe(true)
      expect(evidenceEvents).toHaveLength(1)

      act(() => result.current.openEvidence(secondTrigger))
      expect(result.current.proofOpen).toBe(true)
      expect(evidenceEvents).toHaveLength(1)

      act(() => result.current.setEvidenceOpen(false))
      expect(result.current.proofOpen).toBe(false)
      act(() => result.current.restoreEvidenceTrigger())
      expect(firstTrigger).toHaveFocus()

      act(() => result.current.openEvidence(secondTrigger))
      expect(result.current.proofOpen).toBe(true)
      expect(evidenceEvents).toHaveLength(2)
      act(() => result.current.setEvidenceOpen(false))
      act(() => result.current.restoreEvidenceTrigger())
      expect(secondTrigger).toHaveFocus()

      firstTrigger.focus()
      act(() => result.current.restoreEvidenceTrigger())
      expect(firstTrigger).toHaveFocus()
    } finally {
      window.removeEventListener("gridninja:dispatch-envelope", listener)
      firstTrigger.remove()
      secondTrigger.remove()
    }
  })
})
