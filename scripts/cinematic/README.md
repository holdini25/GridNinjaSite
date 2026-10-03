# Private cinematic facility pipeline

This pipeline derives actual Cycles animation from the existing editable master.
It preserves the master, equipment IDs and system topology, and does not publish
assets or modify the browser release registry. Every render is synthetic. Fan
speeds and LED activity are visual parameters, not equipment ratings or telemetry.

## Inputs and boundaries

- Authoritative source: `assets-source/facility/facility-master.blend`.
  SHA-256 `47b60bb7112df7be958779aaf61cd44c135917b6f665590fe61cc38fcbc02a87`.
- Camera, periodic motion, resolution and sampling: `assets-source/facility/cinematic/settings.json`.
- Scene derivative: `render.py`; supervisor: `run.py`; media delivery: `encode.py`.
- Outputs must live beneath this checkout's `build/cinematic/`.
- The original AUTHORING collection supplies construction. CINEMATIC_DETAIL and
  CINEMATIC_RIG add physical louvers, splice plates, LED emitters, lights and camera.
  EXPORT is hidden; existing baked browser lighting is not used as Cycles albedo.
- Original equipment and moving-part identities are preserved. No measured
  capacity, economic outcome, site action, product control or connection is inferred.

## Current production settings

Ten seconds at 30 fps, exactly 300 frames indexed 0–299. Frame 300 is retained only
in the proof as a periodicity diagnostic; it never enters the delivered loop.
Camera 42° azimuth/28° elevation; orthographic framing; no camera motion. Desktop
render 1600×1000 → delivery 1280×800; phone render 960×720 → delivery 768×576.
Four existing five-blade rotors make 17/19/21/23 complete turns per loop, with
continuous analytical phase. Blade-passage fundamentals 8.5–11.5Hz are below the
15 Hz Nyquist rate; this does not remove all edge-harmonic aliasing, so actual
playback review remains required. Shutter 0.5 frame (1/60 second). 48 authored LED
anchors support sparse, independently phased amber activity and steady indicators.

Cycles 128 samples maximum, adaptive threshold .005, static sampling seed 192809,
OIDN with albedo/normal guides, eight maximum light bounces, persistent data.
AgX Medium High Contrast; exposure 0. Scene-linear, denoised half-float RGB ZIP EXR
masters plus display-referred 8-bit PNG are retained per frame. These EXRs are not
undenoised multi-pass research archives. Source code and settings are hashed into
each frame identity. The exact 256-sample reference source/settings are retained
in candidate provenance along with the separate reference renders.

## Reproduce and resume

Use the pinned Blender 5.2.2 LTS build `d13f752e3b9c`, an available Python 3, Pillow,
and caller-provided FFmpeg with libx264 and zscale. No global preferences or
packages are changed by these scripts. The implementation checkout used the
bundled Codex Python and task-local FFmpeg 7.1; their exact encoder identity and
command line are recorded by the encoder. Replace paths below for another host.

```sh
python3 scripts/cinematic/run.py --output build/cinematic/cinematic-v1 --name proof01 --timeout 1800 -- --mode proof
python3 scripts/cinematic/check_motion.py --output build/cinematic/cinematic-v1
python3 scripts/cinematic/encode.py --output build/cinematic/cinematic-v1 --ffmpeg /absolute/path/to/ffmpeg --mode proof
python3 scripts/cinematic/run.py --output build/cinematic/cinematic-v1 --name production01 --timeout 3600 -- --mode production
python3 scripts/cinematic/encode.py --output build/cinematic/cinematic-v1 --ffmpeg /absolute/path/to/ffmpeg --mode production --crf 18
CINEMATIC_PREVIEW=1 CINEMATIC_ASSET_RELEASE=cinematic-v1 npm run cinematic:validate
```

Every invocation needs a fresh attempt name; prior logs and process receipts are
preserved. Resume production by repeating the production command with a new name.
Matching per-frame receipts and file hashes are reused. A changed source/settings
identity or incomplete receipt fails closed: choose a new output directory to
retain the previous attempt. `--start N --end M` selects a bounded interval;
`--composition desktop` or `mobile` selects one composition. `--device cpu` is
explicit fallback; Metal is the default and its actual configured device is
recorded. A process-group timeout terminates only the owned Blender child.

One private `build/cinematic/render.lock` serializes GPU jobs. After an external
hard kill, inspect the PID and ensure the process is dead before removing a stale
lock. Do not run Blender baking or browser GPU benchmarks concurrently. Verified
proof frames can be copied to production only when their complete render identity
matches; preserve their receipts and record that reuse. The renderer verifies the
hashes again rather than trusting the copy.

## Delivery contract

`release/manifest.json` uses the separate strict `cinematic.v1` schema:
`environment: synthetic`, stable shared-master identity and source/settings hashes;
desktop/mobile render and delivery dimensions, full-frame composition, fixed
orthographic camera pose/span, duration, fps and frame count. It declares the
actual codec/profile/pixel format and SDR color metadata. Every file has bytes,
SHA-256 and MIME type; each poster receipt binds its retained decoded first-frame
PNG hash and the exact encoded video hash.

- `desktop.mp4`, `mobile.mp4`: H.264 High, yuv420p, faststart, no audio.
- `poster-desktop.webp`, `poster-mobile.webp`: poster from the actual compressed
  video's first frame, converted to sRGB, then WebP. Codec error is measured;
  native browser color management still requires visual review.
- `still-construction.webp`, `still-cooling.webp`: aspect-correct 720×480 crops
  from the same final graded source frame; no baked labels or invented figures.
- Exact render settings, camera projections, device evidence, logs, frame receipts
  and encoder commands remain outside the served release.

