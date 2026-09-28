# Facility v6 narrative and interaction review

Reviewed 23 September 2026. This is a source audit of the experience integration, not a production browser or physical-device certification. The read-only audit found no assessment/narrative authority defect. A subsequent production playback failure exposed a viewport interaction defect, documented below; source review alone did not establish browser correctness. Final production measurements and release gates are recorded separately.

## Authoritative facts

The source remains [assessment fixtures](../../../../src/content/assessments/fixtures.ts), validated before reaching `AssessmentExplorer`. Every increment is additional to the **20.0 MW reference**, at the same fictional facility meter, over **22 September 2026, 00:00–01:00 UTC**. The assessment window is one hour; the story's 24 seconds are presentation time.

| Fixture | Requested | Modeled eligible | Screen | Revision / minimum |
| --- | --- | --- | --- | --- |
| A | 5.0 MW | 5.8 MW | ALLOW | Unchanged request; operational and commercial review still required. |
| B | 7.0 MW | 5.8 MW | REPAIR | Proposed 5.8 MW revision; commercial viability requires review; minimum unspecified. |
| C | 7.0 MW | 5.8 MW | REJECT | Stated 6.5 MW minimum prevents an admissible revision. |
| D | 5.0 MW | Unknown | NO-PROOF | Missing cooling evidence; no favorable result, revision or attribution chart. |

All examples are synthetic. Economics are unestimated; operational authority is none; accepted and delivered capacity are not applicable. Workload placement, ramp, rebound and transitions are not modeled. The authored A–C attribution remains sequential: 12.0 → 10.0 → 8.5 → 7.3 → 5.8 MW. These reductions are not independent equipment bounds or a diagnosis of one limiting asset.

## Verified source invariants

- [AssessmentExplorer](../../../../src/components/assessment/assessment-explorer.tsx) owns scenario, publication version and perspective. The inspector receives its validated record and cannot write assessment quantities, conclusions or downloads.
- [Narrative selectors](../../../../src/lib/facility/ecosystem-narrative.ts) derive every displayed result and comparison from the record. The chosen rack is an inspection anchor; no portion of the whole-facility request is assigned to it. Only B receives the recorded-revision comparison.
- The runtime receives rack identity and a cooling-evidence flag, not MW or capacity values. D stops playback at the cooling chapter; manual chapter navigation can continue to its unknown result and exact evidence publication. Missing evidence is not supplied by geometry or activity.
- Storage remains illustrative. Its selected explanation states **“Contribution and duration unassessed.”** The narrative does not invent battery discharge, duration, reserve contribution or a Storage binding constraint.
- [Publication selectors](../../../../src/lib/assessment/selectors.ts) preserve `/evidence/assessments/demo-01-{a|b|c|d}/v1.0.0` and the corresponding versioned PDF/JSON download routes. No mutable publication alias is substituted.
- [Presentation integration](../../../../src/components/facility/facility-inspection.tsx) separates committed selection, hover/focus preview and story state. Committed model/system/equipment/route/part/view actions exit the story. Scenario, history, perspective and reset changes invalidate its presentation while retaining explicit Pause/equipment preferences.
- Manual commands increment `revision`; seeks additionally increment `seekRevision`. Pause/resume retain the cursor. Generation and revision guards reject stale checkpoints. Playback respects reduced motion, global Pause, equipment-off and adaptive Still.
- [Connection controls](../../../../src/components/facility/facility-engineering-controls.tsx) use a separate story overlay matching the authored partial itinerary. Electrical, air and water have text/pattern distinctions. Open-room air and coil heat transfer are described as relationships, not fabricated duct edges or joined fluid circuits.

## Static and unavailable-graphics content

[The HTML story](../../../../src/components/facility/facility-ecosystem-story.tsx) supports all six manually selected chapters in poster/failure states; Play explains why motion is unavailable. A native `noscript` disclosure contains all six chapters, B's recorded comparison and exact publication links. The assessment caption, current record and synthetic/no-authority scope remain readable independently of graphics. v1–v5 retain their existing walkthrough.

## Evidence boundaries and regression coverage

Relevant checks are [narrative/diagram parity units](../../../../tests/unit/facility/ecosystem-narrative.test.ts), [presentation component units](../../../../tests/unit/facility/facility-inspection.test.tsx), [interaction reducer units](../../../../tests/unit/facility/interaction.test.ts), and [ecosystem E2E cases](../../../../tests/e2e/facility-ecosystem.spec.ts). They cover A–D facts, unchanged captions/links, D missingness, partial-route parity, manual selection exits, revision guards, reset/preferences, reduced motion, graphics failure, no-JS content and keyboard focus.

Earlier development verification recorded **51 passing focused unit tests** in `build/facility/facility-v6/experience-unit.log`. The [explicit-Play regression log](experience-play-regression.log) records **three passing Chrome repeats** after correcting post-click scroll anchoring. These are development-preview results, not final production performance measurements. Failed candidate attempts remain documented in [attempt history](attempt-history.json); this audit did not rerun browsers or claim physical-device/VoiceOver acceptance.

### Subsequent production Play regression

The initial production E2E run still reproduced an offscreen Play stall. Its retained trace showed the viewport at scrollY 718 when Play committed, 880 approximately 110 ms later, and 1123 approximately 366 ms later. The stage was initially visible, so the conditional post-paint reveal could return before the pending smooth focus scroll carried it offscreen. Offscreen rendering suspension then correctly stopped presentation time.

The bounded fix makes explicit Play/Replay unconditionally settle that pending viewport scroll with one instant stage alignment after two paints. Pause cancels the pending callback; manual chapter reading and runtime checkpoints do not scroll. The existing generic inspection reveal remains conditional. The updated regression covers an already-visible stage and Replay. **51 focused units and scoped ESLint passed** (`experience-instant-alignment-unit.log` / `experience-instant-alignment-lint.log` under `build/facility/facility-v6`).

Production build **`1yMc5StJM4uWFaZNekBgW`**, source **`67bc137f1fa5`**, then passed **three Chrome regression repeats** in 32.1 seconds (`experience-instant-alignment-production.log`). A separate focused Play/Replay diagnostic kept the stage fully visible after both actions (top 86.0625 px, scrollY 718, visible ratio 1); both stopped at D chapter 2 at exactly eight presentation seconds, with zero page errors. Viewport/runtime samples are retained in `experience-instant-alignment-diagnostics.json` and its accompanying log. These focused production checks verify the viewport regression; they do not replace the full release suite, performance budgets or physical-device/manual-accessibility gates.
