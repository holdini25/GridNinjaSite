# Facility v3: premium engineering miniature

Implemented and frozen locally on 22 September 2026 (Eastern). Home and `/demo`
now select `facility-v3` in `auto-desktop` mode. **No public deployment was made.**
Public release remains blocked by the mobile LCP gate and physical-device/manual
accessibility checks below. Assessment copy, records, publication bytes and CTAs
remain authoritative and unchanged by the visual.

## Visual result

[V2/v3 composition and equipment comparison](facility-validation-v3/v2-v3-comparison.png)
and [neutral plus four selections](facility-validation-v3/contact-sheet.png).
The comparison uses each release's reviewed camera; it is not an identical-camera
pixel comparison. The model remains an illustrative miniature, not a physical
capacity calculation or an operational interface.

- Preserved evaluated corner normals through inverse-transpose transformation
  and static batching, retaining UV seams. Prominent cabinet silhouettes have
  smoother bevels; subpixel bevel loops were removed to control transfer.
- Added a session-owned, 128-resolution `industrial-softbox-v1` PMREM environment.
  Broad upper and lower/front reflection cards shape black cabinet fronts and
  metal surfaces. Ambient fill and bright trim are reduced. Rendering remains
  one scene pass, without runtime shadow or postprocessing passes.
- Added shared 512×512 normal and ORM atlases. Cycles produced actual local AO
  and selected-to-active grille/coil normal bakes at 64 samples. Rotor poses and
  rotor shadows are excluded from the static bake. Roughness and metalness
  distinguish coating, metal, rubber, copper and grilles.
- Replaced generic electrical tubes with enclosed rectangular busways, rack
  taps and supports. Cooling has paired pipes, manifolds and clamps. Typed
  records validate 26 routes, 52 ports and 18 supports; equipment endpoints are
  checked against authored equipment bounds.
- Added two coherent rack-front variants, service panels, deeper fan blades
  and stationary guards. Both rack rows and all four fans are visible; the two
  reserve cabinets are separated.
- Added tight projected-geometry framing at approximately 42°/32°, with 12%
  padding. The contour is computed once and reused on resize; analytic ellipse
  extrema account for a full rotor turn without per-frame vertex traversal.
- Quieted the toolbar and system rail. CSS grid sizes the explanation to its
  current record's longest state, with inactive copies inert and hidden from
  accessibility. Selection, reset and reflow do not move the scope footer.
- Fans use 1.6 radians/second and independent phase offsets. One instanced LED
  batch uses an amber material and brightness-only activity. Pause, equipment
  preference, reduced motion and hidden/offscreen behavior remain intact.

V1/v2 omit the optional environment, motion, LED and framing fields and retain
their existing renderer behavior. The four system explanations continue to use
assessment selectors: Storage is unassessed, fixture D's cooling evidence and
quantities remain unknown, and selection cannot change a result or download.

## Defects found and corrected during implementation

| Finding | Correction and evidence |
| --- | --- |
| Batching discarded evaluated custom normals. | Corner-normal/UV preservation report; actual browser shading benchmark. |
| World-box framing left excessive empty space. | Cached visible-geometry projection, including instances and complete rotor sweeps; focused tests. |
| High studio cards left vertical black fronts too dark. | Added a restrained lower/front reflection card and reviewed browser renders. |
| Busway accent tubes were hidden inside their housings. | Exposed 24 mm rectangular face strips. Capture now rejects a visually absent selected state; changed-pixel counts are recorded. |
| Fixed explanation minimum heights could still shift content. | Grid-based intrinsic sizing; Chrome/WebKit checks across A–D, five selection states and 320/640/1440 px. |
| New helper/scene edits were outside source provenance. | Manifest pins five source-module/input hashes; stage and freeze reject stale modules or scene inputs. |

## Frozen asset and resource measurements

| Measure | V3 result | Target / ceiling |
| --- | ---: | ---: |
| GLB decoded bytes | 2,080,304 | 2.3 MB / 2.5 MB |
| Authored / rendered triangles | 32,734 / 33,310 | 36–42k working range; 80k ceiling |
| Still / animated draw calls | 39 / 39 | 40 / 60 |
| Authored / runtime materials | 8 / 10 | 10 runtime |
| Estimated retained asset + environment | 6.53 MiB | 16 MiB target / 32 MiB ceiling |
| Estimated peak asset + environment | 8.10 MiB | 16 MiB target / 32 MiB ceiling |
| Desktop / mobile poster bytes | 46,412 / 15,132 | 100 KiB target / 150 KiB ceiling |
| Native M5 Pro/Metal active frame p95 | 9.8 ms at DPR 1.5 | ≤20 ms desktop |

Geometry is below the working triangle range because fine detail is baked;
unnecessary triangles were not added to fill that range. Allocation estimates
cover asset/environment resources, not total browser or GPU-driver memory.

Khronos validation reports **zero errors, 42 generated-tangent-space warnings,
and zero informational issues**. Normal-mapped primitives omit explicit tangent
attributes and use the renderer's derivative basis. Browser review covers this
choice; this is not described as a zero-warning validation. All 66 semantic
identities, four rotor shafts, 48 LED anchors, normal lengths and UV bounds pass.

