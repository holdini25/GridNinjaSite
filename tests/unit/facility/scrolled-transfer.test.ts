// @vitest-environment node
import { describe, expect, it, vi } from "vitest"
import { assertScrolledTransfer, settleScrolledViewport, visitScrolledPage } from "../../../scripts/facility/scrolled-transfer.mjs"
import { TransferLedger } from "../../../scripts/facility/performance-contract.mjs"

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
  it("settles each visited viewport before scrolling again and retains cumulative totals", async () => {
    const order: string[] = []
    let visit = 0
    let evaluations = 0
    const page = { evaluate: vi.fn(async () => { if (++evaluations % 2) { order.push("scroll"); visit++ }; return { y: visit * 800, height: 2600, viewportHeight: 1000 } }) }
    const settle = vi.fn(async () => { order.push("settle"); return { bytes: visit * 100 } })
    const result = await visitScrolledPage(page, settle)
    expect(order).toEqual(["scroll", "settle", "scroll", "settle"])
    expect(result).toMatchObject({ complete: true, protocol: "settled-viewport-visits" })
    expect(result.steps.map(step => step.cumulativeBytes)).toEqual([100, 200])
  })
  it("includes a late request from the new viewport when the previous one was already quiet", async () => {
    vi.useFakeTimers()
    try {
      const ledger = new TransferLedger()
      ledger.request({ requestId: "page", type: "Document", request: { url: "https://example.com/" } })
      ledger.finished({ requestId: "page", encodedDataLength: 100 })
      await vi.advanceTimersByTimeAsync(2_000)

      // Model a lazy image that starts 200 ms after the final scroll, then completes at 400 ms.
      const page = { evaluate: vi.fn()
        .mockImplementationOnce(async () => {
          setTimeout(() => ledger.request({ requestId: "image", type: "Image", request: { url: "https://example.com/art.webp" } }), 200)
          setTimeout(() => ledger.finished({ requestId: "image", encodedDataLength: 300 }), 400)
        })
        .mockResolvedValueOnce({ y: 800, height: 1800, viewportHeight: 1000 }) }
      const visit = visitScrolledPage(page, () => settleScrolledViewport(ledger))
      await vi.advanceTimersByTimeAsync(1_149)
      expect(page.evaluate).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1)
      expect(await visit).toMatchObject({ complete: true, steps: [{ cumulativeBytes: 400 }] })
    } finally { vi.useRealTimers() }
  })
  it("never scrolls past a failed or unsettled viewport", async () => {
    const page = { evaluate: vi.fn(async () => ({ y: 800, height: 10000, viewportHeight: 1000 })) }
    await expect(visitScrolledPage(page, async () => { throw new Error("Incomplete transfer measurement: aborted") })).rejects.toThrow("Incomplete")
    expect(page.evaluate).toHaveBeenCalledTimes(1)
  })
  it("uses the new document height when lazy content grows during settlement", async () => {
    let height = 1800, y = 0
    let evaluations = 0, settlements = 0
    const result = await visitScrolledPage({ evaluate: async () => {
      if (++evaluations % 2) y += 800
      return { y, height, viewportHeight: 1000 }
    } }, async () => { settlements++; height = 2600; return { bytes: settlements * 100 } })
    expect(result.complete).toBe(true)
    expect(result.steps).toHaveLength(2)
    expect(result.steps[0]).toMatchObject({ y: 800, height: 2600 })
  })
  it("retains a finite visit limit for a document that keeps growing", async () => {
    let visit = 0
    const result = await visitScrolledPage({ evaluate: async () => ({ y: visit * 800, height: 1000 + visit * 1000, viewportHeight: 1000 }) }, async () => ({ bytes: ++visit }))
    expect(result.complete).toBe(false)
    expect(result.steps).toHaveLength(100)
  })
})
