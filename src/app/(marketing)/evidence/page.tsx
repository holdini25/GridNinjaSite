import type { Metadata } from "next"

import { SeoResourceHub } from "@/app/(marketing)/_components/seo-resource-hub"
import { SeoPageJsonLd } from "@/components/seo/json-ld"
import { evidenceResources } from "@/content/seo-resources"
import { createPageMetadata } from "@/lib/seo"

export async function generateMetadata(): Promise<Metadata> {
  return createPageMetadata({ path: "/evidence" })
}

export default function EvidencePage() {
  return (
    <>
      <SeoPageJsonLd path="/evidence" />
      <SeoResourceHub
        eyebrow="GridNinja evidence"
        title="Evidence for safe, usable, auditable capacity"
        answer="GridNinja evidence pages connect a precise capacity claim to its maturity, environment, measurement window, sample, version, method, uncertainty, negative cases, reproduction steps, and review boundary. The first release is deliberately synthetic and sanitized. It demonstrates the proposed proof contract without implying customer, pilot, production, certification, or independent-validation results."
        boundary="Artifacts are downloadable from stable versioned paths, but the technical pages remain noindex until named ownership, review, release signing, and publication approval are complete. The candidate release contains no customer topology, raw telemetry, identifiers, setpoints, protective thresholds, credentials, network paths, commercial terms, or solver internals."
        resources={evidenceResources}
      />
    </>
  )
}
