# Facility v5 validation

V5 is frozen and available in the local home and `/demo` preview. No public
website deployment was performed. Production measurements are complete. Automated model/interaction/transfer gates
pass; the aggregate page-performance gate fails on the two mobile LCP medians.

## Measured asset and rendering budgets

| Asset | GLB bytes | Browser triangles | Draw calls | Materials | Retained asset + environment |
|---|---:|---:|---:|---:|---:|
| Overview | 2,195,744 | 33,480 | 38 | 9 | 7,821,932 B |
| Rack, closed | 766,888 | 9,418 | 25 | 8 | 6,262,909 B |
| Cooling, closed | 380,684 | 4,194 | 17 | 7 | 5,720,196 B |

All GLBs meet their target sizes. All three have zero Khronos errors or warnings.
The largest measured staging allocation is 11,987,689 bytes, below the 16 MiB
target. Allocation figures are estimates for owned geometry, texture mip chains,
mask coverage data and the shared environment, not total browser-process memory. The rack has 28,547 bytes of headroom under
its 6 MiB ceiling; future detail changes must keep the allocation check.

The overview posters are 48,968 / 16,094 bytes (desktop/mobile). The largest
specimen poster is 18,376 bytes. Each asset embeds the same two 512² normal/ORM maps and one 256² RGBA map;
materials share them within each scene. Staging both scenes allocates both sets.
The color atlas is 1,638 bytes. Exact file/source hashes
are recorded in the frozen manifest and evidence below.

## Completed checks

- 465 unit tests; lint and full typecheck passed.
- Production build passed; all five releases validate. Initial JavaScript:
  home 147.8 KiB and demo 150.9 KiB Brotli, both below the 180 KiB ceiling.
- Exact publication/source exclusion checks passed during the production build.
- Eighteen isolated packaging checks passed, including stale source/poster and
  concurrent-writer rejection. These use frozen v1/v2 fixtures, not a fake v5 model.
- All three saved Blender masters reproduce their final GLB bytes in fresh pinned
  Blender processes. This proves saved-master export repeatability; it does not
  compare two independent full Cycles regeneration runs.
- 48 website states captured: home/demo, all system selections, six specimen
  poses, desktop DPR 1/1.5 and mobile DPR 1.
- 48 actual-asset channel views captured: rack/cooling, three poses, final/gray/
  normal/roughness, DPR 1/1.5. Actual drawing buffers are recorded. Source/module
  and frozen-manifest hashes match.
- Fourteen shader fixture checks pass in Chrome on M5 Pro Metal. The small shader
  fixture uses a fixed 512-pixel buffer; its browser DPR settings are not full-scene
  DPR or performance evidence.
- All 22 earlier v1–v4 artifact files and the four existing registry entries remain
  unchanged. Only the new v5 registration is added.

## Automatic 3D and lifecycle measurements

All 20 fresh-context through-readiness runs pass the current collector: five runs
for each home/demo desktop/mobile-emulation pair on the M5 Pro Metal renderer.
No specimen is downloaded automatically.

| Route / viewport | Complete automatic transfer | Fixed-60-fps capability p95 range |
|---|---:|---:|
| Home / desktop | 953,191 B | 17.6–18.0 ms |
| Home / mobile emulation | 920,317 B | 16.8–17.9 ms |
| Demo / desktop | 959,581 B | 17.5–18.1 ms |
| Demo / mobile emulation | 926,707 B | 16.8–17.1 ms |

Mobile emulation uses the Mac GPU; these are not physical-phone timings.
Deliberate 30-fps ambient rendering is checked against its requested cadence,
separately from the fixed-60-fps capability gate. Ten open/close and ten
assembly-switch cycles pass, with stable owned geometry/texture counts. The
native run also verifies irregular amber LED activity, four independent fan
phases, pause, reduced motion and offscreen suspension.

The first measurement attempt is retained in `performance/measurement-attempt-1`.
It recorded a 24.3 ms desktop capability miss and a pause assertion during finite
input/scroll demand frames. The collector now requires 250 ms of observed idle
within one second, then an unchanged frame count, fan poses and LEDs for 500 ms.
All corrected runs settled within 299 ms and remained still. Runtime code did
not change between attempts; the earlier timing variation is not explained away
as a rendering optimization.

