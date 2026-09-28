# Continuous neutral-black surfaces

Implemented the approved styling refinement on top of frozen facility-v7. Assessment copy, records, navigation behavior, model resources, and animation preferences are unchanged.

## Surface contract

| Role | Token | Value |
|---|---|---|
| Page and facility stage | `background` | `#080808` |
| Primary panels and inspector content | `card`, `surface` | `#101010` |
| Menus, inputs, raised controls | `popover`, `surface-2`, `secondary` | `#181818` |
| Neutral interaction fill | `surface-hover`, `accent` | `#202020` |
| Decorative separators | `divider` | White at 8% |
| Card outlines | `border` | White at 11% |
| Essential input boundaries | `input` | `#686868` |
| Focus | `ring` | `#ffbe63` |
| Main / supporting text | `foreground`, `muted-foreground` | `#F4F4F4` / `#B8B8B8` |

Removed the stacked body and hero amber gradients and generic panel gloss. The facility heading/stage retain the same black as its frozen posters; controls and explanations share one primary surface. Header/footer, menus, forms, assessment cards, and the legacy navy competitor panel use the same hierarchy. Native select and checkbox backgrounds are independent of their stronger border color. Amber interactions and localized engineering/outcome colors retain their meaning.

## Verification

- Lint, typecheck, and production build pass. Build: `nagPmMNkaGEO4KHOembT9`.
- Initial JavaScript: home 153.1 KiB, demo 156.0 KiB, assessment/contact 147.6 KiB Brotli; all below 180 KiB.
- Seven routes at desktop 1366×900 and mobile 390×844: home, demo, assessment, contact, AI Cloud, Colocation, Why GridNinja. All fourteen axe scans report zero violations; no horizontal overflow or page errors were observed.
- Computed styles confirm the page/stage at RGB 8, primary panels at RGB 16, and native/text inputs at RGB 24. Form focus remains visible with an amber boundary and ring.
- Seven targeted Chrome/mobile WebKit tests pass, with one intentionally skipped desktop-only navigation case. Coverage includes keyboard scenario changes, fixture D, facility selection/reset, submenu focus recovery, and mobile accordions.
- All 53 files under `src/content/facility-releases` are byte-identical to the pre-refinement baseline, including every approved model/poster/profile and release registry file.
- Calculated contrast: input boundary against raised surface 3.19:1; supporting text against the brightest neutral hover surface 8.21:1; main text 14.81:1. Decorative separators are not essential control indicators.

## Local evidence

- [Desktop before/after, left/right](../../build/neutral-surfaces/home-comparison.png)
- [Mobile, focused form, and demo review](../../build/neutral-surfaces/mobile-form-demo.png)
- [Computed surfaces and fourteen axe results](../../build/neutral-surfaces/after/report.json)
- [Targeted E2E results](../../build/neutral-surfaces/e2e.log)
- [Asset integrity](../../build/neutral-surfaces/asset-integrity.json)
- [Production build](../../build/neutral-surfaces/build.log)

Captures use reduced motion for consistency and can show the poster during loading. They verify styling, not live rendering cadence. Focus capture activated the local security-verification widget, which reported temporarily unavailable; no form submission was attempted. Existing facility-v7 mobile LCP and native/physical/manual release gates remain open. This styling pass does not claim a new Lighthouse or sustained-device result and does not deploy publicly.

## Borderless facility refinement

At the subsequent request to remove the visible enclosure, the facility outer border and corner radius are removed. Its base and toolbar now use the same `#080808` as the page and model stage; other cards retain the surface hierarchy above. Internal separators, selected-state indicators, and focus outlines remain available.

Production build `v3okYTa6jh2spF2vG1eNm` passes. Four live home/demo views at desktop/mobile sizes reached ready and verified zero outer border/radius, exact page-background matching, no horizontal overflow, and visible keyboard focus. See [borderless review](../../build/neutral-surfaces/borderless/report.json) and [build log](../../build/neutral-surfaces/borderless-build.log).
