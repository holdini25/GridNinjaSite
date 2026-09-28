# Facility v6 validation

V6 is frozen and available in the local home and `/demo` preview. No public
deployment was performed. The production build uses `facility-v6` with
`auto-adaptive` loading. Automated asset, interaction, transfer and lifecycle
checks pass. The aggregate page-performance gate fails on the two mobile LCP
medians. The 15-minute native M5 Pro Chrome run passes the sustained checks.

## Delivered experience

- A continuous authored rack exhaust circuit: rear capture spaces, collars,
  two row collectors, a right-side trunk, a common cooling return plenum and
  four front-return/upflow cooling units. Water services sit behind the bank.
- An explicit section view exposes real collector walls and intake passages.
  Open room-air return and thermal exchange are relationships, not conduit
  edges or a claimed fluid simulation.
- Coordinated rack LEDs, electrical bands, warm exhaust emphasis, water traces
  and bounded fan response. Each cooler inspection resolves its own authored
  supply and return routes; the common plenum retains its authored fan group.
- Six manually usable chapters with optional 24-second playback. Opening is
  still; hidden time does not advance it. Play/Replay settle on the model once,
  while manual chapter reading keeps the reading position.
- Record-derived A–D explanations, B's recorded comparison, and D's missing
  cooling stop. No rack-level allocation, storage contribution, reserve duration
  or operational authority is inferred from animation.

The homepage remains **7.0 MW requested / 5.8 MW modeled**, additional to the
20 MW reference, for one hour. Assessment controls, immutable publications,
approved CTAs, synthetic scope and the previous assembly inspections remain.

## Asset budgets and construction

| Asset | GLB bytes | Authored triangles | Browser triangles | Draws | Materials |
|---|---:|---:|---:|---:|---:|
| Overview | 2,333,504 | 34,672 | 35,248 | 39 | 9 |
| Rack, closed | 762,700 | 9,290 | 9,386 | 25 | 8 |
| Cooling, closed | 379,796 | 4,194 | 4,194 | 17 | 7 |

The overview adds **1,768 authored triangles**. It exceeds the 2.3 MB working
target by 33,504 bytes and passes the 2.5 MB ceiling. Its 39 draws use the entire
draw budget. All three GLBs pass independent Khronos validation with zero errors
and warnings. The desktop/mobile posters are 42,574 / 14,266 bytes; the largest
specimen poster is 16,106 bytes.

Final browser review estimates retained asset/environment allocation at
7,958,342 bytes for the overview, 6,258,101 for the rack and 5,719,236 for cooling.
Peak staged allocation is **12,119,291 bytes**, below the 16 MiB target. The rack
has only 33,355 bytes of headroom below its 6 MiB ceiling. These are owned-resource
estimates, not total browser-process or device memory.

The final asset contains 31 equipment identities, 46 routes, 108 ports, 39 branch
positions and 20 internal passages. Seventy authored air segments pass exported
geometry obstruction checks. Four adversarial GLB mutations reject for the
expected reasons. These checks establish authored construction and connectivity,
not equipment performance, installation certification or CFD.

All three saved Blender masters reproduce their final GLBs byte-for-byte in
fresh pinned Blender 5.2.2 LTS processes. This proves saved-master export
repeatability; it does not compare two independent full regeneration/bake runs.
All 32 prior v1–v5 files and their five registry entries remain unchanged. Exact
allowlists exclude source models and candidates from deployment.

## Automated verification

- **513 unit tests across 51 files pass**, with lint and full typecheck passing.
- Production build and all six registered releases validate. Initial JavaScript
  is 151.6 KiB for home and 154.4 KiB for demo, below 180 KiB Brotli.
- Eighteen isolated packaging checks pass, including concurrent-writer and
  stale source/poster rejection.
- Shader fixtures validate packed state, signed route intervals, material cache
  separation and preserved PBR maps. The actual topology uses an estimated 142
  fragment uniform vectors; staging checks the real device limit.
- The controller is tested for deterministic seeking, delayed callbacks,
  bounded LEDs/traces, pause, reduced motion, missing evidence and graph-medium
  separation. Prewarming tests cover abort, stale completion and timeout while
  retaining the old scene.
