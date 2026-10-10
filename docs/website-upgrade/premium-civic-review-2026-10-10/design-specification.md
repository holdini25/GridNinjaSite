# Architectural editorial design specification

Prepared 10 October 2026. **Status: proposed design specification, not an implemented or browser-tested prototype.** This deliverable completes design work within the authorized review; it does not authorize website implementation, publication, or deployment. No website source or published assessment artifact is changed by this document.

## 1. Direction, baseline, and boundaries

The selected direction is architectural editorial: predominantly dark, precise, warm in its treatment of people, and grounded in physical infrastructure. The visual story moves from the facility to its shared infrastructure, then to an inspectable decision. Light surfaces belong to decision documents; they do not become alternating full-width marketing sections.

The source reviewed here is `codex/cinematic-release` at **`bcd960db52057d768feccdefe393d6986fb9bf84`**, read without checking out or modifying that worktree. The relevant implementation is its cinematic homepage, `cinematic-home` copy/CSS, shared `DecisionPage`, and global theme. This is distinct from the older homepage on `main`. The [release record](release-record.json) maps the approved source to merge commit `e980000ea458f50662c268218791f6087f9e8ca3` and production build `4x9zp1Zusx59GVCtWyvPt`; the lead's [live response record](live-home-response.json) independently checks that build. Reconfirm that identity before implementation; similarity of source and screenshots alone does not prove a deployed Git SHA.

Source observations informing the proposal:

- The release already has the approved assessment CTAs, a neighbor/stewardship paragraph, an illustrative facility hero, two buyer cards and three evidence/direction cards.
- The lower homepage currently uses broad light sections. Its local action orange is `#FFAE55`, while the shared brand primary is `#FF9F1A`.
- Both buyer cards reuse the construction image. The proof card uses cooling hardware, which does not explain its authority-boundary subject. The paper preview uses some 5px text, so apparent detail exceeds actual-size readability.
- Existing fonts are the operating-system sans-serif and monospace stacks. Existing homepage breakpoints are 640, 820, 1120 and 1440px, with a 1280px maximum content width.

The following observations were independently checked in the actual 1440px and 390px viewport images captured for this review. They concern the current site, not a rendered concept. Full-page captures can omit offscreen lazy-loaded media; no blank image is classified as a defect here. The capture index contains 40 route/width samples at 320, 390, 768 and 1440px, with no reported top-viewport DOM overflow; that is not a full accessibility pass. Native 200% zoom remains unverified: the in-app shortcut did not change zoom, and the native Chrome attempt was stopped when the user changed tabs. No zoom pass is claimed.

| Screen evidence | Observation | Design response |
| --- | --- | --- |
| About: [desktop](screenshots/about-1440.jpg), [mobile](screenshots/about-390.jpg) | The hero already expresses the neighbor/steward ambition. Its desktop text begins noticeably farther right than “The offer today” below it. On mobile, the two stacked CTAs have different widths. | Develop accountability beneath the existing mission rather than claiming mission copy is absent. Align hero and section starts; make the stacked primary/secondary action group consistent. |
| Proof: [desktop](screenshots/proof-1440.jpg), [mobile](screenshots/proof-390.jpg) | The authority distinction is readable in prose, but the top screen supplies no visual relationship among its concepts. The same desktop hero/body alignment reset is visible. | Add the simple three-object authority diagram alongside the explanation, preserving text; align the page to one column grid. |
| Evidence: [desktop](screenshots/evidence-1440.jpg), [mobile](screenshots/evidence-390.jpg) | The mobile top 1000px is predominantly introduction and qualification; individual brief cards begin below this captured viewport. The desktop heading wraps into a narrow three-line block despite ample horizontal space. | Keep truthful qualification, add a visible “See a sample decision brief” anchor after the introduction, and give the H1 an appropriate editorial measure. Put research after the actual GridNinja examples. |
| AI Cloud: [desktop](screenshots/solutions-ai-cloud-1440.jpg), [mobile](screenshots/solutions-ai-cloud-390.jpg) | The full long H1 is repeated in the breadcrumb, which wraps on mobile, followed by a substantial empty interval. The first supporting facility subject repeats the Colocation page's subject. | Use short breadcrumb labels and a smaller explicit breadcrumb-to-hero gap. Preserve the useful synthetic entry while giving supporting art audience-specific context. |
| Colocation: [desktop](screenshots/solutions-colocation-1440.jpg), [mobile](screenshots/solutions-colocation-390.jpg) | It shares the AI Cloud page's composition, facility subject and long breadcrumb pattern. Its hero's only visible action is the assessment CTA. | Keep primary emphasis and provide the approved sample link consistently without adding another visual card. Distinguish the colocation subject and reviewer question. |
| Bridge Power: [desktop](screenshots/solutions-bridge-power-1440.jpg), [mobile](screenshots/solutions-bridge-power-390.jpg) | Both CTAs are visible. The first body section correctly emphasizes that an option is not an assessed recommendation; the long mobile breadcrumb repeats the same pattern as the other solutions. | Preserve this substantive boundary and give local-impact questions explicit supporting space. Use the common shorter breadcrumb treatment. |

