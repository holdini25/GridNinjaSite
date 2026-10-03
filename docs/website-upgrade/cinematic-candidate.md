# Cinematic homepage and facility candidate

**Historical private-candidate record.** The subsequent owner-authorized
production integration is tracked in [the release record](cinematic-production-release.md).
The source and results below refer to the earlier private snapshots.

**Current preview update:** the requested blinking-light and button-glow refinement
is now served as candidate13. See [the focused follow-up](cinematic-light-refinement.md).
The full qualification results below remain the historical candidate11 results;
they are not silently carried forward to the changed preview.

Private implementation candidate for the approved homepage/facility specification.
This document is an engineering handoff, not independent craft approval or a
public-release authorization. Local source, browser and performance checks pass;
the independent mechanical evidence audit also passes. Production and the
original checkout remain unchanged. Preview: <http://127.0.0.1:3005/>.

## What changed

- The homepage now leads with the bounded paid assessment and a server-rendered
  facility figure. Native video replaces the embedded Three.js inspector on home.
- The approved offer, headline, CTA labels and trust line are preserved. Fixture B
  remains selector-backed: **7.0 MW requested / 5.8 MW modeled eligible increment**,
  additional to the **20.0 MW** reference for **2026-09-22 00:00–01:00 UTC**.
  Publication **demo-01-b / v1.0.0**, synthetic status, unestimated economics,
  accepted/delivered not applicable, and no operational authority remain visible.
- Light editorial sections explain Model / Check / Inspect, the unresolved
  commercial decision, buyer fit, available evidence and assessment scope.
  Platform direction is explicitly in development. The evidence card renders a
  real selector-backed brief excerpt rather than inventing research publication.
- Shared navigation retains destinations and attribution. Below 480px the full
  CTA appears in the drawer and hero. Header CTA is outlined; hero/final are amber.
- The cinematic master adds physical rack louvers, collector seams, differentiated
  graphite/metal/copper finishes, lighting, four rotating fans and restrained LEDs.
  The original editable master, topology, equipment identity and pivots are retained.
- The demo's guided return now measures the actual sticky header and visual
  viewport. It keeps the rack handle and focused action visible when both fit,
  prioritizing the focused control at short or highly zoomed viewport sizes.
- Private facility v12 carries the coordinated graphite/steel/copper materials
  and filtered louver detail into the demo. Geometry, identity, articulated
  pivots, interlocks, 180 mm travel, render ownership, picking, cancellation and
  disposal are preserved.

## Exact candidate

| Identity | Value |
|---|---|
| Frozen candidate | `/private/tmp/gridninja-cinematic-facility-qualification11` |
| Build | `1vR8m9uSwulUv51m_HpV6` |
| Source inventory | `0264adbb25165c67d509ce3abb6852ad4edd4335db67d36c171882a156812d92` |
| Derived inventory | `b66c404db8f89b08b5b841a296233188a23c934e5a5ef762294d635f10e40255` |
| Application source | `b40d982fa30efee95807a3451a3063dcbc54c213f9dd9711b0b77b88059ce667` |
| Cinematic manifest | `b19c53acb14dd4a0318696a18de6b706b97061f1887fcbbf4edca23190dd3a3c` |
| Facility v12 manifest | `95e5b6394da9183cdc57d00992407ffec4fd6d55d1674ffd9bb8d13b6955658f` |

Implementation and retained art are in
`/Users/holdenchung/.codex/worktrees/cinematic-facility/GridNinjaSite`.
This final handoff is a reporting-only update after freezing the build; the
candidate itself is not edited to replace its earlier documentation.

## Source preservation

The implementation is isolated in the attached `cinematic-facility` worktree.
The original checkout was dirty before work began; its changes were included in
the explicit snapshot, not reset or discarded. The inventory is
`build/qa/cinematic/baseline/source-inventory.json`, with original status alongside.

Original editable facility master SHA-256:
`47b60bb7112df7be958779aaf61cd44c135917b6f665590fe61cc38fcbc02a87`.

Final verification found all **1,240 original files and one pre-existing
deletion unchanged**, plus **107 protected publication, registered-facility and
editable-master files** unchanged in the worktree. See
`build/qa/cinematic/baseline-integrity-final11.json`.

