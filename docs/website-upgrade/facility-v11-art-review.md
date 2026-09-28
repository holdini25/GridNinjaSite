# Facility v11 — art review and release hold

**Decision: keep v11 unregistered.** The candidate is a measurable construction
and texture improvement, but the reviewed core compositions remain **2/3**.
They do not meet the approved premium gate of 3 for readability, composition,
and the complete interaction journey. The latest explicit service-detail view
now reaches 3 for subject visibility; this does not raise the whole facility
score. The integration lead independently reached the same
judgment. Successful asset validation must not be presented as art approval.

## Historical review — before the finite-light and explicit-service-detail candidate

This section preserves the earlier attempt and its findings. Its hashes, camera
choice and “current” descriptions are historical; the dated RC21 review below
is the authoritative description of the latest candidate.

### Scope and evidence

Reviewed the current desktop/mobile overview and rack service captures in
`build/qa/enterprise/art-benchmark/`, plus gray, normal, roughness, and final
material benchmark channels. The lead produced the captures on native Apple
M5 Pro Metal. The asset agent reviewed the lead's lighting independently, but
authored the spatial bake and camera changes: this is internal cross-review,
not external artistic or participant validation.

`build/facility/facility-v11/art-review.json` pins the exact reviewed image and
model hashes. Final model hashes begin `3ef74825` (overview), `cf810f91` (rack),
and `8cd9db69` (cooling). The earlier channel benchmark is retained as
`asset-material-benchmark-superseded-attempt04`; the final benchmark pins the
current models and runtime sources independently.

| Category | Score | Finding |
| --- | ---: | --- |
| Surface readability/material credibility | 2 | Neutral black is retained and seams are clearer, but large planes still read flat. Powder-coat sheen and local contact depth are not yet convincing at normal page size. |
| Composition/selected-subject visibility | 2 | Both rack rows and all four fan positions are discernible. Fan-face contrast is weak and collectors dominate the upper view. |
| Mechanical clarity | 2 | Door and tray states are distinguishable. Taller mobile framing helps, but the actual rail and disconnected connector remain too small for useful inspection. |
| Control hierarchy/discoverability | Not run | Isolated stage captures cannot establish the full interaction journey. |
| Poster/live and cross-page consistency | Not run | Matching browser posters have been captured; full-state human review is separate. |
| Fine-detail stability | Not run | Still normal/roughness channels do not establish temporal stability. |
| Loading/error/still-state finish | Not run | Not established by this focused art comparison. |

### What changed, and what was rejected

- Actual evaluated rack, collector, and cooler construction now supplies
  spatial AO and neutral illumination in existing UV/texture allocations.
  The stronger bounded bake produces linear ranges of 0.707–1.0, 0.618–1.0,
  and 0.55–1.0 respectively. It helps local depth but does not make the whole
  facility exceptional.
- A more frontal rack camera reduced visible tray extension and was rejected.
  The current elevated three-quarter view and taller phone stage expose more
  of the tray top, while preserving 180 mm travel and the door interlocks.
- The initial side reflection was in the wrong reflected hemisphere. Correct
  reflection directions at high radiance then turned the assembly silver and
  washed out copper. That attempt is preserved, not accepted. Reduced neutral
  radiance restores black, but broad planar response remains fairly uniform.
- Long diagonal handle leaders were replaced by short, restrained markers.
  Native HTML actions remain the reliable interaction equivalent.

### Focused next art work at that historical review

1. **Use one rack/collector/cooler benchmark to improve local illumination.**
   Work specifically on collector flange/contact separation, rack side/front
   relationships and fan-face contrast. Preserve neutral paint, copper color,
   and the current single-pass/resource limits. Review at actual page size,
   not only an enlarged render.
2. **Make spatial reflection a deliberate design problem.** In the fixed
   orthographic view, flat normals and a distant environment naturally produce
   near-uniform response over a plane. Raising the environment globally already
   failed. Investigate spatial light/reflection shaping on the benchmark, with
   an explicit browser cost and artifact check, before applying it site-wide.
   No new rendering technique is approved by this report.
