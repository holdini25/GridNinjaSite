import { describe, expect, it } from "vitest"
import { serviceReturnScroll } from "@/lib/facility/service-return-scroll"

describe("inspection return visibility", () => {
  it("reveals a rail hidden by nine pixels while keeping the focused action in view", () => {
    const result = serviceReturnScroll(1000, { top: 90, bottom: 832 }, { top: 81, bottom: 650 }, { top: 735, bottom: 779 })
    expect(result).toBe(991)
    expect(81 - (result - 1000)).toBe(90)
    expect(779 - (result - 1000)).toBeLessThanOrEqual(832)
  })
  it("does not move an already visible inspection group", () => {
    expect(serviceReturnScroll(700, { top: 100, bottom: 820 }, { top: 120, bottom: 620 }, { top: 670, bottom: 714 })).toBe(700)
  })
  it("prioritizes the focus target when zoom or landscape makes the whole assembly too tall", () => {
    expect(serviceReturnScroll(800, { top: 100, bottom: 380 }, { top: 110, bottom: 670 }, { top: 730, bottom: 774 })).toBe(1194)
  })
  it("accounts for visual viewport offsets and never scrolls before the document", () => {
    expect(serviceReturnScroll(500, { top: 160, bottom: 790 }, { top: 180, bottom: 630 }, { top: 770, bottom: 814 })).toBe(524)
    expect(serviceReturnScroll(0, { top: 90, bottom: 830 }, { top: 0, bottom: 450 }, { top: 480, bottom: 524 })).toBe(0)
  })
})
