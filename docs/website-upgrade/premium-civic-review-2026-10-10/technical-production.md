# Technical and production specification

Review date: 10 October 2026. Deliverable: audit and future implementation specification. No product source, asset registry, deployed site, rendering preference or published artifact was changed; no GPU work or form submission was performed for this review.

## Baseline and source reconciliation

The relevant inspected source is the clean `codex/cinematic-release` worktree at `/Users/holdenchung/.codex/worktrees/cinematic-release/GridNinjaSite`, commit **`bcd960db52057d768feccdefe393d6986fb9bf84`**. The lead's [release record](release-record.json) binds this approved source to merged commit **`e980000ea458f50662c268218791f6087f9e8ca3`**, deployment **`E2w6oLVgMVzpoxX4TjVXqQzA8n8s`**, and build **`4x9zp1Zusx59GVCtWyvPt`**. The fresh [live response record](live-home-response.json) confirms that exact build identifier in the production homepage. Public asset hash reconciliation is recorded separately by the lead. Reconfirm deployment identity before future implementation; do not base changes on the older main checkout merely because this review is saved there.

The current source already says that data centers share infrastructure with communities and should be better neighbors and responsible stewards. The task is to make this existing mission more visually legible and specific. The primary offer remains a paid, bounded capacity decision assessment of authorized historical inputs. The live-aligned source already uses **Scope an assessment** and **See a sample decision brief**; the older checkout's different CTAs are source drift, not an established live defect.

The homepage defaults to registered **cinematic-v1**; interactive facility inspection defaults to registered **facility-v12**. Historical v11 hold reports describe earlier candidates and must not be presented as the current live release. Current registry identities are:

| Package | Manifest SHA-256 | Function |
| --- | --- | --- |
| cinematic-v1 | `b19c53acb14dd4a0318696a18de6b706b97061f1887fcbbf4edca23190dd3a3c` | Homepage video, corresponding posters and two supporting stills |
| facility-v12 | `95e5b6394da9183cdc57d00992407ffec4fd6d55d1674ffd9bb8d13b6955658f` | Interactive demo and facility fallback |

Both derive from shared master `47b60bb7112df7be958779aaf61cd44c135917b6f665590fe61cc38fcbc02a87`. Verify these identities afresh when producing a candidate; do not silently substitute old or newer geometry.

## Route inventory and review coverage

[routes.json](routes.json) evaluates the inspected TypeScript route manifest and resource catalog in memory: **38 declared routes, 18 indexable routes, 15 gated resource pages, four available non-indexable frozen assessment pages, and one non-indexable contact receipt page**. It is a source inventory, not an HTTP availability result.

| Review group | Declared routes | Required review |
| --- | --- | --- |
| Core decision journey | `/`, `/assessment`, `/demo`, `/contact` | Full visual, responsive, keyboard, meaning and navigation review |
| Buyer/context | `/solutions/ai-cloud`, `/solutions/colocation`, `/solutions/bridge-power`, `/about`, `/platform`, `/proof`, `/why-gridninja`, `/proof/proof-pack`, `/dcii`, `/platform/dispatch-envelope` | Visual consistency, claim scope and route-specific meaning |
| Trust and evidence | `/evidence`, `/methodology`, `/insights`, `/data-handling` | Publication status, source visibility, distinct research versus GridNinja proof |
| Protected surfaces | `/contact/thanks`; `/evidence/assessments/demo-01-{a,b,c,d}/v1.0.0` | Receipt remains truthful; frozen briefs retain exact identity and semantics |
| Gated resources | Fifteen paths enumerated in routes.json | Truthful unavailable states and no accidental promotion/indexing |

Also retain the one-hop permanent `/roi` → `/assessment` redirect, exact HTML/PDF/JSON assessment URLs, explicit legacy `/evidence/releases/…` withdrawal behavior, asset allowlists and normal missing-route behavior. Inspect forms without submitting production inquiries. No new top-level page is required: research belongs on `/evidence`, with scoped links from home and mission context on existing About/platform surfaces.

## Independent review of supplied live captures

