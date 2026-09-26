# Blender facility source

This editable architectural illustration supports a synthetic assessment. It is
not an as-built facility, engineering design, electrical single-line diagram,
capacity solver, live equipment view, or representation of equipment authority.

## Rebuild

The pinned native Apple Silicon toolchain is recorded in `toolchain.json`.
Use Node 22 on PATH for the validation command (this workstation's current
binary is `/tmp/gridninja-node22/node-v22.23.2-darwin-arm64/bin/node`).

**Facility v10 is the latest frozen local visual release. V11 is an unapproved
candidate until matching browser captures are reviewed and frozen.** Preserve
all registered releases. The sections below retain their historical evidence.
V8 added the articulated rack while retaining byte-identical overview/cooling
assets from frozen v7; v9/v10 retained its mechanical contract. Staging does not
publish a candidate or replace a frozen release. Matching browser posters and
`capture-profile.json` must pin the reviewed model/profile hashes before final
registration. Public release gates remain separate.
See [V8 rack articulation](#v8-rack-articulation) for the current
motion contract and rack-only regeneration commands. Earlier release sections
record historical construction and evidence. The
[asset handoff](../../docs/website-upgrade/facility-validation-v8/asset-handoff.md)
indexes editable masters, frozen posters and durable validation.

Always author into a new, unused release ID. Historical commands below use `facility-v9`;
choose a later unused ID if it has since been registered. Registered identities
cannot be staged or frozen again.

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 \
  --python assets-source/facility/generate.py -- --out build/facility/facility-v9 --render
node assets-source/facility/validate.mjs build/facility/facility-v9/facility.glb
```

The generator uses Blender's bundled Python, NumPy, mathutils and glTF exporter.
The validator uses the repository's pinned Khronos `gltf-validator` package.
Generated candidates, measurements and review images stay in `build/facility/`.
Publication is a separate allowlisted visual-release process; never copy the
source master or candidates into `public/`.

## Editing with Blender and Codex

`facility-master.blend` contains four collections:

- **AUTHORING**: editable individual generated parts; normally hidden to avoid
  displaying the same geometry twice. Enable it and hide EXPORT to inspect.
- **AUTHORING_MANUAL**: persistent manual refinement meshes. Assign one approved
  palette material and a `gnDomain` custom property of `power`, `cooling`,
  `storage`, `workloads`, or `platform`; the generator preserves the original and
  merges its evaluated geometry into the correct export batch.
- **REFERENCE**: the orthographic review camera and three area lights; custom
  artist references remain untouched. This collection never enters the GLB.
- **EXPORT**: evaluated static surfaces coalesced by material and system, plus
  semantic groups, independent rotors, empty LED anchors and picking proxies.

Scripted generation and manual editing must be serialized. Generation, standalone
export, browser capture and release packaging share an exclusive `generation.lock`. The generator
opens the saved master and preserves the manual
collection. Save and close a manual editing session before regenerating. A
failed process can leave the lock; confirm no facility writer is running
before removing it. Changing generated parts directly in AUTHORING is useful
for exploration but regeneration replaces those parts; persist desired changes
in the generator or AUTHORING_MANUAL.

The source palette and layout design dimensions are documented in `scene.json`;
the fixed, authored industrial layout is implemented in `generate.py`. Change
geometry dimensions and routing together, then verify proxy coverage, framing
and budgets. `render-profile.json` is the browser camera/exposure profile. Final
posters must come from the actual browser renderer under that profile, never
from the optional Blender review image.

## Geometry and runtime contract

Static equipment is batched by `(system root, material)`, with one concatenated,
indexed mesh per batch. This reduces over a thousand editable parts to 38 draw
submissions, including four independent fan rotors; the runtime LED batch adds
one. The compiler transforms evaluated modifier corner normals with the
inverse-transpose matrix and preserves UV corners independently. It measures
the resulting custom-normal error and UV seams in `normal-preservation-report.json`.
Tiny tabs and support feet keep their silhouettes without subpixel bevel loops.

V3 uses two shared **512×512 normal and ORM atlases**. `surface_bake.py` runs
actual Blender Cycles bakes at 64 samples: ambient occlusion on the foundation
and rack plinth, plus selected-to-active normals and AO from detailed grille
and coil prototypes. Foundation/plinth AO distance is 0.75m; detail AO distance
is 0.08m. Static fan guards participate in occlusion; rotor meshes and picking
proxies are excluded. The receiver AO receives a small, edge-clamped smoothing
filter. This is visual occlusion, with no airflow or capacity calculation.
The bake report records engine, samples, distances, exclusions, image hashes
and source-module hash. The earlier v2 analytic contact texture is not used by
the v3 exporter and must not be described as ray-traced baked lighting.

The normal and ORM images are embedded in the GLB; ORM packs occlusion,
roughness and metallic channels. The exporter interns identical texture/sampler
descriptors, preventing each material from allocating another copy of the same
atlas. No additional material, draw submission or per-frame occlusion pass is
needed. Most cabinet surfaces sample the neutral atlas region; grilles use
their detail tiles, while foundation/plinth UVs sample the actual AO receivers.
There are no animation clips, Draco/Meshopt/KTX2 requirements, external images,
or runtime geometry-generation requirements beyond the LED batch.

The `gnId` custom property is the stable identity; mesh names are descriptive.
Each selection accent and proxy is parented under its corresponding system.
Exclude proxy meshes from render passes and retain them only for raycasting.
Keep accents independent from equipment materials. The runtime shares one
accent material with per-domain shader strengths, retaining the ten-material
budget including its LED material.

`service_routes.py` declares typed electrical, cooling supply/return and
illustrative reserve ports. The 26 routes and 52 ports generate enclosed
busways, round pipes, endpoint collars and 18 saddle supports. Raised 24mm
copper inlays on the visible busway faces keep selection accents exposed,
with at least 1mm clearance from the opaque enclosure. Main equipment ports are
checked against bounds gathered from the actual authored equipment meshes;
service junctions have explicit modeled enclosures. Validation rejects missing
or duplicate identities, incompatible service types, dangling ports, nonfinite
or zero-length segments and incorrect path endpoints. These checks establish
geometric connectivity only; they do not certify a facility design or sizing.

Fans `GN_FAN_ROTOR_00`–`03` have their pivots at their shafts and local **Y** axes
after Blender's Z-up to glTF Y-up conversion. The validation script checks the
actual rotor geometry against that axis. `GN_LED_00`–`47` are empty front-facing
anchors with identity orientation; they are visual activity markers only.

## Export and verification

Regeneration writes the optimized `build/facility/facility-v9/facility.glb` directly from
the merged EXPORT collection. To export an artist-edited master without
regenerating its geometry:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background \
  assets-source/facility/facility-master.blend --python-exit-code 1 \
  --python assets-source/facility/export.py -- --out build/facility/facility-v9/facility.glb
```

`asset-report.json` records the toolchain, source/generator hashes, semantic
identities, glTF bounds, fan/LED bindings and measured counts. `validation.json`
adds Khronos validation, actual exported triangle counts, byte/compression
measurements, exported normal/UV checks and budget checks. `bake-report.json`,
`normal-preservation-report.json` and `service-report.json` record the authoring
checks. Current source provenance pins ten inputs: `generate.py`, `export.py`,
`surface_bake.py`, `service_routes.py`, `engineering_metadata.py`, `specimens.py`,
`rack_kit.py`, `air_circuit.py`, `rack_motion.py` and `scene.json`, alongside
three editable masters. These
checks verify the asset contract; browser
rendering, picking, poster parity, accessibility, frame timing and session
resource disposal are separately required for the website release.

For a visual checkpoint before applying full rack/cooler refinement, add
`--benchmark` to the generation command. It refines the first rack and cooler
while retaining the complete scene and semantic contract for browser review.
Generate again without the flag for the full candidate. Every generation runs
the actual surface bakes; source changes must be regenerated and restaged before
freezing, and final posters must be captured from the matching browser profile.

Use a new `facility-vN` identity for each frozen visual revision. Stage with
`npm run facility:stage -- --release facility-v9`; development preview uses
`FACILITY_PREVIEW=1 FACILITY_ASSET_RELEASE=facility-v9 npm run dev -- --hostname 127.0.0.1 --port 3000`.
Capture the actual browser with
`FACILITY_BASE_URL=http://127.0.0.1:3000 npm run facility:capture -- --release facility-v9`,
then stage again. After review, `npm run facility:freeze -- --release facility-v9`
validates and freezes the exact staged bytes and atomically registers the
complete bundle. It checks the three masters, render profiles and all ten source-module
hashes, and rejects existing registered identities and missing or stale
browser-capture provenance. Follow the full release runbook in
`docs/website-upgrade/facility-authoring.md`; freezing is separate from deployment.

## Production performance checks

For a frozen v8 production build served at `http://127.0.0.1:3000`,
run the following sequentially. Use the same release and mode environment when
building, serving and measuring; change the release consistently for a newer
frozen candidate. Leave `FACILITY_PREVIEW` unset.

```sh
export FACILITY_ASSET_RELEASE=facility-v8
export FACILITY_3D_MODE=auto-adaptive
FACILITY_BASE_URL=http://127.0.0.1:3000 npm run facility:measure
FACILITY_BASE_URL=http://127.0.0.1:3000 FACILITY_HEADED=1 FACILITY_ANGLE=metal npm run facility:verify-browser
FACILITY_BASE_URL=http://127.0.0.1:3000 npm run facility:lighthouse
npm run facility:performance:validate
```

The page collector uses five fresh contexts per route/device profile by default.
One Lighthouse command collects all 20 runs: homepage and demo, desktop and
mobile, five fresh browser profiles each. The final validation command checks
completeness, matching provenance and budgets. Keep the production build,
measurement scripts and browser version unchanged during collection; physical
mobile evidence is recorded separately from emulation. Repeat packaging guards
without a browser using `node scripts/facility/test-packaging.mjs` (18 isolated
fixture checks, including source-helper and scene provenance guards).


## Historical frozen v3 evidence

The 2,080,304-byte v3 GLB has SHA256
`43ff2688b2a7765b38ea59e8918734b20da9fe3beaaaf65f3185bd87d5c6b5ac`.
It contains 32,734 visible authored triangles; the browser adds 576 LED
triangles for 33,310 total, with 39 draws and ten runtime materials. Khronos
validation reports zero errors and 42 generated-tangent-space warnings:
normal-map tangents are derived by the browser. Preserve that qualification
when reporting validation.

`build/facility/facility-v3/reproducibility-report.json` records a byte-identical
standalone re-export from the saved master under the pinned toolchain. It
records the master and all five source-module hashes; the frozen manifest
pins the same inputs. This is saved-master re-export evidence, not a claim that
two complete procedural generations and Cycles bakes were compared. The
runbook retains the exact v3 asset measurements and historical v2 comparison.

## V4 engineering inspection assets

The generator now produces the overview plus two independent, editable
`rack-specimen.blend` and `cooling-specimen.blend` masters. `specimens.py`
authors genuine hollow frames, thin removable panels and interior assemblies;
these are representative constructions, not verified vendor internals.
`AUTHORING_MANUAL` is preserved in each master. A manual specimen mesh must
set `gnPartId` to its intended semantic part and use one approved material.

`engineering_metadata.py` compiles 27 equipment/junction identities, 52 ports,
26 rendered centerline routes and 20 explicit internal bus/header links into
`GN_EXPORT.gnTopology`. Equipment bounds are measured from the authored
meshes. Supply and return collector identities remain separate. Internal
connectivity is never inferred merely because ports share an enclosure.
The `_GN_EQUIPMENT_ID` vertex attribute uses dense equipment indices or -1;
accents additionally preserve `_GN_ROUTE_ID` and normalized `_GN_ROUTE_S`
(0–1 over the entire authored rendered centerline). They survive normal/UV
batching and glTF export without new draw submissions.

Each specimen exposes six independent part roots and three authored poses in
`GN_SPECIMEN_ROOT.gnSpecimen`: closed, cutaway and service. Pose positions are
absolute local glTF Y-up coordinates. The rack service tray travels 180 mm;
its rail-mounted connectors remain stationary, illustrating access without
claiming a moving live cable. The cooling fan rotor is independent of its guard.
The same single-feed rack distribution and illustrative liquid circuit are
shown in every pose. No ratings, temperatures, air velocities or site authority
are represented.

The historical v4 source provenance union included seven inputs: `generate.py`,
`export.py`, `surface_bake.py`, `service_routes.py`, `engineering_metadata.py`,
`specimens.py`, and `scene.json`. The browser profile is pinned separately.
Final reports and descriptor profiles are written under the candidate directory.

Validate each real output using the same command; the root identity selects
the appropriate contract automatically:

```sh
node assets-source/facility/validate.mjs build/facility/facility-v9/facility.glb
node assets-source/facility/validate.mjs build/facility/facility-v9/rack.glb
node assets-source/facility/validate.mjs build/facility/facility-v9/cooling.glb
```

The specimen checks inspect actual corner normals, material/geometry allocation,
part-selection attributes, ancestry, bounds and complete pose bindings. Rays
through sampled frame cavities reject solid-block chassis. Route validation
checks all exported accent coverage from 0–1, measured centerline lengths,
port termination and explicit internal-link service compatibility.

Standalone specimen re-export from its saved master uses:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background \
  assets-source/facility/rack-specimen.blend --python-exit-code 1 \
  --python assets-source/facility/specimens.py -- \
  --out build/facility/facility-v9 --reexport rack
```

Use `cooling-specimen.blend` and `--reexport cooling` for the other specimen.
The candidate directory must contain its generated `specimen-descriptors.json`.
All authoring/export operations use the same exclusive lease. Browser posters
must still be captured from the actual renderer; the optional authoring review
renders only verify construction and do not establish poster/live parity.

## V5 surface and rack kit changes

`rack_kit.py` owns the metric cabinet walls, mounting rails, door frame, cover,
module datum and two module fronts used by both derivatives. The envelope is
0.78 × 1.24 × 2.55 m. The overview deliberately omits the outer door grille skin
so the recessed modules remain legible at homepage size. The rack specimen
retains that separate MASK skin in its closed pose; cutaway removes real parts.
The printed atlas mark is generic GN branding. Equipment identities remain in
`gnId`/topology metadata and the HTML explanation; the mark is not a serial number.

V5 embeds two 512² normal/ORM images and one 256² RGBA color/coverage image.
Source objects choose `gnSurfaceRegion` explicitly. Atlas footprints use metric
coordinates for manufacturing pattern pitch, with 8 px padding in the 512 atlas.
Painted cabinet faces use varying UVs; neutral finish regions use their assigned
constant swatches. ORM contains final roughness/metalness, so both glTF factors
are one. The exporter writes the authored linear palette as `baseColorFactor`
explicitly; this avoids Blender's unsupported generic color multiply falling
back to a white material. Every exported material has a semantic surface role.

Only the planar grille/fin receivers carry a normal map (strength 0.35) and an
explicit tangent basis. Tangents are generated from actual exported positions,
UV derivatives and retained normals, and checked for unit length, orthogonality
and seam handedness. Other surfaces do not allocate tangent attributes. No
additional shader material, runtime shadow pass or decoder is introduced.

The PNG optimizer recompresses IDAT with level-9 deflate and verifies unchanged
decoded scanlines. It does not quantize, resize or alter normal/ORM values. Each
specimen loads fresh current PNG datablocks rather than reusing the previous
master's packed images. Reports record embedded PNG hashes for cross-model
comparison. `validate-surfaces.mjs` additionally rejects lost palette factors,
incorrect MASK settings, invalid PNG buffer ranges, constant cabinet UVs and
inward rotor winding. Earlier releases retain their historical validation path.

V5 repeated overview pockets and narrow gasket/reveal backings are planar;
closed side walls, door-frame depth, faceplate separation, levers and large
silhouettes remain geometry. Overview enclosure chamfers use one segment;
the specimen retains two on large silhouette corners and one on submillimetre
module/latch bevels. This keeps the actual twelve-rack asset below its 2.3 MB
working target. The two specimen derivatives retain real hollow chassis and
the same absolute 180 mm rack service-tray travel.

Grille panels subdivide only at metric atlas tile boundaries. Each panel tile
has its own UV corners, avoiding repeat cancellation or pattern stretching as
panel dimensions change. The illustrative outer-door pattern uses a 0.4 × 0.8 m
tile; it is deliberately coarser than a vendor door's manufacturing drawing.
MASK alpha uses standard glTF fields, front-facing surfaces, and the renderer's
MSAA coverage/derivative fade. Closed solid surfaces have outward winding;
upper fan skins and side closures are verified from exported geometry. Tube
cross-sections use minimal-rotation parallel transport through elbows, so the
serpentine coil no longer flips neighboring ring frames into crossed surfaces.

Finish values are final ORM values: powder coat 0.50 with restrained variation,
bare steel 0.34, polished trim 0.28, polymer 0.40, rubber 0.76, copper 0.32,
grille 0.55 and platform 0.78. Metalness is one for bare steel/trim/copper and
zero for the other finishes. Polymer parts use an explicit authoring region
inside the existing Dark material batch; they do not add a draw or a material.
The sRGB palette is Graphite `#242424`, Steel `#585858`, Trim `#808080`, Dark
`#101010`, Copper `#d99a58`, Amber `#ffb35b`, Platform `#292929`, Grille `#303030`.

Construction references reviewed for assembly vocabulary (September 2026):

- [Schneider Electric NetShelter SX cabinet overview](https://iportal.se.com/Contents/docs/UPS-JKUR-9M3JGG_R0_EN.PDF): perforated doors, mounting structure and leveling hardware.
- [Schneider Electric replacement front door](https://www.se.com/us/en/product/AR7050AB2/netshelter-sx-advanced-42u-750mm-wide-perforated-curved-door-black/): a separate black perforated door component.
- [Vertiv drycooler user manual](https://www.vertiv.com/globalassets/shared/sl-10061_47274_00.pdf): fin-and-tube coil, service headers, guards and structural frame.
- [glTF 2.0 material specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html): standard metallic/roughness, normal, base-color and alpha fields.

These sources informed the construction review; no manufacturer geometry,
ratings, logos, certification or exact product dimensions are embedded. The
specimens remain illustrative. Release behavior and evidence are described in
`docs/website-upgrade/facility-v5.md` and
`docs/website-upgrade/facility-validation-v5/`.

## V6 coordinated ecosystem construction

`air_circuit.py` adds two 650 mm-deep, 300 mm-high rack-return collectors, open
roof collars, a right-side trunk and a shallow common cooling intake plenum.
The rear rack elevation is retained. Each sheet has actual thickness and every
junction is cut open; no solid duct primitives sit behind an inspection trace.
`GN_AIR_SECTION_COVERS` is one independent Graphite batch under `GN_COOLING`.
Removing it reveals the collector, trunk transition and return plenum interiors.

The shared rack kit has four roof-sheet sections surrounding its rear exhaust
aperture. The miniature omits the old solid decorative equipment backing so its
inter-module passage connects to the rear capture space. Cooling equipment uses
thin casing walls, recessed fin bands, separated internal fins, a continuous
liquid circuit, an upper plenum and an open fan deck. Motor supports and guards
remain stationary. Paired water services and the specimen headers are on the
rear service side. Construction is illustrative; it carries no equipment rating,
airflow, temperature, workload allocation or certification claim.

Topology v2 contains explicit medium-tagged ports, geometric branch positions,
internal air and water passages, thermal coupling relationships and open-room
return relationships. It stores all twelve rack trace itineraries as signed
route subranges; electrical itineraries stop at the selected tap and exclude
sibling feeds. Thermal coupling never joins the air and water graphs. Open room
air has no drawn conduit or precise free-space streamline.

`validate-air.mjs` intersects each authored air route and internal air passage
with the actual stationary exported triangles. It excludes only picking proxies,
raised accent inlays and moving rotor blades. This catches a sealed duct join,
solid rack backing, obstructed coil rail or plugged fan deck even if authoring
metadata claims an opening. These sampled geometric passages are not a CFD,
fluid-pressure or building-code check. Standard validators additionally check
branch projections, itinerary continuity, normal/UV preservation and material
budgets. `air-construction-report.json` records authored dimensions separately
from the independent exported-mesh checks in `validation.json`.

Use a new unused release ID, such as `--out build/facility/facility-v9`, for a new candidate. Regeneration updates
editable masters and candidate files only. Baseline sources and masters are
retained in `build/facility/facility-v6/baseline/`; frozen v1–v5 files are never
rewritten. The new source module is included in every master/report's source
provenance. Specimen profiles intentionally omit the overview-only ecosystem
controller so existing part poses retain their independent behavior.

V6's final source candidate has 34,672 authored overview triangles, 39 browser
draws including LEDs, and nine runtime materials. Its 2,333,504-byte GLB meets
the 2.5 MB ceiling; it is 33,504 bytes above the 2.3 MB working target. Rack and
cooling specimens are 762,700 and 379,796 bytes. All three pass Khronos with zero
errors and warnings. The actual browser remains the authority for runtime
allocation, final rendering and performance.

The exporter losslessly interns byte-identical buffer views while preserving
component types, custom IDs, corners, UVs and exact float values. Shared vertex
views declare explicit `byteStride` as required by glTF. The canonical comparison
report proves every logical accessor and image payload remains unchanged. A
first deduplication attempt omitted the required explicit stride; the retained
rejected report records the validation failure before the corrected exports.
No BYTE scalar packing or lossy geometry/normal/UV quantization is used.

Air-route inlays are outward-facing metallic faces 2 mm off their actual fixed
supports. Rack traces follow the collar/collector step. The cooling plenum has a
fixed horizontal seam between removable sheets, so its trace remains physically
supported in the sectioned state. Trace geometry and authored air-space
centerlines share their normalized route-distance attributes.

Run four adversarial GLB fixtures with:

```sh
node assets-source/facility/validate-air-negative.mjs build/facility/facility-v6/facility.glb
```

The test independently rejects an off-route branch, cross-fluid passage, blocked
rack passage and missing section-cover root, checking the expected failure
reason. `reproducibility-report.json` compares byte-identical saved-master
re-exports from three fresh pinned Blender processes; it does not claim two full
procedural generations and Cycles bakes have been compared.

## V7 nocturnal construction and exact compaction

The current source adds two restrained platform-mounted service lights. Their
uprights, housings and warm stationary lenses share existing platform batches;
the small service-cover pulls use steel so the lenses replace the former trim
batch. The overview remains at 39 draws including LEDs and nine runtime
materials. Each source fixture has `gnContextId`, `gnCameraFit=false`, and
`gnRole=architectural_context`. The identity root records their placement and
the pre-decoration construction bounds in `gnPresentation`; the optional
inspection profile uses those exact bounds. Equipment topology is unchanged.

`industrial-night-v1` retains the 128 PMREM allocation, with broad overhead,
soft frontal and narrow rear reflections. The reviewed starting palette uses
neutral Graphite `#292929`, Steel `#616161`, Trim `#7b7b7b`, and Grille `#383838`.
Powder coat roughness is 0.48 with low-amplitude variation; steel is 0.37,
trim and copper 0.34. No new shader pass, texture, normal map, or dynamic shadow
is added. The existing 256 RGBA atlas receives an actual Cycles direct-light
bake from the two authored practical positions. Only the floor region is
modulated, smoothly within 0.88–1.0 after normalization; this is illustrative
appearance, not photometric evidence. Rotors are excluded and review lights
are disabled during that bake. The bake report records those settings.

The exporter welds only complete byte-identical attribute tuples and removes
exactly zero-area triangles. It then reuses identical aligned subranges of
binary buffer views, retaining the view metadata and every decoded attribute
byte. Positions, normals, UV seams, tangents, equipment IDs and signed route
distances remain unquantized. A rejected signed-BYTE probe is retained because
packed scalar attributes violate glTF's four-byte vertex alignment requirement;
adding the required stride offers no scalar storage reduction.

`equipment-index.json` is generated from the same equipment inventory as the
GLB. It exposes lowercase authored identity, label, system, role and bounds for
the HTML inspector before graphics load. It carries no calculated capacities.
The new optional overview inspection profiles are omitted from the separate
specimen profiles; their existing authored poses and camera contracts remain.

The v7 candidate is 2,258,680 bytes with 34,896 visible authored triangles.
Its rack and cooling derivatives are 730,672 and 364,456 bytes. All three pass
Khronos validation with zero errors, warnings and informational findings, and
fresh-process saved-master re-exports are byte identical. Browser composition,
lighting approval, resource estimates and final posters remain separate gates.

## V8 rack articulation

V8 adds optional `rackMotion.version: 1` metadata to the rack specimen. The
six part identities and cabinet envelope stay stable. `GN_RACK_DOOR` is now the
moving leaf only: the surrounding uprights, cross rails, hinge pins and fixed
knuckles belong to `GN_RACK_FRAME`. The door root is authored at glTF
`[-0.377, 1.405, 0.657]` metres, with local Y as its shaft. Its leaf meshes use
local coordinates around that root. Closed rotation is `[0,0,0,1]`; open
rotation is `[0,-sin(55°),0,cos(55°)]`, a 110° outward swing. The provisional
Z=0.643m shaft intersected the fixed surround; geometry validation required the
14mm forward correction.

`GN_RACK_TRAY` travels `[0,0,0]` to `[0,0,0.18]` metres. `GN_RACK_PANEL` alone
is the independent cutaway boundary; visibility changes are instantaneous.
The declared fixed camera and swept fitting bounds cover every accepted joint
state. Door and tray anchors are positions local to their respective roots.
The runtime must open the door fully before extending the tray, and retract
the tray before closing the door. A parked, disconnected fixed service plug and
separate moving tray inlet explicitly show isolation; no cable stretches
between moving and stationary roots.

`rack_motion.py` authors the leaf and hollow hinge sleeves and validates the
evaluated triangles. Checks cover 221 door samples and 181 rail samples plus a
continuous separating-axis proof. The latter finds exact sine/cosine projection
extrema for hinged vertices, endpoint extrema for rail translation, and
subdivides ambiguous intervals. Every accepted triangle pair must remain
separated over the complete interval. Its 1µm numerical threshold is a
calculation tolerance, not a manufacturing clearance. The frame check includes
the stationary surround, plinth, guides and hinge pins; adjacent trays, side
panel and fixed power harness also participate. Negative fixtures reject
inward door motion and tray extension with the door closed. These checks
establish geometric nonintersection under the authored interlock, without
certifying loads, wear, tolerance stacks or maintenance safety.

Regenerate only the rack into a new, unused candidate (v9 shown for the next
revision); `--only` leaves the overview and cooling masters untouched:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 \
  --python assets-source/facility/specimens.py -- --only rack --out build/facility/facility-v9
node assets-source/facility/validate.mjs build/facility/facility-v9/rack.glb
/Applications/Blender.app/Contents/MacOS/Blender --background \
  assets-source/facility/rack-specimen.blend --python-exit-code 1 \
  --python assets-source/facility/validate-rack-motion.py -- \
  --out build/facility/facility-v9/rack-motion-adversarial.json
```

The v8 candidate's overview and cooling GLBs reuse the frozen v7 bytes exactly.
Fresh pinned standalone re-exports from their unchanged saved masters matched
those bytes. `reuse-provenance.json` retains the v7 manifest digest and original
source/module references, exact model hashes, and verification-log hashes. The
fresh export reports record current source hashes because those exporters were
actually rerun; they do not claim procedural regeneration from changed scripts.
The v8 rack also re-exported byte-identically from its saved editable master.
Packaging still verifies current masters/modules and the browser capture
identity before local freezing; prior releases remain immutable.

V8 rack asset checks: **775,976 bytes**, **10,282 authored triangles**, **26
draws including LEDs**, **eight runtime materials**, and **3,751,928 estimated
asset-allocation bytes**. Offline Brotli is 227,803 bytes. Khronos reports zero
errors and warnings. Browser appearance, GPU allocation with environment,
interaction, accessibility and transfer measurements remain separate release
checks; asset validation does not establish those outcomes.

## V9 satin graphite and visible door construction

V9 keeps the eight authored material batches, three embedded image atlases and
single-pass renderer. `scene.json.surfaceBake.paintRoughness` is **0.42**, with
the existing bounded ±0.016 manufacturing variation. Metalness stays zero for
the black coating; `#292929` remains its neutral sRGB base color. The baked ORM
contains final values, and both glTF factors remain one. Grille, rubber,
polymer, copper and exposed-metal finishes are unchanged. Diagnostic .48/.42/.38
comparisons use frozen v8 geometry and lighting under
`build/facility/facility-v9/benchmarks/`; `benchmark-surfaces.mjs` reproduces those
test-only derivatives. They are not publishable assets or authoring masters.

`industrial-night-v2` retains the 128 PMREM resolution and four reflection
panels. Neutral overhead/front reflections reduce the broad brown cast; the
existing side reflection and third directional fill reveal camera-facing black
surfaces. Exposure 1.18 and environment intensity 1.08 stay fixed. V1/v2 softbox
and `industrial-night-v1` behavior remain unchanged. The approved browser review
must pin this runtime environment implementation together with the profile.

The rack's fixed service camera is raised to `[3.8,4.25,4.3]`, retaining its
target, 12% padding and swept bounds. It stays stationary through mechanical
movement. The moving door now has two registered outward-facing grille skins
separated by 1.5 mm, sharing the existing MASK material/batch. This makes the
inside face visible after the 110° swing without globally enabling two-sided
materials. Fourteen hidden/subpixel middle screws on stationary tray chassis
are removed; exposed service-tray attachments remain. The derivative has
9,906 authored triangles and 26 runtime draws, below v8's 10,282 triangles.
Six part identities, hinge axis, interlocks, 180 mm travel and disconnected
service connector are unchanged.

Run the read-only sheet and sweep checks after regeneration:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background \
  assets-source/facility/rack-specimen.blend --python-exit-code 1 \
  --python assets-source/facility/validate-door-sheet.py -- \
  --out build/facility/facility-v9/door-sheet-validation.json
/Applications/Blender.app/Contents/MacOS/Blender --background \
  assets-source/facility/rack-specimen.blend --python-exit-code 1 \
  --python assets-source/facility/validate-rack-motion.py -- \
  --out build/facility/facility-v9/rack-motion-adversarial.json
```

The sheet check proves separation, opposing face winding, matching aperture UVs
and reuse of the same material. The full sweep check includes both skins.
Browser masking, minification, readability and final retained allocation remain
separate checks. `source-v8-backup/` preserves the editable masters, scripts and
atlases from before this work; all frozen release files remain immutable.

## V11 spatial material and service-view candidate

**The early bake and camera settings below are historical.** Use
[V11-CURRENT.md](./V11-CURRENT.md) for the current root source, actual CPU/Metal
execution evidence, exact asset hashes, reviewed composition and remaining
qualification gaps. V11 is still unregistered; exploratory clone outputs must
not replace the root candidate without a reviewed integration.

V11 adds actual Cycles bakes from evaluated Rack 03, the front row-return
collector and Cooling 01 to three spatially mapped surface regions. UV face
metadata selects those regions explicitly; corner normals, UV seams and
semantic attributes still follow the existing batching path. No geometry,
material batch, texture dimensions or render pass is added.

The existing lower atlas is repacked into floor, plinth, rack-panel, collector
and cooler-panel regions. All 512² data regions retain eight-pixel gutters;
the 256² RGBA atlas has proportional gutters. AO is clamped at 0.72 to preserve
readability. Neutral direct illumination uses a floating-point bake, is
normalized to 0.55–1.0 linear modulation, then encoded as sRGB in the color
atlas. The exposed canonical rack side has measured AO of one throughout;
its spatial variation comes from direct illumination, not invented contact.
Removable covers, fan rotors and picking proxies do not cast these bakes.
Moving door/tray surfaces are not receivers. Canonical family receivers are
illustrative and shared, not a site lighting or cooling simulation.

The `industrial-night-v3` profile retains resolution 128, exposure 1.18 and
neutral graphite. Runtime rig review is owned by the integration lead. The
service camera candidate is `[4.8,5.2,3.6]` toward `[-.05,1.35,.20]`, with the
existing 12% padding and validated swept bounds. The optional overview profile
field `inspection.mobileRackAspect = 0.85` requests a taller rack inspection
stage; it does not change the mobile overview composition. Both the camera
and rig require matching browser review and posters.

### Local compute selection

`compute.py` configures Cycles only in the running Blender process; it never
saves preferences. Metal requests fail if the actual Apple GPU is unavailable.
All runs use four CPU render threads. The benchmark opens the master read-only
and records enabled devices, Blender/build hashes, input hashes, warmup and
three measured repeats. No global developer directory or GPU preference is
changed.

The exclusive local receiver-bake comparison on the M5 Pro measured medians:

| Mode | Three-repeat median | Enabled devices |
| --- | ---: | --- |
| CPU | 1.125 s | Apple M5 Pro CPU |
| Metal | 2.521 s | Apple M5 Pro GPU, 20 cores |
| Hybrid | 2.713 s | Both enumerated CPU and Metal devices |

This small, six-bake receiver workload benefits from CPU execution. The main
floor/detail generation runs used Metal, but a complete generator CPU/GPU
speed comparison has not been made. Enabled devices establish configuration;
they do not measure how Blender divides work in hybrid mode. Preliminary
measurements taken during other agents' CPU work remain marked development
timings. The initial Metal compilation warmup is preserved separately.

```sh
GN_CYCLES_DEVICE=metal /Applications/Blender.app/Contents/MacOS/Blender \
  --background --factory-startup --threads 4 --python-exit-code 1 \
  --python assets-source/facility/generate.py -- \
  --out build/facility/facility-v11
node assets-source/facility/validate.mjs build/facility/facility-v11/facility.glb
BAKE_SHA=$(shasum -a 256 build/facility/facility-v11/bake-report.json | cut -d " " -f1)
node assets-source/facility/validate-spatial.mjs build/facility/facility-v11/facility.glb --bake-report-hash "$BAKE_SHA"
node scripts/facility/package-release.mjs --release facility-v11
```

Run both validators for rack.glb and cooling.glb too, passing the same pinned bake-report digest. `validate-spatial.mjs` now rejects unsupported layouts and validates the split contact regions, actual embedded atlas hashes, per-role roughness and material channels.

`validate-spatial.mjs`
checks actual GLB UV coverage and embedded neutral opaque color, AO and ORM
pixels; it is not a visual-approval test. Use
`benchmark-compute.py --mode cpu|metal|hybrid --out <report> --context exclusive`
only in a coordinated quiet compute window. Independent GPU browser tests
and Blender bakes must be serialized.

### Evidence and limitations

Candidate evidence is under `build/facility/facility-v11/`. The initial source,
masters and atlases are preserved in `source-v10-backup/` with hashes.
`compute/quiet/` contains the measured comparison. `review-attempt-03/` retains
the earlier candidate reviewed before service-camera/lighting refinement.
The first camera refinement reduced visible tray travel and was rejected by
independent browser review. Existing reports retain the actual failed attempts,
including a generator variable-shadow error, eight-bit direct-light clipping,
sRGB encoding correction, unsupported new palette revision, and a correctly
rejected concurrent writer lease. These are not combined into a claim that
one untouched candidate passed everything.

New source geometry remains 34,896 overview triangles plus 576 LED triangles,
39 draws and nine runtime materials. Rack remains 9,906 authored triangles and
26 draws; cooling remains 4,162 triangles and 17 draws. Actual browser resource
accounting, stable phone service-part visibility, poster parity, motion and
final art scoring are separate gates. The original 4:3 phone capture remained
2/3 for material/composition craft. No exceptional visual score or public
release approval is implied by successful GLB validation.

Do not freeze inherited provisional posters. Final `capture-profile.json`
must describe the reviewed browser output, and the package command must
revalidate current source and model hashes before registration.