The existing `/private/tmp/gridninja-premium-v11-qualification11` was not written
to. It is a different directory from the new cinematic qualification11 above;
no new byte-level baseline for that older qualification directory is invented.
No source/candidate media is added beneath `public/`. Any derived
registry used by an isolated qualification snapshot is private test configuration,
not a change to the worktree registry or an approval of that asset for publication.
The public facility registry/default remains v10. Task-only changes against the
preserved dirty snapshot are in `build/qa/cinematic/implementation.diff` and
`implementation-delta.json`; this excludes pre-existing user work from the patch.

## Implementation map

| Concern | Main files |
|---|---|
| Homepage | `src/app/(marketing)/page.tsx`, `src/content/copy/cinematic-home.ts` |
| Composition and scoped styles | `src/components/marketing/facility-hero.tsx`, `cinematic-home.css`, `facility-hero-annotations.tsx` |
| Native playback | `src/components/marketing/facility-hero-video.tsx`, `src/lib/cinematic/playback.ts` |
| Asset validation and serving | `src/lib/cinematic/`, `src/app/assets/cinematic/[release]/[file]/route.ts` |
| Art pipeline | `assets-source/facility/cinematic/`, `scripts/cinematic/README.md`, `render.py`, `run.py`, `encode.py` |
| Demo focus restoration | `src/lib/facility/service-return-scroll.ts`, `src/components/facility/facility-inspection.tsx` |
| Qualification collectors | `scripts/cinematic/measure-page.mjs`, `scripts/facility/measure-page.mjs`, `summarize-performance.mjs` |
| Native browser regression | `tests/e2e/cinematic-home.spec.ts`, `tests/e2e/facility-guided-craft.spec.ts` |

The shared Button has a deliberate client boundary around its polymorphic Slot.
The footer uses the existing brand asset through a static entry, and native
supporting images avoid unused image-client code. All navigation remains native
Next.js Link behavior. Final initial JavaScript is **117.3 KiB home, 136.5 KiB
assessment, 129.4 KiB demo and 134.9 KiB contact**, Brotli including the shared
framework, beneath the unchanged 180 KiB ceiling. No dependencies were added.

## Media and playback contract

`cinematic.v1` is separate from the GLB/poster facility contract. Its manifest binds
the source/settings/model identity, both compositions, video dimensions, duration,
frame count, color/codec data, first-frame poster correspondence and every file hash.
The asset handler allowlists filenames and supports HEAD, ETags, conditional reads
and single byte ranges. Withdrawal and corrupt/missing media fail explicitly.

The homepage HTML includes the poster, all meaning and no movie source. Acquisition
requires a decoded poster, a visible document, at least 25% scene visibility, and
permitted motion/data preferences. One phone/desktop rendition is fixed for the
visit. An actual presented frame reveals video. Play/Pause is explicit; refusal
shows Play; failure or a 15-second eligible startup timeout shows Retry. An explicit
Pause survives visibility changes. Reduced motion/data saving prevent automatic
acquisition; no JavaScript retains the finished static composition.

Poster and movie composition remain matched after orientation and recovery.
Native WebKit poster Retry reloads the same canonical responsive source in the
correct order, without cache-busting URLs, a replacement image node or an
alternate rendition. The startup deadline counts only eligible time.

No homepage GLB, canvas, frame-copying compositor, new analytics vendor, external
media service, WebGPU dependency, browser path tracer or physics engine is added.

## Render choices and mathematical checks

- Fixed 42° azimuth/28° elevation orthographic camera, selected provisionally from
  three compositions. Camera-projected SVG anchors share the image's contain fit.
- Ten seconds at 30 fps, frames 0–299. Desktop 1600×1000 → 1280×800; phone 960×720 → 768×576.
- Rotors make 17/19/21/23 integer revolutions per loop with analytical continuous
  phase, evaluated beyond both ends for shutter sampling. Five-blade passage
  fundamentals 8.5–11.5 Hz remain below the 15 Hz temporal Nyquist frequency; actual
  encoding/playback still requires review for higher-frequency edge artifacts. These
  illustrative speeds are not equipment telemetry or a stated fan design RPM.
