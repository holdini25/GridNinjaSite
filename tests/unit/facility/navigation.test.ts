import { describe, expect, it } from "vitest"
import { facilityDestinations, facilityObscuredRackDetail, facilitySelectionHref, resolveFacilityFocus, resolveFacilityTopic } from "@/lib/facility/navigation"
import { assessmentFixtures } from "@/content/assessments/fixtures"
import { assessmentLinks, resolveAssessmentSelection } from "@/lib/assessment/selectors"
import type { FacilityVisualRelease } from "@/types/facility"

const release = { equipmentIndex: { schemaVersion: "facility-equipment-index.v1", equipment: [{ id: "rack-02", label: "Rack 03", system: "workloads", role: "rack", bounds: { min: [0, 0, 0], max: [1, 1, 1] } }] } } as unknown as FacilityVisualRelease

describe("public facility navigation", () => {
  it("resolves only exact authored equipment or systems without graphics", () => {
    expect(resolveFacilityFocus({ focus: "rack-02" }, release)).toEqual({ system: "workloads", equipmentId: "rack-02" })
    expect(resolveFacilityFocus(new URLSearchParams("focus=cooling"), null)).toEqual({ system: "cooling" })
    for (const focus of ["rack-99", "javascript:alert(1)", ["power", "cooling"]]) expect(resolveFacilityFocus({ focus }, release)).toBeNull()
  })
  it("clears invalid visual context independently of assessment identity", () => {
    const search = new URLSearchParams("scenario=d&version=1.0.0&perspective=engineering&focus=unknown&topic=private@example.com")
    expect(resolveAssessmentSelection(search)).toMatchObject({ status: "ready", scenario: "d" })
    expect(resolveFacilityFocus(search, release)).toBeNull()
    expect(resolveFacilityTopic(search)).toBeUndefined()
    search.append("scenario", "b")
    expect(resolveAssessmentSelection(search).status).toBe("unavailable")
  })
  it("serializes public identities and topic without transient view or narrative state", () => {
    const selection = resolveAssessmentSelection({ scenario: "c", perspective: "engineering" })
    if (selection.status !== "ready") throw Error("fixture")
    expect(facilitySelectionHref(selection, { system: "workloads", equipmentId: "rack-02" }, "ai-cloud")).toBe("/demo?scenario=c&version=1.0.0&perspective=engineering&focus=rack-02&topic=ai-cloud#decision-brief")
    expect(facilitySelectionHref(selection, null, "colocation")).not.toContain("focus=")
    expect(resolveFacilityTopic({ topic: ["power", "power"] })).toBeUndefined()
  })
  it("uses the selected immutable publication and bounds named destinations", () => {
    for (const record of Object.values(assessmentFixtures)) {
      const destinations = facilityDestinations(record, "storage")
      expect(destinations.related).toHaveLength(2)
      expect(destinations.related[1].href).toBe(assessmentLinks(record).brief)
      expect(destinations.principal.href).toBe("/assessment?topic=storage&source=demo-inspection-room#scope")
    }
  })
})


describe("rear rack detail cue", () => {
  const indexRelease = {
    profile: { inspection: { details: { rack: { camera: [2, 2, 5], target: [0, 1, 0] } } } },
    equipmentIndex: { equipment: [
      { id: "arbitrary-rear", label: "Rear specimen", system: "workloads", role: "server_rack", bounds: { min: [0, 0, -2], max: [1, 3, -1] } },
      { id: "arbitrary-front", label: "Front specimen", system: "workloads", role: "server_rack", bounds: { min: [0, 0, 1], max: [1, 3, 2] } },
    ] },
  } as unknown as FacilityVisualRelease
  it("uses authored role, bounds and camera direction instead of numbered identity ranges", () => {
    expect(facilityObscuredRackDetail(indexRelease, { kind: "overview", detail: "rack", equipmentId: "arbitrary-rear" })?.label).toBe("Rear specimen")
    expect(facilityObscuredRackDetail(indexRelease, { kind: "overview", detail: "rack", equipmentId: "arbitrary-front" })).toBeNull()
    expect(facilityObscuredRackDetail(indexRelease, { kind: "overview", detail: "air-path", equipmentId: "arbitrary-rear" })).toBeNull()
    expect(facilityObscuredRackDetail(indexRelease, { kind: "overview", equipmentId: "arbitrary-rear" })).toBeNull()
    expect(facilityObscuredRackDetail(indexRelease, { kind: "specimen", specimen: "rack", pose: "closed" })).toBeNull()
    const reversed = structuredClone(indexRelease)
    reversed.profile.inspection!.details.rack.camera[2] = -5
    expect(facilityObscuredRackDetail(reversed, { kind: "overview", detail: "rack", equipmentId: "arbitrary-front" })?.id).toBe("arbitrary-front")
    expect(facilityObscuredRackDetail(reversed, { kind: "overview", detail: "rack", equipmentId: "arbitrary-rear" })).toBeNull()
  })
  it("ignores nonrack, nonoverlapping and absent public equipment", () => {
    const otherColumn = structuredClone(indexRelease)
    otherColumn.equipmentIndex!.equipment[1].bounds = { min: [2, 0, 1], max: [3, 3, 2] }
    expect(facilityObscuredRackDetail(otherColumn, { kind: "overview", detail: "rack", equipmentId: "arbitrary-rear" })).toBeNull()
    otherColumn.equipmentIndex!.equipment[1] = { ...indexRelease.equipmentIndex!.equipment[1], role: "electrical_cabinet" }
    expect(facilityObscuredRackDetail(otherColumn, { kind: "overview", detail: "rack", equipmentId: "arbitrary-rear" })).toBeNull()
    expect(facilityObscuredRackDetail({ ...indexRelease, equipmentIndex: undefined }, { kind: "overview", detail: "rack", equipmentId: "arbitrary-rear" })).toBeNull()
  })
})
