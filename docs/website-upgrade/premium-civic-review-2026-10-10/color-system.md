# Color and state specification

Status: proposed interface contract, not applied to the live site. Reviewed 10 October 2026. The [machine-readable palette](color-system.json), [CSS example](color-tokens.example.css) and [calculation script](generate-color-system.py) preserve exact sRGB values, their OKLCH coordinates and reproducible contrast results.

## Make the orange stronger by controlling its surroundings

Use the existing orange hue with quieter, slightly cooler surroundings. The primary canvas stays neutral black; raised surfaces move toward blue graphite at very low chroma. Orange is the strongest chromatic event in the interface. The brightest white belongs to the main reading anchors. This is a design hypothesis supported by established color relationships, not a measured conversion claim.

The palette uses OKLCH to compare perceptual lightness, chroma and hue, following [CSS Color 4](https://www.w3.org/TR/css-color-4/). The delivered hex colors are inside sRGB. The CSS example's OKLCH declarations describe those same colors; they are not a separate wide-gamut palette. OKLCH lightness is not WCAG relative luminance, so contrast is calculated separately from linearized sRGB.

| Role | sRGB | OKLCH L / C / hue | Use |
| --- | --- | --- | --- |
| Canvas | #080808 | 13.44% / 0 / — | Main narrative field |
| Graphite | #111315 | 18.54% / .0052 / 248° | Section and media support |
| Raised | #191C20 | 22.50% / .0090 / 256° | Interactive or grouped content |
| Focal white | #F4F7FA | 97.47% / .0051 / 248° | Headlines and meaningful values |
| Body | #CDD3D8 | 86.37% / .0095 / 243° | Primary explanatory copy |
| Supporting | #B8B8B8 | 78.26% / 0 / — | Qualifications, captions, research limits |
| Brand orange | #FF9F1A | 78.27% / .1685 / 66° | Primary action and a few diagram anchors |
| Paper | #E8EDF1 | 94.35% / .0076 / 242° | Localized decision-document inset |
| Paper ink | #1A2026 | 24.02% / .0145 / 248° | Text on paper |

The lightness steps for surfaces are intentionally small. Their computed contrast is insufficient for necessary control outlines: distinguish interactive boundaries with the separate control-edge token. The broad luminance jump to the paper panel is intentional and localized.

Apply six rules consistently:

1. **Warm–cool contrast:** warm orange touches cool graphite rather than warm brown. Preserve a neutral canvas so the page does not turn blue.
2. **Luminance hierarchy:** use focal white for headings, body gray for prose, supporting gray for qualifications. Supporting information remains fully readable; hierarchy does not justify tiny or faint disclaimers.
3. **Chroma hierarchy:** reserve orange for primary actions, selected facility details and meaningful emphasis. Do not color every heading, border and icon orange.
4. **Simultaneous contrast:** keep quiet space around an accent. Remove neighboring saturation before increasing orange brightness or adding glow.
5. **Figure–ground separation:** reveal equipment edges through broad material highlights and restrained fill light. Keep the black floor and avoid lifting every shadow. Essential diagram lines use an accessible solid token.
6. **Semantic separation:** orange identifies the brand/action, while REPAIR uses labeled ochre and a repair icon. Every state includes words and shape; a hue difference alone is inadequate.

Use a restrained complementary cyan only for evidence relationships that need a second series. It is subordinate to orange by area, not low text contrast. A cyan/orange glow aesthetic would conflict with the intended calm architectural treatment.

## State matrix

Ratios below are computed solid-color contrasts, rounded to two decimals. Text uses at least 4.5:1; essential graphical boundaries use at least 3:1. These calculations follow [WCAG text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) and [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html). They do not establish rendered-page conformance.

| Component/state | Foreground / background | Ratio | Additional treatment |
| --- | --- | --- | --- |
| Primary default | #080808 / #FF9F1A | 9.75 | Dark label; 48px minimum height |
| Primary hover | #080808 / #FFB44D | 11.34 | Slight lightness lift; no glow |
| Primary pressed | #080808 / #E98B0C | 7.79 | Darken fill; keep label stable |
| Dark-surface link | #FF9F1A / #111315 | 9.07 | Underline in prose; visible focus |
| Link hover | #FFB44D / #111315 | 10.54 | Retain underline |
| Secondary action default | #F4F7FA / #111315 | 17.32 | Essential outline uses #7B858E |
| Focus on raised surface | #FFB44D / #191C20 | 9.68 | 2px ring, 3px offset, dark gap around orange buttons |
| Necessary control border | #7B858E / #191C20 | 4.55 | Do not substitute decorative #2A3035 |
| Disabled control | #B8B8B8 / #191C20 | 8.62 | Explicit unavailable label, native disabled semantics; do not lower whole-group opacity |
| Supporting text | #B8B8B8 / #191C20 | 8.62 | Keep limits and provenance at readable size |
| ALLOW | #83D8AD / #191C20 | 10.09 | Check symbol and ALLOW label; model result only |
| REPAIR | #E2C168 / #191C20 | 9.82 | Repair symbol and REPAIR label; not brand CTA orange |
| REJECT | #FF8F91 / #191C20 | 7.81 | Cross symbol and REJECT label |
| NO-PROOF | #AFC2D6 / #191C20 | 9.37 | Question/document symbol and NO-PROOF label |
| Evidence line/label | #61E4FF / #191C20 | 11.44 | Use line pattern or direct label for a second series |
| Paper text | #1A2026 / #E8EDF1 | 13.93 | Selectable HTML, no gray microtext |
| Paper secondary | #485662 / #E8EDF1 | 6.40 | Includes immutable-record qualifications |
| Paper link/focus | #86420B / #E8EDF1 | 6.37 | Underline and offset focus outline |

White on brand orange is only **2.05:1** and must not be used for ordinary or large button labels. On paper, render state words/icons in paper ink; the dark-mode pastel state tokens cannot be used as small text on paper. A colored mark can supplement that text only after its necessary graphic contrast is checked. Likewise, errors in light forms use ink plus explicit error text/icon until a separately validated error pair is introduced.

For secondary-action hover, change the surface from graphite to raised while retaining the same label and control edge (15.90:1); pressed may use the canvas with the same border (18.63:1). Form inputs use heading/body text on raised, supporting text for placeholder/help, and control-edge borders. Selection uses dark lettering on orange. Inline links retain an underline in every state. These states reuse the checked pairs and require geometry checks in a rendered component sheet.

## Image and display discipline

Keep the current cinematic release's established SDR transform and record it for every new master/export. Do not change an immutable release to force it to match these tokens. New editorial stills should use neutral highlights and modest orange material accents, with responsive crops evaluated at actual card sizes. Poster and interactive-viewer fallback assets remain tied to their own renderer and release.

Use the current media matte (#010101) only immediately around cinematic media where needed to avoid a seam. A CSS black match cannot be inferred from a Blender viewport: compare the encoded WebP/MP4 and browser presentation. Do not clip highlights or crush important equipment detail while pursuing blackness.

Review a grayscale version to check reading order and figure separation, then the color version at low display brightness. These are qualitative checks, not substitutes for WCAG calculations. Verify on an SDR external display and a physical phone; this review has not calibrated the user's display or measured OLED shadow behavior.

## Implementation gate

All 19 generated solid-pair checks pass their declared thresholds. During later implementation, test composited backgrounds, actual font weight, focus geometry, selected/disabled/error states, forced colors, 200% text enlargement and 400% reflow. Check all thumbnails at 320/390px, at normal and low brightness. Do not mark these future checks passed from this palette calculation alone.