The saved editable master re-exported byte-identically under pinned native
Blender 5.2.2 LTS, build `d13f752e3b9c`. This verifies saved-master re-export;
a second full generation/bake was not compared. Source, bake, connection,
normal-preservation and re-export reports are in
[the evidence directory](facility-validation-v3).

## Validation

- Lint, TypeScript, production build and **404 unit tests across 40 files pass**.
- **78 browser matrix checks pass**, with 18 expected browser-specific skips,
  across Chrome desktop, WebKit desktop, Chromium mobile and WebKit mobile.
  Coverage includes A–D transitions, exact publications, history/reset,
  no-JavaScript content, axe, keyboard, responsive controls and loading policy.
- **Nine failure/visual checks pass**: missing poster, corrupt/oversized GLB,
  failed deferred import, total deadline/retry, stale navigation, constrained
  connection, offscreen eligibility, neutral colors and control readability.
- A separate headed Chrome test with Playwright focus emulation disabled passes
  real hidden-tab activation suppression, stopped equipment updates and resume
  without hidden-time replay. Initial attempts exposed Playwright's forced
  visibility behavior; those test-setup attempts are retained separately.
- Native headed Chromium/ANGLE Metal verified all fans moving around their
  authored shafts, distinct phases, brightness-only LEDs, pause/equipment-off/
  reduced-motion freezing, all four picking regions, six-pixel gesture rules,
  offscreen suspension, context-loss recovery and interrupted navigation.
- Ten close/reopen cycles and three SPA route pairs retain 39 geometries and
  four textures per active session. Post-GC JS heap ranged from 10.02 to
  10.96 MB across reopen cycles and 11.43 to 12.45 MB across route samples,
  within the bounded smoke-test tolerance. This is not proof of zero retained
  allocation under indefinite use.
- **18 isolated packaging checks pass**. SHA-256 comparison confirms all
  **29 prior assessment/visual publication files remain byte-identical**.
- The optional Firefox matrix attempt stalled at browser startup before site
  tests began and was stopped. It is an environment limitation, not a claimed
  Firefox pass. The established Chrome/WebKit matrix completed separately.

See [native evidence](facility-validation-v3/native-metal.json),
[browser matrix](facility-validation-v3/e2e-matrix.log),
[failure checks](facility-validation-v3/e2e-failures.log),
[hidden-tab check](facility-validation-v3/e2e-visibility.log), and
[publication integrity](facility-validation-v3/publication-integrity.json).

## Five-run production performance campaign

Build `ka8svmef4cp9Qti5DQlV8`, source
`d2af80fb26b42de1709d9452204466bb48eff627a49a0eac96800030b80ecba1`.
The measurement collector and Lighthouse used Chrome 154.0.8037.58. The native
Metal lifecycle/frame check used bundled Chromium 149, reported separately.
All reports pin build, source, release, browser, settings and harness identity.

Twenty fresh-context transfer/frame runs completed: five per route/device
combination. Desktop transfer includes automatic graphics through readiness;
mobile transfer is the default poster experience, followed by explicit 3D
activation for frame measurement. Emulated mobile frames run on this Mac,
not physical mobile hardware. Active frame p95 was **16.8–18.4 ms** in these runs.

Twenty fresh-profile Lighthouse runs completed. The strict release summary
returns **FAIL solely for the two mobile LCP medians**:

| Route / profile | Complete automatic transfer | LCP median | TBT median | CLS | Lighthouse performance / accessibility / best practices |
| --- | ---: | ---: | ---: | ---: | --- |
| Home / desktop | 1,056,331 B | 619.7 ms | 0 ms | 0 | 100 / 100 / 100 |
| Demo / desktop | 1,058,816 B | 616.6 ms | 0 ms | 0 | 100 / 100 / 100 |
| Home / mobile emulation | 247,849 B | **2,755.8 ms** | 0.5 ms | 0 | 96 / 100 / 100 |
| Demo / mobile emulation | 250,334 B | **2,756.8 ms** | 1 ms | 0 | 96 / 100 / 100 |

Home/demo initial JavaScript is **145.1 / 148.2 KiB Brotli**, below the 180 KiB
ceiling. Complete automatic transfer is below 1.5 MiB. Mobile LCP remains
approximately the existing v2 baseline and exceeds the 2.5-second gate.
Lighthouse's own transfer metric is retained separately from the through-readiness
network ledger; delayed graphics downloads are not excluded from release cost.

[Full performance summary](facility-validation-v3/lighthouse.json),
[through-readiness ledger](facility-validation-v3/page-measurements.json), and
[build identity](facility-validation-v3/build-identity.json).

## Release and authoring

Public release requires resolving the mobile LCP gate, physical mobile frame/
touch testing, VoiceOver with Safari, and remaining manual zoom/reflow review.
Automated WebKit and axe results do not replace those checks. Follow the existing
website release process and its broader assessment/content gates.

`FACILITY_3D_MODE=poster` is the reversible rendering rollback; `manual` and
`auto-desktop` remain available. Rebuild after changing release settings.
V1, V2, V3 and all assessment publications remain immutable. Future visual
changes use a new release ID. The editable master and generator remain outside
deployment; only registered allowlisted GLB/poster files are served.

See the [authoring and release runbook](facility-authoring.md) for the master,
generation/export commands, single-writer lease and future v4 workflow.
