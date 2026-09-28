# Facility inspection: local delivery and release validation

Historical v1 evidence. See [facility-v3 implementation and current validation](facility-v3.md)
for the engineering miniature, or [the preserved v2 hardening report](facility-hardening-v2.md)
for the first neutral black release.

Recorded 22 September 2026. The Blender-authored facility is implemented on the
homepage and `/demo`, with an editable master, generation/export scripts,
browser-rendered posters, a five-state contact sheet, and frozen visual release
`facility-v1`. **This is a local delivery; the website has not been deployed.**
Public release remains on hold because the mobile Lighthouse LCP gate fails
on both routes and physical-device/manual accessibility checks remain open.

The assessment records remain authoritative: homepage fixture B shows 7.0 MW
requested and 5.8 MW modeled for one hour, additional to the 20 MW reference;
the demo retains A–D, exact publications, history and reset. Equipment selection
changes presentation only. All examples remain synthetic, economics
unestimated, and accepted/delivered capacity not applicable.

## Reproducible asset and runtime evidence

Authoring used the native Apple Silicon Blender **5.2.2 LTS** executable, build
**d13f752e3b9c**, through its bundled Python and glTF exporter. No Blender MCP
connection was required. Repeated generation produced byte-identical GLB
content while preserving the manual-refinement collection. The master and
scripts are in `assets-source/facility/`; candidates remain in ignored
`build/facility/`. See the [authoring runbook](facility-authoring.md).

The frozen manifest pins file bytes, source hashes, the camera/lighting profile
and system/equipment bindings. Only the registry-approved model and posters
are served through the facility asset route. Source models and candidates are
excluded from deployment traces and never placed in `public/`. Existing
assessment publications were preserved.

| Asset check | Recorded result |
| --- | --- |
| Model SHA-256 | `a4fe6e2264b13772c720181db0bf7b0fe689160d4cff1e66a526593eb2109016` |
| GLB decoded bytes | 1,390,060; below 2,500,000 ceiling |
| Posters | Desktop 69,088 bytes; mobile 23,828 bytes; both below the 100 KiB target |
| Authored visible geometry | 26,954 triangles, excluding four invisible picking boxes |
| Geometry and embedded atlases | 1,315,238 geometry-buffer bytes; 786,433 estimated RGBA/mipmap bytes across two atlas images |
| Identities | 66 required identities; four verified local-Y fan shafts; 48 empty LED anchors |
| Khronos validation | Zero errors, warnings, informational issues and hints |

Evidence: [asset validation](facility-validation/asset-validation.json), frozen
manifest at `src/content/facility-releases/facility-v1/manifest.json`, and
[neutral/four-system contact sheet](facility-validation/contact-sheet.webp).
The validator's raw 27,002-triangle count includes 48 picking-box triangles;
those boxes are removed from visible rendering. Runtime LED instances add 576
triangles, producing the measured **27,530** rendered total.

The latest [native Metal run](facility-validation/native-metal.json) used headed
Chromium 149.0.7827.55 on this Apple M5 Pro. The actual WebGL renderer reported
`ANGLE Metal Renderer: Apple M5 Pro`. Browser device-pixel ratio was 2, with
the application configured to cap rendering DPR at 1.5. Active frame-interval
p95 was **9.30 ms**, below the 20 ms desktop target. This is observed frame
cadence during the sampled session, not a GPU-only timing measurement.

The same run recorded **39 draw calls, 10 materials, 39 geometries, three GPU
texture entries and 2,108,822 estimated asset bytes**, below the configured
budgets. Frames stopped after Pause and while offscreen. All four picking
regions worked; six-pixel gestures selected and a seven-pixel excursion that
returned to its origin cancelled selection. Forced context loss restored the
poster and explicit Retry created a ready session. No page/console errors
were recorded.

Ten close/reopen cycles kept the geometry, texture and estimated-allocation
counts stable. Post-GC JS heap changed from 9,601,872 to 10,318,196 bytes
(approximately +0.68 MiB), within the test's +8 MiB tolerance. This bounded
check does not establish zero retention or absence of a long-duration leak.

Three additional home → demo → home navigation pairs completed within the
same document: zero new document requests, unchanged document time origin
and exactly one canvas after each navigation. Geometry/texture counts and
estimated allocation remained stable. From the first warmed home visit to the
last, post-GC JS heap increased by 714,296 bytes (11,046,892 → 11,761,188).
Navigating away during a deliberately delayed model load cancelled the old
request; the new route stayed static until explicitly activated.

## Network and page performance

[Page measurements](facility-validation/page-measurements.json) used a local
production server, Chrome 154.0.8037.58, cold browser caches and CDP encoded
response sizes. Desktop collection waits for the actual viewer to become
ready, including scrolling the demo viewer into view; deferred graphics code
and GLB transfer are counted. Mobile's automatic total stops before explicit
3D activation, as required by its manual loading policy.

| Route | Automatic desktop transfer through readiness | Automatic mobile-emulation transfer | Initial JS, Brotli build graph |
| --- | ---: | ---: | ---: |
| `/` | 757,567 bytes (739.8 KiB) | 266,328 bytes (260.1 KiB) | 154.1 KiB |
| `/demo` | 759,317 bytes (741.5 KiB) | 268,078 bytes (261.8 KiB) | 157.1 KiB |

