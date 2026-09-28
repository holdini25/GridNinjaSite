# Private facility capture

This harness mounts the actual `FacilityCanvas`, production asset loader,
materials, lighting, mechanism controller, and manual frame owner. It creates no
Next.js route and registers no asset release. The optional capture port is only
injected by `offline-facility-entry.tsx`; public diagnostics remain capped at
DPR1/1.5. Existing lockfile tooling supplies esbuild; no install is required.

## Reproduce

Use the repository's pinned Node22.23.2/npm10.9.8 environment. Acquire the shared
GPU lease before any non-validation run. Stop competing Blender/Simulator/browser
measurements. The capture requires actual AppleM5 Metal; it rejects software
rendering. The output directory must be fresh and beneath `build/qa`.

```sh
export PATH="$PWD/build/tools/node-v22.23.2-darwin-arm64/bin:$PATH"
node scripts/qa/offline-facility-capture.mjs \
  --manifest build/facility/facility-v11/release/manifest.json \
  --manifest-hash 6f5e4a71f56de668697a3b66b13647fe3249ee5f1638b7b984461ad6602cc419 \
  --scope release --validate-only
```

The hash above identifies the preserved qualification10 input. For a new candidate,
pass its exact manifest path and independently recorded SHA256.

Replace `--validate-only` with `--output build/qa/<fresh-name>` to render. Scopes:

- `sampling`: desktop overview and both mobile source sizes.
- `release`: desktop neutral/four selections, all six assembly poses, both mobile
  sources (13 captures with rack+cooling). Encodes both mobile alternatives.
- `contact`: overview, air-path, rack closed/service/service-cutaway/connection
  detail, and cooling closed, at desktop and mobile sizes. DiagnosticPNGs only;
  follows the existing settled-joint guards before entering connection detail.

`--profiles desktop-poster,mobile-native` narrows an experiment. The production
poster profiles remain1360×800 at actualDPR1 and340×255 at actualDPR2/3. Mobile
outputs are encoded at680×510. The contact scope's mobile composition is a coupon
view; it does not replace the actual page's taller service-stage layout review.

The existing wrapper also supports:

```sh
node scripts/facility/capture-posters.mjs --release facility-v11 \
  --offline-output build/qa/<fresh-release-capture>
```

It retains the authoring writer lease and writes the new outputs privately.
The legacy page-screenshot path now rejects upscaled mobile source buffers.

## Capture contract

One pending request, source-pixel ceiling4,000,000, maximumdimension4096, and an
eight-second request deadline. The renderer's existing size owner must settle;
the completed frame then independently measures both parent and canvas CSSbounds,
drawing-buffer dimensions, model identity, camera, pose, and sampler configuration.
PNG bytes are read in that same post-render callback. DPR, quality, and sampling
must return to their exact prior values. Errors, aborts, stale state, loss of
visibility/context, and disposal reject the request and restore its override.

Receiptv2 adds exact prior-state restoration and actual DOMbounds proof. Earlier
v1 captures remain preserved comparison evidence and cannot be adopted by the
new selection tool. Neither receipt version asserts human craft approval,
production-page performance, or physical-phone behavior.

The loopback server only serves an allowlisted resource map, with verified GLB
bytes. Its private CSP permits blob connections because GLTFLoader fetches
validated embedded textures through ImageBitmap; the application CSP is unchanged.
The report binds every bundle dependency, source manifest/GLB, bundle, and PNG,
and checks that input bytes remain unchanged. Do not edit those dependencies
during a comparison.

## Select reviewed posters without altering a release

After a final release-scope run and explicit review of the two mobile sources:

```sh
node scripts/qa/offline-adopt-posters.mjs \
  --report build/qa/<final-capture>/report.json \
  --report-hash <recorded-report-sha256> \
  --mobile-source supersampled \
  --output build/qa/<fresh-adoption>
```

This CPU-only step validates source/PNG/WebP hashes, receiptv2, selection
visibility, dimensions, and unchanged budgets. It emits canonical poster names,
reviewPNGs, and `capture-profile.json` into a fresh private directory. It does not
copy to a release, freeze assets, modify the registry, or deploy. Final packaging
and page-level poster/live verification remain integration responsibilities.

Framebuffer/MSAA estimates are reported separately from asset allocation. With
RGBA8 and assumed aligned32-bit depth/stencil, the1360×800 four-sample framebuffer
plus resolved color estimates39,168,000bytes (37.35MiB). This is not measured GPU
memory; depth/stencil bit counters are unavailable in existing receipts. Driver,
compositor, CPU encoding/readback, and asset storage are excluded. The32MiB
asset/staging ceiling must not be applied to this offline framebuffer estimate.

## Focused checks

```sh
node node_modules/vitest/vitest.mjs run \
  tests/unit/facility/offline-capture.test.ts \
  tests/unit/facility/offline-harness.test.ts \
  tests/unit/facility/engineering-resize.test.tsx \
  tests/unit/facility/camera-ownership.test.ts \
  tests/unit/facility/engineering-runtime.test.ts --maxWorkers=2
node node_modules/typescript/bin/tsc --noEmit --incremental false
```
