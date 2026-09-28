# Facility v4 interaction validation

Recorded 23 September 2026. These are local production-build checks against `http://localhost:3000`, using Node 22.23.2, Playwright, one worker, and trace/video recording disabled through `build/facility/playwright-v4.config.ts`. No public deployment is implied.

## Results and evidence

| Run | Result | Preserved log |
| --- | --- | --- |
| Chrome stable desktop | 27 passed | [Original interrupted run](e2e-desktop-interrupted-firefox-startup.log) |
| Chromium desktop | 27 passed | [Original interrupted run](e2e-desktop-interrupted-firefox-startup.log) |
| WebKit desktop | 27 passed | [Continuation](e2e-production-remaining.log) |
| Chromium mobile, Pixel 5 emulation | 27 passed | [Continuation](e2e-production-remaining.log) |
| WebKit mobile, iPhone 15 emulation | 27 passed | [Continuation](e2e-production-remaining.log) |
| Native headed Chrome background-tab visibility | 1 passed | [Visibility check](e2e-production-visibility.log) |
| After the explicit-action visibility fix: two new cases in each mobile engine | 4 passed | [Fix regression run](e2e-visibility-fix-final.log) |
| After the fix: Chrome engineering suite | 4 passed, 2 mobile-only cases skipped | [Fix regression run](e2e-visibility-fix-final.log) |

The original matrix therefore recorded **135 passing cases across five browser projects plus one headed visibility case**. The rebuilt production bundle then passed **eight targeted regression cases**. These are execution counts, including the same tests across different browser projects; the complete matrix was not rerun after the final visibility fix.

The seven matrix files were `assessment.spec.ts`, `facility-engineering.spec.ts`, `facility-explanation.spec.ts`, `facility-failures.spec.ts`, `facility-visual.spec.ts`, `facility.spec.ts`, and `navigation-loading.spec.ts`. The separate headed case was `facility-visibility.spec.ts`.

### Interrupted Firefox attempt

The full original log is retained, including its failure, under the deliberately explicit name [e2e-desktop-interrupted-firefox-startup.log](e2e-desktop-interrupted-firefox-startup.log). It begins with a planned 162-case matrix and records 54 successful Chrome/Chromium desktop cases. Firefox then stalled during browser/worker startup; its first case is marked failed at `0ms`. A subsequent Firefox worker also remained stalled. The owning runner and those Firefox processes were terminated, and the remaining projects were run separately.

**Firefox is unverified.** This interruption is not reported as a passing matrix or used as evidence of a facility product failure. The retained log has no complete Firefox failure diagnostic or end-of-run summary because the runner was interrupted.

## Assessment and interaction coverage

- All 16 ordered A–D transitions checked the screening outcome, current publication identifiers, exact PDF/technical-record destinations, downloaded JSON semantics, unestimated economics, and non-applicable operator acceptance. Fixture D remained unknown, with no numeric eligible capacity or attribution chart. Fixture C retained its authored minimum and absent revised profile.
- History/reset restored scenario, version, perspective, interval and disclosure state. Invalid or ambiguous URLs displayed an unavailable result instead of substituting a record. Server-rendered explanation and fixture navigation worked with JavaScript disabled.
- Selecting systems preserved the assessment caption. Engineering views, expansion, rack poses and return to overview retained the same canvas. Failed assembly transfers kept the existing model usable and allowed explicit retry.
- The manual walkthrough exercised Request → Conditions → Screening result → Evidence. The D path preserved missing cooling evidence and unknown capacity, kept highlight controls within Conditions, and exposed the exact versioned brief/PDF/JSON links. Manual inspection exited the walkthrough. Authored equipment labels and connection controls were checked.
- Tab-session Close suppression, Pause and equipment preferences survived navigation. Reduced motion disabled equipment animation. The renderer stopped scene frames after Pause; ordinary production rendering exposed neither diagnostic hooks nor per-frame canvas DOM mutations.
- Failure tests covered missing posters, integrity-corrupt model bytes, oversized transfers, the shared eight-second deadline, deferred import failure, stale loading completion after navigation/Close, explicit retry, Save-Data, slow connection and the 25% visibility activation threshold.
- The separately launched headed Chrome test used native document visibility without Playwright focus emulation. Hidden tabs deferred automatic model transfer; a hidden ready scene stopped frames and equipment state changes. Resume skipped the hidden elapsed time and resumed rendering.

## Concrete mobile defect and correction

A subsequent visual review found a defect that the earlier test helper concealed. On a narrow paused viewport, tapping controls below the model could scroll the stage out of view. The renderer correctly stopped offscreen rendering, so a requested assembly could not render its first frame and commit before the eight-second deadline. Earlier tests called a stage-scroll helper after view changes and therefore did not reproduce this interaction.

The shell now reveals the stage for explicit view/pose changes, Return, Retry, selected systems, authored parts, routes and equipment, and explicit walkthrough equipment highlights. It checks the current viewport bounds and uses `scrollIntoView({behavior: "instant", block: "nearest", inline: "nearest"})` only when the stage needs revealing. An `86px` top scroll margin keeps the model below the `70px` sticky header. Ordinary pointer/focus previews do not scroll. Reset/scenario/history handling reveals the stage only when returning an active or pending specimen to the overview; an ordinary overview reset does not move the page. Walkthrough entry handles the same specimen return.

The two new mobile tests scroll **controls** into view before tapping, then require the product to reveal its own model. They never call a stage-scroll helper after those actions. Coverage includes paused rack/cooling loads, Closed/Cutaway/Service detail, part selection, Return, walkthrough entry from a specimen, Reset from a specimen, and failed-load Retry. Assertions require at least 95% stage intersection and a header-safe top position for the primary action sequence. Both cases passed in Chromium mobile and WebKit mobile. Unit tests separately cover preview/no-scroll behavior, already-visible stages, explicit view/part/Retry actions, and reset/walkthrough returns; all 22 shell unit tests, focused lint and full TypeScript checking passed after the fix.

## Accessibility and responsive scope

Automated axe scans reported zero violations for the tested assessment explorer and facility inspector states using WCAG 2 A/AA and WCAG 2.1 AA tags. These scans included reduced-motion scenario changes, keyboard system selection/reset, and the D engineering connection/walkthrough state. Keyboard tests covered Enter activation, preserved scenario focus, Close focus recovery, and deferred-navigation failure/Escape recovery.

Responsive tests checked 320, 640 and 1440 CSS-pixel widths: no inspector/page horizontal overflow, one exposed explanation at a time, no clipped explanation text, stable scope position across all system selections and A–D demo records, minimum 44px enabled controls, and visible posters. This is viewport reflow evidence; it does not establish physical-device zoom or screen-reader acceptance.

**Physical VoiceOver/Safari and touch-device checks remain separate and outstanding.** Playwright WebKit and mobile emulation are not physical Safari, iPhone or Android results. See [manual release gates](manual-release-gates.md). This report also makes no claim about a 15-minute physical-device thermal session, complete flash analysis, or the separate transfer/Lighthouse release gates.
