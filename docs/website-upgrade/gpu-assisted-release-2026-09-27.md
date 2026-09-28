# GPU-assisted visual refinement and release completion

Status: refined private candidate built and archived; local automated qualification recorded. Premium craft, native Safari and external release gates remain open. This document does not approve public release.

[Open the portable qualification report](../../build/qa/gpu-release-20260927/final-report/report.html) · [Current evidence index](../../build/qa/gpu-release-20260927/CURRENT.json)

## Release decision

**No-go for public release.** The final ledger has nine passing gates, two failing
gates (native Safari and premium craft), and ten blocked gates. Local and public
readiness are both false. No deployment, migration or real inquiry delivery was
performed. The implementation, existing build and evidence are preserved for
continuation.

## Current candidate

The current private artifact is `gpu-release-qualification10`, build
`VuTD3LxDMHdNeF23wPRmy`, at
`/private/tmp/gridninja-premium-v11-qualification10`. Its application source
fingerprint is `7db9b9553765394656e1853199ce9b067d5285c148b1f88a62565e7f7c994ef5`;
its QA harness fingerprint is
`43f5db04566b3d39de7f9406311394f1e7286e9783e487f82797ea01e7df880c`.
The private v11 manifest is
`6f5e4a71f56de668697a3b66b13647fe3249ee5f1638b7b984461ad6602cc419`.

The production build uses adaptive 3D and enforced CSP, but local HTTP, a test
verification key, and no production observability. It cannot establish the
production-configured performance gate. The canonical repository still defaults
to v10; v11 registration exists only in the isolated qualification checkout.

## Implemented construction and authoring work

- The shared rack kit now has square mounting-rail openings, folded support webs,
  narrow bearing surfaces, and narrower physical bevels. The service camera is
  more frontal, retaining the door relationship and 180 mm tray travel.
- Collector seams and supports, cooling intake construction, and service-panel
  thickness were refined within the existing material batches.
- Stationary contact occlusion is restricted to its authored receiver faces.
  Moving rail geometry is excluded from permanent static contact shadows.
- CPU/Metal reference images exposed coincident exhaust shells. Removing the
  redundant overview collar repairs the overlap and saves 576 triangles and
  34,560 bytes; the independent rack specimen retains its collar.
- Paint roughness remains 0.45. The current environment, exposure, neutral black
  palette, atlas dimensions, semantic identities, and overview orientation remain
  unchanged. Rejected lighting experiments are retained.
- The Cycles laboratory now renders beauty, gray, normal, roughness and AO
  diagnostics, preserves float EXRs and review PNGs, checks source hashes, and
  records executed device, sampling, camera, lighting, and timing settings.
- Small evidence-link targets were enlarged and graphics-failure wording no
  longer assumes the assessment is physically below the viewer.

| Final asset | GLB bytes | Runtime triangles | Draws | Materials |
| --- | ---: | ---: | ---: | ---: |
| Overview | 2,364,860 | 35,516 | 39 | 9 |
| Rack | 675,544 | 8,456 | 26 | 8 |
| Cooling | 351,912 | 4,194 | 17 | 7 |

The overview meets the 2.5 MB ceiling and exceeds the softer 2.3 MB target.
Browser-generated desktop/mobile posters are 42,354 / 10,854 bytes. Specimen
posters range from 6,820 to 15,780 bytes. The rack derivative recovers 84,600 GLB
bytes and 1,600 triangles relative to the archived control.

## Measured CPU/GPU policy

Use four CPU threads for the complete current uncached atlas pipeline: median
8.847 seconds across three measured runs, versus 11.367 seconds for Metal,
12.618 seconds for hybrid, and 9.943 seconds for the existing mixed policy.
Atlas comparisons differ by no more than one 8-bit step. Use Metal for substantial
Cycles reference renders. The fixed 256-sample reference experiment measured
2.057 seconds for Metal versus 31.827 seconds for four CPU threads, but those
timings belong to the archived benchmark geometry, not final-candidate browser
performance. First invocations are retained and are not described as verified
cold-cache runs. Hybrid was not selected.

