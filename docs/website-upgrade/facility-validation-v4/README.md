# Facility v4 release evidence

**Local implementation and preview completed; public release is not approved.** The recorded campaign is complete. Remaining gates are simulated mobile startup performance and physical/manual acceptance. Assessment records remain authoritative; the facility and both assemblies are representative synthetic illustrations.

## Delivered experience

- Black-metal overview with 48 instanced amber lamps, independent fan phases, authored connection traces, and coherent system/equipment selection.
- `/demo` system close-ups, width expansion, synchronized authored connection diagram, and two explicitly loaded hollow assemblies with closed, cutaway and service poses.
- Four manually advanced assessment steps derived from the existing records, preserving A–D, fixture D’s unknown quantities and exact versioned publications.
- One graphics session and visible-time scheduler, adaptive rendering tiers, tab-session preferences, explicit retry and reversible release modes.

## Verification completed

- **448 unit tests across 45 files** pass; lint, TypeScript and the production build pass.
- Initial JavaScript is **147.8 KiB Brotli home / 150.9 KiB demo**, below the 180 KiB ceiling. Demo exceeds the separate 150 KiB warning level.
- Twenty fresh route/device measurements pass automatic transfer and graphics gates: **1,045,645–1,083,936 bytes** through readiness, no automatic specimen downloads, and zero missed requested ambient slots in the measured windows. Fixed 60 fps capability p95 is **17.2–18.3 ms desktop / 16.8–18.2 ms mobile emulation**.
- Native M5 Pro/Metal motion and lifecycle checks pass, including ten open/close and ten overview/specimen/overview cycles.
- The **15-minute M5 Pro Chrome run** passes camera, resource and interaction assertions, with High quality sustained and constant geometry/texture counts. Its 41.7 ms p95 of sampled rolling cadence-p95 values remains visible in the sustained report; this is not a claim of uniformly delivered 30 fps or physical-phone acceptance.
- All 22 responsive visual states pass. Nine frozen release files, ten authoring inputs/masters and 32 earlier publication/visual files retain their recorded hashes.
- Browser interaction coverage includes 135 matrix executions, one native visibility case and eight later targeted regressions; see the exact build/timing limits in the interaction report.

## Remaining release gates

The unchanged simulated performance gate fails **home LCP 2,755.6 ms**, **home TBT 200.5 ms**, and **demo LCP 2,748.8 ms**, against limits of 2,500 / 200 / 2,500 ms. Faster DevTools-throttled diagnostics are retained separately. No failed sample was removed. Native Safari, physical iPhone/Android, VoiceOver, touch/zoom and manual flash review remain required. See [the exact gates](manual-release-gates.md). No public deployment was performed.

## Evidence map

| Evidence | Scope |
| --- | --- |
| [Asset evidence](asset-evidence.md) | GLB validation, budgets, topology, normals, bakes, Blender reproduction and immutable prior bytes |
| [Interaction validation](interaction-validation.md) | Browser matrix, assessment integrity, automated accessibility and mobile inspection regressions |
| [Runtime adversarial review](runtime-adversarial-review.md) | Concrete defects fixed, resource ownership, graph semantics and regression tests |
| [Startup investigation](startup-investigation.md) | Saved traces, exact simulated dependency and unsuccessful startup experiments |
| [Manual release gates](manual-release-gates.md) | Native Safari, physical mobile, VoiceOver and manual acceptance still required |
| [Build provenance](build-provenance.json) | Exact source revision, production build and registered releases |
| [Native graphics report](browser-validation-native.json) | Actual M5 Pro/Metal, fixed-cadence capability, motion and repeated lifecycle checks |
| [Twenty route/device measurements](page-measurements.json) | Complete automatic transfer, ambient cadence, separate capability probes and Pause checks |
| [Explicit specimen transfer report](specimen-transfers.json) | Separate click-triggered downloads; no automatic specimen requests; cached Overview returns |
| [Sustained native session](sustained-validation.md) | Fifteen-minute result, cadence variation, interaction latency, memory and thermal limits |
| [Combined performance gates](lighthouse.json) | Matching five-run route/device evidence and retained startup failures |
| [Responsive visual report](visual-review/report.json) | Final scene states and resize-during-load/transition checks |

## Inspect the visuals

- [Overview and four selected states](contact-sheet.png)
- [Both assemblies and all six poses](specimen-contact-sheet.png)
- [Desktop rack service view at DPR 1.5](visual-review/desktop-rack-service.png)
- [Mobile cooling service view at Economy DPR 1](visual-review/mobile-cooling-service.png)
- [Twelve-second native overview activity clip](overview-activity.webm)
- [Native browser motion and lifecycle clip](native-inspection-motion.webm)

The responsive review contains 22 captures: eleven desktop views at actual drawing DPR 1.5, and eleven mobile-emulation views at Economy DPR 1. The original poster/contact-sheet capture is DPR 1. Mobile follows its approved quality ceiling; a physical high-DPR display does not imply an equally high drawing-buffer ratio. These screenshots are appearance evidence, not physical-device comfort results.

## Reproduce and roll back

Use the commands and editable-source paths in [the release runbook](../facility-v4.md). Local preview is `http://127.0.0.1:3000/` and `/demo`. No public deployment was performed.

`FACILITY_3D_MODE=poster`, `manual`, or `auto-desktop` provides rollback/restricted activation without changing assessment content. `auto-adaptive` is the v4 local preview mode. Earlier visual releases remain immutable and registered.
