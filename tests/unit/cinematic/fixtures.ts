import { createHash } from "node:crypto"

export const cinematicFixture = (bytes: Buffer, release = "cinematic-v1", masterSha256 = "a".repeat(64)) => {
  const sha256 = createHash("sha256").update(bytes).digest("hex")
  return {
    schemaVersion: "cinematic.v1", release, environment: "synthetic",
    source: { masterIdentity: "gridninja-facility-shared-master", masterSha256, settingsSha256: "b".repeat(64) },
    encoding: { codec: "h264", profile: "high", pixelFormat: "yuv420p", audio: false, fastStart: true, color: { primaries: "bt709", transfer: "iec61966-2-1", matrix: "bt709", range: "limited", dynamicRange: "sdr" } },
    renditions: Object.fromEntries(["desktop", "mobile"].map(kind => [kind, {
      width: 1280, height: 800, fps: 30, durationSeconds: 10, frameCount: 300, video: `${kind}.mp4`, poster: `poster-${kind}.webp`,
      composition: { renderWidth: 1600, renderHeight: 1000, crop: "full-frame", camera: { projection: "orthographic", fixed: true, positionMetres: [14, -16, 12], rotationEulerRadians: [1, 0, .73], verticalSpanMetres: 9, azimuthDegrees: 42, elevationDegrees: 28, padding: 1.075 } },
      posterCorrespondence: { method: "encoded-first-frame", frameIndex: 0, decodedFrameSha256: "c".repeat(64), decodedFrameBytes: 1234, encodedVideoSha256: sha256 },
    }])),
    files: ["desktop.mp4", "mobile.mp4", "poster-desktop.webp", "poster-mobile.webp"].map(file => ({ file, bytes: bytes.length, sha256, mimeType: file.endsWith("mp4") ? "video/mp4" : "image/webp" })),
  }
}
