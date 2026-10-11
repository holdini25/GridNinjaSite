# Independent narrative and art cross-review

Reviewed 10 October 2026. Reviewer role: narrative, buyer clarity and civic accountability. Primary target: [technical-production.md](technical-production.md), checked against [design-specification.md](design-specification.md), [research-matrix.md](research-matrix.md), the source-pinned release and the previously inspected live screenshots. This is a second-pass critique of the proposed specification, not approval of implemented artwork or a completed accessibility/performance test.

## Decision

The production direction is compatible with the intended brand and the assessment-first offer. The strongest choices are explicit card-to-subject mapping, retaining the existing hero player, using static explanatory diagrams, preserving published records and separating authoring hardware from visitor requirements. The second pass clarified three contracts: the brief thumbnail's amount of information, informational SVG descriptions, and semantic asset assignment. The technical owner incorporated all three and this reviewer reread the changed text. These are specification fixes with significant meaning and accessibility consequences; rendered implementation gates remain open.

## Findings and resolutions

| ID / priority | Concrete critique | Resolution and verification | Status |
| --- | --- | --- | --- |
| N1 / P1 | “HTML derived from the assessment record” did not by itself protect a small facsimile from stripping the context around MW values. A visually plausible 7.0/5.8 comparison can be mistaken for absolute site capacity or a delivered benefit if increment, reference and interval labels disappear. | Both specifications now require a **nonnumeric thumbnail**: registered ID/version, actual published title **A smaller commitment needs review**, and synthetic/no-authority label. The full worked brief retains quantities, requested/revised increment labels, common 20.0 MW reference, exact historical hour, commercial question and qualifications. Verify visible thumbnail fields and its link against the same registered B publication version; no frozen artifact is changed. | Resolved in design and technical specification; implementation test pending. |
| N2 / P1 | The earlier technical text made the civic diagram's useful text equivalent conditional. Its separate site/grid/community boundaries convey information even when the neighboring mission text remains readable. Treating it as decorative would discard meaning; exposing both responsive variants would repeat it. | Both specifications now supply one exact equivalent description and require a single assistive-technology representation. The figure caption separately states that live connection, grid service and community benefit are not demonstrated. The description is mandatory, distinct from the empty-alt default used for redundant card imagery. | Resolved in both specifications; assistive-technology check pending. |
| N3 / P2 | A generic `Record<EditorialSlot, RasterPlacement \| CodePlacement>` permits a structurally valid wrong subject in any slot. Array-order or fallback errors could recreate repeated thumbnails or place the civic drawing where proof boundaries belong. | Technical production now declares the exact semantic mapping below as an additional content invariant to validate. Review its rendered result at real card size and retain the focused mapping check; no complex generalized illustration engine is needed. | Resolved through explicit content invariant; implementation check pending. |
| N4 / P2 | Earlier production framing assigned all supporting illustrations to a WebP package and referred to the current portrait apertures. That would add unnecessary asset handling for explanations and conflict with the architectural editorial composition. | The technical owner revised the proposal: only three photographic/architectural subjects are raster; civic and proof are server-rendered SVG/HTML; the brief remains HTML. Both documents now use 16:10 card apertures, true derivative dimensions and separately composed civic layouts. | Resolved in the reviewed technical document. |
| N5 / P2 | A higher-quality renderer can make very small surface details look successful in a large export while they disappear on the actual page. Optimizing for material polish alone would leave the same buyer ambiguity. | The design requires distinct rack/colocation/system silhouettes and final-size comparison; the technical document already requires decoded WebP, mobile crops, black-level and material-color inspection. Reviewer judgment must decide whether the **subject and decision** are clearer, not just whether the render has more detail. | Required future art gate; not tested on new assets. |
| N6 / P1 | Peer review is not evidence of independence from company interests. The design originally called the proposed citation set “Independent research,” although the research matrix records company-led work and disclosed interests. | The research reviewer raised this wording issue; the design introduction now says **Peer-reviewed research helps frame the questions.** Externality, publication status and commercial independence remain distinct. Source-specific limitations stay adjacent to each homepage note. | Resolved in design; attribution to research cross-review retained. |