The corrected shell diagnostic agrees across CPU, Metal AUTO, and MetalRT ON.
One earlier Metal SIGTRAP remains recorded. No global Blender preferences were
saved, and no silent device fallback was accepted. Browser posters use the actual
M5 Pro Metal browser renderer, independently of the Cycles appearance.

## Qualification results

- The frozen build passes brand checks, lint, typecheck, 947 unit tests, isolated
  database integration, production dependency audit, publication packaging, and
  initial JavaScript gates (127.3 / 129.9 / 134.7 KiB Brotli for home/demo/assessment).
- All three GLB validators, 26 Python surface/contact tests, and seven collar
  regression cases pass. The prior overlapping asset is rejected by the new
  regression. Geometry clearance sampling preserves the rack interlocks.
- All 15 production layout captures pass overflow, desktop primary-action, and
  assessment-anchor checks. At 390 px the request, modeled revision and unresolved
  question are visible before the inspector.
- Ten poster fault/recovery/no-JavaScript cases pass their assertions in two
  complete attempts. Both exceeded Chromium’s 15-second browser-close deadline;
  the attempts remain failed despite successful isolated-process cleanup. A
  separate debug run observes the main Chrome process already exited while
  descendant updater/crash-handler processes retained output pipes. This points
  to runner/process shutdown, not an observed active website graphics leak;
  the failed attempts are retained. A separately hashed, executable-only
  amendment runs the same assertions/deadlines on pinned Chromium149 and WebKit:
  all ten cases and cleanup pass (37 ms / 8 ms browser close). This does not
  claim the installed Chrome154 updater behavior was repaired.
- The complete local Chromium/WebKit matrix passes 606 executions with 38
  policy-reviewed exclusions. Linux Firefox passes 26 critical executions with
  two reviewed project exclusions. Its official Linux container uses software
  rendering; it does not establish M5 GPU performance.
- Ten open/close cycles and ten facility/specimen cycles pass on M5 Metal.
  All 20 automatic-readiness measurements pass: 943,637–1,008,686 transferred
  bytes; fixed-60-fps capability p95 no more than 16.8 ms. Mobile profiles are
  emulation on this Mac, not phone GPU evidence.
- Service-motion verification passes desktop and phone emulation, including
  intermediate states, resize, authored cameras, and single-session ownership.
  Sixty scene states and 36 chapter states plus motion clips are captured.
  Independent review confirms door-before-tray sequencing and explicit cutaway
  behavior, while retaining the 2/3 craft score.
- Five fresh Lighthouse runs per route/profile pass the existing median gates.
  Mobile LCP medians are approximately 2.445 seconds. Individual home and
  assessment runs reach 2.531 and 2.597 seconds; these misses remain recorded.
- Native Safari reproduces a recoverable graphics fallback after the Mac is
  unlocked, including explicit Retry. Its first exception and visibility state
  remain unavailable; no renderer diagnosis or native Safari pass is claimed.
  A fresh-origin cache diagnostic was subsequently blocked when the Mac locked;
  the possible prior-private-asset cache conflict remains unconfirmed.
- Native Chrome smoke01 used an ambiguous test selector that opened the workload
  story. A separate, hashed harness amendment uses exact native activation
  roles/names. Its corrected smoke and 900-second native Chrome observation pass on the M5
  Pro Metal backend. The sustained run used DPR 1, a roughly 730 × 429 stage,
  Balanced/High tiers and deliberate 30 fps activity; it does not qualify phone
  thermals or DPR 1.5. No context losses, graphics errors or hidden frames were
  observed. The frozen application, build and original QA files remain unchanged.
- Simulator portrait captures cover compact/large phones and a tablet. They
  show the decision before inspection and the form anchor below the header.
  The compact-phone explicit inspection entry reached the facility. Full touch,
  keyboard, orientation and native-inspector journeys remain unqualified.

Independent still review scores core readability, composition and service clarity
**2/3**. Narrower construction and restrained shine improve the candidate, but the
required premium **3/3** gate remains open. Still-image review cannot establish
motion quality, phone interaction, or screen-reader accessibility.

## Candidate boundary

The control is qualification09 and its private facility-v11 assets, including the
approved 0.45 paint roughness. Canonical selection remains facility-v10. Existing
published assessments and registered visual releases are immutable.

