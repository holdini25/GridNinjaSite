# Facility v7 local validation

**Status: local preview implemented; public release blocked by mobile LCP and outstanding manual/device gates.** Frozen v7 is registered and selected by default locally. Twenty final readiness/cadence runs, lifecycle checks, the 15-minute M5 Pro Chrome run, and desktop Lighthouse gates pass. Mobile Lighthouse LCP remains **2.606 s home / 2.746 s demo**, above 2.5 s. Visual evidence covers 88 scene states and 48 chapter states across original and supplemental reports. Simulator route screenshots have been reviewed; native Safari, physical-phone, and manual accessibility checks remain open. Apply the contact database migration before deployment. No public deployment is claimed.

See the [implementation and reproduction guide](../facility-v7.md), [final performance analysis](performance.md), [navigation/intake adversarial review](../facility-v7-experience-review.md), [startup experiments](startup-experiments.md), [limitations](limitations.md), and [contact migration prerequisite](../facility-v7-contact-topic.md).

## Frozen assets and measured browser allocations

Measured file values come from the frozen [manifest](../../../src/content/facility-releases/facility-v7/manifest.json), [asset validation](../../../build/facility/facility-v7/validation-freeze.json), and [browser capture profile](../../../build/facility/facility-v7/capture-profile.json). Allocation values are instrumented estimates, not direct GPU memory measurements. Browser triangles include instanced LEDs; exported visible geometry excludes those runtime instances.

| Measure | Overview | Rack | Cooling | Required budget |
|---|---:|---:|---:|---|
| GLB bytes | 2,258,676 | 730,672 | 364,456 | Overview target 2.3 MB / ceiling 2.5 MB; specimens 900/700 KB targets, 1 MB ceiling each |
| Exported visible triangles | 34,896 | 9,290 | 4,162 | Overview ≤40,000; specimens ≤24,000 / ≤18,000 |
| Browser triangles, closed | 35,472 | 9,386 | 4,162 | Includes runtime LED geometry |
| Browser draw calls, closed | 39 | 25 | 17 | ≤39 / ≤35 / ≤30 |
| Runtime materials | 9 | 8 | 7 | ≤10 each |
| Retained asset/environment estimate | 7,967,462 B | 6,258,101 B | 5,718,340 B | Specimens ≤6 MiB each |
| Peak including staging | 9,605,862 B | 12,128,411 B | 9,617,145 B | Target ≤16 MiB; ceiling ≤32 MiB |

The largest observed staging estimate is **11.567 MiB**. The rack remains only **33,355 bytes below its 6 MiB ceiling**. The PMREM environment estimate is 2,359,296 bytes (2.25 MiB), included in the reported allocations. Do not add specimen resources without rechecking this headroom.

| Approved poster | Bytes | Ceiling |
|---|---:|---:|
| Overview desktop | 39,272 | 150 KiB |
| Overview mobile | 10,206 | 150 KiB |
| Rack closed / cutaway | 10,286 / 18,336 | 60 KiB each |
| Cooling closed / cutaway | 18,774 / 19,250 | 60 KiB each |

### Frozen identities

- Manifest SHA-256: `c6ccfae472adebef0af6a8a85104be2db9f0879019babec2e297d82a9f71ce37`.
- Overview: `130a264488f722f7ba02ef328c1acb78b37638e0c8b08e519fb74927198d40c2`.
- Rack: `0561cd72dce6fdba81c4c77b7ed23d013f4ca63118d1554a7df095fcf77ae5d7`.
- Cooling: `f2ff6b526ff7825a683bbd201ed24ec60e9ac6895e9bfcd39b2bf31f13fc9d75`.
- Overview render-profile hash: `ec9c6e90e044c7dda8d5d21795d58432f1118b3a626e97474eea1901603f9b65`.

