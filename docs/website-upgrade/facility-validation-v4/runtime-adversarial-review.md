# Facility-v4 runtime adversarial review

Reviewed 23 September 2026. This records code review and focused regression evidence; it is not an assertion that every public-release gate has passed.

## Concrete defects found and corrected

| Finding | Correction and evidence |
| --- | --- |
| Native animation-frame methods were passed without their `window` receiver, producing `Illegal invocation`. | Scheduler adapters call the native methods through `window`; the native browser campaign subsequently rendered successfully. |
| Pause could retain a previous 750 ms interaction boost after highlights settled. | Pause/reduced-motion changes clear that boost, snap highlights, steady LEDs and freeze rotors. Browser checks observe no continuing frames after settling. |
| Mobile startup lacked its stationary probe; opened specimen poses could keep equipment moving. | Mobile begins with a two-second stationary rendering probe. Cutaway/service poses suppress equipment activity. The frame owner still permits a finite camera/pose transition. |
| Clamping accepted frame time hid severe overload from adaptation. | The scheduler uses actual accepted visible elapsed time, resets its timestamp across inactivity, and evaluates a bounded time window. A 5 fps regression detects overload without waiting for 120 samples. |
| A timer scheduled only 2 ms before the next frame deadline could miss a display refresh slot when the timer woke late. The native `/demo` 60 fps capability run recorded 24.9 ms p95 against its unchanged 20 ms gate, with CPU submission p95 of 0.6 ms. | Replaced the timer-to-RAF handoff with one RAF owner that gates draws against cadence deadlines. Jittered 30/60/120 Hz regressions include a 6 ms timer delay and a 200 ms display-callback stall. Real accepted intervals remain unmodified; there is no catch-up burst. The raw failed campaign is preserved at `build/facility/facility-v4/cadence-before-fix.json`. The final corrected five-run campaign records desktop capability p95 of 17.2–18.3 ms; its raw intervals and separate 30 fps cadence evidence are retained. Low CPU time alone does not prove every observed delay came from the scheduler. |
| A fixed 0.5 ms deadline slack still rejected slightly early ProMotion callbacks, creating avoidable 25/8 ms accepted-frame pairs. | The scheduler selects the nearest observed display slot using a conservative smoothed refresh interval. Its cadence deadline and raw measured intervals remain unchanged. Recorded native RAF traces replay at 17.9–18.2 ms p95 at 60 fps; [raw callbacks](cadence-raw-native.json) and [replay](cadence-replay-after-fix.json) are retained. |
| Missed-frame ratios counted a long stall as one late sample rather than all lost requested slots. | Policy and diagnostics share a slot-weighted ratio: sum `max(1, round(interval × requestedFps / 1000))` expected slots and their missed slots, excluding zero initial intervals. Tests preserve the two-window demotion rule, promotion cooldown and independent three-stalls-over-100-ms rule. |
| Repeated dirty/input requests could bypass the new cadence deadline. | Moving sessions honor the same deadline even during a 120 Hz input stream. Still sessions retain immediate coalesced input rendering. A regression issues two requests on every display frame and verifies the 30/60 fps caps and single pending callback. |
| A new quality tier inherited the preceding tier's slow samples. Healthy economy frames could therefore cause an immediate second demotion to still. | Tier changes reset the measurement ring and window age, retaining the bounded tier history. A regression verifies that healthy economy frames do not inherit the previous tier's overload. |
| A viewport resize during an asset download or camera/pose transition could commit a stale aspect ratio. | Async staging reads current dimensions. Camera frames retain padded content extents; resizing refits transition endpoints, the current frame and the rollback frame. A component regression covers delayed initial/specimen loads, mid-pose resize and repeated aspect changes without cumulative zoom. |
| A DPR tier change reset the orthographic frustum to CSS-pixel extents. The first sustained trial captured a change from approximately ±8 world units to ±352 at 53 seconds. | The authored camera takes explicit ownership of projection through R3F's manual-camera contract. A regression exercises the installed R3F DPR-update path; the sustained harness compares every overview frustum against its authored baseline. The interrupted trial is retained as `build/facility/facility-v4/sustained-interrupted-before-camera-fix.json`. |
| The initial route index did not traverse authored internal port connections. | Selection uses a bounded port adjacency graph and BFS over external routes and explicit internal links. Adjacent supply/return ports are not implicitly joined. |
| Indicator activity lacked the required bounded distribution, and metadata accepted empty topology or invalid specimen part counts. | Activity uses a seeded shuffled bag with rack-repeat protection, 36 activity lamps plus 12 steady lamps, and two trace slots; ambient traces exclude storage. Runtime parsing rejects empty equipment/port/route inventories and specimen counts outside four–six parts. |

