# Manual and physical-device release gates

This is a local implementation and preview. It has not been publicly deployed. **Public adaptive mobile activation is not approved by the current evidence.**

## Current measured build and retained failures

Final corrected collection used `facility-v4` / `auto-adaptive`, build `M9e7UvRUEZ9rRvSIsWO2g`, source digest `69001f26ca42e03f2116576a9bf7c124f048c5c8a60115fafbc483612520dcaa`, harness `fa3124697e1efc3f69929a2c32f887018f588767fb4972078767c5e3e851eebc`, Chrome `154.0.8037.58` and Lighthouse 12.6.1. The full manifest/settings identities and all desktop/mobile ranges are in [startup investigation](startup-investigation.md).

| Route | Simulated mobile LCP median (range), ms | Simulated TBT median (range), ms | DevTools diagnostic LCP median (range), ms |
| --- | --- | --- | --- |
| Home | 2755.58335 (2747.5007–2756.8055) | 200.5 (189.5–209) | 1566.249 (1563.609–1569.324) |
| Demo | 2748.8081 (2748.5507–2759.6389) | 0 (0–2) | 1587.393 (1579.255–1589.129) |

All ten simulated mobile LCP samples exceed the unchanged 2,500 ms limit. The homepage TBT median also fails the unchanged 200 ms limit; three of its five samples exceed 200 ms. The ten faster DevTools-throttled diagnostic samples do not replace these gates or justify removing samples.

The corrected campaign's **20/20 fresh page measurements pass**, with complete through-readiness transfer, asset budgets, ambient cadence and fixed-cadence capability evidence. There are no current incomplete-page or cadence failures. The [combined report](lighthouse.json) retains only **home LCP, home TBT and demo LCP** as failed release metrics. Historical incomplete/cadence evidence is preserved in [campaign before diagnostics](campaign-before-diagnostics.json); the separately corrected DPR camera-ownership defect and its interrupted trial are documented in [runtime adversarial review](runtime-adversarial-review.md). Historical samples are not mixed into the final campaign.

A successful native graphics or sustained Chrome result cannot waive the remaining startup failures or establish Safari/phone acceptance. Collection completion is separate from release acceptance.

## Environment actually available

- Apple M5 Pro, 48 GB unified memory; native Chrome/ANGLE Metal graphics and sustained-session results are recorded separately. This document makes no independent 15-minute-session claim.
- Safari 27.0 is installed. A local WebDriver session was attempted and refused because Safari’s **Allow remote automation** setting is disabled. That setting was not changed; no native Safari acceptance run is claimed.
- Playwright desktop/mobile WebKit coverage is engine emulation, not a physical Safari acceptance result. The interrupted Firefox startup also remains unverified; see [interaction validation](interaction-validation.md).
- Android `adb` and the Xcode `xctrace` device tool were unavailable. No physical iPhone or Android result is claimed.
- VoiceOver/Safari testing has not been completed. Automated axe/keyboard checks cover the recorded states only.

## Still required before public adaptive mobile activation

1. Resolve the remaining simulated mobile Lighthouse failures: homepage LCP, homepage TBT and demo LCP. Preserve the passing 20/20 through-readiness transfer and graphics/cadence evidence when rebuilding, with one matched source/build/harness/browser identity. Do not substitute the DevTools diagnostic, relax the 200 ms TBT limit, or remove slow samples.
2. Run a 15-minute session in native Safari on this Mac, iPhone/Safari, and a representative midrange Android/Chrome device. Record device/OS/browser identity, display cadence, tier changes, responsiveness, memory where available, and observed heat/energy behavior. Keep emulation results separate; native Chrome on the Mac does not establish these outcomes.
3. With VoiceOver/Safari, inspect the four systems, equipment connection groups, assembly callouts, pose controls and the four-step assessment walkthrough. Verify announcements, focus recovery after Close/failure, zoom/reflow and exact publication destinations.
4. On physical touch devices, verify native page scrolling, gesture cancellation and accidental-selection protection, including two-finger gestures and browser navigation during loading. Recheck the explicit-action stage reveal below the sticky header; its Chromium/WebKit mobile regressions are emulation evidence.
5. Review LED/trace motion at ordinary and expanded sizes. Automated bounds enforce small amber lamps, softened pulses and bounded simultaneous activity; this is not a certified flash-analysis result.

## Release modes

`auto-adaptive` is the local v4 preview default and the mode measured above. It is **not** an approved public mobile rollout. Explicitly select `FACILITY_3D_MODE=poster`, `manual`, or `auto-desktop` for rollback or a restricted candidate, then rebuild and measure that exact candidate through the existing release process. These modes are available controls, not a waiver of outstanding release gates. Settings change presentation only; assessment records and publications remain unchanged.

