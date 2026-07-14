import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { SeoResourcePage } from "@/app/(marketing)/_components/seo-resource-page"
import { getSeoResource, methodologyResources } from "@/content/seo-resources"
import { createPageMetadata } from "@/lib/seo"

export const dynamicParams = false

export function generateStaticParams() {
  return methodologyResources.map((resource) => ({ slug: resource.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const resource = getSeoResource("methodology", slug)

  if (!resource) return {}

  return createPageMetadata({ path: resource.path })
}

export default async function MethodologyResourcePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const resource = getSeoResource("methodology", slug)

  if (!resource) notFound()

  return <SeoResourcePage resource={resource} />
}
