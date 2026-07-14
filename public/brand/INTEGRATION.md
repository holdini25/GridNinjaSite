# GridNinja website brand integration

`README.md` and the six SVG files supplied in the master archive remain canonical vector inputs. `assets/brand/gridninja-logo.png` is the canonical raster source supplied for browser, Apple touch, and standard install icons. All canonical inputs must remain byte-identical. Website-only SVGs, browser icons, install icons, and social exports are deterministic derivatives maintained by `scripts/generate-brand-derivatives.mjs`.

## Canonical source hashes

| Source | SHA-256 |
|---|---|
| `README.md` | `8c0fed4b0c3c76b5168813b534bcf359265d9d2976e1af04567d91afdb923366` |
| `gridninja-emblem-ceremonial.svg` | `85b8e3898842f9562f342cf7a976add81f28fb3df0ddd8ccbe7e7d9c39a8720a` |
| `gridninja-emblem-detailed-dark.svg` | `d8d9d2865e05e5171ce37b5c29ded7a26866c61e619c84429f66c8567a44a6d5` |
| `gridninja-mark-micro.svg` | `0b087bec57396488ef43cc8a9f7d540da95acd7e873af86efc39f141a3f14366` |
| `gridninja-emblem-monochrome.svg` | `27dde9a57aa6f2f195699b0d2a6007e894be865c49b587816e24777a97ecbfde` |
| `gridninja-badge-light.svg` | `1632c89ad277a9e24f383ec84fc89045dcc7d8d67a30b9fd600110f9d0b04a36` |
| `gridninja-favicon-proof-core.svg` | `e9b2ac6db468ae6eed4693c0ad37645a319754f16ea07751151265ecc2718955` |
| `assets/brand/gridninja-logo.png` | `e0d0da30b043d3a0d9a4eb7c2c61071cf583e50efb19f94075af9b06bb18b899` |

## Regeneration and validation

- `npm run brand:generate` verifies every canonical hash, extracts the approved globe/proof geometry, and writes all expected derivatives.
- `npm run brand:check` builds the same output map in memory and byte-compares it with the repository without writing files.
- `gridninja-watermark.svg` is derived from the detailed emblem's copper gradient, globe clip/grid, and proof-core path.
- `gridninja-proof-star.svg` is derived from the favicon proof core's copper gradient and star path.
- `/favicon.ico` contains only 16, 32, and 48px entries and is capped at 32KB. Its 16px layer uses the canonical simplified proof-core mark for tab-scale clarity; its 32px and 48px layers use the supplied raster logo. Standard install icons use a deterministic alpha mask that clears the outer canvas while preserving the navy contrast field behind the white guardians; the 180px Apple touch icon remains an exact opaque square resize.

The generated set also includes stable browser icons, Apple and PWA icons, maskable icons with conservative safe-area padding, the Open Graph emblem, and LinkedIn avatar/banner exports. Do not edit a derivative by hand; change the generator and regenerate the entire set.

## Browser and install presentation

- The 16px browser-tab icon uses the transparent proof-core mark; the 32px and larger standard icons preserve the canonical raster source's composition, retain the contrast needed by the white mark, and make the outer corners transparent. Apple touch and maskable icons remain fully opaque because those surfaces require a controlled field.
- The website emits stable, query-free icon links for `/favicon.ico`, `/gridninja-icon-192.png`, and `/gridninja-apple-touch-icon-180.png`; `/gridninja-icon-512.png` is used by install metadata.
- Maskable PWA icons render the detailed emblem at a nominal `0.72` scale on the full-bleed site background, leaving approximately 20–21% visible padding and keeping artwork inside the central 60% safe area.
- Square raster composites select an artwork size with matching canvas parity so left/right and top/bottom pixel insets remain equal.
- The standalone proof-star derivative retains the canonical copper path and gradient with a presentation-focused `13 13 38 38` viewBox for clarity in the 20px proof seal.

The website renders the monochrome master as a CSS mask backed by `currentColor`. Set `color` on `GridNinjaLogo`, `GridNinjaMark`, or their wrapper to select an approved one-color treatment. Direct `<img>` use of the canonical file continues to use its authored white default because external SVG images cannot inherit page CSS color.

## Motion-specific inline artwork

Motion is an optional presentation layer, not a new logo source. `micro-response` mirrors `gridninja-mark-micro.svg`; `guardian-wake` mirrors `gridninja-emblem-ceremonial.svg`. Inline copies exist only to expose stable semantic parts and per-instance SVG IDs.

- Motion may acknowledge interaction or reveal existing artwork. It must not encode ALLOW, REPAIR, REJECT, NO-PROOF, evidence completion, telemetry health, or runtime authority.
- Reduced-motion rendering disables staged drawing, glints, pulses, and spatial transforms. Only a restrained opacity or neutral color transition may remain.
- Browser/install icons, social exports, watermark, footer emblem, and proof seals remain static.
- When a canonical source changes through an approved brand update, update and visually compare its inline copy in the same change, then update the source hash here.
