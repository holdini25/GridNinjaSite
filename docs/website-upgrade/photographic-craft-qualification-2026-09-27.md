# Photographic craft refinement — qualification11

## Decision and scope

**Private candidate delivered for review. Local qualification remains blocked on craft approval and complete Simulator interaction coverage. Public release is not approved.**

This phase implemented the guided rack service journey and corrected browser poster sampling. Controlled rack-contact, collector-contact and point-light experiments were completed and rejected because they did not produce a convincing improvement at the displayed size. The existing subtle graphite finish, geometry, lighting and material profiles are retained.

The candidate is reproducible in `/private/tmp/gridninja-premium-v11-qualification11`, served locally at `http://127.0.0.1:3002`. Its source snapshot, settings and exact assets are recorded in `build/qa/craft-qualification11/candidate.json`. The source repository's public registry still stops at facility-v10. Nothing in this report authorizes deployment or an outbound inquiry test.

| Identity | Value |
| --- | --- |
| Build | `ik4TP-jKgnqFzYPZFUoT9` |
| Source fingerprint | `ff95c01dc177a77d54638626cf87a6ab65b779e7bee7152a9fabf1255cb03db2` |
| QA harness | `38d937977c5066ca3d42fb574a11ef6ad45835dabd024c6096475874915a6d04` |
| Private v11 manifest | `3cb7f51d01363f11d91d694dc3b27906210b3d7d02300be76f2d18f7b8773ea3` |
| Runtime | Node 22.23.2; npm 10.9.8; existing lockfile |
| Configuration | Auto-adaptive; enforced CSP; local HTTP; test verification; production observability disabled |

This configuration is intentionally distinct from production HTTPS, live verification, Analytics and Speed Insights. Its measurements cannot qualify those dependencies.

## What changed

### Guided service

The primary action follows committed, rendered mechanical state:

**Open door → Extend server tray → Inspect service connection → Return to whole assembly → Retract server tray → Close door.**

- Alternate valid retract/close actions remain in **More inspection options**. Inspection is optional.
- Pending labels describe the action in progress; a requested state is never presented as a completed endpoint.
- Same-rack commands preserve equipment and selected-part context. Transient inspection history resets when the extension cycle or assessment context changes.
- Returning from connection detail retains the open door, extended tray and removed side panel. **Restore side panel** is explicit.
- Focus returns to the inspection action only when the visitor has not expressed a newer focus, scrolling or navigation intent.
- A discovered offscreen-transition deadlock was corrected: explicit detail navigation reveals the stage before asking its visibility-governed scheduler to complete the camera transition. Ordinary visible mechanical actions do not scroll the page.
- Existing interlocks, reversals, 180 mm travel, reduced motion, Pause, Still mode, single canvas and scheduler remain authoritative.

### Production-rendered posters

The private loopback harness mounts the actual production Canvas and EngineeringSession. An optional injected capture port coordinates with the existing frame owner. Public components never supply that capability.

Each transaction verifies release, model hash, generation, presentation, settled motion, actual CSS dimensions and drawing buffer, and records the active camera matrices and target. PNG and metadata come from the same proven current-model frame. The implementation rejects or cancels invalid transactions and restores temporary settings. Mocked adapter tests cover identity, stale completion and deadline boundaries. Real Metal fault injection additionally verified abort, DOM resize, overlapping requests, context loss and teardown after the actual drawing buffer reached 1020 × 765 at DPR 3. Surviving abort/resize sessions restored their observed DPR 1 / Economy settings and completed subsequent captures; lost or disposed contexts rejected without returning a PNG. This does not establish every quality-tier combination. Both a timer and monotonic completion-boundary checks enforce the eight-second deadline.

Desktop and specimen sources are actual **1360 × 800** pixels. The selected mobile source is **1020 × 765**, downsampled to the unchanged **680 × 510** delivery size. At actual phone size it produced slightly calmer diagonal and fan edges than native 2×, while encoding smaller at the unchanged Q82 setting. Mobile anisotropy remains 1; desktop is device-capped at 2. Public live DPR limits are unchanged.

Only the six existing allowlisted WebPs and their file descriptors changed. No new resolution variants, textures, material splits or runtime models were introduced.

## Controlled experiments and disposition

