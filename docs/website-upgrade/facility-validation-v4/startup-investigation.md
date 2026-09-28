# Mobile startup investigation

## Final matched production measurements

The corrected build still fails **three unchanged simulated mobile gates**: homepage LCP **2,755.58335 ms** against 2,500 ms, homepage TBT **200.5 ms** against 200 ms, and demo LCP **2,748.8081 ms** against 2,500 ms. All 20 final Lighthouse gate reports completed: five fresh profiles per route and desktop/mobile configuration. Ten additional mobile DevTools-throttled reports completed against the same source, build, visual release, harness and browser. Those ten reports are diagnostics; they do not replace the simulated gate or authorize public adaptive mobile activation.

Values below are **median (minimum–maximum)** across five runs. Timings are milliseconds; CLS is unitless. Values retain up to five decimal places from the reports. Every run is retained; no sample is removed because it misses a threshold.

| Measurement | Route | LCP | FCP | TBT | CLS |
| --- | --- | --- | --- | --- | --- |
| Desktop simulated | `/` | 617.84805 (616.68145–619.06815) | 284.4543 (283.8526–287.7121) | 0 (0–96) | 0.00501 (0.00501–0.00501) |
| Desktop simulated | `/demo` | 617.7145 (615.71215–621.1906) | 285.0341 (283.8081–285.4604) | 0 (0–0) | 0 (0–0) |
| Mobile simulated | `/` | 2755.58335 (2747.5007–2756.8055) | 1204.3889 (1204.1687–1205.0395) | 200.5 (189.5–209) | 0 (0–0) |
| Mobile simulated | `/demo` | 2748.8081 (2748.5507–2759.6389) | 1205.0926 (1204.8833–1205.2054) | 0 (0–2) | 0 (0–0) |
| Mobile DevTools diagnostic | `/` | 1566.249 (1563.609–1569.324) | 1566.249 (1563.609–1569.324) | 2.759 (1.709–3.888) | 0 (0–0) |
| Mobile DevTools diagnostic | `/demo` | 1587.393 (1579.255–1589.129) | 1587.393 (1579.255–1589.129) | 0 (0–0) | 0 (0–0) |

Every simulated mobile LCP sample exceeded 2,500 ms. Homepage mobile TBT samples are **209, 191.5, 189.5, 201.5 and 200.5 ms**: three exceed 200 ms and their 200.5 ms median fails the existing gate, even though the miss is small. Both desktop LCP medians pass; FCP and CLS medians meet their existing limits. The completed collection indexes say `result: pass` to indicate successful collection, not release approval.

The corrected campaign also completed **20/20 fresh page measurements through viewer readiness**, with zero budget failures and passing transfer, asset, ambient-cadence and fixed-cadence capability checks. There are **no remaining incomplete-page or cadence failures in this campaign**. The [combined performance report](lighthouse.json) fails only the three simulated mobile metrics stated above. Its page evidence has settings hash `5030403fe4766547992f5905460f611e73a494a72144a53a5a2de553c32ea713` and the same source/build/harness/browser identity as the Lighthouse reports.

Raw final inputs are `build/facility/lighthouse-desktop/{home,demo}-{1..5}.json`, `build/facility/lighthouse-mobile/{home,demo}-{1..5}.json`, `build/facility/lighthouse-mobile-throttled/{home,demo}-{1..5}.json`, and `build/facility/page-measurements.json`. Corresponding `artifacts/` directories retain traces and network data. Lighthouse fetch timestamps span **2026-09-23T15:19:53.701Z–2026-09-23T15:25:30.205Z**.

### Matched provenance

All 30 Lighthouse reports and all 20 page measurements carry the same corrected build identity:

| Field | Value |
| --- | --- |
| Selected release / mode | `facility-v4` / `auto-adaptive` (local preview) |
| Source SHA-256 digest | `69001f26ca42e03f2116576a9bf7c124f048c5c8a60115fafbc483612520dcaa` |
| Build ID | `M9e7UvRUEZ9rRvSIsWO2g` |
| V4 manifest SHA-256 | `423237463ad87bdb2eddfc52404d59c63bf562b95cca8a8a13f600c204b673ef` |
| Harness SHA-256 | `fa3124697e1efc3f69929a2c32f887018f588767fb4972078767c5e3e851eebc` |
| Recorded Chrome version | `154.0.8037.58` |
| Lighthouse | `12.6.1` |
| Local transport | `http://127.0.0.1:3000`, HTTP/1.1 |

The source digest covers the paths in the performance contract; it is not a Git commit identifier. The desktop simulated settings hash is `30fe686d4f4cfd0fa486bcc8e279bad7b977dadcf641c15a69559eb4701444ae`; mobile simulated is `4fdad9498fbe3eb76a1528bf8f29eceef0d60737daef2f8e5cb5aa19d7aeb0ca`; mobile DevTools diagnostic is `10d52a3ac05cfd1eb09152c26ef5a518f56fb60456ecc95d1c64cfd28d8c8dc9`. Different measurement methods retain their own settings identities. Lighthouse uses fresh browser profiles; page measurements use fresh contexts with cache disabled.

### What the matched diagnostic establishes

Both mobile methods use the 412×823, DPR 1.75 screen profile and the same declared mobile throttle values: 150 ms RTT, 1,638.4 Kbps nominal throughput and 4× CPU slowdown. DevTools applies Lighthouse's adjusted request latency/download/upload settings (562.5 ms, 1,474.56/675 Kbps) while simulated runs apply the Lantern model after collection. The diagnostic also extends post-paint/load quiet windows from 1,000 to 5,250 ms. It is a deliberately different measurement method on the same implementation.

In all ten simulated and all ten DevTools mobile samples, LCP is the server-rendered introductory paragraph: home `div.max-w-2xl > p.mt-4`, demo `div.max-w-3xl > p.mt-5`. The simulated runs' observed local FCP and LCP are equal (home 48–79 ms, demo 56–88 ms). Their modeled LCP breakdown attributes zero time to resource load delay/load time: homepage median TTFB 452.19445 ms and render delay 2,303.3889 ms; demo median TTFB 452.5463 ms and render delay 2,296.2054 ms. Component medians need not sum to the median total. These are modeled report phases, not a directly observed 2.3-second blank interval.

With DevTools throttling, measured FCP and LCP are again equal, at medians of **1,566.249 ms home / 1,587.393 ms demo**. The homepage diagnostic TBT median is **2.759 ms**, compared with the failed simulated 200.5 ms gate. This shows a large method-dependent startup estimate for this local HTTP/1.1 setup. It does **not** establish a physical-phone result, a production-CDN result, a passing simulated LCP/TBT gate, or a measured HTTP/2 improvement. The earlier dependency-graph investigation below remains a bounded explanation and follow-up hypothesis; it is not a license to discard the retained failures.

### Superseded campaign and diagnostic history

The [campaign before diagnostics](campaign-before-diagnostics.json) retains the earlier build `1y6XqMtrfOSt3lMsia_W5` results, including incomplete page samples and cadence misses. Those failures are historical evidence and are not mixed into the corrected campaign. Four earlier ambient-sampling timeouts lacked the later phase/visibility diagnostics, so their cause is not retrospectively assigned to the camera defect.

Separately, an interrupted sustained trial exposed the authored camera frustum being overwritten during DPR demotion. The fix and installed-R3F regression are described in [runtime adversarial review](runtime-adversarial-review.md); the interrupted trial remains at `build/facility/facility-v4/sustained-interrupted-before-camera-fix.json`. Earlier Lighthouse reports and summaries are retained under `build/facility/facility-v4/before-camera-fix/`. The present source/build/harness identity supersedes those measurements. Sustained native Chrome results are recorded separately and do not establish Safari or physical-phone acceptance.

## Earlier exploratory experiments

