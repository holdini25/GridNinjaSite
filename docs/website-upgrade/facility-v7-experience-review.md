# V7 navigation and intake adversarial review

Reviewed the public focus/topic boundaries, assessment selection owner, history/reset behavior, inspector lifecycle callbacks, exact publication selectors, static HTML, and contact retry/persistence/delivery paths.

## Confirmed issue and correction

A graphics pick delivered in the same JavaScript event turn as **Close 3D** was rejected by the presentation reducer but still reached the new committed-selection callback. React had not yet committed the replacement token effect, allowing an unwanted history write after closing. A unit test reproduced the failure before the fix.

The inspector now retires its graphics generation synchronously on Close and failure. Both legacy system picks and equipment picks check that generation before any story, selection, or history side effects. The failing regression passes after the correction.

Committed equipment targets are also normalized through the public equipment index before history serialization. Mismatched system/equipment pairs resolve to the authored system; unknown equipment clears public focus instead of inserting an unlisted identifier into the URL. A regression exercises both cases.

## Boundaries verified

- Invalid or repeated focus values clear visual selection without changing the assessment. Conflicting scenario, version, or perspective values preserve the existing unavailable state.
- Back/Forward changes the presentation revision, restoring stopped Overview and validated focus. Scenario/perspective changes clear focus; reset restores B/business. Public topic remains independent of assessment identity.
- Preview, playback time, camera interpolation, route identity, and specimen activation are not serialized. Published brief links derive from the selected record, and frozen publications are not rewritten.
- Poster-only and no-JavaScript deep links render selected explanations and native evidence links. The public equipment index does not load the model. Broader browser/no-JavaScript checks remain in the integration E2E suite.
- Topics are allowlisted at URL resolution, form validation, tab recovery, and delivery. Unknown and repeated URL topics are ignored. Topic changes participate in retry fingerprints; missing topics preserve old attempt and delivery shapes.
- Inquiry prose stays separate from public topic and is absent from URLs, analytics, and tab recovery. Database storage and redaction include the separate nullable topic column. The migration is generated but has not been applied to a database.

## Verification

### In-place rear-rack obstruction

A later [CPU triangle audit](../../build/facility/facility-v7/rack-detail-occlusion-audit.json) found that front-row construction blocks the sampled rear-row rack-front points: Rack 07–11 fully and Rack 12 partly. Camera identity is correct. The mitigation preserves the selected rack and frozen construction, names the obstruction inside the existing explanation, and offers the separately loaded representative assembly through an explicit demo button or native home-to-demo link. It does not silently replace the target or download an assembly.

The cue resolves the active rack through the public equipment index, then compares authored rack bounds along the detail camera's dominant horizontal direction. It uses no hardcoded rack-number range and performs no per-frame visibility traversal. This is an explanation of the audited row obstruction, not a general occlusion solver. Regression coverage checks arbitrary identities, role/bounds overlap, reversed camera direction, exact home record/focus/topic links, explicit specimen activation, and removal on returning to Overview. The integration lead applied the patch and reports **568 passing unit tests** in the subsequent full run; final browser/build checks remain separately recorded.

### Final intake and no-JavaScript review

The assessment route remains prerendered. Its existing form client boundary resolves the allowlisted topic and source after hydration. Native decisions and publication links remain available without JavaScript; inquiry controls and submission require JavaScript and verification, as the visible no-JavaScript message states. Do not describe the topic as query-prefilled or editable before hydration. The nullable-topic migration must precede deployment of the updated contact application and has not been executed here. The final read-only pass found no additional concrete intake or navigation defect.

After correction: **146 targeted unit tests across 13 files pass**, targeted lint passes, and TypeScript checks pass. The targeted command covers form, contact, assessment, inspector, and navigation tests. No browser/GPU tests were run during this review to avoid interfering with the integration lead's captures.

The original failing attempt was retained at `/tmp/v7-adversarial-stale-pick-before.log`; corrected and final test outputs are `/tmp/v7-adversarial-stale-pick-after.log` and `/tmp/v7-experience-adversarial-final.log` for inclusion in the release evidence bundle.