The starting source archive, dirty-tree patch, status, and 496 input/evidence hashes
are preserved in `build/qa/gpu-release-20260927/baseline*`. The earlier temporary
qualification checkout is no longer present; its saved evidence remains historical
and will not be attributed to a newly built artifact.

The pinned Node 22.23.2 / npm 10.9.8 runtime was restored from the official Node
distribution with SHA-256 verification under `build/tools/`. No package-manager or
lockfile change was required.

## Work allocation

- Rendering: a reproducible Cycles laboratory and truthful CPU/Metal/hybrid
  measurements, with explicit sampling and cache policy.
- Construction: isolated rack/collector/cooling refinements and resource recovery;
  reviewed source changes only are eligible for canonical integration.
- QA: production-settings qualification guards, redacted capability evidence, and
  final candidate verification.
- Integration: browser comparisons, source reconciliation, serialized GPU work,
  native journeys, packaging, and the release evidence index.

GPU work is exclusive. Blender writes and final registration are serialized.
Actual browser output remains authoritative for posters and visual approval.

## Initial findings

The first controlled browser round produced 32 captures on the M5 Pro Metal
backend, comparing the unchanged finish with individual existing-light changes.
The overview changes do not yet establish a compelling improvement. The modest
rack fill increase warrants comparison with the construction candidate; no lighting
change has been accepted into the release.

Native Safari accessibility interaction is available, but live graphics fallback
remains unresolved in the unlocked session. Hosted credentials,
an isolated staging origin, a controlled test mailbox, and named operators have not
been established. Real outbound rehearsal and production qualification remain
blocked until those resources are supplied and verified. The tested preview is
served on loopback only at `http://localhost:3000/demo`; its existing build was
restarted without rebuilding after the Linux-container test completed.

## Evidence

- Final gate ledger: `build/qa/gpu-release-20260927/candidate-final.json`
- Prioritized unresolved items: `build/qa/gpu-release-20260927/defect-register-final.md`
- Control preservation: `build/qa/gpu-release-20260927/baseline.json`
- Initial browser lighting comparison: `build/qa/gpu-release-20260927/lighting01/captures/report.json`
- Final construction, editable masters, hashes and reproduction: `build/qa/gpu-release-20260927/construction/final-handoff.md`
- Regenerated asset reports: `build/qa/gpu-release-20260927/integrated-asset01/`
- Browser-generated posters: `build/facility/facility-v11/capture-profile.json`
- Compute measurements and raw-result index: `build/qa/gpu-release-20260927/cycles/compute-review.md` and `compute-evidence-index.json` in that directory
- Exact Cycles/CPU/Metal reproduction: `build/qa/gpu-release-20260927/cycles/reproduction.md`
- Independent model and page reviews: `build/qa/gpu-release-20260927/final-art-review01.json`, `final-art-review02.json` and `final-art-review02-notes.md`
- Native attempts and their limitations: `build/qa/gpu-release-20260927/native-attempt01.json`, `native-attempt02.json`
- Simulator portrait evidence and limitations: `build/qa/gpu-release-20260927/simulator01/report.json`
- Independent reconciliation: `build/qa/gpu-release-20260927/independent-draft-ledger01.md`
- Linux Firefox final attempt: `build/qa/gpu-release-20260927/linux-firefox03/disposition.json`
- Final preserved application/build and 543 raw evidence files: `build/qa/gpu-release-20260927/qualification10-evidence/README.md`
- Native Chrome sustained and visibility index: `build/qa/gpu-release-20260927/native-observation-index01.json`
- Final service-motion/visual review: `build/qa/gpu-release-20260927/final-mechanical-art-review03.json`
- Exact poster runner amendment and disposition: `build/qa/gpu-release-20260927/poster-recovery-amendment05/summary.json`
- Final preservation check: `build/qa/gpu-release-20260927/preservation03.json`
- Staffed external closure checklist: `build/qa/gpu-release-20260927/external-closure-checklist03.md`

The evidence distinguishes pass, fail, blocked, not run, and superseded, with
source/build/settings identity attached. No partial experiment changes the prior
2/3 visual craft score or establishes public readiness.
