# Homepage activity lights and contact-button glow

**Historical private-candidate record.** The subsequent owner-authorized
production integration is tracked in [the release record](cinematic-production-release.md).
The preview identity and checks below describe candidate13.

Implemented the requested cosmetic refinement in the existing private worktree.
Preview: <http://127.0.0.1:3005/?preview=lights>.

Twelve visible rack indicators now have clearer, staggered amber blinks. Their
positions come from the saved cinematic-v1 Blender cameras, with nine visibility
samples per selected emitter in both compositions. Occluded lamps and steady
status indicators are excluded. Small SVG light accents share the existing
camera-projected annotation layer, adding no movie, model, canvas, browser timer
or new dependency. The movie and source masters remain unchanged.

The accents appear only after the movie presents a frame, animate only while
the player is playing, and freeze on Pause, offscreen suspension and background
suspension. Reduced motion and no-JavaScript fallback hide the added accents.
The five/ten-second cycles use distinct phases and small, local brightness changes.

The large homepage assessment buttons and Contact form's primary submit button
now gain an 18px, 18%-opacity amber halo on fine-pointer hover and keyboard focus.
Focus outlines/rings remain intact. Touch hover is excluded and reduced motion
removes the transition. CTA destinations, form submission and assessment content
are unchanged.

## Build and verification

- Frozen candidate: `/private/tmp/gridninja-cinematic-facility-qualification13`.
- Build: `mdztk8gmnPQYbs9kEZ7IN`.
- Source inventory: `4882170c6355cb09b1d7562fe5fc5220b9105cc24589346d64fbe4e407e71162`.
- Five implementation files changed; exact patch and hashes are in
  `build/qa/cinematic/light-refinement/changes13.diff` and `change-summary13.json`.
- Lint, typecheck, 92 relevant existing unit tests, production build and its
  source/asset/publication validators pass. Homepage initial JavaScript remains
  117.3 KiB Brotli including the framework, within the 180 KiB limit.
- All 32 existing cinematic homepage browser tests pass on the four configured
  Chrome/WebKit desktop/phone projects.
- Focused native checks pass in Chrome and WebKit at 1366 and 390px: actual
  light-pixel changes, asynchronous opacity, pause/offscreen freeze, retained
  rendition after rotation, reduced motion, and hover/focus. No form was submitted.
  Fifty captures with build identity and hashes are recorded in
  `build/qa/cinematic/light-refinement/native13-final/report.json`.
- Blender projection extraction was read-only. The saved masters, original
  master, render source/settings and cinematic manifest retain their hashes.

The intermediate candidate12 was built but never served; its duplicate
annotation wrappers were simplified into the existing SVGs before candidate13.
Earlier scratch-checker attempts are retained separately from the successful
native check; their failures concerned test-helper parsing/waits, with no
application changes made in response.

This is focused follow-up verification, not a new full five-run performance
matrix or independent human craft approval. Candidate11's reports and source
archive remain immutable. Existing public/operational, human, physical-device
and Firefox gates still apply. Production and the original checkout are unchanged.
The current handoff documents are reporting-only updates after freezing candidate13.
