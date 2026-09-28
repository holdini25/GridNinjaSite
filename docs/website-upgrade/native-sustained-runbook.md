# Native Chrome sustained observation

Run only after the candidate's production build is frozen and verified, with the
same feature environment used to build it. Stop Blender, test workers, and other
GPU workloads first. This runner measures one visible overview in one native
Chrome window; it does not register a release gate automatically.

```sh
export PATH="$PWD/build/tools/node-v22.23.2-darwin-arm64/bin:$PATH"
node scripts/qa/native-sustained.mjs \
  --url http://127.0.0.1:3000/demo \
  --out build/qa/qualification10/native-chrome-sustained01
```

The output directory must not exist. Keep Chrome visible, the facility at least
25% visible, and activity enabled for the run. Do not change tabs, select a story,
open reading panels, resize, lock the Mac, or move another window over it. The
runner brings Chrome forward once, then leaves normal visibility and background
throttling intact. Its default CDP context uses `noDefaults`; it does not use a
Playwright context that emulates foreground visibility.

The default is 900 observed seconds. Samples arrive every five seconds. A full
passing observation requires at least 99% visible time and 95% active,
cadence-compliant time. A hidden/offscreen transition invalidates that entire
sample interval. Delayed intervals over 7.5 seconds earn no duration credit.
Frame counts and active-clock progression must agree with elapsed time; recorded
missed slots and delivered frame counts must stay within the 10% cadence limit
for sufficient intervals. This tolerance is for sustained qualification, not a
replacement for fixed-cadence or adaptation tests.

Short development checks are explicit and never qualify:

```sh
node scripts/qa/native-sustained.mjs --seconds 20 --development \
  --url http://127.0.0.1:3000/demo \
  --out build/qa/qualification10/native-chrome-smoke01
```

Inspect `report.json`, including the exact source/build/release/settings identity,
QA harness revision, served build ID, actual M5 Pro Metal renderer, launch flags,
activation action, every sample, summary, errors, and cleanup. The report is
updated atomically after each sample. Failed and interrupted attempts remain in
their original directories. Start/end screenshots occur outside timed sampling.

Potential false-pass review points:

- A development result is `development-pass`, with `qualificationEligible:false`.
- Hidden time, inactive motion, reading holds, Still tier, stalled frames, missing
  diagnostics, lost contexts, or growing retained geometry/texture counts cannot
  establish a sustained pass.
- The sampled heap is Chromium's potentially coarsened JavaScript heap. Asset
  allocation is an application estimate. Neither measures driver/GPU memory.
- No temperature, energy, GPU timestamp, Safari, physical-phone, accessibility,
  or public-release result is inferred.
- All non-GET/HEAD/OPTIONS requests are blocked as a submission safeguard; any
  resulting console errors remain visible and fail this observation. This runner
  is not the production analytics/verification qualification harness.
- Native visibility behavior still deserves the separate background-tab test;
  a single always-visible session cannot prove all hidden-state transitions.

The earlier `scripts/facility/sustain.mjs` remains historical. Use this runner for
new candidate evidence because it preserves attempts and requires observed
visible activity rather than accepting elapsed wall time alone.