Preserve the present offer: a bounded, paid capacity decision assessment using authorized historical inputs. Keep **Scope an assessment** and **See a sample decision brief** exactly, including their existing journey helpers, scenario/version parameters, source attribution and destinations. Preserve the phrase **Proof before autonomy** and the development category **AI Data Center Virtual Capacity Control Plane** / **runtime-assured virtual capacity engine**.

All facility and public assessment examples remain synthetic. Economics are unestimated; accepted/delivered capacity is not applicable; no operational authority is granted. Keep these qualifications adjacent to the relevant numbers and visuals. Do not alter immutable versioned brief bytes, downloads, redirects, publication states, or withheld resources. Grid services, local-impact studies and community benefits are not additional included assessment deliverables.

## 2. Homepage sequence and exact copy

Use the following order. The civic composition replaces and expands the current purpose paragraph; the mechanism stays directly after it. This adds one coherent mission treatment, not a second sales journey. All surrounding section surfaces are dark.

| Order | Block | Composition and content decision |
| --- | --- | --- |
| 1 | Hero | Preserve the current two-column offer/facility composition on desktop, stacking offer first below 820px. Retain illustrative-media controls and the selector-backed synthetic summary. Do not increase hero media complexity. |
| 2 | Our ambition | A large editorial sentence, the site–grid–community composition, and three responsibility statements. Details are specified below. |
| 3 | Assessment mechanism | Three numbered steps on a quiet dark field. Use existing mechanism icons with the shared palette; no new animation. |
| 4 | Worked decision | Dark explanatory column beside one light document inset. This is the principal light pause in the page. |
| 5 | Buyer fit | Keep the existing two cards and destinations. Give each a distinct thumbnail; do not add more buyer cards. |
| 6 | Inspect the basis | Keep three existing cards with distinct subjects: brief, proof boundary, platform system. Add a compact external-research reading strip after the development paragraph, not a fourth card. |
| 7 | Assessment scope | Keep the present “You bring / You receive” structure, on dark graphite with rules and generous spacing. |
| 8 | Invitation and footer | One clear scoping invitation, followed by the existing navigation and present-offer/development distinction. |

### Hero — retain these words

- Eyebrow: **Capacity decisions · Proof before autonomy**
- H1: **Understand your capacity. Know the limits.**
- Body: **Review your next AI workload or tenant commitment against declared facility limits. GridNinja offers a paid, bounded assessment of authorized historical inputs, with a decision brief, supporting model record and unresolved questions for review.**
- Primary: **Scope an assessment**
- Secondary: **See a sample decision brief**
- Trust line: **Historical inputs. No live connection or equipment control.**

At desktop widths, keep the existing intentional break between the two H1 sentences. Below 640px, permit natural wrapping within each sentence. Do not insert extra mobile line breaks or reduce the H1 merely to fit a particular screenshot.

### Mission — approved aspiration and supporting copy

Use the following sentence verbatim as the mission heading; “Our ambition:” is part of the visible sentence:

> Our ambition: data centers that become dependable assets for grids and accountable neighbors in their communities.

