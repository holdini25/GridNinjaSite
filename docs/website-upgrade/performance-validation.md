# Performance validation — 22 September 2026

The first-load JavaScript and transfer budgets pass. **The mobile LCP gate remains open:** the four core-route medians exceed the unchanged configured limits. Do not describe the complete mobile performance suite as passing.

## Measured configuration

Production Next.js 16.3.6 on `http://127.0.0.1:3000`; Node 22.23.2; Lighthouse 12.6.1; Chrome 149. Five cold simulated-mobile runs per route, collected sequentially without other browser/test workloads. The mobile profile uses a 412×823 viewport, 150 ms RTT, 1,638.4 Kbps throughput and 4× CPU slowdown. These are lab measurements, not field p75 or INP evidence. Vercel-only observability was inactive locally.

The repository's default Lighthouse configuration remains **desktop**. `LHCI_FORM_FACTOR=mobile` selects mobile; `LHCI_RELEASE_CANDIDATE=1` selects five runs. This review explicitly measured five representative routes; it did not run the full eight-route configured Lighthouse matrix.

## Fixed mobile sample

Metric medians are calculated across all five runs. All 25 reports passed the existing whole-page, font and individual-image transfer checks. Core-route accessibility, best practices and SEO were 100 in every run. The frozen brief is deliberately unindexed; its SEO score of 58 is excluded from the configured SEO assertion.

| Route | Performance median | LCP median / range (ms) | FCP median (ms) | TBT median (ms) | CLS | Script / total HTTP transfer (KiB) |
| --- | ---: | --- | ---: | ---: | ---: | ---: |
| `/` | 97 | 2605.082 / 2456.125–2612.426 | 1053.850 | 1 | 0 | 178.8 / 228.8 |
| `/assessment` | 97 | 2605.913 / 2604.231–2606.239 | 1053.231 | 1.5 | 0 | 189.0 / 239.3 |
| `/demo` | 97 | 2605.684 / 2605.323–2607.806 | 1053.684 | 1 | 0 | 184.2 / 233.4 |
| `/contact` | 97 | 2532.580 / 2457.601–2533.216 | 903.680 | 1.5 | 0 | 189.0 / 236.8 |
| Frozen assessment brief | 100 | 614.710 / 614.333–617.110 | 614.710 | 0 | 0 | 0 / 6.1 |

The LCP limit is 2,500 ms generally and the existing contact-specific limit is 2,000 ms. Performance score ≥90, FCP ≤1,800 ms, TBT ≤200 ms and CLS ≤0.1 (contact ≤0.05) pass for this sample. The largest observed TBT was 8.144 ms. TBT is not a substitute for INP.

All five LCP samples, in collection order (ms):

| Route | Samples |
| --- | --- |
| `/` | 2612.426, 2604.850, 2605.082, 2456.125, 2606.792 |
| `/assessment` | 2605.913, 2606.023, 2604.231, 2604.396, 2606.239 |
| `/demo` | 2605.615, 2607.685, 2605.323, 2607.806, 2605.684 |
| `/contact` | 2533.216, 2457.601, 2532.329, 2532.910, 2532.580 |
| Frozen brief | 617.110, 614.376, 614.710, 615.706, 614.333 |

Two separate desktop spot checks returned performance 100, CLS 0, and LCP 536.445 ms (home) / 536.905 ms (contact). They do not override the mobile result.

## Asset units and interaction cost

The build gate totals each route's initial first-party JavaScript **including shared framework `rootMainFiles`**, deduplicated and Brotli-compressed. Results are home **149.1 KiB**, assessment **157.4 KiB**, demo **153.1 KiB**, contact **157.4 KiB**. All are below the unchanged **180 KiB Brotli** ceiling; the latter three trigger the 150 KiB review warning. HTTP transfer sizes above include the server's actual encoding and headers and are not interchangeable with Brotli asset sizes. One KiB is 1,024 bytes.

No third-party scripts loaded in any idle Lighthouse run. A separate contact/assessment probe waited 2.5 seconds after network idle, then focused the empty Name field. Cloudflare's script loaded only after focus: 28,191 / 28,134 encoded bytes. The parent-page CDP probe did not capture completed challenge-iframe transfer bytes, so this is only the API-script cost; complete verification latency and iframe cost remain unverified. No inquiry fields were filled and zero contact API requests occurred. Full production interaction and Vercel telemetry costs still need representative staging measurement.

## Diagnosis and rejected experiment

The homepage LCP element is the static hero paragraph, with no reveal animation. Lighthouse identifies two blocking CSS responses (23,849 and 1,712 HTTP bytes) and estimates 250 ms potential savings. Raw localhost paint around 101 ms must not be presented as the simulated mobile result.

Following the bundled Next.js documentation, a bounded `experimental.inlineCss` experiment removed CSS requests but increased duplicated initial HTML. Home mobile LCP worsened to **2761.628 ms**, contact to **2757.642 ms**; total transfer increased to **275.3 / 283.1 KiB** from **228.8 / 236.8 KiB**. Desktop LCP was 538.570 / 577.566 ms. The flag was reverted; the original config was verified byte-for-byte and the restored build passed its asset/publication guards.

Next investigation: measure the retained build on representative staging with actual CDN compression, then inspect the static text's simulated dependency chain and shared CSS/chunk partitioning. Only retain critical-CSS or chunking changes after repeated improvement with interaction/navigation coverage. Do not weaken the LCP threshold or adopt global inlining based on the theoretical saving.

## Evidence and reproduction

- [Durable compact sample data](performance-samples.json) preserves all 25 metrics and the exact mobile settings.
- [Local full-report directory](../../test-results/lighthouse-final-mobile/) contains `home-1.json`–`home-5.json`, `assessment-1.json`–`assessment-5.json`, `demo-1.json`–`demo-5.json`, `contact-1.json`–`contact-5.json`, and `brief-1.json`–`brief-5.json`; first runs also retain traces and DevTools request logs.
- [Local measurement summary](../../test-results/lighthouse-final-mobile/summary.json), [security engagement probe](../../test-results/lighthouse-final-mobile/engaged-security.json), and [reverted experiment results](../../test-results/lighthouse-inline-css/summary.json).

Raw browser reports stay in ignored `test-results/`; they contain no submitted contact data and were not uploaded. The collection used the installed Lighthouse CLI with `--form-factor=mobile --only-categories=performance,accessibility,best-practices,seo --output=json`, five independent invocations per URL. Set `CHROME_PATH` to the installed Playwright Chromium executable and keep the production server running. Resource checks use `validateLighthouseReports` with those five expected URLs and `numberOfRuns: 5`; the Brotli guard is `node scripts/validate-contact-build.mjs`.
