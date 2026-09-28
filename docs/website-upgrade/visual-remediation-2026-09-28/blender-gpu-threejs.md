# Blender, GPU engineering, Three.js, mathematics and physics

28 September 2026 · Technical companion to the [visual remediation plan](plan.md) · Proposed work

## Decision

Use **Blender to create the photographic scene and motion, GPU engineering to make production and delivery efficient, and Three.js to make the facility inspectable**. Mathematics and physics support all three through correct projection, light transport, motion, sampling and system relationships. The user-selected homepage remains a cinematic animation. Three.js remains the interactive demo renderer. Both derive from the same equipment master and semantic identities.

Spend sophistication where it changes the visitor's experience: visible construction, rich but controlled lighting, smooth believable movement, close-up clarity, and fast response. Judge the final encoded/browser result, not only Blender's render window or a high GPU-utilization percentage.

| Layer | Main job | What to measure |
|---|---|---|
| Blender / Cycles | Photographic offline animation and coordinated stills | Accepted visual quality, temporal stability, production time and memory |
| Homepage media | Present the cinematic scene immediately and play it smoothly | Poster/LCP, time to visible motion, full automatic transfer, dropped frames, pause/resume |
| Three.js demo | Inspect systems, construction, service mechanisms and evidence | Input response, frame cadence, readable detail, resources and recovery |

These measurements are not interchangeable. A fast Cycles render does not establish phone playback quality; a low JavaScript submission time does not establish GPU execution time.

## 1. Reuse the advanced foundation already present

The repository pins Blender 5.2.2 LTS and Three.js 0.186.0. Confirm actual executing versions when implementing; do not upgrade them as part of visual refinement without a demonstrated need.

- [compute.py](../../../assets-source/facility/compute.py) already selects CPU/Metal/hybrid and MetalRT per process, bounds CPU threads, records configuration, and requires explicit CPU fallback.
- [The Cycles lab](../../../scripts/qa/premium-cycles-lab-README.md) already supports area-light rigs, AgX, adaptive sampling, persistent data, undenoised EXRs, diagnostics and optional denoising. It imports an optimized GLB for still inspection; it does **not** yet provide the complete cinematic master, production LEDs or looping animation.
- [Bake jobs](../../../assets-source/facility/bake_job.py) already supply fingerprints, validated caches and controlled writes. Reuse these patterns for cinematic frames.
- Three.js already has semantic geometry batches, PBR atlases, a PMREM environment, instanced LEDs, surface/proxy picking, shader prewarming, on-demand specimen swaps, one visibility-aware frame owner, adaptive resolution, Still mode and context-loss recovery.

Protect those systems. The next work should improve artistic inputs and specific measured bottlenecks rather than replace working infrastructure.

## 2. One master, two deliberate outputs

Keep equipment dimensions, topology, `gnId` identities, moving-part pivots and system membership shared. Add a dedicated cinematic scene/collection derived from the editable master; retain the existing optimized `EXPORT` path for GLB delivery. Serialize master edits and generation through the existing authoring lock.

The cinematic collection may use richer bevels, modeled perforations and more detailed materials. Those additions should not silently enter the browser export. Conversely, do not build the photographic hero only from the already simplified GLB and expect lighting to restore removed construction.

Store an explicit mapping between cinematic objects and browser equipment IDs. Maintain camera/crop and material reference images for both outputs. Shared visual identity is required; identical tone mapping or pixel output across Cycles and Three.js is not claimed.

Keep separate manifests for cinematic video/poster and browser GLB/poster. Browser fallback posters must still come from the actual browser renderer. Frozen models, publications and historical candidates remain immutable.

## 3. Advanced Blender techniques with a visible purpose

### Model the equipment as manufactured assemblies

Use non-destructive bevels, appropriate normal control, real panel thickness, recessed doors, formed edges, mounting feet, and fan/guard separation. Choose bevel width in model units and inspect its projected size in the final hero. Weighted normals are useful when the mesh needs them, not as a blanket modifier on every object.

