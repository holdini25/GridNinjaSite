# Fifteen-minute native M5 Pro session

The [raw report](sustained-chrome-m5.json) records **900.20 seconds** and **893 one-second observations** on the corrected production build. Camera, allocation, interaction and error assertions passed. This is a native Mac Chrome result, not a Safari or physical-phone result, and it does not waive the remaining startup gates.

## Conditions

- Apple M5 Pro, 48 GB unified memory, macOS 27.0, AC power.
- Chrome 154.0.8037.58, headed, native ANGLE Metal; 1440×1100 CSS viewport and device scale factor 2.
- `facility-v4`, `auto-adaptive`, build `M9e7UvRUEZ9rRvSIsWO2g`; exact source, harness and asset hashes are embedded in the report.
- No competing validation browser or build process. A process-scoped `caffeinate -di` assertion prevented idle sleep; it ended with the campaign and changed no saved power settings.
- One real system-button activation every 60 observations. The harness required its committed HTML state and a subsequent rendered frame.

## Results

| Measure | Recorded result |
| --- | --- |
| Quality | Balanced → High after 31.41 visible seconds; no demotion |
| Camera | Every observation retained the authored overview frustum, including DPR promotion |
| Resident geometry / textures | Constant 39 / 4 |
| Estimated resident asset + environment | Constant 7,412,735 bytes (7.07 MiB) |
| Estimated peak allocation | 9,051,135 bytes (8.63 MiB) |
| CPU update/submission | 0.70 ms p95 of the sampled rolling CPU-p95 values |
| Requested cadence | 30 fps ambient; finite 60 fps interaction windows |
| Delivered mean across sampled interval | 30.50 fps, including interaction windows |
| Maximum sampled lost-slot ratio | 4.76% |
| Control activation through next frame | 31.40 ms p95; 33.44 ms maximum, 14 activations |
| Hidden-frame counter / page errors | 0 / 0 |
| Browser closure | All recorded close/disconnect events followed intentional test teardown |

### Cadence variation remains visible

The report's `cadenceP95` is **41.70 ms**: the p95 of periodically sampled, rolling frame-p95 values, not an aggregate percentile of every frame. Of 887 finite rolling observations, 180 exceeded 40 ms; the maximum rolling p95 was 41.80 ms. These values include changing 30/60 fps presentation cadence and display-callback variation. They must not be relabeled as a uniformly 33.33 ms stream, GPU execution time, or a passing fixed-60-fps window.

The separate [twenty-run capability campaign](page-measurements.json) uses fixed 60 fps probes and retains the unchanged desktop ≤20 ms / mobile-emulation ≤34 ms limits. Its deliberate ambient cadence is evaluated separately against requested slots. Sustained acceptance here establishes the stated camera/resource/interaction checks; physical comfort and cross-browser cadence remain subject to the [manual release gates](manual-release-gates.md).

### Memory, energy and thermal limits

Estimated asset allocation is not total browser-process or driver memory. Repeated model replacement and open/close retention are covered by the separate [native lifecycle report](browser-validation-native.json).

Before and after the session, `pmset -g therm` reported that no thermal warning level, performance warning level or CPU power status had been recorded. No temperature, wattage, battery-drain or GPU-duration measurement is claimed.

## Reproduce

With the matching production build running and other benchmark browsers stopped:

```sh
FACILITY_BASE_URL=http://127.0.0.1:3000 caffeinate -di node scripts/facility/sustain.mjs
```

The earlier interrupted trial is retained in [sustained-interrupted-before-camera-fix.json](sustained-interrupted-before-camera-fix.json). It exposed the DPR camera-ownership defect and ended after 54 observations when the browser closed. It is not counted as a sustained pass; its closure cause was not established.