- Production Chrome Play/Replay diagnostics keep the model fully visible and
  stop D at exactly eight presentation seconds. Three focused repeats pass.
- **107 applicable production E2E tests pass** across Chrome, WebKit desktop and
  Chromium mobile emulation. Seven cases are intentionally skipped outside their
  applicable device/headed setup. This covers assessment transitions, exact
  downloads, keyboard/axe, no-JavaScript, graphics failure/Retry, stale loads,
  real context loss and repeated client navigation.
- A separate headed Chrome test passes real background-tab activation deferral
  and equipment suspension.

Final visual review captures **48 overview/assembly states**, **36 story states**
and **48 actual-asset material channel views**, with desktop DPR 1/1.5 and mobile
DPR 1. Chapter playback was recorded on the actual Apple M5 Pro Metal renderer.
The clip includes a complete ambient cycle and the 24-second story ending still.
Diagnostic DPR overrides are visual evidence, not natural adaptive performance.

## Automatic transfer and rendering

All **20 fresh-context through-readiness runs pass**, five for each route/device
pair. The collector includes automatic graphics imports, posters and model bytes;
no specimen downloads automatically. The actual renderer is Apple M5 Pro Metal.

| Route / viewport | Complete automatic transfer | Fixed-60-fps capability p95 |
|---|---:|---:|
| Home / desktop | 963,908 B | 16.7–16.8 ms |
| Home / mobile emulation | 935,600 B | 16.7–16.8 ms |
| Demo / desktop | 969,715 B | 16.7–16.8 ms |
| Demo / mobile emulation | 941,407 B | 16.7–16.8 ms |

These pass the 1.5 MiB complete-transfer ceiling and the desktop ≤20 ms / mobile
≤34 ms capability limits. Deliberate 30-fps ambient operation is measured against
its requested cadence; its p95 interval is 33.4 ms. Device emulation uses the Mac
GPU and is not physical-phone performance evidence.

Native M5 Pro lifecycle checks pass **ten open/close cycles and ten
overview/specimen/overview cycles**. Owned geometry/texture counts and estimated
allocations remain stable. After explicit garbage collection, JavaScript heap
growth is 1,674,592 bytes across close cycles and 905,112 bytes from the warmed
assembly-switch baseline, both below the bounded 8 MiB growth ceiling. This is
observed browser heap behavior, not a claim of zero process/GPU-cache growth.

The native run also verifies four independent rotor phases, sparse amber LED
activity (two simultaneous bright lamps observed, below the three-lamp cap),
steady status lamps, Pause, offscreen suspension and reduced motion. No page
errors or renderer budget failures were recorded. Exact reports include both
resource counters and equipment snapshots.

## Page-performance release gate

Twenty fresh Lighthouse profiles were collected, five per route/device pair.
The original simulated-throttling settings and thresholds remain unchanged.

| Profile | LCP median | TBT median | CLS median | Performance / accessibility |
|---|---:|---:|---:|---:|
| Desktop home | 620 ms | 0 ms | 0.0045 | 100 / 100 |
| Desktop demo | 617 ms | 0 ms | 0 | 100 / 100 |
| Mobile home | **2,756 ms — fail** | 185 ms | 0 | 93 / 100 |
| Mobile demo | **2,756 ms — fail** | 0 ms | 0 | 96 / 100 |

The aggregate validator fails only the two mobile LCP medians. One homepage
mobile TBT sample is 205 ms; it remains in the five-run set, whose 185 ms median
passes the existing 200 ms gate. Offscreen models are absent from some Lighthouse
byte totals, so the stricter complete automatic-transfer figures above are used
for the 1.5 MiB requirement.

Ten additional fresh profiles use matched **DevTools browser throttling**, with
mobile LCP medians of 1,559 ms (home) and 1,584 ms (demo), TBT 2.5 / 0 ms and CLS 0.
These diagnostics do not replace or clear the simulated release gate. All raw
reports, network logs and traces remain under `build/facility/lighthouse-*`.

## Sustained native Chrome

The homepage ran for **900.55 seconds** in headed Chrome on the Apple M5 Pro Metal
renderer, with 893 snapshots and 14 system selections. Active presentation time
advanced by 899.55 seconds between the first and last snapshots, spanning 28,093
rendered frames. Balanced promoted to High after 31.44 visible seconds and remained
there. No page errors, hidden frames, camera drift or allocation violations were
recorded; all browser shutdown events were intentional.