Both route totals are below the **1.5 MiB** whole-page transfer ceiling. The
local collector totals same-origin requests, including response overhead;
deployed third-party behavior and field Core Web Vitals are not established.
Initial JS includes shared framework chunks once and remains below the
**180 KiB Brotli** ceiling; both routes trigger the existing 150 KiB review
warning. Build-graph Brotli sizes and actual network transfer are separate
measurements. The model's local maximum-compression Brotli size is 133,688
bytes, while its measured HTTP Brotli response was 185,993 bytes including
overhead; the server uses its own compression settings.

After explicit activation and enabling equipment motion, mobile emulation
recorded frame-interval p95 of 17.0 ms on `/` and 17.1 ms on `/demo`. These are
desktop-host emulation results, **not physical phone GPU or thermal results**.
The collector's unthrottled local LCP observations are not substituted for
the Lighthouse results below.

Lighthouse **12.6.1** collected five independent runs per route/profile (20
total), using simulated desktop and mobile throttling. The retained
[five-run summary](facility-validation/lighthouse.json)
corresponds to the retained configuration. CSS-grouping and lazy-poster
experiments were reverted; their measurements are not claimed as improvements.

| Profile / route | Performance | LCP median | FCP median | TBT median | CLS median | Transfer median |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Desktop `/` | 100 | 620.3 ms | 284.8 ms | 0 ms | 0 | 766,147 bytes |
| Desktop `/demo` | 100 | 621.3 ms | 285.5 ms | 0 ms | 0 | 767,900 bytes |
| Mobile `/` | 96 | **2,758.8 ms — fail** | 1,205.2 ms | 0.5 ms | 0 | 274,903 bytes |
| Mobile `/demo` | 95 | **2,905.0 ms — fail** | 1,205.2 ms | 0 ms | 0 | 276,656 bytes |

Accessibility and best-practices scores were 100 in these samples. One desktop
homepage sample recorded 275 ms TBT; the other four recorded 0 ms, so its
median meets the 200 ms gate. The **2,500 ms mobile LCP ceiling fails on both
routes**, despite passing median FCP, TBT, CLS and transfer checks. The
performance validator correctly reports failure. These scores are laboratory
evidence, not a manual accessibility certification or a field performance claim.

## Functional checks and implementation controls

- **Unit tests:** 369 passed across 34 files in the recorded
  [unit run](facility-validation/unit-tests.log). This is the selected repository
  suite, not a claim of exhaustive coverage.
- **Production build:** passed, including 53 SEO tests, frozen assessment and
  visual-release integrity checks, first-load JS ceilings and deployment trace
  exclusions. Final retained build ID: `hB2WExeqByeDLzJTwBQnD`. The
  [build log](facility-validation/production-build.log) preserves the actual
  output. Final [lint](facility-validation/lint.log) and
  [typecheck](facility-validation/typecheck.log) also passed after the experiments
  were reverted.
- **Assessment/facility browser matrix:** 40 cases passed across Chromium and
  WebKit desktop/mobile projects. Coverage includes A–D transitions, unknown
  cooling evidence, exact downloads, history/reset, no-JavaScript assessment
  access, reduced motion, keyboard selection, automated axe checks, loading
  policy, selection independence, pause, close and retained assessment content.
- **Failure scenarios:** the eight targeted scenarios cover missing poster,
  corrupt model, oversized response, shared eight-second deadline, failed
  deferred import, navigation during loading, slow connection and offscreen
  activation. A follow-up failed-import Retry check also reached a ready scene.
  These counts describe their executed suites; they do not imply every failure
  scenario ran across every browser/device combination.
- Keyboard activation focus recovery and native pinch zoom were reviewed and
  corrected during implementation. Physical Safari/VoiceOver behavior remains
  a manual gate below.

Performance work uses specific structures: static geometry is accumulated in
material/system buckets and merged into indexed meshes; stable-ID maps bind
systems once; only four picking proxies are raycast; 48 LEDs share one
instanced draw; four accent strengths use one shared shader; a fixed-size
frame-time ring buffer measures p95 without growing history. A single render
policy stops hidden/paused work. Request generations, abort handling and
exclusive resource ownership discard stale loads and dispose session assets.
Bounded compression caching avoids repeatedly encoding the same approved GLB.
No broad scene traversal or React state update runs per animation frame.

## Public-release hold and remaining checks

1. Resolve mobile LCP on both routes and rerun the same five-run production
   measurements against the final code without relaxing the 2.5-second gate.
2. Complete physical iPhone/Safari checks: explicit loading, native scrolling
   and pinch zoom, thermal behavior, active frame cadence, pause/background
   transitions and repeated session use.
3. Complete manual VoiceOver/Safari and zoom/reflow review, including activation,
   failure/Retry, subsystem descriptions and focus recovery. Automated WebKit
   and axe results do not replace these checks.
4. Finish normal website content/release review and verify the deployed asset
   encoding, allowlist and rollback settings before public activation. Existing
   assessment delivery/provider/commercial gates remain governed by the
   website's prior release documentation.

The intended production setting remains `auto-desktop`, with explicit mobile
activation and reversible `poster`/`manual` settings. Freezing `facility-v1`
creates reviewable, immutable local assets; it does not satisfy the remaining
release gates or authorize a public deployment.
