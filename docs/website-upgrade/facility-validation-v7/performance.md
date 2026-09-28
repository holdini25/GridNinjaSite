# V7 final local performance and lifecycle results

**The local preview meets the measured graphics and transfer budgets. Public rollout remains blocked by mobile LCP and outstanding physical/manual checks.** The final five-run Lighthouse medians are **2606.12970 ms on home** and **2745.77975 ms on `/demo`**, against a 2500 ms ceiling. Those are the only failures in the [performance gate summary](lighthouse.json); CLS and TBT pass on all four route/device profiles.

## Identity and measurement scope

- Production build: `w2z9veXyp4PSVzR2uzc5-`.
- Source content hash: `f34d526e2a5431c7dd63b2784f43332b8fa7dd0af5a5e689be21200e64270c3b`.
- Frozen `facility-v7`, `auto-adaptive`; Chrome **154.0.8037.58**, ANGLE Metal on **Apple M5 Pro**.
- [Page measurements](../../../build/facility/page-measurements.json): **20 completed runs**, five fresh cache-disabled contexts for home/demo at desktop and Pixel 5 browser emulation; transfer recorded through automatic viewer readiness. Separate natural 30 fps and forced 60 fps capability samples.
- Lighthouse: **20 fresh-profile runs**, five per route/profile, with the unchanged simulated throttling and release limits.
- [Compact retained evidence](performance-evidence.json) preserves provenance, original-report hashes, all 20 selected run records, lifecycle results, and transport summaries. Full ledgers/traces remain in the referenced build outputs.

The mobile graphics measurements run on the Mac GPU with mobile browser emulation. They do not measure a physical Pixel, iPhone, or other phone GPU. The final job sequence ran serially; [job results](../../../build/facility/facility-v7/final-measurement-jobs.json) preserve the performance summarizer's failing exit code. Prior startup and browser failures remain archived rather than being relabeled as passes.

## Page and graphics budgets

All 20 readiness runs pass with no recorded page errors or budget failures. Initial JavaScript is **153.1 KiB Brotli on home / 156.1 KiB on demo**, below the 180 KiB ceiling. Whole-page bytes below include the automatically loaded overview; every run records **zero rack/cooling specimen requests**.

| Profile / route | Automatic transfer, bytes | MiB | Ambient p95, median of five runs | 60 fps capability p95, median / worst run | Worst CPU p95 |
|---|---:|---:|---:|---:|---:|
| Desktop home | 972,397 | 0.927 | 34.9 ms | 18.3 / 18.4 ms | 1.1 ms |
| Desktop demo | 978,178 | 0.933 | 34.9 ms | 18.3 / 18.3 ms | 1.1 ms |
| Mobile emulation home | 943,331 | 0.900 | 35.0 ms | 18.2 / 18.3 ms | 1.0 ms |
| Mobile emulation demo | 949,112 | 0.905 | 34.9 ms | 18.3 / 18.3 ms | 1.0 ms |

Transfer is identical across the five runs within each row and below **1.5 MiB = 1,572,864 bytes**. The decoded overview remains **2,258,676 bytes = 2.259 decimal MB**, under its 2.3 MB target / 2.5 MB ceiling; decoded model size and compressed whole-page transfer are different quantities.

Ambient activity deliberately requests **30 fps**. Its p95 interval must be assessed against that requested cadence, separately from the **60 fps capability** check. All samples report zero missed-slot ratio under the scheduler's deadline rule; the latter check passes the ≤20 ms desktop and ≤34 ms mobile limits. CPU values are JavaScript update/submission measurements, **not GPU timestamp measurements**. This harness did not collect GPU timestamp samples; it did not establish whether a device API supports them.

These page runs use DPR 1: Balanced on desktop, Economy under mobile emulation. They do not establish cadence at DPR 1.5. All runs retain 39 draws, 9 materials, 35,472 rendered triangles, a 7,967,462-byte asset/environment estimate, and a 9,605,862-byte staging peak. Paused observations record **zero additional frames after settling**; hidden-frame counters are zero. The separate headed lifecycle run exercises DPR 1.25 and real hidden-tab behavior has its own E2E evidence.