Supporting paragraph:

> Data centers share power systems, local resources and places with the people around them. Becoming a dependable asset requires evidence of what a site can do, where its limits lie, and how its decisions affect others.

Present-offer bridge, immediately after that paragraph and before the illustration:

> Today, GridNinja starts with one capacity commitment: a bounded assessment of authorized historical inputs, with the modeled result, its conditions and evidence gaps open to review.

Three responsibility statements follow the illustration as a single ruled editorial row, not a card grid:

| Label | Exact text |
| --- | --- |
| **Respect grid constraints** | Identify the relevant grid constraints, the responsible operator, and the evidence needed before any flexibility commitment. |
| **Examine local impacts** | Make water, noise, heat and air-quality questions visible where relevant. Any claimed local benefit needs its own assessment. |
| **Make responsibility explicit** | State who decides, whose interests are affected, what remains unknown, and who is responsible for follow-up. |

Boundary sentence beneath that row:

> These principles guide the development direction. Grid-service delivery, local-impact studies and community-benefit claims require their own scope, evidence and authority.

Use one understated text link, **Why this matters**, to `/about#shared-infrastructure`. It is subordinate to the assessment CTAs. Do not add a community-interest form, new navigation category, civic score, or benefit counter.

### Mechanism — preserve the current three steps

H2: **From physical constraints to inspectable decisions.**

1. **Model the constraints** — Bring the workload, power, cooling and reserve conditions into one bounded assessment.
2. **Check the request** — Compare the proposed profile with the declared limits, evidence quality and time window.
3. **Inspect the evidence** — Review the result, its assumptions and the business question that still needs an answer.

### Worked decision — preserve semantics, improve presentation

Eyebrow: **A worked decision · synthetic**. H2: **The limit is a finding. The commitment is a decision.** Body: **Fixture B records a proposed increment and a smaller modeled revision. The next question belongs to the service and commercial decision owner.** Supporting line: **A useful assessment can also return a negative result or identify missing evidence.** Link: **Compare the four scenarios**.

Keep the document inset driven by the existing record and selectors, not copied numeric strings. For the reviewed B version, its content remains the 7.0 MW requested increment and 5.8 MW modeled revision, the 20.0 MW reference and exact historical hour, and the unresolved commercial question. The label **REPAIR** means a model screen, not a completed repair. Retain the full synthetic/economics/acceptance/authority qualification and matched HTML/PDF links. The light inset is live marketing UI; it does not authorize restyling a frozen publication.

### Buyer, evidence, scope and final blocks

Retain the release's buyer headings **Admit the next AI workload.** and **Commit colocation capacity.**, audience labels, bodies and solution destinations. Retain the separate note that cooling investment and bridge power need their own feasibility/economic scope. Art changes are specified in section 5.

Retain **Engineering you can inspect.**, the three evidence-card headings **A versioned decision brief**, **Proof before autonomy**, and **Physical constraints**, and each card's publication/development label. Keep the category/development paragraph and the honest statement that public team credentials/customer outcomes are not yet published.

The added research strip uses the heading **Research informing the direction** and the exact introduction: **Peer-reviewed research helps frame the questions. It does not validate GridNinja's models, demonstrate customer outcomes, or confer operating authority.** Show three short, stacked linked entries identified by topic, paper title and venue/year, in this order: `colangelo-grid-assets-2026`, `senga-flexibility-tradeoffs-2026`, `siddik-water-footprint-2021`. Copy each note, adjacent limitation, title and DOI from the [research matrix](research-matrix.md); do not replace its limitations with a generic footer. Keep the exact footer **External research informs the direction. GridNinja currently offers bounded assessments using authorized historical inputs.** A final **Read the research and its limits** link leads to `/evidence#research`. This is a text reading strip with rules, not journal logos, numerical impact badges, or a new carousel. Peer review does not imply independence from commercial interests; disclosures remain in the fuller research notes.

Retain the current scope title **One question. A reviewable answer.**, current “You bring / You receive” copy, data-sharing warning and deliverable links. Retain final title **Start with your operating constraints.**, body **A scoping conversation establishes fit. Paid work starts only after agreement.**, and primary CTA **Scope an assessment**.

