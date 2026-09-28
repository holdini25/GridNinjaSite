# Facility v2: adversarial hardening and neutral black release

Historical v2 evidence. See [facility-v3 implementation and validation](facility-v3.md)
for the current local engineering miniature.

Recorded 22 September 2026 locally (23 September UTC). This is a local production
preview, not a public deployment. It supersedes the implementation measurements
in [the preserved v1 report](facility-validation.md). The immutable v1 visual
release and all assessment publications remain unchanged.

**Public release remains on hold:** the five-run simulated mobile LCP medians
are 2.757 seconds on home and 2.756 seconds on the demo, exceeding the unchanged
2.5-second gate. Physical-device and manual accessibility checks also remain.

## Changes delivered

| Review finding | Implemented correction | Evidence |
| --- | --- | --- |
| Navy surfaces conflicted with the requested art direction. | Neutral black site tokens, backgrounds, borders, diagrams and metadata; graphite/steel facility-v2 with restrained copper. Canonical logo artwork stays unchanged. | Responsive browser checks and [five-state contact sheet](facility-validation-v2/contact-sheet.png). |
| A responsive poster decode could complete after its source changed. | Source- and generation-aware decoder; old promises cannot authorize automatic activation or overwrite current failure state. | Poster decoder and responsive component regression tests. |
| Partial parsing and accent/instance allocation could escape cleanup. | Immediate ownership of cloned geometry/materials and instance buffers; abort rejects promptly while late parser resources are disposed once. | Resource-ownership fault injection and native repeated-session checks. |
| Frame diagnostics wrote DOM attributes during animation and exposed stale timing windows. | Opt-in pull diagnostics, no frame-by-frame DOM writes, bounded timing buffer reset on motion/visibility/DPR changes. | Production diagnostics-off browser test and native frame measurements. |
| Closed mobile navigation loaded its dialog implementation eagerly. | Small native trigger lazily imports the drawer; import Retry, pending Escape, unmount cancellation and focus restoration remain available. | Navigation/browser regressions; lower initial JavaScript. |
| Network evidence could omit other origins, redirect hops and partial failures. | All HTTP origins and redirect hops counted; partial failures retained; incomplete collections fail the gate. | Collector unit tests and fresh production campaign. |
| Old/mixed or incorrectly labelled performance reports could satisfy release checks. | Build/source/release/browser/harness/settings identity; five fresh samples per route/profile; explicit profile and accessibility audit checks. | Strict summary validator and CI artifact collection. |
| Version packaging could overwrite or expose an incomplete release. | Explicit version, shared writer lock, validated staging, atomic registry publication, immutable registered identities and capture hashes. | [Fourteen packaging checks](facility-validation-v2/version-workflow.json). |

The assessment owner remains `AssessmentExplorer`. Geometry, fan rotation,
LEDs and system selection cannot alter assessment quantities, outcomes or
downloads. Homepage fixture B remains 7.0 MW requested, 5.8 MW modeled, one hour,
additional to the existing 20 MW reference. The demo preserves A–D and unknown
fixture-D cooling quantities. Synthetic scope, unestimated economics and no
operational authority remain visible.

## Frozen visual release

Native Apple Silicon Blender 5.2.2 LTS (`d13f752e3b9c`) authored the editable
master. The Python generation/export workflow is reproducible and requires no
MCP add-on. See the [authoring and release runbook](facility-authoring.md).

| Measure | facility-v2 |
| --- | ---: |
| GLB decoded size | 1,380,616 bytes |
| Desktop / mobile poster | 62,946 / 21,982 bytes |
| Rendered geometry | 27,530 triangles |
| Draw calls / materials | 39 / 10 |
| Estimated asset allocation | 2,108,822 bytes |
| Required identities | 66, including four fans and 48 LED anchors |
| Khronos validation | Zero errors, warnings and informational issues |

Model SHA-256:
`80bc6c4404047ab4e0c260e7003d0a8b7f2e70a4048cd3aab901f96fdbe6848d`.
Manifest SHA-256:
`8bfe57f6d258e8574ffbb5c486dfda3669412f80e25265f40342cc09ff247aad`.
The preserved v1 manifest digest remains
`46f03551d4d997b612f2335c122165d51d0894c173ce6603b2a988736630421b`.