### Explicit assembly downloads

The separate [specimen transfer report](../../../build/facility/facility-v7/explicit-specimen-transfer.json) passes in a fresh cache-disabled production Chrome context. No specimen loads before its explicit action; each action produces exactly one model request and reuses the existing canvas. Decoded response bytes and SHA-256 hashes match the frozen manifest, with no page or hash errors.

| Explicit action | Wire bytes | Brotli body bytes | Decoded GLB bytes |
|---|---:|---:|---:|
| Server rack | **241,208** | 240,547 | 730,672 |
| Cooling assembly | **211,670** | 211,009 | 364,456 |

Combined incremental specimen transfer is **452,878 wire bytes**. The recorded wire count uses CDP's completed-request byte total; response header bytes are not added a second time. This is a separate explicit-download result, not a whole-page, LCP, cadence, or physical-device measurement. Automatic readiness ledgers remain unchanged.

## Lighthouse: two explicit remaining failures

| Profile / route | LCP median | TBT median | CLS median | Performance score | Gate result |
|---|---:|---:|---:|---:|---|
| Desktop home | 617.31250 ms | 0 ms | 0 | 100 | Pass |
| Desktop demo | 616.69195 ms | 0 ms | 0 | 100 | Pass |
| Mobile home | **2606.12970 ms** | 144 ms | 0 | 95 | **LCP fails by 106.12970 ms** |
| Mobile demo | **2745.77975 ms** | 0 ms | 0 | 96 | **LCP fails by 245.77975 ms** |

Accessibility and best-practice scores are 100 in all four medians; automated scores do not complete manual accessibility validation. The final home result is better than the original 2758.15470 ms startup baseline, consistent with the retained header/poster experiments, but remains above the gate. The demo result also remains above it. [Startup experiments](startup-experiments.md) preserve the rejected placeholder and metadata-sharing candidates.

Lighthouse's mobile demo observation ends before the offscreen viewer loads, so its own `total-byte-weight` is smaller than the complete automatic transfer above. The budget uses the separate readiness ledger; deferral does not hide eventual 3D bytes.

## Motion and resource lifecycle

The [headed hardware lifecycle run](../../../build/facility/facility-v7/browser-validation-native.json) passes **ten open/close cycles** and **ten overview/specimen/overview cycles**, with zero reported errors or budget failures. The [returned-overview audit](../../../build/facility/facility-v7/returned-overview-resource-audit.json) checks all ten returns: 39 geometries, 5 textures, 39 draws, 9 materials, and 7,967,462 estimated bytes remain equal. Measured JS heap growth is **1,651,340 bytes** over close/open cycles and **909,640 bytes** over asset cycles, within the existing 8 MiB drift guardrail. Peak staged estimate across the complete lifecycle report is **12,128,411 bytes (11.567 MiB)**, below the 16 MiB target and 32 MiB ceiling.

Fan phase changes and irregular LED values are recorded; the sampled activity maximum is two concurrent bright lamps, within the three-lamp cap, with twelve steady status lamps. Pause, offscreen, reduced-motion, and the separately tested hidden-tab behavior stop continuing activity under their respective checks. These bounded runs and allocation estimates do not establish process/GPU memory pressure or long-term thermal stability.

The [ecosystem capture](../../../build/facility/facility-v7/ecosystem-review/report.json) passes 36 chapter states and records the ambient/story motion sequence on Metal, with zero page errors. Its [motion clip](../../../build/facility/facility-v7/ecosystem-review/motion/page@019eacdbb42ff1bf2c7d56a03c1307b2.webm) and [story contact sheet](../../../build/facility/facility-v7/ecosystem-review/story-contact-sheet.png) are visual evidence. Twelve additional mobile DPR 1.5 chapter captures pass separately; diagnostic capture DPR settings are not adaptive performance measurements.

