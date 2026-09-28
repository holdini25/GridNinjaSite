# Blender facility authoring and release runbook

The facility is an illustrative, synthetic equipment model. Assessment fixtures
remain the source of every quantity, outcome, evidence link and publication.
Editing equipment or selecting a system does not calculate capacity or grant
operational authority. Economics remain unestimated.

## Pinned workstation and collaboration

Use native Apple Silicon **Blender 5.2.2 LTS**, build **d13f752e3b9c**, installed at
`/Applications/Blender.app/Contents/MacOS/Blender`. The generator enforces this
pin. Use Node 22, npm and the existing package lock. This workstation currently
has Node 22.23.2 at `/tmp/node-v22.23.2-darwin-arm64/bin/node`; another workstation
should provide a normal Node 22 installation on PATH.

Codex owns repeatable Python generation, validation and browser inspection.
An artist owns composition decisions and manual refinements in Blender. MCP is
optional: the checked-in Python scripts and native Blender executable provide
the complete authoring path without an add-on or persistent remote session.

Only one writer may touch the master at a time. Save and close a manual editing
session before generation. Generation, standalone export, capture and packaging take the same
exclusive `generation.lock`; after an interrupted process, establish that no
facility writer is running before
removing a stale lock. The lock prevents concurrent scripted generation, not
an artist saving an independently open Blender window.

## Source ownership and editable model

