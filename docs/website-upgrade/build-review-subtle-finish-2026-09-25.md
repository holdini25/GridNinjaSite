# GridNinja build review and subtler material refinement

25 September 2026 · qualification09 · local preview only

[Open the portable Data Analytics report](../../build/qa/build-review-20260925/analytics/gridninja-build-review.html).

## Decision

**The scoped upgrades and local automated qualification are complete. Public release is not approved.** The current candidate passes its local software, required Chromium/WebKit, graphics, transfer and median startup checks. Premium visual craft remains 2/3 against the intended 3/3 standard. Native, physical-device, independent accessibility, hosted configuration and delivery/recovery evidence remain outstanding.

Authoritative ledger: [candidate09.json](../../build/qa/premium-release-01/qualification09/candidate09.json). Source `f178a8df986be728837929a12d2654c7babf2f6bf66bd51d7ff56952c0e80e83`; build `vIUXJHE3Dnk_bkAhhDijr`. Selected private release `facility-v11`, mode `auto-adaptive`, CSP enforced, local HTTP, test verification, production observability disabled. Results do not qualify production-only Analytics, Speed Insights or live verification.

## Delivered upgrades

| Finding | Implemented correction | Evidence |
| --- | --- | --- |
| Invalid release settings could silently produce a null viewer. | Build-integrated validation rejects invalid/pending selection, mismatched hashes, missing/extra assets and unsafe file entries. Graceful runtime fallback remains. | Negative build fixtures, exact build attestation and selected-release preflight. |
| Image recovery could disappear when deferred inspection mounted. | Independent poster state, two explicit retries, retry-only deadline, stable focus and no-JavaScript fallback. | Ten real Chromium/WebKit failure/recovery cases, including touch and delayed completion. |
| A completed touch could leave Explore held by CSS `:active`. | Track completed native actions without surrendering protection for a new unfinished gesture. | Instrumented failure retained; current touch regression passes. |
| Material checking assumed an obsolete atlas and fixed finish. | Pin the bake-report hash and versioned layout; validate embedded image hashes, UV regions, AO, metalness, roughness and tint. | Twelve focused adversarial tests; overview, rack and cooling exported assets pass. |
| Paint reflections were stronger than requested. | Paint roughness 0.42 → 0.45 across six authored regions. Regenerated editable masters, atlases, GLBs and matching browser posters. | Sixteen matched Metal captures and independent bounded preference review. |

The material revision preserves geometry, semantic identities, normals, UV seams, AO, metallic channels, non-paint finishes, lighting and exposure. Each GLB increased by 52 bytes from lossless image encoding. The earlier draft and qualification04/08 bytes remain archived. No previous frozen release or assessment publication changed.

## Verification on this exact candidate

| Check | Result |
| --- | --- |
| Brand, lint, TypeScript, production dependency audit and build | Pass |
| Unit invariants | 923 tests in 100 files pass |
| Isolated PostgreSQL integration | 13 tests pass; no live migration |
| Required Chromium/WebKit desktop/touch cases | 606 pass; 38 explicitly reviewed capability exclusions; zero retries |
| Focused poster failure/recovery | 10/10 pass; both browser cleanup gates pass |
| Responsive layouts | 15 captures across 320, 390, 768, 1366 and 1920 px pass |
| Lifecycle | Ten open/close and ten overview/specimen cycles pass |
| Automatic readiness | Twenty fresh contexts pass, including all automatic graphics transfer |
| Packaging | 104 frozen prior files, prior private artifacts and public files unchanged; no authoring-source leakage |

The M5 Pro Metal backend was used for actual browser rendering and required Blender GPU bakes. CPU work handled construction, export, validation and arithmetic. GPU work and final performance execution were serialized. Mobile sizes are emulation on this Mac, not physical phone evidence.

## Fresh performance

Five fresh runs per route/device. The existing gate applies to each cell median. All observations and traces are retained.

| Route | Profile | LCP median | TBT median | CLS median | Individual LCP misses / 5 |
| --- | --- | ---: | ---: | ---: | ---: |
| / | desktop | 599.033 ms | 0.0 ms | 0.000128 | 0 |
| /demo | desktop | 646.629 ms | 0.0 ms | 0.001379 | 0 |
| /assessment | desktop | 533.776 ms | 0.0 ms | 0.000000 | 0 |
| / | mobile | 2445.504 ms | 0.0 ms | 0.000000 | 1 |
| /demo | mobile | 2445.067 ms | 0.0 ms | 0.000000 | 0 |
| /assessment | mobile | 2444.836 ms | 0.0 ms | 0.000000 | 0 |

