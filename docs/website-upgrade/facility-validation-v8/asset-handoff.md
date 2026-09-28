# Facility v8 asset handoff

**V8 is frozen locally.** Author into a new unused release, currently `facility-v9`; never restage or overwrite v8. Public deployment and final performance acceptance are separate from this asset handoff.

## Editable sources and reproduction

| Artifact | Location and purpose |
|---|---|
| Overview master | [facility-master.blend](../../../assets-source/facility/facility-master.blend) |
| Articulated rack master | [rack-specimen.blend](../../../assets-source/facility/rack-specimen.blend) |
| Cooling master | [cooling-specimen.blend](../../../assets-source/facility/cooling-specimen.blend) |
| Geometry generation | [generate.py](../../../assets-source/facility/generate.py), [specimens.py](../../../assets-source/facility/specimens.py), [rack_kit.py](../../../assets-source/facility/rack_kit.py) |
| Hinge, rail and clearance proof | [rack_motion.py](../../../assets-source/facility/rack_motion.py), [validate-rack-motion.py](../../../assets-source/facility/validate-rack-motion.py) |
| Export and asset validation | [export.py](../../../assets-source/facility/export.py), [validate.mjs](../../../assets-source/facility/validate.mjs) |
| Camera, palette and toolchain | [render-profile.json](../../../assets-source/facility/render-profile.json), [scene.json](../../../assets-source/facility/scene.json), [toolchain.json](../../../assets-source/facility/toolchain.json) |

Use the [authoring/release runbook](../facility-authoring.md) for full generation, validation, staging, browser capture and freezing. The [current v8 README section](../../../assets-source/facility/README.md#v8-rack-articulation) includes rack-only regeneration and positive/negative clearance validation. Both use the pinned native Blender **5.2.2 LTS** executable; MCP is optional. Scripts share an exclusive writer lock. Save and close manual Blender editing before scripted writes.

The frozen manifest pins ten source modules and three editable masters. Overview and cooling reuse exact frozen v7 GLB bytes, verified by fresh saved-master exports; rack v8 also re-exported byte-identically. This proves saved-master export repeatability, not a repeated complete generation and bake. [Reuse provenance](assets/reuse-provenance.json) retains the frozen origin and actual export-log hashes.

## Frozen production files and validation

The [frozen v8 directory](../../../src/content/facility-releases/facility-v8) contains `facility.glb`, `rack.glb`, `cooling.glb`, six WebP posters and `manifest.json`. Overview posters are `poster-desktop.webp` and `poster-mobile.webp`; each specimen has `closed` and `cutaway` posters. Service views are live states rather than separately published poster files. The manifest digest is `4b652220b7d2282d97b1782a72dce7d97ebccf84c4d76866dc660fe8cc2bfa8e`.

- [Asset summary and evidence index](assets.json): counts, hashes, allocation scopes and two unused metadata caveats.
- [Rack asset validation](assets/rack-validation.json), [continuous motion proof](assets/rack-motion-validation.json) and [rejecting fixtures](assets/rack-motion-adversarial.json).
- [Frozen integrity](frozen-integrity.json), [packaging guards](packaging.json) and [runtime lifecycle](runtime-lifecycle.json).
- [Browser capture provenance](assets/capture-profile.json) and [visual review record](visual-review.json).

Asset allocation estimates exclude the shared browser environment. Historical poster-capture diagnostics in `assets.json` are not current performance measurements; use the separate runtime and production reports for those gates. Geometric nonintersection assumes the authored door/tray interlock and does not certify maintenance safety or mechanical tolerances.

## Durable diagnostic sheets

- [Overview: neutral and four selected systems](visuals/contact-sheet.png).
- [Specimens: closed, cutaway and service views](visuals/specimen-contact-sheet.png).
- [Sheet provenance and SHA256 hashes](visuals/provenance.json).

These are diagnostic composites copied byte-for-byte from the reviewed candidate capture. They are not deployment files or replacements for the frozen WebP posters. Capture-only layout overrides isolate the stage and suppress controls; full page layout is reviewed separately. Their associated capture report records reduced motion and no cadence samples. Frozen model and poster bytes were unchanged by this documentation copy.

The larger local review set remains under `build/facility/facility-v8/review/`, with conditions recorded in `review-capture.json`. That directory is ignored and may be removed during build cleanup; the two sheets and their source capture report are preserved here.
