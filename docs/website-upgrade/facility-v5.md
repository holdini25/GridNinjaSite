# Facility v5 — black-metal construction and surface materials

The frozen v5 release refines the existing synthetic facility on home and `/demo`.
Assessment records, publication URLs, quantities, CTAs, topology identities and
operational-authority boundaries remain unchanged. Equipment activity illustrates
relationships; it does not compute capacity.

## Construction and surface pipeline

One parametric rack kit supplies the overview and representative rack specimen.
The facility envelope and service ports remain fixed. Source geometry retains
layered panels, recessed modules, service clearances and two controlled front
configurations. Evaluated corner normals, UV seams and dense equipment/route
attributes survive static material batching.

The overview derivative exposes module fronts without an outer perforated door
skin. This keeps the depth readable at homepage scale. The inspection specimen
uses the same rack envelope and kit with a real masked door over recessed
equipment. Small overview pockets use recessed planar backings; the specimen
retains its hollow frame, walls, rails and moving service tray. These are
explicit display-detail choices, not different equipment identities.

`pbr-semantic-v2` uses the existing standard metallic/roughness renderer. Its
optional versioned surface profile leaves earlier visual releases on their
existing material path. The v5 path binds semantic accents directly, preserves
texture modulation during inspection, and validates shader insertion anchors.
Material constants are uniforms; program variants describe compiled features.

The surface contract uses UV0 with normal/ORM maps up to 512² and a color/label
map up to 256². Embedded PNG dimensions and prospective mip allocation are
checked before image decode. Material roles are recorded in glTF extras; normal
strength, sidedness and alpha mode use standard glTF material fields. Color maps
use sRGB and normal/ORM use data-space interpretation.

Specimen grille apertures use alpha masking backed by real recessed equipment.
At subpixel feature sizes the shader converges to a stable opaque grille. This
is a rendering approximation for minification, not modeled airflow or a vendor
construction claim. Large openings, frame thickness and service parts remain
geometry. Static occlusion excludes moving panels and trays.

`industrial-softbox-v2` retains one session-owned 128-resolution PMREM environment.
The renderer and environment are reused across assembly switches. Texture
sampling follows the existing adaptive tier: anisotropy 1 in Still/Economy and
up to 2 in Balanced/High, capped by hardware support.

## Reproduce and review

Use the pinned native Blender 5.2.2 LTS toolchain, Node 22, npm and the existing
lockfile. The Python generation/export workflow does not require a listening
Blender bridge. Blender, capture and packaging operations share a writer lease.
Never overwrite an already registered release identity. `facility-v5` is now
frozen. Run `npm run dev` to inspect it, or use the next unused release ID for
new authoring; the example below uses `facility-v6`.

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 \
  --python assets-source/facility/generate.py -- --out build/facility/facility-v6
npm run facility:stage -- --release facility-v6
FACILITY_PREVIEW=1 FACILITY_ASSET_RELEASE=facility-v6 npm run dev -- --hostname 127.0.0.1
FACILITY_BASE_URL=http://127.0.0.1:3000 npm run facility:capture -- --release facility-v6
FACILITY_BASE_URL=http://127.0.0.1:3000 node scripts/facility/capture-review.mjs --release facility-v6
npm run facility:stage -- --release facility-v6
npm run facility:freeze -- --release facility-v6
```

The material fixture server binds to loopback with an exact resource allowlist;
it is independent of application routes. It compiles the production material
composer in WebGL and records source hashes and graphics identity. Full-scene
visual review uses a bounded diagnostic DPR override, explicitly separate from
natural adaptive-performance evidence.

The pinned v5 diagnostics can be rerun independently:

```sh
node scripts/facility/verify-materials.mjs
FACILITY_MATERIAL_ASSET_DIRECTORY=src/content/facility-releases/facility-v5 \
  node scripts/facility/capture-material-assets.mjs
```

Production verification uses the same release/mode during build, serving and
collection. Run lint, typecheck, unit/E2E suites, release validation, browser
lifecycle checks, and five fresh runs for each home/demo desktop/mobile profile.
Measured results and source provenance belong in the evidence directory below.

## Delivery and rollout

Source models and candidates remain outside public delivery. Frozen models,
browser posters and their hashes are served only through the existing exact
asset allowlist. Earlier registered release bytes remain immutable.

`FACILITY_ASSET_RELEASE` selects the visual release. `FACILITY_3D_MODE` retains
`poster`, `manual`, `auto-desktop` and `auto-adaptive`; rollback does not change
assessment content. Freezing a local visual release does not deploy the website.

See [v5 validation](facility-validation-v5/README.md) for measured results and
outstanding release gates. Physical-device and manual accessibility results
must be reported separately from browser emulation. Existing LCP/TBT gates are
retained.
