# Facility-v6 asset evidence

These reports describe the frozen Blender-authored local release and its browser
review captures. They do not establish facility performance, equipment ratings,
thermal behavior, workload allocation, or operational authority.

## Final measured assets

| Asset | GLB bytes | Authored triangles | Closed browser draws | Runtime materials |
|---|---:|---:|---:|---:|
| Overview | 2,333,504 | 34,672 | 39 | 9 |
| Rack specimen | 762,700 | 9,290 | 25 | 8 |
| Cooling specimen | 379,796 | 4,194 | 17 | 7 |

The overview is **33,504 bytes above the 2.3 MB working target**, and below the
2.5 MB ceiling. The added overview construction uses 1,768 more authored
triangles than v5. Browser geometry includes another 576 overview LED triangles
and 96 rack specimen LED triangles.

All three actual GLBs pass Khronos validation with **zero errors and warnings**.
The overview is SHA256
`23621828e4bbb31d4299a0e3daa1ca693d6a127c66a4e6a8a4d8c212f4c4d723`.
The rack is `f2d2b2ce3ead78dbcbe332e351b9b8af7c2a0dd04080917c37c53b85a00cfb1e`;
the cooler is `36d432e515da3aab8a4de67dab83424c5c2995b154f4792753e2fe8f6e338d69`.

The browser capture reports estimated retained allocations of **7,958,342 bytes**
for the overview, **6,258,101 bytes** for the rack, and **5,719,236 bytes** for the
cooler, including the shared studio environment. Peak staged allocation in the
48-state review is **12,119,291 bytes**. The rack retains only 33,355 bytes below
its 6 MiB ceiling; further construction must preserve that headroom. These are
instrumented allocation estimates, not measured device-wide memory or energy.

## Independent construction and export checks

- The exported topology contains **31 equipment identities, 46 routes, 108
  ports, 39 exact branches, 20 internal passages, and four thermal couplings**.
  All twelve rack itineraries terminate at their selected branches.
- **70 authored air-route/passage segments** pass two-sided ray/triangle tests
  against stationary visible exported geometry. The check excludes moving fan
  blades, selection inlays and picking proxies. It catches plugged junctions and
  decorative surfaces blocking the representative passage; it is not CFD.
- Four corrupted GLB fixtures reject with their expected reasons: displaced
  branch, cross-fluid passage, obstructed rack passage, and missing section root.
- Saved overview, rack and cooler masters re-export byte-identically in three
  fresh pinned Blender 5.2.2 LTS processes. This does not claim two complete
  procedural generations and Cycles bakes were compared.
- Buffer deduplication compares all logical glTF fields, exact view payloads,
  and effective strides. Geometry, normals, UVs, textures, IDs and route distances
  are unchanged. Every shared vertex buffer view declares the required stride.
- Normal preservation and the three validation reports include corner-normal,
  UV-seam, tangent, surface-role, texture-channel and embedded image checks.
  `bake-report.json` records the actual Cycles bakes and metric UV footprints;
  there is no separate standalone UV report.

`packaging-verification.json` checks the final GLB hashes against asset reports,
validation reports, saved-master evidence, embedded topology, staged files,
poster capture provenance, 48-state review and material-channel captures.

## Curated visual evidence

The sibling `visual/` directory contains the neutral/four-system contact sheet,
all six specimen poses in a contact sheet, selected desktop/mobile views and
close-ups, plus rack/cooling gray-normal-roughness-final contact sheets. The
reports point to the complete image sets retained under
`build/facility/facility-v6/`.

Captures use actual browser rendering. DPR review overrides are explicitly
recorded and must not be treated as natural adaptive performance measurements.
Models, raw candidate GLBs, complete capture sets and editable `.blend` sources
are intentionally absent from this documentation folder. Public release gates
and route/device performance are documented separately by the integration lead.