Complete automatic transfer peaks at **1,012,410 bytes** against 1,572,864. The maximum observed requested-60-fps capability p95 is **16.8 ms**; intentional 30-fps ambient cadence is evaluated separately. Peak reported allocation across these readiness contexts is **9,703,686 bytes**. Settled Pause adds zero scene frames. Initial Brotli JavaScript is 127.3 / 129.9 / 134.7 KiB for home/demo/assessment.

**Mobile startup headroom remains narrow.** Approximately 55 ms separates the current medians from 2.5 seconds. One individual home sample misses. These laboratory medians do not establish field p75 or guarantee a passing production configuration.

Overview: 35,708 triangles, 39 draw calls, nine materials, 2,371,596-byte GLB. It passes the 2.5 MB ceiling but remains above the 2.3 MB target. Rack and cooling GLBs are 760,144 and 353,348 bytes. The rack retains little allocation headroom; recover hidden geometry/buffer cost before adding detail.

## Evidence quality and retained failures

Qualification04 is the prior completed baseline. Candidates05/07 exposed recovery defects, 06 was superseded before a build, and 08 completed software checks but did not complete browser qualification. Their outcomes remain separate. No successful runs were pooled to construct qualification09.

The first09 focused recovery run passed all application assertions but failed Chrome cleanup. Diagnostic logs showed an updater-inherited pipe after Chrome had exited. The final focused run uses isolated Chrome ownership and passes cleanup. Remaining native-Chrome scripts preserve original launch flags and page assertions; a recorded harness preload closes only owned stdio readers after observed Chrome exit. No global updater/security preferences changed. Both failed attempts remain archived.

The Data Analytics companion recomputes raw medians, validates evidence hashes and identities, checks exact case partitions and reconciles requested cadence. Its data-quality checks are not additional application tests.

## Highest-yield next release work

1. **Protect startup margin in the real production configuration.** Include HTTPS, analytics and live verification in matched five-run measurements; target additional headroom without weakening current gates.
2. **Raise visible craftsmanship through local construction depth.** Benchmark stationary rail/frame and collector/flange contact receivers, exclude moving panels from static AO, and compare AO-only/final views. Improve mobile door/tray/connector framing before adding geometry. Another global gloss increase would not solve the remaining broad simplified surfaces.
3. **Complete native and physical journeys.** Restore unlocked access and complete native Safari/Simulator coverage; run supported Linux Firefox, actual compact iPhone, Android and non-Apple GPU, sustained activity, independent screen readers and the agreed visitor tasks.
4. **Prove inquiry operation end to end.** Use an explicitly authorized staging origin/recipient and named primary/backup operators. Observe durable receipt → provider acceptance → signed recipient delivery → operator acknowledgement; rehearse outages, retention and rollback.
5. **Obtain independent final craft and release decisions.** The current subtler-shine review approves a modest preference adjustment. It does not change the core 2/3 craft score or substitute for final human/device evidence.

## Reproduction and preview

The exact built preview is retained at `/private/tmp/gridninja-premium-v11-qualification09`. Its `.next/facility-build.json`, full source/dependency snapshot inventory, package lock, selected release hashes and QA harness fingerprint bind this evidence. Canonical assets remain unregistered; the canonical default remains facility-v10. The isolated candidate explicitly selects private v11 for review.

Use the saved candidate with the pinned Node/npm environment and the original selected settings. Do not relabel a rebuilt artifact with this build ID. A source, setting or asset change requires a new candidate and affected verification.

See [the final evidence index](../../build/qa/premium-release-01/qualification09/candidate09.json), [matched material captures](../../build/qa/build-review-20260925/shine-softening01/captures/report.json), [change inventory](../../build/qa/build-review-20260925/implemented-upgrades-final09.json), and [independent source review](../../build/qa/build-review-20260925/final-source-review08.json).

**No public deployment, live database migration, real outbound canary or final WCAG conformance claim was made.**

The preview at http://127.0.0.1:3000 serves this exact build: all three primary routes and twelve referenced JavaScript chunks were checked against the frozen artifact. See `build/qa/build-review-20260925/preview09.json`.
