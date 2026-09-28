# Facility v7 mobile LCP follow-up — 24 September 2026

## Decision

The local production-build gate for **facility-v7** now passes on home and `/demo` with the unchanged **2,500 ms mobile LCP ceiling**. The current **facility-v8** build passes those two routes but remains blocked by the pre-existing `/assessment` mobile LCP failure. This is local simulated Lighthouse evidence, not a field performance claim.

## Method and retained evidence

- Built each release with `FACILITY_ASSET_RELEASE=facility-v7` or `facility-v8` and `FACILITY_3D_MODE=auto-adaptive`, attested its build ID and source revision, and served it locally with `next start`.
- The focused collector uses the full release collector's Lighthouse settings, five fresh Chrome profiles for each of home and `/demo` on desktop and mobile, and saves every JSON report, trace, and network log. It validates report count, unique run IDs, collection freshness, settings, Chrome, source, release manifest, harness, and build identity before evaluating thresholds. Collection completion and threshold pass are separate results.
- The full v8 collector still measures `/assessment` and retains all existing thresholds. Complete-transfer measurements use five fresh contexts for home and `/demo` on each device profile, including automatic 3D readiness.

| Facility v7 candidate | Build ID | Mobile home LCP median | Mobile `/demo` LCP median | 2,500 ms gate |
| --- | --- | ---: | ---: | --- |
| Current-source baseline | `IkowpkP_1niTsunPimQ2Z` | 2,604.6 ms | 2,755.2 ms | Fail |
| Turbopack startup priority | `RVT63PpdGz8x8yjGY8na6` | 2,605.2 ms | 2,752.9 ms | Fail; reverted |
| Deferred startup with eager home poster | `cg7VDlgEPSo9ZGk0ldPa4` | 2,599.7 ms | 2,447.4 ms | Fail; revised |
| Deferred startup with lazy, low-priority home poster | `Hsc8iaPik_yxC-cxgijUA` | **2,447.5 ms** | **2,448.0 ms** | **Pass** |

The retained earlier v7 validation had home and `/demo` medians of 2,606 and 2,746 ms. The fresh baseline above uses current source and a separately attested build; it is not mixed into the older report. The baseline experiment's original `result: pass` described collection completion only. Retrospective validation in its `gate-summary.json` correctly records `collection: complete`, `threshold: fail`.

Raw v7 candidate directories are under `build/facility/facility-v7/startup-experiments/`; the final directory is `v7-deferred-poster-lazy-20260924/`. Each contains its own `summary.json`, 20 reports, traces and network logs. The final directory also contains `page-measurements.json`. The source and harness hashes match between final Lighthouse and transfer reports; final Chrome version is `154.0.8037.58`.

## Dependency finding and production change

Both LCP elements are server-rendered text. Offline Lantern reconstruction exactly reproduced the saved mobile LCP values. The final median home trace still depends on the shared React DOM/Next chunk (`3jtoq_i6-slhk.js`, 71,998 transfer bytes), which completes at simulated 2,405.5 ms, followed by a 42 ms evaluation task. The final median `/demo` trace follows the same shared chunk and a 42 ms task.

The first bounded production candidate set Turbopack's `firstPageLoadPriority` to `1` and prioritized home and `/demo`. Its five-run mobile medians stayed above the gate, so the config was reverted. The remaining change server-renders the initial header, facility illustration/decision, and sample decision brief, while loading the interactive header controls on use and the home facility and `/demo` explorer on viewport entry or action. Native links, decision content, and activation remain available while client code loads. This removes eager route interactivity from initial startup without changing the published facility assets or briefs.

An eager home mobile poster competed with the shared chunk and raised home LCP to 2,599.7 ms. In that failed trace it requested at 13.8 ms with **High** priority; the shared chunk's simulated completion moved to 2,556.7 ms. The final server HTML retains the real mobile poster URL, with native lazy loading and **Low** fetch priority. In the final trace its request starts at 55.5 ms, after the shared chunk's actual network request completes, and the simulated chunk completion returns to 2,405.5 ms. The `/demo` poster is also native lazy loaded. No asset files were changed.

## Final checks

- **Facility v7 focused Lighthouse:** collection complete, threshold pass, all 20 reports. Desktop LCP medians: home 601.4 ms, `/demo` 557.5 ms. Mobile LCP medians: home 2,447.5 ms, `/demo` 2,448.0 ms. Mobile Lighthouse CLS is 0; accessibility and best-practices medians are 100 on both routes.
- **Initial JavaScript:** home and `/demo` each 127.5 KiB Brotli, including shared framework, below the unchanged 180 KiB ceiling.
- **Complete automatic transfer:** all 20 facility-v7 contexts pass the 1,572,864-byte ceiling and renderer checks. Largest observed transfer is 987,600 bytes (`/demo` desktop). Mobile runtime CLS reaches 0.0150; Lighthouse CLS is 0. The runtime value is comparable with the retained pre-change v8 value of about 0.0150.
- **Source and interactions:** lint, typecheck, production build, all 621 unit tests, and focused startup/SSR/focus tests pass. Desktop/mobile browser coverage exercises native navigation and no-JavaScript links, active route/history state, mobile dialog focus, assessment query/history and deep links, facility activation/retry/Save-Data behavior, and automated accessibility. One facility test was updated to scroll to the intentionally deferred viewer before expecting its interactive button; its desktop/mobile rerun passed. One wider run had 59 passes, 10 expected skips, and that obsolete test assumption before the correction.

## Current facility v8 boundary

The same final source was rebuilt and attested as facility-v8 (`WOUJCbGH-6uFiT30ikUH-`, source revision `5b0a91867ea4`). The full v8 collection completed 30 Lighthouse reports, including `/assessment`; all 20 complete-transfer contexts passed. A focused v8 desktop/mobile interaction run passed 22 tests with four expected skips. The full performance validator fails **only** mobile `/assessment` LCP: **2,594.6 ms** against 2,500 ms. The retained pre-change v8 median was **2,595.9 ms**. Current v8 mobile home and `/demo` medians are 2,445.9 and 2,446.6 ms. V8 remains blocked on `/assessment`; this v7 fix is not evidence that the broader v8 gate passes.

The new v8 summary is `docs/website-upgrade/facility-validation-v8-deferred-20260924/lighthouse.json`; its raw reports, traces, transfer measurements, and index are saved under `build/facility/facility-v8/deferred-20260924/`. The existing v8 validation directory and its earlier reports were not overwritten. The local method uses Chrome device emulation and simulated mobile throttling over the local production server; the passing v7 margin is about 52 ms, so release decisions should retain the five-run gate.

The no-JavaScript header links and mobile drawer remain usable, but the current-page marker is applied by the small inline header script. A no-JavaScript mobile check decoded the real v8 facility poster at 680 × 510 pixels after scrolling into view; its screenshot is retained beside the v8 raw reports.
