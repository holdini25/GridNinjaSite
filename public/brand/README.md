# GridNinja SVG Master Kit

This package reconstructs the supplied GridNinja icon board as production-ready vector artwork. Every SVG uses native vector geometry, has a scalable `viewBox`, includes accessible title/description metadata, and contains no embedded bitmap.

## Files

| Asset | Intended surface | Minimum rendered size | Primary use |
|---|---|---:|---|
| `gridninja-emblem-ceremonial.svg` | Dark navy | 160 px | Hero art, About, launch screens, presentations |
| `gridninja-emblem-detailed-dark.svg` | Dark navy | 72 px | Primary emblem, social avatar, larger app surfaces |
| `gridninja-mark-micro.svg` | Dark navy | 24 px | Navigation, app rail, compact UI identity |
| `gridninja-emblem-monochrome.svg` | Any high-contrast field | 48 px | Proof packs, engraving, print and one-color output |
| `gridninja-badge-light.svg` | Light or photographic | 72 px | Light-mode surfaces, social and partner placements |
| `gridninja-favicon-proof-core.svg` | Dark navy | 16 px | Favicon, browser tab, dense operational chrome |

## Canonical colors

- GridNinja navy: `#07182B`
- Copper orange: `#F58220`
- Copper highlight: `#FF9A2E`
- Copper shadow: `#C9570A`
- Armor white: `#F7FAFC`
- Armor silver: `#D7E0E8`

The monochrome file is authored with `currentColor` and defaults to white. Set CSS `color` on the SVG or its wrapper to produce approved single-color output.

## Usage rules

- Keep clear space equal to at least 12.5% of the emblem diameter.
- Do not recolor the copper mark to represent ALLOW, REPAIR, REJECT, telemetry health, or authority state.
- Use the ceremonial mark once per screen and keep it out of dense operational panels.
- Use the dedicated proof-core favicon below 24 px; the twin-guardian micro mark is optimized for 24–64 px.
- Preserve the SVG `viewBox`; set rendered dimensions through CSS or `width` and `height` attributes at the call site.
- The transparent masters assume a `#07182B` or similarly dark field. Use the light badge when background color cannot be controlled.

## Web example

```html
<img
  src="/brand/gridninja-mark-micro.svg"
  width="32"
  height="32"
  alt="GridNinja"
/>
```

For a decorative duplicate beside a visible `GRIDNINJA` wordmark, use an empty `alt` value to avoid repeating the brand name to assistive technology.