## 3. Site–grid–community composition

Create one original, static, code-native SVG with HTML labels and caption. Use the site's architectural language: orthographic/axonometric volumes, precise linework, graphite materials, restrained amber accents and substantial empty space. This is a conceptual relationship drawing, not a physical site map, operating diagram or new simulator.

**Desktop composition:** on a 1280 × 560 authoring viewBox, place the illustrative facility at left, shared substation/feeder in the center and modest town/civic-building silhouettes at right. Keep the shared grid node visually upstream of both the facility and community branches. Draw neutral, undirected relationships; no arrows, animated particles, export meter, energized homes or implied power delivery from the facility. The site boundary encloses only facility equipment. The community is outside that boundary. Keep top-down spatial logic legible without extra decorative pylons or skyline detail.

Use three HTML labels aligned with the zones: **Site conditions**, **Shared grid infrastructure**, **Local community**. The site label has subordinate text **Illustrative assessment boundary**. The illustration caption reads: **Conceptual infrastructure relationships. No live connection, grid service or community benefit is demonstrated.** Necessary conceptual relationships have visible lines and the caption has normal text contrast. No essential label is baked into a raster image.

**Mobile composition:** use a separately composed 400 × 440 SVG viewBox. Stack the shared-grid node above two clearly separated site/community zones. Reposition the same elements; do not crop the desktop image. All three labels remain visible at 320px viewport width. Responsibility statements then stack in DOM order with top rules, 24px gaps and no connector lines behind text. Both visual variants expose one equivalent description to assistive technology; the hidden variant must not duplicate content. Required description: **Conceptual shared infrastructure: a data center and local community are separate participants connected to a shared grid. The marked site boundary covers the illustrative facility, not the grid or community.** The adjacent caption retains the no-demonstrated-service/benefit boundary.

The diagram must never depict a waste-heat supply, BESS export, grid-support dispatch, public savings or environmental improvement as established. These may appear only as separately scoped future questions in supporting copy, not as connected system components. No leaves, globe, green halo, civic seal or customer-like place name. Public landscapes are generic illustrations, not representations of a real project or community endorsement.

## 4. Layout, typography, and color application

### Responsive geometry

Values are CSS design dimensions at default browser settings; normal page zoom and text enlargement must remain effective. Preserve the existing fluid root size and system font stacks. Typography values below describe target sizes, not permission to shrink inherited readable text; implementation should use rem/em-based equivalents and fluid interpolation without overriding user scaling. Do not import a display font or add a font request.

| Rule | Mobile: below 640px | Small tablet: 640–819px | Tablet/small desktop: 820–1119px | Desktop: 1120px and above |
| --- | --- | --- | --- | --- |
| Content inset | 20px; 16px at 320–359px | 24px | 32px | 48px; content max 1280px |
| Section spacing | 56px block padding | 64px | 80px | 96px; hero may use its existing compact vertical treatment |
| Column gap | 24px | 32px | 32px | 48px; 56px at 1440px+ |
| Hero | One column; text, actions, trust, media, record | One column | Two columns, 46%/54% of remaining width | Two columns, 46%/54% of remaining width |
| Mission | Heading, paragraphs, mobile figure, three stacked statements | Same order, mobile figure capped at 560px | Heading/paragraphs full width, desktop figure, three statements | Same; heading max 1050px, paragraphs max 760px |
| Worked brief | One column; paper inset full content width | One column | Two columns, 42%/58% of remaining width | Same; document padding 32px |
| Buyer cards | Two stacked cards; image above copy | Same | Two columns; image above copy | Two columns; image above copy |
| Evidence cards | Three stacked cards; image above copy | Same | Three stacked rows; image 40%, copy 60% of remaining width | Three columns; image above copy |
| Scope | Single column; labels above definitions | Single column | Two columns | Two columns |
| Primary action | Full width, minimum 48px height | Natural width, minimum 48px | Same | Same |

