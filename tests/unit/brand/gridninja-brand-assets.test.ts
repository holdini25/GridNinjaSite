import { createHash } from "node:crypto"
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { spawnSync } from "node:child_process"

import sharp from "sharp"
import { describe, expect, it } from "vitest"

const canonicalSources = {
  "README.md":
    "8c0fed4b0c3c76b5168813b534bcf359265d9d2976e1af04567d91afdb923366",
  "gridninja-emblem-ceremonial.svg":
    "85b8e3898842f9562f342cf7a976add81f28fb3df0ddd8ccbe7e7d9c39a8720a",
  "gridninja-emblem-detailed-dark.svg":
    "d8d9d2865e05e5171ce37b5c29ded7a26866c61e619c84429f66c8567a44a6d5",
  "gridninja-mark-micro.svg":
    "0b087bec57396488ef43cc8a9f7d540da95acd7e873af86efc39f141a3f14366",
  "gridninja-emblem-monochrome.svg":
    "27dde9a57aa6f2f195699b0d2a6007e894be865c49b587816e24777a97ecbfde",
  "gridninja-badge-light.svg":
    "1632c89ad277a9e24f383ec84fc89045dcc7d8d67a30b9fd600110f9d0b04a36",
  "gridninja-favicon-proof-core.svg":
    "e9b2ac6db468ae6eed4693c0ad37645a319754f16ea07751151265ecc2718955",
} as const

const canonicalMasters = Object.keys(canonicalSources).filter(
  (filename) => filename.endsWith(".svg")
)
const canonicalFaviconSource = {
  path: "assets/brand/gridninja-logo.png",
  sha256: "e0d0da30b043d3a0d9a4eb7c2c61071cf583e50efb19f94075af9b06bb18b899",
} as const
const approvedBinaryExports = {
  "public/brand/social/linkedin-banner.jpg":
    "5d26262e258bb67e86c8ba7def76f687a6d51e00db992d2e0215b8160ad4f8d2",
} as const
const generator = resolve(
  process.cwd(),
  "scripts",
  "generate-brand-derivatives.mjs"
)

function extractExactly(source: string, pattern: RegExp, capture = 0) {
  const matches = [...source.matchAll(pattern)]
  expect(matches).toHaveLength(1)
  return matches[0][capture]
}

async function readArtworkBounds(
  filename: string,
  background: readonly [number, number, number]
) {
  const { data, info } = await sharp(resolve(process.cwd(), filename))
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  let minX = info.width
  let minY = info.height
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * info.channels
      const difference = Math.max(
        Math.abs(data[offset] - background[0]),
        Math.abs(data[offset + 1] - background[1]),
        Math.abs(data[offset + 2] - background[2])
      )

      if (difference > 8) {
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
    }
  }

  expect(maxX).toBeGreaterThanOrEqual(minX)
  expect(maxY).toBeGreaterThanOrEqual(minY)

  return {
    height: info.height,
    margins: {
      bottom: info.height - 1 - maxY,
      left: minX,
      right: info.width - 1 - maxX,
      top: minY,
    },
    width: info.width,
  }
}

