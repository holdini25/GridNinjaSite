import { describe, expect, it } from "vitest"
import type { FacilityView } from "@/types/facility"
import { rackServiceCommandError } from "@/lib/facility/rack-service-view"

const whole: FacilityView = { kind: "specimen", specimen: "rack", pose: "service", rack: { door: "open", tray: "extended", cutaway: false } }
const detail: FacilityView = { ...whole, rack: { door: "open", tray: "extended", cutaway: true }, detail: "service-connection" }
const returning: FacilityView = { ...whole, rack: { door: "open", tray: "extended", cutaway: true } }
const joints = { door: 1, tray: 1, moving: false }

describe("explicit service camera interlocks", () => {
  it("requires an existing stationary service endpoint, authored support and explicit cutaway", () => {
    expect(rackServiceCommandError(detail, whole, null, joints, true)).toBeNull()
    for (const snapshot of [null, { ...joints, moving: true }, { ...joints, door: .99 }, { ...joints, tray: .99 }]) {
      expect(rackServiceCommandError(detail, whole, null, snapshot, true)).not.toBeNull()
    }
    expect(rackServiceCommandError(detail, whole, null, joints, false)).not.toBeNull()
    expect(rackServiceCommandError({ ...detail, rack: whole.rack }, whole, null, joints, true)).not.toBeNull()
    expect(rackServiceCommandError(detail, whole, whole, joints, true)).not.toBeNull()
  })
  it("rejects all joint or cover changes until the return camera has actually settled", () => {
    const close: FacilityView = { ...whole, rack: { door: "closed", tray: "retracted", cutaway: true } }
    const retract: FacilityView = { ...whole, rack: { door: "open", tray: "retracted", cutaway: true } }
    const cover: FacilityView = { ...whole, rack: { door: "open", tray: "extended", cutaway: false } }
    for (const target of [close, retract, cover]) {
      expect(rackServiceCommandError(target, detail, null, joints, true)).not.toBeNull()
      expect(rackServiceCommandError(target, whole, detail, joints, true)).not.toBeNull()
      expect(rackServiceCommandError(target, detail, returning, joints, true)).not.toBeNull()
      expect(rackServiceCommandError(target, returning, null, joints, true)).toBeNull()
    }
    expect(rackServiceCommandError(returning, detail, null, joints, true)).toBeNull()
    expect(rackServiceCommandError(returning, whole, detail, joints, true)).not.toBeNull()
  })
  it("preserves explicit facility/other-assembly exit and all legacy mechanical targets", () => {
    expect(rackServiceCommandError({ kind: "overview" }, detail, detail, joints, true)).toBeNull()
    expect(rackServiceCommandError({ kind: "specimen", specimen: "cooling", pose: "closed" }, detail, detail, joints, true)).toBeNull()
    for (const pose of ["closed", "service", "cutaway"] as const) expect(rackServiceCommandError({ kind: "specimen", specimen: "rack", pose }, { kind: "overview" }, null, null, false)).toBeNull()
  })
})