Use a single 8px spacing rhythm with 4px for fine alignment: 8/12/16/24/32/48/64/80/96. Keep content measures around 60–68 characters for body text and 46–56 characters for lead paragraphs. Do not enforce fixed card body heights or truncate text to equalize boxes. Align card bottoms through grid structure where possible, preserving content at zoom. Use 8px card/document corners, 6px button corners and thin dividers; avoid oversized pill containers.

On supporting pages, left-align a maximum 900px hero text block to the shared content container; do not center that narrower block independently of the following sections. Breadcrumbs share that same left edge. Use concise current-page labels **AI Cloud**, **Colocation & REITs**, and **Bridge Power & DER** rather than duplicating each H1; retain correct semantic navigation and structured-data destinations. Set the breadcrumb-to-hero gap to 40px on mobile and 48px at 820px+. On mobile, both hero CTA surfaces occupy the content width with a 12px gap. Add the secondary sample link to the AI Cloud/Colocation hero action group using the existing topic-aware helper. On Evidence, place the approved sample CTA immediately after the introduction, linking to the existing versioned sample journey.

| Type role | Mobile size / line height | Tablet target | Desktop target | Weight / treatment |
| --- | --- | --- | --- | --- |
| Hero H1 | 36 / 39px; 34 / 38px only at 320–359px | 48 / 52px | 60 / 64px | 600; tracking −0.04em |
| Mission heading | 30 / 36px | 38 / 44px | 44 / 51px | 500; tracking −0.025em; no all-caps |
| Section H2 | 30 / 36px | 36 / 42px | 42 / 48px | 600; tracking −0.03em |
| Card H3 | 23 / 29px | 24 / 30px | 26 / 32px | 600; tracking −0.02em |
| Lead paragraph | 17 / 27px | 18 / 29px | 19 / 30px | 400; regular sans-serif |
| Body text | 16 / 26px | 17 / 27px | 17 / 28px | 400 |
| Secondary/qualification | 14 / 22px | 14 / 22px | 14 / 22px | 400; never opacity-reduced to illegibility |
| Eyebrow / record label | 12 / 18px | 12 / 18px | 12 / 18px | 500–600; mono; max 0.08em tracking |
| Comparison number | 30 / 35px | 32 / 37px | 36 / 41px | 600; tabular figures; units remain adjacent |

The table deliberately removes 5–11px marketing microtext. If a decorative thumbnail cannot carry readable detail, remove detail rather than making an essential qualification microscopic. Keep body/record data as selectable HTML. Heading and link text must survive 200% text enlargement without clipping, overlap or hidden qualifications.

### Applied color theory

The companion [color system](color-system.md) and [machine-readable tokens](color-system.json) own exact swatches, state mappings, calculated contrasts and permitted text/surface pairs. This document describes their use; it does not claim those combinations have passed browser testing.

- **Hue temperature:** retain neutral black `#080808`, near-white `#F4F7FA`, and the recognizable brand orange `#FF9F1A`. Add only a subtle cool bias to layered graphite panels. Warm orange beside cool graphite gains visual separation through simultaneous contrast; the surfaces must still read as charcoal rather than a blue dashboard.
- **Perceptual lightness first:** author candidate scales in OKLCH so surface separation, text hierarchy and action emphasis can be adjusted intentionally through lightness, chroma and hue. OKLCH lightness is a design aid, not a WCAG contrast result. Ship the reviewed sRGB palette and calculate text/control contrast from those actual colors, including composited transparency.
- **Chroma hierarchy:** reserve the richest orange for the primary action and a few small directional/selected accents. Secondary links remain quieter. Avoid large orange fills, saturated underlines everywhere or hue-shifting hover effects. Hierarchy comes from relative area, placement, spacing and contrast as well as saturation.
- **Paper as figure–ground contrast:** the worked decision inset and brief thumbnail use the companion paper token, surrounded by dark space. The document is a deliberate editorial pause, not a full-width bright stripe. Use its separate ink/link/status pairs; never reuse an orange or cyan dark-mode text token blindly on paper.
- **Meaning before palette harmony:** preserve distinct accessible ALLOW/REPAIR/REJECT/NO-PROOF treatments with words and icons. Brand orange is not a success, safety or delivered-capacity indicator. Cyan is reserved for an explicit evidence/trace relationship and does not decorate headlines, lighting or generic page borders. The root color matrix resolves functional status colors independently of the artistic palette.
- **Restraint:** no neon, broad glow, bloom behind text, frosted panels or decorative gradient washes. Give a dark object readable silhouette with a controlled edge, fill light or panel lightness difference, not an oversized halo. Essential controls need their tested boundary treatment; decorative rules can be quieter.

