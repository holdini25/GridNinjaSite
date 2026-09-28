# Experience v8: moderated usability protocol

Status: **planned; no participant study has been conducted.** Automated checks, source review, and developer walkthroughs are separate evidence. This protocol evaluates comprehension and discovery; it does not establish customer demand, site performance, or accessibility conformance.

## Purpose and rounds

Run two rounds with **six representative visitors per round** (twelve sessions total). Recruit new participants for round two so learning the first interface does not mask discovery problems.

For each round recruit:

- Two commercial or infrastructure decision makers responsible for capacity commitments.
- Two infrastructure or platform engineers who evaluate workload admission and supporting evidence.
- Two critical-facilities or operations evaluators who review electrical/cooling constraints and service access.

Include both AI cloud and colocation experience. Avoid team members and anyone who has helped design the site. Record relevant experience and prior familiarity; do not portray these small purposive samples as representative market statistics. Invite participants to use their usual access methods and disclose any recruitment gaps.

Round one identifies comprehension and discovery failures. Fix the most consequential failures and freeze a second candidate. Round two repeats the same five tasks to check those changes and look for regressions. Keep results separated by candidate, round, role, device, and assistance level.

## Session setup

- Allow 45–60 minutes, including consent, introduction, five tasks, and a short debrief.
- Use a versioned local or preview build. Record commit, facility release, browser, viewport, input method, connection profile, and motion preference.
- Have three participants start on desktop and three on a physical mobile browser in each round, balanced across roles. Use the same assigned device for all five tasks. Record unavailable device coverage rather than substituting emulation silently.
- Clear tab-session viewer preferences and form recovery before each session. Do not clear state between tasks unless the protocol says to reset. Record reduced-motion or Save-Data preferences and retain them.
- Use synthetic form details and an isolated mock intake endpoint. Block production contact delivery. A test receipt must be clearly identified in the study environment; never submit a real inquiry for this test.
- Ask permission before recording screen/audio. Record consent and retention arrangements outside application analytics. Do not collect confidential facility details.
- Say: “We are testing the website. Work as you normally would and tell us what you expect or find confusing. You can stop at any time.” Do not explain the navigation, model controls, or assessment terminology in advance.

## Five tasks

Read the participant prompt verbatim. Keep success criteria out of the participant’s view. Start timing when the prompt has been read. Stop when the participant states they are done, abandons the task, or reaches the assistance threshold.

| Task | Participant prompt | Start | Observer success criteria |
| --- | --- | --- | --- |
| 1. Explain the offer and limits | “Imagine you are deciding whether GridNinja could help with your next capacity commitment. What would you be buying, what would you receive, and what would it not do?” | Homepage, top; no prior orientation | Describes a bounded paid assessment using authorized historical inputs; identifies a decision brief with conditions/evidence; distinguishes inquiry/scoping from purchase and assessment from live equipment control. Notes synthetic examples rather than assumed customer results. |
| 2. Interpret B and the unresolved decision | “Use the sample to explain the requested commitment, the modeled result, and the decision the business still has to make.” | Continue from task 1; default example B available through the site | Finds B; identifies 7.0 MW requested and 5.8 MW modeled/proposed revision, additional to the 20 MW reference for one hour; identifies whether the smaller profile is commercially useful as unresolved. Does not confuse a modeled screen with accepted/delivered capacity or operating authority. |
| 3. Find versioned evidence | “Find the evidence for the result you just described. Show how you would share the exact decision brief and obtain its technical record.” | Continue from task 2 | Reaches `/evidence/assessments/demo-01-b/v1.0.0`; locates its exact versioned PDF/JSON destinations; can distinguish the synthetic published example from a publication-pending resource. Returns to the contextual example using normal navigation. |
| 4. Inspect service construction unaided | “Inspect how a representative server is accessed for service. Show the extended tray, explain what you are seeing, and return to the facility view you started from.” | Homepage, new navigation entry; preserve normal motion preferences | Discovers the route to construction inspection without moderator hints; explicitly opens the representative rack; opens/extends via guided actions or clickable handles; recognizes 180 mm illustrative rail travel and disconnected service connection; returns to the prior facility view. Does not infer that a rack moves out of the overview or that construction proves capacity. |
| 5. Reach and complete scoping | “You want to discuss a capacity decision for your organization. Start the scoping inquiry with the test details provided. Check the topic, add only what you think is needed, and show how you know it was received.” | Continue from task 4; offer a neutral topic on the task card | Finds the scoping form, completes Name/Work email/Organization, understands optional context, edits or clears the public topic, submits to the mock endpoint, and recognizes the intake receipt without inferring purchase or engagement acceptance. Can recover from the scripted validation error described below. |