### Required semantic assignment

| Slot | Representation | Subject |
| --- | --- | --- |
| `buyer-ai-cloud` | Raster `ai-workload` | One rack/workload context |
| `buyer-colocation` | Raster `colocation-hall` | Multi-bay tenant/facility context |
| `proof-method` | Code `proof-boundary` | Modeled result, human/business decision, separate operating permission |
| `platform-direction` | Raster `platform-systems` | Whole facility and inside-the-fence dependencies |
| `civic-mission` | Code `civic-context` | Distinct facility, shared grid and local community |
| Existing brief card | Selector-backed HTML; outside the raster registry | Nonnumeric excerpt from the registered B publication |

The proof diagram must leave a visual gap before operating permission and label the gate. A continuous bright arrow from model output into equipment would defeat the copy even if the page retained a disclaimer. The civic diagram similarly cannot show facility-to-home export, guaranteed flexibility, heat delivery, saved water or reduced bills. This is a content rule for the actual pixels, not just a text approval rule.

The subsequently available [color/state specification](color-system.md) is consistent with this narrative contract: branded actions use orange with dark text; model states retain words/icons; paper uses its own ink/link pairs; and decorative edges are separated from essential control outlines. The rule against reusing dark-mode pastel state text on paper is particularly important for the worked brief. This pass reviewed those applications, not the arithmetic implementation. Computed contrast does not validate legibility over textured images, semantic comprehension, focus geometry or low-brightness art quality; those remain future checks.

## Buyer and community challenge

These are simulated review perspectives, **not stakeholder interviews, public consultation or evidence of acceptance**.

- **Operator:** the site must still answer “What can I buy today, what inputs do I need, and what decision will the report help me make?” The production specification correctly preserves the assessment/sample journey, fixture semantics and inquiry boundaries. Keep decorative work away from the assessment form and keep the demo decision ahead of illustration on mobile.
- **Utility planner:** “Asset for the grid” is an ambition until capability, location, duration, rebound/recovery, agreements and authority are evidenced. The technical text correctly prohibits implying existing grid service. Retain that boundary in the relationship drawing and in the research summaries; an external trial is not GridNinja performance.
- **Local resident:** an infrastructure asset can benefit an operator while imposing local burdens. The mission needs resource/amenity questions and accountable owners; a handsome town silhouette does not establish public consent or fair benefit distribution. The design's water/noise/air-quality and responsibility statements are necessary substance, not optional captions to trim for visual simplicity.

## What this review does and does not establish

- Checked specification consistency and meaning against the technical document, design document and research annotations. Previously inspected the 1440px and 390px live top captures for About, Proof, Evidence and all three buyer solution pages. Those captures show the existing site, not the new design.
- The completed capture index contains 40 route/width entries at 320, 390, 768 and 1440px with empty reported top-viewport overflow lists. This reviewer does not convert that automated observation into full-page reflow or accessibility conformance.
- Native 200% zoom was not successfully completed: the in-app shortcut did not change zoom, and the native Chrome attempt was stopped after the user switched tabs. Zoom remains pending, as do implemented-art readability, keyboard/assistive-technology and physical-device checks.
- Full-page blank areas can be deferred offscreen paint; they are not evidence of missing assets. The recorded 2,503.1661 ms LCP miss and WebKit disclosure-test failures remain visible in the technical baseline; this cross-review neither diagnoses nor clears them.
- No new artwork was rendered, no prototype was created, no production form was submitted, and no product, registry, publication or deployment was changed. The M5 runbook is a future authoring method; it is not a current performance result or a visitor hardware requirement.

This review accepts the **direction** with the specification clarifications incorporated and future rendered/implemented checks still required. It does not award a finished-design, stakeholder, accessibility or release approval.