describe("GridNinja canonical brand sources", () => {
  it("keeps the supplied favicon raster byte-identical", async () => {
    const source = await readFile(
      resolve(process.cwd(), canonicalFaviconSource.path)
    )
    const actualHash = createHash("sha256").update(source).digest("hex")

    expect(actualHash).toBe(canonicalFaviconSource.sha256)
    expect(await sharp(source).metadata()).toMatchObject({
      width: 1254,
      height: 1254,
      format: "png",
    })
  })

  it.each(Object.entries(canonicalSources))(
    "keeps %s byte-identical to the approved archive",
    async (filename, expectedHash) => {
      const source = await readFile(
        resolve(process.cwd(), "public", "brand", filename)
      )
      const actualHash = createHash("sha256").update(source).digest("hex")

      expect(actualHash).toBe(expectedHash)
    }
  )

  it.each(canonicalMasters)(
    "keeps %s vector-only and self-contained",
    async (filename) => {
      const source = await readFile(
        resolve(process.cwd(), "public", "brand", filename),
        "utf8"
      )

      expect(source).toContain("<svg")
      expect(source).toContain("viewBox=")
      expect(source).not.toMatch(/<image\b/i)
      expect(source).not.toMatch(/(?:href|src)=["']https?:/i)
      expect(source).not.toMatch(/data:image\//i)
    }
  )
})

describe("GridNinja derived vector artwork", () => {
  it("copies only the canonical proof gradient and star into the proof-star derivative", async () => {
    const canonical = await readFile(
      resolve(process.cwd(), "public/brand/gridninja-favicon-proof-core.svg"),
      "utf8"
    )
    const derivative = await readFile(
      resolve(process.cwd(), "public/brand/gridninja-proof-star.svg"),
      "utf8"
    )
    const gradient = extractExactly(
      canonical,
      /    <linearGradient id="copper"[\s\S]*?    <\/linearGradient>/g
    )
    const star = extractExactly(
      canonical,
      /  <path d="M32 18[^"]+" fill="url\(#copper\)"\/>/g
    )

    expect(derivative).toContain(gradient)
    expect(derivative).toContain(star)
    expect(derivative).toContain('viewBox="13 13 38 38"')
    expect(derivative.match(/<path\b/g)).toHaveLength(1)
    expect(derivative).not.toContain("<circle")
  })

  it("copies the detailed emblem globe and proof fragments into the watermark", async () => {
    const canonical = await readFile(
      resolve(process.cwd(), "public/brand/gridninja-emblem-detailed-dark.svg"),
      "utf8"
    )
    const derivative = await readFile(
      resolve(process.cwd(), "public/brand/gridninja-watermark.svg"),
      "utf8"
    )
    const fragments = [
      extractExactly(
        canonical,
        /    <linearGradient id="copper"[\s\S]*?    <\/linearGradient>/g
      ),
      extractExactly(
        canonical,
        /    <clipPath id="globeClip">[\s\S]*?    <\/clipPath>/g
      ),
      extractExactly(
        canonical,
        /  <!-- Globe grid -->\n([\s\S]*?)\n\n  <!-- Mirrored guardian pair -->/g,
        1
      ),
      extractExactly(
        canonical,
        /  <!-- Proof\/control core -->\n(  <path[^>]+\/>)/g,
        1
      ),
    ]

    for (const fragment of fragments) {
      expect(derivative).toContain(fragment)
    }
    expect(derivative).not.toContain("guardian")
    expect(derivative).not.toContain("url(#armor)")
  })
})

describe("GridNinja browser and social derivatives", () => {
  it.each(Object.entries(approvedBinaryExports))(
    "keeps reviewed binary export %s byte-identical",
    async (filename, expectedHash) => {
      const content = await readFile(resolve(process.cwd(), filename))
      const actualHash = createHash("sha256").update(content).digest("hex")

      expect(actualHash).toBe(expectedHash)
    }
  )

  it.each([
    ["public/gridninja-apple-touch-icon-180.png", 180, 180, "png"],
    ["public/gridninja-icon-192.png", 192, 192, "png"],
    ["public/gridninja-icon-512.png", 512, 512, "png"],
    ["public/brand/icons/pwa-192.png", 192, 192, "png"],
    ["public/brand/icons/pwa-512.png", 512, 512, "png"],
    ["public/brand/icons/pwa-maskable-192.png", 192, 192, "png"],
    ["public/brand/icons/pwa-maskable-512.png", 512, 512, "png"],
    ["public/brand/social/gridninja-og-emblem.png", 400, 400, "png"],
    ["public/brand/social/linkedin-avatar.png", 400, 400, "png"],
    ["public/brand/social/linkedin-banner.jpg", 4200, 700, "jpeg"],
  ] as const)(
    "keeps %s at its approved dimensions and format",
    async (filename, width, height, format) => {
      const metadata = await sharp(resolve(process.cwd(), filename)).metadata()

      expect(metadata).toMatchObject({ width, height, format })
    }
  )

  it.each([
    "public/gridninja-apple-touch-icon-180.png",
    "public/brand/icons/pwa-maskable-192.png",
    "public/brand/icons/pwa-maskable-512.png",
    "public/brand/social/linkedin-avatar.png",
  ])("keeps %s fully opaque", async (filename) => {
    const stats = await sharp(resolve(process.cwd(), filename)).stats()
    expect(stats.isOpaque).toBe(true)
  })

  it.each([
    "public/gridninja-icon-192.png",
    "public/gridninja-icon-512.png",
    "public/brand/icons/pwa-192.png",
    "public/brand/icons/pwa-512.png",
  ])("keeps %s transparent outside the supplied mark", async (filename) => {
    const image = sharp(resolve(process.cwd(), filename))
    const metadata = await image.metadata()
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true })
    const alpha = info.channels - 1
    const corners = [
      data[alpha],
      data[(info.width - 1) * info.channels + alpha],
      data[(info.height - 1) * info.width * info.channels + alpha],
      data[(info.width * info.height - 1) * info.channels + alpha],
    ]
    const centerOffset =
      (Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2)) *
        info.channels +
      alpha

    expect(metadata.hasAlpha).toBe(true)
    expect(corners).toEqual([0, 0, 0, 0])
    expect(data[centerOffset]).toBe(255)
    expect((await image.stats()).isOpaque).toBe(false)
  })

  it.each([
    ["public/brand/icons/pwa-maskable-192.png", [7, 10, 13], 0.2, 0.22],
    ["public/brand/icons/pwa-maskable-512.png", [7, 10, 13], 0.2, 0.22],
  ] as const)(
    "centers %s with balanced visible artwork margins",
    async (filename, background, minimumMargin, maximumMargin) => {
      const { height, margins, width } = await readArtworkBounds(
        filename,
        background
      )

      expect(Math.abs(margins.left - margins.right)).toBeLessThanOrEqual(1)
      expect(Math.abs(margins.top - margins.bottom)).toBeLessThanOrEqual(1)
      for (const [margin, size] of [
        [margins.left, width],
        [margins.right, width],
        [margins.top, height],
        [margins.bottom, height],
      ] as const) {
        expect(margin / size).toBeGreaterThanOrEqual(minimumMargin)
        expect(margin / size).toBeLessThanOrEqual(maximumMargin)
      }
    }
  )

  it("keeps the Open Graph emblem transparent", async () => {
    const stats = await sharp(
      resolve(process.cwd(), "public/brand/social/gridninja-og-emblem.png")
    ).stats()
    expect(stats.isOpaque).toBe(false)
  })

  it.each([192, 512])(
    "keeps the %spx maskable artwork inside the central 60 percent safe area",
    async (size) => {
      const { data, info } = await sharp(
        resolve(process.cwd(), `public/brand/icons/pwa-maskable-${size}.png`)
      )
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })
      const edge = Math.floor(size * 0.2)
      const background = [7, 10, 13]
      let paddingIsClear = true

      outer:
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          if (x >= edge && x < size - edge && y >= edge && y < size - edge) {
            continue
          }
          const offset = (y * size + x) * info.channels
          if (
            data[offset] !== background[0] ||
            data[offset + 1] !== background[1] ||
            data[offset + 2] !== background[2]
          ) {
            paddingIsClear = false
            break outer
          }
        }
      }

      expect(paddingIsClear).toBe(true)
    }
  )

  it("uses the proof core only for the 16px favicon entry", async () => {
    const favicon = await readFile(resolve(process.cwd(), "public/favicon.ico"))
    const count = favicon.readUInt16LE(4)
    const entries = Array.from({ length: count }, (_, index) => {
      const offset = 6 + index * 16
      const width = favicon[offset] || 256
      const height = favicon[offset + 1] || 256
      const imageOffset = favicon.readUInt32LE(offset + 12)
      const pixelOffset = imageOffset + favicon.readUInt32LE(imageOffset)
      const alphaAt = (x: number, y: number) =>
        favicon[pixelOffset + (y * width + x) * 4 + 3]
      const pixels = Array.from({ length: width * height }, (_, pixelIndex) => {
        const pixelDataOffset = pixelOffset + pixelIndex * 4

        return {
          alpha: favicon[pixelDataOffset + 3],
          blue: favicon[pixelDataOffset],
          green: favicon[pixelDataOffset + 1],
          red: favicon[pixelDataOffset + 2],
        }
      })

      return {
        size: [width, height],
        corners: [
          alphaAt(0, 0),
          alphaAt(width - 1, 0),
          alphaAt(0, height - 1),
          alphaAt(width - 1, height - 1),
        ],
        center: alphaAt(Math.floor(width / 2), Math.floor(height / 2)),
        containsWhiteArtwork: pixels.some(
          ({ alpha, blue, green, red }) =>
            alpha > 128 && red > 200 && green > 200 && blue > 200
        ),
      }
    })

    expect(favicon.readUInt16LE(0)).toBe(0)
    expect(favicon.readUInt16LE(2)).toBe(1)
    expect(entries.map((entry) => entry.size)).toEqual([
      [16, 16],
      [32, 32],
      [48, 48],
    ])
    expect(entries.every((entry) => entry.corners.every((alpha) => alpha === 0))).toBe(
      true
    )
    expect(entries.every((entry) => entry.center === 255)).toBe(true)
    expect(entries.map((entry) => entry.containsWhiteArtwork)).toEqual([
      false,
      true,
      true,
    ])
    expect(favicon.length).toBeLessThanOrEqual(32 * 1024)
  })

  it("keeps LinkedIn exports within upload limits", async () => {
    const avatar = await readFile(
      resolve(process.cwd(), "public/brand/social/linkedin-avatar.png")
    )
    const banner = await readFile(
      resolve(process.cwd(), "public/brand/social/linkedin-banner.jpg")
    )

    expect(avatar.length).toBeLessThan(8 * 1024 * 1024)
    expect(banner.length).toBeLessThan(3 * 1024 * 1024)
  })
})

