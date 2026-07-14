import type { CSSProperties } from "react"

type GridNinjaOgCardProps = {
  description: string
  host: string
  emblemSrc: string
  headline?: string
  eyebrow?: string
}

const proofPills = [
  "Proof before autonomy",
  "Safe sellable MW",
  "Runtime assurance",
]

const systemTiles = [
  { label: "Power", value: "Utility + DER" },
  { label: "Thermal", value: "Cooling envelope" },
  { label: "Reserve", value: "Safety margin" },
  { label: "Proof", value: "Shadow Mode" },
]

const fontFamily =
  'Geist, "Geist Fallback", ui-sans-serif, system-ui, sans-serif'

export function GridNinjaOgCard({
  description,
  host,
  emblemSrc,
  headline = "Unlock virtual capacity for AI data centers",
  eyebrow = "Proof-backed virtual capacity",
}: GridNinjaOgCardProps) {
  return (
    <div style={styles.root}>
      <div style={styles.grid} />
      <div style={styles.orbitLarge} />
      <div style={styles.orbitSmall} />

      <div style={styles.content}>
        <div style={styles.copyColumn}>
          <div style={styles.copyStack}>
            <div style={styles.eyebrow}>{eyebrow}</div>
            <div style={styles.brandLockup}>
              {/* The image is supplied as a local data URL by the metadata route. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={emblemSrc}
                alt=""
                width={96}
                height={96}
                style={styles.mark}
              />
              <div style={styles.brand}>GridNinja</div>
            </div>
            <div style={styles.category}>
              AI Data Center Virtual Capacity Control Plane
            </div>
            <div style={styles.titleGroup}>
              <div style={styles.headline}>
                {headline}
              </div>
              <div style={styles.description}>{description}</div>
            </div>
          </div>

          <div style={styles.pillRow}>
            {proofPills.map((item) => (
              <div key={item} style={styles.pill}>
                {item}
              </div>
            ))}
          </div>
        </div>

        <div style={styles.panelColumn}>
          <div style={styles.panelHeader}>
            <span>Runtime-assured</span>
            <span>{host}</span>
          </div>
          <div style={styles.panel}>
            <div style={styles.tileGrid}>
              {systemTiles.map((item) => (
                <div key={item.label} style={styles.tile}>
                  <div style={styles.tileLabel}>{item.label}</div>
                  <div style={styles.tileValue}>{item.value}</div>
                </div>
              ))}
            </div>
            <div style={styles.dispatchEnvelope}>
              <div style={styles.dispatchTitle}>Dispatch envelope</div>
              <div style={styles.dispatchText}>
                Every action is checked before execution.
              </div>
            </div>
          </div>
          <div style={styles.footer}>gridninja.ai</div>
        </div>
      </div>
    </div>
  )
}

const styles = {
  root: {
    position: "relative",
    width: "100%",
    height: "100%",
    display: "flex",
    overflow: "hidden",
    background:
      "linear-gradient(135deg, #09131c 0%, #07111a 48%, #0d1720 100%)",
    color: "#f5f7fa",
    fontFamily,
  },
  grid: {
    position: "absolute",
    inset: 0,
    opacity: 0.35,
    backgroundImage:
      "linear-gradient(rgba(159,176,191,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(159,176,191,0.08) 1px, transparent 1px)",
    backgroundSize: "44px 44px",
  },
  orbitLarge: {
    position: "absolute",
    right: 72,
    top: 66,
    width: 390,
    height: 390,
    borderRadius: 999,
    border: "1px solid rgba(255,184,74,0.14)",
    background:
      "radial-gradient(circle at center, rgba(255,159,26,0.09), rgba(13,23,32,0.18) 55%, transparent 72%)",
  },
  orbitSmall: {
    position: "absolute",
    right: 98,
    top: 96,
    width: 340,
    height: 340,
    borderRadius: 999,
    border: "1px solid rgba(159,176,191,0.12)",
  },
  content: {
    display: "flex",
    width: "100%",
    height: "100%",
    padding: "58px 60px",
    gap: 44,
  },
  copyColumn: {
    display: "flex",
    flex: "1 1 0%",
    flexDirection: "column",
    justifyContent: "space-between",
    gap: 28,
  },
  copyStack: {
    display: "flex",
    flexDirection: "column",
    gap: 22,
  },
  eyebrow: {
    maxWidth: 440,
    fontSize: 14,
    lineHeight: 1.45,
    letterSpacing: "0.18em",
    color: "#9fb0bf",
    textTransform: "uppercase",
  },
  brandLockup: {
    display: "flex",
    alignItems: "center",
    gap: 22,
  },
  mark: {
    width: 96,
    height: 96,
    objectFit: "contain",
  },
  category: {
    alignSelf: "flex-start",
    display: "flex",
    borderRadius: 999,
    border: "1px solid rgba(255,184,74,0.16)",
    background: "rgba(13,23,32,0.76)",
    padding: "8px 14px",
    fontSize: 12,
    letterSpacing: "0.18em",
    color: "#9fb0bf",
    textTransform: "uppercase",
  },
  titleGroup: {
    maxWidth: 640,
    display: "flex",
    flexDirection: "column",
  },
  brand: {
    fontSize: 36,
    fontWeight: 650,
    letterSpacing: "0.02em",
    color: "#f5f7fa",
  },
  headline: {
    marginTop: 18,
    fontSize: 57,
    lineHeight: 1.02,
    fontWeight: 600,
    letterSpacing: "-0.04em",
  },
  description: {
    marginTop: 18,
    maxWidth: 560,
    fontSize: 24,
    lineHeight: 1.35,
    color: "#9fb0bf",
  },
  pillRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  pill: {
    display: "flex",
    borderRadius: 999,
    border: "1px solid rgba(255,184,74,0.16)",
    background: "rgba(19,32,43,0.84)",
    padding: "10px 14px",
    fontSize: 14,
    color: "#f5f7fa",
  },
  panelColumn: {
    width: 390,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    gap: 18,
  },
  panelHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    fontSize: 14,
    letterSpacing: "0.16em",
    color: "#9fb0bf",
    textTransform: "uppercase",
  },
  panel: {
    position: "relative",
    borderRadius: 28,
    border: "1px solid rgba(255,184,74,0.16)",
    background:
      "linear-gradient(180deg, rgba(13,23,32,0.96) 0%, rgba(7,17,26,0.96) 100%)",
    padding: 24,
    height: 376,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  tileGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: 18,
  },
  tile: {
    display: "flex",
    flexDirection: "column",
    width: 154,
    borderRadius: 18,
    border: "1px solid rgba(255,184,74,0.16)",
    background: "rgba(19,32,43,0.9)",
    padding: "16px 16px 15px",
  },
  tileLabel: {
    fontSize: 14,
    letterSpacing: "0.18em",
    color: "#ff9f1a",
    textTransform: "uppercase",
  },
  tileValue: {
    marginTop: 9,
    fontSize: 16,
    color: "#f5f7fa",
    lineHeight: 1.35,
  },
  dispatchEnvelope: {
    alignSelf: "center",
    width: 250,
    minHeight: 94,
    borderRadius: 24,
    border: "1px solid rgba(255,159,26,0.2)",
    background:
      "linear-gradient(180deg, rgba(255,159,26,0.12) 0%, rgba(255,159,26,0.04) 100%)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: "14px 20px",
  },
  dispatchTitle: {
    fontSize: 24,
    fontWeight: 600,
    color: "#f5f7fa",
  },
  dispatchText: {
    marginTop: 6,
    fontSize: 14,
    color: "#9fb0bf",
  },
  footer: {
    fontSize: 14,
    lineHeight: 1.45,
    color: "#9fb0bf",
  },
} satisfies Record<string, CSSProperties>
