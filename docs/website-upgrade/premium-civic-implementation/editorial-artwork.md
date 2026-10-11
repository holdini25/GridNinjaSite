# Editorial artwork production record

The reviewed `C-frontal` family is registered as `editorial-v1`. It contains three distinct subjects using the existing facility geometry, shared PBR materials, and shared studio lighting: two AI racks, twelve colocation racks, and the full facility assembly. The other two card subjects remain code-native: a nonnumeric published-brief facsimile and an authority-gap diagram. No existing cinematic-v1 or facility-v12 bytes were changed.

## Selection and visual evidence

Nine 800×500, 32-sample studies explored three camera families. The lead reviewed the actual contact sheet and selected C: fronts remain clear in the AI subject, the colocation composition reads as a broad row, and the complete assembly separates cooling and power. These are isolated geometry sets, not three crops of one image.

- Candidate contact sheet: `build/cinematic/editorial/studies-01/contact-sheet.jpg`.
- Final/reference/size sheet: `build/cinematic/editorial/final-01/quality-sheet.png`.
- Private EXR/PNG masters: `build/cinematic/editorial/final-01/C-frontal/<subject>/0000.{exr,png}`.
- Matching 256-sample references: `build/cinematic/editorial/reference-02/C-frontal/<subject>/0000.{exr,png}`.
- Registered WebPs: `src/content/editorial-releases/editorial-v1/`.

Actual 320×200 and 160×100 previews were inspected at native pixel size. The three subjects remain distinguishable in grayscale and a 50% pixel-brightness simulation. Edge highlights, repeated modules, and major equipment separation remain legible; tiny inventory and vent marks are intentionally not meaningful content. No obvious denoiser smear or reflection loss was visible at card size. The brightness transform is a repeatable image stress test, not a calibrated physical low-brightness display test. Browser composition and physical display review remain separate gates.

## Ray tracing engineering

The final assets already use offline Cycles path tracing with Metal GPU compute, roughness-controlled physically based materials, formed bevels, and actual modeled louvers. The broad key/fill/rim/strip lights produce restrained highlights and shadow separation from geometry. We retained this coherent rig rather than changing renderer settings without an observed visual problem. The browser receives only static WebP derivatives; this adds no client ray-tracing runtime or 3D workload.

