# Facility v4 — engineering inspection

This release extends the synthetic illustration on home and `/demo`. Assessment records and immutable publications remain authoritative. Animation, geometry and topology do not compute capacity or confer operational authority.

## Interaction

- The overview remains an architectural composition with four system controls. Amber activity uses a reproducible shuffled bag: 36 activity lamps, 12 steady lamps, at most three overlapping pulses. Four rotors retain independent phases; their guards stay fixed.
- Authored route geometry carries route identity and distance. Equipment selection, the connection diagram and HTML explanations share presentation targets. Traversal joins ports only through external routes or explicitly authored internal links.
- `/demo` has reviewed system framing, inline expansion, a manual assessment walkthrough and explicitly loaded rack/cooling assemblies. Closed, cutaway and service poses expose modeled internal construction; service/cutaway poses stop equipment activity.
- Pause, equipment preference and release-specific Close suppression persist in tab-session storage, with an in-memory fallback. Reduced motion preserves still interaction.

## Runtime and assets

The shell loads graphics after decoded-poster presentation and activation eligibility. V4 uses one manual renderer scheduler, one visible active-time clock, bounded activity slots and frame sample rings. Adaptive quality controls DPR, cadence and drawing-buffer size; hidden/offscreen sessions cancel pending work. A fixed-cadence diagnostic probe separates capability measurements from deliberate 30 fps ambient rendering.

Each explicit asset switch stages under an eight-second deadline. The previous scene remains usable until a valid replacement frame. Stale work is aborted/disposed; the renderer and studio environment are reused. No parsed-model cache is retained.

| Asset | Decoded GLB | Authored triangles | Authored draws |
| --- | ---: | ---: | ---: |
| Overview | 2,306,716 B | 32,734 | 39 |
| Rack | 917,232 B | 9,866 | 26 |
| Cooling | 546,792 B | 4,194 | 17 |

Runtime overview geometry includes the 48 instanced LED faces. Working byte targets are slightly exceeded for overview and rack; hard ceilings are satisfied. Browser allocation reports include textures, geometry, shared environment and temporary switching overlap.

## Reproduction

Use Node 22, npm and the existing lockfile. Native Blender 5.2.2 LTS is pinned in `assets-source/facility/toolchain.json`. The Python workflow is sufficient; no listening MCP bridge is required.

- Editable sources: `assets-source/facility/facility-master.blend`, `rack-specimen.blend`, `cooling-specimen.blend`.
- Authoring instructions: `assets-source/facility/README.md`.
- Frozen allowlisted release: `src/content/facility-releases/facility-v4/`.
- Browser capture and validation evidence: `docs/website-upgrade/facility-validation-v4/`.
- Intermediate outputs and full traces: ignored `build/facility/facility-v4/` and `build/facility/lighthouse-*/`.

All three saved masters independently re-exported byte-identical GLBs. Khronos validation returned zero errors; documented tangent-generation warnings remain. Source models and candidates are excluded from deployment traces. Earlier releases retain their existing bytes.

```sh
npm run dev
npm run facility:validate
npm run facility:verify-browser
npm run facility:measure
npm run facility:lighthouse
npm run facility:performance:validate
```

For a future candidate, choose a new release identifier; never modify a frozen release. Generate, stage, preview, capture browser posters, restage, validate and freeze through the existing scripts. A generation lease serializes authoring, capture and registration.

## Rollout and rollback

`FACILITY_ASSET_RELEASE=facility-v4` selects this local release. `FACILITY_3D_MODE` accepts `poster`, `manual`, `auto-desktop` and `auto-adaptive`. The local default is adaptive; poster mode rolls back graphics without changing assessments.

Public adaptive mobile rollout requires the production performance report plus physical iPhone/Safari, midrange Android/Chrome and manual VoiceOver/Safari acceptance. Browser emulation is recorded separately and does not satisfy those physical/manual gates. This implementation does not deploy the website.

## Startup investigation

Saved Lighthouse traces identify the SSR introduction as the mobile LCP element. A separated logo/client boundary and a six-chunk Turbopack experiment did not materially improve the measured simulated LCP (approximately 2.77 seconds); both experiments were reverted. Their raw reports remain under `build/facility/facility-v4/startup-experiment/`. The final corrected build still fails the unchanged simulated mobile LCP gate: 2,755.6 ms home / 2,748.8 ms demo. Homepage mobile TBT is 200.5 ms against its 200 ms limit. The twenty automatic-transfer/graphics runs pass; these startup failures remain public-release gates. See the recorded reports rather than treating collection completion as release approval.

## Final validation record

The corrected build passes 448 unit tests, lint, type checking and production packaging. Native motion/lifecycle checks, 22 responsive scene captures, 20 complete route/device transfer/graphics runs and a 15-minute M5 Pro Chrome session are recorded in [the evidence index](facility-validation-v4/README.md). The sustained report preserves cadence variation and measurement limits. Public rollout remains gated by the startup failures above and the required physical/manual checks.
