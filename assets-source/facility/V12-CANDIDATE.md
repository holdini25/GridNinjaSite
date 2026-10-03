# Facility v12 — private cinematic surface derivative

This is an unregistered visual candidate for the interactive demo. It does not
replace v11, the default frozen v10 release, or any published assessment. It is
not a claim of independent craft approval or native device performance. Its six
posters now come from matching native browser captures. No files are copied to
`public/`.

`browser-v12-recipe.json` pins the actual v11 parent manifest and the complete
surface recipe. Run from the isolated checkout with Node 22:

```sh
node scripts/facility/derive-surface-candidate.mjs
```

The command refuses to overwrite an existing candidate or registered release.
It writes `build/facility/facility-v12/release` and a preservation report beside
it. The manifest's optional `source.derivation` records parent manifest, recipe
and tool hashes. Parent Blender source hashes remain the parent lineage; this
candidate is a deterministic GLB/texture derivative, not a fresh Blender export.
The current Blender masters and original authoring modules remain unchanged.

## Visual changes

- Cooler graphite and neutral steel differentiate painted shells, trim, grilles
  and the platform. Copper keeps its established color, with 0.65 metalness and
  0.36 roughness. The collector's two existing roughness tiles use 0.54.
- The existing `face_a` and `face_b` metric UV tiles gain five and three coarse
  vertical formed louvers. Their dimensions follow the cinematic construction:
  7 mm relief, 1.2 mm bevel, 6.4% vent width and 90% vent height. The shared
  specimen's slightly narrower vents still include every louver. These are
  analytically authored tangent normals and roughness, **not a Cycles bake**.
- The two existing normal tiles retain the original perforation field between
  the formed surfaces. On each formed surface its fine normal contribution is
  reduced to 10%; a 4×4 integration over each atlas texel resolves the 1.2 mm
  bevel below the texel footprint. This removes the mottling observed in the
  first native service capture. Every AO and alpha texel, the color atlas, coil
  tile, rack door cutout, stationary contact and moving-joint boundaries remain
  unchanged. No shaded relief is represented as geometry or engineering data.
- A distinct `industrial-night-v4` reflection rig uses the same four temporary
  panels and 128-resolution owned environment allocation. Earlier presets are
  unchanged. Overview padding changes from 12% to 8%; perspective inspection
  cameras, FOV, articulated bounds and all mobile rack mechanics stay unchanged.

All geometry/accessor data, nodes, material assignments, semantic attributes,
topology, routes, picking proxies, pivots and UVs are checked byte for byte. There
are no new draws, materials, texture dimensions, passes or persistent GPU
resources. File transfer grows modestly because the normal/ORM pixels change:

| Asset | Candidate bytes | Change from pinned parent |
| --- | ---: | ---: |
| Overview | 2,391,336 | +26,476 |
| Rack | 702,040 | +26,496 |
| Cooling | 378,400 | +26,488 |

Those are encoded asset measurements. The matching native capture reports 39
overview draws, nine materials, 8,059,910 estimated owned bytes and 9,698,310
estimated peak bytes. Rack poses use 24–26 draws and eight materials; the highest
observed transition estimate is 12,108,401 bytes. Cooling poses use 14–17 draws
and seven materials. These are owned-resource estimates, not total browser or
driver memory. They do not establish page load or frame-time performance.

## Captured identity and author review

The final private release is `build/facility/facility-v12/release`.

- Final manifest: `95e5b6394da9183cdc57d00992407ffec4fd6d55d1674ffd9bb8d13b6955658f`.
- Recipe: `34d793700d6113749814153b0e09df8827d7add63e8513fb62f7db5f386443de`.
- Derivation tool: `745293c0416d1eafb6f65208afd66a5e5ca39bf46f101a1f8c749d9e8cea2b51`.
- Poster adoption tool: `e099684c3dfc495626f67505ae3d793872218070fb8ce2a7c56da85c47ca92ef`.
- Native capture report: `build/qa/cinematic-facility-v12/filtered-capture/report.json`,
  SHA-256 `d00489ffa4bf8b30c563ebcdbfbba08fec8cdef7c021343908f426d86daf15a2`.

All 12 native frames passed on Chrome 154 / Apple M5 Pro Metal. The report checks
the exact capture state, renderer budgets, unchanged source inputs and complete
browser/server cleanup. The captured pre-poster manifest was
`e5581d1771e8514721c38119da2e88a57181a7884c415f76a82888344d783078`;
poster adoption changed only the six poster records and files. The adopter
validated the complete bundle and recorded the digest transition in
`build/facility/facility-v12/poster-adoption.json`.

Actual-size author review covered overview/phone framing, all specimen poses,
system highlights and the matching compressed posters. A matched v11 service
capture showed that the initial unfiltered relief had regressed into mottled
normal detail. The bounded correction above produces orderly formed ribs and
retains the full phone silhouette. This is author review, **not independent
3/3 craft approval**, continuous interaction qualification or a publication gate.

All comparison evidence remains available:

- `build/qa/cinematic-facility-v12/parent-contact`: matching v11 baseline.
- `build/qa/cinematic-facility-v12/native-capture`: rejected unfiltered v12.
- `build/facility/facility-v12/attempt02-minification`: rejected bundle, recipe,
  derivation tool and first poster adoption record.
- `build/qa/cinematic-facility-v12/filtered-capture`: final native frames and
  six adopted WebP derivatives.
- `build/facility/facility-v12/pre-posters-e5581d1771e8`: exact final geometry
  and surfaces before matching poster adoption.

For a subsequent qualification capture, use the final digest and a new output
directory. Do not overwrite the completed evidence:

```sh
node scripts/qa/offline-facility-capture.mjs \
  --manifest build/facility/facility-v12/release/manifest.json \
  --manifest-hash 95e5b6394da9183cdc57d00992407ffec4fd6d55d1674ffd9bb8d13b6955658f \
  --scope release --profiles desktop-poster,mobile-native \
  --output build/qa/cinematic-facility-v12/qualification-capture
```

The existing authoring freeze command expects a direct source export and
should not be used to register this derivative. Its Blender hashes identify the
parent lineage; the optional derivation record identifies the actual texture
authoring. The master still hashes to
`47b60bb7112df7be958779aaf61cd44c135917b6f665590fe61cc38fcbc02a87`.
Publication remains a separate reviewed action.