The maximum sampled missed-slot ratio was **1.64%**. The p95 of sampled rolling
CPU p95 values was **0.7 ms**; the corresponding cadence value was **40.9 ms**
during mixed 30-fps ambient and brief 60-fps interaction operation. This raw cadence
result is retained separately from the fixed-60-fps capability checks above.
The observed automated click-through-next-frame p95 was 33.9 ms, including test
harness overhead. Peak owned allocation remained 9,596,742 bytes.

Before and after the run, `pmset -g therm` reported no recorded thermal or
performance warning level and no recorded CPU power status. This supplies no
temperature, energy-use or battery-life measurement. The run covers native Chrome
on this Mac, not native Safari or physical phones.

## Startup investigation

Matched experiments use five fresh Chrome profiles for each mobile route, retain
all attempts and use the existing simulated Lighthouse settings.

| Candidate | Home LCP median | Home TBT median | Decision |
|---|---:|---:|---|
| V6 baseline | 2,756 ms | 232 ms | Comparison baseline |
| Inline CSS | 2,906 ms | 191.5 ms | Rejected: LCP and transfer worsened |
| Prepared shaders | 2,758 ms | 171 ms | Retained: lower blocking time |

CSS inlining added about 49 KB of transfer and worsened both route LCP medians by
about 150 ms, so it was reverted. V6 now prepares final shader programs across a
real task boundary before first presentation. It retains the poster/prior scene,
the eight-second deadline and actual first-frame readiness. This reduced the
matched homepage blocking-time median by 26.3%; it did not resolve mobile LCP.
The first fresh-profile baseline TBT sample of 1,079 ms remains in the evidence;
these runs do not claim to reset the operating system's GPU caches.

## Evidence and editable sources

- [Implementation and reproduction guide](../facility-v6.md)
- [Frozen asset audit](assets/final-audit.json)
- [Construction, topology and export evidence](assets/README.md)
- [Narrative and authority review](checks/narrative-review.md)
- [Production build](checks/production-build.log)
- [Unit checks](checks/unit.log)
- [Recorded failed/rejected attempts](checks/attempt-history.json)
- [Cross-browser results](checks/e2e-final.log)
- [Real background-tab check](checks/e2e-visibility.log)
- [Six-chapter contact sheet](visual/story-contact-sheet.png)
- [Closed, cutaway and service assemblies](visual/specimen-contact-sheet.png)
- [Native ecosystem motion recording](motion/ecosystem-native.webm)
- [Startup comparisons](performance/startup-experiments/prewarm-comparison.json)
- [All 20 automatic-transfer/cadence runs](performance/page-measurements.json)
- [Original Lighthouse release gate](performance/performance-summary.json)
- [Matched browser-throttled diagnostics](performance/throttled-diagnostics.json)
- [Native resource lifecycle and equipment checks](performance/browser-validation-native.json)
- [Full 15-minute native Chrome report](performance/sustained-chrome-m5.json)
- [Lifecycle recording](motion/lifecycle-native.webm)
- [Prior release immutability](immutability/report.json)
- [Evidence file sizes and SHA-256 hashes](evidence-inventory.json)

Editable Blender masters:

- [Overview facility](../../../assets-source/facility/facility-master.blend)
- [Representative rack](../../../assets-source/facility/rack-specimen.blend)
- [Representative cooling assembly](../../../assets-source/facility/cooling-specimen.blend)

Generation, bakes, topology export and validation scripts live beside them in
`assets-source/facility/`. Full working captures and raw traces remain under
`build/facility/`; curated reports and visuals live here.

## Public-release gates

The existing mobile LCP miss remains a release gate. Preserve LCP ≤2.5 s,
CLS ≤0.1 and the existing TBT requirements. Native Safari/VoiceOver, physical
iPhone/Safari and midrange Android/Chrome sustained runs, manual touch/zoom/reflow
and flash-threshold review remain separate requirements. Automated axe checks
and Mac browser device emulation do not replace them.

Rollback modes remain `poster`, `manual`, `auto-desktop` and `auto-adaptive`.
The local adaptive preview does not authorize public rollout or site operation.
