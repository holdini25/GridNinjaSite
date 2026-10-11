# Baseline and historical failure receipt

Recorded 10 October 2026, from production merge `e980000ea458f50662c268218791f6087f9e8ca3`, before new site source was copied into the shared upgrade worktree. The original cinematic and publication files are bound in [baseline-inventory.json](baseline-inventory.json); build identity and settings are in [baseline-build-identity.json](baseline-build-identity.json). This is local source evidence, not a claim of production equivalence or a release certificate.

## Local baseline

Node **22.23.2**, npm **10.9.8**, macOS arm64 / Apple M5 Pro, with the existing repo toolchain at `/Users/holdenchung/repos/GridNinjaSite/build/tools/node-v22.23.2-darwin-arm64/bin`. The app-bundled Node inspected for this task is 24.19.0 and does not satisfy the project engine requirement.

- `npm ci`: passed; initial lock preserved.
- `npm run build`: passed including existing pre/postbuild checks; [build log](baseline-build.log). Build `Aluk0PCsxz_V4BlWHbQKp`; source digest `1a8515aabf18049b515424fd7f35e6643b2754f7523a80e600f3ca7c91f80d17`.
- Initial JS Brotli: home 117.3 KiB, assessment 136.5 KiB, demo 129.5 KiB, contact 134.9 KiB; all within 180 KiB.
- Original Lighthouse collector: 30 consecutive valid reports, three routes × two profiles × five fresh browsers. No performance samples discarded or retried. Metal backend recorded. [Compact metrics and raw-report hashes](baseline-performance.json); private raw reports under `build/facility/baseline-e980000/`.
- Mobile median LCP: home **2450.07 ms**, demo **2300.481 ms**, assessment **2300.8911 ms**. All pass the 2500 ms hard ceiling locally; all miss the separate 2200 ms design aim. The historic 2503.1661 ms mobile-home release miss remains recorded.
- The no-JavaScript assessment navigation test passed six repetitions across local desktop/mobile WebKit. This is **not** the test that failed in Linux CI, as subsequent retrieval established. [Local result](baseline-webkit.json).

Build settings were cinematic-v1 `auto`, facility-v12 `auto-adaptive`, enforce CSP, observability disabled, verification unconfigured and local HTTP. These differ from deployment settings. Full through-readiness/frame qualification, physical devices and production-config comparisons were not run in this baseline window.

## Actual Linux WebKit failure

Read-only retrieval on 10 October located [CI run 37084615755](https://github.com/holdini25/GridNinjaSite/actions/runs/37084615755), desktop WebKit job **111092202821**. It ran Ubuntu **24.04.5**, runner image **20260927.320.1**, Node **22.23.2**, npm **10.9.8**, WebKit **26.5 / Playwright build 2311**, headless, one worker. Preflight reported functional WebGL2; it explicitly did not qualify device performance. Desktop job outcome: 178 passed, 11 skipped, one failed on both attempts. Mobile WebKit passed its job. The no-JS test passed in the original Linux job too.

The failing test was `tests/e2e/enterprise-experience.spec.ts:65`, **“a hypothetical minimum never changes assessment identity, files, or navigation”**. `openAssessmentControls` at `tests/support/facility-viewer.ts:72` clicked the native summary, then timed out waiting for the Scenario combobox. [Selected original log lines](baseline-linux-webkit-excerpt.log).

The [original artifact](https://github.com/holdini25/GridNinjaSite/actions/runs/37084615755/artifacts/11260342683) was downloaded locally to `build/qa/baseline-linux-webkit.zip`. Its SHA-256 matches GitHub: `a9bd29d787db1e7fccb13199c915d472f04dff84c3c0b1d48a2f08ec1037c665`. Both trace ZIPs, screenshots and error contexts are extracted below `build/qa/baseline-linux-webkit/test-results/`.

Both traces show the summary center initially around y=64–65, behind a sticky 70 px header. Playwright retries after the header intercepts pointer events. Native scrolling then moves the target; the successful input is reported at y=688.23 in attempt one and y=762.23 in retry. Retry also logs interception by “Result and assessment limits” during the movement. Both finish the click without opening the expected disclosure. The screenshot visibly retains the closed control behind the header.

This supports a scrolling/actionability race, not a proven hydration or no-JavaScript defect. The helper now centers the real summary, requires stable unobscured geometry within a bounded 2 s poll, then performs a normal click and explicitly requires the native `open` state and visible combobox. It neither forces activation nor retries a completed failed click. Product-level scroll behavior is reviewed separately by the lead. A fresh source-pinned Linux WebKit run remains required; a local macOS pass cannot close it.

## Minimal dependency remediation

After baseline archival, the authorized patch updates were applied: Next and eslint-config-next **16.3.6 → 16.3.8**, sharp **0.35.4 → 0.35.5**, and source-map-js **1.2.1 → 1.2.2** within existing parent ranges. No package-manager switch or broad audit-fix operation occurred. The production audit changed from three high findings to **zero**: [before](baseline-production-audit.json), [after](baseline-production-audit-remediated.json). The [complete dev-plus-production audit](baseline-development-audit-remediated.json) still reports 19 findings (3 moderate, 15 high, 1 critical); the production result does not erase those.

Primary advisory records: [Next](https://github.com/advisories/GHSA-cjq9-62q9-8jv4), [sharp](https://github.com/advisories/GHSA-wq5f-xc86-pv6w), [source-map-js](https://github.com/advisories/GHSA-68fv-2mgg-jv7q). The specific Next remote-image SSRF exposure requires `images.remotePatterns`; the inspected configuration contains none. Remediation still keeps the compatible patched release. An integrated build and the full candidate suite must validate the updated dependencies together with final source.

Follow-up: the root subsequently authorized only the compatible development leaf patches proxy-addr 2.0.8 and compression 1.8.2. The newer receipts show 17 development-inclusive findings (3 moderate, 14 high, zero critical) and zero production findings. See [exact versions, ranges and remaining constraints](baseline-development-remediation.md); the earlier 19-finding receipt remains historical evidence.