| Experiment | What was controlled | Result |
| --- | --- | --- |
| Stationary slot-2 module contact | Evaluated receiver frame; only its invariant faceplate/latch/vent construction; excluded moving parts and surroundings | Reject. Subtle source-pixel darkening did not clarify construction at displayed size. The target also lies mostly outside the service-connection view. |
| Rack 03 collector flange contact | Seam-local UV allocation; repeated co-moving cover contact; stationary interiors and neighboring equipment excluded | Reject. Existing geometry already carries the seam. Added AO did not justify donor remapping and tessellation. |
| Reflected finite point-light position | Exact position reflected across the receiver plane; unchanged exposure, intensity, environment, materials and camera | Reject. Tray supports, connector and side surfaces became less readable. |
| Correct poster sampling | Same camera, material, selection and delivered dimensions; native 2× versus 3× downsampled comparison | Retain. Final page and poster-recovery checks pass. Clear improvement over the former upscaled source; smaller differences between the two genuinely sampled alternatives. |

Baseline, UV-only and contact-on variants, editable generated masters, source patches, bake ownership, failed attempts and export checks remain under `build/qa/craft-refinement-20260927/contact/`. The small AO coupons executed on CPU with two threads, 64 samples and seed 19. Browser shader/render/capture work used the M5 Pro Metal GPU. Available Metal configuration is not evidence that these CPU bakes ran on the GPU.

Contact and lighting judgments use matched 340 × 255 diagnostic stages and source-pixel crops. The real portrait rack stage is taller; those comparisons do not replace its final page review. Rejection means insufficient evidence to adopt a change, not a claim that every possible display size was tested.

## Resource and preservation evidence

Independent read-only reconciliation passed for all 37 authoring inputs, 82 historical release files and 21 publication files. All three retained GLBs are byte-identical to qualification10. Fresh validators reported zero Khronos errors or warnings.

| Asset | GLB bytes | Rendered triangles | Draws / materials | Recorded estimated asset/environment allocation |
| --- | ---: | ---: | ---: | ---: |
| Overview | 2,364,860 | 35,516 | 39 / 9 | 8,059,910 B |
| Rack | 675,544 | 8,456 | 26 / 8 | 6,145,643 B |
| Cooling | 351,912 | 4,194 | 17 / 7 | 5,727,660 B |

The overview passes the 2.5 MB hard ceiling but misses the 2.3 MB target. It has no draw-call headroom. The rack has 145,813 bytes below its 6 MiB allocation ceiling; this corrects the older approximate 60 KB estimate. Maximum recorded staging is 12,108,401 bytes, below the 16 MiB target. These are application accounting estimates, not measured physical GPU memory.

Overview posters are 40,096 bytes desktop and 19,964 bytes mobile. All specimen posters are below 60 KiB. Total poster bytes increased by 24,228; the final complete-transfer measurements include that change.

Offline framebuffer allocation is separate: the desktop estimate is 39,168,000 bytes for the recorded MSAA/color/depth assumptions, excluding driver and compositor resources. It is not retained asset allocation.

## Qualification status

The authoritative [evidence index](/Users/holdenchung/repos/GridNinjaSite/build/qa/craft-refinement-20260927/evidence/FINAL-INDEX.md) records **11 passing gates and 10 blocked gates**. The two local blockers are complete Simulator interaction coverage and photographic-craft acceptance; eight external gates remain blocked. Historical qualification10 results are preserved and are not substituted for candidate11 execution. Raw failures and their explicit resolutions remain in the ledger. The supplementary phone visibility failure is recorded independently and is not converted to a pass.

Already established:

- Production build, lint, TypeScript and brand checks passed.
- 984 unit tests across 105 files passed, plus isolated local database integration.
- Production dependency audit reported zero vulnerabilities.
- Native Linux Firefox functional checks passed in an isolated runner. That software-rendered result does not establish Apple GPU performance.
- Native Safari 27 completed the guided service flow, focus return, mechanical closure, Pause, still fallback and Contact Us form anchor on the visible page.

Safari's first attempt was invalid for visible-page qualification: macOS reported the page hidden. After the user brought Safari to the foreground, the same candidate loaded and completed the journey. The temporarily enabled developer setting was restored and verified off. The bounded journey does not establish Safari GPU cadence, sustained behavior or VoiceOver conformance.

The first full browser matrix was interrupted to use that foreground Safari opportunity. Its partial output is retained and does not qualify the candidate. The complete second matrix exposed two test-navigation assumptions: secondary rack controls now require opening their native disclosure, and moving keyboard focus below the mobile stage correctly suspends camera frames until the stage becomes visible again. The test amendments retain all original material, pose, assessment, resource, canvas and focus assertions, and add zero-hidden-frame checks. Their external, hash-bound execution is recorded separately; the frozen application and original QA files are unchanged.

