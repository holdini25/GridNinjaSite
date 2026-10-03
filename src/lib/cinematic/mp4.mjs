/** Read only the ISO-BMFF metadata needed for the bounded silent H.264 loop.
 * Decode quality and seamless motion remain separate visual checks. */
function boxes(bytes, start = 0, end = bytes.length) {
  const result = []
  for (let offset = start; offset < end;) {
    if (offset + 8 > end) throw new Error("Truncated MP4 box")
    let size = bytes.readUInt32BE(offset), header = 8
    const type = bytes.toString("ascii", offset + 4, offset + 8)
    if (size === 1) { if (offset + 16 > end) throw new Error("Truncated MP4 size"); size = Number(bytes.readBigUInt64BE(offset + 8)); header = 16 }
    if (size === 0) size = end - offset
    if (!Number.isSafeInteger(size) || size < header || offset + size > end) throw new Error("Invalid MP4 box")
    result.push({ type, start: offset, body: offset + header, end: offset + size })
    offset += size
  }
  return result
}

// Parse the sequence parameter set, rather than trusting filename/encoder flags.
// This deliberately supports only the progressive, 8-bit High-profile delivery.
function inspectSps(nal) {
  if ((nal[0] & 31) !== 7) throw new Error("Invalid H.264 sequence parameter set")
  const raw = []
  for (let index = 1; index < nal.length; index++) {
    if (nal[index] === 3 && nal[index - 1] === 0 && nal[index - 2] === 0) continue
    raw.push(nal[index])
  }
  let offset = 0
  const bits = count => {
    if (offset + count > raw.length * 8 || count > 32) throw new Error("Truncated H.264 metadata")
    let value = 0
    for (let index = 0; index < count; index++, offset++) value = value * 2 + ((raw[offset >> 3] >> (7 - offset % 8)) & 1)
    return value
  }
  const unsigned = () => {
    let zeros = 0
    while (bits(1) === 0) { if (++zeros > 30) throw new Error("Invalid H.264 Golomb field") }
    return 2 ** zeros - 1 + bits(zeros)
  }
  const signed = () => { const value = unsigned(); return value % 2 ? (value + 1) / 2 : -value / 2 }
  const profile = bits(8)
  bits(8); bits(8); unsigned() // constraints, level, parameter-set identity
  if (profile !== 100) throw new Error("Cinematic H.264 requires High profile")
  const chromaFormat = unsigned()
  if (chromaFormat !== 1 || unsigned() !== 0 || unsigned() !== 0) throw new Error("Cinematic H.264 requires 8-bit yuv420p")
  bits(1) // transform bypass
  if (bits(1)) {
    for (let list = 0; list < 8; list++) if (bits(1)) {
      let last = 8, next = 8
      for (let index = 0; index < (list < 6 ? 16 : 64); index++) { if (next !== 0) next = (last + signed() + 256) % 256; last = next || last }
    }
  }
  unsigned() // log2_max_frame_num_minus4
  const order = unsigned()
  if (order === 0) unsigned()
  else if (order === 1) { bits(1); signed(); signed(); const count = unsigned(); if (count > 255) throw new Error("Invalid H.264 order cycle"); for (let index = 0; index < count; index++) signed() }
  else if (order !== 2) throw new Error("Invalid H.264 order type")
  unsigned(); bits(1) // reference count, frame-number gaps
  const widthMbs = unsigned() + 1, heightMap = unsigned() + 1
  if (bits(1) !== 1) throw new Error("Cinematic H.264 must be progressive")
  bits(1) // direct_8x8_inference_flag
  let left = 0, right = 0, top = 0, bottom = 0
  if (bits(1)) { left = unsigned(); right = unsigned(); top = unsigned(); bottom = unsigned() }
  if (!bits(1)) throw new Error("Cinematic H.264 requires color VUI metadata")
  if (bits(1)) { const ratio = bits(8); if (ratio === 255) { bits(16); bits(16) } }
  if (bits(1)) bits(1) // overscan
  if (!bits(1)) throw new Error("Cinematic H.264 requires a video signal declaration")
  bits(3) // video format
  const fullRange = bits(1)
  if (!bits(1)) throw new Error("Cinematic H.264 requires explicit color tags")
  const color = { primaries: bits(8), transfer: bits(8), matrix: bits(8), fullRange }
  return { width: widthMbs * 16 - 2 * (left + right), height: heightMap * 16 - 2 * (top + bottom), color }
}

