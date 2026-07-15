import { describe, expect, it } from "vitest"

import {
  intentAfterConversationSelection,
  resolveContactAttribution,
} from "@/components/forms/contact-attribution"

describe("contact attribution", () => {
  it.each([
    ["capacity-audit", "capacity-audit"],
    ["sellable-capacity", "capacity-audit"],
    ["shadow-mode", "shadow-mode"],
    ["partnership", "partnership"],
    ["book-demo", "other"],
    ["dcii-memo", "other"],
    ["load-passport", "other"],
    ["other", "other"],
  ] as const)("maps %s to the %s card without losing intent", (intent, card) => {
    expect(
      resolveContactAttribution(`?intent=${intent}&source=footer`)
    ).toEqual({ intent, conversationType: card, source: "footer" })
  })

  it("falls back for unknown intent and unapproved source values", () => {
    expect(
      resolveContactAttribution(
        "?intent=unknown&source=private%40example.com"
      )
    ).toEqual({
      intent: "capacity-audit",
      conversationType: "capacity-audit",
      source: "contact-page",
    })
  })

  it("uses an active card selection as the new submission intent", () => {
    expect(intentAfterConversationSelection("other")).toBe("other")
    expect(intentAfterConversationSelection("shadow-mode")).toBe("shadow-mode")
  })
})