3. **Provide a purposeful service-part view if whole-rack framing cannot show
   the construction.** An explicit idle tray close-up can retain context and
   keep the camera stationary while parts move. Do not exaggerate the physical
   180 mm travel, silently hide the side panel, or imply a connected service
   cable that is not modeled.
4. **Review the complete journey before approving interaction quality.** Use
   the real header, adjacent actions and explanation at 390 px. The stage-only
   screenshots do not prove that a visitor can discover or operate the rack.

These are remaining craft decisions, not a promise that additional tuning will
earn a 3. The existing geometry may be sufficient, but that has not been
demonstrated in the browser.

### Engineering status and release boundary at that historical review

The current assets pass geometry, semantic, texture, spatial-UV and mechanical
export validation. The overview remains 35,472 rendered triangles including
LEDs, 39 draws and nine runtime materials. Repacking and stronger encoded
illumination add no texture allocation or material batch. Frozen v1–v10 hashes
were verified unchanged in `frozen-prior-release-hashes.json`.

Candidate poster, state and motion captures are useful review deliverables;
they do not authorize freezing or public deployment. Qualifying software with
the explicitly selected frozen v10 is a separate exercise. It does not remove
this v11 art gate, prior visual shortcomings, mobile/device requirements, or
manual accessibility and operational release gates.

## RC21 integrated website review — 25 September 2026 UTC

**Decision remains: do not register or publicly release v11.** The finite light,
cleaner graphite finish and real service close-up are useful improvements.
Root's independent review accepts **3/3 for service-subject visibility**, while
**overview material credibility and composition remain 2/3**. This meets a
useful illustrative engineering standard; it does not establish the agreed
premium 3/3 core visual bar. These scores must not be averaged.

### Evidence and reviewer limits

The actual website, rather than only the isolated material fixture, was captured
in `build/facility/facility-v11/review/`. `review-capture.json` records 60 passing
states, no browser errors, desktop DPR 1/1.5 and emulated mobile DPR 1, on Chrome
154 with the actual **Apple M5 Pro ANGLE Metal** renderer. Its SHA256 is
`b5759912115e15b5857e626d3dff2b6ae01e84826add9fab89750275655d0cf5`.
The report deliberately uses still/reduced-motion states; it is not a cadence,
thermal, physical-phone or animated fine-detail test.

This review inspected home/demo live and poster stages, Power/Cooling/Storage/
Workloads selections, all six closed/cutaway/service specimen poses, and the
new service-connection view with surrounding controls on desktop and mobile.
The reviewer authored the asset experiment and therefore supplies an **author
review**, not independent artistic approval. The integration lead and experience
reviewer independently supplied the core scores. Participant and external art
review have not occurred.

Key actual-page images:

- `review/home-desktop-dpr1-live.png` and `home-mobile-dpr1-live.png`.
- `review/demo-desktop-dpr1-rack-service.png` and `demo-mobile-dpr1-rack-service.png`.
- `review/demo-desktop-dpr1-rack-service-connection-controls.png` and
  `demo-mobile-dpr1-rack-service-connection-controls.png`.
- `review/demo-desktop-dpr1-cooling-cutaway.png` and
  `demo-mobile-dpr1-cooling-service.png`.

The captured assembly explanation still listed all twelve facility racks;
root identified this misleading context and is correcting it. Full-page captures
also show unpainted offscreen `content-visibility` regions; the experience agent
is correcting the capture preparation. Neither known defect should be hidden
by an art score. The affected full-page/context images require recapture before
being used as final layout evidence. No additional high-severity geometry,
clipping or resource defect was identified in this still-image review.

### Current rubric

