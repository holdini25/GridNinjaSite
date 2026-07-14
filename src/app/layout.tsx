import type { Metadata, Viewport } from "next"

import { VercelObservability } from "@/components/analytics/vercel-observability"
import { siteConfig } from "@/content/site"
import { openGraphImage, twitterImage } from "@/lib/seo"
import { isPreviewDeployment, PRODUCTION_ORIGIN } from "@/seo/policy"

import "./globals.css"

export const metadata: Metadata = {
  metadataBase: new URL(PRODUCTION_ORIGIN),
  applicationName: siteConfig.name,
  title: siteConfig.title,
  description: siteConfig.description,
  robots: isPreviewDeployment()
    ? { index: false, follow: false, noarchive: true }
    : {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          "max-image-preview": "large",
          "max-snippet": -1,
          "max-video-preview": -1,
        },
      },
  icons: {
    icon: [
      {
        url: "/favicon.ico",
        sizes: "any",
      },
      {
        url: "/gridninja-icon-192.png",
        type: "image/png",
        sizes: "192x192",
      },
    ],
    apple: [
      {
        url: "/gridninja-apple-touch-icon-180.png",
      },
    ],
  },
  appleWebApp: {
    capable: true,
    title: siteConfig.name,
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: siteConfig.title,
    description: siteConfig.description,
    siteName: siteConfig.name,
    type: "website",
    images: [openGraphImage],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.title,
    description: siteConfig.description,
    images: [twitterImage],
  },
}

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#070a0d",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
        {process.env.VERCEL === "1" ? <VercelObservability /> : null}
      </body>
    </html>
  )
}
