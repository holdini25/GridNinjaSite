# Facility v11 — current source and evidence

## Current candidate — subtler paint refinement, 25 September

The user requested a slightly subtler shine. A bounded **0.42 → 0.45** paint-roughness change is now integrated through the Blender/Python generator. Sixteen Metal browser comparisons and an independent review selected this direction. Fresh browser posters match the regenerated models. This remains a private draft; final candidate qualification is in progress. Geometry, normal/color images, AO, metalness and nonpaint roughness are unchanged. Each GLB grows by 52 bytes.

Evidence: `build/qa/build-review-20260925/shine-softening01/`. The exact prior source, masters, atlas and staged assets are retained in `shine-source-before/`. The spatial validator now checks the pinned current contact-atlas layout and reviewed finish instead of an obsolete unsplit receiver.

## Prior candidate — approved material direction, 25 September afternoon

The user approved the refined attempt08+B direction. The editable masters,
generator, surface contract, shared atlases, and render profile now contain that
work. This supersedes the **historical 04:05 UTC snapshot below**. No v11 public
registration or final premium craft approval is implied.

- Powder coating remains at reviewed roughness **0.42**. The existing neutral
  overview point light is **36 cd**, at `[-2.8, 6, -3.4]`; specimen illumination
  and the 128-resolution environment remain unchanged.
- Physical surface coordinates, evaluated corner normals, seams and semantic
  attributes survive batching. Stationary chassis/rail contact AO excludes
  moving doors, trays and side panels. Atlas dimensions remain 512²/512²/256².
- Overview: **2,371,544 bytes**, SHA-256
  `fd0f30236e1ac7b52f7da7ed58cb5b959da738c2fab98d71a689b116f065ddc3`.
  Rack: **760,092 bytes**, `912c65aa9255143672619bff71e2b2c10c3b3085bcdc159e8bd3ad4cf7e46086`.
  Cooling: **353,296 bytes**, `dd2b3fe9e984a0c2d17f9a9447a262619ae2621da874e2d85aeb75192213c13d`.
- Overview browser count: **35,708 triangles / 39 draws / 9 materials**.
  Conservative rack allocation: **6,230,597 bytes**, leaving 60,859 bytes below
  its ceiling. Overview exceeds the 2.3 MB target but meets the 2.5 MB ceiling.
- Fresh browser posters are staged in `build/facility/facility-v11/release/`.
  Manifest SHA-256: `b645f6b7b5d0b521c9bf737a91c6b8727993cdbd5cafa99b13b4620b0c931a0f`.
  `capture-profile.json` and `review/review-capture.json` under the same v11 build
  directory identify the M5 Metal captures. They are local preview evidence.
- The collector-edge trial and 36°/38° overview trials were rejected after
  actual-size review. The approved 32° elevation is retained. Core material and
  composition craft remains **2/3**; the required premium 3/3 gate is open.

Reproduction, the exact 14-file authoring write allowlist, preservation checks,
and focused CPU/Metal evidence are indexed by
`build/facility/v11-premium/README.md`. Its working-copy posters are historical
placeholders; the staged release directory above contains the fresh browser
posters. Prior registered assets and assessment publications remain immutable.

## Historical snapshot — 04:05 UTC

This addendum describes the root candidate captured on 25 September 2026 at
04:05 UTC. It supersedes the README's early v11 camera/bake/count statements, while
preserving those earlier attempts as historical evidence. It does **not** describe
the later isolated camera, floor, or formed-cover experiments.

## Actual root candidate

- Native Blender 5.2.2 LTS, build `d13f752e3b9c`.
- Paint roughness .42 with restrained low-frequency variation; coil relief 1.8 mm.
- Base-color spatial direct lighting is **disabled**. The current color receiver
  is neutral white; actual geometric contact AO remains in the existing ORM atlas.
  Runtime finite illumination supplies the spatial light response.
- The 128-resolution industrial-night-v3 environment and optional one-point-light
  binding are graphics-session resources. They add no render pass or shadow map.
