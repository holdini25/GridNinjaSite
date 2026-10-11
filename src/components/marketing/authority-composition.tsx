const authoritySteps = [
  { title: "Modeled result", body: "An authored profile, conditions and evidence set." },
  { title: "Human and business review", body: "A decision owner determines usefulness." },
  { title: "Operating permission", body: "Separate site authority and validation required." },
] as const

/** The gate is a stop boundary, never an automatic promotion from a model result. */
export function AuthorityComposition({ thumbnail = false }: { thumbnail?: boolean }) {
  if (thumbnail) return <figure className="gn-authority-thumbnail" data-artwork-slot="proof">
    <svg viewBox="0 0 800 500" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="64" y="157" width="176" height="180" rx="8" /><path d="M96 201h112m-112 34h84m-84 34h98m-98 34h61" />
        <path d="M262 247h52m-12-12 12 12-12 12" />
        <rect x="338" y="157" width="176" height="180" rx="8" /><circle cx="426" cy="216" r="20" /><path d="M385 290c0-47 82-47 82 0m-104 21h126" />
        <path className="gn-authority-gate-line" d="M557 107v282m20-282v282m-20-222h20m-20 61h20m-20 61h20m-20 61h20" />
        <rect x="620" y="190" width="112" height="118" rx="8" /><path d="M650 190v-27a26 26 0 0 1 52 0v27m-26 48v21" />
      </g>
    </svg><figcaption>Modeled result → review <span className="gn-authority-caption-gate">Gate</span> operating permission</figcaption>
  </figure>
  return <figure className="gn-authority-composition">
    <ol>{authoritySteps.map((step, i) => <li key={step.title} className={i === 2 ? "gn-authority-permission" : undefined}>
      <span className="gn-authority-index">0{i + 1}</span>{i === 2 && <span className="gn-authority-gate-label">Separate authorization gate</span>}
      <h3>{step.title}</h3><p>{step.body}</p>
    </li>)}</ol>
    <figcaption>Proof informs review. It does not open the operating gate. The current assessment has no live connection or equipment control.</figcaption>
  </figure>
}
