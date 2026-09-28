# V8 visual comparisons

These are qualitative comparisons. The before images are genuine archived v7 captures at desktop 1440×1100 and mobile 390×844. Current production captures use desktop 1366×768 and mobile 390×844, with reduced motion and Save-Data for stable static presentation. They precede the final mobile assembly-control correction; homepage, decision and form layouts remain unchanged. Original reports and hashes are in [index.json](index.json).

The first attempted baseline capture from a stale running server was invalid and is excluded here. There is no valid matched assessment-page before capture. The earlier review's page positions are observations under its own conditions, not controlled before/after performance results.

## Homepage

| Archived v7 | V8 production |
| --- | --- |
| [Desktop before](before/home-desktop-dpr1-page.png) | [Desktop after](after/home-1366x768.png) |
| [Mobile before](before/home-mobile-dpr1-page.png) | [Mobile after](after/home-390x844.png) |

Both approved actions are visible at 1366×768. The offer leads with the paid assessment, authorized historical inputs and reviewable deliverable. Deep assembly controls move to the demo while the four-system rail stays on home.

## Demo

| Archived v7 | V8 production |
| --- | --- |
| [Desktop before](before/demo-desktop-dpr1-page.png) | [Desktop after](after/demo-1366x768.png) |
| [Mobile before](before/demo-mobile-dpr1-page.png) | [Mobile after](after/demo-390x844.png) |

The compact authoritative decision precedes the viewer in document order. Current 390×844 layout measures the decision at about 997 px, before the stage at about 1,928 px. Detailed conditions and evidence remain available below.

## Assessment form

- [Desktop introduction](after/assessment-1366x768.png).
- [Mobile form anchor](after/assessment-390x844-scope.png).

The form follows the compact offer/deliverables introduction. Its current document position is about 1,077 px at 390×844. Explicit `#scope` navigation clears the 70 px header with an approximately 86 px offset and gives the section focus.

## Construction and motion

- [Six assembly pose contact sheet](../visuals/specimen-contact-sheet.png).
- [Door opens, then tray extends](../motion/door-tray-sequence-chrome.webm).
- [Rapid reversal and independent cutaway](../motion/reversal-cutaway-chrome.webm).

The motion clips are automated Chrome test recordings on the final production build. They show intermediate mechanical behavior; they are separate from physical-device or participant evidence.
