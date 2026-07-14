# GridNinja website brand integration

`README.md` and the six SVG files supplied in the master archive remain canonical vector inputs. `gridninja-favicon-proof-core.svg` is the canonical source for browser, Apple touch, and standard install icons. `assets/brand/gridninja-logo.png` remains hash-locked as an archived supplied raster, but it is not used to generate favicon or install assets. All canonical inputs must remain byte-identical. Website-only SVGs, browser icons, install icons, and most social exports are deterministic derivatives maintained by `scripts/generate-brand-derivatives.mjs`. The LinkedIn JPEG and homepage search candidate are reviewed binary exports: the JPEG depends on system font rasterization, while the search candidate preserves approved supplied artwork without generative redrawing.

## Canonical source hashes

| Source | SHA-256 |
|---|---|
| `README.md` | `8c0fed4b0c3c76b5168813b534bcf359265d9d2976e1af04567d91afdb923366` |
| `gridninja-emblem-ceremonial.svg` | `85b8e3898842f9562f342cf7a976add81f28fb3df0ddd8ccbe7e7d9c39a8720a` |
| `gridninja-emblem-detailed-dark.svg` | `d8d9d2865e05e5171ce37b5c29ded7a26866c61e619c84429f66c8567a44a6d5` |
| `gridninja-mark-micro.svg` | `0b087bec57396488ef43cc8a9f7d540da95acd7e873af86efc39f141a3f14366` |
| `gridninja-emblem-monochrome.svg` | `27dde9a57aa6f2f195699b0d2a6007e894be865c49b587816e24777a97ecbfde` |
| `gridninja-badge-light.svg` | `1632c89ad277a9e24f383ec84fc89045dcc7d8d67a30b9fd600110f9d0b04a36` |
| `gridninja-favicon-proof-core.svg` | `ca2e916c85bdb9e9f62c7e1f4e4cf3d9faf0765b34b10abd12038b42753682c8` |
| `assets/brand/gridninja-logo.png` | `e0d0da30b043d3a0d9a4eb7c2c61071cf583e50efb19f94075af9b06bb18b899` |

## Approved favicon visual reference

The simplified proof-core geometry was approved from `ChatGPT Image Jul 14, 2026, 01_57_37 PM.png`, a 1254×1254 opaque RGB reference with SHA-256 `2df93b00e44105c0bbb99975b99188c6dbf95d2e29753d3c658874ac3f969360`. The reference is not a production raster master: the canonical SVG preserves its orange ring and enlarged four-point star while removing the opaque field, glow, and all nonessential detail.

## Approved reviewed binary exports

| Export | SHA-256 |
|---|---|
| `public/brand/search/gridninja-virtual-capacity.png` | `e49caec5c01d6852c247ac6f1226fa20923647029be5a5485d0f47cb9686a350` |
| `public/brand/social/linkedin-banner.jpg` | `5d26262e258bb67e86c8ba7def76f687a6d51e00db992d2e0215b8160ad4f8d2` |

The search candidate is derived from the approved 1254×1254 source image with SHA-256 `d45cea1b3d463f7afad4328b3069b99415f9b753201df2e16f095e5ba724e3e9`. The complete source was resized to 996×996 with Lanczos3 and centered on an opaque 1200×1200 `#010516` canvas. No text, generative edits, or artwork changes were introduced.

The generator verifies both final hashes before writing deterministic derivatives and never rewrites either reviewed export. To replace one intentionally, export and visually review the approved artwork, replace the checked-in file, and update the approved hash in the generator, tests, and this document in the same reviewed change.

## Regeneration and validation

- `npm run brand:generate` verifies every canonical and approved binary-export hash, extracts the approved globe/proof geometry, and writes all deterministic derivatives without touching either locked binary export.
- `npm run brand:check` verifies the locked binary export, builds the deterministic output map in memory, and byte-compares it with the repository without writing files.
- `gridninja-watermark.svg` is derived from the detailed emblem's copper gradient, globe clip/grid, and proof-core path.
- `gridninja-proof-star.svg` is derived from the favicon proof core's copper gradient and star path.
- `/favicon.ico` contains only 16, 32, and 48px proof-core entries and is capped at 32KB. The linked 192px icon, 512px standard icon, and `purpose:any` PWA icons use the same proof-core on transparent canvases. The 180px Apple touch icon uses the proof-core on an opaque `#07182B` field. Detailed maskable icons remain unchanged on their full-bleed site background.

The generated set also includes stable browser icons, Apple and PWA icons, maskable icons with conservative safe-area padding, the Open Graph emblem, the LinkedIn avatar, and the LinkedIn banner SVG. Do not edit a deterministic derivative by hand; change the generator and regenerate the entire set. Follow the reviewed replacement workflow above for either locked binary export.

## Browser and install presentation

- Every browser and standard PWA icon uses the transparent proof-core mark with no faces, globe lines, swords, or text. Apple touch and maskable icons remain fully opaque because those surfaces require a controlled field.
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
