# GridNinja experience and facility-v8 implementation

## Scope

This release makes the paid assessment easier to understand and reach, and gives the representative rack a mechanically ordered inspection journey. It preserves the continuous neutral-black palette, borderless facility, authoritative A–D records, synthetic scope, existing publications, and rollback modes. No public deployment is performed by this work.

## Implemented experience

- Home uses the approved decision headline and offer → worked example → solution fit → assessment process → evidence/responsibilities → inquiry sequence. The four-system rail stays on home; deep construction and topology live on `/demo`. Native construction/story links preserve the applicable assessment, equipment focus, and public topic without preloading specimens.
- Demo places the compact selector-derived decision before the facility in document order and above it on small screens. Scenario labels describe their meaning. Detailed conditions and evidence remain available through disclosure and exact publication links.
- Five navigation groups and four footer groups organize existing routes. Scoping links target `#scope` with allowlisted public context. The form follows a compact offer/deliverables introduction. Name, work email, organization, optional topic, and optional context lead; technical details are optional. Errors link to their fields, open the relevant disclosure, and preserve recovery/idempotency behavior.
- Construction actions distinguish an in-place close-up from loading a representative assembly. Returning restores the originating facility view and selection. A construction deep link offers explicit facility activation even when the stage is offscreen. Assembly downloads remain explicit.
- Effective graphics status separates loading/static, reduced motion, pause, equipment-motion-off, performance Still, and still inspection. Native buttons remain available for projected handle actions.

## Rack and runtime

`facility-v8` reuses the exact v7 overview and cooling GLB bytes. The rack derivative preserves its envelope, six part identities, materials, and 180 mm tray travel. It adds a real authored hinge, 110° outward rotation, hinge knuckles, and versioned motion/handle metadata. Its service connector is explicitly disconnected during extension.

The existing single scheduler owns movement. The door opens before the tray extends; the tray retracts before closure. New commands retarget from the current transform. Side-panel removal is independent. Parts hidden at both legacy pose endpoints remain hidden throughout. Pause, reduced motion, and Still apply final states immediately; hidden/offscreen time does not advance joints. Already-loaded joint movements do not inherit the asset-transfer timeout. Asset switches retain their eight-second deadline and atomic staging/disposal.

Projected HTML handles share the same commands as the adjacent buttons. Cached stage dimensions resolve overlapping labels without per-frame layout reads, React updates, or scene traversal. The model camera remains fixed during rack movement.

Mobile WebKit testing found that the original control order could scroll the stage offscreen before a joint command, correctly suspending presentation. Mechanical controls now sit immediately below the stage and graphics toolbar. Explicit changes between the facility, rack, and cooling assets reveal the stage; commands within an already loaded assembly do not repeatedly scroll. The offscreen rendering safeguard and asset deadline remain unchanged.

The final browser checks caught a 31,493-byte rack allocation overrun when including its shared environment. For mechanical racks only, missing route-ID and route-distance attributes now use unnormalized signed-byte sentinel buffers. The shader receives the same exact `-1` values; authored attributes and all legacy paths remain unchanged. This recovers 90,768 retained bytes without altering frozen model files, shader source, cache keys, textures, or the memory gate.

### Frozen asset

- Overview: 2,258,676 bytes, unchanged from v7; 39 draw calls.
- Rack: 775,976 bytes; 10,282 authored triangles; 26 runtime draw calls; eight runtime materials; estimated asset allocation 3,751,928 bytes.
- Cooling: 364,456 bytes, unchanged from v7.
- Rack SHA-256: `3f4d407513255c78af771f3292dddb3d453638c8064bebcae4d28d05f079c839`.
- All three GLB validators report zero errors and warnings. Saved-master reexports reproduce exact bytes. Swept-geometry validation includes 221 door and 181 tray samples, interval clearance checks, and intentionally unsafe negative fixtures.

Editable sources and authoring instructions remain in `assets-source/facility/`; the frozen manifest and delivery files are in `src/content/facility-releases/facility-v8/`. Sources/candidates are excluded from the asset allowlist. The baseline integrity audit checks 73 existing release/publication files unchanged, with the registry append recorded separately.

## Verification evidence

Final production build: `_w__MHXkJOi-3cijqiI_I`, source fingerprint `5f992255ff902320e66ddbed2952f40f616503a451fe6ef61424f51a2bc901b3`. Intermediate failures are retained under `build/experience-v8/`.

- Browser visual review: 57 states, desktop DPR 1/1.5 and mobile DPR 1; no page errors. Overview selection states, perspective details, and all six assembly poses captured.
- Layout review: 15 route/width combinations at 320, 390, 768, 1366, and 1920 px. Zero horizontal overflow. Both home actions are visible at 1366×768. Demo decision precedes the inspector. `#scope` lands about 86 px below the viewport top under the 70 px header.
- Lint, typecheck and production build pass. Full unit suite: 613 tests across 63 files. Chrome facility suite: 29 passed, one intentional skip. Experience checks: 30 Chrome and 16 mobile WebKit cases passed across initial and exact reruns. Automated axe checks cover home, demo, assessment and contact.
- The final build repeats the two Chrome mechanical intermediate-frame/reversal cases and the mobile WebKit material case covering every rack/cooling pose. Two mobile control/retry cases passed immediately before the final assembly-entry correction. Earlier broad suites and exact later regressions have separate logs; they are not represented as one full-suite run against the final build.
- Native M5 Pro/Chrome Metal: ten open/close and ten alternating assembly/overview cycles pass, with no page errors or continuing hidden frames. Rack session allocation is 6,232,181 bytes; peak staging is 12,102,491 bytes. Measured heap changes remain inside the existing bounds; this is bounded lifecycle evidence, not a claim that every possible leak has been excluded.
- Five fresh automatic-3D measurements per home/demo desktop/mobile-size profile: all 20 pass. Complete automatic transfer ranges from 943,576 to 982,508 bytes, with zero specimen downloads. Fixed 60-fps capability p95 is at most 18.4 ms. Deliberate 30-fps activity is evaluated against requested cadence. Mobile viewport measurements use the M5 GPU and do not establish phone GPU performance.
- Initial JavaScript is 154.7 KiB Brotli home, 157.7 KiB demo and 148.2 KiB assessment, within the unchanged 180 KiB ceiling.
- Before/after screenshots, source logs, intermediate failures, clips, and the frozen hash audit: `build/experience-v8/`. Browser posters/contact sheets and review captures: `build/facility/facility-v8/`.