- Cycles 128 maximum samples/.005 adaptive threshold was chosen after comparison
  with retained 256-sample reference frames. Normal-size mean foreground 8-bit
  differences were 0.683 desktop and 0.806 phone. These diagnostics support the
  engineering selection, not a human craft score.
- Metal/MetalRT AUTO, pinned Blender 5.2.2 LTS, static sampling seed, controlled
  lighting and motion blur. GPU jobs are serialized and resumable with per-frame
  receipts. Configuration is not evidence of exact CPU/GPU work distribution.
- Geometry/topology and illustrative motion remain separate from assessment
  evidence. No CFD, new capacity model, economic inference or operational authority
  is introduced by these visuals.

## Media and reproduction

| Asset | Bytes |
|---|---:|
| Desktop movie, 1280×800 | 761,013 |
| Desktop poster | 86,388 |
| Phone movie, 768×576 | 379,717 |
| Phone poster | 40,524 |
| Construction / cooling stills | 43,694 / 38,998 |

These are file sizes, not complete route transfers. Both silent ten-second
movies use fast-start SDR H.264 High/yuv420p. Verified metadata uses BT.709
primaries/matrix, sRGB transfer and limited range. Posters are derived from
decoded encoded frame zero. All 600 production frames took 37 minutes 10 seconds
on the measured host; this is not an estimate for other hardware.

Keep the active worktree: ignored render evidence and editable sources are part
of the deliverable and are not all in Git. Reproduction instructions are in
`scripts/cinematic/README.md`. Editable desktop/phone masters, all frames and
receipts, undenoised/diagnostic comparisons, encoding choices and the strict
release manifest are retained under `build/cinematic/cinematic-v1/`. Browser
derivative sources and release assets are described in
`assets-source/facility/V12-CANDIDATE.md` and retained under
`build/facility/facility-v12/`.

With Node 22 and the existing npm lockfile, restart the built preview from the
worktree using:

```sh
node scripts/qa/run-private-candidate.mjs serve /private/tmp/gridninja-cinematic-facility-qualification11 3005
```

Changed source/assets require `scripts/qa/prepare-private-candidate.mjs` with a
new output directory and explicit `--facility facility-v12 --cinematic
cinematic-v1`, then the build/serve wrapper and new qualification. Do not
overwrite this candidate or reuse its results. Private registration is not
public-release authorization.

## Measured delivery

Five fresh Lighthouse runs per route/profile produced these medians. They are
lab results, not field measurements or conversion evidence.

| Route / profile | LCP | FCP | TBT | CLS | Performance |
|---|---:|---:|---:|---:|---:|
| Home / desktop | 606 ms | 286 ms | 0 ms | 0.00014 | 100 |
| Demo / desktop | 616 ms | 284 ms | 0 ms | 0.00138 | 100 |
| Assessment / desktop | 536 ms | 283 ms | 0 ms | 0 | 100 |
| Home / mobile | **2,451 ms** | 1,055 ms | 0 ms | 0 | 98 |
| Demo / mobile | 2,301 ms | 1,054 ms | 0 ms | 0 | 98 |
| Assessment / mobile | 2,312 ms | 1,054 ms | 4 ms | 0 | 98 |

All groups score 100 for automated accessibility and best practices; this does
not replace manual review. Mobile home LCP is **2,451.488 ms**, with observations
from 2,448.5813 to 2,461.7587 ms. It passes the unchanged 2,500 ms threshold by
only **48.512 ms**. The 2,200 ms target is **not met**; there is limited lab
headroom and no claim that field conditions will reproduce these timings.

Twenty native measurements cover five complete homepage loops and five fully
acquired demo runs per profile. All automatic requests, movies, posters,
scripts and ranges through settled acquisition count toward transfer.

| Route / profile | Complete loop or demo acquisition bytes | Ceiling |
|---|---:|---:|
| Home / desktop | 1,105,194 | 4,194,304 |
| Home / phone emulation | 633,189 | 2,097,152 |
| Demo / desktop | 1,031,908 | 1,572,864 |
| Demo / phone emulation | 1,008,993 | 1,572,864 |