### Task controls

- Task 4: do not name the buttons, demonstrate the handles, or suggest dragging. Record whether the first attempt is a native link, system selection, model click, or guessed gesture. On reduced-motion devices, instant joint changes count as successful interaction; movement is not required.
- Task 5: give a deliberately malformed test email first, such as `operator.example.test`. If the participant catches it before submitting, record that as successful prevention and provide the valid replacement. Otherwise let validation occur and ask them to continue. Use a valid synthetic replacement such as `operator@example.test` and the isolated endpoint; no production delivery.
- Keep retry/conflict testing separate from the timed task unless it arises naturally. After task 5, an optional mocked lost-response probe can check whether “Retry original inquiry” is understood without implying that the first request was not received.
- After the five primary tasks, an optional integrity probe may open D and ask what can be concluded when cooling evidence is absent. Record it separately; do not substitute it for any approved task.

## Observation and scoring

Capture the route and first action, elapsed time, wrong turns, backtracking, rereading, missed controls, accidental activation, recovery, and short verbatim quotes. Record each wrong inference even if the participant later succeeds.

Use these outcome categories consistently:

| Outcome | Definition |
| --- | --- |
| Unassisted success | Completes the observable task and states the relevant interpretation without moderator direction. |
| Assisted success | Completes after a neutral prompt or a navigation/control hint; record the exact intervention. |
| Partial | Finds part of the answer or action but leaves a material condition, destination, or interpretation unresolved. |
| Failure / abandonment | Cannot complete, ends at the wrong destination, or persists with a materially false interpretation. |

Allow up to two minutes of unproductive searching before offering “What would you try next?” After another minute, offer a single recorded hint so later tasks remain possible. Stop at five minutes of active searching or sooner if the participant asks. Report raw times and assistance; these practical limits are study conventions, not performance benchmarks.

After each task ask:

1. “How easy or difficult was that?” — 1 very difficult to 7 very easy.
2. “How confident are you that you reached the right answer or action?” — 1 not confident to 5 very confident.
3. “What made it unclear?” — open response without suggesting the diagnosis.

Code issues with a concrete observed cause and consequence:

- **Critical:** false authority/purchase/capacity conclusion; a destructive duplicate-submission misunderstanding; task cannot be completed with the participant’s access method.
- **Major:** cannot discover construction or evidence, confuses close-up with explicit assembly loading, cannot recover form errors, or requires a directional hint to complete the task.
- **Moderate:** repeated backtracking, unclear labels, avoidable scrolling, or a correct result reached with low confidence.
- **Minor:** presentation friction with no lost task or material misinterpretation.

Keep access barriers distinct from participant comprehension. Record keyboard focus, visible selection, touch scrolling/picking conflict, zoom, and motion controls where observed. Follow with a separate manual accessibility audit; six sessions cannot establish WCAG conformance.

## Round decisions and report

- After round one, review all critical and major findings before cosmetic issues. Link each change to an observation and preserve the original capture. Do not change authoritative fixtures or weaken missingness/operational boundaries to improve task scores.
- For round two, aim for at least five of six unassisted completions per task and **zero unresolved critical misinterpretations**. Treat these as internal decision rules, not statistically estimated population success rates.
- A repeated major issue or any critical issue requires a fix and a targeted retest; do not relabel it as a participant mistake. If recruitment or device coverage is incomplete, record the limitation and keep the relevant release gate open.
- Report counts with denominators, individual task times, assistance, interpretation errors, confidence, severity, representative quotes, and candidate-specific changes. Avoid significance claims for a sample this small.
- Preserve automated assessment-integrity, lifecycle, performance, native-device, and manual accessibility gates independently of this study.

Suggested session record: `round / candidate / participant code / role / device / task / first action / outcome / time / assistance / interpretation / ease / confidence / severity / evidence link / proposed fix`.
