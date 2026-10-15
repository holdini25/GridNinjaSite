// @vitest-environment node
import { describe, expect, it, vi } from "vitest"
import { assertNativeLcpEvidence, assertNativeLcpReceipt } from "../../../scripts/facility/native-lcp-evidence.mjs"
import { captureValidLighthouseReport } from "../../../scripts/facility/lighthouse-capture.mjs"

const event = () => ({ name: "largestContentfulPaint::Candidate", ts: 123 })
function fixture(main = event(), all = main) {
  const trace = { traceEvents: [main, ...(main === all ? [] : [all])] }
  const processor = { processTrace: vi.fn(() => ({ selected: true })), processNavigation: vi.fn(() => ({ largestContentfulPaintEvt: main, largestContentfulPaintAllFramesEvt: all })) }
  return { trace, processor, main, all }
}
describe("native LCP evidence boundary", () => {
  it.each([
    { nativeMainFrame: "yes" }, { nativeAllFrames: 1 }, { nativeAllFrames: false },
    { selection: "firstNavigationStart" }, { mainFrameTimestamp: undefined },
    { allFramesTimestamp: Infinity }, { mainFrameTimestamp: -1 }, { extra: true },
  ])("rejects a malformed saved native receipt %j", replacement => {
    const f = fixture(), receipt = assertNativeLcpEvidence(f.trace, f.processor)
    expect(() => assertNativeLcpReceipt({ ...receipt, ...replacement })).toThrow()
  })
  it("uses native selected identities after the pinned navigation/frame selection", () => {
    const f = fixture()
    expect(assertNativeLcpEvidence(f.trace, f.processor)).toMatchObject({ nativeMainFrame: true, nativeAllFrames: true })
    expect(f.processor.processTrace).toHaveBeenCalledWith(f.trace, { timeOriginDeterminationMethod: "lastNavigationStart" })
  })
  it("rejects a synthesized copy even when another native event exists", () => {
    const f = fixture()
    f.processor.processNavigation.mockReturnValue({ largestContentfulPaintEvt: f.main, largestContentfulPaintAllFramesEvt: { ...f.main } })
    expect(() => assertNativeLcpEvidence(f.trace, f.processor)).toThrow("synthetic fallback")
  })
  it("rejects invalidated/wrong/missing selected native candidates", () => {
    const f = fixture()
    f.trace.traceEvents = []
    expect(() => assertNativeLcpEvidence(f.trace, f.processor)).toThrow()
    const wrong = fixture({ name: "UKM fallback", ts: 123 })
    expect(() => assertNativeLcpEvidence(wrong.trace, wrong.processor)).toThrow()
    const bad = fixture({ name: "largestContentfulPaint::Candidate", ts: NaN })
    expect(() => assertNativeLcpEvidence(bad.trace, bad.processor)).toThrow()
  })
  it("does not suppress a missing native navigation marker", () => {
    const f = fixture(); f.processor.processTrace.mockImplementation(() => { throw new Error("NO_NAVSTART") })
    expect(() => assertNativeLcpEvidence(f.trace, f.processor)).toThrow("NO_NAVSTART")
  })
  it("preserves policy-rejected raw evidence and never retries it", async () => {
    const result = { lhr: { audits: { "largest-contentful-paint": { numericValue: 1000 } } }, artifacts: { Trace: {} } }
    const capture = vi.fn(async () => result), preserve = vi.fn()
    await expect(captureValidLighthouseReport(capture, preserve, () => { throw new Error("synthetic fallback") })).rejects.toThrow("synthetic fallback")
    expect(capture).toHaveBeenCalledTimes(1)
    expect(preserve).toHaveBeenCalledWith(result, 1, { policyFailure: "synthetic fallback" })
    expect(result.lhr).not.toHaveProperty("runtimeError")
  })
})
