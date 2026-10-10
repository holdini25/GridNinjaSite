# Candidate a3e399c qualification disposition

Root implementation lead, 10 October 2026. This candidate is not approved for production.

Candidate `a3e399c5e8dec9918cb6bab85aa1dd2f660352b3`, local build `sK9un26mO3pYUDnCDLMVq`, source `e56824ff2c644a7f523a9098080b836e331397b71c7b451c5f4f627098e1f3da`. Local build uses HTTP and a test verification key. GitHub tests use PR merge `682990cb3db3a2e7799061f7fcc663567fd29a9f` against production source `e980000ea458f50662c268218791f6087f9e8ca3`; preserve that distinction from the branch SHA.

## Observed failures and corrections

| Evidence | Finding | Disposition |
| --- | --- | --- |
| CI 38087223002, Chrome and both WebKit projects | The HTML brief thumbnail clips horizontally at 1366px; WebKit also clips its text vertically at 320/390/960px. Each repeats on retry. | Remove the text thumbnail's rigid aspect ratio and bound its grid track. Preserve all content and existing containment assertions. Focused browser stylesheet-substitution checks pass; rebuilt qualification is required. |
| Same CI, mobile WebKit | Complete homepage review image exceeds the browser's 32767-device-pixel screenshot limit. | Capture bounded document-coordinate tiles at native resolution, then stitch with existing Sharp. Preserve layout checks, exact restoration and complete coverage. This is explicitly sequential review imagery, never performance evidence. |
| Same CI, desktop WebKit | Normal-rendering observation sees canvas dimension writes during its 350ms window. | Observe three seconds of actual quality, CSS geometry and raw canvas mutations. Only directly correlated, bounded dimension transitions may precede the unchanged uninterrupted 350ms zero-mutation window. Diagnostic exposure, unexplained writes and sustained resizing still fail. The local WebKit run is stable and does not reproduce or prove the historical Linux transition; replacement CI must establish its result. |
| Facility CI 38087223020 | Five-run mobile LCP medians: home 2673.285ms, assessment 2516.361ms; both exceed 2500ms. The LCP elements are introductory text. | Keep all valid samples. Investigate shared render-blocking styles; move exact specialist dispatch and animated-logo styles to their owning components. New measurement is required; savings are not established by a code move. |
| Local bounded attempt 07 | All 20 readiness observations and 130 full-scroll observations collected, but one native loop reports a negative predicted display interval and three mobile scrolls abort a 206 video request. Natural exit 1; no signal interruption. | Preserve complete failed report. Native timing remains inconclusive and its validator is unchanged. Complete-transfer collection now visits each viewport until the same cumulative ledger settles before advancing, recording the protocol, quiet interval and deadline. It retains every failed request and every byte; rapid-fling cancellation is a different observation. |

The failed run artifacts remain under `build/qa/premium-civic-a3e399c/ci-analysis` and `performance`. Original supplementary screenshot assertions using the wrong sample URL remain preserved; the completed corrected 12-case static/degraded report alone supersedes those assertions. The 40 core captures are not a global accessibility pass.

## Explicit stopping-budget disposition

The combined `quality` phase has used all three permitted attempts across earlier candidates. The root lead explicitly reopens the candidate for the newly evidenced defects above and authorizes **one additional split quality cycle**: one invocation each of the existing `brand`, `lint`, `typecheck` and `build` phases. This is a documented exception for a corrected candidate, not a new name for an unlimited combined-quality retry. Do not invoke `quality` a fourth time.

Retain the original task ledger, all attempt counters, the forty-command ceiling and the original four-hour deadline (`2026-10-11T00:37:12.359Z`). Do not reset or extend them. All four checks use the same bounded wrapper and count as separate commands. Freeze source before those checks. A further source correction, failed replacement check, or exhausted window requires another explicit root disposition; no automatic exception is implied.

The release remains blocked by any unresolved automated gate and by actual-reader, physical-device, manual-accessibility and production-configuration evidence. Agent reviews, local HTTP results and the preview cannot replace those requirements.
