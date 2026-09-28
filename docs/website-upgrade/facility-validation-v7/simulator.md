# V7 iOS Simulator Safari review

**Route-load and screenshot review completed; interaction, motion analysis, and physical-device validation remain open.** The integration lead visually reviewed six initial screenshots and the additional iPhone 17e home retry. Six screenshots show the loaded facility; the first iPhone 17e home screenshot preserves an unresolved loading observation.

## Environment and method

- Xcode **27.0**, build **27A266a**; iOS **27.0** Simulator runtime.
- Devices: **iPhone 17e**, **iPhone 18 Pro Max**, and **iPad mini (A17 Pro)**. Their exact identifiers are retained in the [device inventory](../../../build/facility/facility-v7/simulator/devices.json).
- Production build **`w2z9veXyp4PSVzR2uzc5-`**, source **`f34d526e2a5431c7dd63b2784f43332b8fa7dd0af5a5e689be21200e64270c3b`**, release `facility-v7`, mode `auto-adaptive`.
- Each Xcode command used `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`. The global developer directory remained **`/Library/Developer/CommandLineTools`**.
- One device ran at a time. The [capture script](../../../build/facility/facility-v7/simulator/capture-local.mjs) booted it, waited for boot completion, opened each URL in Safari, captured screenshots and a short recording, then shut it down. No native wrapper or new MCP server was used.

The routes were `/` and `/demo?scenario=b&focus=cooling&topic=colocation`. The script read the actual server-rendered **Illustrative system view** heading ID and appended that fragment to bring the facility into view. These generated fragments are capture aids, not stable public navigation destinations. Fragment positioning can leave the heading beneath the sticky header; this capture method does not establish ordinary page-scroll or toolbar behavior.

## Reviewed captures

| Device | Home | Demo with Cooling focus | Review result |
|---|---|---|---|
| iPhone 17e | [First attempt](../../../build/facility/facility-v7/simulator/iphone17e-home.png), [successful retry](../../../build/facility/facility-v7/simulator/iphone17e-retry-home.png) | [Demo](../../../build/facility/facility-v7/simulator/iphone17e-demo-cooling.png) | First home capture showed blank Safari loading UI; retry and demo show live 3D controls and the facility. |
| iPhone 18 Pro Max | [Home](../../../build/facility/facility-v7/simulator/iphone18promax-home.png) | [Demo](../../../build/facility/facility-v7/simulator/iphone18promax-demo-cooling.png) | Both loaded views visually reviewed. |
| iPad mini (A17 Pro) | [Home](../../../build/facility/facility-v7/simulator/ipadmini-home.png) | [Demo](../../../build/facility/facility-v7/simulator/ipadmini-demo-cooling.png) | Both loaded views visually reviewed. |

In the loaded captures, the reviewer observed the graphite facility with four visible fans and the **Pause**, equipment-motion, and **Close 3D** controls. Phone views use the 4:3 stage; tablet views retain the wider composition. No horizontal overflow is visible in these screenshots. All three demo captures show Cooling selected from the URL. Where the assessment caption is visible, fixture B retains **7.0 MW requested, 5.8 MW modeled, 20 MW reference, and one hour**. These are screenshot observations, not assertions about every offscreen element or all interactive states.

### Preserved first-attempt loading observation

The initial iPhone 17e home screenshot, taken after a fresh boot and **14 seconds after opening the URL**, showed blank Safari loading UI. A separate boot/open retry captured the same home route after **30 seconds** and showed the loaded 3D view. Both the [initial report](../../../build/facility/facility-v7/simulator/simulator-capture-report.json) and [retry report](../../../build/facility/facility-v7/simulator/simulator-home-retry-report.json) are preserved.

The cause is **not established**. This sequence does not prove a cold-boot defect, a site readiness-timeout defect, or their absence. It does not establish LCP or the graphics-session readiness duration. Console, network, and timing evidence would be needed to diagnose it.

### Recordings

The capture command requested nine-second H.264 recordings for [iPhone 17e](../../../build/facility/facility-v7/simulator/iphone17e-demo.mp4), [iPhone 18 Pro Max](../../../build/facility/facility-v7/simulator/iphone18promax-demo.mp4), and [iPad mini](../../../build/facility/facility-v7/simulator/ipadmini-demo.mp4). The recordings exist and their capture processes exited successfully. They have **not been analyzed frame by frame**; they establish no claim about fan speed, LED timing, frame cadence, missed deadlines, or energy use.

The raw JSON reports intentionally retain `captured-needs-visual-review`: that is the capture script's status before inspection. The visual review above is the integration lead's subsequent review record; the raw reports have not been rewritten to imply automated visual acceptance.

## Unavailable checks and remaining gates

Safari and Simulator were not exposed through this session's computer-use surfaces. Available automation covered `simctl` boot, boot status, URL opening, screenshots, recording, and shutdown. The following were unavailable or not exercised:

- Safari Web Inspector console errors, network activity, and JavaScript/layout timelines.
- Native touch scrolling versus picking, orientation changes, browser-toolbar expansion, safe-area interaction, zoom/reflow, and form keyboard appearance.
- Native reduced-motion settings, background/resume interaction, explicit Retry, asset-switch gestures, and Safari Back/Forward interaction.
- VoiceOver and manual keyboard/accessibility review.

The separate Chrome/WebKit E2E checks cover some analogous behaviors, but do not turn these Simulator/manual checks into passes. Simulator rendering also does not establish physical iPhone/Android GPU performance, memory pressure, thermal response, energy use, or 15-minute sustained behavior. The unchanged simulated Lighthouse gate remains separate.

The earlier `baseline/home-v6-iphone17e.png` is historical v6 evidence only. No public deployment or complete mobile acceptance is claimed by this review.