This workstream visually inspected the lead's top-of-page captures for assessment, demo and platform at 1440, 768 and 390 px, plus their mobile full-page captures. The following are visual/copy-density findings, not observed user-task failures. No top-level horizontal clipping was visible in those nine top captures. That limited observation does not establish full-page reflow, contrast, keyboard operation, enlarged-text behavior or assistive-technology conformance.

| Finding | Evidence | Design consequence |
| --- | --- | --- |
| Assessment repeats the scoping/answer explanation before inquiry | [390 px](screenshots/assessment-390.jpg), [768 px](screenshots/assessment-768.jpg), [1440 px](screenshots/assessment-1440.jpg). The mobile first 1,000 px show the hero and another introductory block with a second sample link; the form heading begins near 822 px on tablet and is already visible near 574 px on desktop. | P2: compress duplicate pre-form prose/link while retaining the useful distinction between conversation and paid work. Verify the existing primary anchor brings the form into view. Avoid adding artwork ahead of the inquiry. |
| Demo correctly prioritizes the result and unresolved commercial question before the mobile illustration | [390 px](screenshots/demo-390.jpg), [768 px](screenshots/demo-768.jpg), [1440 px](screenshots/demo-1440.jpg). Requested/model values and synthetic/no-authority boundary remain visible. | Preserve this ordering when harmonizing the design. Do not move a beautiful facility scene above the decision on mobile. |
| Scenario exploration and a hypothetical minimum have similar visual weight | [390 px](screenshots/demo-390.jpg), [768 px](screenshots/demo-768.jpg). Both are large bordered disclosures below the summary. | P2: make scenario comparison the evident next action; present the hypothetical minimum as advanced exploration. Validate comprehension with an unfamiliar reader; these stills do not prove a disclosure-control defect. |
| Platform has a strong hierarchy but depends almost entirely on prose | [1440 px](screenshots/platform-1440.jpg), [768 px](screenshots/platform-768.jpg), [390 px](screenshots/platform-390.jpg). The phone H1 breaks “control-” and “plane” across lines; the introduction and actions occupy roughly the first 650 px. | P2: improve the mobile heading measure/wrapping and replace some explanatory prose with one static intended-loop figure after the intro. Retain the visible in-development state and current-offer boundary; do not add another large hero image ahead of the explanation. |

The desktop demo capture contains a visible `Loading…` label. A still image cannot establish whether it completed or failed, so this is an observed transient state only. Large blank regions in the full-page captures may reflect deferred offscreen painting; they are not treated as missing-content defects. Interactive, zoom and physical-device checks remain separate.

## Reuse and thumbnail design contract

Current implementation points in the source worktree:

- `src/app/(marketing)/page.tsx` and `src/content/copy/cinematic-home.ts` own the current section sequence and homepage copy; legacy `copy/home.ts` is not the homepage source.
- `src/components/marketing/facility-hero.tsx`, `facility-hero-video.tsx` and `cinematic-home.css` own hero/media, playback controls and the current architectural/editorial dark-to-light page system. Extend these patterns, not the older all-dark homepage.
- `src/lib/cinematic/{releases.ts,files.mjs,http.mjs,manifest-schema.mjs,playback.ts,performance.mjs}` already separate approved files, HTTP behavior, poster selection, motion and budgets. The interactive facility remains a separate subsystem.

The present package contains only `still-construction.webp` (720×480, 43,694 bytes) and `still-cooling.webp` (720×480, 38,998 bytes). Both buyer cards point to the same construction image, with CSS object positions 40% and 70%; the platform card reuses that image. Cooling illustrates the proof-method card. The decision-brief thumbnail is already HTML derived from the assessment record and should remain so.

Give each photographic/architectural card an explicit semantic asset assignment. Do not infer the image from array index, card order or a generic `construction` fallback. The coordinated [design specification](design-specification.md) calls for three raster subjects (AI rack, colocation row, platform systems), code-native static SVG/HTML for the civic context and proof boundary, and the existing selector-backed HTML brief facsimile. Only the three raster subjects need a new immutable editorial package separate from **cinematic-v1**. These changes do not require regenerating its 600 delivered video frames, corresponding posters or facility-v12.

