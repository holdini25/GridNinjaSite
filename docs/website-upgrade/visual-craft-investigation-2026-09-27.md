# Why GridNinja’s visual craft remains provisionally 2/3

27 September 2026 · Qualification10 / private facility-v11 · Investigation, not a new release

## Conclusion

**The main gap is how much of the existing construction the final image communicates.** Important junctions have weak contact shading; broad planar surfaces receive nearly uniform reflections; small details compete with large collector planes; and the service mechanism occupies too few pixels in its whole-rack view. The mobile poster also enlarges a lower-resolution scene render. More gloss, geometry, bake samples, or GPU utilization would not directly resolve these causes.

There is a second problem: **the 2/3 score is less rigorous than its presentation suggested.** It is an AI-assisted qualitative judgment with uneven coverage, not a calibrated numerical assessment. One frozen review incorrectly called agent inspection “human inspection.” This report corrects that provenance without rewriting the historical evidence. Exceptional craft remains unestablished; a new score is not awarded.

Three parallel audits covered construction/bakes, rendering/materials, and presentation/review quality. I also ran **28 controlled browser captures on the actual M5 Pro Metal renderer**, isolating AO, normal maps, direct lights, and environment lighting. All 21 capture dependency hashes match the frozen qualification10 snapshot. No application code, model, master, material, poster, release registration, or public deployment was changed by this investigation.

## 1. Ranked causes

| Priority | Cause | What the investigation established | Appropriate response |
|---|---|---|---|
| 1 | Weak contact cues at important construction junctions | Existing AO receivers largely cover exterior/side/support surfaces. Generic paint and the rack exterior-panel tile have entirely white AO. Runtime direct lights are unshadowed and are not attenuated by the AO map. | Test one correctly mapped stationary front recess/contact receiver, with lighting held fixed; then test light balance separately. |
| 2 | Detail is too small or hidden | Front racks and collectors hide rear fronts. Homepage rack façades are only tens of pixels wide. A full 180 mm tray translation projects to **9.54 px** in the phone whole-rack view. | Improve the existing explicit service view and its presentation; assess safe projected subject framing before adding detail. |
| 3 | Broad reflections cannot describe broad flat planes spatially | The orthographic view, flat normals, almost constant roughness, and distant PMREM produce nearly constant reflection across each plane. | Preserve flat manufactured panels. Test local contact/finite illumination where physically appropriate; avoid another global gloss increase. |
| 4 | Texture investment does not match visible junctions | Paint has only 2–3 roughness code values. A collector’s 112×48 usable tile spans 5.83×0.65 m: a 14 mm seam spans only **0.27 texel** along its length. | Reallocate existing atlas space to visible, valid contacts or seam-local regions; do not confuse sample count with texel density. |
| 5 | Mobile poster acquisition undersamples the model | Capture metadata records a 340×255 scene at actual DPR 1, encoded into a 680×510 poster using a higher screenshot scale. | Capture offline at an asserted actual drawing-buffer resolution; keep the live visitor quality policy unchanged. |
| 6 | Service interaction has accumulated too many explanatory levels | Mechanical commands, multiple explanations, return/expand/assembly controls, parts, systems, and assessment context compete in a long phone inspector. | Present one current mode, one next action, one return, and one concise explanation; disclose secondary details. |
| 7 | Some intended approximations become obvious in detail views | The closed cooling intake is opaque baked relief. Some large duct sheets have sharp edges; rack wall/roof forms are deliberately substantial. | Correct only visible silhouette/construction issues demonstrated by a reference benchmark; preserve runtime ceilings. |
| 8 | The premium target lacks calibrated examples and complete review | Core stills support limitations; some other categories received 2 despite partial inspection. No independent human craft approval is established. | Separate quality, coverage, confidence, and reviewer type; define view-specific approval examples and tasks. |

The mechanisms above are confirmed where stated. Their relative aesthetic impact and the preferred remedies still require matched comparisons. An intentionally flat clean panel, repeated rack, orthographic view, or miniature format is not intrinsically a defect.

## 2. Lighting and material diagnosis

### Contact shading exists, but not everywhere it matters