Chrome, WebKit desktop and Chromium mobile automated suites pass their applicable
assessment, material, interaction, axe and failure cases. The Chrome material
test initially used an incorrect label locator; the corrected combobox locator
passes. A separate headed Chrome test verifies real background-tab suspension.
Six additional browser cases pass: actual WebGL context loss followed by explicit
Retry, and three client-navigation route pairs, each checked in Chrome, WebKit
desktop and Chromium mobile. Navigation preserves client routing, disposes old
canvas diagnostics and keeps owned resource counts stable.
WebKit automation is distinct from manual Safari/VoiceOver validation.

## Page-performance release gate

Twenty fresh Lighthouse profiles were collected: five per route/device pair.
The aggregate validator **fails** because both mobile LCP medians exceed 2.5 s.
It retains the original simulated-throttling settings.

| Profile | LCP median | TBT median | CLS median | Performance / accessibility |
|---|---:|---:|---:|---:|
| Desktop home | 618 ms | 0 ms | 0.0050 | 100 / 100 |
| Desktop demo | 617 ms | 0 ms | 0 | 100 / 100 |
| Mobile home | **2,756 ms — fail** | 184.5 ms | 0 | 93 / 100 |
| Mobile demo | **2,758 ms — fail** | 1 ms | 0 | 96 / 100 |

TBT and CLS pass in this run; the historical homepage TBT miss is not reproduced.
The mobile LCP miss remains. Offscreen 3D is absent from some Lighthouse byte totals;
the stricter automatic-transfer figures above include scrolling through viewer
readiness and are used for the 1.5 MiB gate. Explicit specimen model transfers
are separately measured at 235,900 B (rack) and 205,541 B (cooling), Brotli payload
bytes, excluding HTTP headers. The raw Lighthouse reports and saved traces remain
under `build/facility/lighthouse-{desktop,mobile}`.

## Evidence

- [Exact evidence inventory](evidence-inventory.json)
- [Page-performance gate and all five-run summaries](performance/performance-summary.json)
- [Complete automatic transfer and cadence measurements](performance/page-measurements.json)
- [Native M5 Pro lifecycle and motion report](performance/browser-validation-native.json)
- [Native motion and lifecycle recording](motion/lifecycle-native.webm)
- [Production build and JavaScript checks](checks/production-build.log)
- [WebKit/mobile E2E results](checks/e2e-mobile-webkit.log)
- [Context-loss and repeated-navigation results](checks/e2e-lifecycle.log)
- [Immutable release comparison](immutability/report.json)
- [Browser model/poster profile](visual/capture-profile.json)
- [Actual-asset material benchmark](material-assets/report.json)
- [Implementation and reproduction guide](../facility-v5.md)

The full review captures and raw working outputs remain in
`build/facility/facility-v5/`. The curated documentation contains contact sheets,
close-ups, representative page states, source/UV/normal/bake reports and validation
results. The immutable release contains only its exact allowlisted model/poster
files and manifest; sources and candidates are excluded from deployment.

## Boundaries and public-release gates

The overview omits the outer perforated door skin to expose module construction;
the specimen provides the masked door and hollow interior. Tiny overview pockets
use planar recessed backings. Alpha-aware picking agrees with resolved apertures
and opaque minification, with approximate coverage at multisample edge pixels.

No v5 15-minute sustained/energy test is claimed; earlier v4 endurance evidence
does not certify this release. Physical iPhone/Safari, midrange Android/Chrome,
native Safari, manual VoiceOver,
touch/zoom/reflow and flashing-threshold review remain public-release gates.
Browser emulation and automated axe checks do not replace these checks. Existing
LCP ≤2.5 s, CLS ≤0.1 and TBT gates remain in force. Rollback modes are preserved:
`poster`, `manual`, `auto-desktop`, and `auto-adaptive`. The local default is
`auto-adaptive`; public activation requires clearing these release gates. An
explicit rollback mode remains available without changing assessment content.
