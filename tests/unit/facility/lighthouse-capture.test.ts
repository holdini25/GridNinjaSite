// @vitest-environment node
import { describe, expect, it, vi } from "vitest"
import { captureValidLighthouseReport } from "../../../scripts/facility/lighthouse-capture.mjs"

const missingNavigation = () => ({ lhr: { runtimeError: { code: "NO_NAVSTART", message: "No navigation start" }, audits: {} }, artifacts: { Trace: { traceEvents: [] }, DevtoolsLog: [] } })
const slowReport = () => ({ lhr: { audits: { "largest-contentful-paint": { numericValue: 9_000 }, "total-blocking-time": { numericValue: 3_000 } } } })

describe("Lighthouse invalid navigation capture replacement", () => {
  it("preserves a missing-navigation capture before collecting one fresh replacement", async () => {
    const order: string[] = [], invalid = missingNavigation(), valid = slowReport()
    const capture = vi.fn(async number => { order.push(`capture-${number}`); return number === 1 ? invalid : valid })
    const preserve = vi.fn(async (report, number) => { expect(report).toBe(invalid); order.push(`preserve-${number}`) })
    expect(await captureValidLighthouseReport(capture, preserve)).toBe(valid)
    expect(order).toEqual(["capture-1", "preserve-1", "capture-2"])
    expect(capture).toHaveBeenCalledTimes(2)
  })
  it("never replaces a complete but poor measurement", async () => {
    const report = slowReport(), capture = vi.fn(async () => report), preserve = vi.fn()
    expect(await captureValidLighthouseReport(capture, preserve)).toBe(report)
    expect(capture).toHaveBeenCalledExactlyOnceWith(1)
    expect(preserve).not.toHaveBeenCalled()
  })
  it.each(["NO_FCP", "ERRORED_DOCUMENT_REQUEST", "PAGE_HUNG"])("preserves and rejects %s without retry", async code => {
    const report = { lhr: { runtimeError: { code, message: code } } }, capture = vi.fn(async () => report), preserve = vi.fn()
    await expect(captureValidLighthouseReport(capture, preserve)).rejects.toThrow(code)
    expect(capture).toHaveBeenCalledTimes(1)
    expect(preserve).toHaveBeenCalledExactlyOnceWith(report, 1)
  })
  it("does not replace an inconsistent NO_NAVSTART report that already measured LCP", async () => {
    const report = { ...missingNavigation(), lhr: { ...missingNavigation().lhr, audits: slowReport().lhr.audits } }
    const capture = vi.fn(async () => report), preserve = vi.fn()
    await expect(captureValidLighthouseReport(capture, preserve)).rejects.toThrow("No navigation start")
    expect(capture).toHaveBeenCalledTimes(1)
    expect(preserve).toHaveBeenCalledExactlyOnceWith(report, 1)
  })
  it("preserves both invalid captures and fails after the single permitted replacement", async () => {
    const capture = vi.fn(async () => missingNavigation()), preserve = vi.fn()
    await expect(captureValidLighthouseReport(capture, preserve)).rejects.toThrow("No navigation start")
    expect(capture.mock.calls).toEqual([[1], [2]])
    expect(preserve.mock.calls.map(call => call[1])).toEqual([1, 2])
  })
  it("does not retry thrown failures or proceed when evidence preservation fails", async () => {
    const failure = vi.fn(async () => { throw new Error("browser disconnected") }), preserve = vi.fn()
    await expect(captureValidLighthouseReport(failure, preserve)).rejects.toThrow("browser disconnected")
    expect(failure).toHaveBeenCalledTimes(1)
    const capture = vi.fn(async () => missingNavigation())
    await expect(captureValidLighthouseReport(capture, async () => { throw new Error("disk full") })).rejects.toThrow("disk full")
    expect(capture).toHaveBeenCalledTimes(1)
  })
})