### Motion and interactions

Keep the existing hero's explicit playback control, poster fallback and reduced-motion behavior. The civic SVG, responsibility row, research strip and five thumbnail subjects are static. Links/buttons may use 160–180ms color/border transitions, removed under reduced motion. Do not add scroll scrubbing, parallax, autoplay diagrams, new WebGL islands or movement needed to understand a claim. Preserve visible keyboard focus and a minimum 44px interactive target; the primary CTA remains at least 48px high.

## 5. Five existing cards: distinct art briefs

Retain exactly the two buyer cards and three evidence/direction cards. Replace ambiguous/repeated subjects; do not add cards. The following is an asset specification for later production, not a statement that assets were generated in this review.

**Shared treatment:** 16:10 image frame; graphite powder-coated metal, restrained amber details, neutral/cool environment and one broad soft key from upper left. Use a low-intensity opposite fill to preserve dark recesses and a clean contact shadow. Avoid dirt, random surface noise, mirrorlike metal and excessive amber edge emission. Architecture uses consistent approximately orthographic three-quarter views, around 25° elevation. Documents and proof diagrams remain more frontal for legibility; do not force them into the architectural camera. Keep 8% internal safe margins and export dedicated crops rather than scaling away the subject.

| Existing card | Subject and composition | Meaning the image must convey | Exclusions / text treatment |
| --- | --- | --- | --- |
| AI cloud — Admit the next AI workload | One detailed rack bay, with a second bay only as quiet context. Show legible server trays, front depth and a restrained amber workload marker. | A discrete workload entering a constrained facility. The rack, not a building panorama, is the recognizable subject at 280px width. | No GPU vendor logos, fabricated utilization charts or lit-up capacity bars. Caption outside image: **Illustrative AI rack**. |
| Colocation — Commit colocation capacity | A short row of bays, viewed down a clear aisle, with an architectural division indicating separately considered tenant space. | A facility-level commercial commitment and shared constraints; visually distinct from the single rack. | No tenant logos, occupied-space claims, lease figures or invented floorplan dimensions. Caption: **Illustrative colocation row**. |
| A versioned decision brief | A credible HTML facsimile excerpt of the already published B brief, composed almost frontally on the paper surface. Show **DEMO-01-B · v1.0.0**, the published title **A smaller commitment needs review**, and the synthetic/no-authority label. Omit numeric comparison content at thumbnail size. | A readable, inspectable decision document, not stationery decoration. The separate worked brief carries the detailed commercial question and quantities. | Match the registered publication; do not invent letterhead credentials, signatures, approval stamps or extra metrics. No 5px filler text or unlabeled MW. Caption: **Decision brief excerpt · Synthetic**. |
| Proof before autonomy | A crisp vector sequence of three distinct objects: modeled result, human/business review, and separately bounded operating permission. Use a visible gap before permission and label that gate. | A model result does not confer authority. The viewer should understand the separation without a tooltip. | Replace the unrelated cooling close-up. No green “approved” stamp or continuous execution arrow. Caption: **Evidence and authority remain distinct**. |
| Physical constraints — Platform direction | A whole-system facility view with rack, electrical, cooling and reserve assemblies recognizable together; sparse labels remain in adjacent HTML. | The intended inside-the-fence orchestration boundary and physical dependencies. | Do not reuse either buyer crop; no utility dispatch or shipped-integration badges. Caption: **Illustrative system · Platform in development**. |

