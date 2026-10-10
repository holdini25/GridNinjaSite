# Civic composition and seamless integration

The user supplied a photographic architectural reference for the second homepage visual. The implementation treats this as the civic section immediately after the assessment-first hero. Its art direction is adopted, while the approved offer, navigation and claims remain authoritative.

## Selected art direction

A detailed twilight data center, a separately fenced substation and a nearby neighborhood occupy one landscape. Cool graphite materials and quiet terrain give restrained warm physical lighting definition. No arrows, energy quantities, exported services, measured benefits, logos or in-image text are present. The facility fence illustrates a physical perimeter; it does not define an assessment boundary or operating authority.

The landscape reserves dark space for HTML copy. The mobile composition shows all three subjects in a vertical arrangement rather than discarding the grid and community through a center crop. Both compositions use the same fictional architectural concept. These are synthetic illustrations, not photographs of an actual facility or verified engineering drawings.

## Source and provenance

The built-in `image_gen.imagegen` tool produced both source masters on 10 October 2026. The tool did not report a model identifier; none is inferred. The exact prompts, arguments, source-output paths and edit relationship are preserved in [generation-record.json](../../../assets-source/civic/generation-record.json).

- [Landscape master](../../../assets-source/civic/generated-v1/landscape.png)
- [Portrait master](../../../assets-source/civic/generated-v1/portrait.png)

Masters remain outside public output. The immutable `civic-v1` delivery package contains only allowlisted responsive WebP derivatives. Its manifest records actual master dimensions and hashes, the generation-record and prompt hashes, packaging-tool versions and derivative hashes. Delivery performs compression and minimal aspect-ratio reconciliation; no creative raster editing is performed outside the image tool.

This civic artwork is **not** represented as locally ray-traced or as a Cycles/Metal result. The three architectural homepage thumbnails retain their separate, measured native Cycles/Metal provenance in [editorial-artwork.md](editorial-artwork.md). Two native civic studies were inspected and rejected for miniature-like materials and vegetation. Their source snapshots and disposition are retained privately under `build/qa/civic-native-studies`; they are not release assets or comparative performance evidence.

## Integration rules

- Keep the assessment-first hero and its two approved CTAs. The civic section expands the mission; it does not add deliverables to the assessment.
- Preserve the complete landscape width, especially the facility near the right edge. Limit the desktop text shield so the separate substation remains legible.
- Put mobile copy above the portrait. Keep all labels, qualifications and responsibilities in HTML.
- Repeat the same civic illustration in the relevant About and Platform contexts. Use shared canvas, typography, spacing and caption treatments rather than introducing a new visual system.
- Fade image edges into the existing canvas and use orange primarily for the mission emphasis, actions and selected diagram details. Architectural illumination remains restrained.
- Keep the visible “Synthetic concept” qualification adjacent to the illustration. Grid services, resource impacts and community benefits require separate evidence and review.
- Deliver static server-rendered markup, no new initial client JavaScript. Preserve the existing SVG as a no-JavaScript failed-media fallback and retain the complete HTML context.

## Review boundaries

Independent artwork reviewers accepted the landscape and reviewed the portrait's subject separation. This is a composition decision, not final browser, accessibility, performance, actual-reader or production sign-off. The replacement candidate must bind screenshots, delivery integrity, contrast, responsive behavior and measurements to its own source/build identity. Historical `fa933dc` evidence is retained without being relabeled as current.
