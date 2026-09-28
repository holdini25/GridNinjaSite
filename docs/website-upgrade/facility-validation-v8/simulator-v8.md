# V8 iPhone Simulator Safari review

**Three routes and two facility views loaded and were visually reviewed. Native interaction and physical-device acceptance remain open.** The [structured report](simulator-v8.json) retains file hashes, timestamps, device identity and observations.

## Environment and scope

- Production build `Oa0RceKwM9TFRgBLqEMAB`, frozen `facility-v8`, served at `http://127.0.0.1:3000`.
- Existing **iPhone 17e**, iOS **27.0** Simulator; Xcode **27.0 / 27A266a**. Screenshots are 1170 × 2532 pixels.
- One boot only. The device began in **Shutdown** and was returned to **Shutdown**. No other devices were booted, software installed or global settings changed.
- Every Xcode command used `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`. The global directory stayed `/Library/Developer/CommandLineTools`.

The check used `simctl boot`, `bootstatus`, `openurl`, `io screenshot` and `shutdown`. All five PNGs were visually inspected. Native touch actions and Web Inspector were outside this check. The two generated heading fragments were read from the served HTML to bring the facility into view; they are capture aids, not stable navigation destinations. No readiness duration was measured.

## Screenshot observations

| Capture | Observed result |
|---|---|
| [Homepage](simulator/iphone17e-home.png) | Styled page, both assessment CTAs visible; historical-input and no-live-control qualification visible. |
| [Demo](simulator/iphone17e-demo.png) | Styled introduction, synthetic scope and no operational authority; scenario B selector visible. |
| [Assessment `#scope`](simulator/iphone17e-assessment-scope.png) | The scope heading is below the sticky header. Inquiry qualification and first form fields are visible. |
| [Homepage facility](simulator/iphone17e-home-facility.png) | Facility and live 3D controls visible, including **Illustrative activity on**, **Pause** and **Close 3D**. The one-hour window and 7.0 MW request are readable; Safari's toolbar partly covers the lower caption. |
| [Demo facility](simulator/iphone17e-demo-facility.png) | Facility visible with **Still for performance**, **Try motion again** and **Close 3D**. This records the adaptive still-state presentation; its cause and frame cadence were not measured. |

No obvious horizontal clipping appears in these captured viewports. This is a visual observation, not a DOM overflow assertion. Safari's bottom toolbar overlays part of the page; native scrolling and toolbar expansion were not tested.

## Remaining checks and evidence limits

The computer-use request for the Simulator app returned `Invalid app: Simulator`. No Safari Web Inspector session was attached, so JavaScript console errors, network requests and timelines are **unknown**, not passes.

Native taps, picking versus scrolling, link activation, form input/keyboard, rotation, zoom, browser-toolbar changes, reduced-motion settings and VoiceOver remain unverified. The rack hinge and tray were not operated in this Simulator check. The separate browser suites cover their own stated environments.

Simulator screenshots and the observed still-state fallback establish no physical iPhone GPU, memory-pressure, thermal, energy or sustained-performance result. They also do not establish LCP or animation cadence. No public deployment or complete mobile acceptance is claimed.

The attempted old-production before captures are invalid because the newer build replaced their referenced chunks. They remain preserved under `build/experience-v8/before/` with an invalidity notice. Genuine archived v7 screenshots there retain their original capture conditions and are historical visual references only; no matched before/after measurement is claimed.