### Sustained attempt 1: incomplete, cause unknown

The first requested 900-second Chrome run ended after an unexpected page closure at approximately **485 seconds**. The [original failed report](../../../build/facility/facility-v7/sustained-attempt-1/sustained-chrome-m5.json) is preserved. It records no application error or `page-crash` event; that absence does **not** establish an external or user cause. The cause remains unknown.

The last sample retained 39 geometries, 5 textures, 9 materials, 7,967,462 estimated bytes, DPR 1.5 / High, zero hidden frames, and a 30 fps request. Its reported interval p95 was 41.6 ms; the partial run is not a sustained performance pass. It remains archived alongside the completed second attempt below.

### Sustained attempt 2: 15-minute M5 Pro Chrome pass

The [second native Chrome report](../../../build/facility/facility-v7/sustained-chrome-m5.json) passes on the same final source/build identity: **900.050659 seconds**, **892 samples**, and **14 interaction checks**, with no errors. All recorded closure events belong to intentional cleanup after completion.

| Measure | Completed run |
|---|---:|
| Requested ambient cadence | 30 fps |
| Cadence summary p95 | 35 ms |
| CPU p95 across sampled rolling p95 values | 0.9 ms |
| Maximum rolling missed-slot ratio | 0.00826446, approximately **0.83%** |
| Interaction input-through-frame p95 | 33.959 ms |
| Hidden frames | 0 |
| Constant resource counts | 39 geometries / 5 textures / 9 materials |
| Constant asset/environment estimate | 7,967,462 bytes |
| Maximum staging estimate | 9,605,862 bytes |

The tier moves from Balanced at DPR 1.25 to High at DPR 1.5 after stable visible performance. The final presentation clock is 900.4576 active seconds. This demonstrates sustained behavior on this M5 Pro/Chrome run, while Safari and physical-phone behavior remain separate requirements.

Before and after the run, `pmset` reports **no recorded thermal warning level, no recorded performance warning level, and no recorded CPU power status**. These are limited operating-system observations, not measured temperature or energy consumption, and do not guarantee the absence of thermal effects. GPU timestamp samples were not collected by the harness.

## HTTP/2/Brotli diagnostic

The [transport comparison](../../../build/facility/facility-v7/transport-comparison.json) passes **20 paired replays**: all decoded lengths and SHA-256 hashes match between actual HTTP/1 production responses and the local HTTP/2/Brotli proxy. Five pairs run per observed route/profile request set.

| Request set | HTTP/1 encoded payload | HTTP/2/Brotli encoded payload | Median replay time, HTTP/1 / HTTP/2 |
|---|---:|---:|---:|
| Desktop home | 959,671 B | 918,348 B | 22.45 / 40.84 ms |
| Mobile home | 930,605 B | 889,282 B | 20.34 / 39.72 ms |
| Desktop demo | 964,694 B | 923,637 B | 27.44 / 45.43 ms |
| Mobile demo | 935,628 B | 894,571 B | 26.49 / 45.64 ms |

Brotli reduces these payloads by 41,323 bytes for home and 41,057 for demo. The proxy replay is slower here and includes TLS setup, an extra local hop, and dynamic quality-5 compression. These are **Node loopback payload replays**, excluding headers/TLS/framing and browser parsing, execution, scheduling, rendering, and throttling. Device labels identify request sets only. This diagnostic does not replace LCP, the browser whole-page transfer ledger, or deployment/CDN measurements.

## Outstanding release work

- Resolve both mobile LCP misses under the unchanged gate; keep matched source/build evidence.
- Complete native Safari and physical-phone sustained validation; the M5 Pro/Chrome 15-minute run is complete and passing, with its earlier incomplete attempt preserved.
- Complete manual Safari/VoiceOver and the remaining Simulator/native interaction checks described in [Simulator review](simulator.md).

Public deployment remains gated. `poster`, `manual`, `auto-desktop`, and `auto-adaptive` rollback modes remain available.
