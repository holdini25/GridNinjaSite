import type { GetStaticProps, InferGetStaticPropsType } from "next"
import Head from "next/head"

import MarketingLayout from "@/app/(marketing)/layout"
import { ContactPageContent } from "@/components/marketing/contact-page"

type ContactPageProps = {
  observability: boolean
  title: string
  canonical: string
  meta: Array<{ name?: string; property?: string; content: string }>
  jsonLd: string
}

// Static props keep the SEO registry and schema builders out of this route's
// browser bundle. The existing form owns every inquiry and recovery interaction.
export const getStaticProps: GetStaticProps<ContactPageProps> = async () => {
  const [{ getSeoRoute }, { absoluteUrl, isPreviewDeployment }, { buildSeoGraph, serializeJsonLd }, { socialImageAlt }] = await Promise.all([
    import("@/seo/route-manifest"),
    import("@/seo/policy"),
    import("@/seo/schema"),
    import("@/lib/seo"),
  ])
  const route = getSeoRoute("/contact")
  const preview = isPreviewDeployment()
  const canonical = absoluteUrl(route.path)
  const image = absoluteUrl(`/og/${route.socialImageKey}`)
  return { props: {
    observability: process.env.VERCEL === "1",
    title: route.title,
    canonical,
    jsonLd: serializeJsonLd(buildSeoGraph(route)),
    meta: [
      { name: "description", content: route.description },
      { name: "application-name", content: "GridNinja" },
      { name: "robots", content: preview ? "noindex, nofollow, noarchive" : "index, follow" },
      ...(!preview ? [{ name: "googlebot", content: "index, follow, max-video-preview:-1, max-image-preview:large, max-snippet:-1" }] : []),
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "color-scheme", content: "dark" },
      { name: "theme-color", content: "#080808" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "GridNinja" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { property: "og:title", content: route.title },
      { property: "og:description", content: route.description },
      { property: "og:url", content: canonical },
      { property: "og:site_name", content: "GridNinja" },
      { property: "og:type", content: "website" },
      { property: "og:image", content: image },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:type", content: "image/png" },
      { property: "og:image:alt", content: socialImageAlt },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: route.title },
      { name: "twitter:description", content: route.description },
      { name: "twitter:image", content: image },
      { name: "twitter:image:width", content: "1200" },
      { name: "twitter:image:height", content: "630" },
      { name: "twitter:image:type", content: "image/png" },
      { name: "twitter:image:alt", content: socialImageAlt },
    ],
  } }
}

export default function ContactPage({ title, canonical, meta, jsonLd }: InferGetStaticPropsType<typeof getStaticProps>) {
  return <>
    <Head>
      <title>{title}</title>
      <link rel="canonical" href={canonical} />
      <link rel="manifest" href="/manifest.webmanifest" crossOrigin="use-credentials" />
      <link rel="icon" href="/favicon.ico" sizes="any" />
      <link rel="icon" href="/gridninja-icon-192.png" type="image/png" sizes="192x192" />
      <link rel="apple-touch-icon" href="/gridninja-apple-touch-icon-180.png" />
      {meta.map(item => <meta key={item.name ?? item.property} {...item} />)}
    </Head>
    <script id="gridninja-schema-contact" type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
    <MarketingLayout><ContactPageContent /></MarketingLayout>
  </>
}
