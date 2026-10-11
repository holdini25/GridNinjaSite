# Annotated live-site audit and ranked backlog

Review date: 10 October 2026. This is an assessment and design handoff, ending before website implementation or deployment. Every numbered finding distinguishes the observed condition from the proposed design response. A preference is not a defect, and no conversion lift is claimed.

## Verified release and coverage

The live build ID matches the PR #3 release record; all six checked cinematic assets match the approved source files byte for byte. The approved source is bcd960db52057d768feccdefe393d6986fb9bf84, merged as e980000ea458f50662c268218791f6087f9e8ca3. Main in this checkout is older. Begin later implementation from the verified merged source, after reconfirming the live build. Evidence: [release record](release-record.json), [live response](live-home-response.json), [HTTP inventory](http-baseline.json).

The source inventory contains 38 public page routes: 18 indexable pages, 15 gated-status pages, four frozen brief pages and one receipt page. [All routes](routes.json) were requested read-only; /roi, an old gated resource and an unknown brief version add three boundary probes. The published sitemap contains 18 URLs. This covers public page routing; it is not an exhaustive enumeration of API endpoints or binary asset variants.

Home, Assessment, Demo, Platform, Proof, Evidence, About and all three solution pages were captured at 1440, 768, 390 and 320px, with 1000px viewport height: 40 route/width samples. Each has a top screenshot, full-page screenshot, DOM text and recorded geometry in [capture-index.json](capture-index.json). No top-level horizontal overflow was recorded in those samples. Full-page captures may include lazy-paint blanks; those are not reported as product defects. Additional settled homepage section captures document the repeated thumbnails.

## Ranked opportunities

Scores make the triage inspectable: visual impact and message clarity each use 1–5, confidence uses 1–5, effort weight is S=1 or M=2. Score = (2×visual + 2×message + confidence) / effort. Scores express reviewer judgment, not measurements of user benefit. S means one focused shared-component/content task; M means coordinated composition or asset work. Neither is a time estimate. Dependencies can override this ordering.