Only registry-approved assets are served. Source masters and candidates remain
outside `public/` and production tracing. Production posters were captured from
the actual browser camera, lighting, materials and color profile; [capture
provenance](facility-validation-v2/capture-profile.json) pins their source bytes.

## Fans, activity lights and lifecycle

The [native verification](facility-validation-v2/native-metal.json) used headed
Chromium 149.0.7827.55 and confirmed `ANGLE Metal Renderer: Apple M5 Pro`.
Rendering DPR was capped at 1.5 on a display with DPR 2. Active frame-interval
p95 was **9.20 ms**, below the 20 ms desktop gate. This measures observed frame
cadence, not isolated GPU execution time.

All four fan quaternions changed around their authored local-Y shaft. Recorded
phases advanced from 1.02016 to 5.95264 radians. All 48 LEDs share one instanced
draw and use restrained, staggered amber pulses. All 48 colors changed between
samples (per-LED maximum channel changes ranged from 0.00222 to 0.05742).
This is illustrative activity, not real telemetry. Browser captures
were visually inspected: [before](facility-validation-v2/equipment-before.png)
and [after](facility-validation-v2/equipment-after.png).

Pause froze all fan poses, steadied the LEDs and held the rendered frame count
at 457. Equipment-off and reduced motion also froze fans and steadied lights.
Offscreen frame count stayed at 478; resume did not replay elapsed hidden time.
An initial run saw one extra demand frame after a 250 ms settling window. A
targeted 16-sample/1.6-second trace and the full unchanged verifier rerun remained
stable. No continuing animation loop was observed, and the test was not weakened.

Ten close/reopen cycles preserved GPU geometry, texture and estimated allocation
counts. Post-GC JavaScript heap changed from 9,688,812 to 10,593,368 bytes
(+904,556 bytes). Three same-document home/demo navigation pairs preserved one
canvas and stable GPU counts; heap changed from 11,320,508 after the first warmed
home visit to 11,925,900 (+605,392 bytes). These pass the bounded +8 MiB smoke
threshold, but do not prove zero retained memory or absence of a long-session
leak. Delayed-load navigation and forced context loss recovered correctly with
explicit activation/Retry, with no recorded page or console errors.

Performance-sensitive structures remain bounded: material/system mesh buckets,
stable-ID lookup maps, four raycast proxies, one LED instance batch, four shared
accent weights, and a 120-sample typed timing buffer. One frame-policy owner
controls rendering; no per-frame React state updates or scene traversal occur.

## Validation and public release

The final production build passed lint, TypeScript and all 387 selected unit
tests across 37 files. Build validation passed assessment/publication integrity,
SEO, asset integrity, route JavaScript ceilings and source/candidate deployment
exclusions. Retained build ID: `XAXezoqUa4q4e7M5uGy38`; [build identity and source
fingerprint](facility-validation-v2/build-identity.json) bind the evidence.

Initial JavaScript is **144.8 KiB on `/` and 147.9 KiB on `/demo`**, including
shared framework chunks, measured with Brotli on the build graph. Both pass
the 180 KiB ceiling and are approximately 9.3 KiB below v1. Actual HTTP transfer
is measured separately and includes deferred automatic 3D.

The [production browser matrix](facility-validation-v2/e2e-matrix.log) passed
142 checks with 18 browser-specific skips across Chrome desktop, WebKit desktop,
Chromium mobile emulation and WebKit mobile emulation. It covers assessment
A–D transitions, exact versioned links/downloads, history/reset, fixture-D
unknowns, no-JavaScript access, subsystem selection, loading policy, keyboard
and focus recovery, reduced motion, axe, metadata, deferred navigation and
320/640/1440-pixel layout checks. Inspector buttons remain at least 44 pixels
high, with at least 12-pixel control text and 11-pixel scope text.

The [additional failure/contrast run](facility-validation-v2/failure-and-contrast.log)
passed ten checks in Chromium desktop: missing poster, corrupted model,
oversized model, shared eight-second deadline, failed import with Retry,
navigation during a pending load, slow connection, offscreen activation, and
the proof-page axe checks with both motion preferences. These counts describe
the executed suites, not every conceivable browser/device combination.