One WebKit phone story run entered the protective Still tier before reaching the required active cooling-evidence stop. Three fresh executions of the unchanged test, original instrumentation and required-active flag reached that stop in Economy with zero hidden frames. The original observation remains unresolved as a timing cause: its sampled window reset on demotion. Passing follow-ups demonstrate the active path; they do not prove that the early demotion cannot recur or replace separate performance/device qualification.

The real capture-fault harness's first attempt also exposed an evidence-recorder race: the application rejected context loss before a later test listener had recorded the event. The bounded amendment waits for the actual event and callback delivery, removing no assertions. The second attempt passed all four faults and six successful frame receipts. Both attempts and executed script hashes are retained.

### Final browser and page checks

The complete raw matrix records **615 passes, 7 failures and 38 exclusions**. It remains a failed raw attempt. An independently reviewed, hash-bound reconciliation combines those results with eight passing amended test executions and three unchanged active-story diagnostics to establish **622 required functional cases satisfied, 38 reviewed exclusions and zero unresolved functional coverage entries**. This is not a claim that the raw matrix passed cleanly. The unknown-cause WebKit Still observation remains a medium diagnostic follow-up.

Seven subsequent checks passed: poster recovery, 15 responsive page views, query-entry startup, graphics lifecycle, service motion, visual states and ecosystem states. Lifecycle coverage includes ten open/close and ten overview/specimen cycles. A separate headed native Chrome visibility check passed with no skips.

Direct image review confirmed the primary home action at 1366 × 768, decision-first demo content at 390 × 844 and an unobscured assessment heading and Name field. Across the five layout widths there was no horizontal overflow. Phone form heading positions were approximately 86 pixels below the viewport top. Actual portrait service captures show the door, extended tray and rails, with the next action adjacent to the stage. The connector remains a small subject even in detail.

The current service capture demonstrates monotonic extension with a stationary camera, followed by camera-only detail entry and return. Separate matrix recordings cover reversals and interruption. Motion footage, static judgments and mechanical assertions are identified separately in the evidence index.

### Additional visible phone motion capture

A separate 390 × 844 touch-emulated Chrome/Metal recording shows genuine partial door and tray reversals, full extension and detail entry while the model remains visible. Its strict full-stage visibility check **fails on return**: 13 of 57 sampled frames overlap the sticky header by approximately 9 pixels. The rack construction remains visible, but restored focus scrolls the supplementary handle rail behind the header after settling. The adjacent primary Retract and secondary Close actions remain visible. This is recorded as a low-priority discoverability defect; the later closure step was not reached in this supplemental recording. Existing functional and mechanical suites cover closure independently.

The first attempt also failed to save remote-browser video because its recorder used an unsupported path API. A recording-only amendment uses the supported save operation after context closure; the second attempt preserves a motion clip and the same failed visibility assertion. Neither attempt is rewritten as a pass.

### Fresh local performance

All 30 Lighthouse observations and 20 complete-through-readiness measurements are retained. Collection used one worker with other graphics work stopped, the unchanged qualification10 launch configuration and the actual Apple M5 Pro Metal renderer. The agreed median aggregation passes; the result is not an all-observations pass.

| Route | Desktop median LCP | Mobile simulated median LCP | Complete automatic transfer, desktop / phone emulation |
| --- | ---: | ---: | ---: |
| Home | 0.599 s | 2.448 s | 976,287 / 956,155 B |
| Demo | 0.556 s | 2.446 s | 1,010,464 / 988,063 B |
| Assessment | 0.534 s | 2.444 s | No facility; Lighthouse transfer 238,651 B |

Two mobile-home observations were **2.533 s and 2.531 s**, above the 2.5-second threshold. The other three determine the passing median. The approximately 52 ms median headroom is narrow and does not meet the optional 2.2-second aspiration. Failed observations are not discarded or replaced by reruns.

Median TBT is 0 ms on all six profiles; the largest individual value is 2 ms. The largest observed CLS is approximately 0.00138. Fixed 60 fps capability p95 is at most 16.8 ms across all twenty graphics runs. Deliberate ambient operation is 30 fps with a 33.4 ms interval; it is evaluated against requested cadence separately. Pause settlement passes. Initial route JavaScript remains below 180 KiB Brotli: home 127.3 KiB, demo 129.9 KiB, assessment 134.7 KiB.

