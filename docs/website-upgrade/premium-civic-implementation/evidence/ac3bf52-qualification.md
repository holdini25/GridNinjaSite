# Candidate ac3bf52 qualification disposition

Root implementation lead, 10 October 2026. This candidate is not approved for production.

Candidate `ac3bf52a434d224759e543748297efc5cd078fd8` has local build `UYfVPiZ-A_0cF9lCnM906` and source `03ae1f12893b49c40a8ce9bb5123c4da8cd4d2e76a7e50e5c620134582b7caed`. GitHub checks use merge `9eca51b02a337a99b66d29697b8b21cb3b25f9d3`; its source tree equals the branch candidate. Local HTTP/test-key evidence remains separate from production configuration.

## Preserved evidence

- The split brand, lint, typecheck and build cycle passed, with unchanged clean source. CI unit coverage passed 1,201 tests in 131 files. Original publication/media comparison preserves all 122 baseline files byte-for-byte.
- All six CI browser projects passed with project-specific skips recorded separately. Chrome and Firefox desktop each passed 211 cases with 11 skips; Chromium desktop passed 215 with 7 skips; Chromium and WebKit mobile each passed 208 with 14 skips; WebKit desktop passed 211 with 11 skips. The repaired brief containment, tall review capture and strict canvas observation completed successfully. These browser results do not override the separate Lighthouse failure.
- Local bounded command 12 passed all 20 startup/playback observations and 130 full-scroll observations. Its archived report SHA-256 is `d0177160ca6acd5eb4a3c839a5a44952fb24fda4c50f0ba7afb01afc65fad64b`. Native motion thresholds were unchanged. These results do not establish initial-load Lighthouse performance.
- Forty responsive core cases and six failed-media cases completed. The first no-JavaScript review harness was stopped after two context-destroyed errors in its injected animation-frame paint preparation. That partial report remains interrupted. A separate bounded, six-case static capture used document load and native screenshot readiness without animation-frame injection; all six cases passed. The combined review identifies the separate reports rather than relabeling the interrupted run. It is not native zoom, screen-reader or physical-device evidence.
- Facility CI `38089354476` passed functional/transfer checks but failed the existing mobile LCP gate. Home samples are 2530.5148, 2586.9239, 2607.2169, 2626.0955 and 2639.45575 ms. Assessment samples are 2530.109, 2504.5227, 2037.2009, 2524.099 and 2361.9807 ms. Medians remain above 2500 ms. All valid samples and raw traces are retained under `build/qa/premium-civic-ac3bf52/ci-analysis`.

## Evidence-backed correction

The median traces show HTML parsing stopped at the classic inline header bootstrap before the main content while the earlier stylesheet was outstanding. After stylesheet completion, the header painted alone; the bootstrap ran, main parsing resumed, and framework execution interleaved before the hero paragraph painted. The paragraphs are already static server markup, with system fonts and no reveal animation. Observed unthrottled trace times and Lighthouse's simulated times remain distinct; this ordering evidence is not a measured speedup.

The root lead authorizes one narrow correction: make that unchanged bootstrap parser-deferred using an inline module. Native links and disclosures must remain functional before enhancement, with unchanged active-route, recovery and lazy-import behavior. Use a controlled stylesheet hold to verify that main content can be parsed before styles are released; preserve the original failing condition and test the corrected behavior. Do not shorten or hide the hero text, alter artwork, weaken timing limits, or enable global experimental CSS inlining as part of this correction.

## Bounded requalification

This is an explicit disposition for the failed replacement candidate, as required by the earlier [a3e399c disposition](a3e399c-qualification.md). Freeze the corrected source, then run one further split brand/lint/typecheck/build cycle and the relevant unit, browser and performance checks. Do not invoke the exhausted combined `quality` phase. Retain the original ledger, all counters, the forty-command ceiling and deadline `2026-10-11T00:37:12.359Z`. No reset, extension, retries-only clearance or additional automatic exception is authorized. The next page-performance invocation is its third permitted attempt. Further failure or source correction requires a new explicit disposition; a passing subset cannot approve production.

The 130-run local Lighthouse collection is deferred until the corrected candidate is frozen, avoiding qualification of a candidate already known to fail the retained CI gate. Actual readers, physical devices, manual accessibility and production-configured evidence remain open release requirements.
