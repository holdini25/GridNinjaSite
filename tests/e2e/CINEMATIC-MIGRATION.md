# Homepage / demo test responsibilities

The cinematic homepage has no embedded Three inspector. Facility rendering,
selection, failure recovery, resource accounting and real background-tab tests
therefore run against `/demo?interactive=1`. This opts into the HTML explorer;
it does **not** force model activation or bypass motion/data/visibility policy.
The demo presents quantities in its accessible `Fixture B decision` region,
outside the inspector. Failure/selection checks compare that full authoritative
decision before and after the graphics action; the removed hero-only caption
is not reintroduced. Missing-poster notice and explicit recovery remain required.

Home → demo navigation still checks exact scenario/version links, model-free
home, and readable authoritative decisions. Direct demo construction/workload
links retain focus, anchor-clearance and record checks. Three client home/demo
round trips now own four demo graphics sessions (initial plus three returns);
each home visit must destroy the prior session, acquire no model and retain the
decision. Every returned demo session is checked against the same resource
baseline. The old requirement for a fresh graphics session on home is retired.

The removed homepage-specific lazy-viewer import/retry contract is replaced by
failed and delayed JavaScript tests against the actual server-rendered poster,
decision and native sample-brief destination. The demo's deferred import failure,
deadline and retry coverage remains. Homepage layout-return checks now inspect
the new editorial sections rather than retired content-visibility wrappers.

`cinematic-home.spec.ts` covers real native frames, preferences, controls,
rendition stability, no-JavaScript behavior, ranges and responsive accessibility.
`cinematic-visibility.spec.ts` adds real hidden-tab acquisition prevention,
pause/return and preservation of user Pause, using an isolated headed Chrome
profile and `connectOverCDP({ noDefaults: true })`; it never overrides
`document.visibilityState`. Run it and `facility-visibility.spec.ts` explicitly
with `--project=chrome-stable --headed --workers=1` after GPU rendering finishes.
Set `CINEMATIC_E2E=1` only when the tested server selects the candidate. Other
projects cannot supply this native visibility evidence; a skipped case is not a
qualification pass.

`cinematic-recovery.spec.ts` checks a real HTTP failure, a genuinely stalled
startup and deadline, simulated supported Save-Data, and one injected `play()`
refusal followed by actual native playback. The refusal test proves application
recovery only; it does not qualify operating-system autoplay policy. Each case
preserves one rendition and the selector-backed record. Run these serially with
the native visibility check only after the renderer releases the GPU.

These migrations change test locations to match the approved route architecture,
not graphics quality/resource limits or the required observed behavior.