The following samples preceded the final matched collection and are not final release measurements.

Saved reports are under `build/facility/facility-v4/startup-experiment/`:

| Experiment | Report | Mobile simulated LCP | Finding |
|---|---|---:|---|
| Logo/header boundary split | `logo-split.json` | 2,768.18 ms | Did not improve the approximately 2,756 ms existing baseline; reverted |
| Turbopack chunk limit 6, home | `chunk-six-home.json` | 2,764.79 ms | Gate still fails; reverted |
| Turbopack chunk limit 6, demo | `chunk-six-demo.json` | 2,764.04 ms | Gate still fails; reverted |

Historical `experimental.inlineCss` was already tested and reverted before this investigation: home samples **2,916.18 / 2,905.16 ms**, demo **2,907.35 / 2,906.25 ms**, with increased transfer. The retained [experiment record](../facility-validation-v2/inline-css-experiment.json) identifies **facility-v2**, although this result was also known during v3 work. It is not a v4 measurement. The [v3 report](../facility-v3.md) separately records mobile medians of 2,755.8 / 2,756.8 ms.

## Exact offline dependency reproduction

Inputs: `build/facility/facility-v4/startup-experiment/chunk-six-home.json` and `chunk-six-home-trace.json`; related saved traces are `logo-split-trace.json` and `chunk-six-demo-trace.json` in the same directory.

The installed Lighthouse **12.6.1** trace processor and Lantern APIs were run offline: parse trace, create network requests/dependency graph/processed navigation, analyze the network, construct the simulator from the report settings, then compute FCP and LCP. This reproduces the report **exactly**: FCP **1,209.8609 ms**, LCP **2,764.79135 ms**. Observed FCP and LCP are both **83.052 ms**; the report uses simulated 150 ms RTT, 1,638.4 Kbps throughput, and 4× CPU slowdown.

| Graph / terminal dependency | Simulated finish |
|---|---:|
| Main HTML | 754.93045 ms |
| FCP graph: main CSS `1io9gazd49f6w.css` | 1,209.8609 ms |
| LCP graph: React DOM/Next hydration chunk `3jtoq_i6-slhk.js` | 2,714.79135 ms |
| LCP graph: that chunk's evaluation task | 2,764.79135 ms |

The framework chunk transfers **71,998 bytes** and decodes to **227,963 bytes**. Its observed evaluation task starts at **77.401 ms**, before the observed paint cutoff, and ends at 89.993 ms. Lantern includes it in LCP even though its request priority is Low. FCP uses a narrower render-blocking-priority filter. The LCP graph also has more network contention; these are separate graph estimates. Optimistic and pessimistic LCP estimates are identical here. The later graphics import and GLB transfer fall after the cutoff and are not this LCP terminal dependency.

Implementation references: installed `@paulirish/trace_engine/models/trace/lantern/metrics/FirstContentfulPaint.js` selects tasks that start before the paint cutoff; `LargestContentfulPaint.js` includes qualifying requests beyond FCP's priority filter and takes the latest simulated completion.

## Counterfactuals — not browser measurements or passes

Holding the saved trace and gate settings fixed, offline mutations predict:

| Hypothesis | Predicted LCP | Improvement |
|---|---:|---:|
| Replace available CSS/core-chunk transfer sizes with actual locally calculated Brotli sizes | 2,614.79 ms | 150 ms |
| Halve main CSS bytes, or remove approximately 25.8 kB of application JS | 2,614.79 ms | 150 ms each |
| Change request protocol from HTTP/1.1 to HTTP/2 | 2,254.93 ms | 509.86 ms |

No small supported startup-code change was identified that credibly closes the greater-than-250 ms gap. Real HTTP/2 delivery is the strongest bounded follow-up hypothesis, requiring a real production-like endpoint and fresh measurements. The protocol mutation does not model every consequence of deploying HTTP/2 and establishes no passing result. Neither delaying work to move it outside a measurement window nor changing the gate is proposed.
