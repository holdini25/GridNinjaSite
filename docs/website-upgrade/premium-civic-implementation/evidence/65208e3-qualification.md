# Candidate 65208e3 qualification disposition

Root implementation lead, 10 October 2026. This candidate is not approved for production.

Candidate `65208e32c57b57fbb3c4b94602dc632d2f453306` built as `hjUK52hSXzJ9JpeGHZDeh`, source `25b927cd4e90b1b54f695bfd329a8dfcf4897ae890fe45568cbbd0d389c1bf51`. Brand, lint, typecheck and build passed. The forty responsive cases, six failed-media cases and separate six no-JavaScript cases completed with stable candidate identity. Their captures remain saved under `build/premium-civic/journey-review/final-65208e3*`; complete independent screenshot review was paused when unit qualification failed. No performance clearance is claimed.

## Retained unit failure

Bounded command 17 (`unit`, attempt 2) failed one of 1,201 tests. The actual failure is `native-header.test.ts`, the test preserving accordion state through same-path history updates. The test constructed a JSDOM document with `runScripts: "dangerously"` and assumed the embedded bootstrap ran automatically. The updated bootstrap is a module. Installed JSDOM's `HTMLScriptElement-impl.js` explicitly returns for non-classic scripts with a TODO for module support. Thus the initial expected active accordion was never established. CI reported the same unit failure. Keep the original local receipt and CI failure; do not relabel them as passes.

## Narrow test correction and limits

The root lead authorizes a test-harness correction only: construct the isolated DOM with `runScripts: "outside-only"`, locate the actual server-rendered module script, verify it is unique and nonempty, confirm its initial effects have not run, then execute that exact IIFE once under strict mode inside the DOM's own JavaScript context. Preserve every existing history, active-route and accordion assertion. Do not copy the implementation into a fixture, merge Node and DOM globals, remove assertions, or claim this unit test verifies browser module loading. The separate stylesheet-gated Playwright tests continue to verify actual parser/module behavior.

After the focused correction passes, freeze a replacement candidate and run the final available split brand/lint/typecheck/build and full-unit attempts, followed by the planned browser and performance qualification. This is an explicit root disposition, not an automatic retry. The fixed command ledger, forty-command ceiling, three-attempt phase ceilings and original deadline `2026-10-11T00:37:12.359Z` remain unchanged. Do not invoke the exhausted combined quality phase. No application, artwork, typography, performance threshold or loading-budget change is authorized by this correction. Further failures remain open for explicit diagnosis; no passing subset approves production.

Actual reader, physical-device, manual accessibility and production-configured evidence remain open. The browser-design-reference exception and pending Figma synchronization remain as approved by the user.
