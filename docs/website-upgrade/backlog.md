# Delivery backlog and traceability

Canonical scope: [implementation plan](implementation-plan.md). Verification definitions and current evidence: [validation and release](validation-and-release.md). E = engineering; C = commercial/content/review. Hours are the accepted planning forecast, not elapsed implementation time. Rows that span A/B include shared work only once; release totals below allocate those hours between the two releases.

| Ticket / requirement | Outcome; concrete modules and dependency | Acceptance / verification | Owner; E / C hours | Release; risk and fallback |
| --- | --- | --- | --- | --- |
| B01 / O01–O09 | Baseline documented; repository, prior browser reproduction, contact and deployment inventory → implementation-plan.md | Current facts separated from unverified; T12,T22 | E + release owner; 4–6 / 2–3 | A; inaccessible providers → record pending |
| B02 / O01,O03,O07 | Withhold unsupported claims; `src/seo/{claim-registry,evidence-registry}.ts`, `components/seo/public-claim.tsx`; depends B01 | Explicit permitted surfaces, maturity and caveats; T11,V10 | C accountable, E enforcement; 3–5 / 8–12 | A; missing source → omit claim |
| B03 / O04,O05,O08 | Assessment-first information architecture; `content/{nav,site,copy/assessment,copy/decision-pages}`, SEO manifest; depends B02 | One offer and CTA; T12,V01 | C + E; 2–3 / 5–8 | A; unresolved strategy → current-offer facts only |
| B04 / O09 | Responsive foundations, shared section/card/nav; `components/layout`, `marketing/{hero,assessment-cards,decision-page}`; B03 | Keyboard, contrast, 320–1440 reflow; T17–T19 | E + C; 7–10 / 2–3 | A; density → simpler static layout |
| B05 / O03,O04,O07–O09 | Seven-section home and assessment; `app/(marketing)/{page,assessment/page}.tsx`; B03,B04,B06 | Decision, deliverables, effort, scoping visible; V01,V02,T16 | E + C; 9–14 / 6–10 | A; absent biographies → transparent development status, gate remains |
| B06 / O01,O02 | Coherent B summary in one record; `content/assessments/fixtures.ts`, `components/assessment/assessment-summary.tsx`; B09 core | 7.0→5.8 revision, distinct identities and review question; T03,T04,T06–T08 | E + C; 4–6 / 3–5 | A; uncertainty → no-proof |
| B07 / O06 | Shared inquiry/receipt; `components/forms`, validators, lead normalization, contact/thanks, minimal API; B03 | Strict durable success, optional v2 message, fixed submission ID/business payload with refreshable Turnstile verification, no contact fields in storage; T13–T16,V05 | E + contact owner; 12–20 / 3–5 | A; unavailable service → preserved input and honest recovery |
| B08 / O05 | Evidence maturity and gated resources; SEO resource component, evidence registry, private `evidence-candidates`; B02 | Unpublished files not public or traced; T11,T20,V10 | E + evidence owner; 6–10 / 4–6 | A/B; no reviewed evidence → synthetic example only |
| B09 / O01,O02 | Shared domain and selectors; `types/assessment`, schema, `lib/assessment`, fixtures; B02 | Cross-field, identity, missingness, conservation; T01,T03,T04,T06–T08 | E + technical reviewer; 10–16 / 3–5 | A core/B full; contradictory input → visible unavailable |
| B10 / O02 | Explorer, perspectives and matching links; `/demo`, `components/assessment`; B09,X01 | All 16 transitions, reset/history, no stale favorable state; T02,T05,T09,T10,V04 | E + C; 12–18 / 4–6 | B; client unavailable → SSR and direct scenario links |
| B11 / O05,O07,O08 | Supporting pages aligned; `app/(marketing)/platform,proof,solutions,about,why-gridninja,dcii`, resource templates; B03 | Current offer distinct from future authority; T12,V10 | C + E; 9–15 / 8–14 | A essential/B full; unverified competitor/company claims → withhold |
| B12 / O05 | `/roi` redirect, metadata, graph, sitemap and canonical; next.config + `src/seo`; B03,B11,X01 | One-hop308, route-specific metadata, immutable document identity; T12,T20,T21 | E + C; 4–6 / 2–4 | A/B; missing version →404 |
| B13 / measurement | Exact telemetry allowlist and vendor URL scrubbers; `lib/analytics`, observability; B07 | No arbitrary properties or URL leakage; T15,V08,V09 | E + privacy/commercial owner; 6–10 / 3–5 | A privacy/B measurement; continuity, deduplication and funnel ratios deferred, event counts only |
| B14 / buyer validation | Two research rounds and brief-only handoff; validation plan; B05,X01 | Unfamiliar buyer correctly explains decision, conditions, limits and next step; V01 | C research + E revisions; 4–8 / 8–16 | A/B, pending; mistaken interpretation → revise and retest |
| B15 / quality | Unit/browser/accessibility/publication/security/performance checks, targeted dependency patches and complete first-load script accounting; tests + CI; all implemented tickets | Required checks green; T01–T21,V02–V10; current evidence in validation document | E + reviewers; 14–22 / 5–8 | A/B; material defect → fail release |
| B16 / operations | Staging evidence, release manifest, rollback, owners; docs/runbooks; B14,B15 | Authorized canary and recovery drill completed; T22 | Release/contact/commercial owners; 6–10 / 5–8 | A/B, external pending; keep last known-good deployment |
| X01 / added publication requirement | Frozen HTML/PDF/JSON/narrative registry, routes and generator; `scripts/assessment`, `lib/assessment/{brief-template,publications}`, publication content; B09 | Same semantic record and version; pinned manifest, verified bytes and exact deployment traces; no current-template old URLs; T10,T11,T20,V03 | E + evidence reviewer; 10–16 / 3–6 | A default/B four; unavailable exact version → 404/410; registered integrity failure → 503 |
| X02 / added opportunity measure | Private cohort utility/tests + owner runbook; `lib/measurement/opportunity-cohorts`; B13 | Qualification, explicit merges, each opportunity's own 90-day endpoint, unknowns/null denominators; V06,V07 | E + commercial owner; 5–7 / 5–5 | B software complete; owner-led ledger, baseline and recurring review pending; unreconciled facts → no point rate |

