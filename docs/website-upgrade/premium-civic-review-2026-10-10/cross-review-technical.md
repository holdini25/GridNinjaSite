# Technical second-pass review

Reviewed 10 October 2026 by the technical-production reviewer, independently of the research catalog's author. Scope: delivery, source/release boundaries, typed catalog consistency, routing, palette arithmetic and performance-contract accuracy. This is not an independent reproduction of the seven papers, a new academic source audit, a product build, or a fresh performance/accessibility certification.

## Research delivery and release governance

The [research matrix](research-matrix.md) and [catalog example](research-catalog.example.ts) are consistent with the assessment-first source contract after two corrections:

1. **Keep external findings out of GridNinja evidence maturity.** The existing `src/seo/claim-registry.ts` models GridNinja claims with environment, maturity, permission, approved surfaces and review state. A citation to another organization's research must not silently become a synthetic, lab, pilot or production GridNinja result. The revised example maps external sentences to stable research IDs, setting and limitations in a separate catalog; any actual GridNinja claim still requires the existing `PublicClaim` controls.
2. **Do not promote a gated article through a proposed placement.** `/insights/safe-data-center-grid-flexibility` is currently a gated-status page and was removed from proposed placements. The existing `/insights` hub and `/platform/dispatch-envelope` are indexable; their availability does not authorize publishing gated children. Every entry now has the canonical bibliography destination `/evidence#research`, and the presentation contract explicitly excludes gated-page promotion.

The corrections were made by the research owner and independently checked here. The catalog retains all seven unique source IDs and DOIs, three ordered homepage notes, exact adjacent limitations, publication status separate from review depth, actual review date, access limitations and unverified dates as null. Every source remains external context, not GridNinja outcome evidence; figure reuse is unapproved; public release remains proposed and requires editorial review. No paper PDF or figure is added to the website. Journal text citations do not imply partnership or endorsement.

The first note is bounded to an external 256-GPU cluster; the second retains the possibility of increased emissions and distinguishes system cost from household/site economics; the third preserves historical and site-specific limits. The footer and approved CTAs agree across the catalog, matrix and design specification. The seven-entry bibliography remains separate from GridNinja publication evidence. Frozen assessment records are unchanged, and research cannot alter their numbers, economics, acceptance, authority or version identity.

**Validation performed:** strict, isolated TypeScript compilation of the docs-only example passed with zero diagnostics using the existing source worktree's TypeScript package. Executed checks passed for seven unique IDs/DOIs, three homepage notes ordered 1–3, required governance flags, canonical bibliography destination, visible limitation strings, source IDs/DOIs in the matrix, footer/heading/link agreement and exact CTA strings. All contextual placements resolve to existing indexable page entries in the pinned [route inventory](routes.json). These checks do not verify a future rendered bibliography or replace a fresh source/version/correction check before publication.

## Art and semantic reconciliation

The [technical-production contract](technical-production.md) now matches the design owner's second-pass decisions:

- Three raster subjects only: AI rack, colocation row and platform systems. Shared card apertures are 16:10; civic and proof use static code-native SVG/HTML. Exact slot-to-subject mapping is explicit rather than relying on the generic union to enforce meaning.
- The small brief thumbnail uses selector-backed `DEMO-01-B v1.0.0`, the actual title “A smaller commitment needs review” and the synthetic/no-authority label, with no quantities. The full worked brief keeps the numerical basis, historical hour and commercial question. Future validation checks visible fields and destination against the same published version.
- The civic composition has a mandatory equivalent description shared between responsive variants, announced once. The adjacent caption continues to deny demonstrated grid service or community benefit.
- New editorial assets occupy a separately approved immutable package. Existing cinematic-v1 videos/posters and facility-v12 do not need regeneration for this design. No GPU work was performed for the review.

## HTTP inventory correction and fresh results

