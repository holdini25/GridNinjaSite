// @vitest-environment node
import { describe, expect, it } from "vitest"
import { inspectMp4 } from "@/lib/cinematic/mp4.mjs"

const u32 = (value: number) => { const result = Buffer.alloc(4); result.writeUInt32BE(value); return result }
const box = (type: string, ...parts: Buffer[]) => { const body = Buffer.concat(parts); return Buffer.concat([u32(body.length + 8), Buffer.from(type), body]) }
type Options = { profile?: number; chroma?: number; depth?: number; transfer?: number; containerTransfer?: number; fullRange?: number; width?: number; noColor?: boolean; extraTrack?: boolean; slowStart?: boolean; duration?: number }

// Minimal ISO-BMFF metadata fixtures, not playable videos. Actual rendered media
// is independently validated by cinematic:validate before each candidate build.
function movie(options: Options = {}) {
  let rawBits = ""
  const bits = (value: number, count: number) => { rawBits += value.toString(2).padStart(count, "0") }
  const ue = (value: number) => { const encoded = (value + 1).toString(2); rawBits += "0".repeat(encoded.length - 1) + encoded }
  const profile = options.profile ?? 100, transfer = options.transfer ?? 13, range = options.fullRange ?? 0
  ue(0); ue(options.chroma ?? 1); ue(options.depth ?? 0); ue(0); bits(0, 2)
  ue(0); ue(0); ue(0); ue(1); bits(0, 1); ue(79); ue(49)
  bits(1, 1); bits(1, 1); bits(0, 1); bits(1, 1) // progressive, inference, crop, VUI
  bits(0, 2); bits(1, 1); bits(5, 3); bits(range, 1); bits(1, 1)
  bits(1, 8); bits(transfer, 8); bits(1, 8); bits(0, 6); bits(1, 1)
  rawBits = rawBits.padEnd(Math.ceil(rawBits.length / 8) * 8, "0")
  const rbsp = [profile, 0, 31, ...rawBits.match(/.{8}/g)!.map(value => parseInt(value, 2))], escaped: number[] = []
  for (const value of rbsp) { if (escaped.at(-1) === 0 && escaped.at(-2) === 0 && value <= 3) escaped.push(3); escaped.push(value) }
  const sps = Buffer.from([0x67, ...escaped]), length = Buffer.alloc(2); length.writeUInt16BE(sps.length)
  const avc = box("avcC", Buffer.from([1, 100, 0, 31, 255, 225]), length, sps, Buffer.from([0]))
  const color = Buffer.alloc(11); color.write("nclx"); color.writeUInt16BE(1, 4); color.writeUInt16BE(options.containerTransfer ?? transfer, 6); color.writeUInt16BE(1, 8); color[10] = range << 7
  const visual = Buffer.alloc(78); visual.writeUInt16BE(options.width ?? 1280, 24); visual.writeUInt16BE(800, 26)
  const sample = box("avc1", visual, avc, ...(options.noColor ? [] : [box("colr", color)]))
  const stsd = box("stsd", Buffer.alloc(4), u32(1), sample)
  const stts = box("stts", Buffer.alloc(4), u32(1), u32(300), u32(1000))
  const tkhd = Buffer.alloc(84); tkhd.writeUInt32BE(1280 * 65536, 76); tkhd.writeUInt32BE(800 * 65536, 80)
  const mdhd = Buffer.alloc(24); mdhd.writeUInt32BE(30000, 12); mdhd.writeUInt32BE(options.duration ?? 300000, 16)
  const handler = Buffer.alloc(24); handler.write("vide", 8)
  const trak = box("trak", box("tkhd", tkhd), box("mdia", box("mdhd", mdhd), box("hdlr", handler), box("minf", box("stbl", stsd, stts))))
  const moov = box("moov", trak, ...(options.extraTrack ? [trak] : [])), mdat = box("mdat", Buffer.alloc(1))
  return Buffer.concat([box("ftyp", Buffer.from("isom")), ...(options.slowStart ? [mdat, moov] : [moov, mdat])])
}

describe("actual MP4 delivery metadata", () => {
  it("reads matching SPS/container color, silent High420 delivery, dimensions and fixed timing", () => {
    expect(inspectMp4(movie())).toEqual({
      width: 1280, height: 800, durationSeconds: 10, frameCount: 300, fps: 30, audioTracks: 0, codec: "h264",
      encoding: { codec: "h264", profile: "high", pixelFormat: "yuv420p", audio: false, fastStart: true, color: { primaries: "bt709", transfer: "iec61966-2-1", matrix: "bt709", range: "limited", dynamicRange: "sdr" } },
    })
  })
  it.each([
    [{ containerTransfer: 1 }, /tags disagree/],
    [{ transfer: 1 }, /sRGB transfer/],
    [{ transfer: 16 }, /sRGB transfer/],
    [{ fullRange: 1 }, /limited range/],
    [{ profile: 66 }, /High profile/],
    [{ chroma: 2 }, /yuv420p/],
    [{ depth: 2 }, /8-bit/],
    [{ noColor: true }, /nclx/],
    [{ width: 640 }, /sample dimensions disagree/],
    [{ extraTrack: true }, /silent video track/],
    [{ slowStart: true }, /fast-start/],
    [{ duration: 299000 }, /sample timing/],
  ] as [Options, RegExp][])("rejects incompatible or contradictory delivery %j", (options, expected) => {
    expect(() => inspectMp4(movie(options))).toThrow(expected)
  })
  it("rejects incomplete metadata rather than accepting an unverified declaration", () => {
    expect(() => inspectMp4(movie().subarray(0, 140))).toThrow(/MP4 box/)
  })
})
