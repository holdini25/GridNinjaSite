// @vitest-environment node
import { describe, expect, it } from "vitest"
import { assertScrolledTransfer } from "../../../scripts/facility/scrolled-transfer.mjs"

const transfer = (requests: { type: string; bytes: number }[]) => ({ complete: true, issues: [], bytes: requests.reduce((sum, request) => sum + request.bytes, 0), requests })
const policy = { route: "/evidence", profile: "mobile" }

describe("cumulative full-scroll resource budgets", () => {
  it("includes late illustrations and fonts under their existing per-resource ceilings", () => {
    expect(() => assertScrolledTransfer(transfer([{ type: "Document", bytes: 100_000 }, { type: "Image", bytes: 200_000 }, { type: "Font", bytes: 80_000 }]), policy)).not.toThrow()
    expect(() => assertScrolledTransfer(transfer([{ type: "Image", bytes: 256_001 }]), policy)).toThrow("image")
    expect(() => assertScrolledTransfer(transfer([{ type: "Font", bytes: 100_000 }, { type: "Font", bytes: 64_000 }]), policy)).toThrow("font")
  })
  it("does not exempt total, incomplete or article-script transfers after initial loading", () => {
    expect(() => assertScrolledTransfer(transfer([{ type: "Script", bytes: 1_572_865 }]), policy)).toThrow("Total")
    expect(() => assertScrolledTransfer({ ...transfer([{ type: "Document", bytes: 1 }]), complete: false }, policy)).toThrow("incomplete")
    expect(() => assertScrolledTransfer(transfer([{ type: "Script", bytes: 204_801 }]), { ...policy, route: "/insights/example" })).toThrow("script")
  })
})