The original collector relied on Python's automatic redirect behavior; in this environment it left `/roi` at HTTP 308 while its description claimed redirects were followed. [collect-http-baseline.py](collect-http-baseline.py) now handles 301/302/303/307/308 explicitly, permits at most five HTTPS same-origin redirects, refuses cross-origin destinations and loops, and records every hop including an unfollowed refused hop. All requests are GET; no inquiry was submitted.

The rerun recorded in [http-baseline.json](http-baseline.json) completed at **2026-10-10T19:34:03.513076+00:00**:

| Check | Result |
| --- | --- |
| Route probes | 41: 38 inventory entries plus three boundary probes |
| Final status counts | 39 × 200; one unknown brief version × 404; one withdrawn legacy path × 410 |
| Route request errors | None |
| `/roi` | One 308 hop to `https://gridninja.ai/assessment`; final 200 |
| Sitemap | 18 entries |
| Observed build | `4x9zp1Zusx59GVCtWyvPt` |
| Cinematic media | All six retrieved files match the approved source bytes |

Five focused mocked redirect scenarios passed: 308 following, cross-origin refusal before a second GET, loop refusal, sixth-hop refusal and successful completion after five hops. Route status and media identity do not establish form delivery, browser rendering, indexing, accessibility or timing performance.

## Exact performance contract

The source of truth is the pinned cinematic release worktree, especially `src/lib/cinematic/performance.mjs` and the associated QA budgets. The current homepage is selected cinematic-v1; stale main's generic budget is not the applicable homepage limit.

| Resource / metric | Existing gate |
| --- | --- |
| Selected cinematic homepage automatic transfer, desktop | 4,194,304 bytes / 4 MiB |
| Selected cinematic homepage automatic transfer, mobile | 2,097,152 bytes / 2 MiB |
| Ordinary routes or unproven profile | 1,572,864 bytes / 1.5 MiB |
| Initial client JavaScript, including framework | 180 KiB Brotli |
| Largest image response | 256,000 bytes / 250 KiB |
| Fonts | 163,840 bytes / 160 KiB |
| Insights scripts | 204,800 bytes / 200 KiB |
| Median timing / layout shift | LCP ≤2,500 ms; FCP ≤1,800 ms; TBT ≤200 ms; CLS ≤0.1 |
| Contact-specific timing / shift | LCP ≤2,000 ms; CLS ≤0.05 |
| Lighthouse scores | Performance ≥90; accessibility and best practices ≥95; indexable SEO 100 |

The whole-page transfer includes more than the movie. Media file ceilings, proposed still sizes and facility runtime limits remain separately enumerated in the technical contract. No budget increase is proposed; civic/research/static artwork adds no initial client JavaScript. Later performance acceptance requires five fresh runs per candidate under the existing harness, without simultaneous GPU authoring.

The [audit](audit.md) correctly retains historical unresolved release concerns: mobile-home median LCP **2,503.1661 ms** exceeded the **2,500 ms** gate, and the WebKit disclosure test failed on two attempts. The fresh work here is HTTP/routing and documentation validation, not a new timing run. It cannot convert those failures into passes or certify current live performance.

## Color and audit cross-check

An independent linearized-sRGB calculation reproduced all **19** generated contrast pairs and their declared pass/fail values within 0.000051 ratio units. White on brand orange is **2.05355:1**, confirming the dark-label requirement. These are solid-color calculations only.

One state-table precision issue was sent to the color owner: secondary heading text is **17.3179:1** on graphite, **15.9012:1** on raised hover, and **18.6268:1** on canvas pressed. A blanket minimum of 16.1 cannot describe all three states. Use the exact per-state values or the lower overall bound, and include the state pairs in the reproducible generator. The owner controls those files; any subsequent added pair count supersedes the 19-pair set reviewed here.

The audit's route counts, distinction between gated pages and indexable pages, release IDs, observed versus proposed framing, unchanged media policy and performance caveats agree with the technical evidence. A wording correction was requested for A13: “three proposed notes,” since the research catalog does not grant public release approval. Screen-reader, physical-device, enlarged-text and complete state-matrix testing remain expressly pending. The audit/spec handoff can be complete while those future implementation/release gates remain open.
