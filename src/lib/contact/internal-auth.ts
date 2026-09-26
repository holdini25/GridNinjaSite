import { createHash, timingSafeEqual } from "node:crypto"

export function hasInternalBearer(request: Request, secret: string | undefined) {
  if (!secret || secret.length < 32) return false
  const supplied = request.headers.get("authorization") ?? ""
  if (supplied.length > 512) return false
  return timingSafeEqual(createHash("sha256").update(supplied).digest(),
    createHash("sha256").update(`Bearer ${secret}`).digest())
}