| Category | Score | Evidence-backed judgment |
| --- | ---: | --- |
| Surface readability/material credibility | 2 | Spatial reflections now reveal collector/cooler form, paint mottling is restrained, and copper retains its role. Broad top and side planes still read as simplified uniformly shaded panels at ordinary page size. |
| Overview composition/selected-subject visibility | 2 | Both rows and all four fan positions remain identifiable. Collector roofs dominate the upper silhouette, while the rear row fronts and fan construction remain small. Storage/workload selection in a small mobile stage is more legible in HTML than from the restrained visual response alone. |
| Service-subject visibility | 3 | Explicit cutaway close framing resolves the real rails, tray, fixed parked plug, moving receiver and gap. Native Return restores the whole assembly. No invented scale enlargement or through-wall visibility is used. |
| Mechanical motion quality | Not run in this review | Still endpoints do not establish velocity continuity, reversal quality, hidden-time behavior or picking during motion; root's native motion probe is separate. |
| Control hierarchy/discoverability | 2 | Whole-rack and close-up are clearly separate, with native actions and an adjacent Return. The mobile close-up still carries three partly repeated technical paragraphs and several disabled mechanical actions; this is understandable but not exceptional economy of presentation. The misleading twelve-rack caption requires the tracked correction. |
| Poster/live consistency | 2 | Matching browser posters retain the neutral-black field, material color and reviewed framing in the compared stages. Corrected full-page context still needs fresh evidence. |
| Fine-detail stability | Not run temporally | Static DPR 1/1.5 views retain module seams and contact faces. These cannot establish shimmer/aliasing while rotating or transitioning. |
| Loading/error/still-state finish | Not run as a complete category | The static poster fallback is useful and matches the stage. Loading, failure and retry journeys were not exercised by this read-only visual review. |

### What the latest candidate actually changes

- A **single optional PointLight** replaces the former third directional fill;
  no shadow map, postprocessing pass, new texture, material or draw is added.
  Inverse-square decay is 2 and distance is 0. Overview position
  `[-2.8,6,-3.4]` at 18 cd, rack `[2.4,.45,-1.7]` at 3 cd, cooling
  `[2.4,1.5,-2]` at 6 cd. The shared `industrial-night-v3` PMREM remains 128.
  Asset commits bind the appropriate light profile atomically; legacy profiles
  have no finite-light field.
- Painted faces retain roughness 0.42; sinusoidal variation shrinks from amplitudes
  .010/.006 to.002/.001. Metal/grille roles retain their own finish. Coil normal
  relief settles at 1.8 mm after matched 6 mm and 0.8 mm comparisons, retaining 42 bands
  and 6 mm cross rails.
- Collector tops receive authored flange-contact AO in the existing atlas.
  Direct spatial color illumination is neutralized for this dynamic-light
  candidate to avoid double lighting. AO supports indirect contact depth; it
  does not pretend to cast a dynamic point-light shadow.
- The adopted whole-rack camera is `[3.2,3.7,5.8]`, targeting
  `[-.05,1.35,.20]`. This new frontal benchmark replaces the historical camera
  judgment above. The separate explicit service camera is `[2.2,2.35,1.55]`,
  target `[.015,1.48,.17]`, fitting the real tray/rail/connector region with 12%
  padding. The side panel is explicitly cut away; movement returns to whole
  assembly framing.
- Existing-envelope connector bodies now use dark insulation, a small exposed
  contact face and a strain relief aligned with the existing cable. The fixed
  parked plug remains under `GN_RACK_POWER`; the receiver moves with
  `GN_RACK_TRAY`. No flexible cable connection is implied during extension.

### Frozen-candidate identity and measured resources

These are candidate hashes, not a registered immutable release:

| Asset | Bytes | SHA256 |
| --- | ---: | --- |
| Overview | 2,215,888 | `9409b7b699aed791e95568a2b1dd6836a7d9e947088038157c107762b816f9a6` |
| Rack | 734,080 | `ba18b9eaed403c01903bd74233daf39f7848cfa52f994ab183252a74533bd97e` |
| Cooling | 321,668 | `00986b4f6f3aaa7adc5351c4bb82e4537deccdfeb635693e8e3cbe37750f47b7` |

The reviewed profile hash is
`7e626f6d2ebe31aeca1f9dfec9fcdd24a86e2b00b93d48d57c3cfc1690609f5c`.
`capture-profile.json` records the new browser poster hashes. Earlier posters
and handoff images were explicitly superseded; frozen v1–v10 remain unchanged.

Actual website snapshots report:

| Asset | Maximum observed draws / triangles / materials | Retained allocation including environment |
| --- | --- | ---: |
| Overview | 39 / 35,472 / 9 | 7,971,558 bytes |
| Rack | 26 / 10,056 / 8 | 6,230,217 bytes |
| Cooling | 17 / 4,162 / 7 | 5,722,436 bytes |

