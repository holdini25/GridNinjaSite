/** Deliberately supports a single byte range. Unsupported syntax falls back to
 * a full representation; valid but unsatisfiable ranges return 416. */
export function byteRange(header, length) {
  if (!header || !/^bytes=/i.test(header)) return null
  const match = /^bytes=(\d*)-(\d*)$/i.exec(header.trim())
  if (!match || (!match[1] && !match[2])) return null
  const first = match[1] ? Number(match[1]) : null
  const last = match[2] ? Number(match[2]) : null
  if ((first !== null && !Number.isSafeInteger(first)) || (last !== null && !Number.isSafeInteger(last))) return null
  if (first === null) return last === 0 ? false : { start: Math.max(0, length - last), end: length - 1 }
  if (last !== null && first > last) return null
  if (first >= length) return false
  return { start: first, end: Math.min(last ?? length - 1, length - 1) }
}

export function assetResponse(bytes, descriptor, request) {
  const etag = `"${descriptor.sha256}"`
  const headers = new Headers({ "Content-Type": descriptor.mimeType, "Content-Length": String(bytes.length),
    "Cache-Control": "public, max-age=0, must-revalidate", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex",
    "Accept-Ranges": "bytes", ETag: etag,
  })
  const condition = request.headers.get("if-none-match")
  if (condition?.trim() === "*" || condition?.split(",").some(value => value.trim().replace(/^W\//, "") === etag)) {
    headers.delete("Content-Length")
    return new Response(null, { status: 304, headers })
  }
  if (request.method === "HEAD") return new Response(null, { status: 200, headers })
  const ifRange = request.headers.get("if-range")
  const range = !ifRange || ifRange === etag ? byteRange(request.headers.get("range"), bytes.length) : null
  if (range === false) {
    headers.set("Content-Range", `bytes */${bytes.length}`); headers.set("Content-Length", "0")
    return new Response(null, { status: 416, headers })
  }
  if (range) {
    headers.set("Content-Range", `bytes ${range.start}-${range.end}/${bytes.length}`)
    headers.set("Content-Length", String(range.end - range.start + 1))
    return new Response(new Uint8Array(bytes.subarray(range.start, range.end + 1)), { status: 206, headers })
  }
  return new Response(new Uint8Array(bytes), { status: 200, headers })
}
