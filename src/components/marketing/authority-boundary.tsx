export function AuthorityBoundary({ items }: { items: string[] }) {
  return (
    <div className="gn-panel px-6 py-7">
      <p className="gn-eyebrow">Authority boundary</p>
      <h3 className="mt-4 text-[2rem] font-medium text-foreground">
        Proof before autonomy means the system can say no
      </h3>
      <p className="mt-4 max-w-3xl text-base leading-8 text-muted-foreground">
        GridNinja can propose and verify candidate actions, but live authority
        stays inside declared site policy, deterministic checks, runtime
        assurance, and operator review.
      </p>
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <div
            key={item}
            className="gn-proof-row text-base leading-7 text-muted-foreground"
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  )
}