The rack retains 61,239 bytes below its 6 MiB limit. The largest observed staging
estimate is 12,104,623 bytes, below the 16 MiB target and 32 MiB ceiling. These are
renderer accounting estimates, not OS memory-pressure measurements. The review
has no frame-time samples (`frameP95` is null), so it cannot qualify performance.
Initial-JS, total transfer, LCP/CLS/TBT and final native motion checks remain in
the separate frozen-candidate qualification record.

### Blender and hardware provenance

Authoring uses pinned native Blender 5.2.2 LTS, build `d13f752e3b9c`. Complete earlier
trials used Apple M5 Pro Metal for larger bakes and CPU for small spatial receivers.
The first Metal run aborted in binary archive lookup; a process-scoped
`CYCLES_METAL_DISABLE_BINARY_ARCHIVES=1` retry completed. Later two attempts
stalled in `MetalKernelPipeline::compile`, with read-only process samples and
cancelled logs retained. Only owned background writers were stopped; the user's
interactive Blender, global preferences and caches were left untouched.

The final complete export used an **explicit CPU, two-thread bake fallback** approved by
the integration lead. `bake-report.json` records the final actual backend;
previous Metal attempts remain historical evidence. Native Metal browser output
was then reverified, including 112 four-channel material captures and four tight
service captures before the integrated 60-state website review. None of these
records imply that the final Blender bake ran on the GPU.

### Remaining work toward the premium bar

Preserve this reviewed candidate and qualify its software separately. The next
bounded art pass should address:

1. **Overview hierarchy:** make the two rack rows and cooling fan faces read
   immediately at the real 706 px desktop / 356 px mobile stage while reducing the
   visual dominance of blank collector roofs. Judge whole-page images and the
   four selected states, without enlarging service parts or adding machinery.
2. **Material form:** demonstrate a continuous, restrained reflection gradient
   and local contact separation on one rack panel, collector flange and cooler
   under unchanged exposure. The pass must retain neutral paint, visible copper,
   existing draw/material/texture limits, and avoid the rejected silver roofs or
   cloudy low-frequency roughness. The current simple surfaces remain 2/3.
3. **Service explanation economy:** after the known context-label correction,
   make one concise explanation and Return action sufficient to understand the
   parked plug/receiver gap. Move repeated technical qualifications into the
   existing disclosure, preserving visible synthetic scope. Test the complete
   discovery-to-return journey with representative visitors.
4. **Final evidence:** recapture corrected whole pages, review actual motion at
   DPR 1/1.5, perform manual accessibility and physical-device checks, and retain
   an independent art decision. Do not promote a still screenshot or automated
   success into a 3/3 claim.

Public release remains gated. V11 is an unregistered local visual candidate;
software qualification on frozen v10 does not approve these visual changes or
remove the external device, accessibility, usability and delivery requirements.

### Integrated follow-up, 25 September 2026 04:06 UTC

The corrected website capture completed all 60 scene states. Four whole-page
images first visited the actual page, then temporarily enabled offscreen paint;
their reports verify unchanged geometry within 1 px and exact style restoration.
This conditioning is screenshot-only. Separate native scrolling evidence confirms
the footer and deferred sections render normally without production CSS changes.
The assembly caption now identifies the representative specimen, not twelve
overview racks retained as navigation context.

`build/qa/enterprise-rc21/service-native-attempt03/report.json` passes the actual
desktop and touch-emulated M5 Metal journeys: intermediate tray travel, camera
interlocks, resize picking, explicit cutaway, return, Pause/reduced motion,
unchanged assessment/publications, and the same canvas/context with only the
overview and explicitly requested rack downloads. Attempts 01/02 are preserved:
screenshot-induced desktop hover caused one legitimate feedback frame. After
explicit pointer exit and bounded settling, the unchanged 300 ms observation
records no frames, scheduler requests, or clock progression. No runtime motion
rule was relaxed. This development-preview evidence does not qualify production
startup or physical mobile hardware, and does not change the art scores above.