Proposed minimal future interface (specification only):

```ts
type RasterArtId = "ai-workload" | "colocation-hall" | "platform-systems";
type EditorialSlot =
  | "buyer-ai-cloud" | "buyer-colocation" | "proof-method"
  | "platform-direction" | "civic-mission";

interface EditorialImage {
  file: string;
  width: number;
  height: number;
  bytes: number;
  sha256: string;
  mimeType: "image/webp";
}
interface EditorialArtwork {
  id: RasterArtId;
  environment: "synthetic";
  purpose: string;
  variants: Record<480 | 800 | 1280, EditorialImage>;
  sourceRevision: string;
  sourceMasterSha256: string;
  renderSettingsSha256: string;
}
type RasterPlacement = {
  kind: "raster";
  artworkId: RasterArtId;
  accessibility:
    | { decorative: true; alt: "" }
    | { decorative: false; alt: string };
};
type CodePlacement = {
  kind: "code";
  illustrationId: "proof-boundary" | "civic-context";
};
type HomepageArtwork = Record<EditorialSlot, RasterPlacement | CodePlacement>;
```

The generic union above permits structural reuse; this exact semantic mapping is an additional content invariant to validate in the homepage configuration:

| Slot | Required kind / subject |
| --- | --- |
| `buyer-ai-cloud` | Raster / `ai-workload` |
| `buyer-colocation` | Raster / `colocation-hall` |
| `proof-method` | Code / `proof-boundary` |
| `platform-direction` | Raster / `platform-systems` |
| `civic-mission` | Code / `civic-context` |

The decision-brief card remains outside this artwork mapping. Its small HTML thumbnail deliberately contains no quantities: use selector-backed **DEMO-01-B v1.0.0**, the actual title **A smaller commitment needs review**, and the synthetic/no-authority label specified in the design. Keep full quantities, increment labels, reference/hour and commercial question in the worked brief. Validate that the thumbnail's visible ID, version, title and qualification and its destination resolve to that same published version; do not copy a different version's title or silently select the latest record.

Use distinct subjects for AI cloud and colocation, a vector boundary/evidence composition for proof, a system relationship composition for platform, and district-scale vector context for the civic mission. The current baseline uses 4:5 buyer frames and a 1.9 evidence ratio; the new design deliberately replaces both with **16:10 card apertures**. Buyer images sit above text; evidence images sit above text on desktop/mobile and beside text in tablet rows. Raster derivatives are 480×300, 800×500 and 1280×800. The civic SVG uses separate 1280×560 desktop and 400×440 mobile compositions with HTML labels, not a cropped desktop raster. Supply true intrinsic dimensions; the existing image markup's 720×450 attributes do not describe its actual 720×480 files, although CSS currently reserves the visible frame.

Future raster-package proposal: `editorial-v1`, `environment: synthetic`, registry-pinned manifest and allowlisted WebP derivatives for the three raster subjects. Preserve source/master/settings hashes, exact dimensions, MIME, bytes and render provenance; retain EXR/PNG masters privately. Publish through an explicit asset route/approved trace set analogous to the existing media packages. Drafts stay outside `public/`; unknown/withheld returns 404, withdrawn returns 410, integrity failure returns 503. Corrections create a new package version. Inline proof/civic SVGs remain ordinary reviewed server-rendered components with HTML labels; they need no asset registry or rendering pipeline. Do not add files to or rewrite cinematic-v1/facility-v12.

Render card images through server components with native `<picture>`, explicit dimensions, lazy loading and asynchronous decode. Default to decorative `alt=""` where nearby card text conveys all meaning. The informational civic illustration must expose this equivalent description exactly once across its desktop/mobile variants: **Conceptual shared infrastructure: a data center and local community are separate participants connected to a shared grid. The marked site boundary covers the illustrative facility, not the grid or community.** A hidden variant must not create a duplicate announcement. Its adjacent visible caption retains the no-demonstrated-service/benefit boundary. Keep all headings, labels, qualifications and citations in HTML. Artwork failure must leave the card text and destination usable; a neutral reserved frame is preferable to silently showing the wrong repeated subject. Add no client JavaScript or dependency for these static images.