describe("GridNinja derivative integrity command", () => {
  it("accepts the complete checked-in deterministic output set", () => {
    const result = spawnSync(process.execPath, [generator, "--check"], {
      cwd: process.cwd(),
      encoding: "utf8",
    })

    expect(result.stderr).toBe("")
    expect(result.status).toBe(0)
    expect(result.stdout).toContain(
      "Verified 13 deterministic GridNinja derivatives and 1 approved binary export."
    )
  }, 30_000)

  it("detects a stale derivative without rewriting it", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "gridninja-brand-check-"))
    const sandboxBrand = join(sandbox, "public", "brand")
    const stalePath = join(sandbox, "public", "brand", "gridninja-proof-star.svg")
    const lockedExportPath = join(
      sandbox,
      "public",
      "brand",
      "social",
      "linkedin-banner.jpg"
    )

    try {
      await cp(resolve(process.cwd(), "public", "brand"), sandboxBrand, {
        recursive: true,
      })
      await cp(
        resolve(process.cwd(), "assets", "brand"),
        join(sandbox, "assets", "brand"),
        { recursive: true }
      )
      const lockedExport = await readFile(lockedExportPath)
      const generate = spawnSync(process.execPath, [generator, "--root", sandbox], {
        cwd: process.cwd(),
        encoding: "utf8",
      })
      expect(generate.stderr).toBe("")
      expect(generate.status).toBe(0)
      expect(await readFile(lockedExportPath)).toEqual(lockedExport)

      const stale = Buffer.concat([await readFile(stalePath), Buffer.from("\n")])
      await writeFile(stalePath, stale)

      const check = spawnSync(
        process.execPath,
        [generator, "--check", "--root", sandbox],
        { cwd: process.cwd(), encoding: "utf8" }
      )

      expect(check.status).toBe(1)
      expect(check.stderr).toContain("gridninja-proof-star.svg")
      expect(await readFile(stalePath)).toEqual(stale)
    } finally {
      await rm(dirname(sandboxBrand), { recursive: true, force: true })
      await rm(sandbox, { recursive: true, force: true })
    }
  }, 30_000)
})
