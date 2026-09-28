# Facility v7 — nocturnal industrial clarity

V7 is registered locally and selected by default. It improves black-metal readability, adds explicit construction close-ups, and connects authored equipment to the current assessment and scoping journey. Asset registration is complete; **public deployment and final production acceptance are separate**. See the [validation report](facility-validation-v7/README.md) for measured results and outstanding gates.

## Visual release

The versioned `industrial-night-v1` environment uses the existing 128-resolution PMREM allocation and single PBR render pass. Broad overhead reflection, a narrow rear separation, and weak frontal illumination reveal neutral graphite, steel, grille recesses, and copper against `#080808`. The reviewed profile sets exposure to 1.18 and environment intensity to 1.08. It adds no postprocessing, dynamic shadows, additional texture atlas, or extra runtime material.

Two restrained service-light housings share existing batches. Their authored positions drive a static floor-light bake in the existing color atlas. Their warm lenses are stationary construction; amber selection and v6 electrical/cooling/heat signals retain separate meanings. Decorative fixtures are excluded from camera fitting. Their appearance does not establish measured light output or equipment ratings.

The exact exporter welds only complete byte-identical attribute tuples, removes exactly zero-area triangles, and reuses identical aligned buffer ranges. It preserves evaluated corner normals, UV seams, semantic identities, and signed route distances. No lossy position, normal, UV, or identity quantization is introduced. The three saved Blender masters re-export byte-identical GLBs in fresh pinned Blender processes; this does not claim that two complete procedural generations and Cycles bakes were compared.

## Inspection, navigation, and data ownership

- **Overview** remains orthographic. **Rack detail** and **Air-path detail** are explicit 32° perspective views, fitted to authored bounds with 12% padding. Rack detail uses the selected rack, or Rack 03 (`rack-02`). Air-path detail opens the section. Projection changes cut directly; compatible camera transitions retain 420 ms motion, snapping under Pause, reduced motion, or Still quality.
- The mobile stage is 4:3 with reviewed framing and a separately captured browser poster; desktop remains 1.7:1. Construction bounds include moving extents and exclude decorative fixtures. Active-camera picking, clipping, resizing, staging, and first-frame diagnostics support both projections; detail readiness does not require the platform to remain visible.
- Entering a close-up exits the workload story. Returning to Overview closes the section and retains the selected system. Assemblies remain explicitly downloaded assets sharing the same canvas/session. Their existing closed, cutaway, and service poses retain separate authored cameras.
- The four-system rail stays primary. Authored equipment identities are available in HTML before graphics load. A selected inspector exposes **Decision, Conditions, Evidence, Next step**, using native disclosures and at most one principal plus two related destinations. Only the selected explanation occupies layout space.
- `/demo` accepts one allowlisted `focus` system or authored equipment identity. Committed selection updates history; previews, playback time, route IDs, specimen state, and interpolation are not serialized. Back/Forward restores validated assessment/focus and a stopped Overview. Scenario and perspective changes clear focus atomically. Invalid focus clears only visual selection; invalid/conflicting assessment identity keeps the unavailable state without substituting another fixture.
- AI Cloud and Colocation use server-rendered still-image entry points to fixture B with an allowlisted public `topic`. Named links carry editable topic context into scoping. Topics remain separate from inquiry prose and are absent from analytics. Published brief links come from the current assessment selectors; the timed-dispatch example remains separate.

The assessment-scoping page remains prerendered. Its existing form client boundary resolves allowlisted `topic` and approved `source` from the URL after hydration; this context does not make the entire page dynamic. Static decisions and native evidence links remain usable without JavaScript. The contact form already requires JavaScript and security verification to submit, and its no-JavaScript message states that limitation.

`AssessmentExplorer` remains the sole assessment-selection owner. Homepage fixture B remains +7.0 MW requested and +5.8 MW modeled above the 20 MW reference for one hour. Demo A–D, immutable publications, synthetic scope, and CTAs retain their established semantics. Storage says **“Contribution and duration unassessed.”** Motion does not calculate capacity or grant operational authority.

### Additive contracts

- `FacilityCamera` supports optional projection/FOV; `FacilityRenderProfile.inspection` versions the fitting subjects, mobile framing, and rack/air-path detail cameras.
- `FacilityView` extends the existing overview variant with `detail` and optional authored `equipmentId`. `FacilityVisualRelease.equipmentIndex` exposes validated identity, label, system, role, and bounds without loading GLB topology.
- `FacilityInspection` accepts optional `initialTarget`, `onCommittedTarget`, and `topic`. Committed targets are normalized through the public index before URL serialization. A graphics generation is retired synchronously on Close/failure, preventing a late pick from writing history during React's pending commit.
- Profiles without these optional fields retain the previous release path. Existing v1–v6 files remain immutable, and the same asset allowlist and source/candidate deployment exclusions apply.

The renderer retains one environment, manual scheduler, current scene, and bounded staging overlap. The eight-second deadline, shader prewarming, exact asset hashes, texture preflight, cancellation, and session-owned disposal still apply. Mobile startup changes are controlled experiments; only the final matched production measurements determine whether a candidate optimization is retained.

