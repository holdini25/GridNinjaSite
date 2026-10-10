import { sha256 } from "@/lib/civic/files.mjs"

export function civicFixture(bytes = Buffer.from("civic illustration")) {
  const digest = sha256(bytes)
  return {
    schemaVersion: "civic.v1", release: "civic-v1", environment: "synthetic",
    source: { kind: "generated-illustration", tool: "image_gen.imagegen", mode: "built-in", model: "not reported by tool",
      generationRecordSha256: digest, packagerSha256: digest, nodeVersion: "v22.23.2", sharpVersion: "0.35.5", webpVersion: "1.6.0" },
    compositions: {
      landscape: { width: 1672, height: 941, masterPngSha256: digest, masterPngBytes: bytes.length, promptSha256: digest,
        transformation: { fit: "cover", position: "centre", aspectRatio: "16:9", colourSpace: "srgb" } },
      portrait: { width: 1145, height: 1374, masterPngSha256: digest, masterPngBytes: bytes.length, promptSha256: digest,
        transformation: { fit: "cover", position: "centre", aspectRatio: "5:6", colourSpace: "srgb" } },
    },
    files: ["landscape", "portrait"].flatMap(composition => (composition === "landscape" ? [640, 960, 1280] : [400, 640, 800]).map(width => ({
      file: `${composition}-${width}.webp`, composition, width, height: width * (composition === "landscape" ? 9 / 16 : 6 / 5),
      bytes: bytes.length, sha256: digest, mimeType: "image/webp", quality: 90,
    }))),
  }
}
