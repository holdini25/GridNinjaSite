# V7 controlled startup experiments

**Retain the corrected mobile poster acquisition and static header/logo boundary. Reject profile-object sharing.** These changes improve the measured mobile homepage, but the unchanged **LCP ≤2.5 s gate remains unmet** on both mobile routes. This report describes experiment builds; subsequent final source changes require their own release measurements.

## Method and provenance

Each candidate ran a production build on `http://127.0.0.1:3000`, followed by five fresh browser profiles for each combination of home/demo and desktop/mobile: **20 runs per candidate, 100 total**. The [collector](../../../scripts/facility/compare-startup.mjs) retains individual Lighthouse reports, network logs, and traces, and verifies that source/build identity remains unchanged during each experiment. Lighthouse 12.6.1 used its existing simulated desktop/mobile settings; mobile includes 150 ms simulated RTT, 1,638.4 Kbps throughput, and 4× CPU slowdown. These are controlled local measurements, not physical-device timings.

All candidates use `facility-v7`, `auto-adaptive`, and frozen manifest SHA-256 `c6ccfae472adebef0af6a8a85104be2db9f0879019babec2e297d82a9f71ce37`. In each summary, `result: "pass"` means the measurement collection completed and identity validation passed. It does **not** mean the release's performance thresholds passed.

| Candidate / retained report | Build ID | Source revision SHA-256 | Collection started, UTC |
|---|---|---|---|
| [Baseline](../../../build/facility/facility-v7/startup-experiments/v7-baseline/summary.json) | `waltsrGhfY-cgG_8Ka3RE` | `53a07ad35b2ea1832481e51b008cf0d92aa1329526fdf1981f5311c4c3f9d427` | 2026-09-24 01:05:12.552 |
| [Poster, rejected](../../../build/facility/facility-v7/startup-experiments/v7-poster/summary.json) | `t8H87WzmsWv0umK_bE__I` | `05b44f12e27018643eba74b61648d90ab6636f49205fa4684f51c5eeb1f05978` | 2026-09-24 01:08:40.367 |
| [Poster, corrected](../../../build/facility/facility-v7/startup-experiments/v7-poster-fixed/summary.json) | `7y_UAmI-3dFWYnJVwkWFQ` | `3fc363da0cd88d5266e12f4043fa344bfa62fbc286208a5bd8f587fdff8723e2` | 2026-09-24 01:15:45.517 |
| [Header + corrected poster, retained](../../../build/facility/facility-v7/startup-experiments/v7-header/summary.json) | `e-SqCDYyh6w8TdB5EFTjL` | `d4598ee49d2b62334536b98c25cb1f0954b1c7594a96248ee1b836f7ca4a1c44` | 2026-09-24 01:19:14.098 |
| [Metadata sharing, rejected](../../../build/facility/facility-v7/startup-experiments/v7-metadata/summary.json) | `PFeVW1J9ENg9wGgHxyGOL` | `96bc003b00b6297bc9a16e1c69b55c5c1924b892a52922f7a95ed3fd5e41a7bb` | 2026-09-24 01:22:42.633 |

Source revision is the build attestation's content hash, not an assertion that the working tree was committed. Controlled source snapshots and variant scripts are retained under [startup-source-controls](../../../build/facility/facility-v7/startup-source-controls/). Build/server/measurement logs, including rejected attempts, remain under `build/facility/facility-v7/startup-*`.

## Measured medians

LCP values below are in milliseconds, reproduced to five decimal places from the retained summaries. Every profile's median CLS is **0**; every desktop median TBT is **0 ms**.

| Candidate | Desktop home LCP | Desktop demo LCP | Mobile home LCP | Mobile demo LCP | Mobile home TBT | Mobile demo TBT |
|---|---:|---:|---:|---:|---:|---:|
| Baseline | 618.81565 | 620.45590 | 2758.15470 | 2756.91535 | 188.5 | 0 |
| Poster, rejected | 618.37750 | 620.54905 | 2909.98480 | 2901.18720 | 96.5 | 0 |
| Poster, corrected | 621.13930 | 620.76925 | 2758.08595 | 2757.33300 | 167 | 1 |
| Header + corrected poster | 621.91630 | 619.80970 | 2607.59430 | 2755.48680 | 161.5 | 1 |
| Metadata sharing | 620.63830 | 620.10540 | 2607.09615 | 2756.43945 | 152.5 | 1 |

The following bytes are Lighthouse `total-byte-weight` during its observation window. They are **not** a substitute for the separate complete automatic transfer measurement through viewer readiness, especially when an offscreen viewer remains inactive.