The credible brief preview remains selector-backed HTML and must match the registered published record. Its thumbnail shows the specified faithful nonnumeric excerpt, clearly labeled as such; the separate worked brief retains the commercial question, requested-increment/modeled-revision labels, common reference/time basis and full qualifications in HTML. This intentionally avoids fitting bare capacity numbers into a small decorative document. Do not transform, overwrite or silently regenerate the frozen PDF/HTML publication. Do not substitute a rasterized page for the HTML facsimile; its record ID, version, title and synthetic/no-authority label remain real text. Add a focused consistency check that these visible fields and the destination all resolve to the same registered B publication version.

Raster subjects should have responsive 480/800/1280px-width derivatives in existing supported web formats, explicit dimensions and lazy loading below the hero. Use SVG for the proof boundary and civic composition. The release baseline and technical audit own byte/performance budgets; this design does not justify increasing initial client JavaScript or replacing the current player. Asset masters and review renders do not belong in public output.

## 6. Supporting-page integration

Add this concise present-offer trust line to all three solution heroes: **Paid, bounded assessment of authorized historical inputs. No live connection or equipment control.** The 320px second pass found this boundary explicit in some first screens but not consistently across the three routes. Keep it readable, adjacent to the offer, and subordinate to the title.

Use the same color/type/spacing system on existing pages. Preserve page-specific metadata and one H1. This is a content and presentation specification, not a new top-level page, backend API, CMS, analytics vendor or capability claim.

| Route | Precise addition and placement | Preserve |
| --- | --- | --- |
| `/about` | After “The offer today,” add a section with ID `shared-infrastructure`, H2 **Shared infrastructure creates shared responsibilities.**, the approved mission sentence, and body: **A facility's technical limits are part of the picture. Water, noise, air quality, local costs and the distribution of benefits can also matter. Our ambition requires those questions to be visible, the relevant people to have a voice, and any claimed contribution to be supported by evidence.** Follow with **GridNinja's current assessment does not establish community acceptance or public benefit. Those judgments require their own participants, evidence and scope.** Reuse the three responsibility statements, as text rows rather than another large illustration. | Current offer, honest credentials status, development direction and current CTAs. |
| `/platform` | After the intended decision loop, add H2 **Inside-the-fence decisions have an outside context.** Body: **The development direction is to examine facility decisions within explicit technical limits while making relevant grid and local constraints visible. Any future grid-facing service would require separately validated capability, agreements and operating authority.** Use a compact static boundary diagram: site evidence and proposed action inside; grid/community context outside; permissions explicit. | Telemetry → model → decide → assure → prove; intended architecture, future integration/Shadow Mode boundaries. No new supported-interface list. |
| `/evidence` | After the published synthetic assessment and its publication boundary, add `research` section **Research informing the direction**. Use the homepage introduction, then the seven-paper annotated reading list from the research matrix. Each entry separates supported idea, method/context and limitation. Keep the internal publication-gated resource index in its own subsequent section. | Available versioned GridNinja examples, permission gates and existing unavailable states. Do not turn external references into evidence-stage badges. |
| `/proof` | Introduce the same modeled-result / decision / permission visual grammar alongside “What each result means.” Retain four distinct evidence/acceptance/authority concepts in the text. | All current authority and proof-pack boundaries. |
| `/solutions/bridge-power` | Before integration readiness, add H2 **Include the local operating questions.** Body: **An on-site power option can change fuel, noise, emissions, water and reserve questions. Establish which questions apply, who is responsible for review, and what evidence a separate investigation would need.** | Bridge power remains an unassessed option. No claim of clean generation, avoided grid upgrades or community savings. |
| `/solutions/ai-cloud`, `/solutions/colocation` | Apply the shared layout and subject-specific visual language; link to existing mission/evidence context through ordinary related links. | Current buyer decisions and assessment scope; no extra civic sales funnel or new promised outcome. |
| `/assessment`, `/demo` | Apply shared reading/focus/status treatments where consistent with their functional UI. Keep the civic mission subordinate to completing and inspecting a capacity decision. | Forms, receipt semantics, selectors, all four scenarios, keyboard behavior, no-JS paths, versioned downloads and output meaning. Frozen publication output is excluded. |

