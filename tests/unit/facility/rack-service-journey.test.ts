import { expect, it } from "vitest"
import { commitRackJourney, INITIAL_RACK_JOURNEY, nextRackServiceAction } from "@/lib/facility/rack-service-journey"
import type { FacilityView } from "@/types/facility"
const view = (door: "open" | "closed", tray: "extended" | "retracted", detail = false): FacilityView => ({ kind: "specimen", specimen: "rack", pose: tray === "extended" ? "service" : "closed", rack: { door, tray, cutaway: detail }, ...(detail ? { detail: "service-connection" } : {}) })
it("remembers only completed detail in an extension cycle and guides closure after retraction", () => {
  let journey = INITIAL_RACK_JOURNEY
  const action = (next: FacilityView) => { journey = commitRackJourney(journey, next); return nextRackServiceAction(next, journey) }
  expect(action(view("closed", "retracted"))).toBe("open")
  expect(action(view("open", "retracted"))).toBe("extend")
  expect(action(view("open", "extended"))).toBe("inspect")
  expect(action(view("open", "extended", true))).toBe("return")
  expect(action(view("open", "extended"))).toBe("retract")
  expect(action(view("open", "retracted"))).toBe("close")
  expect(journey.detailSeen).toBe(false)
  expect(action(view("open", "extended"))).toBe("inspect")
  expect(action({ kind: "overview" })).toBe("open")
  expect(journey).toEqual(INITIAL_RACK_JOURNEY)
})
it("does not require inspecting the connection before retraction or closure", () => {
  const extended = commitRackJourney(INITIAL_RACK_JOURNEY, view("open", "extended"))
  const retracted = commitRackJourney(extended, view("open", "retracted"))
  expect(nextRackServiceAction(view("open", "retracted"), retracted)).toBe("close")
  expect(commitRackJourney(retracted, view("closed", "retracted"))).toBe(INITIAL_RACK_JOURNEY)
})
