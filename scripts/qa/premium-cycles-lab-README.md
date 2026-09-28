# Private Cycles material laboratory

This laboratory renders verified release geometry under independent neutral area lights. It never registers a release, edits canonical Blender masters, or saves user preferences. Browser rendering remains authoritative for shipped appearance and posters.

## Inputs and presets

Use pinned Blender 5.2.2 LTS in a fresh background process. Supply the exact SHA-256 of a private release manifest, its directory, a subject, and a fresh output directory under `build/qa`.

- Subjects: `rack` (Rack 03), `collector` (row 1), `cooler` (unit 1), `overview`, `rack-specimen`, `cooling-specimen`.
- Specimen poses: `closed`, `cutaway`, `service`. Regular rack service opens the door and extends the tray with the side panel retained; cutaway explicitly removes the panel.
- Presets: `preview` = 64 maximum samples / adaptive .02; `reference` = 256 / .005; `benchmark` = fixed 256 samples. Default resolution is 1600 × 1200. Explicit sample/resolution overrides are recorded and must not be cited as the full reference preset.
- Modes: `final,gray,normal,roughness,ao`. Normal diagnostics are world-space perturbed normals. The AO diagnostic displays the baked source channel, not a new runtime AO effect.
- Lighting rigs: `neutral-v1` baseline; `broad-v1` changes the overhead area only; `service-v1` changes the front area only. These are authoring references, not browser environment updates.
- Denoising defaults to none. `--denoise oidn` retains original float32 EXR/PNG and adds a separately timed second beauty render with OpenImageDenoise. Technical channels remain undenoised.

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 2 --python scripts/qa/premium-cycles-lab.py -- --source build/facility/facility-v11/release --manifest-hash VERIFIED_SHA256 --subject rack --preset reference --device metal --metalrt AUTO --threads 4 --output build/qa/PRIVATE_NEW_DIRECTORY
```

`--prepare-only` saves the imported isolated scene and its metadata without rendering. Each completed render checkpoints its timing, image hashes, actual device/settings, process peak RSS, and finite-pixel checks. Interrupted runs retain `incomplete` evidence. A process supervisor must enforce the job deadline and retain its timeout/exit log; do not kill unrelated Blender processes.

Camera equations match the browser's projected fitting. The lab validates Blender's actual camera projection and glTF Y-up conversion against eight source-bound corners. Cooling specimens use their visible contour and full rotor sweep. This is geometry parity only: Cycles lighting, AgX, masks, and the browser's PMREM/ACES/material extension are distinct. Runtime LED instancing and semantic highlight shaders are not reproduced.

## Compute measurements

`benchmark-compute.py` supports `spatial` and `full-atlas`. Full-atlas requires an isolated source directory inside `build/qa` containing the generator, editable master, configuration, and all helper files; it can overwrite that private directory's atlas images. No master is saved.

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 2 --python assets-source/facility/benchmark-compute.py -- --source build/qa/PRIVATE_SOURCE_COPY --mode metal --workload full-atlas --samples 64 --threads 4 --context exclusive --out build/qa/PRIVATE_NEW_REPORT.json
```

Every benchmark uses a separately recorded first invocation followed by three measured repetitions, reloading the exact same master. Cache is disabled, samples/seed/adaptation are fixed, and every job must use the requested enabled devices. Full-atlas timing includes the entire surface bake pipeline and image writing; it excludes geometry generation and GLB export. The first invocation is not a claim that OS/driver caches were cold. Peak RSS is not a measurement of total unified-memory pressure or physical GPU allocation.

Compare CPU, Metal and hybrid under identical constraints. Four CPU threads are the default for a responsive working Mac; reports must say this is a constrained benchmark, not the fastest possible 18-core CPU configuration. Never compare against another job running concurrently. Only use hybrid for a demonstrated benefit without quality or memory regression.

## Checks

```sh
python3 -m unittest discover -s scripts/qa -p test_cycles_lab_contract.py
```

Tests cover hash rejection, embedded resources, semantic triangle boundaries, preserved normal/UV references, picking exclusion, camera fit/resize invariants, and rack service visibility. Actual Blender smoke renders are required to validate node layouts and rendering APIs. Passing automated diagnostics is not visual craft approval.

The full-atlas benchmark also accepts `--spatial-device cpu` with `--mode metal` to measure the production mixed policy. It validates CPU use for the spatial/static-core receivers and Metal for the remaining jobs, recording every override. Do not infer this pipeline duration by summing jobs from different runs.

Every trial preserves actual normal/ORM/color PNGs outside the timed interval. Use `compare-cycles-benchmarks.py` in a nonrendering Blender process to decode the preserved EXRs/atlases, verify their hashes, compare per-channel RMSE/max differences, and report measured medians. It deliberately does not turn those differences into automatic visual approval. The GPU-free tests and actual render smoke are separate evidence.