All three GLBs pass Khronos validation with **zero errors, warnings, or informational findings**. The [final provenance audit](../../../build/facility/facility-v7/final-provenance-audit.json) confirms **65 exact files unchanged**: 42 legacy visual files, 21 publication files, and two assessment content files. The separately checked visual registry changes only by appending v7; removing that entry reproduces its original bytes and hash. This is the precise final interpretation of the earlier [66-item baseline check](../../../build/facility/facility-v7/immutable-release-check.json). The [reproduction report](../../../build/facility/facility-v7/reproducibility-report.json) proves fresh-process saved-master re-export identity, not repeated full-generation/Cycles-bake determinism. The [asset adversarial audit](../../../build/facility/facility-v7/asset-adversarial-audit.json) covers fitting bounds, fan sweeps, legacy environments, allocations, and visual provenance. Four independent negative air-path fixtures are retained in [air adversarial validation](../../../build/facility/facility-v7/air-adversarial-validation.json).

## Verified local visual evidence

The original [scene review](../../../build/facility/facility-v7/review/review-capture.json) records **66 passing states** across desktop DPR 1, desktop DPR 1.5, and mobile DPR 1. The final-build [mobile DPR 1.5 supplement](../../../build/facility/facility-v7/review-mobile-dpr15/review-capture.json) adds **22 passing states**, for **88 scene states**. They cover home/demo neutral and four-system states, rack and air-path perspective details, returned Overview, and six demo specimen poses. The original 66 captures predate the final rear-row explanatory UI; their frozen model/profile identities match. They are not presented as final-source captures. The supplemental report records final production and script provenance. Both report zero page errors.

The [chapter/motion review](../../../build/facility/facility-v7/ecosystem-review/report.json) adds **36 passing chapter states**; its separate [mobile DPR 1.5 supplement](../../../build/facility/facility-v7/ecosystem-review-mobile-dpr15/report.json) adds **12**, for **48 chapter states**, with zero page errors. The primary chapter report includes the ambient/story motion recording. Supplementary still passes do not collect additional motion evidence.

- [Five-state overview contact sheet](../../../build/facility/facility-v7/contact-sheet.png).
- [Specimen contact sheet](../../../build/facility/facility-v7/specimen-contact-sheet.png).
- [Desktop rack detail](../../../build/facility/facility-v7/review/demo-desktop-dpr1.5-detail-rack.png).
- [Desktop air-path detail](../../../build/facility/facility-v7/review/demo-desktop-dpr1.5-detail-air-path.png).
- [Mobile overview](../../../build/facility/facility-v7/review/home-mobile-dpr1-neutral.png).
- [Browser poster/profile/hash evidence](../../../build/facility/facility-v7/capture-profile.json).

These captures use Chrome 154.0.8037.58 and bounded diagnostic DPR overrides. They verify still composition, matching model/profile identities, material response, selected states, 32° perspective projection, and measured asset budgets. Still captures **do not provide frame-time evidence**; cadence and motion measurements are recorded separately in [performance](performance.md).

## Source, test, and packaging checks

The final production application is attested as **build `w2z9veXyp4PSVzR2uzc5-`**, source revision **`f34d526e2a5431c7dd63b2784f43332b8fa7dd0af5a5e689be21200e64270c3b`**. Source revision is the build's content hash. The [build log](../../../build/facility/facility-v7/final-build.log) records successful compilation, prerender and deployment-trace checks, seven available visual releases, and that identity. Final transfer, cadence, lifecycle, sustained Chrome, Lighthouse, and transport reports are bound to this build. The harness did not collect GPU timestamp samples; physical/manual checks remain open.

