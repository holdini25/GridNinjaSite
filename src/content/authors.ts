export type PublicAuthor = {
  slug: string
  name: string
  role: string
  affiliation: string
  bio: string
  disclosure: string
  reviewedTopics: readonly string[]
}

// Publication is intentionally gated until real people approve public profiles,
// disclosures, and review ownership. Never seed this registry with placeholders.
export const publicAuthors: readonly PublicAuthor[] = []

export function getPublicAuthor(slug: string) {
  return publicAuthors.find((author) => author.slug === slug)
}
