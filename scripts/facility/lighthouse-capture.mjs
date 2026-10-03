import assert from "node:assert/strict"

/** A missing navigation marker is an invalid capture, not a slow measurement. */
export function isMissingNavigationCapture(result) {
  const report = result?.lhr
  return report?.runtimeError?.code === "NO_NAVSTART"
    && !Number.isFinite(report.audits?.["largest-contentful-paint"]?.numericValue)
}

/** Each capture callback must own a fresh browser profile and close it before
 * returning. Preserve invalid evidence before deciding whether it is retryable.
 */
export async function captureValidLighthouseReport(capture, preserveInvalid) {
  for (let number = 1; number <= 2; number++) {
    const result = await capture(number)
    if (result?.lhr && !result.lhr.runtimeError) return result
    await preserveInvalid(result, number)
    if (number === 1 && isMissingNavigationCapture(result)) continue
    assert.fail(`Lighthouse failed: ${result?.lhr?.runtimeError?.message ?? "no report"}`)
  }
}