| Check | Recorded result | Evidence and limits |
|---|---|---|
| Lint and typecheck | Pass | [Final lint](../../../build/facility/facility-v7/final-lint.log), [final typecheck](../../../build/facility/facility-v7/final-typecheck.log) |
| Unit suite | **584 tests / 59 files pass** | [Final unit log](../../../build/facility/facility-v7/final-unit.log); includes regressions added after the earlier 546-test and 146-test targeted runs |
| Broad production Chrome E2E | **42 pass, 3 skip, 1 stale atlas assertion fails** | [Original final run](../../../build/facility/facility-v7/final-e2e-chrome.log). The assertion assumed the older atlas's white cells and was corrected for the authored v7 material regions; this was a verifier correction. |
| Material rerun after assertion correction | **2 pass** | [Material rerun](../../../build/facility/facility-v7/final-material-e2e.log). Resolves the previous failure; one of these tests overlaps the broad run, so these counts must not be summed as unique tests. |
| Perspective picking / rear-rack explanation | **4 pass** on targeted rerun | [Picking validation](../../../build/facility/facility-v7/picking-review/picking-validation.json): real model picking before/after resize, gesture cancellation, selected-target retention, and explicit representative-assembly activation. First attempt's input-timing failure remains archived. |
| Actual hidden-tab activation/frame freeze | **1 pass** | Same [validation record](../../../build/facility/facility-v7/picking-review/picking-validation.json), isolated headed Chrome/CDP context; hidden time is not replayed. |
| Mobile Chrome and WebKit E2E | **48 pass** | [Final mobile log](../../../build/facility/facility-v7/final-e2e-mobile.log). Browser emulation/WebKit evidence, not physical-phone or native Safari/VoiceOver validation. |
| GLB/package freeze and deployment traces | Pass | [Final packaging log](../../../build/facility/facility-v7/final-packaging.log), [production build log](../../../build/facility/facility-v7/final-build.log), and [final provenance audit](../../../build/facility/facility-v7/final-provenance-audit.json) |
| Contact database migration | Additive nullable-topic migration and unit coverage provided | Not applied; deployment prerequisite |

These are per-run results, with intentional overlap; no aggregate unique E2E count is claimed. The three skipped checks are not counted as passes. The [archived atlas assertion failure](../../../build/facility/facility-v7/final-e2e-attempt1/), [picking first attempt](../../../build/facility/facility-v7/picking-review/test-attempt-1/), earlier startup regressions, and the [original experience regression](../facility-v7-experience-review.md) remain available beside the successful reruns. The prior 66-state capture review remains valid asset/composition evidence; it does not replace final cadence or sustained-runtime measurements.

## Final production measurements and remaining gates

The [performance report](performance.md) distinguishes hardware-backed Mac browser measurements, mobile emulation, simulated Lighthouse, and transport-only diagnostics. [Compact JSON evidence](performance-evidence.json) retains all 20 run summaries and original-report hashes; [Lighthouse evidence](lighthouse.json) preserves the two failing mobile gates. Prior failed attempts remain available.

| Gate | Target | Current status |
|---|---|---|
| Initial route JavaScript | ≤180 KiB Brotli | **Pass:** home **153.1 KiB**, demo **156.1 KiB** in the attested final build; both exceed the nonblocking 150 KiB review warning |
| Complete automatic transfer through readiness | ≤1.5 MiB, including mobile | **20/20 pass:** desktop home/demo 972,397 / 978,178 B; mobile emulation 943,331 / 949,112 B |
| Explicit specimen transfer | Separate report; no automatic specimen bytes | **Pass:** rack **241,208 wire B**, cooling **211,670 wire B**; one request per explicit action, decoded hashes match, same canvas. Zero automatic specimens in all 20 readiness runs; [report](../../../build/facility/facility-v7/explicit-specimen-transfer.json) |
| Fixed-cadence capability p95 | Desktop ≤20 ms; mobile ≤34 ms | **20/20 pass:** worst desktop 18.4 ms, worst mobile emulation 18.3 ms; Mac Metal hardware, DPR 1 |
| Deliberate ambient cadence | Compare delivered cadence with requested 30 fps | **Pass:** median per-run p95 34.9–35.0 ms; zero scheduler missed-slot ratio; CPU p95 ≤1.1 ms |
| LCP / CLS / TBT | LCP ≤2.5 s, CLS ≤0.1, existing TBT limits | **LCP fails only on mobile:** home 2606.12970 ms, demo 2745.77975 ms. Desktop LCP passes; all median CLS = 0 and TBT passes (mobile home 144 ms, others 0) |
| Lifecycle/resource stability | Ten open/close and ten overview/specimen cycles; bounded retained allocation | **Pass:** ten of each; returned overview counts/estimated allocation equal. Peak staged estimate 11.567 MiB; JS heap drift within guardrail |
| Loading failures and context loss | Timeout, stale completion, retry, navigation, and context-loss suite | Final automated Chrome/mobile suites pass applicable checks; skipped checks remain explicitly unverified |
| Keyboard/axe/reflow | Production accessibility and interaction checks | Automated checks recorded in final E2E; Lighthouse accessibility 100 in all profile medians. Native Safari/VoiceOver/manual interaction remains open |
| Sustained operation | 15-minute native/device runs | **M5 Pro Chrome pass:** 900.050659 s, 892 samples, 14 interactions; 35 ms cadence p95, 0.9 ms CPU summary p95, ≤0.83% rolling missed slots, constant resource counts, zero errors/hidden frames. [Completed report](../../../build/facility/facility-v7/sustained-chrome-m5.json). Earlier ≈485 s closure remains [preserved, cause unknown](../../../build/facility/facility-v7/sustained-attempt-1/sustained-chrome-m5.json). Safari/physical-phone checks remain open |