function inspectAvc(bytes, entry) {
  // ISO/IEC 14496-12 VisualSampleEntry has a fixed 78-byte prefix.
  const metadata = boxes(bytes, entry.body + 78, entry.end)
  const avc = metadata.find(box => box.type === "avcC"), colr = metadata.find(box => box.type === "colr")
  if (!avc || avc.end - avc.body < 7 || bytes[avc.body] !== 1 || bytes[avc.body + 1] !== 100) throw new Error("Cinematic MP4 requires an AVC High configuration")
  const count = bytes[avc.body + 5] & 31
  if (count < 1) throw new Error("Cinematic MP4 requires a sequence parameter set")
  let cursor = avc.body + 6, sequence
  for (let index = 0; index < count; index++) {
    if (cursor + 2 > avc.end) throw new Error("Truncated AVC configuration")
    const length = bytes.readUInt16BE(cursor); cursor += 2
    if (!length || cursor + length > avc.end) throw new Error("Truncated AVC sequence")
    const next = inspectSps(bytes.subarray(cursor, cursor + length)); cursor += length
    if (sequence && JSON.stringify(sequence) !== JSON.stringify(next)) throw new Error("Conflicting AVC sequence metadata")
    sequence = next
  }
  if (!colr || colr.end - colr.body !== 11 || bytes.toString("ascii", colr.body, colr.body + 4) !== "nclx") throw new Error("Cinematic MP4 requires nclx color metadata")
  const color = { primaries: bytes.readUInt16BE(colr.body + 4), transfer: bytes.readUInt16BE(colr.body + 6), matrix: bytes.readUInt16BE(colr.body + 8), fullRange: bytes[colr.body + 10] >> 7 }
  if (JSON.stringify(color) !== JSON.stringify(sequence.color)) throw new Error("MP4 container and H.264 color tags disagree")
  if (color.primaries !== 1 || color.transfer !== 13 || color.matrix !== 1 || color.fullRange !== 0) throw new Error("Cinematic MP4 requires SDR sRGB transfer, BT.709 primaries/matrix and limited range")
  if (bytes.readUInt16BE(entry.body + 24) !== sequence.width || bytes.readUInt16BE(entry.body + 26) !== sequence.height) throw new Error("AVC and MP4 sample dimensions disagree")
  return sequence
}

export function inspectMp4(bytes) {
  const top = boxes(bytes)
  const moov = top.find(box => box.type === "moov"), mdat = top.find(box => box.type === "mdat")
  if (!moov || !mdat || !top.some(box => box.type === "ftyp") || moov.start > mdat.start) throw new Error("Cinematic MP4 requires fast-start metadata")
  const children = box => boxes(bytes, box.body, box.end)
  const child = (box, type) => { const value = children(box).find(item => item.type === type); if (!value) throw new Error(`MP4 missing ${type}`); return value }
  const tracks = children(moov).filter(box => box.type === "trak")
  if (tracks.length !== 1) throw new Error("Cinematic MP4 must contain exactly one silent video track")
  const track = tracks[0], tkhd = child(track, "tkhd"), mdia = child(track, "mdia"), handler = child(mdia, "hdlr")
  if (bytes.toString("ascii", handler.body + 8, handler.body + 12) !== "vide") throw new Error("Cinematic MP4 requires a video track")
  const mdhd = child(mdia, "mdhd"), version = bytes[mdhd.body]
  if (version !== 0 && version !== 1) throw new Error("Unsupported media header")
  const timescale = bytes.readUInt32BE(mdhd.body + (version === 1 ? 20 : 12))
  const duration = version === 1 ? Number(bytes.readBigUInt64BE(mdhd.body + 24)) : bytes.readUInt32BE(mdhd.body + 16)
  const stbl = child(child(mdia, "minf"), "stbl"), stsd = child(stbl, "stsd"), stts = child(stbl, "stts")
  const descriptions = boxes(bytes, stsd.body + 8, stsd.end)
  if (bytes.readUInt32BE(stsd.body + 4) !== 1 || descriptions.length !== 1 || descriptions[0].type !== "avc1") throw new Error("Cinematic MP4 requires H.264 avc1")
  const sequence = inspectAvc(bytes, descriptions[0])
  const entries = bytes.readUInt32BE(stts.body + 4)
  if (entries < 1 || stts.body + 8 + entries * 8 !== stts.end) throw new Error("Invalid MP4 sample timing")
  let frameCount = 0, sampleDuration = 0
  for (let index = 0; index < entries; index++) {
    const count = bytes.readUInt32BE(stts.body + 8 + index * 8), delta = bytes.readUInt32BE(stts.body + 12 + index * 8)
    if (!count || !delta || (sampleDuration && sampleDuration !== delta)) throw new Error("Cinematic MP4 requires constant frame timing")
    frameCount += count; sampleDuration = delta
  }
  const durationSeconds = duration / timescale
  if (!(timescale > 0) || !Number.isFinite(durationSeconds) || !(durationSeconds > 0)) throw new Error("Invalid MP4 duration")
  if (frameCount * sampleDuration !== duration) throw new Error("MP4 sample timing and media duration disagree")
  const width = bytes.readUInt32BE(tkhd.end - 8) / 65536, height = bytes.readUInt32BE(tkhd.end - 4) / 65536
  if (width !== sequence.width || height !== sequence.height) throw new Error("AVC and MP4 track dimensions disagree")
  return { width, height, durationSeconds, frameCount, fps: frameCount / durationSeconds, audioTracks: 0, codec: "h264",
    encoding: { codec: "h264", profile: "high", pixelFormat: "yuv420p", audio: false, fastStart: true, color: { primaries: "bt709", transfer: "iec61966-2-1", matrix: "bt709", range: "limited", dynamicRange: "sdr" } },
  }
}
