type PosterState = "pending" | "decoded" | "failed"

/** Each completion belongs to one selected image source and one decode attempt. */
export function createPosterDecoder(getImage: () => HTMLImageElement | null, expectedSource: () => string, onState: (state: PosterState) => void) {
  let active = true, generation = 0, decodedSource: string | null = null
  const sourceOf = (image: HTMLImageElement) => image.currentSrc || image.src
  const current = (image: HTMLImageElement, source: string, attempt: number) => active && generation === attempt && getImage() === image && sourceOf(image) === source && expectedSource() === source
  const invalidate = () => {
    if (!active) return
    generation++
    decodedSource = null
    onState("pending")
  }
  return {
    invalidate,
    decode() {
      if (!active) return
      invalidate()
      const image = getImage()
      if (!image) return
      const source = sourceOf(image), attempt = generation
      // During picture source selection currentSrc can still name the old image.
      if (source !== expectedSource()) return
      const finish = (state: "decoded" | "failed") => {
        if (!current(image, source, attempt)) return
        decodedSource = state === "decoded" ? source : null
        onState(state)
      }
      // Cached failures may finish before hydration attaches onError.
      if (!image.naturalWidth) { if (image.complete) finish("failed"); return }
      if (!image.decode) { finish("decoded"); return }
      void image.decode().then(() => finish("decoded"), () => finish("failed"))
    },
    isDecoded() {
      const image = getImage()
      return !!(active && image && image.complete && image.naturalWidth && decodedSource && sourceOf(image) === decodedSource && expectedSource() === decodedSource)
    },
    dispose() { active = false; generation++; decodedSource = null },
  }
}
