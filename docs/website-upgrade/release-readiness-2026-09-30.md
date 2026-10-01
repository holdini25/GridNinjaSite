# GridNinja release readiness — 30 September 2026

The scoped local fixes pass the validation below. This is a reviewable local
candidate, not a declaration of complete release readiness or a deployment.
The remaining work is to integrate the patch into the release branch, test that
revision in CI, and explicitly resolve the unperformed release reviews and any
desired hosted contact-delivery rehearsal.

## Candidate and scope

- Repository: `holdini25/GridNinjaSite`; draft [PR #3](https://github.com/holdini25/GridNinjaSite/pull/3).
- Base: `b06fa6a4e99a6461e5f0d3ded4bf262aa598b062`.
- Local branch: `codex/release-readiness-20260930`, in the task's isolated
  `GridNinjaSite` clone. Changes are uncommitted and have not been pushed.
- Final production build ID: `F8PEulrLw1VPsHUByB-LS`; recorded application source
  digest prefix `b247fda29559`. Node 22.23.2 / npm 10.9.8.
- The original main checkout and cinematic release worktree were preserved.
  No production configuration, registered media or published assessment changed.
- The owner-selected scope remains the cinematic upgrade using the current
  production contact backend. The deferred enterprise monitoring system is not
  being reintroduced as a requirement for this visual release.

## Fixes

1. **Background explicit 3D activation.** A deep link opened in a hidden tab could
   start acquisition and exhaust the first-frame deadline without presenting a
   frame. Initial activation now waits for both the observed and actual document
   visibility. It still honors the original deep-link intent when foregrounded;
   it does not require intersection before hash alignment or change the deadline.
   Two unit regressions and a real headed Chrome background-tab test cover this.
2. **Staging intake canary.** The test used obsolete form labels and could silently
   skip without a database. It now uses current fields, fails incomplete setup,
   requires an explicitly authorized staging origin and single test recipient,
   rejects production origins and navigation/contact redirects, and preserves the
   form's minimum interaction age. Provider acceptance is named accurately; it is
   not proof of inbox delivery. No canary submission was made.
3. **Review screenshots.** Mobile full-page captures showed blank offscreen
   sections because the review helper did not include the cinematic homepage's
   content-visibility selectors. The helper now visits and paints those sections,
   supports mobile WebKit without mouse-wheel input, preserves layout dimensions,
   and restores temporary capture styles. This changes review evidence only;
   screenshot paint overrides must not be used as performance evidence.

## Release criteria and current result

| Criterion | Evidence | Status / remaining action |
| --- | --- | --- |
| Exact candidate identified; existing work preserved | Base SHA and isolated branch above | Pass locally |
| Build, types, lint, brand and publication contracts | Final build, lint, typecheck, brand logs | Pass locally |
| Unit and database behavior | 1,086 unit tests; three isolated PostgreSQL integration tests | Pass locally; no deployed database claim |
| Navigation, inquiry UX and narrow/reflow layouts | Selected production-build Chrome and mobile WebKit tests; native/IAB inspection | Pass within recorded coverage |
| Reduced motion, no-JS, poster/error recovery and 3D lifecycle | Existing selected regressions plus new native visibility test | Pass within recorded coverage |
| Performance and asset transfer | Local initial-JS budgets pass; base head's complete CI/Lighthouse evidence | New patch still needs release CI; no new physical-device performance qualification |
| SEO/indexability | Source/build validators; parent's live production HTTP sample | Pass in those scopes; production and local candidate are different revisions |
| Hosted inquiry provider acceptance / actual recipient receipt | No submission authorized or performed in this task | Unverified here; current contact backend retained |
| Physical phones, screen reader and independent human craft/usability | Not performed in this task or recorded base qualification | Open evidence gaps; do not call them passed |
| Production deployment | No push, merge or deploy | Not performed |

## Exact local validation

Evidence below lives in `build/qa/release-readiness-20260930/`.

| Check | Result | Artifact |
| --- | --- | --- |
| `npm run lint` | Pass, including new native regression | `release-lint.log` |
| `npm run typecheck` | Pass | `release-typecheck.log` |
| `npm run brand:check` | Pass | `brand-check.log` |
| `npm run test:unit` | 113 files, **1,086 tests passed** | `release-unit.log` |
| Required schema integration, isolated local PostgreSQL 16 | **3 passed**, cluster removed; external traffic false | `isolated-database.log`, `isolated-database.json` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA npm run build` | Pass, including pre/post validators and 11 available facility releases | `final-build.log` |
| Selected Chrome stable + mobile WebKit production regressions | **73 passed, 10 deliberate profile skips, one browser-launch crash** | `final-browser.log`, `final-browser.json` |
| Isolated rerun of the crashed WebKit autofill case | **1 passed**, no code change | `webkit-autofill-retest.log/json` |
| Touch desktop and reduced-motion navigation, Chromium desktop | **2 passed** | `navigation-extra.log` |
| Real headed Chrome background explicit deep link | **1 passed** | `native-visibility-final.log/json` |
| Canary configuration/list-only checks | Valid config lists one test; missing DB, missing email, production origin and origin mismatch fail before browser execution | Agent-run checks; guard cases also covered in the unit suite |
| `git diff --check` | Pass | Final local check |

The selected final-build browser cases total **77 passing cases across these
runs**, not one uninterrupted green run. The one failure was WebKit's native
`Pure virtual function called` abort before creating a browser context, rather
than a failed application assertion. Its original log and trace remain preserved.
The ten skips are six desktop-only navigation cases on mobile plus two cases
restricted to Chromium desktop skipped in each of the two main profiles; those
two were subsequently run on their intended profile.

The native background regression observed **9,027 ms hidden**, poster retained,
no canvas/failure and zero GLB requests. Foregrounding reached ready without an
extra click or retry, requesting exactly one `facility-v12/facility.glb`.

Initial JavaScript including shared framework was 117.3 KiB Brotli for home,
136.4 for assessment, 129.5 for demo and 134.9 for contact, all below the existing
180 KiB limits. This is transfer-budget evidence, not a new LCP benchmark.

The main browser command used `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000` and
`CINEMATIC_E2E=1`, running `navigation`, `lead-forms`, `contact-layout`,
`cinematic-home`, `cinematic-visual` and `experience-rc` specs with
`--project=chrome-stable --project=webkit-mobile --workers=2`. Inquiry endpoints
and Turnstile were mocked in those tests; no live lead was submitted.

Earlier sandboxed tests that needed local sockets failed with `EPERM`; authorized
loopback-only reruns passed. Earlier mobile capture attempts and intermediate
type failures were corrected, and their logs remain for context. The final
screenshots below supersede the earlier images with unpainted sections.

## Rendered observations and screenshots

The Mac's installed Chrome 154.0.8037.59 and Safari 27.0 were inspected using native
computer-use tooling, alongside responsive inspection in Codex's in-app browser.
The current layout, typography, amber accents and evidence-card containment are
coherent. Native Chrome reached ready 3D. Native Safari also showed a ready,
balanced-quality canvas and readable equipment/decision detail in the read-only
local diagnostic view at 23:37:24 UTC. The diagnostic script observed state only;
it did not simulate visibility. This is one native observation, not a full Safari
or hardware qualification. A later direct background navigation retained its
poster, consistent with the revised visibility gate.

The historical low-resolution-mobile concern is not assumed to remain: the
current cinematic mobile poster is 768×576 and the demo poster 680×510. The
inspected assets and narrow layouts are usable. Further lighting/reflection
changes would be aesthetic iteration, not repair of a demonstrated release
failure. No new assets, Figma files or broad visual redesign were needed.

- [Desktop home, Chrome](../../build/qa/release-readiness-20260930/screenshots/home-desktop-chrome.png)
- [Full mobile home, WebKit at 390px](../../build/qa/release-readiness-20260930/screenshots/home-mobile-webkit.png)
- [Full mobile home, Chrome at 390px](../../build/qa/release-readiness-20260930/screenshots/home-mobile-chrome.png)
- [Native Chrome foreground 3D](../../build/qa/release-readiness-20260930/screenshots/native-chrome-foreground-ready.png)
- [Evidence cards at 320px](../../build/qa/release-readiness-20260930/screenshots/evidence-320-webkit.png)

## High-yield story and visual opportunities

These are nonblocking editorial/design judgments grounded in the current rendered
pages and source, not measured conversion results or independent human approval.
The existing product direction and truth labels should remain intact.

| Priority / placement | Observation and bounded change | Impact / effort | Evidence |
| --- | --- | --- | --- |
| 1 — Home hero | “Understand your capacity. Know the limits.” is clean but broad. Name the next AI workload or tenant commitment in the opening sentence, then the paid assessment and output. Avoid promising unlocked MW or operating safety. | High clarity / low | Desktop and mobile home; `facility-hero.tsx:24`, `cinematic-home.ts:3–6` |
| 2 — `/assessment`, before the form | Mobile places the form before the explanatory aside. Add a compact “You receive” summary and sample link before the ask: decision brief, supporting record, conditions/evidence gaps and review. Keep agreed pricing/schedule. | High comprehension / low–medium | Mobile IAB inspection; `assessment/page.tsx:13–15` |
| 3 — Assessment-bound CTAs | Several actions still say “Contact Us” while home/header say “Scope an assessment.” Standardize assessment-bound labels, preserving general contact/partnership intent. Check mobile wrapping. | Medium / very low | Assessment hero, shared `decision-page.tsx:29,41`, demo final CTA |
| 4 — Home “Engineering you can inspect” | Three cards have equal weight, with future architecture/method before the sample. Lead with the versioned brief; make “Sample output”, “Evaluation method”, “Platform direction” clear at ordinary reading size. Preserve synthetic/in-development labels. | Medium–high / low–medium | Mobile evidence screenshots; home `page.tsx:78–91` |
| 5 — Home facility and `/demo` | Power/Cooling/Workloads identify objects; the link to 7.0/5.8 MW is less explicit. Add one bridge sentence and surface the existing “Follow one workload” journey. State that the authored assessment record supplies the result; the render is illustrative. | Medium / medium | Home + native 3D screenshot; `assessment-preview.tsx:66` |

Start with 1–3, then ask an unfamiliar reader: What problem is this for? What do
I receive? Is this a customer result? What happens when I click the main action?
Use those answers to decide whether 4–5 need a larger change.

### Stewardship as the purpose

Frame the ambition as **helping data centers become better neighbors and
responsible stewards of shared infrastructure**. The narrative can move through
community → grid → facility → rack → decision without implying today's
assessment models all of those layers. Pair the purpose with the concrete offer;
do not replace the offer with an abstract mission headline alone.

- **Home, after the concrete offer:** “Data centers share infrastructure with the
  communities around them. Our ambition is to help operators make capacity
  commitments with clearer evidence about demand peaks, ramp rates and facility
  limits.” This remains a draft purpose statement.
- **Assessment, alongside scope/inputs:** Add “Responsibilities within scope”:
  agree which peaks, ramp rates, thermal limits and operating boundaries the
  decision must respect, then record supported conditions and unresolved
  questions. Include each condition only when the authorized inputs and method
  support it.
- **Evidence/proof, near operating permission:** Explain that a modeled facility
  result establishes neither community benefit nor authority to change
  operations. Affordability, water and wider grid-impact claims require their own
  evidence, scope and review.
- **About, development direction:** “We want growing data centers to be
  responsible stewards of the infrastructure they share.” Follow with today's
  bounded service and future-capability distinctions.

“More useful compute. Greater responsibility to the grid.” is a possible purpose
line to test alongside the offer, not an established claim about measured
outcomes. Keep public language constructive; the user's “liabilities or acne”
framing communicates the concern but need not appear in marketing copy.

## Existing external evidence and remaining work

The parent independently verified all 14 jobs green on base `b06fa6a`, including
six browser profiles, integration, audit, SEO, build and Lighthouse; facility
functional/transfer checks and all 30 Lighthouse measurements passed, and Vercel
preview succeeded. Hardware qualification was explicitly skipped.
[CI run](https://github.com/holdini25/GridNinjaSite/actions/runs/36506602976),
[facility run](https://github.com/holdini25/GridNinjaSite/actions/runs/36506602850).
These results do not automatically qualify this uncommitted patch.

The parent's live production GET sample at 23:10–23:11 UTC found no canonical or
indexability blocker: apex HTTPS, redirect path/query preservation, public
home/assessment/contact/evidence self-canonicals, robots and 18-route sitemap.
The versioned synthetic brief intentionally remains noindex and outside the
sitemap. HTTP www has two redirect hops, an optional optimization. This was a
sample, not a crawl, Search Console audit, form test or preview verification.

Before claiming complete release readiness:

1. Review/apply this local patch to the intended release branch and run the
   required CI on that exact revision; preserve the distinction from the old
   green head. Update the stale PR status description only when authorized to
   edit the PR.
2. Complete or explicitly accept the scope of the unperformed physical-phone,
   screen-reader and independent human craft/usability reviews. Agent review and
   emulated profiles do not substitute for them.
3. If hosted inquiry assurance is required for launch, authorize a staging target
   and disposable test recipient, configure the documented canary, and verify
   provider acceptance separately from actual inbox receipt. No credentials or
   external submission were needed for this local repair.
4. Deployment requires separate authorization in this task. No push, merge,
   deploy or live contact submission was performed.
