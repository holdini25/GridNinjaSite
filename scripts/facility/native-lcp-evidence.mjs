import assert from "node:assert/strict"

export function assertNativeLcpReceipt(receipt) {
  assert(receipt && typeof receipt === "object", "Missing native LCP receipt")
  assert.deepEqual(Object.keys(receipt).sort(), ["allFramesTimestamp", "mainFrameTimestamp", "nativeAllFrames", "nativeMainFrame", "schemaVersion", "selection"], "Changed native LCP receipt fields")
  assert.equal(receipt.schemaVersion, "gridninja-native-lcp.v1", "Unknown native LCP receipt schema")
  assert.equal(receipt.selection, "Lighthouse13.5 lastNavigationStart", "Changed native LCP selection")
  for (const key of ["nativeMainFrame", "nativeAllFrames"]) assert.equal(receipt[key], true, "LCP fallback cannot qualify")
  for (const key of ["mainFrameTimestamp", "allFramesTimestamp"]) assert(Number.isFinite(receipt[key]) && receipt[key] >= 0, "Missing finite native LCP timestamp")
  return receipt
}

/** Lighthouse13.5 can synthesize an LCP candidate from a UKM invalidation.
 * Reuse its pinned frame/navigation selection without patching native tracing.
 * Normal selected events retain identity in the same raw trace object graph;
 * the UKM fallback is newly constructed and therefore cannot satisfy this check.
 * Installed-package verification is required before this adapter is qualified.
 */
export function assertNativeLcpEvidence(trace, traceProcessor) {
  assert(Array.isArray(trace?.traceEvents), "Missing raw native trace")
  const processed = traceProcessor.processTrace(trace, { timeOriginDeterminationMethod: "lastNavigationStart" })
  const navigation = traceProcessor.processNavigation(processed)
  const fields = ["largestContentfulPaintEvt", "largestContentfulPaintAllFramesEvt"]
  for (const field of fields) {
    const selected = navigation[field]
    assert(selected && trace.traceEvents.includes(selected)
      && selected.name === "largestContentfulPaint::Candidate" && Number.isFinite(selected.ts),
    `Missing selected native LCP event (${field}); synthetic fallback cannot qualify`)
  }
  return assertNativeLcpReceipt({ schemaVersion: "gridninja-native-lcp.v1", selection: "Lighthouse13.5 lastNavigationStart", mainFrameTimestamp: navigation.largestContentfulPaintEvt.ts, allFramesTimestamp: navigation.largestContentfulPaintAllFramesEvt.ts, nativeMainFrame: true, nativeAllFrames: true })
}
