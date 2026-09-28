import { getFacilityRelease } from "@/lib/facility/releases"
import { SectionShell } from "@/components/layout/section-shell"
import type { PublicTopic } from "@/lib/public-topic"

/** Server-only still entry. No renderer, viewer stylesheet, or client controls. */
export async function FacilityEntry({ topic }: { topic: Extract<PublicTopic, "ai-cloud" | "colocation"> }) {
  const release = await getFacilityRelease()
  const href = `/demo?scenario=b&version=1.0.0&perspective=business&focus=workloads&topic=${topic}#decision-brief`
  return <SectionShell deferRendering={false}><div className="grid overflow-hidden rounded-xl border border-border bg-background md:grid-cols-2">
    {release && <picture><source media="(max-width: 639px)" srcSet={release.posters.mobile.url} /><img src={release.posters.desktop.url} alt="Synthetic facility illustrating electrical, cooling, reserve, and workload relationships." width={1360} height={800} loading="lazy" decoding="async" className="h-full w-full object-contain" /></picture>}
    <div className="self-center p-6 sm:p-8"><p className="gn-eyebrow">Synthetic example · Fixture B</p><h2 className="mt-3 text-2xl font-medium">Inspect the decision behind the increment.</h2><p className="mt-4 leading-7 text-muted-foreground">Explore the same authored request, proposed revision, and unresolved commercial question. The miniature illustrates equipment relationships; it does not calculate capacity.</p><a className="mt-5 inline-flex min-h-11 items-center gap-2 text-primary underline underline-offset-4" href={href}>See a sample decision brief <span aria-hidden="true">→</span></a></div>
  </div></SectionShell>
}
