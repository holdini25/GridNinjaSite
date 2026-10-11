import { sha256 } from "@/lib/editorial/files.mjs"

export function editorialFixture(bytes = Buffer.from("illustration")) {
  const digest = sha256(bytes)
  const names = ["ai-workload", "colocation-hall", "platform-systems"]
  return {
    schemaVersion: "editorial.v1", release: "editorial-v1", environment: "synthetic", family: "C-frontal",
    source: { masterIdentity: "gridninja-facility-shared-master", masterSha256: digest, settingsSha256: digest,
      cinematicRendererSha256: digest, editorialRendererSha256: digest, computeSourceSha256: digest,
      supervisorSha256: digest, finalReportSha256: digest, referenceReportSha256: digest, packagerSha256: digest,
      blenderVersion: "5.2.2 LTS", blenderBuildHash: "d13f752e3b9c", nodeVersion: "v22.23.2", sharpVersion: "0.35.5", webpVersion: "1.6.0" },
    render: { width: 1600, height: 1000, samples: 128, referenceSamples: 256, adaptiveThreshold: .005, threads: 4,
      device: "METAL", colorTransform: "AgX", look: "Medium High Contrast", delivery: "sRGB", motionBlur: false },
    subjects: Object.fromEntries(names.map(name => [name, { camera: { position: [1, 2, 3], rotation: [0, 0, 0],
      orthographicSpan: 6, width: 1600, height: 1000, azimuth: 24, elevation: 24, padding: 1.1 },
      equipmentIds: ["rack-05"], masterPngSha256: digest, masterExrSha256: digest, referencePngSha256: digest }])),
    files: names.flatMap(subject => [480, 800, 1280].map(width => ({ file: `${subject}-${width}.webp`, subject,
      width, height: width * 5 / 8, bytes: bytes.length, sha256: digest, mimeType: "image/webp", quality: 90 }))),
  }
}
