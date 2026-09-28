# Facility v8 runtime validation

## Verified production revision

The final targeted browser and native lifecycle checks passed against build
`_w__MHXkJOi-3cijqiI_I`, source revision
`5f992255ff902320e66ddbed2952f40f616503a451fe6ef61424f51a2bc901b3`.
The selected release is `facility-v8` in `auto-adaptive` mode.
The compact measured results and exact release hashes are in
[runtime-lifecycle.json](runtime-lifecycle.json).

## Runtime changes exercised

- The rack door rotates 110 degrees around its authored hinge over 420 ms;
  the tray travels 180 mm over 480 ms after the door clears. Closing retracts
  the tray first. Reversals start at the current transform, and cutaway is
  independent of both joints.
- The camera remains fixed while the tray travels. The same renderer and
  graphics session serve the overview and assemblies.
- Pause, reduced motion, Still quality, and equipment-off resolve joint targets
  immediately. Offscreen suspension preserves an unfinished transition without
  advancing hidden time or applying an asset-transfer timeout to it.
- Legacy pose transitions preserve parts hidden at both endpoints. Motion
  metadata rejects inward or tipping door rotations and sideways tray travel.
- Missing route attributes on the mechanical rack use unnormalized signed-byte
  `-1` sentinels. Authored attributes and the shader remain unchanged. This saves
  90,768 bytes, reducing the measured rack session from 6,322,949 to 6,232,181
  bytes under the unchanged 6,291,456-byte gate.

## Browser checks

| Check | Result | Evidence |
| --- | --- | --- |
| Chrome intermediate joints, sequencing, fixed camera, reversal and independent cutaway | 2 passed on the final build | `build/experience-v8/runtime-motion-complete-e2e.log` |
| WebKit mobile emulation: material highlights, all rack/cooling poses, assessment preservation and actual signed-byte shader attributes | 1 passed on the final build | `build/experience-v8/runtime-webkit-complete-e2e.log` |
| Mobile adjacent controls and explicit retry behavior | 2 passed after the mobile controls layout change | `build/experience-v8/runtime-webkit-final-e2e.log` |
| Broader Chrome engineering, material and motion suite | 11 passed; 2 mobile-only cases skipped before the final mobile layout changes | `build/experience-v8/runtime-final-production-e2e.log` |
| Focused runtime, parser, preflight, scheduler and material unit tests | 46 passed | `build/experience-v8/runtime-focused.log` |

The earlier mobile material failure exposed a rack-to-cooling switch that did
not reveal an offscreen stage. The final build compares the actual asset
identity and reveals assembly switches while keeping joint and pose actions
stationary. The final WebKit material case passes without altering its checks.

Successful final-build motion recordings are preserved at
`build/experience-v8/motion-final/door-tray-sequence-chrome.webm` and
`build/experience-v8/motion-final/reversal-cutaway-chrome.webm`.
Other successful preference and offscreen clips, plus earlier attempts, remain
in the same evidence workspace.

## Native lifecycle and allocation

Chrome 154.0.8037.58 used the Apple M5 Pro through ANGLE Metal at host DPR 2.
Ten open/close cycles and ten alternating rack/cooling/overview cycles passed.
There were no page errors or budget failures. Pause, reduced motion and
offscreen states produced no continuing scene frames.

| Captured state | Draw calls | Triangles | Materials | Estimated session bytes |
| --- | ---: | ---: | ---: | ---: |
| Overview | 39 | 35,472 | 9 | 7,967,462 |
| Rack cutaway | 24 | 10,198 | 8 | 6,232,181 |
| Cooling cutaway | 14 | 3,884 | 7 | 5,718,340 |

The session figures include the 2,359,296-byte environment. The largest measured
staging allocation was 12,102,491 bytes, below the 16 MiB target. Retained JS heap
increased by 1,667,728 bytes across ten open/close cycles and 986,972 bytes from
the warmed second asset cycle to the tenth, within the unchanged 8 MiB bounds.
All four rotors moved independently; twelve status lamps stayed steady and the
sampled activity never exceeded two concurrent pulses (three is the allowed
maximum).

The native lifecycle harness waits for the actual finite interaction response
to settle (`schedulerPending = 0`, no remaining camera or joint transition, and
the clock past `interactionUntil`) before asserting zero frames for 350 ms.
This replaced an inadequate fixed 500 ms wait; the earlier failed attempt is
preserved at `build/experience-v8/browser-validation-native-before-settle.json`.

Cadence diagnostics measured 33.4 ms p95 at requested 30 fps and 16.7 ms p95 at
requested 60 fps, with no missed slots in either sample. These are lifecycle
diagnostics; the integration lead records isolated route performance separately.
The full final report is
`build/facility/facility-v8/browser-validation-native.json`, also preserved as
`build/experience-v8/native-lifecycle-final.json`.

WebKit mobile emulation is not physical iPhone testing. Sustained physical-device
and manual accessibility release gates remain separate from these checks.
