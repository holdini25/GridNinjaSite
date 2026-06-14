export function UtilityEvidencePacketPreview() {
  const items = [
    "Flexible MW by interval",
    "Ramp-rate envelope",
    "Safe reconnection envelope",
    "Telemetry confidence and exceptions",
    "No-proof gaps and remediation owners",
  ]

  return (
    <div className="gn-panel p-6">
      <p className="gn-eyebrow">Utility evidence packet</p>
      <h3 className="mt-3 text-[1.9rem] font-medium text-foreground">
        Planning value without pretending to be a utility approval
      </h3>
      <p className="mt-4 text-base leading-8 text-muted-foreground">
        GridNinja translates local proof into evidence utilities and energy
        market coordinators can inspect. It does not replace interconnection
        studies, tariff requirements, or operator authority.
      </p>
      <ul className="mt-6 grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <li
            key={item}
            className="gn-proof-row text-base text-muted-foreground"
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}