External research must remain visibly external, with authors/title/venue/year/DOI and a method/limitation statement. Cite the specific paper near the claim it supports. No university logos, inferred endorsement, borrowed performance metrics or claim that a paper validates GridNinja's fixtures. Research is selected for relevance and balance rather than journal prestige. Unverified bibliography or inaccessible full-text detail must be identified rather than reconstructed.

## 7. Art acceptance and independent critique

These are **future implementation/asset acceptance checks**, not results achieved by this written specification. Review screens at their actual display sizes, not only enlarged exports.

| Check | Acceptance condition |
| --- | --- |
| Offer comprehension | A reviewer can identify the paid historical-data assessment, next CTA and synthetic status within a 60-second read. The mission does not appear to be the current commercial deliverable. |
| Civic comprehension | The three responsibilities are understandable without hovering, animation or research reading. No reasonable reading of the composition implies GridNinja supplies homes, operates the grid, or has demonstrated community benefits. |
| Distinct art subjects | At actual card size, reviewers distinguish a rack, colocation row, brief, authority diagram and facility system without relying on color alone. Reject repetitive crops and illegible fine detail. |
| Responsive craft | Review at 320, 390, 768, 1024, 1440 and 1920px, plus either side of changed 640/820/1120/1440 breakpoints. No cropped qualification, accidental horizontal scroll, orphaned action or diagram label collision. |
| Light and dark reading | At normal and manually reduced display brightness, dark materials retain meaningful depth and text remains readable. Inspect paper-inset glare and abrupt luminance transitions. This subjective check supplements, not replaces, calculated contrast. Record display and brightness setting used. |
| Grayscale / color perception | Hierarchy, controls and result states remain understandable in grayscale and common color-vision simulations because labels, shapes and positions carry meaning. |
| Accessibility | Keyboard traversal, visible focus, 200% text enlargement, 400% zoom/reflow, reduced motion, media failure and no-JavaScript states retain the essential offer and evidence. Check permitted color pairs against the companion matrix and verify rendered/composited pairs. |
| Evidence discipline | All facsimile values and publication IDs match the registered record. External research and GridNinja proof are distinguishable at a glance. No unavailable resource gains an accessible public artifact. |
| Performance | Compare actual release assets and page measures with the technical audit's baseline. Civic and supporting art are static; no added runtime is justified by production hardware. |

Independent second-pass role critiques below are **simulated evaluation prompts and design responses, not interviews, stakeholder consultation or evidence of stakeholder acceptance**:

| Simulated perspective | Strongest objection | Required design response |
| --- | --- | --- |
| Facility operator | “Does this civic ambition conceal new operational duties or imply a model can authorize my plant?” | Put the present bounded offer beside the ambition; separate modeled results, commercial decisions and permission in both copy and art. Retain useful negative/no-proof outcomes. |
| Utility planner | “Where are the location, grid conditions, committed service, duration and recovery behavior behind this claimed asset?” | Call the asset language an ambition. Show grid constraints and separately validated agreements; do not publish grid-service quantities or flowing-export imagery. External trials retain their own system and scope. |
| Local resident | “Who decided this is a benefit, and where are water, noise, costs and our ability to question it?” | Say accountable neighbor, expose relevant impacts and responsible decision owners, and acknowledge that community acceptance cannot be declared by an operator or software vendor. Avoid idealized community imagery and benefit counters. |

The final implementation review should record disagreement between these perspectives rather than average it away. An attractive composition fails if it obscures a material limit. Conversely, accurate caveats do not excuse unreadable typography or a mission hidden in fine print.

## 8. Handoff definition

This document fixes the design direction, wording, sequence, responsive rules and art briefs. The companion color matrix fixes palette/state pairs; the research matrix fixes approved source-specific citation wording; the audit fixes observed defects and priorities. Browser screenshots in this review depict the current site, not this proposed design.

No concept screen, prototype, rendered new asset, usability result, measured conversion improvement or stakeholder approval is claimed. A subsequent implementation must reconcile the actual deployed source, create and inspect the prescribed art, preserve publication contracts, and run the existing relevant npm checks before any release decision. This review does not merge, commit, deploy or publish that implementation.
