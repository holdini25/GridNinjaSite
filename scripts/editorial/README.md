# Editorial stills

This entrypoint reuses the existing cinematic material/light rig and the unchanged facility master. It isolates different authored equipment for AI racks and colocation rows; the platform subject retains the complete facility. All scenes are synthetic illustrations. They are not a customer installation, telemetry, equipment specification, or evidence of control authority.

Private candidates and EXR/PNG masters stay under `build/cinematic/editorial/`. The renderer never writes the facility master, cinematic-v1, facility-v12, global Blender preferences, or browser media. Three families share lighting but vary camera placement. `settings.json` is hashed into every attempt.

Coordinate the GPU slot first. `run.py` acquires `build/qa/compute.lock` and `build/cinematic/render.lock` with exclusive creation and releases only its own token/inode. Never delete a live or stale lock automatically: inspect its owner/PID and obtain owner confirmation before recovery. Baseline browser runs also require manual coordination until their shared-lock integration is complete.

Each attempt also reserves its report with exclusive creation before entering any cleanup block that can write the report. The log uses exclusive creation as well. Two invocations with the same output/name cannot overwrite one another's report or log, including when the losing invocation cannot obtain the compute lock. The deterministic contention test holds a mocked owner active while the second invocation loses; a negative-control version without atomic reservation reproduces the overwrite.

Relative `--settings` paths are resolved once against the caller directory, then that exact absolute path is both hashed and forwarded to Blender even though its working directory is the repository root. The executable also uses the canonical absolute path recorded in the identity. A regression test puts different same-named settings files in the caller and repository directories and verifies that the stub child consumes the bytes identified by the receipt. No Blender process is needed for this check.

```sh
python3 scripts/editorial/run.py --output build/cinematic/editorial/studies-next --name studies --timeout 1800 -- --mode studies
node scripts/editorial/contact-sheet.mjs build/cinematic/editorial/studies-next
python3 scripts/editorial/run.py --output build/cinematic/editorial/final-next --name final --timeout 1800 -- --mode final --family C-frontal
python3 scripts/editorial/run.py --output build/cinematic/editorial/reference-next --name reference --timeout 1800 -- --mode reference --family C-frontal
node scripts/editorial/package.mjs build/cinematic/editorial/final-next build/cinematic/editorial/reference-next C-frontal build/cinematic/editorial/release-next
```

Final settings are 128 samples, adaptive threshold .005, four CPU threads, Metal, OIDN, no motion blur, 1600×1000 masters. The matching 256-sample reference checks dark panel detail and denoiser artifacts. Inspect actual-size card derivatives and low-brightness previews in addition to numeric pixel differences.

## Reviewed ray tracing configuration

The actual selected family is **C-frontal**. Successful final/reference attempts are `final-01` and `reference-02`. Use fresh attempt names for future work; registered releases are immutable.

| Control | Reviewed setting / reason |
|---|---|
| Device | Blender 5.2.2 LTS `d13f752e3b9c`; M5 Pro 20-core GPU; Cycles GPU, Metal, MetalRT AUTO, four CPU threads |
| Samples | 128 maximum vs matching 256 reference, adaptive .005, fixed seed 192809; compare delivered appearance before raising work |
| Light paths | Total 8 / diffuse 3 / glossy 4 / transmission 4 / transparent 8, inherited from the established rig |
| Denoising | OIDN with RGB/albedo/normal guidance, GPU enabled; inspect thin edges and grille details for smear |
| Materials/light | Shared Principled materials with modeled bevels/louvers, modest roughness grain, broad warm key and cool fill/rim; clarity comes from physical highlights and occlusion |
| Output | AgX Medium High Contrast, exposure 0, gamma 1, half-float EXR masters, opaque sRGB WebP derivatives; no motion blur |

1. Coordinate the exclusive compute slot; inspect `compute.lock` ownership without deleting it.
2. Render a fresh study when composition/material/light changes; inspect the whole three-subject family.
3. Render serial 128/256 pairs with otherwise identical settings. Preserve both receipts and EXR/PNG masters.
4. Package and run `quality-sheet.mjs RELEASE FINAL REFERENCE`; inspect 320×200 and 160×100, grayscale and simulated 50% pixel brightness. These simulations do not replace physical display review.
5. Register only the reviewed exact bundle, run `npm run editorial:validate`, focused tests and integrated build trace checks. Browser review still verifies image selection and card hierarchy.

The final/reference process times were 18.944/25.249 seconds for three stills; these are single local observations, not a measured MetalRT or hardware speedup. MetalRT AUTO/device receipts do not prove hardware-unit utilization. No unsupported path-guiding experiment, arbitrary bounce/clamp increase, or browser ray-tracing runtime is added. The site downloads only static derivatives, with no extra webpage GPU requirement. Verified primary references and limitations are recorded in [the production record](../../docs/website-upgrade/premium-civic-implementation/editorial-artwork.md#ray-tracing-engineering).

The supervisor stops only its process group on timeout: TERM has a ten-second grace period, followed by KILL with a five-second reap deadline. If exit remains unconfirmed, the report records that fact and preserves both owned locks for explicit recovery; it does not silently release the compute slot. Shutdown never calls an unbounded child wait.

Combined stdout/stderr is continuously drained into bounded memory, then written to the exclusive log at attempt completion. The saved file is at most 1 MiB. If output exceeds that limit, it retains the beginning and end with a truncation marker. The process report records observed and saved byte counts, the limit, truncation, and whether EOF was reached. Drain completion has a two-second deadline; an incomplete stream is explicitly labeled and its observed byte count is only a lower bound. A successful child with incomplete log capture is not reported as a complete attempt. The reader is a daemon and cannot extend shutdown indefinitely. Because the active file is finalized only at completion, use process state rather than tailing it for live progress.

`--disable-metal-binary-archives` is a process-scoped single retry for a recorded Metal archive failure and requires `--retry-of /absolute/path/to/failed-process.json`. The immediately preceding attempt must have failed with a matching archive-error diagnostic in its retained log; its report and log hashes must still match the durable ledger. A diagnostic discarded from the middle of a truncated log cannot authorize the retry. The fallback is reserved before launch and remains consumed after an interruption. Canonical arguments plus source/settings hashes identify the job, so a new output directory, new attempt label, renamed identical settings file, or explicit default sample count cannot reset the allowance. The child environment clears an inherited archive-disable switch on normal attempts. Do not delete `build/qa/editorial-retry-ledger.json` to restore a budget; preserve it for explicit owner-led recovery. Tests simulate failed and interrupted processes without launching Blender.

An explicit CPU fallback requires a new attempt and updated delivery provenance; no silent device substitution. The exact pre-hardening supervisor bound by editorial-v1 is preserved in `assets-source/editorial/receipts/supervisor-v1.py`; the registered images and manifest are unchanged.

Packaging produces full-frame 16:10 WebP derivatives at 480×300, 800×500, and 1280×800, each ≤200 KiB. Every release member, master, renderer, setting file, and final/reference report is SHA-256 bound. Registration into `src/content/editorial-releases/` occurs only after visual review; private candidates have no web route.