The RGB PNG→video path preserves the sRGB transfer function and converts into
limited-range YUV using BT.709 primaries and matrix. H.264/MP4 metadata declares
primaries 1, transfer 13 (IEC 61966-2-1), matrix 1 and limited range. The poster
decode restores full-range sRGB RGB from the actual compressed frame. An earlier
BT.709-transfer experiment is retained but superseded: native IAB playback showed
lifted black and washed midtones despite its explicitly decoded poster matching.
The sRGB-transfer proof corrected that visible defect in native playback; native
cross-engine and physical-phone checks remain separate gates. The strict validator reads
actual MP4 headers: one silent H.264 track, faststart, duration/count/dimensions,
and poster dimensions must agree. The page's entire automatic transfer budget
must include selected video, poster, scripts, fonts and stills—not only the movie.
No physical-phone or public-release approval is implied by this local pipeline.

The selected CRF18 sRGB-transfer candidate is bound by manifest SHA-256
`b19c53acb14dd4a0318696a18de6b706b97061f1887fcbbf4edca23190dd3a3c`.
Desktop video is 761,013 bytes; phone video is 379,717 bytes. Their WebP posters
are 86,388 and 40,524 bytes. CRF20 comparison movies are retained (607,280 and
307,237 bytes), as are both superseded BT.709-transfer experiments. Exact encoder
versions, commands, source receipts and selection are in `encode-ladder.json`.

## Measured selection and remaining acceptance

Host: Apple M5 Pro 20-core GPU, Metal, MetalRT AUTO, four CPU threads configured;
Blender 5.2.2 LTS. Configuration evidence does not establish exact CPU/GPU work split.
After the first kernel compilation (~123 seconds in initial study), 256/.005 reference
frames took 11.248 s desktop and 4.248 s phone. Warmed 128/.005 benchmark frames took
5.596–5.639 s desktop and 2.512–2.603 s phone. This is per-render time, excluding file
writes and process setup. Foreground mean absolute 8-bit differences 128 vs 256 were
0.683 desktop/0.806 phone; p95 differences 2/3. Normal-size comparison retained the
construction detail, supporting 128 as a provisional engineering selection.

The complete production job retained 300 unique frames per composition and
finished in 2,230.794 seconds (37 minutes 11 seconds), including setup and writes.
It rendered 532 new frames and reused 68 previously verified proof frames whose
source, settings, camera and output hashes matched. Peak process RSS was 7.33 GiB.
This is one host/job measurement, not a portable GPU throughput guarantee.

All 300 final encoded frames per composition were compared with the identically
converted source using a central 90%×80% crop: CRF18 SSIM is .996783 desktop and
.996793 phone, versus CRF20 .995913/.995848. These measure codec fidelity, not
photographic quality. Final decoded/poster corner RGB is (1,1,1), with encoded
corner Y16–17 and neutral U/V128. Native compositor matching remains a separate
check because an explicitly color-managed decoder did not reveal the earlier
BT.709-transfer playback defect.

`check_motion.py` checks measured fan-region change, periodic image closure and
whether 299→0 is an outlier against consecutive frames. It produces real-frame
contact sheets and diagnostics; these are not a substitute for playing the MP4.
Required visual checks remain: apparent fan direction, shimmer/noise, restrained
LEDs, boundary transition and poster→video color. Independent human craft approval,
physical-phone decoding and overall homepage budget/performance are separate gates.

## Bounded diagnostic pass archive

After the production job releases the GPU lock, this optional companion opens the
saved desktop cinema scene in memory and renders at most three frames:

```sh
python3 scripts/cinematic/run.py --output build/cinematic/cinematic-v1 --name diagnostics01 --timeout 600 --script diagnostics.py -- --composition desktop --frames 0,1,2
```

It retains combined and noisy beauty, denoising albedo/normal guides, geometric
normal, diffuse color and a stable object-index map in multilayer EXR, plus raw
and denoised PNG comparisons from the same samples. The source scene and production
receipt identities remain unchanged. Object Index is not antialiased; it is a
selection diagnostic, not a replacement for final compositing edge mattes. See
[Blender's passes documentation](https://docs.blender.org/manual/en/5.2/render/layers/passes.html)
and [denoising guidance](https://docs.blender.org/manual/en/5.2/compositing/types/filter/denoise.html).

The completed `diagnostics/passes04/desktop/` archive contains frames 0, 1 and 2,
seven 32-bit EXR parts per frame and paired display-referred PNGs. Its report
verifies that the saved scene hash did not change. The retained failed attempts
document Blender 5.2 pass-name, output-media-type and frame-filename corrections;
they did not change the production render source or the completed source frames.

The encoder also binds the current master/settings and frozen render source to the
completed render report before checking every frame. A proof rerun was byte-identical;
fault checks rejected a changed settings file and a modified PNG. New encode attempts
retain their command logs and source snapshot under `encode-attempts/`.

For actual delivery codec and temporal measurements (requires NumPy as well as
Pillow), run after encoding:

```sh
python3 scripts/cinematic/inspect_delivery.py --output build/cinematic/cinematic-v1 --ffmpeg /absolute/path/to/ffmpeg
```

It binds its report to the selected manifest/video hashes, compares all decoded
frames to the corresponding source SDR conversion, measures poster/frame0 delta,
and records changing bright-pixel area and foreground luminance variation across
all transitions including299→0. Its luminance thresholds are descriptive, not a
flash-frequency standard or safety certification. Native playback and manual
flash-safety review remain required. Encoder, decode and inspection jobs are
CPU-only; keep browser performance measurements separate from those jobs too.
