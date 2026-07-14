import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { SectionShell } from "@/components/layout/section-shell"
import { getPublicAuthor, publicAuthors } from "@/content/authors"
import { createPageMetadata } from "@/lib/seo"

export const dynamicParams = false

export function generateStaticParams() {
  return publicAuthors.map((author) => ({ slug: author.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const author = getPublicAuthor(slug)

  if (!author) return {}

  return {
    ...createPageMetadata({
      title: `${author.name} | GridNinja Technical Author`,
      description: author.bio,
      path: `/authors/${author.slug}`,
    }),
    robots: { index: true, follow: true },
  }
}

export default async function AuthorPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const author = getPublicAuthor(slug)

  if (!author) notFound()

  return (
    <article className="py-14 sm:py-20">
      <SectionShell>
        <p className="gn-eyebrow">Technical author and reviewer</p>
        <h1 className="mt-5 text-balance text-[2.5rem] font-medium text-foreground sm:text-[3.5rem]">
          {author.name}
        </h1>
        <p className="mt-3 text-lg text-proof-cyan">
          {author.role} · {author.affiliation}
        </p>
        <p className="mt-6 max-w-3xl text-lg leading-9 text-muted-foreground">
          {author.bio}
        </p>
        <section className="mt-10 max-w-3xl rounded-[1.8rem] border border-border/70 bg-surface px-6 py-7">
          <h2 className="text-xl font-medium text-foreground">Disclosure</h2>
          <p className="mt-4 text-base leading-8 text-muted-foreground">
            {author.disclosure}
          </p>
        </section>
      </SectionShell>
    </article>
  )
}