## Semantic, accessibility and publication controls

The cinematic hero already serves an image before video, uses `preload="none"`, waits for a decoded poster and at least 25% visibility, and acquires one selected movie rendition. It suspends while hidden/offscreen; respects reduced motion and Save-Data until intentional Play; retains user pause; preserves the selected rendition after orientation changes. Autoplay refusal becomes a deliberate Play action. Poster/movie errors and the 15-second eligible-start deadline provide explicit Retry, without changing fixture B or its publication link. Preserve this state machine and the no-JavaScript image/decision/navigation path.

No initial GLB download belongs on the cinematic homepage. Keep 3D inspection an explicit journey to the demo. Preserve native keyboard controls, visible focus, 44 px control targets, clear error status, sufficient contrast across the dark/light sections, 320 px reflow, 200%/400% zoom, no color-only distinction, and full static equivalents. Automated axe is necessary but does not replace VoiceOver/NVDA or physical-phone review.

The civic composition depicts an ambition, not a connected live network. It must not suggest existing export, grid support, community backup power, heat delivery, customer sites, realized emissions/water savings or economics. All public example numbers remain synthetic, economics unestimated, accepted/delivered capacity not applicable and operating authority none. Research supports mechanisms under stated conditions; it cannot upgrade GridNinja's evidence maturity or turn a future capability into a current service. Preserve all four frozen assessment versions byte-for-byte and keep research citations distinct from GridNinja proof records.

## Exact performance and resource gates

The selected cinematic home has approved route-specific ceilings. Applying the old all-route 1.5 MiB value to it would misstate the current source contract.

| Existing gate | Limit / method |
| --- | --- |
| Automatic homepage transfer, selected cinematic, desktop | **4,194,304 bytes (4 MiB)** |
| Automatic homepage transfer, selected cinematic, mobile | **2,097,152 bytes (2 MiB)** |
| Other routes, or unproven/unknown cinematic profile | **1,572,864 bytes (1.5 MiB)** |
| Core-route initial JavaScript | **180 KiB Brotli**, framework/root chunks included |
| Largest image response | **256,000 bytes (250 KiB)** |
| Font responses | **163,840 bytes (160 KiB)** |
| Insight article scripts | **204,800 bytes (200 KiB)** |
| Cinematic package file ceilings | Desktop MP4 4 MiB; mobile MP4 2 MiB; mobile poster 100 KiB; other posters/stills 200 KiB |
| Median lab timing / shift | LCP ≤2,500 ms; FCP ≤1,800 ms; TBT ≤200 ms; CLS ≤0.1 |
| Lab categories | Performance ≥90; accessibility and best practices ≥95; indexable-route SEO 100 |
| Contact-specific gates | LCP ≤2,000 ms; CLS ≤0.05 |
| Sampling | Five fresh runs per release-candidate route/profile; retain individual misses, browser/build and settings identity |

The whole-page transfer includes video, poster, scripts, fonts, stills and response accounting, not just MP4 bytes. Cinematic-v1 currently records a 761,013-byte desktop movie / 379,717-byte mobile movie and 86,388 / 40,524-byte posters. These package values are not a current live page measurement. Keep new thumbnail derivatives at or below 200 KiB each, lazy load below-fold artwork, and measure after full scrolling as well as initial/through-playback startup; do not increase the existing ceilings.

The verified release record is **not all green**: post-merge mobile-home median LCP was **2,503.1661 ms**, above the unchanged 2,500 ms gate, and a WebKit disclosure-control test failed in two attempts. These are recorded release concerns, not a fresh performance measurement or diagnosis by this workstream. Preserve both in the implementation baseline; resolve or explicitly disposition them with new source-pinned evidence instead of rounding the LCP value down or attributing the failures to proposed artwork.