Lighthouse has a different request window: home median totals are
1,154,960 / 642,806 bytes and demo totals 1,041,525 / 264,544 bytes,
desktop/mobile respectively. The smaller mobile-demo Lighthouse total does not
substitute for complete 3D acquisition. Assessment's existing lightweight checks
measure 236,493 bytes in both profiles, below 1.5 MiB. Raw methods remain separate.
The scrolled static homepage shell is 385,441 desktop / 339,577 phone bytes across
15 requests, without movie or GLB.

## Evidence and remaining gates

Final source checks: **1,065 unit tests across 116 files**, lint, typecheck, brand
validation and production build pass. Assessment/publication, SEO, facility,
cinematic and deployment-trace validators pass. The initial 190.4 KiB assessment
JS failure was corrected; the 180 KiB ceiling was not changed.

The exact candidate passes **144 browser test executions**: 131 main executions
and 13 recovery/real-visibility executions. Twelve additional profile-inapplicable
cases are skipped; this is not 144 distinct scenarios. Chrome 154.0.8037.58 and
WebKit 26.5 cover desktop and emulated phone behavior. Actual poster HTTP failure
and Retry, autoplay refusal, startup timeout, hidden-tab pause, reduced motion,
orientation, no-JavaScript navigation, range serving and guided inspection are
covered. Injected Save-Data/autoplay conditions are application tests, not OS
policy or physical-device qualification.

The final author layout review includes 45 fresh viewport captures at 1366, 819,
390 and 320px, plus eight native poster/presented-frame comparisons. Card image
containment/order, anchors, keyboard focus, real image decoding and exact 0px
remembered-height change pass. The phone-card regression was first proved against
the failing previous build. Review scope and capture identities are in
`build/qa/cinematic/offscreen-final11/`; author review is not independent 3/3
craft acceptance.

Native poster-paint → visible-frame callback timing has a **64.5 ms desktop /
53.7 ms phone-emulation median**, with ranges 61.6–80 / 53.1–127.5 ms, comfortably
inside the desktop one-second target. This uses actual same-origin Element
Timing poster `renderTime`, not the separately reported decode-to-first-callback
medians of 26 / 15 ms. The compositor timestamp is still a browser proxy rather
than physical-display measurement. Unsupported engines retain null paint timing.

Each measured home run covers a complete ten-second media cycle with 300–301
native callbacks. Maximum callback gaps are 50.1–66.7 ms and loop-boundary gaps
33.4–66.7 ms. Browser-reported dropped frames are zero. Each run has one short
fully buffered native loop seek; there are zero unexpected or unclosed waiting
episodes. These observations do not prove hardware decoder throughput or a
constant callback rate on physical phones.

The raw logs, source identities and ledgers are named in
`build/qa/cinematic/actual-logs11.json`. All 30 Lighthouse and 20 native runs are
retained. Blender and competing browser jobs were stopped during the matrix.
Earlier failed/superseded attempts remain separate, including the 05 LCP failure,
interrupted/headed runs, rejected trials, WebKit poster recovery defect and phone
card defect. No failed attempt is relabeled as final passing evidence.

The independent reconciliation is in
`build/qa/cinematic/independent-validation11.json` and `.md`. It recomputes byte
sums, timing medians and emitted JavaScript sizes, verifies exact build/source
identities and all 53 capture hashes, and retains 88 earlier/control inputs.
`build/qa/cinematic/evidence-archive11/` contains 627 hashed files totaling
493,905,180 bytes. This mechanical audit is independent of implementation
calculations, not a substitute for independent human craft or field review.

The candidate retains separate results for:

1. Engineering/source and immutable-publication integrity.
2. Complete-loop automatic transfers and five comparable route/profile runs.
3. Native browser behavior, accessibility, reflow and recovery.
4. Independent human craft at 3/3, two rounds of six representative visitors, two
   qualitative investor reviews, and physical iPhone/Android playback.

Use [the prepared review sheet](cinematic-review.md) to record the remaining independent evidence.

**Not conducted / not approved:** independent craft at 3/3, two rounds of six
representative visitors, two separate investor reviews, physical iPhone/Android
playback, manual screen-reader/zoom/flash-safety review, and public/operational
release approval. Firefox could not start on this host using cached or fresh
official runtimes; Firefox page behavior is unqualified. These gates cannot be
inferred from tests, emulation, screenshots or agent review. No conversion uplift
is estimated. Do not publish this candidate merely because local checks pass.