The first attempt to capture the old running server after rebuilding produced unstyled pages because its old chunk references no longer matched `.next`. Those captures are explicitly invalid and retained as failed evidence. The usable “before” references are archived v7 captures with their original provenance; they are not a matched-build assessment-page measurement. Current production captures are under `build/experience-v8/after/`.

At 390×844 in the current production capture, the decision starts around 997 px in the document and the assessment form around 1,077 px. These are observed positions; the earlier review reported approximately 2,052 px and 6,707 px respectively under its own capture conditions.

Local form verification uses Cloudflare's public test site key. Submission E2E tests intercept the contact API; no inquiries are sent. Production verification credentials and delivery configuration remain part of the repository's release process.

### Final five-run production measurements

Thirty fresh Lighthouse runs cover all three routes on desktop and simulated mobile. The table reports medians. The unchanged validator **fails** only the three mobile LCP thresholds; no threshold was relaxed. Automatic 3D's complete cost is measured separately through viewer readiness even when the viewer is below Lighthouse's initial viewport.

| Route | Desktop LCP | Mobile LCP | Desktop / mobile TBT | CLS | Mobile performance score |
| --- | ---: | ---: | ---: | ---: | ---: |
| Home | 0.618 s | **2.605 s — fail** | 0 / 158.5 ms | 0 | 95 |
| Demo | 0.619 s | **2.747 s — fail** | 0 / 0 ms | 0 | 96 |
| Assessment | 0.576 s | **2.596 s — fail** | 0 / 0 ms | 0 | 97 |

All route/profile accessibility and best-practices medians are 100. These automated scores do not replace manual accessibility. Desktop performance medians are 100. FCP, TBT, CLS and measured transfer gates pass. The home/demo mobile LCP results are consistent with the recorded 2.606/2.746 s baseline; this release does not establish a meaningful startup improvement. Assessment is now explicitly included and also misses the LCP gate.

The [Lighthouse summary](facility-validation-v8/lighthouse.json) preserves every sample and build/settings identity. Raw reports, network logs and traces are in `build/facility/lighthouse-desktop/` and `build/facility/lighthouse-mobile/`; previous measurements remain under `build/experience-v8/previous-performance/`. The [machine-readable verification summary](facility-validation-v8/verification-summary.json) records both passing checks and blockers.

## Review and reproduce

- [Editable Blender sources, frozen assets and reproduction instructions](facility-validation-v8/asset-handoff.md).
- [Overview contact sheet](facility-validation-v8/visuals/contact-sheet.png) and [assembly contact sheet](facility-validation-v8/visuals/specimen-contact-sheet.png).
- [Door/tray sequence recording](facility-validation-v8/motion/door-tray-sequence-chrome.webm) and [rapid reversal recording](facility-validation-v8/motion/reversal-cutaway-chrome.webm).
- [Before/after comparisons](facility-validation-v8/comparisons/README.md), with original conditions and hashes preserved. The archived desktop comparison uses a different viewport; it is a qualitative design comparison.
- [Runtime validation](facility-validation-v8/runtime-validation.md), [automatic transfer/cadence report](facility-validation-v8/page-measurements.json), [verification summary](facility-validation-v8/verification-summary.json), and [Simulator evidence](facility-validation-v8/simulator-v8.md).

To inspect the rack in the local preview: `/demo` → **Inspect rack construction** → **Open door** → **Extend server tray**. The tray action also safely opens the door if needed. **Cutaway view** removes the side panel independently; **Return to facility** restores the origin context.

## Public-release requirements and evaluation

Physical-phone, sustained thermal/energy, Safari/VoiceOver, and representative-visitor results are separate from browser emulation and automated accessibility. No such results are invented here. The approved two-round, six-participant protocol is in `experience-v8-usability-protocol.md`; it has not been conducted.

The unchanged release thresholds include 180 KiB initial JavaScript, 1.5 MiB complete automatic transfer through readiness, LCP ≤2.5 seconds, CLS ≤0.1, existing TBT limits, geometry/allocation limits, and fixed-cadence capability checks. **Public rollout remains blocked by mobile LCP on all three measured routes and the outstanding physical/manual checks.** The two moderated usability rounds remain planned. The local preview and frozen v8 asset package are available for review; this report does not claim public-release acceptance.

The research in the approved plan informs design hypotheses, not promised conversion gains or exact durations: [Tuch et al.](https://research.google/pubs/the-role-of-visual-complexity-and-prototypicality-regarding-first-impression-of-websites-working-towards-understanding-aesthetic-judgments/), [Katz & Byrne](https://chil.rice.edu/research/pdf/KatzByrne03.pdf), [Seckler et al.](https://research.google.com/pubs/archive/42513.pdf), [Heer & Robertson](https://idl.uw.edu/papers/animated-transitions), and [Tversky et al.](https://www.tc.columbia.edu/faculty/bt2158/faculty-profile/files/_Morrison_Betrancourt_AnimationCanitfacilitate.pdf).