Use linked collections or Geometry Nodes instances for repeated rack modules, fan units, supports, and service-route fittings. Keep instances shared until individual geometry is genuinely needed. Blender's instance system can reduce duplicated geometry; realizing instances increases memory and processing. [Blender instances](https://docs.blender.org/manual/en/latest/modeling/geometry_nodes/instances.html).

Spend geometric detail on silhouettes and visible recesses. Use normal/bump detail where relief is small. Do not subdivide all sheet metal, create hidden internal servers, or generate thousands of fasteners that disappear after compression. Geometry Nodes should maintain the equipment family and routing, not become a wholesale procedural rewrite.

### Build a calibrated material library

Separate graphite powder coating, exposed/brushed steel, rubber, copper, and grille finishes. Keep the subtle clean coating requested in earlier work; use physically scaled roughness variation rather than dirty noise. Reserve anisotropy for surfaces that should visibly appear brushed. Resolve visible depth through geometry rather than painted black seams.

Create cinematic material variants without browser AO or baked illumination multiplied over Cycles' own shadows. Keep static baked contacts valid for the browser's moving and removable parts. Derive browser PBR approximations and texture bakes from the same finish references, but validate them in the browser's lighting.

Make one material/lighting coupon containing a rack corner, recess, steel rail and copper route. Approve it under the final hero light before applying it everywhere.

### Light the entire assembly, then refine through passes

Use a broad area key, restrained front fill, controlled rim separation and genuine indirect/contact light. Add reflection cards or light linking only to solve a demonstrated readability problem while keeping the scene believable. Avoid broad gloss increases and deep depth-of-field blur that obscures inspectable equipment.