| Candidate | Desktop home bytes | Desktop demo bytes | Mobile home bytes | Mobile demo bytes | Initial home JS, KiB Brotli | Initial demo JS, KiB Brotli |
|---|---:|---:|---:|---:|---:|---:|
| Baseline | 980,148 | 985,958 | 951,082 | 269,728 | 153.6 | 156.5 |
| Poster, rejected | 980,278 | 986,064 | 991,115 | 298,900 | 153.5 | 156.5 |
| Poster, corrected | 980,320 | 986,108 | 951,254 | 259,041 | 153.5 | 156.5 |
| Header + corrected poster | 980,393 | 986,176 | 951,327 | 259,109 | 152.7 | 155.6 |
| Metadata sharing | 980,403 | 986,129 | 951,337 | 259,062 | 152.7 | 155.6 |

Initial JavaScript figures are the postbuild validator's rounded outputs in the corresponding build logs. Every experiment stays within 180 KiB Brotli, while home/demo remain above its 150 KiB review warning. These figures precede the final rear-rack explanation patch.

## Findings and decisions

### 1. Baseline: framework delivery remains the critical path

The [saved trace analysis](../../../build/facility/facility-v7/mobile-startup-readonly-review.json) identifies the introductory paragraph as the mobile LCP element. In the prior saved home trace, the shared framework request accounts for 71,998 transferred bytes / 227,963 decoded bytes, with simulated completion at 2706.0198 ms followed by 49 ms of terminal CPU work, yielding 2755.0198 ms. The new v7 baseline reproduces the approximately 2.76-second mobile result. The demo's LCP path does not require the 3D model.

Offline request-size sensitivity was useful for forming a hypothesis, but was not treated as a measured optimization. The actual production candidates below determine what is retained.

### 2. Initial poster candidate: reject the regression, preserve the evidence

The first mobile placeholder included raw whitespace in its SVG data URL. In `srcset`, that whitespace could make the candidate invalid, causing the browser to fall back to the desktop `img.src`. The mobile homepage downloaded **both** desktop and mobile posters; the offscreen mobile demo downloaded the desktop poster. The saved network reports record 39,903 bytes transferred for the desktop poster and 10,837 for the mobile poster, including response overhead.

Mobile home LCP worsened by **151.83010 ms**, and demo by **144.27185 ms**, against baseline. Its lower homepage TBT does not justify retaining broken acquisition. The rejected reports remain intact.

### 3. Corrected poster acquisition: retain the offscreen saving

The complete SVG placeholder is now URL-encoded. Mobile poster acquisition waits for document load, a visible document, and a viewer within 200 px of the viewport; desktop source discovery remains in server HTML. Explicit activation requests the poster. Actual image decoding/painting still gates automatic graphics readiness; a decoded placeholder cannot satisfy that contract.

The corrected mobile home fetches only its mobile poster. The offscreen demo fetches no poster during these Lighthouse runs, reducing its observed bytes by **10,687** against baseline. Home LCP is effectively unchanged (**−0.06875 ms**), as is demo (**+0.41765 ms**). Retain the avoided offscreen transfer without presenting it as an LCP fix or excluding its eventual cost from the automatic-experience budget.

### 4. Static header/logo boundary: retain the measured home improvement

The marketing server layout supplies static logo markup to the interactive header. Optional animated branding remains separate from the header's initial dependency boundary; navigation interactivity remains in its existing client component.

Compared with the corrected-poster build, mobile home LCP improves by **150.49165 ms**, from 2758.08595 to **2607.59430 ms**. Against the original baseline the improvement is **150.56040 ms**. Demo changes by **−1.84620 ms**, which is not a material improvement. Initial home/demo JavaScript decreases by approximately **0.8/0.9 KiB Brotli** using the rounded build outputs. Retain the header change together with corrected poster acquisition.

### 5. Release metadata object sharing: reject negligible benefit

This candidate shares structurally identical specimen/profile sections before serialization. Relative to the retained header build, the demo saves only **47 bytes** in both desktop and mobile observations; home grows by 10 bytes. Median mobile home LCP changes by **−0.49815 ms**, while demo worsens by **0.95265 ms**. Two faster individual demo samples do not establish a reliable median improvement. Initial JavaScript is unchanged at the validator's reporting precision. Remove the sharing layer and retain the simpler independently described release profiles.

### 6. Existing boundaries and deferred comparisons

Facility CSS was already isolated: the saved build audit found its 4,266-byte transfer on home/demo and absent from about, assessment, AI Cloud, and Colocation. There is no additional CSS-isolation change to retain. The previously rejected full-CSS-inlining approach was not repeated.

HTTP/2/Brotli delivery diagnostics and Simulator Safari remain separate from this unchanged local Lighthouse gate. They cannot substitute for a passing simulated mobile LCP result. No public performance pass, physical-device result, or deployment is established by these experiments.

## Retained source and outstanding gate

The final source keeps **corrected poster acquisition + the static header/logo boundary**, with **no profile-object sharing**. The experiment's mobile LCP medians, **2607.59430 ms home / 2755.48680 ms demo**, still exceed 2500 ms. The integration lead's final source/build report must cover subsequent fixes, complete automatic transfer, cadence, lifecycle, and accessibility independently of these candidate measurements.
