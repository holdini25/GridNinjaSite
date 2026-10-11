# Premium civic implementation: participant validation

Status on 10 October 2026: **planned, not conducted**. Twelve buyer/evaluator sessions and four separate grid/community sessions remain pending. The user is the recruitment, editorial and commercial owner and will recruit through their network. No outreach has been sent by this implementation team. The available physical device is the user's iPhone with Safari; its review is pending. Physical Android coverage and participant devices remain unconfirmed. Software, expert and agent reviews cannot close these gates.

This addendum extends [the existing moderated protocol](../experience-v8-usability-protocol.md). Preserve its five prompts, task controls, timing, assistance levels and scoring. It does not establish demand, conversion uplift, grid benefit, community acceptance or accessibility conformance.

## Buyer/evaluator rounds

Conduct two rounds of six participants, with **new people in round two**. Each round includes two commercial/infrastructure decision makers, two infrastructure/platform engineers and two critical-facilities/operations evaluators. Include AI cloud and colocation experience. Team members, designers and previous study participants cannot substitute for unfamiliar target readers. Record pre-existing familiarity and recruitment gaps without inferring representativeness from the user's network.

Assign three desktop and three physical-mobile starters per round, balanced across roles. Use the person's usual access method. Record browser, device, operating system, viewport, input method, connection, reduced-motion preference and candidate/source identity. Emulated mobile does not close physical-device coverage. A missing device or role stays pending.

Use synthetic form details and the [isolated reader-session proxy](../../../scripts/qa/READER-SESSION.md), after a facilitator dry run against the declared candidate. Its mock receipt does not reach the inquiry backend. Loopback use is prepared; physical iPhone LAN use requires a supplied certificate already trusted by the device, and remote participants require a separately accessible isolated host. Those availability and session results remain pending. Never submit these study inquiries to production. Keep names, contact details, consent and recordings in the user's private study records, outside the repository, analytics and public reports. Use participant codes in the [session template](session-record-template.md).

Before every session, state: **“Use only the supplied fictional details. Do not submit anything on the production website. After reading a versioned HTML brief, use browser Back to return to the local study page, then use its assessment link. Confirm the TEST / STUDY banner before entering or submitting details.”** Immutable brief v1.0.0 contains an absolute production assessment link and is intentionally passed through unchanged; that frozen-brief-to-assessment route is not fully isolated or qualified by the study proxy. Record the instruction, any interrupted navigation, facilitator assistance, time excluded for environment recovery, and the participant's original next-action choice. A task that requires this intervention cannot count as unassisted seamless completion; report it as assisted/partial as appropriate under the existing rubric. Other isolated paths can remain unassisted. Review the production site's functional navigation separately; never alter a published brief to remove this limitation.

### Separate 60-second first-read exercise

Before the existing timed tasks, show the homepage at its initial position for 60 seconds and allow normal reading/scrolling without facilitator explanations. Prompt: **“Read this as if you had just encountered the company. Tell me what you think it offers and what you would do next.”** Record the first unprompted interpretation, not a coached answer.

Code each independently: paid/bounded assessment; authorized historical inputs; decision brief/evidence; scoping next action; synthetic examples; civic ambition distinguished from delivered service. Record wrong inferences verbatim. Sixty seconds is an internal design convention, not a validated benchmark. Do not add this time to the existing five tasks, change their search thresholds, or treat this exercise as a sixth comparable task. Record that the initial exposure precedes task 1; round comparisons must use the same sequence.

### Civic and research probes

After the five tasks, ask without explaining the boundaries first:

1. **“What contribution to grids or communities is demonstrated here today?”**
2. **“What does the cited research establish about GridNinja?”**
3. **“What would you still need to know before relying on either claim?”**

Correct interpretation distinguishes ambition, another organization's study, and GridNinja's current assessment. A persistent inference of demonstrated community benefit, customer outcomes, research validation of GridNinja, or operating authority is critical. Record spontaneous answers before any clarification; a corrected answer does not erase the original error. Separately ask what appeared professional or unclear and why. Do not aggregate subjective impressions into an objective beauty score.

### Round decisions

Keep the existing internal round-two rule: **at least five of six unassisted completions per task and zero unresolved critical misinterpretations**. These counts are decision rules for this purposive sample, not estimates of market success rates. Any critical issue or repeated major issue requires a linked fix and targeted retest with an unfamiliar participant. Do not relabel it a participant mistake. Publish raw counts with denominators, individual times, assistance, confidence, severity, quotes and candidate changes; never imply statistical uplift.

## Separate grid/community panel

Recruit **two utility/grid planners and two people providing local/community perspectives**, four sessions separate from the twelve buyer sessions. Record their actual experience, geography, relationship to a local development and prior familiarity. A utility employee or a resident speaks from their own perspective unless an explicit representative mandate is documented. Do not label this convenience panel representative of a utility, municipality or community. Do not include these four in buyer-task denominators.

Use a 30–45 minute qualitative review of the mission, civic figure, responsibilities, present-offer trust line and research notes. Ask:

- “What relationship among the facility, grid and community does this picture suggest?”
- “What seems to be offered today, and what is an ambition?”
- “Which local responsibilities are visible, absent or overstated?”
- “What evidence, permissions or participants would be necessary before a contribution could be claimed?”
- “Which wording or visual detail makes you trust or question the message?”

Record conflicting views and missing context rather than converting them into an approval percentage. No vote, threshold or testimonial from this panel establishes consent, public benefit, permitting prospects, grid-service eligibility or endorsement. A false current-capability inference is still a content defect to correct and retest. The user/editorial owner records how material concerns were addressed; unresolved concerns remain visible in the release decision.

## Expert art and device checks remain separate

Two reviewers who did not author the images independently match five randomized, uncaptioned thumbnails to rack, colocation row, brief, authority diagram and whole-facility subjects at 160×100 and 320×200. Record a confusion matrix before discussion, inspect grayscale and evaluate fine-detail legibility at actual size. Internal rule: both reviewers identify all five at both sizes. This verifies distinction, not buyer preference. Review the civic figure separately at its actual responsive sizes for implied flows or benefits.

Physical iPhone Safari, physical Android, 200%/400% zoom, keyboard, VoiceOver/NVDA, reduced motion, no JavaScript and failed-asset behavior each need their own record. Browser automation or agent screenshots are not substitutes. Record unavailable coverage as pending, and distinguish website inspection from participant research. The user may explicitly disposition an outstanding gate in the release decision; the evidence must still say untested, never passed.

## Business reporting without false funnel rates

Use [the approved private measurement contract](../implementation-plan.md#measurement-and-claim-governance): weekly qualified website-sourced opportunities; monthly mature 90-UTC-day paid-assessment cohorts. The user owns qualification and explicit merges in a private CRM/ledger. A receipt is not qualification, a paid engagement or delivery of email.

If authorized exports exist, retain 28 complete pre-release days and matched 28-day post-release count windows, with source coverage and acquisition/sales changes. Otherwise collect a prospective baseline. The 28 days are a reporting convention, not proof of sufficient sample size. No baseline, participant results or numeric uplift targets exist at preparation time.

Keep click/open/start/submit/receipt/error events as diagnostic counts. Existing telemetry lacks the approved continuity, deduplication and coverage needed for session funnel ratios. Do not divide those counts into conversion rates. This upgrade adds no tracking vendor, joining identifiers, research-click event or automated outreach. Unknown follow-up remains in the commercial denominator and suppresses the cohort rate under the existing utility.
