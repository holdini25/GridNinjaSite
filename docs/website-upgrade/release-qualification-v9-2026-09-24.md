# GridNinja RC13 — qualification conclusion

## Decision

**The local preview is implemented and available. Public release: no-go pending the explicit gates below.** The completed automated checks pass on the frozen candidate; full local qualification is incomplete because native UI access is blocked and Firefox cannot start. The visual review establishes release-acceptable engineering presentation, not the requested exceptional “Apple-level” craft score.

Preview: [Home](http://127.0.0.1:3000/) · [Demo](http://127.0.0.1:3000/demo) · [Assessment](http://127.0.0.1:3000/assessment#scope).

No public deployment, real inquiry submission, CAPTCHA completion or outbound delivery was performed. The report is an engineering qualification record, not an Apple certification or WCAG conformance claim.

## Delivered

- Prominent header/home orange actions say **Contact Us**, retaining their assessment-form destination and allowlisted context.
- Continuous neutral-black surfaces and borderless facility presentation remain. The DEMO-01/equipment/status/settings strip is removed; accessible Pause/Resume remains beside the heading, with preferences and **Use still image** inside **Display options**.
- Deferred assessment enhancement commits the validated record, controls, focus and publication destinations together. Native GET forms, modified clicks, real responsive posters, no-JavaScript content and explicit failure/Retry remain useful.
- Mobile decisions precede the inspector. Fixture B’s request, modeled result and unresolved commercial question fit the reviewed 390×844 initial viewport. The form heading/Name anchor clears the sticky header without forcing the keyboard.
- Navigation fallback, modal focus/inertness, verification exception handling, uncertain-submission recovery and enlarged-text layout defects are corrected.
- Rack actions retain mechanical interlocks, bounded 180 mm tray travel, cutaway visibility and interruption handling. Returning to the facility restores the stage and controls below the header without scrolling during door/tray actions.
- Facility-v9 adds slightly more reflective neutral powder coating and clearer service construction. The immutable **facility-v10** derivative corrects overly broad amber shading under orthographic projection, using the same model bytes. Earlier release/publication bytes remain unchanged.
- Qualification tooling binds evidence to source/build/harness/settings, rejects unexplained skips, preserves failed attempts, and makes missing staging-canary configuration fail rather than skip.

## Frozen candidate

| Identity | Value |
| --- | --- |
| Build | `MfRAjs1Ai_JwX1h6kgBZZ` |
| Source | `e695142db22f6f33b899f519c705e484c34309c9c5df4a0adac7b88c206b95ab` |
| Test harness | `7ea1773255484ecc051f9ce09d9427c8b1e94ac2158fdc1adbbcbb59be511e63` |
| Visual release / mode | `facility-v10` / `auto-adaptive` |
| Runtime | Node 22.23.2, npm 10.9.8, macOS 27 arm64 |
| Graphics qualification | Actual Apple M5 Pro, ANGLE Metal |

The repository’s unconfigured visual default remains v9. Reproduction must explicitly set `FACILITY_ASSET_RELEASE=facility-v10 FACILITY_3D_MODE=auto-adaptive` and use the runbook’s local verification test configuration. Changing source, assets, build, settings or harness invalidates this qualification. The ledger also contains exact lockfile, publication and all release-manifest hashes.

## Executed checks

| Check | Final result |
| --- | --- |
| Lint, typecheck, brand, production build | Pass |
| Unit invariants |693 pass across 73 files |
| Disposable PostgreSQL integration |4 pass; no external delivery |
| Experience/browser journeys |225 pass; 20 exact reviewed platform exclusions |
| Public routes |32 pass |
| Graphics/mechanics |164 applicable cases pass across Chrome, Chromium mobile, WebKit desktop/mobile |
| Material fixtures |48 pass at DPR 1/1.5 |
| Resource lifecycle |10 open/close +10 specimen cycles pass |
| Native headed Chrome visibility | Pass; actual hidden-document behavior, no hidden activity |
| Publications/content |106 resource GETs and 12 exact published payloads pass |
| Startup performance |30 fresh runs, five per route/device profile, pass |
| Automatic graphics transfer/cadence |20 samples pass; actual readiness costs included |
| Query/cold/warm diagnostics |20 pass; separate from Lighthouse gates |
| Native Chrome sustained operation |900 seconds pass, 892 samples |
| Production dependency audit |0 advisories |

Executed browser suites report zero final failures, retries or flaky outcomes. An additional exact closed-disclosure-to-connected-part focus probe passes at 1366×768 and 390×844; the disclosure opens and its selected part receives visible keyboard focus below the header. This is not a claim that the complete requested browser matrix passed: 47 required Firefox cases are blocked before page execution.

### Performance

| Route | Desktop median LCP | Mobile median LCP | Mobile CLS | Mobile TBT |
| --- | ---: | ---: | ---: | ---: |
| Home |0.601 s |2.449 s |0 |0 ms |
| Demo |0.625 s |2.449 s |0 |0 ms |
| Assessment |0.539 s |2.446 s |0 |0 ms |

These are local Lighthouse simulated-throttling measurements, not field percentiles or phone GPU results. All unchanged LCP≤2.5 s, CLS≤0.1 and TBT≤200 ms gates pass. Mobile LCP has only about 51 ms headroom; the desirable 2.2 s target is not achieved.

Initial JavaScript: 127.4 KiB home, 128.3 KiB demo, 134.8 KiB assessment/contact Brotli, below 180 KiB. Complete automatic experience: 940,522–993,222 bytes, below 1.5 MiB. Fixed-cadence p95 stays below 20 ms desktop/34 ms mobile. Intentional 30 fps ambient cadence is evaluated against its requested cadence.

The 900-second M5 run recorded zero hidden frames/errors, Balanced→High adaptation, CPU update/submission p95 0.7 ms, input-through-next-frame p95 32.8 ms and peak estimated allocation 9,605,862 bytes. Stable 10-cycle ownership counts are 39 geometries and 5 textures. These are renderer estimates, not measured GPU residency. `pmset` had no recorded thermal/performance-warning data; no temperature or energy claim is made.

### Asset and visual evidence

Overview: 2,258,812-byte GLB, 35,472 triangles, 39 draw calls, 9 materials. Rack/cooling: 769,212/364,592 bytes. Estimated staged peak 12,093,451 bytes; rack allocation 6,223,141 bytes remains close to its 6 MiB ceiling. No new render pass or environment-resolution increase was introduced.

Final evidence includes 53 canonical images, 24 supplements, 212 overlapping enlarged-text viewport/header captures across eight page/width combinations, eight loading/failure/recovery/still images, mechanical clips, and a 34-second ambient recording. Computed 200% text captures are explicitly separate from native Safari zoom and human assistive-technology review. Capture success alone is not visual approval. All seven reviewed categories score 2/3; no golden baseline is approved. Labelled contact sheets and targeted full-size images were reviewed, not every pixel of every enlarged-page tile. The conservative flash-area review covers 749 decoded frames over 29.96 seconds: the peak combined spatial union is 8,440 pixels against a 21,824-pixel reference area. This is a bounded sampled-area finding, not a flashing-rate or photosensitivity certification.

The core art remains a credible, readable engineering miniature. Broad planar surfaces still read uniformly; rack service actions are understandable but do not yet establish the required exceptional craft score. The next art pass should benchmark spatial contact/light bakes and suitable UV allocation on one rack/collector/cooler, then review actual mobile service framing and repeat affected gates. Increasing global gloss again is insufficient evidence of improvement. Any change must create a new immutable release and candidate.

## Unresolved gates and required action

| Gate | Current disposition / next action |
| --- | --- |
| Native Safari and three iOS Simulators | Mac was locked; CUA could not access native apps. Unlock was requested. Final native journeys and 900-second Safari observation remain unrun. Resume exact candidate using the prepared native plan. |
| Firefox |47 required cases blocked by local sandbox/SWGL launch failure, reproduced before page execution after clean official reinstall. Use a working supported host; no security bypass was attempted. |
| Exceptional visual bar | Current core craft scores remain 2/3; required core 3/3 is not established. Complete targeted art refinement and fresh reviewed qualification. |
| Development dependencies |14 development entries (six advisories/four leaf packages) remain with bounded reviewed local reachability/mitigations. Full audit is not clean; upstream remediation or explicit owner acceptance remains required. |
| Physical devices | Compact iPhone, midrange Android and non-Apple integrated GPU; sustained motion/adaptation/responsiveness and available thermal/energy observations. |
| Independent accessibility | VoiceOver/Safari and Windows screen reader, touch/focus/reflow/forms and human motion review. Axe/WebKit automation does not substitute. |
| Representative visitors | Two six-person rounds; round-two criteria and misunderstanding review remain unmeasured. |
| Staging and operations | Authorized dedicated recipients, actual verification/providers, durable receipt/outbox, recovery, deployment headers and rollback rehearsal. Local mocks do not prove delivery. |
| Editorial/privacy ownership | Verify supplied company facts, privacy/retention and operational responsibility before go/no-go. |

No unresolved local application critical/high failure was found in the executed final suites. This does not erase unexecuted coverage or the exceptional visual acceptance shortfall. Full local/public readiness must remain false in the authoritative ledger. A separate engineering reviewer verified 147 referenced artifact hashes and 19 full candidate bindings before closure reconciliation; the reviewed mutable-record snapshots are preserved.

## Evidence and handoff

- `build/qa/rc-13/candidate.json`: authoritative append-only gate/attempt ledger.
- `build/qa/rc-13/closure.json`: final disposition, evidence hashes and unresolved gates.
- `build/qa/rc-13/defect-register.json`: prioritized issue status and current evidence.
- `build/qa/rc-13/browser-chain-summary.md`: experience, graphics, material and lifecycle reports.
- `build/qa/rc-13/performance-disposition.json`: startup/transfer/query/sustained evidence; raw traces retained.
- `build/qa/rc-13/final-independent-evidence-review.md`: independent engineering reconciliation; historical input snapshots preserved in `closure-input-reconciliation.json`.
- `build/qa/rc-13/native-disposition.json`: native blocker, completed Chrome scope and exact resume procedure.
- `build/qa/rc-13/security-local-disposition.json`: scoped security disposition and residual dependencies.
- `build/qa/rc-13/visual-review/`: contact sheets, actual reviewer judgments and image/video index.
- `assets-source/facility/`: editable Blender 5.2.2 LTS sources/generators; `build/facility/facility-v9/` and `facility-v10/`: frozen asset handoffs.
- `docs/website-upgrade/qa-candidate-runbook.md`: reproducible local commands/settings.
- `docs/website-upgrade/qualification-handoff-and-rehearsal.md`: prepared external/staging/rollback procedure, not executed evidence.
- `docs/website-upgrade/experience-v8-usability-protocol.md`: participant research protocol.

Earlier RC01–RC12 reports and failed experiments remain preserved. The pre-closure narrative is retained at `build/qa/rc-13/qualification-report-pre-closure.md`. Two RC13 collector setup failures occurred while locating replaced static content, before runtime measurements; exact bounded acquisition corrections and original failures are retained. Enlarged-page capture and clip-decoder limitations are likewise recorded separately from application defects. No assertion, budget, required-case list or frozen source was relaxed to manufacture readiness.

Retain `poster`, `manual`, `auto-desktop` and `auto-adaptive` rollback modes. A reviewed go/no-go record is required before public deployment; incorrect assessment evidence, inquiry loss, critical accessibility failure or repeated graphics crashes require rollback.