These are local HTTP, test-verification, observability-off measurements. Phone results are emulation on the Mac GPU. They do not establish physical mobile cadence, field Core Web Vitals, production-configured performance or manual accessibility conformance.

### Native sustained observation

The native Chrome/Metal run completed 900 seconds of wall-clock observation, but **failed sustained qualification**: the page became hidden between approximately 635 and 725 seconds. The collector credited only 805 seconds as visible/active and 795 seconds as cadence-compliant, below the required durations. The cause of window occlusion is not established.

The 181 observations recorded no browser errors, context loss or hidden frames. Geometry and texture counts remained stable. The page froze while hidden and resumed when visible; no elapsed hidden-time replay was observed. Quality ranged from Balanced to High. Sampled ambient frame-window p95 was 35 ms and CPU update/submission p95 0.9 ms; these are 30 fps ambient observations, not the separate fixed 60 fps capability test or GPU timestamp measurements. The observed live DPR was 1. All owned browser resources were closed.

This first result is preserved as a failed qualification attempt. After the user confirmed that Chrome could remain visible, a fresh second run passed the unchanged sustained contract: **900.004 seconds visible and active**, 181 samples, no browser errors, context loss or hidden frames, and stable 39-geometry / 5-texture counts. Cadence-qualified time was 890.004 seconds, with zero late observation intervals. Its sampled ambient-window p95 was 35 ms and CPU update/submission p95 0.9 ms. The actual backend was Apple M5 Pro Metal; observed live DPR was 1. The owned browser closed successfully.

The second run resolves native Chrome sustained qualification for this machine and configuration. Both attempts remain available. Neither run measures GPU timestamps, temperature, energy, physical phones or Safari sustained behavior. Simulator evidence is recorded separately.

### Xcode Simulator observations

Xcode 27 / iOS 27 URL-entry captures cover home, demo and assessment on iPhone 17e, iPhone 18 Pro Max and iPad mini. Static image review found readable offer/decision content and the form heading and Name below the sticky header. The compact home first appeared blank at four seconds; that observation is retained alongside a loaded 15-second recheck. No cold-load performance conclusion is drawn.

Full Simulator interaction qualification is **blocked**: the supported computer-use surface could not select Simulator, and Device Hub selection timed out. CLI URL entry and screenshots do not establish touch scrolling, picking, orientation, keyboard, Back/Forward, reduced-motion, background/resume or Retry. All owned Simulator devices were shut down; no global Xcode setting was changed. These observations are separate from native Safari, browser emulation and physical-device evidence.

## Craft acceptance and remaining release gates

Improved sampling and guidance do not establish photographic craft at 3/3. Existing comparative review is explicitly **AI-agent review**, with confidence and evidence coverage recorded separately. The retained construction remains provisionally 2/3. Independent human assessment and an unfamiliar visitor's unassisted service journey remain unassessed.

Public release still requires:

- Independent human approval of surface readability, composition and rack-service clarity at the agreed 3/3 bar.
- Production-configured HTTPS, observability and live-verification performance qualification.
- Physical compact iPhone, Android and non-Apple GPU validation, with sustained operation and recovery evidence.
- Independent screen-reader review and the two six-person usability rounds.
- Named, confirmed staging recipients and primary/backup operators; authorized durable receipt → provider acceptance → signed recipient delivery → acknowledgement rehearsal.
- Operational failure/recovery, retention, restoration and rollback verification, followed by the independent go/no-go record.

Simulator, browser emulation, automated accessibility assertions and AI image review must remain separately labeled. No approval is inferred from elapsed time or a passing software test.

## Rollback and reproduction

The canonical default is still facility-v10. The private candidate adds v11 only inside its isolated checkout. Preserve the current inquiry safeguards when preparing any rollback deployment; visual mode changes do not roll back database or scheduling configuration.

The [archive restoration recipe](/Users/holdenchung/repos/GridNinjaSite/build/qa/craft-refinement-20260927/evidence/archive-recipe03.md) preserves the source inventory, original QA, exact `.next` artifact, editable masters, rejected experiments and all failed/successful observations. Dependencies are reconstructed from the pinned lockfile; this is not a self-contained offline installation. Eighteen intentional test-overlay links are metadata records only, never traversed or embedded as archive links.

Use the exact candidate environment and build once per artifact. The preserved snapshot recipe accepts an explicit release directory, verifies copied source/dependencies and refuses stale qualification identity. Browser qualification uses fresh attempt directories and capability-based skip policies. Failed attempts remain available.

No deployment, migration, real inquiry submission or operator notification was performed by this craft phase.
