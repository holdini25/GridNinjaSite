import { describe, expect, it } from "vitest"
import { assessmentScopeHref, decisionPageJourney, sampleBriefHref } from "@/lib/marketing-journeys"
import { isLeadSource } from "@/lib/lead"
import { resolveAssessmentSelection } from "@/lib/assessment/selectors"

describe("marketing journeys", () => {
  it("takes a scoping action to the form with editable public context", () => {
    const url = new URL(assessmentScopeHref("ai-cloud-page", "ai-cloud"), "https://gridninja.ai")
    expect(url.pathname).toBe("/assessment")
    expect(url.hash).toBe("#scope")
    expect([...url.searchParams]).toEqual([["source", "ai-cloud-page"], ["topic", "ai-cloud"]])
    expect(assessmentScopeHref("header")).toBe("/assessment?source=header#scope")
    expect(assessmentScopeHref()).toBe("/assessment#scope")
  })

  it("preserves the exact default assessment identity when passing a topic", () => {
    const plain = new URL(sampleBriefHref(), "https://gridninja.ai")
    const contextual = new URL(sampleBriefHref("colocation"), "https://gridninja.ai")
    expect(resolveAssessmentSelection(contextual.searchParams)).toEqual(resolveAssessmentSelection(plain.searchParams))
    expect(contextual.searchParams.get("topic")).toBe("colocation")
    expect(contextual.hash).toBe("#decision-brief")
  })

  it("uses approved attribution sources for every shared decision page", () => {
    expect(Object.values(decisionPageJourney).every(journey => journey?.source && isLeadSource(journey.source))).toBe(true)
    expect(decisionPageJourney["/solutions/ai-cloud"]?.topic).toBe("ai-cloud")
    expect(decisionPageJourney["/solutions/colocation"]?.topic).toBe("colocation")
  })
})
