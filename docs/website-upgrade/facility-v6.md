# Facility v6 — coordinated infrastructure ecosystem

V6 extends the existing black-metal facility with a continuous authored exhaust
path and a six-chapter workload explanation. It is an illustrative equipment
model. Motion, heat emphasis and fan response do not calculate capacity, model
temperature or establish operating authority.

## Construction

The twelve racks retain their positions and common front orientation. Rear
exhaust compartments connect through roof collars to two shallow row collectors,
a right-side return trunk and the four air-handler intakes. The water headers
move behind the cooler bank. The top fans discharge to a shared open room-air
domain; that domain has no claimed CFD streamline. A sectioned view exposes real
walls and passages by removing one batch of covers.

Authoring uses the pinned native Blender 5.2.2 LTS Python workflow. New parts reuse
the existing texture atlases and material batches. Source/master backups and
pre-v6 release hashes are retained under `build/facility/facility-v6/baseline`.
The old registered GLBs and manifests are immutable.

## Evidence and narrative

The homepage remains fixture B: 7.0 MW requested and 5.8 MW modeled, additional
to the 20 MW reference, for one hour. Demo scenarios A–D retain their existing
records. A representative rack is a visual inspection anchor; the facility-wide
request is never assigned to that rack.

“Follow one workload” opens a still first chapter. Its optional 24-second playback
uses presentation timing: request (4 s), electrical path (4 s), air and cooling
(5 s), conditions (4 s), screening result (4 s), and evidence (3 s). B's recorded
revision comparison changes explanatory HTML only. D stops automatic advancement
at missing cooling evidence and retains unknown modeled capacity. Storage
contribution and duration remain unassessed.

Selection exits playback. Preview is separate. Assessment changes invalidate
story progress. Pause, reduced motion, equipment-off and the Still tier take
precedence; hidden time never advances playback. Static chapters and versioned
evidence links remain available without graphics.

## Runtime contracts

The optional `ecosystem` render profile enables v6 behavior. Frozen releases
without it retain their existing renderer. Topology v2 adds explicit media,
directed passages, branch positions, open-air domains and thermal-coupling
relationships. Thermal coupling cannot connect air and water traversal graphs.
Trace itineraries use normalized intervals on actual rendered routes, including
partial busways ending at the selected tap.

One session controller owns LED, fan, route and thermal presentation state. It
uses the existing manually advanced scheduler, preallocated arrays, deterministic
events and two trace slots. Packed shader uniforms preserve the existing PBR
material response. No geometry or motion writes assessment quantities.

V6 prepares its final material programs before publishing a staged model. The
poster or previous scene remains available during shader preparation; the
existing eight-second deadline and real first-frame probe still determine
readiness. Cancellation and context loss dispose the staged resources, and late
compilation completions cannot replace a newer view. Earlier releases retain
their existing loading path.

`FacilityPresentationCommand.revision` identifies a current command;
`seekRevision` changes only for chapter seeks/replay/context reset. Play/pause
preserves the within-chapter cursor. Checkpoints echo the command revision so
stale graphics callbacks cannot change a newer HTML presentation.

## Reproduction and release

Use Node 22, npm and the existing lockfile. V6 is frozen in the release registry.
Use a new release ID for future construction changes; the example below starts
v7. Run the generator into an unregistered candidate directory, stage the complete
model/poster bundle, inspect the browser preview, capture matching posters, stage
again and freeze only the reviewed bytes. Blender generation, capture and
registration share the existing writer lease.

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 \
  --python assets-source/facility/generate.py -- --out build/facility/facility-v7
npm run facility:stage -- --release facility-v7
FACILITY_PREVIEW=1 FACILITY_ASSET_RELEASE=facility-v7 npm run dev -- --port 3001
FACILITY_BASE_URL=http://127.0.0.1:3001 npm run facility:capture -- --release facility-v7
FACILITY_BASE_URL=http://127.0.0.1:3001 node scripts/facility/capture-ecosystem.mjs --release facility-v7
```

After registration, use the next unused release ID for authoring. Production
verification must use the same selected release/mode for building, serving and
collecting evidence. Keep initial JavaScript ≤180 KiB Brotli and all automatic
downloads through readiness ≤1.5 MiB. Explicit specimen downloads are measured
separately. Model/material, stage-overlap, cadence and retained-resource budgets
remain enforced.

Public deployment is separate from local packaging. The existing simulated
mobile LCP miss, physical-device results and manual accessibility checks remain
release gates until new evidence clears them. Preserve `poster`, `manual`,
`auto-desktop` and `auto-adaptive` rollback modes.
