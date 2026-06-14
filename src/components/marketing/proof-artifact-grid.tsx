import type { ProofArtifact } from "@/content/proof-artifacts"

export function ProofArtifactGrid({ artifacts }: { artifacts: ProofArtifact[] }) {
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {artifacts.map((artifact) => (
        <article
          key={artifact.title}
          className="gn-proof-card gn-panel gn-panel-interactive px-5 py-6"
        >
          <div className="gn-proof-card-body">
            <div>
              <p className="text-sm tracking-[0.24em] text-primary uppercase">
                {artifact.audience}
              </p>
              <h3 className="mt-4 text-[1.35rem] font-medium text-foreground">
                {artifact.title}
              </h3>
            </div>
            <p className="text-base leading-8 text-muted-foreground">
              {artifact.body}
            </p>
          </div>
        </article>
      ))}
    </div>
  )
}