The final asset contains real baked data. This is not a missing-bake failure. However, current reusable receivers emphasize collector faces, exterior panels, and rack sides/supports. The fixed front frame/module recess does not have a corresponding dedicated local receiver. The raw exterior-panel AO is white before later processing, consistent with the isolated receiver geometry used for that bake.

Relevant code: [receiver selection and equipment filtering](/Users/holdenchung/repos/GridNinjaSite/assets-source/facility/spatial_bake.py:16), [occluder filtering](/Users/holdenchung/repos/GridNinjaSite/assets-source/facility/spatial_bake.py:93), and [material binding](/Users/holdenchung/repos/GridNinjaSite/assets-source/facility/surface_bake.py:275).

The pinned Three shader applies AO to indirect diffuse/specular contributions. The direct directional/point contributions remain unoccluded. This is the intended lighting model, not a broken shader. Consequently, making an AO map darker cannot restore every shadow relationship under direct fill. Conversely, darkening all indirect light would crush already-dark supports. The recorded stationary support AO is already strong. See the [pinned AO shader](https://github.com/mrdoob/three.js/blob/r186/src/renderers/shaders/ShaderChunk/aomap_fragment.glsl.js).

A new receiver must correspond to actual stationary construction and valid occluders. Keep door, tray, panel, rotor, and removable-cover exclusions. Never bake a neighboring rack’s shadow into a reusable standalone specimen or paint arbitrary halos onto empty flat panels.

### The PMREM softboxes are not finite lights surrounding each cabinet

The environment is a directional radiance map created once at resolution 128. Its source rectangles become directions/angular extents in that map. They are not runtime area lights positioned beside each visible surface.

In the pinned shader, reflected radiance depends on the normal, view direction, and roughness; it does not use fragment world position to locate a nearby softbox. With an orthographic camera and a flat, nearly uniform panel, those inputs are almost constant. Moving a PMREM rectangle may change the brightness of the whole panel without creating the desired spatial reflection. See [environment generation](/Users/holdenchung/repos/GridNinjaSite/src/lib/facility/render-environment.ts:45) and the [pinned environment shader](https://github.com/mrdoob/three.js/blob/r186/src/renderers/shaders/ShaderChunk/envmap_physical_pars_fragment.glsl.js).

The existing point light can create spatial falloff, but it is shadowless and is not a broad area reflection. Prior small intensity changes did not establish a premium improvement. The next experiment should isolate the missing construction cue, not repeat arbitrary brighter/dimmer settings.

A finite rectangular light is one later hypothesis, not an approved fix: Three supports it for PBR materials, with additional LTC resources and no shadow support. It cannot itself solve missing occlusion. Any prototype must measure shader, allocation, and mobile costs before adoption. [Official RectAreaLight documentation](https://threejs.org/docs/pages/RectAreaLight.html)

### Texture uniformity is intentional, but very restrained

The final paint finish is approximately 0.45 roughness, nonmetallic, with map factors of one. Its authored variation is ±0.003 before quantization. Actual paint texels contain values 114–116; several panel regions contain only 114–115. Filtering reduces that contrast further. Painted panels intentionally have no normal map; the baked normal texture is applied to grille/fin surfaces.

These choices are consistent with clean powder coating and the requested subtle shine. They do not establish that more grain would look better. The first useful improvement is local construction depth; broad finish variation should be tested only if that is still insufficient. Do not add dirt, arbitrary noise, curved flat panels, or globally metallic paint.

Metal palette choices also matter: a dark base color on a metallic material reduces reflected energy, so exposed steel can approach the coating’s apparent darkness. A targeted documented steel finish may differentiate a rail better than changing the entire facility. This remains a hypothesis requiring a finish coupon, not a demonstrated numeric material error. [Three material model](https://threejs.org/docs/pages/MeshStandardMaterial.html)

### Controlled contribution tests

I captured seven conditions in each of four views: baseline, AO disabled, normal detail disabled, direct lights disabled, environment disabled, AO diagnostic, and roughness diagnostic. The views were the 706×415 desktop overview, 356×267 phone overview, and 356×419 whole-rack/service-detail phone views.

The actual renderer reported **Apple M5 Pro / ANGLE Metal**, Three revision 186, and four MSAA samples. Each capture used a fresh context, the same asset/profile/camera/exposure within its comparison, and frozen activity. The direct-light-off probe retained the hemisphere light. These are mechanism probes, not alternative finished designs or performance qualification.

- **Removing direct light** loses much of the fan/collector illumination. Direct light supplies a significant visible component.
- **Removing the environment** makes the cabinet fronts much darker while leaving strong top highlights. The environment already performs useful separation; simply removing it is harmful.
- **AO-only overview** is mostly white except for limited local contact regions. This agrees with decoded texture coverage.
- **Removing normals** loses real grille/fin detail. Normal mapping is working, but is not supplying spatial detail to the large painted planes.
- **AO-off differences** are comparatively localized. This supports limited coverage/contribution, not a claim that the AO stage is broken.

No claim that an ablation looks “better” follows from its pixel difference or brightness. Results and all images: [ablation report](/Users/holdenchung/repos/GridNinjaSite/build/qa/craft-investigation-20260927/ablation01/report.json).

## 3. Geometry, camera, and pixel budget

The model has real construction: frame, panels, rails, roof opening, exhaust collar, door hinge, tray, parked connector, coils, headers, guards, and rotors. Correctness work has not been wasted. Much of it is simply less visible in the composition than large continuous planes.

### Overview

The front row and return collectors geometrically obscure rear rack fronts. Additional texture detail cannot reveal an occluded object. The phone overview already uses approximately 89% of stage width according to a declared brightness-threshold measurement. Blindly increasing its zoom would crop the facility.

At the desktop fixture’s current framing, a millimetre perpendicular to the view corresponds to about 0.037 CSS pixels; a 1–2 mm bevel is deeply subpixel. Such bevels can still contribute integrated highlights, but adding many more will not reveal full-size manufacturing detail. Improve recognizable recesses, joints, silhouettes, and hierarchy at the actual display size first.

Safe experiments include fitting actual authored part bounds instead of a conservative enclosing box and testing a small azimuth/target/crop change with retained elevation. Preserve all four fans, topology, recognizable orientation, and the actual service clearances. Do not repeat the rejected higher-elevation or formed-lid experiments without new evidence.

### Rack service

Using the executed orthographic camera and frustum, the correct 180 mm translation projects to **9.536 px at 356×419**. This calculation is recorded in [source-check.json](/Users/holdenchung/repos/GridNinjaSite/build/qa/craft-investigation-20260927/source-check.json). It is not a physical-phone observation.

The whole-rack view reserves safe swept extents and shows a tall enclosure. The service-connection close-up already makes the actual rails and disconnected connector much easier to inspect. Its discovery and adjacent controls offer more leverage than an exaggerated stroke or more internal ornament.

Keep the mechanical camera stationary while parts move, maintain the 180 mm travel and interlocks, and preserve explicit closer inspection. Review the entire task at phone size: open door, extend tray, inspect the connection, return. Existing sampled motion/interlock passes establish correctness, not unassisted comprehension or an “organic” feel.

### Construction approximations

Confirmed lower-priority contributors include opaque closed cooling relief, substantial rack wall/roof forms, sharp large duct edges, and repeated module shapes. Some are deliberate stability or memory choices. They warrant specific benchmarks where visible, not wholesale rebuilding. The rack grille’s derivative rule deliberately becomes opaque when holes cannot resolve; removing that protection risks shimmer.

Current normal/UV preservation is sound in the inspected paths. There is no evidence supporting a return to the historical explanation that batching drops all normals or every cabinet samples one UV.

## 4. Poster and website presentation

### Mobile poster softness

The poster capture requests screenshot device scale 2 while the adaptive renderer remains Economy/DPR 1. Metadata records **340×255 CSS / actual DPR 1 / encoded 680×510**. The result has more encoded pixels than independently rendered scene samples. Compression and slightly different live CSS size also affect the observed softness; upscaling is not proven to be its only cause.

The corrective experiment is an offline capture at an asserted drawing-buffer resolution, followed by bounded WebP encoding and actual-size review. It does not require increasing live phone DPR. Assert canvas buffer size, camera, material/light profile, and bytes. Recheck poster/live transitions and automatic transfer. See [poster capture](/Users/holdenchung/repos/GridNinjaSite/scripts/facility/capture-posters.mjs:101).

### Service hierarchy and spatial cues

The service interface exposes many levels in succession. In the inspected phone control capture, the system rail appears roughly 1,300 px below the inspector top. Three disabled mechanical actions in close-up precede the explanation that returning to the whole assembly is required to move parts.

The fixed handle rail keeps labels off the tray—a useful improvement—but no longer spatially tracks the authored part. Choose either a clearly labeled adjacent action rail or bounded focus-only part references/leaders. Do not add continuously moving labels or another animation loop.

A bounded presentation experiment should consolidate to one mode heading, one next action, one return, and one short explanation. Optional anatomy and other-assembly actions can be disclosed. Preserve native equivalents, selected equipment, assessment context, scope, and exact evidence links. Code: [engineering controls](/Users/holdenchung/repos/GridNinjaSite/src/components/facility/facility-engineering-controls.tsx:70), [inspector ordering](/Users/holdenchung/repos/GridNinjaSite/src/components/facility/facility-inspection.tsx:588).

### What is already working

Recorded layouts show both homepage CTAs at 1366×768, request/result/commercial question before the mobile viewer, and the assessment heading/Name field below the sticky header. The continuous black palette and borderless stage are coherent. Those achieved goals should remain controls, not become another redesign project.

The homepage inspector’s height leaves a large quiet area beneath its shorter left copy. A compact caption/explanation comparison may improve whole-page rhythm, but page length and negative space are not defects by themselves. No conversion or comprehension improvement can be inferred without visitors.

## 5. Causes not established, or ruled out in the inspected scope

| Suspected explanation | Finding |
|---|---|
| M5 Pro cannot render sufficient quality | Unsupported. The actual GPU rendered all 28 diagnostics successfully. The limiting factors identified here are inputs, sampling, and presentation. |
| Wrong texture color spaces / double conversion | No demonstrated fault. Runtime binds color as sRGB, normal/ORM as data; output uses sRGB with ACES. This matches the [official color workflow](https://threejs.org/manual/pages/color-management.html). |
| Lost custom normals or absent paint UVs | Not supported by final export reports, decoded attributes, or current images. |
| Roughness multiplied twice / paint accidentally metallic | Ruled out for inspected final material bytes and bindings. |
| Missing texture or bake stage | Ruled out. Real mapped detail and contact fields are present; their coverage and scale are the concern. |
| Insufficient Cycles samples | No noise-led cause demonstrated. More samples cannot add a missing receiver or improve texel density. |
| PMREM 128 is inherently inadequate | Not established for broad reflections at this roughness. More resolution does not add local position-dependent lighting. |
| More runtime ray tracing, bloom, or dynamic shadows are required | Not established. Lower-cost contact, framing, poster, and hierarchy experiments remain untried. |
| More shine is the obvious fix | Unsupported and contrary to the approved preference. Hold mean paint roughness at 0.45 for the first experiments. |
| Normal-map handedness, grille mip bleeding, tone-map compression, or selected emission explain every flat panel | Not established. These remain specific hypotheses for targeted coupons/transitions; semantic emission is not a cause of neutral unselected paint uniformity. |
| Current mechanical sequencing is broken | No new gross mechanical failure found in the reviewed frozen evidence. Correct sequencing and visible comprehension remain different questions. |
| Physical-display black crush / cross-GPU shimmer | Unresolved. Emulation and these static Metal captures cannot settle them. |

Single-pass rendering and the approved clean miniature style are constraints, not demonstrated root defects. Avoid adding feature complexity as a proxy for craftsmanship.

## 6. Correct the scoring process

The frozen [mechanical/art review](/Users/holdenchung/repos/GridNinjaSite/build/qa/gpu-release-20260927/final-mechanical-art-review03.json) was produced by an AI agent. Its “human inspection” wording is incorrect. The additive [review provenance erratum](/Users/holdenchung/repos/GridNinjaSite/build/qa/craft-investigation-20260927/experience-and-rubric.md) records the correction; no human approval is claimed.

Three core judgments have concrete supporting observations: surface readability, composition, and mechanical clarity. Poster/live consistency, fine-detail stability, and loading/error finish had partial coverage. Missing coverage must be recorded as partial or not assessed, rather than assigned an automatic 2. A 2/3 ordinal score is not “67% finished.”

For each category record **score, reviewed states, confidence, reviewer type, source/build identity, and evidence** separately. Do not average away a weak category. Keep correctness, aesthetic preference, usability, accessibility, and evidence completeness distinct.

Agree actual-size visual references for the intended graphite miniature and concrete tasks before the next iteration. Exceptional craft should require independently accepted material/readability comparisons and unassisted understanding of the mechanism. “Miniature,” repetition, flat manufacture, or not resembling a path-traced marketing still should not be automatic negatives: miniature is the approved direction, and the browser is the delivery target.

## 7. Highest-yield next sequence

1. **Repair the review contract.** Choose two or three relevant references and state-specific acceptance examples. Preserve this baseline and rejected trials. Identify AI, human craft, accessibility, and participant reviewers accurately.
2. **Fix offline poster sampling in an isolated candidate.** Assert actual render resolution; compare sharpness at 356 CSS px without raising runtime cost. Retain only a visible improvement inside byte budgets.
3. **Refine service presentation and framing.** Use the real phone stage and HTML actions. Keep the whole-rack context and explicit detail entry; hold the camera during mechanical travel. Test unassisted comprehension before changing easing.
4. **Benchmark one stationary rack-front contact.** Keep color, 0.45 roughness, camera, exposure, and existing atlas sizes fixed. Reallocate a low-information region only with valid surface ownership. Inspect closed/open/service/cutaway for false permanent shadows.
5. **Benchmark one collector/cooling junction and light balance.** Change one variable at a time. A finite-area-light prototype is optional only if the simpler contact test does not solve the observed deficiency; measure its resources.
6. **Propagate only demonstrated gains.** Capture neutral/selected views at actual home/demo/phone sizes and full motion; enforce existing resource, lifecycle, transfer, and performance gates. Obtain independent human craft approval before claiming 3/3.

Stop an experiment if its improvement appears only in oversized macro renders, loses subtle shine, crushes dark detail, obscures the assessment, or violates construction/motion correctness. This investigation does not register v11, reopen public deployment, or resolve outstanding physical-device, native Safari, human, and operational release gates.

## Evidence and reproducibility

- Candidate build: `VuTD3LxDMHdNeF23wPRmy`.
- Application source fingerprint: `7db9b9553765394656e1853199ce9b067d5285c148b1f88a62565e7f7c994ef5`.
- Facility manifest SHA-256: `6f5e4a71f56de668697a3b66b13647fe3249ee5f1638b7b984461ad6602cc419`.
- [Construction audit and exact texture/projection data](/Users/holdenchung/repos/GridNinjaSite/build/qa/craft-investigation-20260927/construction.md).
- [Rendering/material audit](/Users/holdenchung/repos/GridNinjaSite/build/qa/craft-investigation-20260927/rendering.md).
- [Presentation, poster, and rubric audit](/Users/holdenchung/repos/GridNinjaSite/build/qa/craft-investigation-20260927/experience-and-rubric.md).
- [28-capture browser experiment](/Users/holdenchung/repos/GridNinjaSite/build/qa/craft-investigation-20260927/ablation01/report.json).
- [Source parity and phone travel calculation](/Users/holdenchung/repos/GridNinjaSite/build/qa/craft-investigation-20260927/source-check.json).
- [Investigation evidence index](/Users/holdenchung/repos/GridNinjaSite/build/qa/craft-investigation-20260927/index.json).

Coverage is comprehensive across the principal construction, texture, lighting, shader, camera, sampling, presentation, and scoring paths. It is not a claim to have experimentally eliminated every possible perceptual or device-specific cause. New work consists of read-only audits and isolated diagnostic captures; no full application regression suite was rerun because application and asset bytes were unchanged.