Twenty fresh-context page measurements passed: five per route and desktop/mobile
profile. Desktop totals include deferred graphics code and the approved GLB
through actual viewer readiness and network settlement. Automatic mobile totals
stop before manual activation. The collector counts all HTTP origins, redirect
hops and response overhead, and rejects pending, failed or otherwise incomplete
evidence.

| Route | Complete automatic desktop transfer | Automatic mobile-emulation transfer |
| --- | ---: | ---: |
| `/` | 731,539 bytes | 253,838 bytes |
| `/demo` | 733,269 bytes | 255,568 bytes |

All totals pass the 1,572,864-byte ceiling. Active frame-interval p95 across the
page profiles was 17.1–17.6 ms, measured on this desktop host. The headed native
9.20 ms result above is a separate run. Mobile emulation is not physical-phone
performance. The local preview does not establish deployed observability traffic
or field Core Web Vitals.

Lighthouse 12.6.1 collected 20 independent fresh-browser runs, five per route and
profile. The [strict summary](facility-validation-v2/lighthouse.json) rejects
stale, incomplete, mixed-build, mixed-browser and incorrectly labelled profiles,
and enforces individual heading-order and contrast audits. Eight collector/gate
tests passed. The full campaign failed only the two mobile LCP checks:

| Profile / route | Performance | LCP median | FCP median | TBT median | CLS | Transfer median |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Desktop `/` | 100 | 619.9 ms | 284.6 ms | 0 ms | 0 | 740,065 bytes |
| Desktop `/demo` | 100 | 619.2 ms | 284.8 ms | 0 ms | 0 | 741,795 bytes |
| Mobile `/` | 96 | **2,756.7 ms — fail** | 1,204.2 ms | 1 ms | 0 | 262,364 bytes |
| Mobile `/demo` | 96 | **2,756.1 ms — fail** | 1,204.1 ms | 0 ms | 0 | 264,094 bytes |

Accessibility and best-practices scores were 100 in all profile medians. The
mobile LCP element is the existing hero introduction paragraph. Mobile does not
download the GLB automatically. Simulated timing remains the gate; the much
faster unthrottled local text paint is not substituted for it. The separate
readiness collector counts deferred desktop resources even if Lighthouse ends
before an automatic interaction. Both evidence sets are required by CI.

Report identity is checked against the controlled local build/start sequence;
it is not cryptographic attestation of an arbitrary remote server. Final reports
and their test counts apply to the recorded source fingerprint, browser and
settings, not every deployment environment.

### Reverted CSS-loading diagnostic

A separate production-build trial tested `experimental.inlineCss: true` to
remove the three blocking stylesheet requests. Four fresh mobile Lighthouse
samples showed worse LCP: 2.905/2.916 seconds for home and 2.906/2.907 seconds
for the demo. Transfer increased to 309,505/310,171 bytes despite a small FCP
improvement. No browser errors were recorded. The experiment was reverted;
the exact original configuration and production build were restored and their
identity reverified. Its results are excluded from the release campaign.

The [isolated trial report](facility-validation-v2/inline-css-experiment.json)
records both build identities, the exact config change and all four samples.
The [Next.js documentation](https://nextjs.org/docs/app/api-reference/config/next-config-js/inlineCss)
also marks this option experimental and describes global inlining and duplicated
SSR/RSC styles. No experimental CSS setting remains in the delivered config.

### Final visual review and remaining gates

The restored production build was visually reviewed at desktop and mobile
sizes: [home](facility-validation-v2/home-desktop.png),
[demo](facility-validation-v2/demo-desktop.png),
[mobile introduction](facility-validation-v2/home-mobile.png), and
[mobile inspector](facility-validation-v2/inspector-mobile.png).
Black surfaces, copper routes, HTML labels and assessment quantities remain
legible. Mobile retained the poster and explicit activation. Desktop captures
use Pause for a stable review image; automatic equipment motion remains the
default for eligible desktop sessions.

Physical iPhone/Safari GPU, thermal and touch behavior, manual VoiceOver/Safari,
and manual browser zoom/reflow remain release checks. Automated WebKit, axe and
viewport resizing do not replace them. Public deployment follows the existing
website release process. `auto-desktop` is the intended production mode;
`poster` and `manual` remain reversible settings that require a rebuild.