The separate responsive visual review found that mobile assembly controls could scroll the stage offscreen. The renderer correctly stopped drawing, but the requested view could not present before its deadline. The experience implementation now reveals the stage for explicit inspection/view/retry actions. This UI correction is covered separately by the [engineering browser tests](../../../tests/e2e/facility-engineering.spec.ts); offscreen rendering remains disabled.

## Ownership and compatibility checks

- [Asset loading](../../../src/lib/facility/asset-runtime.ts) owns parser resources, detached proxies, cloned materials/geometries, instance buffers and shared image bitmaps. Abort rejects promptly; late parser completions remain attached to that owner and are disposed once.
- [Replacement staging](../../../src/lib/facility/render-session.ts) shares the session environment and counts both models during staging. Failed candidates are disposed; the prior model is retained until a replacement frame is presented. Teardown cancels pending work and disposes remaining models/environment.
- The v4 scheduler has one RAF owner, coalesced dirty frames, no hidden-time catch-up, and explicit preference guards. While moving it checks display frames but renders only at the requested cadence; paused/hidden sessions retain no scheduled callbacks after settling. Diagnostic capability probes may bypass automatic still fallback, but cannot override Pause, reduced motion or equipment-off.
- Profiles without `engineering` retain the legacy renderer and initial equipment defaults. Focused tests protect the old fan phases, LED dimensions/colors and ownership behavior.
- Topology validation checks unique dense identities, authored endpoints, path lengths, service consistency and explicit internal links. Geometry, selection and animation remain illustrative; they do not compute assessment quantities.

## Focused verification

The final runtime and camera changes passed **36 focused tests across five files**, clean focused ESLint and full TypeScript checks. The complete production build then passed **448 tests across 45 files**, full lint and type checking:

- [Engineering runtime](../../../tests/unit/facility/engineering-runtime.test.ts): activity bounds, display-aligned cadence, slot-weighted adaptation, severe overload, per-tier reset, pause/probe policy, topology and semantic material bindings.
- [Camera ownership regression](../../../tests/unit/facility/camera-ownership.test.ts): actual R3F store DPR promotion/demotion and portrait resize preserve the authored world-space frustum.
- [Resize component regression](../../../tests/unit/facility/engineering-resize.test.tsx): delayed staging and transition races without restarting the renderer or transfer.
- [Asset ownership](../../../tests/unit/facility/asset-runtime.test.ts): legacy defaults, aborts, late resources, failure paths and exactly-once disposal.
- [Staging ownership](../../../tests/unit/facility/render-session.test.ts): model/environment cleanup and replacement allocation checks.

Separate [failure](../../../tests/e2e/facility-failures.spec.ts), [visibility](../../../tests/e2e/facility-visibility.spec.ts) and [engineering](../../../tests/e2e/facility-engineering.spec.ts) suites exercise browser behavior. Their final campaign results and production measurements must be read with their recorded build provenance.

## Evidence limits

- CPU submission duration measures application/renderer work on the CPU; it is **not GPU execution time**. RAF cadence and missed deadlines measure delivered timing, not power consumption.
- Estimated asset/environment bytes are **not total browser-process memory**. Browser heap and retained GPU resource counts provide additional evidence but do not account for every browser/driver allocation.
- An early snapshot can include the finite startup/interaction boost. The final harness waits for steady 30 fps operation and resets sampling before collecting its ambient window. Fixed-cadence capability is measured separately. LED activity is sampled across 24 event-window observations, avoiding the false assumption that two arbitrary stills must differ.
- Automated browser/emulated-device results do not establish sustained physical-device comfort or VoiceOver/Safari acceptance. See the remaining [manual and physical-device gates](manual-release-gates.md). Passing local runtime checks does not waive transfer, startup-performance or public-release gates.

## Capability measurement correction

The first five-run campaign requested 60 fps on desktop but only 30 fps in the mobile capability probe. Its two recorded mobile p95 values of 34.1/34.2 ms remain failures of that campaign; no intervals were rounded or waived. A 30 fps limiter has a 33.333 ms floor and cannot demonstrate spare rendering capacity. The corrected campaign requests 60 fps on both profiles while preserving the original desktop ≤20 ms and mobile ≤34 ms capability limits. Normal ambient operation remains at 30 fps and is evaluated separately against its actual requested slots. Both raw cadence and capability results are retained. This correction does not claim that the earlier 30 fps timing jitter improved.

The measurement harness now records its exact failing phase, renderer snapshot, document/stage visibility, motion controls and browser errors. It explicitly reveals the stage before sampling. The earlier four 12-second ambient-sampling timeouts lacked those diagnostics and remain unresolved historical failures rather than being assigned a speculative cause.