For unchanged facility-v12, retain its separate runtime guards: ≤80,000 triangles, ≤10 materials, ≤60 animated / 40 inactive draws, and ≤32 MiB peak estimated retained/staging allocation. Ecosystem overview additionally stays ≤39 draws and ≤40,000 triangles. Capability p95 limits are 20 ms desktop / 34 ms mobile emulation with at least 120 samples; requested-cadence missed slots ≤10%. These estimates and emulated-phone results do not certify physical phone memory or thermals. Static thumbnail work should not consume any of these WebGL budgets.

## M5 Pro production runbook for later implementation

Available host confirmed by the lead: arm64 Apple M5 Pro, 18 CPU cores, 20 GPU cores, 48 GiB unified memory and Metal 4. Use the machine to author stronger lightweight visual assets; do not require equivalent visitor hardware or add a browser compute feature.

The latest `scripts/cinematic/README.md` and `assets-source/facility/cinematic/settings.json` take precedence over older v11 experiments. Current cinematic settings are Blender 5.2.2 LTS/build `d13f752e3b9c`, Metal/MetalRT AUTO, four CPU support threads, orthographic 42° azimuth/28° elevation, 128 maximum samples, adaptive .005, seed 192809, OIDN with albedo/normal guides, eight bounces, persistent data, AgX Medium High Contrast/exposure 0. Desktop renders at 1600×1000 and mobile 960×720. A still derivative can reuse its material/light language while authoring the distinct compositions above; do not bake new data or product claims into it.

1. **Pin and isolate.** Record actual deployed/source identity, master/settings/source hashes and a fresh private output. Preserve masters and registered files. Use process-scoped configuration and fresh background Blender with factory startup; do not save global preferences. Keep private editorial derivatives in a fresh `build/cinematic/` authoring directory and package only reviewed WebP outputs later.
2. **Use the GPU where measured work benefits.** Render substantial editorial stills on Metal with four CPU support threads, initially at the current 128/.005 quality. Compare one representative final-size shot at 128 and 256 samples before applying the selection to the set. Render only stills needed for card/aperture review; no ten-second loop regeneration is required.
3. **Use CPU4 for the existing atlas pipeline if rebaking is needed.** Historical matched uncached atlas medians were CPU4 8.847 s, Metal 11.367 s, hybrid 12.618 s, mixed 9.943 s. They apply to that archived 512²/256² pipeline. Set `GN_CYCLES_DEVICE=cpu`, `GN_CYCLES_CPU_THREADS=4`, `GN_BAKE_SPATIAL_COMPUTE=cpu`, `GN_BAKE_SAMPLES=64`, `GN_BAKE_CACHE=off` during qualification. Do not rebake unchanged assets just to exercise hardware.
4. **Serialize expensive work.** One GPU lease across Cycles, browser GPU captures, simulator graphics and performance measurements. Existing `scripts/cinematic/run.py` uses `build/cinematic/render.lock` and owns only its child process group. CPU encoding/compression also stays outside performance measurement windows. Other agents can conduct copy/source reviews concurrently. Hybrid is off unless a matched measurement shows a real advantage. The existing helper caps CPU threads at six; four is the measured responsive-workstation default, not a claim to have benchmarked all 18 cores.
5. **Bound and preserve attempts.** The initial cinematic study recorded approximately 123 seconds of kernel compilation. For the first still study allow a **600-second process deadline**, then **900 seconds for a bounded final still batch**. These are proposed still-work defaults, not measured requirements. Existing full-video proof/production defaults are 1,800/3,600 seconds and are unnecessary here. Preserve logs, receipts and incomplete outputs; timeout sends TERM to the owned group, waits ten seconds, then KILL if necessary. Inspect the recorded PID before removing any stale lock.
6. **Handle Metal failure explicitly.** On a reproducible compile stall/SIGTRAP, preserve the attempt and permit one fresh-process retry using process-scoped `CYCLES_METAL_DISABLE_BINARY_ARCHIVES=1`, recording the changed configuration. If it fails again, use explicit CPU4 fallback with a separately named receipt. Do not silently fall back, repeatedly retry, delete global caches or terminate unrelated Blender sessions. A differing render requires geometry/quality review, not automatic acceptance as backend noise.
7. **Compare on the actual new workload.** Use identical source, composition, dimensions, seed and sampling; record first invocation separately and median of three subsequent repetitions when throughput comparison is warranted. Inspect detail, contact shadows, aliasing and legibility at actual card size, plus decoded numerical comparisons. Existing historical measurements guide selection but do not promise a speedup for new scenes. Process RSS is not total unified-memory or physical GPU allocation.
8. **Retain masters and inspect delivery.** Preserve linear EXR, display-referred PNG, actual device/settings, source hash and exported WebP receipt. Current cinematic EXRs are denoised half-float RGB, not undenoised multi-pass archives; use the separate bounded diagnostics/premium lab if those passes are required. Decode the WebP at actual browser size and review desktop/mobile crops, black level and material color. Publish only after independent art and technical review.

