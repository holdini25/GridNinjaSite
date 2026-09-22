export function AssessmentCards({ items }: { items: readonly { title: string; body: string }[] }) {
  return <div className="grid gap-4 md:grid-cols-2">{items.map((item, index) => <article key={item.title} className="rounded-xl border border-border/80 bg-surface p-6 sm:p-7"><p className="font-mono text-sm text-primary">{String(index + 1).padStart(2, "0")}</p><h3 className="mt-4 text-xl font-medium">{item.title}</h3><p className="mt-3 max-w-prose text-base leading-8 text-muted-foreground">{item.body}</p></article>)}</div>
}