| Rank | Finding | Visual / message | Confidence | Effort | Score |
| --- | --- | --- | --- | --- | --- |
| 1 | [A10 · Keep the brief facsimile legible and faithful](#a10) | 4 / 4 | 5 | S | 21.0 |
| 2 | [A04 · Keep the narrative dark and the document light](#a04) | 5 / 3 | 4 | S | 20.0 |
| 3 | [A05 · Unify orange and the hierarchy around it](#a05) | 5 / 3 | 4 | S | 20.0 |
| 4 | [A09 · Make the evidence route easier to enter](#a09) | 3 / 5 | 4 | S | 20.0 |
| 5 | [A13 · Add three balanced research notes](#a13) | 3 / 5 | 4 | S | 20.0 |
| 6 | [A06 · Use one editorial alignment grid](#a06) | 4 / 3 | 5 | S | 19.0 |
| 7 | [A07 · Shorten mobile breadcrumbs and tighten the gap](#a07) | 3 / 4 | 5 | S | 19.0 |
| 8 | [A08 · Bring the assessment inquiry forward](#a08) | 2 / 5 | 4 | S | 18.0 |
| 9 | [A11 · Establish a first and advanced action in the demo](#a11) | 2 / 4 | 4 | S | 16.0 |
| 10 | [A14 · Make the present offer and sample path consistent](#a14) | 2 / 3 | 5 | S | 15.0 |
| 11 | [A01 · Make the civic ambition a signature composition](#a01) | 5 / 5 | 4 | M | 12.0 |
| 12 | [A03 · Give proof and platform the right visual subjects](#a03) | 5 / 5 | 4 | M | 12.0 |
| 13 | [A02 · Differentiate the two buyer thumbnails](#a02) | 5 / 4 | 5 | M | 11.5 |
| 14 | [A12 · Make the platform direction graspable in one figure](#a12) | 3 / 4 | 4 | M | 9.0 |

Recommended implementation sequence: establish shared grid and color tokens (A04–A07), then deliver the signature civic composition and distinct media family (A01–A03, A10), then integrate research and route-specific reading improvements (A08–A14). Address the recorded release-test concerns before declaring the next release ready. This sequence balances high-yield polish with the assets that define the site.

<a id="a10"></a>
## A10 · Keep the brief facsimile legible and faithful

**Routes:** /. **Viewport/state:** 1440px #evidence; 390px full-page.

**Screenshot evidence:** [home-evidence-1440.jpg](screenshots/home-evidence-1440.jpg), [home-390-full.jpg](screenshots/home-390-full.jpg).

**Classification:** observed condition; proposed improvement is a design hypothesis.

**Observed:** The existing HTML brief preview conveys a document but some source text is 5px and cannot serve as readable evidence at card size.

**Proposed:** Show the same-version record ID, published title and synthetic/no-authority label in a nonnumeric HTML excerpt. Keep quantities, reference/time basis and qualifications in the separate worked decision and linked immutable brief.

**Confidence:** High. **Effort:** S. **Acceptance:** Record identity, version and synthetic status are readable at actual card width and remain HTML. No frozen publication bytes, metrics or labels change.

<a id="a04"></a>
## A04 · Keep the narrative dark and the document light

**Routes:** /. **Viewport/state:** 1440, 768 and 390px full-page composition.

**Screenshot evidence:** [home-1440-full.jpg](screenshots/home-1440-full.jpg), [home-390-full.jpg](screenshots/home-390-full.jpg).

**Classification:** observed condition; proposed improvement is a design hypothesis.

**Observed:** The current homepage alternates into broad light sections while supporting pages remain predominantly dark. This is an aesthetic mismatch with the requested direction, not an accessibility defect.

**Proposed:** Use graphite sections and isolate light paper to the worked decision and brief excerpt. Vary spacing and composition rather than alternating full-width light panels.

**Confidence:** High observation / medium design. **Effort:** S. **Acceptance:** Desktop/mobile contact sheets show one coherent dark narrative with local paper contrast. Qualification text remains readable, and existing layouts reserve media dimensions.

<a id="a05"></a>
## A05 · Unify orange and the hierarchy around it

**Routes:** /, /assessment, /demo. **Viewport/state:** 1440 and 390px; default controls.

**Screenshot evidence:** [home-1440.jpg](screenshots/home-1440.jpg), [assessment-390.jpg](screenshots/assessment-390.jpg), [demo-390.jpg](screenshots/demo-390.jpg).

**Classification:** observed condition; proposed improvement is a design hypothesis.

**Observed:** The homepage uses pale local action orange (#FFAE55); shared primary is #FF9F1A. Broad neutral-light regions also change its perceived emphasis.

**Proposed:** Adopt the sRGB/OKLCH state contract, with dark button labels, restrained cool graphite and limited saturated area. Keep REPAIR semantically distinct.

**Confidence:** High source observation / medium design. **Effort:** S. **Acceptance:** Every delivered component state uses a checked pair; brand orange appears strongest on the primary action. Verify rendered contrast and grayscale hierarchy, not only token math.

<a id="a09"></a>
## A09 · Make the evidence route easier to enter

**Routes:** /evidence. **Viewport/state:** 390px top viewport, 1440px heading.

**Screenshot evidence:** [evidence-390.jpg](screenshots/evidence-390.jpg), [evidence-1440.jpg](screenshots/evidence-1440.jpg).

**Classification:** observed condition; proposed improvement is a design hypothesis.

**Observed:** The first 1000px on mobile contains primarily introduction and qualification. Brief cards start below it; the desktop H1 is tightly wrapped.

**Proposed:** Add an immediate sample-brief anchor and concise structure, preserve synthetic qualifiers, broaden the H1 measure. Put external research after GridNinja examples.

**Confidence:** High observation / medium design. **Effort:** S. **Acceptance:** An unfamiliar reviewer can open the existing synthetic brief from the introductory screen; research is clearly external and never replaces product evidence.

<a id="a13"></a>
## A13 · Add three balanced research notes

**Routes:** /, /evidence, /about. **Viewport/state:** Homepage evidence section; Evidence/About top views.

**Screenshot evidence:** [home-evidence-1440.jpg](screenshots/home-evidence-1440.jpg), [evidence-390.jpg](screenshots/evidence-390.jpg), [about-1440.jpg](screenshots/about-1440.jpg).

**Classification:** observed condition; proposed improvement is a design hypothesis.

**Observed:** The reviewed homepage has no concise external-research strip connecting flexibility, tradeoffs and local resource context. This is a content opportunity, not a broken feature.

**Proposed:** Use the three proposed notes plus visible study limits, with the seven-entry bibliography at /evidence#research. Render server-side.

**Confidence:** High observation / medium design. **Effort:** S. **Acceptance:** Each note includes setting, limitation and a working descriptive link with JavaScript disabled. External studies cannot be mistaken for GridNinja demonstrations or economics.

<a id="a06"></a>
## A06 · Use one editorial alignment grid

**Routes:** /about, /proof, /evidence, /platform, /solutions/ai-cloud, /solutions/colocation, /solutions/bridge-power. **Viewport/state:** 1440px normal reading, with 768px comparison.

**Screenshot evidence:** [about-1440.jpg](screenshots/about-1440.jpg), [proof-1440.jpg](screenshots/proof-1440.jpg), [evidence-1440.jpg](screenshots/evidence-1440.jpg).

**Classification:** observed condition; proposed improvement is a design hypothesis.

**Observed:** Shared supporting-page heroes start noticeably farther right than following sections, producing a visible alignment reset.

**Proposed:** Unify container starts, headline measure and section grids in the shared page primitive; retain deliberate nested body measures.

**Confidence:** High. **Effort:** S. **Acceptance:** Hero, breadcrumb, body and final CTA align to the specified grid at 1440/768px, while paragraphs remain within readable measures.

<a id="a07"></a>
## A07 · Shorten mobile breadcrumbs and tighten the gap

**Routes:** /solutions/ai-cloud, /solutions/colocation, /solutions/bridge-power. **Viewport/state:** 390 and 320px normal reading.

**Screenshot evidence:** [solutions-ai-cloud-390.jpg](screenshots/solutions-ai-cloud-390.jpg), [solutions-colocation-320.jpg](screenshots/solutions-colocation-320.jpg), [solutions-bridge-power-390.jpg](screenshots/solutions-bridge-power-390.jpg).

**Classification:** observed condition; proposed improvement is a design hypothesis.

**Observed:** Solution breadcrumbs repeat the long hero wording, wrap, and precede a substantial empty interval.

**Proposed:** Use short audience labels in breadcrumbs and the shared mobile spacing scale. Keep the full page promise in the H1.

**Confidence:** High. **Effort:** S. **Acceptance:** At 320px, breadcrumb navigation remains understandable and keyboard accessible; no duplicate full H1 or oversized spacer before the heading.

<a id="a08"></a>
## A08 · Bring the assessment inquiry forward

**Routes:** /assessment. **Viewport/state:** 390 and 768px normal reading.

**Screenshot evidence:** [assessment-390.jpg](screenshots/assessment-390.jpg), [assessment-768.jpg](screenshots/assessment-768.jpg).

**Classification:** observed condition; proposed improvement is a design hypothesis.

**Observed:** The page repeats the scoping explanation and sample link before the inquiry; on the 390px top capture the form is still below view. This does not prove conversion loss.

**Proposed:** Compress duplicated pre-form prose while keeping conversation versus paid-work boundaries. Preserve the scope anchor and form fields. Add no artwork before the inquiry.

**Confidence:** High observation / medium behavioral inference. **Effort:** S. **Acceptance:** One concise offer explanation precedes the inquiry. Scope an assessment reaches the form with a visible heading/focus target, and all existing validation and data-handling behavior remains intact.

<a id="a11"></a>
## A11 · Establish a first and advanced action in the demo

**Routes:** /demo. **Viewport/state:** 390 and 768px normal reading.

**Screenshot evidence:** [demo-390.jpg](screenshots/demo-390.jpg), [demo-768.jpg](screenshots/demo-768.jpg).

**Classification:** observed condition; proposed improvement is a design hypothesis.

**Observed:** Scenario exploration and the hypothetical minimum are similarly prominent bordered disclosures. Result and unresolved commercial question correctly precede the illustration.

**Proposed:** Preserve the result-first mobile sequence; make scenario comparison primary and the hypothetical minimum an advanced disclosure.

**Confidence:** High observation / medium design. **Effort:** S. **Acceptance:** Independent readers find the scenario comparison first; hypothetical values remain unmistakable. Existing keyboard/disclosure tests pass in Chromium, Firefox and WebKit.

<a id="a14"></a>
## A14 · Make the present offer and sample path consistent

**Routes:** /solutions/ai-cloud, /solutions/colocation, /solutions/bridge-power, /about. **Viewport/state:** 390 and 320px normal reading.

**Screenshot evidence:** [solutions-ai-cloud-390.jpg](screenshots/solutions-ai-cloud-390.jpg), [solutions-colocation-390.jpg](screenshots/solutions-colocation-390.jpg), [solutions-bridge-power-390.jpg](screenshots/solutions-bridge-power-390.jpg), [about-390.jpg](screenshots/about-390.jpg).

**Classification:** observed condition; proposed improvement is a design hypothesis.

**Observed:** AI Cloud and Colocation show only the primary hero action while Bridge Power shows both; About stacks differently sized CTA treatments. At 320px, the three solution first screens do not explicitly say paid; Colocation and Bridge Power also omit the historical-input/no-live-control boundary in that top capture. This is a consistency opportunity, not evidence of a false claim or missing content lower on the page.

**Proposed:** Use the same primary/secondary hierarchy on solution pages and consistent mobile group sizing where both appear. Preserve scenario-aware destinations. Add a short shared present-offer trust line to the three solution heroes: Paid, bounded assessment of authorized historical inputs. No live connection or equipment control.

**Confidence:** High. **Effort:** S. **Acceptance:** Approved CTA strings remain exact and both paths are discoverable. At 320px groups fit without overlap and labels do not truncate. The current commercial scope and no-live-control boundary remain visible in each solution introduction.

<a id="a01"></a>
## A01 · Make the civic ambition a signature composition

**Routes:** /, /about. **Viewport/state:** 1440, 768, 390, 320px; normal reading.

**Screenshot evidence:** [home-1440-full.jpg](screenshots/home-1440-full.jpg), [about-390.jpg](screenshots/about-390.jpg).

**Classification:** observed condition; proposed improvement is a design hypothesis.

**Observed:** The homepage already contains a neighbor/stewardship paragraph. It shares space with the assessment mechanism and has no dedicated site–grid–community composition. About also states the ambition.

**Proposed:** Replace and expand that paragraph with the approved mission, a static architectural SVG and three responsibilities. Connect it immediately to the paid historical-input assessment.

**Confidence:** High observation / medium design. **Effort:** M. **Acceptance:** Within a 60-second read, an unfamiliar reviewer identifies both the civic ambition and the current paid assessment. All three responsibilities are visible at 320px, with no implication of delivered grid or community benefits.

<a id="a03"></a>
## A03 · Give proof and platform the right visual subjects

**Routes:** /, /proof, /platform. **Viewport/state:** 1440px at #evidence and 390 and 320px normal reading.

**Screenshot evidence:** [home-evidence-1440.jpg](screenshots/home-evidence-1440.jpg), [proof-390.jpg](screenshots/proof-390.jpg), [platform-390.jpg](screenshots/platform-390.jpg).

**Classification:** observed condition; proposed improvement is a design hypothesis.

**Observed:** The proof card shows a cooling assembly; platform reuses the construction still. Neither subject explains the distinction between proposed action, constraint check and authority.

**Proposed:** Use a static modeled-result → human/business-review → separately bounded operating-permission diagram, with a visible gap and labeled gate before permission. Use a whole-system bounded facility subject for platform and keep the brief a faithful nonnumeric HTML excerpt.

**Confidence:** High observation / medium design. **Effort:** M. **Acceptance:** All five card subjects are distinguishable at actual size. The proof diagram implies reviewable evidence, not execution; platform visibly says in development.

<a id="a02"></a>
## A02 · Differentiate the two buyer thumbnails

**Routes:** /. **Viewport/state:** 1440px at #solutions; all four homepage widths.

**Screenshot evidence:** [home-solutions-1440.jpg](screenshots/home-solutions-1440.jpg), [home-390-full.jpg](screenshots/home-390-full.jpg).

**Classification:** observed condition; proposed improvement is a design hypothesis.

**Observed:** AI cloud and colocation use the same construction still with different object positions. Source and live image URLs corroborate the repetition.

**Proposed:** Create a close compute/rack subject and a wider tenant-capacity hall subject. Use common lighting/materials with distinct silhouettes in 16:10 apertures.

**Confidence:** High. **Effort:** M. **Acceptance:** Two reviewers correctly match each uncaptioned image to its art brief at 160×100 and 320×200; no same-scene recrop. Keep exactly two buyer cards.

<a id="a12"></a>
## A12 · Make the platform direction graspable in one figure

**Routes:** /platform. **Viewport/state:** 390px and 1440px normal reading.

**Screenshot evidence:** [platform-390.jpg](screenshots/platform-390.jpg), [platform-1440.jpg](screenshots/platform-1440.jpg).

**Classification:** observed condition; proposed improvement is a design hypothesis.

**Observed:** The first screen relies on prose, and the phone H1 splits control- and plane across lines. The development boundary is visible and must remain so.

**Proposed:** Improve heading measure without shrinking it excessively; add a static intended-loop figure after the introduction with visible authority boundary.

**Confidence:** High observation / medium design. **Effort:** M. **Acceptance:** At 320px the title reads naturally and the figure works as stacked HTML/SVG. A reader distinguishes present assessment from intended control plane without opening a disclosure.

## Review structure and second pass

The lead inspected the live composition and produced the capture/color/backlog evidence. Independent reviewers examined narrative/community meaning, research rigor, and technical production. Their second pass exchanged responsibilities: the research reviewer challenged the narrative, the technical reviewer checked research delivery and metadata, and the narrative reviewer challenged the production/art contract. See [research cross-review](cross-review-research.md), [technical cross-review](cross-review-technical.md), and [narrative cross-review](cross-review-narrative.md).

Operator, utility-planner and resident perspectives in the design specification are explicitly simulated critique exercises. They are not interviews, independent community consultation, or evidence of stakeholder acceptance. Reviewer preference for the written direction does not prove the as-yet-unrendered thumbnail family is distinguishable. The actual-size blind thumbnail test is a future production gate.

## Verification limits and open release concerns

The release record reports a post-merge WebKit disclosure-control failure on two attempts, and a mobile Home median LCP of 2503.1661ms against a 2500ms gate. These are historical recorded failures, not fresh measurements from this audit. No GPU render or browser performance run was launched here. Do not round the LCP down to a pass or infer that the current deployment is fully green.

The 200% enlarged-text attempt did not produce a verified capture: the in-app shortcut left the viewport/font unchanged, and native Chrome review was interrupted by user activity. Testing stopped instead of operating the user’s active page. Enlarged text remains pending. Existing source/tests inform the proposed keyboard, reduced-motion, no-JavaScript and failed-media requirements; they were not freshly executed as a full live state matrix. Screen-reader and physical-device checks remain pending. No form was submitted.

All requested audit/specification artifacts are provided. The enlarged-text browser check and future acceptance tests are explicitly outstanding; the review is not a claim of complete accessibility or performance conformance.

## Release acceptance for the later implementation

Use the route-specific gates and exact npm scripts in [technical-production.md](technical-production.md). Preserve homepage budgets of 4MiB desktop/2MiB mobile and ordinary-route budget 1.5MiB, initial client JS at most 180KiB Brotli, general LCP at most 2.5s and CLS at most 0.1, plus stricter existing route gates. Civic/research components add zero initial client JavaScript. Performance runs must be isolated from GPU rendering.

Retest keyboard focus, disclosures in all supported engines, reduced motion, no-JavaScript reading, failed media, 320px reflow, 200% text, 400% zoom and physical devices. Run the existing lint, typecheck, build, unit, browser, publication and cinematic suites appropriate to the later code changes. Preserve CTA helpers, published records and media hashes. No backend or assessment-schema changes are proposed.