Separate key/fill/rim into a small number of **Light Groups**. These permit lighting color/intensity adjustments in compositing without rerendering the same light transport. Use **Cryptomatte** object/material masks for restrained local grading and isolation. Neither tool can repair incorrect geometry, camera placement or shadow relationships. [Blender render passes](https://docs.blender.org/manual/en/4.5/render/layers/passes.html).

Save scene-linear EXR beauty, necessary denoising guides, useful masks, and those light groups. Avoid writing every available pass for every frame. Choose and record one display transform and exposure; the existing AgX lab is a starting point. Keep the working linear master distinct from the delivered SDR video and poster. Test their black levels and amber color in actual Safari/Chrome playback, rather than applying arbitrary extra gamma corrections.

### Rig a loop rather than a sequence that happens to repeat

Animate actual rotors around their verified pivots, leaving guards and housings stationary. Use periodic rotation and deterministic LED envelopes. For a simple rotor, an integer number of full revolutions over the loop duration ensures matching phase; a varying-speed rotor also needs matching integrated angle and boundary speed. Extend the periodic motion beyond the start/end so shutter sampling remains valid.

At a selected frame rate, render one complete period without duplicating the endpoint frame. Keep the camera locked. Use true object motion blur with an appropriate shutter; compare the final encoded clip for apparent reverse rotation and blade shimmer. A blanket 2D blur is not a substitute for occlusion-aware 3D motion. [Blender motion blur](https://docs.blender.org/manual/en/latest/render/cycles/render_settings/motion_blur.html).

LED activity should be asynchronous, sparse and subordinate to the equipment. Tiny LEDs need not each become an expensive point light. Render their emissive appearance and only the local light contribution that remains visible. The illustrative activity must never change the assessment's numerical result.

### Prove temporal quality before producing the whole animation

Render consecutive frames covering a fan, a dark grille, a reflective junction and an LED pulse. Include the loop boundary. Compare raw and denoised versions for moving noise, flicker, lost vent detail and denoiser pumping.

Use the lab's 64-sample/.02 preview and 256-sample/.005 reference settings only as starting experiments, not promises of final adequacy. Set minimum/maximum samples and adaptive threshold based on the sequence. A clean isolated still does not establish temporal quality. Preserve settings and sample seeds for reproduction without assuming that a fixed seed alone prevents flicker.

## 4. GPU engineering: optimize the actual workload

Start the cinematic benchmark with **Cycles Metal and MetalRT AUTO**, using the existing process-scoped configuration. Compare another supported setting only under matched scene and quality conditions. Do not assume CPU+GPU hybrid, a forced ray-tracing mode, or maximum samples is faster or better.

Reuse the existing constrained bake benchmark for bake decisions, but add a **cinematic frame benchmark**. The older small-atlas timings cannot predict full-scene motion-blurred renders. Some small jobs may remain more efficient on the CPU.

Record these stages separately:

| Stage | Required evidence |
|---|---|
| Scene preparation | Version, input hashes, device request, evaluated geometry, load/build time |
| First invocation | Initialization/kernel overhead and actual settings, without claiming OS caches are cold |
| Representative warmed frames | Three comparable repetitions, rendering time, output quality and failures |
| Denoising/compositing | Separate duration, settings and preserved raw comparison |
| Encoding | Encoder/version, time, dimensions, frame rate, codec, color metadata and bytes |
| Whole production | Completed frame inventory, elapsed time, memory observations and resumability |

Measure representative animation frames rather than repeatedly rendering only the easiest closed pose. At 8–12 seconds and 24/30 fps the loop contains 192–360 frames; estimate the production range only after measuring the scene.

Benchmark **Persistent Data** for warmed animation rendering. It can save repeated setup at the cost of retained memory; keep it only if the actual scene benefits without memory pressure. [Blender performance settings](https://docs.blender.org/manual/en/4.5/render/cycles/render_settings/performance.html).

Use one GPU-heavy render process at a time initially. Do not benchmark the website while Blender competes for the same GPU. Cache completed, validated frames by source, scene, camera, time/subframe, material/light and render-settings identity. Preserve interrupted jobs and resume verified frames rather than restarting or trusting filenames alone.

Record enabled devices and render logs. Configuration proves what was requested/enabled; it does not quantify CPU/GPU work share. Process RSS is not physical GPU memory, and unified-memory pressure must be observed separately. Use profiling when a bottleneck remains unclear; GPU utilization itself is not an acceptance criterion.

Homepage playback has its own engineering: one native video rendition, no hidden WebGL scene, no duplicate mobile/desktop acquisition, and no unnecessary canvas copy of video frames. Measure first presented motion and dropped-frame counters where supported, plus actual visible playback on target phones. These counters do not prove hardware decoding or energy use. [Video-frame callbacks](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback), [playback quality](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/getVideoPlaybackQuality).

## 5. Advanced Three.js: improve inspection and preserve responsiveness

### First priority: translate the approved art into the demo

Transfer the approved silhouettes, scaled bevels, readable recesses and finish separation into optimized overview/rack/cooling assets. Review them in the actual PBR environment at desktop and phone size. Improve the service-detail camera so the connector and mechanism are legible without exaggerated travel or broken mechanical constraints.

Use the existing system/equipment attributes for depth-respecting highlights, section/cutaway views and guided focus. Keep native HTML controls and evidence descriptions. A selected part should be unmistakable without flooding the entire assembly with emissive color or using an expensive full-scene outline effect.

Retain the existing on-demand overview/specimen system. Stage and prewarm the next required asset, verify its real first frame, then release superseded resources under the current ownership rules. `compileAsync` is already implemented; it should be extended only for newly introduced material variants. It is not a substitute for measuring first-use latency. [Three.js renderer documentation](https://threejs.org/docs/pages/WebGLRenderer.html).

### Second priority: test resource improvements before adding effects

| Technique | Candidate use | Condition for adopting it |
|---|---|---|
| Existing static geometry batching | Preserve system/material batches and semantic IDs | Default; do not replace already efficient batches without evidence |
| Instancing / BatchedMesh | New repeated or independently moving parts that are not efficiently represented today | A measured draw/CPU/memory gain with correct picking and transforms |
| Meshopt geometry compression | Larger optimized assets or repeated specimen transfers | Total transfer and time-to-ready improve after decoder overhead; all semantic attributes and seams survive |
| KTX2/Basis texture compression | Texture-heavy future assets or measured texture-memory pressure | Actual target-device transcode/memory benefit without roughness, normal, alpha-mask or edge damage |
| Bounded shadow pass | One selected specimen where construction lacks necessary depth cues | Visible improvement in all moving poses within measured draw, memory and frame budgets |

The overview already uses 39 draws under its current contract; saving draws must precede spending them. Instance rendering can reduce calls for repeated geometry, but it is not automatically superior to the existing semantic batches. [InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html).

Compression is an isolated prototype, not a prerequisite. The current pipeline declares no compression extensions; adding one requires loader/validator/manifest updates, decoder delivery accounting, and regression checks for IDs, route distances, normals, tangents, UV seams and alpha-aware picking. Avoid lossy quantization of semantic IDs. Preserve shared texture descriptor deduplication. [GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html), [KTX2Loader](https://threejs.org/docs/pages/KTX2Loader.html).

Compare new compression against the existing Brotli/gzip GLB transfer, not raw GLB bytes. The current texture contract uses very small bounded atlases, so a transcoder may cost more than it saves. KTX2 also requires a deliberate solution for CPU-side alpha-coverage picking; a GPU-compressed texture cannot simply replace the current readable coverage image. Preserve equivalent masks/filtering behavior and account for their bytes. Any larger atlas or new extension requires a versioned contract change and measured benefit.

A shadow experiment must use a tightly bounded light/camera and correct moving-part invalidation. Cached shadows must update when the tray or door moves; static baked AO must not leave false shadows behind. Do not stack SSAO, bloom, screen-space reflections and multiple shadow maps as the default fix for flat assets.

### Keep the frame loop and picking disciplined

Retain one frame owner, 30 fps ambient / 60 fps interaction policy, adaptive DPR/pixel caps, pause/reduced motion, visibility suspension, and deterministic motion. Update batched attributes/uniforms in place; do not route per-frame fan/LED animation through React state. Preserve alpha-to-coverage/mipmap safeguards for fine grilles rather than making unresolved holes shimmer.

Keep exact surface picking with simple proxies for coarse system access. Add a spatial acceleration structure only if measured picking time warrants it. The present bounded scene does not automatically need a new BVH dependency or a worker-based renderer.

Preserve transactional swaps, cancellation, stale-result rejection, owned disposal and context recovery. New compressed-texture workers, image buffers or render targets must join that ownership contract.

### Profile CPU and GPU separately

Collect draws, triangles, resource counts, CPU update/submission time and frame cadence per device/view/quality tier. When available, use asynchronous `EXT_disjoint_timer_query_webgl2` measurements for GPU execution. Reject disjoint results, poll without blocking, and mark unsupported measurements unavailable rather than substituting CPU time. [Khronos timer-query specification](https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query_webgl2/).

Use controlled A/B captures: identical model, camera, viewport, DPR and motion interval with one technique changed. Review browser first-frame delay and sustained behavior as well as median FPS. Validate gains on physical phones and another GPU family; Mac phone emulation is not equivalent.

### Keep WebGPU/TSL as an optional later study

The source uses `onBeforeCompile` custom material patches. The documented WebGPURenderer migration requires such custom shader work to be ported to node materials/TSL, so it is not a drop-in performance switch. A new rendering backend must justify compatibility, shader, visual and recovery work with measured benefit. It does not improve the selected homepage video. [Three.js migration guidance](https://threejs.org/manual/pages/webgpurenderer).

Likewise, browser path tracing, fluid/particle simulation, screen-space global illumination and custom compute pipelines are outside the first remediation pass. Reconsider only for a specific user-visible need that survives a prototype.

## 6. Mathematics and physics that improve the result

### Apply mathematical precision to the visible scene first

| Discipline | Practical use | Observable benefit |
|---|---|---|
| Projective geometry | Measure projected equipment bounds, occlusion, label placement and connector size | A larger, more legible facility and useful phone close-ups |
| Geometric modeling | Curvature-controlled routes, manufactured edge scale and local coordinate systems | Plausible tubing, consistent hardware and accurate articulation |
| Light transport / microfacet optics | Energy-conserving surfaces, Fresnel response, area-source reflections and indirect light | Coating, steel, rubber and copper look materially different |
| Kinematics | Periodic rotor phase; bounded, smooth door/tray trajectories | Seamless fans and deliberate service movement |
| Signal processing | Spatial/temporal sampling, reconstruction, shutter integration and filtering | Less fan aliasing, grille shimmer and compression flicker |
| Graph theory and units | Validate equipment/port connections and separate electrical, thermal and explanatory paths | System illustrations that remain coherent and inspectable |
| Constrained optimization | Choose render/encode/runtime settings among candidates passing quality limits | Useful quality per second/byte without uncontrolled resource growth |

**Projective geometry:** use the actual model/view/projection matrices and viewport to measure screen-space bounds. Optimize camera and framing around visible rack fronts, cooling separation, label clearance and readable detail while preserving model proportions. Normal transforms must use the inverse transpose where required; changing a mesh's size should not silently break its lighting. Compute callout anchors from known features for each fixed cinematic crop; keep HTML labels aligned without a second 3D renderer.

Use projected pixel coverage to decide whether an edge needs geometry, a baked detail, or omission. Camera studies should compare several constrained candidates; no automatic pixel-similarity score against the supplied artwork can establish physically plausible construction or good composition.

**Curves and routing:** construct service routes using curves with tangent continuity and plausible, consistently scaled bend radii. Sample explanatory highlights by arc length rather than by an uneven curve parameter, so they do not accelerate unpredictably around corners. Preserve declared route endpoints and system membership. Illustrative travel time is not electrical propagation speed or real fluid velocity.

**Optics:** use physically based surface response and Cycles' light transport rather than adding arbitrary highlights to every edge. Larger emitters create softer shadow/reflection structure; microfacet roughness governs reflection spread. Keep metallic response limited to appropriate surfaces. More bounces or samples cannot repair a hidden rack face, wrong camera, or missing recess. [Light transport reference](https://www.pbr-book.org/4ed/Light_Transport_I_Surface_Reflection/The_Light_Transport_Equation).

**Kinematics:** for a constant-speed loop, use `theta(t) = theta0 + 2*pi*k*t/T`, where `T` is the loop duration and `k` is an integer number of revolutions. Require matching phase and angular velocity at the boundary when speed varies. Use periodic evaluation outside the clip interval for shutter sampling. A repeated fan can have a different starting phase without all units accelerating together.

The existing [ecosystem activity controller](../../../src/lib/facility/ecosystem-activity.ts) already analytically integrates fan motion. Preserve that behavior in the demo and use it as a reference for the cinematic rig; do not reintroduce frame-rate-dependent rotation increments.

For a new start/stop inspection movement, a bounded quintic timing curve `s(u) = 10*u^3 - 15*u^4 + 6*u^5`, with `u` in `[0,1]`, provides zero endpoint velocity and acceleration. It is a candidate for testing, not a reason to replace existing working easing. Reversals must start from the actual current pose and respect the existing interlocks and 180 mm travel; blindly restarting that curve can create a velocity jump. Prefer analytic rig constraints over a general physics engine for deterministic doors and trays.

**Sampling:** a fan with `N` identical blades rotating at `r` revolutions per second creates a repeated blade-passage component at `N*r` Hz. This makes apparent backward/stationary motion possible even when the mechanical rotation is correct. Review the relationship between shutter duration, rotation sampling, frame rate, projected blade width and final compression. Use motion integration and filtering where appropriate; do not claim that a single Nyquist check guarantees artifact-free rendered machinery. Fine grille patterns create a similar spatial problem. [Sampling theory](https://pbr-book.org/4ed/Sampling_and_Reconstruction/Sampling_Theory).

Use pixel or image-difference diagnostics to locate flicker, clipping and aliasing; keep independent actual-size viewing as the quality decision. A small numerical image error does not prove material realism, and intentional moving LEDs should not be incorrectly classified as temporal noise.

### Use system physics to keep the story plausible

The animation should respect equipment relationships and broad causality. It should not claim that a rendered temperature, fan speed or light pulse establishes usable MW.

For an optional explanatory cooling sequence, a simple lumped energy balance such as `C*dT/dt = Q_in - Q_removed` reminds the author that heat accumulates and cooling has a response over time. Here `C` is thermal capacitance in J/K, temperature rate is K/s, and the heat rates are W. Without calibrated parameters and a validated model, use this only to reason about qualitative lag; do not generate public temperature traces, cooling performance or capacity results from it.

Fan affinity relationships can guide a physically consistent explanation: under appropriate similarity assumptions, flow varies with speed, pressure with speed squared and power with speed cubed. Actual operating points also depend on the fan curve, system resistance, controls and efficiency; do not apply these relations as a universal site predictor. [DOE fan-system reference](https://betterbuildingssolutioncenter.energy.gov/sites/default/files/attachments/Better%20Plants%20-%20Fan%20System%20Cheat%20Sheet.pdf).

Keep separate graphs for electrical connections, cooling supply/return and explanatory attention paths. Validate their endpoints and direction against authored topology. Avoid visually sending electrical activity along coolant plumbing, reversing supply/return, or implying that illustrative particles measure real flow. Any public labels or engineering interpretation need an appropriate domain review.

If quantitative physical simulation is later required, scope it separately: authorized inputs, units, boundary conditions, calibration, uncertainty, validation and permitted claims. Full CFD, electrical load flow, thermal solvers and learned surrogates are not prerequisites for this visual upgrade. Fluid-like overlays must not be presented as CFD without actually doing and validating that analysis.

### Optimize under explicit constraints, not a single “quality score”

Use a small experiment matrix over camera, resolution, samples, denoising, shutter and encoding quality. Hold other variables fixed where possible. Select among candidates that meet the independent craft requirement and device/loading constraints, then compare production time and transfer cost. Avoid inventing a weighted score that lets poor readability be canceled by fast rendering.

Maintain three semantic boundaries in code and content:

1. **Illustrative presentation state:** fan phase, LED pulse and highlight position.
2. **Engineering illustration structure:** equipment identity, dimensions, articulated limits and declared topology.
3. **Assessment evidence:** frozen records, quantities, intervals, conditions and publication versions.

Presentation time cannot change assessment quantities. A plausible visual is not an operational model. Add focused checks for boundary phase/velocity, valid route anchors, preserved identities, permissible poses, projection/crop consistency and units where calculations are used. Preserve the existing assessment selectors and frozen publications as the source for the 7.0/5.8 MW example.

The first physics-informed prototype should demonstrate four things together: a clearly visible rack/cooling arrangement, plausible PBR material separation, smooth fan motion without aliasing, and a coherent explanatory route. That is a more useful advance than adding a complex solver with no visible or validated role.

## 7. Integrate these tasks into the main sequence

| Main-plan phase | Added work | Concrete review output |
|---|---|---|
| B: composition | Cinematic master branch, instance/material conventions, projection/camera studies and topology checks | Three normal-size desktop/phone compositions |
| C1: craft | Manufactured-detail pass, calibrated materials, area-light rig and useful compositing passes | Approved still plus rack/cooling detail |
| C2: motion and feasibility | Periodic fan/LED rig; shutter/sampling and kinematics checks; short temporal render; GPU and encoding benchmark | Raw/denoised/encoded comparison, matched measurements, loop-boundary proof |
| C3: production | Render and checkpoint the chosen loop/crops; finish color and encodes | Versioned videos, matching posters, reproducible master and manifest |
| D: homepage | Native playback island and exact asset serving | Cold-load, first-motion, pause, fallback and full-transfer evidence |
| E: Three.js demo | Approved asset transfer, closer inspection, selected performance experiments | Matched browser captures, preserved mechanics and resource evidence |
| F: qualification | Exact final assets, physical devices and independent review | Existing craft/performance/accessibility/release gates satisfied or explicitly blocked |

The first focused prototype should combine **one hero composition, one rack/cooling detail and about one second of representative motion**. It must prove richer construction, convincing animation, temporal stability and viable encoding before a full 192–360-frame production run. Complete-loop acceptance follows; a one-second test does not prove seamless looping or final file size.

Suggested new tools are a bounded cinematic renderer and encoder/manifest builder, reusing existing source/compute/cache contracts. They are proposed additions, not tools already implemented. Keep the main plan's 1.5 MiB automatic page-transfer ceiling, existing demo resource limits and independent 3/3 craft requirement. If a technique cannot meet quality and resource requirements, document the tradeoff rather than hiding its cost.

This update is planning only. No new renders, GPU benchmarks, dependency changes, application changes or releases were executed.