Newest recorded cinematic evidence: warmed 128/.005 frame renders took 5.596–5.639 s desktop and 2.512–2.603 s phone, versus 256/.005 reference frames of 11.248 / 4.248 s after initial compilation. The complete production job took 2,230.794 s (37 min 11 s), rendered 532 new frames and reused 68 hash-matched proof frames; peak process RSS was 7.33 GiB. These are recorded single-host workload results, excluding file writes/setup for per-frame timings and including them for the full job. They are not a forecast for this artwork, a claim of maximum M5 throughput or website performance.

Keep three kinds of output distinct: **editorial illustrations** may use intentional new cameras/light; **cinematic posters** must correspond to the actual compressed movie's first frame; **interactive-facility posters** must match the browser renderer. The current cinematic sRGB-transfer path corrected a native playback black-level mismatch missed by explicit decoder comparisons. Do not rerender or replace those posters merely to make independent editorial stills look richer.

## Future validation, limited to the implemented change

No product checks were executed as part of authoring this specification. Source inspection and route-inventory extraction do not establish a green build or passing live accessibility/performance result. The following are future candidate checks, using npm, the existing lockfile and Node 22/npm 10.9; retain distinct local, native-device and release results.

```sh
npm run css:validate
npm run brand:check
npm run lint
npm run typecheck
npm run assessment:validate
npm run cinematic:validate
npm run facility:validate
npm run build
npm exec vitest run tests/unit/cinematic tests/unit/navigation tests/unit/seo --coverage.enabled=false
CINEMATIC_E2E=1 npm run test:e2e -- tests/e2e/cinematic-home.spec.ts tests/e2e/cinematic-recovery.spec.ts tests/e2e/cinematic-orientation.spec.ts tests/e2e/cinematic-visibility.spec.ts tests/e2e/cinematic-visual.spec.ts
npm run test:seo
LHCI_RELEASE_CANDIDATE=1 npm run lighthouse
```

Run desktop and mobile Lighthouse profiles with the existing provenance-aware cinematic/facility measurement harness so the correct route-specific transfer ceiling is applied. `npm run facility:measure`, `facility:lighthouse` and `facility:performance:validate` provide the existing integrated path; inspect its prerequisites and selected source/build before execution. Existing cinematic tests skip without `CINEMATIC_E2E=1`; a skip is not evidence. No generic `npm test` script exists.

Add focused tests only for new behavior: each card maps to its intended distinct artwork; intrinsic dimensions/aspect are true; unapproved/tampered editorial files cannot ship; missing images retain accessible text/link; research references remain crawlable and retain limitations. Reuse existing scenario, frozen-publication, media/error and navigation coverage instead of mirroring implementation with superficial tests. Full integration/provider tests are only necessary if that system changes; this artwork/copy work should not alter it.

Manual acceptance: compare source-pinned whole pages at 1440, 1366, 768, 390 and 320 px; normal/reduced motion, no JS, failed assets and keyboard; native Chrome/Safari and physical-phone decoding; VoiceOver/NVDA on the changed journey. A first-time reader should recover the current paid assessment, the civic ambition, and absence of live control/customer proof without facilitator repair. Independent art judgment assesses distinct subjects and legibility at real size. Audit completion is neither deployment approval nor a claim that these future gates passed.
