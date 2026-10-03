# Cinematic facility source

This is a separate synthetic marketing-animation derivative of the editable
facility master. It does not replace browser GLBs or their browser-derived
fallback posters. Source masters and registered releases remain immutable.

`settings.json` declares camera, real render/delivery dimensions, frame rate,
loop duration, periodic fan turns and rendering defaults. `scripts/cinematic/render.py`
loads the original master read-only, enables the authored individual meshes,
replaces cinematic materials, adds manufactured louvers and splice details,
builds actual LED geometry at the existing anchors and rigs all four real fan
rotors. Changes are confined to a separately saved cinematic scene. Original
equipment identities and topology remain attached to the objects.

All production outputs and exact source/hash evidence remain beneath
`build/cinematic/`. `scripts/cinematic/run.py` owns one bounded Blender child,
retains failure logs, and serializes GPU jobs using a private lock. CPU fallback
must be explicit. No global Blender settings are saved.

Example, using an available Python interpreter and a fresh attempt name:

```sh
python3 scripts/cinematic/run.py --output build/cinematic/cinematic-v1 --name proof01 --timeout 1800 -- --mode proof
python3 scripts/cinematic/run.py --output build/cinematic/cinematic-v1 --name production01 --timeout 3600 -- --mode production
python3 scripts/cinematic/encode.py --output build/cinematic/cinematic-v1 --ffmpeg /absolute/path/to/ffmpeg
```

The encoder requires Pillow and a caller-provided FFmpeg with libx264 and zscale.
It verifies every EXR/PNG receipt before encoding. It creates one opaque SDR
MP4 per composition, matching WebP posters, coordinated supporting crops and
the separate `cinematic.v1` manifest. Video duration includes exactly one loop
without a duplicated endpoint. It contains no audio, text, metrics or controls.

Source-space light response and materials differ deliberately from the browser
renderer. The cinematic movie and its own poster must match visually within
measured codec error; Cycles and Three.js have separate rendering pipelines.
Native playback and decoded frame comparisons must verify the delivered color,
motion and loop boundary.

The render source preserves the failed art experiments separately. Technical
integrity does not imply independent human craft acceptance, physical-phone
qualification or public-release approval.
