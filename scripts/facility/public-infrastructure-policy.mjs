/** Exact public infrastructure contract. Unit tests derive and compare these
 * values against checked-in indexableSeoRoutes/absoluteUrl and the manifest
 * builder. Changes require that source parity to pass; never derive policy from
 * a served response or local .next. This file is bound by the harness digest. */
export const PUBLIC_SITEMAP_URLS = Object.freeze([
  "https://gridninja.ai/",
  "https://gridninja.ai/about",
  "https://gridninja.ai/about/founders",
  "https://gridninja.ai/assessment",
  "https://gridninja.ai/contact",
  "https://gridninja.ai/data-handling",
  "https://gridninja.ai/dcii",
  "https://gridninja.ai/demo",
  "https://gridninja.ai/evidence",
  "https://gridninja.ai/insights",
  "https://gridninja.ai/methodology",
  "https://gridninja.ai/platform",
  "https://gridninja.ai/platform/dispatch-envelope",
  "https://gridninja.ai/proof",
  "https://gridninja.ai/proof/proof-pack",
  "https://gridninja.ai/solutions/ai-cloud",
  "https://gridninja.ai/solutions/bridge-power",
  "https://gridninja.ai/solutions/colocation",
  "https://gridninja.ai/why-gridninja"
])

export const PUBLIC_MANIFEST = {
  "name": "GridNinja",
  "short_name": "GridNinja",
  "description": "Scope a paid, bounded capacity decision assessment using authorized historical inputs. Review the modeled result, its conditions, and the evidence still needed.",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#080808",
  "theme_color": "#080808",
  "icons": [
    {
      "src": "/gridninja-icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/gridninja-icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/brand/icons/pwa-maskable-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable"
    },
    {
      "src": "/brand/icons/pwa-maskable-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