Totals: engineering **127–202**, content/review **79–129**, total **206–331** focused hours. Release A allocation: E76–120 + C52–83 = **128–203**. Release B: E51–82 + C27–46 = **78–128**. Allocation reflects dependency work split across shared rows; it is not additional effort. External waiting time is excluded. At one person in each role with 6 effective hours/day, A takes at least max(E/6,C/6) = about 13–20 working days before external waits; B about 9–14. Credentials, evidence and provider access may be the actual bottleneck.

The implementation includes A/B software. B14 and B16 cannot be marked done based on code tests. Named delivery and review people, verified credentials/content, commercial ownership, operational measurement and provider approvals remain explicit gates. B13 does not include a session-linked funnel, and X02 does not include populated commercial records or observed conversion results. X01/X02 are supplemental identifiers; they do not replace missing B17/B18 definitions. Missing E01–E08 and T23–T32 are not claimed covered.

## Requirement traceability

| Source | Repository evidence / change owner | Ticket | Verification | Release |
| --- | --- | --- | --- | --- |
| O01,O02; spec9 | Previously separate trace/waterfall; one assessment snapshot | B06,B09,B10 | T01–T10,V02–V04 | A/B |
| O03,O04,O09; spec5,8 | Large synthetic KPIs/long home; seven sections and adjacent caveats | B04,B05 | T16–T19,V01,V09 | A |
| O05; spec4,7 | Overlapping proof/evidence routes; distinct tasks, registry + frozen packages | B03,B08,B11,B12,X01 | T11,T12,T20,T21,V03,V10 | A/B |
| O06; spec6 | Existing durable outbox reused; truthful receipts + optional message | B07 | T13–T16,V05 | A |
| O07; spec7.3–7.4 | No approved biographies located; bounded maturity/withholding | B02,B05,B11 | V01,V10 | A/B; credential gate |
| O08; spec6,7 | Retired ROI/calculator framing; assessment destination | B03,B05,B11,B12 | T12,V02 | A |
| spec3.3,13.3; approved opportunity metric | Analytics unsafe values removed; private cohort rules | B13,X02 | T15,V06–V08 | A/B |
| spec12–15 | Existing Playwright/Vitest/axe/Lighthouse reused | B14,B15 | T01–T21,V01–V10 | A/B |
| spec18 | Existing deployment runbook; new release gate record | B16 | T22 | A/B |

Release C defers public ROI economics, measured customer claims, partner endorsements, identity portals, authentication, live operational connections, autonomous controls and other scope requiring separate validation. No new CMS, database migration, analytics vendor or runtime UI dependency was introduced.