The [matched startup experiments](startup-experiments.md) retain corrected poster acquisition and the static header/logo boundary, and reject metadata sharing. Final mobile LCP still exceeds 2.5 seconds. The HTTP/2/Brotli diagnostic passes twenty paired decoded-hash comparisons, but is a Node payload replay and does not replace browser timing or whole-page budgets. Native Mac rendering performance and Simulator responsiveness do not waive the unchanged simulated Lighthouse gate.

## Simulator, physical-device, and manual boundaries

**Simulator Safari route-load and screenshot review is complete within a limited CLI scope.** The [Simulator report](simulator.md) records Xcode 27.0 / iOS 27.0, the final production identity, home and Cooling-focused demo captures on iPhone 17e, iPhone 18 Pro Max, and iPad mini, and a successful iPhone 17e home retry. Loaded captures show live 3D controls, the graphite facility, responsive composition, and unchanged B quantities where visible. The first iPhone 17e home capture showed blank Safari loading UI at 14 seconds; the 30-second retry loaded successfully. Both are preserved, and the cause is unproven. Three requested nine-second recordings remain unanalyzed for motion timing.

Commands used a per-command developer directory, left global settings unchanged, and ran one simulator at a time. Native touch, orientation, keyboard, zoom, VoiceOver, and Safari Web Inspector console/network/timeline inspection were unavailable through this session's computer-use surfaces. Those interaction/manual gates remain open. The old v6 baseline image is not v7 evidence.

Native macOS Safari/VoiceOver, physical iPhone Safari, midrange Android Chrome, and sustained 15-minute device runs remain separate public-release gates. Simulator Safari and emulated mobile Chrome do not establish physical-phone GPU performance, energy use, temperature, memory pressure, native touch, or VoiceOver behavior. Record actual observations without substituting emulation for missing hardware.

The completed native Chrome run promoted from Balanced/DPR 1.25 to High/DPR 1.5 and retained 39 geometries, 5 textures, 9 materials, and 7,967,462 estimated bytes. `pmset` before/after reported no recorded thermal/performance warning level and no CPU power status. It did not measure temperature or energy, and provides no guarantee about thermal behavior. See the [sustained interpretation](performance.md#sustained-attempt-2-15-minute-m5-pro-chrome-pass).

## Editable deliverables and rollback

[Overview Blender master](../../../assets-source/facility/facility-master.blend) · [Rack master](../../../assets-source/facility/rack-specimen.blend) · [Cooling master](../../../assets-source/facility/cooling-specimen.blend) · [Authoring/export guide](../../../assets-source/facility/README.md).

Keep `poster`, `manual`, `auto-desktop`, and `auto-adaptive` modes available. The default local setting is frozen `facility-v7` with `auto-adaptive`; public rollout requires the final gates above and the [contact migration prerequisite](../facility-v7-contact-topic.md). Previous release bytes remain immutable.