- Whole-rack service camera `[3.2,3.7,5.8]`, target `[-.05,1.35,.20]`, 12% padding.
  The explicit stationary service-connection cutaway uses its own authored bounds
  and camera `[2.2,2.35,1.55]`, target `[.015,1.48,.17]`. It does not move during tray
  travel. `inspection.mobileRackAspect = .85` remains the taller rack stage.

The final generation used **CPU, two render threads**. Earlier complete Metal
bakes succeeded; later Metal compiler stalls and the explicit CPU fallback are
retained in the isolated compute logs. `computeBackend: METAL` is the configured
Cycles device backend, not proof that the actual CPU run used Metal. Consult
`cyclesDevice`, `requested`, and `enabledDevices` together. Thread limits varied by
authorized job; do not state that every run used four threads.

Three-repeat small-receiver comparison medians remain CPU 1.125 s, Metal 2.521 s,
hybrid 2.713 s. These quantify that particular workload, not whole-generator or
website rendering performance. Browser review separately verified the M5 Pro
ANGLE Metal renderer. No global preferences or user GUI Blender were changed.

## Exact root assets and recorded budgets

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| Overview | 2,215,888 | `9409b7b699aed791e95568a2b1dd6836a7d9e947088038157c107762b816f9a6` |
| Rack | 734,080 | `ba18b9eaed403c01903bd74233daf39f7848cfa52f994ab183252a74533bd97e` |
| Cooling | 321,668 | `00986b4f6f3aaa7adc5351c4bb82e4537deccdfeb635693e8e3cbe37750f47b7` |

Root review measured overview 35,472 rendered triangles / 39 draws / 9 materials;
rack 10,056 / 26 / 8; cooling 4,162 / 17 / 7. Retained estimates including the
environment were 7,971,558 / 6,230,217 / 5,722,436 bytes, respectively. The rack had
61,239 bytes beneath its 6 MiB cap; observed staging peak was 12,104,623 bytes.
These are renderer accounting estimates, not physical memory-pressure results.

Editable masters, generation/export modules, atlas sources and parameters exist
under `assets-source/facility/`. Root integration input hashes are retained in
`build/qa/enterprise-rc21/authoring-integration/manifest.json`. Do not replace them
from the later exploratory clone without a reviewed explicit file allowlist.

## Evidence identity and remaining gaps

Matching final evidence:

- `build/facility/facility-v11/review/review-capture.json`: 60 website states,
  matching overview/rack/cooling bytes and final authored composition.
- `build/facility/facility-v11/capture-profile.json`: browser-matched posters.
- `build/qa/enterprise-rc21/service-native-attempt03/report.json`: native M5 Metal
  desktop/touch-emulated service journey and videos. Development preview and
  mobile emulation limitations are explicit.

Historical evidence with different bytes:

- `asset-material-benchmark/report.json` and `ecosystem-review/report.json` refer
  to overview `3ef748255c8fec6aebc81649cd44a590e26f643660ee23bef52fbb88734b8984`
  and rack `cf810f911f242dc42231d243d2f113618d391054faf1d0855f36fa49f28d270b`.
- `art-review.json` is the earlier failed craft review. Its fail result must not
  be relabeled as a review of final geometry; the dated Markdown review records
  the later independent judgment.

Final asset-channel and ambient/story-motion captures need one manifest-bound
evidence index before qualification; existing isolated captures cannot be combined
without checking their recorded hashes. Later floor experiments additionally fail
the current palette contract and remain explicitly unvalidated.

The current whole-overview material/composition score remains **2/3**. The explicit
service detail improves subject visibility, but does not approve the entire art
release. V11 remains unregistered. Frozen v1–v10 bytes, rollback modes, assessment
semantics and publications remain unchanged.

## Bounded construction follow-up

The isolated formed-cover benchmark adds a mechanically closed crossed-break lid
to one collector bay: 60 triangles and 9,192 GLB bytes, with unchanged topology,
39 draws and 9 materials. The 64 native Metal comparison captures confirm correct
normals, UVs and section behavior, but the visual improvement is too subtle at
normal homepage size. It is not integrated into the root source or asset release.
Its inherited control posters do not qualify candidate poster/live parity.
Evidence: `/Users/holdenchung/repos/GridNinjaSite-v11-light-candidate/build/qa/finite-light/formed-cover/result.json`.
