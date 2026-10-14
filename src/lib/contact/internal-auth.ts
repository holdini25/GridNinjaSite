import "server-only"
import { timingSafeEqual } from "node:crypto"

export function hasInternalBearer(request: Request, secret: string | undefined) {
  if (!secret || secret.length < 32) return false
  const supplied = request.headers.get("authorization") ?? ""
  const expected = `Bearer ${secret}`
  return supplied.length <= 512 && Buffer.byteLength(supplied) === Buffer.byteLength(expected)
    && timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
}