Source files live in `assets-source/facility/`; generated candidates and review
images live in ignored `build/facility/<release>/`. **V1–v8 are frozen; v8 is the
current local release.** Authoring examples use the next unused `facility-v9`;
choose a later unused ID if v9 has since been registered. To inspect or measure
frozen v8, select `FACILITY_ASSET_RELEASE=facility-v8` without staging or
freezing it again. The [v8 source notes](../../assets-source/facility/README.md#v8-rack-articulation)
explain its moving door, independent tray and cutaway. The
[asset handoff](facility-validation-v8/asset-handoff.md) indexes all editable
masters, frozen files, validation and durable diagnostic contact sheets.

| Collection/file | Ownership and use |
| --- | --- |
| `AUTHORING` | Individual generated parts; regeneration replaces these. Enable it and hide EXPORT for detailed editing. |
| `AUTHORING_MANUAL` | Persistent artist meshes; never deleted or renamed by generation. Assign one approved palette material and `gnDomain` of power, cooling, storage, workloads or platform. Regeneration incorporates evaluated geometry into the export batches. |
| `REFERENCE` | Review camera, lighting and artist references. Excluded from the GLB. |
| `EXPORT` | Merged static equipment, semantic groups, four rotors, 48 LED anchors and four picking proxies. Generation recreates it. |
| `facility-master.blend`, `rack-specimen.blend`, `cooling-specimen.blend` | Editable overview and independent specimen masters; serialized writes only. |
| `specimens.py`, `rack_kit.py`, `rack_motion.py` | Specimen construction, shared cabinet kit and authored rack articulation/clearance proof. |
| `engineering_metadata.py`, `air_circuit.py` | Semantic equipment/services, source provenance and illustrative air-path geometry. |
| `generate.py`, `scene.json` | Authored geometry and layout/palette parameters. Persist generated-part changes in the script or the manual collection. |
| `surface_bake.py` | Cycles normal/AO bakes, shared normal/ORM atlases and receiver UV assignment. |
| `service_routes.py` | Typed service ports, route geometry, supports and termination checks. |
| `export.py` | Pinned standalone GLB export, shared texture descriptors and source provenance. |
| `render-profile.json` | Browser camera, fit padding, lighting, exposure and color settings. Poster and live rendering must use the same profile. |

Keep the identity root `GN_EXPORT` and its `gnId` metadata stable. Each system
retains its `GN_*` root, `GN_ACCENT_*` child and `GN_PICK_*` child. Names alone
are not the runtime contract. Fan rotors have local **Y** shafts after glTF
conversion; LED anchors have identity orientation and no geometry. Picking
proxies must remain outside visible rendering.

## Generate, inspect and stage

Run from the repository root:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 \
  --python assets-source/facility/generate.py -- --out build/facility/facility-v9 --render
node assets-source/facility/validate.mjs build/facility/facility-v9/facility.glb
node assets-source/facility/validate.mjs build/facility/facility-v9/rack.glb
node assets-source/facility/validate.mjs build/facility/facility-v9/cooling.glb
```

Generation updates the editable master and optimized GLB, while `--render`
adds a Blender review image. The full generator also produces both specimen
masters and their GLBs. Reports record the masters and ten source-module hashes, exact GLB bytes,
bounds, identities, equipment bindings and draw/triangle counts. Generation
also writes bake, normal-preservation and service-connectivity reports.
The separate validator runs Khronos validation and inspects the exported
geometry, ancestry, fan axes, LED transforms, materials and memory budgets.

To re-export an already prepared and saved EXPORT collection without rebuilding
the source geometry:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background \
  assets-source/facility/facility-master.blend --python-exit-code 1 \
  --python assets-source/facility/export.py -- --out build/facility/facility-v9/facility.glb
```

Changes in AUTHORING_MANUAL require generation to rebuild EXPORT first. Direct
EXPORT edits are replaced on the next generation.

A complete candidate includes three GLBs, `specimen-descriptors.json`, their
reports, and six WebP posters: overview desktop/mobile plus rack/cooling
closed/cutaway. For the first browser preview only, existing frozen posters
can bootstrap staging:

```sh
cp src/content/facility-releases/facility-v8/*.webp build/facility/facility-v9/
```

Replace every bootstrap poster with the actual candidate browser capture
before freezing. The capture script uses a 1360×800 desktop stage and a
340×255 mobile CSS stage with the authored portrait composition; it records
the actual renderer dimensions. Stage the complete candidate:

```sh
npm run facility:stage -- --release facility-v9
FACILITY_PREVIEW=1 FACILITY_ASSET_RELEASE=facility-v9 npm run dev -- --hostname 127.0.0.1 --port 3000
```

Inspect both `/` and `/demo` using the actual R3F renderer. Candidate preview
is limited to development mode. A temporary Blender still can bootstrap the
first local review, but replace it with browser captures before release.
Capture neutral and four selected states, inspect desktop/mobile crops and
poster handoff, and rerun staging whenever an asset or render profile changes.
Keep final posters within 150 KiB each, targeting 100 KiB or less.

Capture the final renderer and contact sheet, then refresh candidate hashes:

```sh
FACILITY_BASE_URL=http://127.0.0.1:3000 npm run facility:capture -- --release facility-v9
npm run facility:stage -- --release facility-v9
```

Set `FACILITY_BASE_URL` explicitly to the actual development server URL during
candidate capture. Performance verification below uses a production build.

## Validate and freeze a visual release

Asset validation does not establish browser quality, accessibility, loading
policy, network transfer, frame timing or resource cleanup. Record those checks
separately against the actual homepage and demo production build. Synthetic
labels and assessment meanings must survive every interaction and failure.

After candidate visual review and asset checks, freeze the local bundle for
production-build verification. Public deployment waits for the full release
checks and repository content review:

```sh
npm run facility:freeze -- --release facility-v9
npm run facility:validate
npm run lint
npm run typecheck
```

Freezing creates an immutable version under `src/content/facility-releases/`
and pins its manifest digest in the registry. It does not deploy the website.
The packager requires an explicit `--release facility-vN` and refuses registered
identities. Staging validates a complete temporary bundle before replacing the
local candidate directory. Freezing validates the reviewed stage, confirms the
three masters, render profiles and all ten source modules are unchanged, and
checks browser-capture model, profile and poster hashes. Current
`source.modules` pins `generate.py`, `export.py`, `surface_bake.py`,
`service_routes.py`, `engineering_metadata.py`, `specimens.py`, `rack_kit.py`,
`air_circuit.py`, `rack_motion.py` and `scene.json`. Changing an input after
export requires a new verified candidate report. V8 reused the overview and
cooling GLB bytes from frozen v7: fresh saved-master exports verified byte
identity, with original and current provenance retained in
`reuse-provenance.json`. This is not a claim that changed generators recreated
those assets. The packager installs a complete bundle before atomically
replacing the registry; an unregistered bundle can only be recovered when its
bytes exactly match the reviewed stage. Never delete or edit an older release
to reuse its URL. Existing assessment and visual publications remain immutable.

Repeat the packaging guard checks with:

```sh
node scripts/facility/test-packaging.mjs
```

This builds temporary filesystem fixtures from the frozen v1/v2 artifacts and
runs 18 checks, including malformed IDs, concurrent writers, stale master,
helper, scene or capture hashes, invalid posters, corrupt staged bytes,
failed-stage recovery, legacy provenance compatibility and immutable version
reuse. It requires installed npm dependencies, but no
Blender session, browser, development server or generated candidate directory.
All package operations target the temporary fixture; the script verifies that
the real registry and frozen files are unchanged. Its JSON report is written to
`build/facility/facility-v2/version-workflow-validation.json`. Reconstructed
capture metadata in these test fixtures only exercises packaging checks; final
release capture provenance still comes from the actual browser capture command.

Only registered, available files are served through `/assets/facility/`.
Unknown/withheld releases return 404, withdrawn releases 410, and corrupt
registered assets 503. Build tracing excludes source masters and candidates.
Do not copy any of these files into `public/`, and do not modify existing
assessment publication bytes as part of a visual release.

`FACILITY_ASSET_RELEASE` chooses the frozen asset version. Set
`FACILITY_3D_MODE` to `poster`, `manual`, `auto-desktop` or `auto-adaptive`.
The current v8 local preview uses `auto-adaptive`; public adaptive mobile remains
unapproved until its performance, physical-device and manual accessibility
gates pass. Poster mode is a reversible rollback for rendering issues while
retaining assessment content. Rebuild and deploy after changing these settings:
the homepage is prerendered. Deploy through the normal website process only
after the recorded homepage/demo release gates pass.

## Production performance collection

Build and serve the intended frozen release. Stop the development server first
if it occupies this port; leave `FACILITY_PREVIEW` unset. The example uses the
frozen v8 local preview. Select an earlier release and its recorded mode
consistently only when reproducing historical results.

```sh
export FACILITY_ASSET_RELEASE=facility-v8
export FACILITY_3D_MODE=auto-adaptive
npm run build
npm run start -- --hostname 127.0.0.1 --port 3000
```

In a second terminal, set the same release and mode, then run these commands
sequentially against that unchanged build:

```sh
export FACILITY_ASSET_RELEASE=facility-v8
export FACILITY_3D_MODE=auto-adaptive
FACILITY_BASE_URL=http://127.0.0.1:3000 npm run facility:measure
FACILITY_BASE_URL=http://127.0.0.1:3000 FACILITY_HEADED=1 FACILITY_ANGLE=metal npm run facility:verify-browser
FACILITY_BASE_URL=http://127.0.0.1:3000 npm run facility:lighthouse
npm run facility:performance:validate
```

`facility:measure` defaults to five fresh contexts for each homepage/demo and
desktop/mobile-emulation combination. A single `facility:lighthouse` command
collects **all 20 runs**: five fresh browser profiles for each route and each
desktop/mobile profile. Do not run a second mobile collection command.
`facility:performance:validate` checks complete evidence, matching build/release/
harness/browser provenance and the budgets; successful collection alone does
not establish a passing release. Keep source, harness and the browser version
unchanged throughout collection. The Metal check measures this Mac; mobile
emulation and physical mobile testing remain separate evidence.

## Historical v3 surface and service pipeline

The compiler retains evaluated bevel corner normals during material/system
batching. It transforms them with the inverse-transpose matrix, assigns custom
split normals to the merged mesh and preserves UV corners independently. This
keeps broad coated-metal faces and curved fan housings readable without bright
outline materials. Two rack-front variants, raised rear equipment, separated
reserve cabinets and finite-thickness fan blades provide the authored detail.
The browser uses the approved 42° azimuth / 32° elevation camera, 12% fit
padding, projected visible geometry bounds and a 128-pixel softbox environment.

`surface_bake.py` produces two shared **512×512** atlases with actual Blender
Cycles bakes at **64 samples**, seed 19:

- Foundation and rack-plinth AO use a 0.75m distance. Static fan guards
  participate; all rotor and picking-proxy meshes are excluded.
- Rack and coil prototypes use selected-to-active normal and AO bakes with
  0.08m AO distance, 0.10m cage extrusion and 0.20m ray distance.
- ORM packs occlusion, roughness and metallic values in R, G and B. Receiver
  AO gets a small edge-clamped 1–2–1 filter; other surfaces use their assigned
  detail or neutral tiles. The exporter interns duplicate texture descriptors.

These maps are visual surface and contact occlusion, with no airflow or
capacity calculation. The analytic contact footprints used in historical v2
are not ray-traced lighting and are not used by the v3 exporter.

`service_routes.py` declares electrical, cooling supply/return and illustrative
reserve ports. It generates enclosed busways, pipes, endpoint collars and
supports. Checks establish unique IDs, compatible service types, connected
ports, finite nonzero segments and exact route endpoints. Equipment-port
terminations are checked against bounds from actual authored equipment meshes;
junctions use explicit modeled enclosures. Raised 24mm copper busway inlays sit
on visible faces with at least 1mm clearance, so selection highlights remain
visible instead of being enclosed inside the busway. Connectivity is
illustrative; these checks do not certify sizing, dispatchability or design.

## Performance decisions and measured assets

Static surfaces are accumulated in material/system buckets and concatenated
into indexed meshes. This reduces over a thousand editable parts to 38 mesh
submissions, including four independent rotors. The runtime adds one instanced
LED batch and uses one shared accent shader with four domain strengths.
Shared baked atlases add no draw submission or per-frame occlusion pass.
Texture descriptor interning prevents separate materials allocating duplicate
atlas textures. No runtime compression decoder or exported animation clip is
needed. Browser environment allocations are measured separately from the GLB.

### Historical frozen v2

The neutral black v2 GLB has SHA256
`80bc6c4404047ab4e0c260e7003d0a8b7f2e70a4048cd3aab901f96fdbe6848d`.
It retained v1 geometry, identities, copper accents and camera, with a neutral
graphite/steel palette and `#080808` browser background. Its historical asset
results are retained for comparison:

| Check | Frozen v2 result |
| --- | --- |
| Khronos issues | Zero errors, warnings and informational issues |
| Geometry | 26,954 authored triangles; 1,315,238 geometry-buffer bytes |
| Draw/material budget | 39 expected draws including LED batch; eight authored materials, ten expected runtime materials |
| GLB size | 1,380,616 decoded bytes; 123,979 bytes with local Brotli compression |
| Texture allocation | Approximately 768 KiB RGBA with mipmaps |
| Semantic contract | 66 identities, four verified fan axes and 48 empty LED anchors |

### Historical frozen v3

The approved v3 GLB has SHA256
`43ff2688b2a7765b38ea59e8918734b20da9fe3beaaaf65f3185bd87d5c6b5ac`.
Its registered manifest digest is
`a03fc3df85ffbd0c468e5219ec3aa1eb529d4bc4eb6ffa3bc63f7dd0254b7525`.

| Check | Frozen v3 result |
| --- | --- |
| Khronos issues | Zero errors; 42 generated-tangent-space warnings; zero informational issues |
| Geometry | 32,734 authored triangles; 33,310 runtime triangles including LEDs; 1,684,700 geometry-buffer bytes |
| Draw/material budget | 39 runtime draws; eight authored materials, ten runtime materials |
| GLB size | 2,080,304 decoded bytes; 457,705 bytes with local Brotli compression |
| Atlas allocation | Two shared 512×512 normal/ORM images and two texture descriptors; 2,796,204 estimated RGBA/mipmap bytes |
| Normals and UVs | 46,804 exported normals checked; maximum unit-length error 1.05×10⁻⁷; eight retained UV seams |
| Services | 26 routes, 52 ports, 18 supports; 26 equipment ports within the 60mm termination tolerance |
| Posters | Desktop 46,412 bytes; mobile 15,132 bytes |
| Semantic contract | 66 identities, four verified fan axes and 48 empty LED anchors |

The tangent-space warnings record the absence of explicit tangent attributes;
the browser derives the normal-map basis. They remain part of the release
record, and appearance must be checked in each supported browser. The corner
normal compiler's maximum vector error was 0.000310, recorded separately from
the exported normals' unit-length check.

`build/facility/facility-v3/reproducibility-report.json` records a standalone
export from the saved editable master to `reexport-check/facility.glb`. It was
byte-identical to the reviewed GLB under the pinned Blender toolchain and five
source-module hashes. This verifies saved-master re-export; it does not claim
that a second complete procedural generation and Cycles bake was compared.
The exact master and five module SHA256 values are retained in the frozen
`src/content/facility-releases/facility-v3/manifest.json` and the candidate
`asset-report.json`.

Compressed size is an offline asset measurement, not observed HTTP transfer.
The browser's complete automatic experience must still meet the whole-page
transfer and frame budgets, including downloaded graphics code and all assets.
Retain `asset-report.json`, `validation.json`, `bake-report.json`,
`normal-preservation-report.json`, `service-report.json`,
`reproducibility-report.json` and `capture-profile.json` with release evidence.
Recompute the relevant measurements for each changed candidate; local freezing
and visual approval do not establish a passing public performance release.
