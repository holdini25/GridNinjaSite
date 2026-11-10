import type { AppProps } from "next/app"
import dynamic from "next/dynamic"

import "@/app/globals.css"

const VercelObservability = dynamic(
  () => import("@/components/analytics/vercel-observability").then(module => module.VercelObservability),
  { ssr: false }
)

export default function ContactApplication({ Component, pageProps }: AppProps<{ observability?: boolean }>) {
  return <>
    <Component {...pageProps} />
    {pageProps.observability ? <VercelObservability /> : null}
  </>
}
