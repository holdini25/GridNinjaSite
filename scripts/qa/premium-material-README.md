# Private material and lighting diagnostics

These tools never register a visual release, expose a website debug route, or
change canonical Blender sources. The production loader, shader composer,
environment and camera fitting are reused by the browser fixture. Diagnostic
material clones are local to the fixture.

## Input provenance

1. Copy the candidate models, exact manifest, authoring source and bake report to
   an isolated `build/qa` directory. Preserve the control files unchanged.
2. Run `premium-surface-metadata.py` with `--authoring`, `--bake-report` and a new
   `--output` path under `build/qa`. New reports supply `atlasTiles` and
   `atlasOrigin`; historical reports use hash-verified Python AST literals. The
   script never imports or executes authoring code.
3. `assets-source/facility/benchmark-surfaces.mjs` requires `--source`,
   `--manifest-hash`, `--metadata`, `--metadata-hash` and a fresh `--output`.
   Optional `--roughness 0.42,0.38,0.46` and `--roles paint,rack_panel,...` select
   bounded comparisons. Do not use a derivative as a production asset.

The roughness tool verifies each source GLB against the manifest, locates the
embedded ORM by exact image hash, validates UV0/factor bindings and atlas regions,
then changes only the selected green-channel texels, including gutters. All
non-ORM view bytes and buffer aliases remain intact. An unchanged value returns
the original GLB bytes. Unsupported/overlapping layouts and source mismatches fail.

## Browser capture

`premium-material-capture.mjs` requires a JSON config with schema
`premium-material-capture.v1`, its exact `--config-hash`, and a fresh `--output`.
Use `--validate-only` to check all inputs and compile the module sources without
opening a browser. Example configs live under
`build/qa/premium-release-01/diagnostics/`.

- Each variant gives an ID, input directory and exact manifest SHA256.
- Each case gives a unique ID, subject (`overview`, `rack`, `cooling`), pose and
  CSS dimensions. Rack `service-connection` uses the actual explicit cutaway.
- Modes are `final`, `gray`, `normal`, `roughness`, `ao`, `metalness`, `uv`.
- DPR choices are 1 and 1.5. Phone profiles remain emulated.
- Optional lighting patches are restricted to existing finite-light placement /
  strength and existing hemisphere/directional intensities. Exposure, cameras,
  light counts, environment resolution and material values cannot be changed by
  this patch interface.

Obtain the exclusive local GPU lease before execution. The tool requires the
actual M5 Metal renderer, records browser-level GPU information, and produces
hash-bound images, comparison sheets and a report. Every failed attempt belongs
in a new directory. A passing capture report means the diagnostics executed;
it does not award a visual score, qualify page performance or approve release.

First run the 21-image smoke fixture to compile every diagnostic mode. Then
compare new maps against the frozen control under identical lighting. Evaluate
lighting changes in a separate comparison using the accepted material input.
Never combine an unreviewed material change and a light change in one claimed
causal comparison. The user approves the final A/B board before asset expansion.

## Blender geometry/light-direction reference

`premium-blender-reference.py` runs through a separate Blender background process
with `--factory-startup`, `--source`, `--manifest-hash`, `--kind`, and a fresh
`--output`. It imports the hash-verified web GLB and creates an editable reference
with matching source-light directions. It renders nothing, does not touch
preferences or master files, and records its limitations. Its point-light energy
is explicitly a placement aid, not a candela-to-watt conversion. Browser PMREM,
materials and bounds-derived cameras remain authoritative for final appearance.

## Initial evidence

- `diagnostics/cpu-checks.json`: source/atlas/layout mutation checks, exact no-op
  control, role-channel confinement and non-ORM view preservation.
- `diagnostics/smoke-attempt01/report.json`: 21 captures passed on Apple M5 Metal.
- `roughness-attempt01` is superseded: initial repacking expanded aliased views.
  `roughness-attempt02` preserves those aliases. Both attempts are retained.

No conclusion about premium craft follows from these technical checks. Review
normal-size whole-page compositions, selected states, motion and recovery states
separately. Posters for release must be captured from the integrated website.