Blender documents Metal GPU rendering and accelerated ray tracing/denoising on Apple Silicon; it also notes that GPU rendering can contend with interactive display work and that path guiding is unavailable on the GPU. That supports serial rendering with a shared compute lock rather than promising every advanced Cycles technique on Metal. [Blender GPU rendering](https://docs.blender.org/manual/sr/5.1/render/cycles/gpu_rendering.html)

Apple identifies hardware ray tracing for the M5 Pro 18-core CPU/20-core GPU configuration. Our receipts confirm that Blender enabled `Apple M5 Pro (GPU - 20 cores)`, `METAL`, `GPU`, `MetalRT=AUTO`, and four CPU threads. This is configuration evidence; we did not instrument hardware ray-intersection utilization or compare MetalRT ON/OFF. Apple's general capability claims are not a measured speedup for these scenes. [Apple M5 Pro specifications](https://support.apple.com/en-ie/126319)

The actual inherited rig specifies eight total bounces, three diffuse, four glossy, four transmission, and eight transparent bounces. It uses 128 maximum samples, adaptive threshold .005, fixed seed 192809, OpenImageDenoise with albedo/normal guidance and GPU denoising enabled, and no motion blur for stills. The higher reference uses 256 maximum samples with otherwise matching scene/source/settings. Adaptive sampling can finish individual pixels earlier; these are ceilings, not assertions that every pixel received 128 or 256 paths. [Blender sampling](https://docs.blender.org/manual/en/5.3/render/cycles/render_settings/sampling.html)

No untested clamp, glossy-filter, caustic, or bounce changes were added. Blender explains that limiting/clamping paths or filtering glossy light can exchange accuracy for lower noise; increasing settings arbitrarily does not establish a better image. Here, the useful engineering choice is an explicit bounded scene, preserved EXRs, a higher-sample reference, and visual checks on the actual delivered size. [Blender light paths](https://docs.blender.org/manual/sr/latest/render/cycles/render_settings/light_paths.html)

Blender executable: 5.2.2 LTS, build `d13f752e3b9c`; host receipt: macOS 27 ARM64. Final process wall time was 18.944 seconds; matching reference process wall time was 25.249 seconds. These are single local render observations, not a generalized hardware benchmark. GPU rendering was serialized and browser performance capture had finished; broader host activity was not instrumented.

| Subject | 128 render seconds | 256 render seconds | Mean absolute difference, 8-bit RGB | RMS difference, 8-bit RGB |
|---|---:|---:|---:|---:|
| AI racks | 5.453 | 6.507 | 0.1104 | 0.5270 |
| Colocation row | 6.567 | 9.149 | 0.3451 | 1.0174 |
| Full facility | 5.008 | 7.648 | 0.4151 | 1.4263 |

The comparison uses full 1600×1000 display-referred PNGs, including their black background; low aggregate error alone cannot certify panel detail. Both renders use the same seed and denoiser, so the 256 reference is not an independent ground truth. Actual-size visual review supplies the complementary evidence. Isolated maximum channel differences of 45/54/72 are recorded in the comparison receipt rather than concealed by the mean.

## Delivery and provenance

Half-float RGB ZIP EXR and 8-bit RGB PNG masters use AgX Medium High Contrast, exposure 0, gamma 1. Full-frame derivatives use sRGB WebP, quality 90, Lanczos3 reduction, and no transparency. Node 22.23.2, Sharp and libwebp versions are recorded in the manifest.

| Subject | 480×300 bytes | 800×500 bytes | 1280×800 bytes |
|---|---:|---:|---:|
| AI racks | 6,504 | 13,864 | 23,992 |
| Colocation row | 18,278 | 37,468 | 66,008 |
| Full facility | 18,672 | 40,674 | 77,520 |

Every derivative is below 204,800 bytes. Total derivative storage is 302,980 bytes. Default HTML source dimensions are accurately 800×500, with 480/800/1280 responsive variants. Final release manifest SHA-256: `f4098e8536db3361517ffa196aab7e6a694b989152dc7b0e16559d377490abc5`.

The manifest binds the original master, settings, original cinematic renderer, editorial renderer, supervisor, compute selector, packager, final/reference receipts, and master/reference images. Review receipts are retained under `assets-source/editorial/receipts/`; private source assets and candidates are excluded from Next deployment traces. The original shared master remains `47b60bb7112df7be958779aaf61cd44c135917b6f665590fe61cc38fcbc02a87`.

Independent review identified two future packaging enforcement gaps: explicit reference runtime-settings equality and actual PNG dimension/channel checks. Both were hardened and covered by regression tests. The existing final/reference masters were separately checked against those stricter conditions and passed. The exact earlier packager source bound by this immutable release is retained as `assets-source/editorial/receipts/packager-v1.mjs`; registered bytes and manifest were not rewritten after the tooling improvement.

Serving is registry-only. Unknown/withheld releases return 404, withdrawn releases return 410, and a corrupt bundle returns generic 503 with no-store before conditional/range handling. The full exact file set and every hash are checked before GET, HEAD, or 304. Public-directory bypasses, source tracing, and unregistered release tracing are build validation failures. Eleven focused tests cover malformed manifests, dimensions, file integrity, symlinks, responsive metadata, GET/HEAD/ETag, withdrawal, error boundaries, and packaging runtime/input checks.

The supervisor acquired a shared compute lock and the existing cinematic lock, used a bounded owned process group, and changed no global preferences. A premature reference invocation was blocked by the live compute lock and preserved as `reference-01`; the successful reference is `reference-02`. A packaging attempt while the reference was incomplete failed before writing output. Neither failed guard check bypassed its safety condition. No Metal archive fallback or CPU fallback was needed.

The audit then requested mechanical enforcement of the documented one-retry archive fallback. The updated supervisor stores a durable job ledger independent of attempt names/output paths, requires the immediately preceding failed attempt and matching report/log hashes plus an archive failure diagnostic, reserves the single retry before launch, and clears inherited fallback environment switches on normal runs. Twelve isolated Python checks, invoked by the focused unit suite, cover unlinked retries, renamed attempts, corrupted/non-archive failures, nonpreceding failures, settings aliases, interruption, lock preservation/release under ledger failure, same-output/name contention, caller-relative settings identity, bounded log retention/drain, and finite post-KILL wait. No Blender process is launched by those tests. The hash-matching original supervisor remains in `assets-source/editorial/receipts/supervisor-v1.py`; these post-production safeguards do not rewrite immutable asset provenance.

An independent auditor identified a report-overwrite race between the non-atomic initial existence check and lock acquisition. The fix reserves the report with exclusive creation before any `finally` writer becomes reachable and uses exclusive log creation. The deterministic test makes both callers pass the initial precheck, holds the owner active in a harmless mocked child, and confirms that the loser cannot alter the owner's report, log, or lock. The owner's final report/log hashes remain identical to its ledger entry. Removing the reservation in an isolated negative control makes this same test fail as expected. Detailed source-hash-bound evidence: `build/qa/editorial-supervisor-race-evidence.json`; test: `tests/unit/editorial/supervisor_checks.py::test_same_output_and_name_contender_cannot_overwrite_running_owner`.

A second audit finding concerned relative settings paths: hashing formerly used the caller directory while the renderer changed to the repository directory. The supervisor now resolves the settings path once and uses the same absolute path for hashing and the child command. It also forwards the canonical executable path recorded in the identity. The regression creates different `custom.json` files in both directories, invokes from the caller directory, and verifies the stub child's consumed bytes against the report hash. Removing normalization reproduces the mismatch. Evidence: `build/qa/editorial-supervisor-settings-path-evidence.json`; test: `tests/unit/editorial/supervisor_checks.py::test_relative_caller_settings_match_hashed_and_child_consumed_bytes`. The race negative control was rerun against this updated supervisor as well.

The final bounded-failure safeguard caps each newly captured combined log at 1 MiB, retaining its head and tail with a truncation marker. The report binds the retained log hash and records observed/saved byte counts, truncation, EOF status, and whether the observed count is only a lower bound. The drain has a two-second deadline. Timeout shutdown waits at most ten seconds after TERM and five seconds after KILL; if child exit is still unconfirmed, the report says so and preserves its owned compute/render locks for owner-led recovery. Harmless stubs verify truncation, a held pipe, both confirmed and unconfirmed post-KILL exits, and unchanged prior failure evidence. Negative controls remove the cap and the post-KILL deadline separately and make the corresponding checks fail. Current-source evidence: `build/qa/editorial-supervisor-bounds-evidence.json`. Existing asset receipts and their original supervisor remain unchanged.

## Remaining integration gates

Focused tests, targeted lint, project typecheck, and source editorial validation pass. The combined site build must still run the new postbuild trace validator, and browser review must verify loading, aspect ratio, selected responsive file, and visible card labels. Figma upload/placement is owned by the lead. These synthetic visuals are not evidence of customer outcomes, control authority, tenant hardware specifications, or measured capacity.