## Sources and reproduction

Editable sources: [overview master](../../assets-source/facility/facility-master.blend), [rack master](../../assets-source/facility/rack-specimen.blend), [cooling master](../../assets-source/facility/cooling-specimen.blend). The [authoring workspace guide](../../assets-source/facility/README.md) describes the shared rack kit, atlases, topology, bakes, and serialized writer lease. The [generator](../../assets-source/facility/generate.py), [exporter](../../assets-source/facility/export.py), [scene parameters](../../assets-source/facility/scene.json), and [render profile](../../assets-source/facility/render-profile.json) remain non-public. The frozen [v7 manifest](../../src/content/facility-releases/facility-v7/manifest.json) records approved file sizes, hashes, profiles, and source provenance.

Use Node 22, npm with the existing lockfile, and native Blender **5.2.2 LTS**, build `d13f752e3b9c`. V7 is frozen: use the next unused release ID for regeneration. The commands below illustrate a new **v8 candidate**, not an overwrite of v7. Back up current editable masters before deliberate authoring changes. Do not run Blender, capture, and packaging writers concurrently or remove an active writer lease.

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 \
  --python assets-source/facility/generate.py -- --out build/facility/facility-v8
```

The first stage requires a complete bundle. Before the first browser capture, copy the six previous approved posters into the **candidate directory only** as temporary staging inputs; these are replaced by exact new browser captures before freeze:

```sh
cp src/content/facility-releases/facility-v7/*.webp build/facility/facility-v8/
npm run facility:stage -- --release facility-v8
FACILITY_PREVIEW=1 FACILITY_ASSET_RELEASE=facility-v8 FACILITY_3D_MODE=auto-adaptive \
  npm run dev -- --port 3001
```

With that preview running, capture and inspect in a separate terminal. Stop concurrent GPU/performance runs while collecting visual evidence:

```sh
FACILITY_BASE_URL=http://127.0.0.1:3001 npm run facility:capture -- --release facility-v8
npm run facility:stage -- --release facility-v8
FACILITY_BASE_URL=http://127.0.0.1:3001 node scripts/facility/capture-review.mjs --release facility-v8
FACILITY_BASE_URL=http://127.0.0.1:3001 node scripts/facility/capture-ecosystem.mjs --release facility-v8
```

Review matching posters, selection states, perspective details, mobile framing, all specimen poses, and motion. Any source/profile/model change requires regeneration or restaging as applicable and a fresh matching capture. Then freeze the already-reviewed staged bytes:

```sh
npm run facility:freeze -- --release facility-v8
npm run facility:validate
```

Freeze verifies source/master hashes, exact model/profile/poster capture identity, complete allowed files, semantic contracts, and budget checks. It registers the release atomically and refuses to overwrite a registered ID. Review files stay under `build/`; source models and candidates stay outside public asset delivery.

For production verification of the current frozen v7, use matching settings for build, server, and measurements:

```sh
FACILITY_ASSET_RELEASE=facility-v7 FACILITY_3D_MODE=auto-adaptive npm run build
FACILITY_ASSET_RELEASE=facility-v7 FACILITY_3D_MODE=auto-adaptive npm run start -- --port 3000
```

## Rollback, mobile diagnostics, and release gates

`FACILITY_ASSET_RELEASE=facility-v7` selects the default frozen release. `FACILITY_3D_MODE` accepts `poster`, `manual`, `auto-desktop`, and `auto-adaptive`; unset or other values resolve to `auto-adaptive`. Use `poster` for immediate visual rollback at the next normal build/release, or select an earlier registered release. Build and serve with consistent settings because pages may be prerendered. `FACILITY_PREVIEW=1` admits an unregistered candidate only during local development; it cannot bypass production registration.

**Contact deployment prerequisite:** apply the additive `drizzle/0002_public_assessment_topic.sql` migration through the existing database release process before deploying the updated contact app. This implementation generated the migration but did not execute it. See [public-topic compatibility and retry behavior](facility-v7-contact-topic.md).

Use `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer` per Simulator command, keeping the global developer directory unchanged. Simulator Safari, macOS Safari Web Inspector, screenshots, recordings, and timeline/network diagnostics complement Chrome production traces. Simulator output is separate from real iPhone/Android GPU, thermal, memory-pressure, energy, and manual accessibility evidence.

Local evidence now contains **88 scene states and 48 chapter states** across original and supplemental desktop/mobile DPR 1/1.5 reports; the original 66 scene captures predate the final explanatory UI but match the frozen assets. Separate final reports pass twenty readiness/cadence runs, ten open/close and ten asset-switch cycles, explicit specimen transfers, and a 900-second M5 Pro Chrome sustained run. The earlier incomplete sustained attempt remains preserved. The [validation report](facility-validation-v7/README.md) distinguishes these measurements and their source/build identities. Public rollout remains blocked by mobile LCP **2.606 s home / 2.746 s demo**, above 2.5 s, plus native Safari/physical-phone/manual accessibility requirements and the contact database migration prerequisite. CLS and TBT gates pass; no public deployment is claimed.
