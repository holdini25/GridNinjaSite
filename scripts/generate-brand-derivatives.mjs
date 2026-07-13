import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import pngToIco from "png-to-ico"
import sharp from "sharp"

const args = process.argv.slice(2)
const checkOnly = args.includes("--check")
const rootArgIndex = args.indexOf("--root")
const root = path.resolve(
  rootArgIndex === -1 ? process.cwd() : (args[rootArgIndex + 1] ?? "")
)
const brandDir = path.join(root, "public", "brand")

if (rootArgIndex !== -1 && !args[rootArgIndex + 1]) {
  throw new Error("--root requires a directory path")
}

const canonicalHashes = {
  "README.md": "8c0fed4b0c3c76b5168813b534bcf359265d9d2976e1af04567d91afdb923366",
  "gridninja-badge-light.svg": "1632c89ad277a9e24f383ec84fc89045dcc7d8d67a30b9fd600110f9d0b04a36",
  "gridninja-emblem-ceremonial.svg": "85b8e3898842f9562f342cf7a976add81f28fb3df0ddd8ccbe7e7d9c39a8720a",
  "gridninja-emblem-detailed-dark.svg": "d8d9d2865e05e5171ce37b5c29ded7a26866c61e619c84429f66c8567a44a6d5",
  "gridninja-emblem-monochrome.svg": "27dde9a57aa6f2f195699b0d2a6007e894be865c49b587816e24777a97ecbfde",
  "gridninja-favicon-proof-core.svg": "e9b2ac6db468ae6eed4693c0ad37645a319754f16ea07751151265ecc2718955",
  "gridninja-mark-micro.svg": "0b087bec57396488ef43cc8a9f7d540da95acd7e873af86efc39f141a3f14366",
}

const colors = {
  navy: "#07182B",
  site: "#070A0D",
  white: "#F7FAFC",
  silver: "#D7E0E8",
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex")
}

async function verifyCanonicalMasters() {
  for (const [filename, expectedHash] of Object.entries(canonicalHashes)) {
    const content = await readFile(path.join(brandDir, filename))
    const actualHash = sha256(content)

    if (actualHash !== expectedHash) {
      throw new Error(
        `Canonical brand source changed: ${filename}\nExpected ${expectedHash}\nReceived ${actualHash}`
      )
    }
  }
}

function extractExactly(source, pattern, label, capture = 0) {
  const matches = [...source.matchAll(pattern)]

  if (matches.length !== 1 || matches[0][capture] === undefined) {
    throw new Error(
      `Expected exactly one ${label} fragment in its canonical source; found ${matches.length}.`
    )
  }

  return matches[0][capture]
}

function proofStarSource(proofCore) {
  const copper = extractExactly(
    proofCore,
    /    <linearGradient id="copper"[\s\S]*?    <\/linearGradient>/g,
    "proof-core copper gradient"
  )
  const star = extractExactly(
    proofCore,
    /  <path d="M32 18[^"]+" fill="url\(#copper\)"\/>/g,
    "proof-core star path"
  )

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="13 13 38 38" role="img" aria-labelledby="title desc" shape-rendering="geometricPrecision">
  <title id="title">GridNinja proof star</title>
  <desc id="desc">The copper four-point GridNinja proof and control core.</desc>
  <defs>
${copper}
  </defs>
${star}
</svg>
`
}

function watermarkSource(detailed) {
  const copper = extractExactly(
    detailed,
    /    <linearGradient id="copper"[\s\S]*?    <\/linearGradient>/g,
    "detailed-emblem copper gradient"
  )
  const clip = extractExactly(
    detailed,
    /    <clipPath id="globeClip">[\s\S]*?    <\/clipPath>/g,
    "detailed-emblem globe clip"
  )
  const globe = extractExactly(
    detailed,
    /  <!-- Globe grid -->\n([\s\S]*?)\n\n  <!-- Mirrored guardian pair -->/g,
    "detailed-emblem globe grid",
    1
  )
  const proofCore = extractExactly(
    detailed,
    /  <!-- Proof\/control core -->\n(  <path[^>]+\/>)/g,
    "detailed-emblem proof core",
    1
  )

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-labelledby="title desc" shape-rendering="geometricPrecision">
  <title id="title">GridNinja globe and proof-core watermark</title>
  <desc id="desc">An outline copper globe surrounding the four-point GridNinja proof and control core.</desc>
  <defs>
${copper}
${clip}
  </defs>
${globe}
${proofCore}
</svg>
`
}

async function squarePng(svg, size, artworkScale, background) {
  const targetSize = size * artworkScale
  const roundedSize = Math.round(targetSize)
  const artworkSize =
    (size - roundedSize) % 2 === 0
      ? roundedSize
      : [roundedSize - 1, roundedSize + 1]
          .filter((candidate) => candidate > 0 && candidate <= size)
          .sort(
            (left, right) =>
              Math.abs(left - targetSize) - Math.abs(right - targetSize) ||
              left - right
          )[0]
  const artwork = await sharp(svg)
    .resize(artworkSize, artworkSize, { fit: "contain" })
    .png({ compressionLevel: 9 })
    .toBuffer()
  const offset = (size - artworkSize) / 2

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: background ?? { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: artwork, left: offset, top: offset }])
    .png({ compressionLevel: 9 })
    .toBuffer()
}

function svgDataUrl(svg) {
  return `data:image/svg+xml;base64,${svg.toString("base64")}`
}

function linkedInBannerSource(detailedEmblem) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4200 700" role="img" aria-labelledby="title desc">
  <title id="title">GridNinja LinkedIn company banner</title>
  <desc id="desc">GridNinja emblem with proof-backed virtual capacity positioning for AI data centers.</desc>
  <defs>
    <radialGradient id="surface" cx="50%" cy="45%" r="72%">
      <stop offset="0" stop-color="#102A45"/>
      <stop offset="1" stop-color="${colors.site}"/>
    </radialGradient>
    <pattern id="grid" width="70" height="70" patternUnits="userSpaceOnUse">
      <path d="M70 0H0v70" fill="none" stroke="#64748B" stroke-opacity=".08" stroke-width="2"/>
    </pattern>
  </defs>
  <rect width="4200" height="700" fill="url(#surface)"/>
  <rect width="4200" height="700" fill="url(#grid)"/>
  <image href="${svgDataUrl(detailedEmblem)}" x="980" y="90" width="520" height="520"/>
  <g font-family="Arial, Helvetica, sans-serif" font-weight="700" letter-spacing="14">
    <text x="1570" y="305" font-size="168" fill="${colors.white}">GRID</text>
    <text x="2070" y="305" font-size="168" fill="#F58220">NINJA</text>
  </g>
  <text x="1580" y="412" font-family="Arial, Helvetica, sans-serif" font-size="55" letter-spacing="5" fill="${colors.silver}">PROOF-BACKED VIRTUAL CAPACITY FOR AI DATA CENTERS</text>
  <path d="M1568 472H3260" stroke="#F58220" stroke-width="4" opacity=".8"/>
  <text x="1580" y="535" font-family="Arial, Helvetica, sans-serif" font-size="30" letter-spacing="8" fill="#94A3B8">INFRASTRUCTURE · INTELLIGENCE · CONTROL</text>
</svg>`
}

async function buildExpectedOutputs() {
  const detailed = await readFile(
    path.join(brandDir, "gridninja-emblem-detailed-dark.svg")
  )
  const proofCore = await readFile(
    path.join(brandDir, "gridninja-favicon-proof-core.svg")
  )
  const detailedText = detailed.toString("utf8")
  const proofCoreText = proofCore.toString("utf8")
  const icon16 = await squarePng(proofCore, 16, 0.875)
  const icon32 = await squarePng(proofCore, 32, 0.875)
  const icon48 = await squarePng(proofCore, 48, 0.875)
  const bannerSource = linkedInBannerSource(detailed)

  const outputs = new Map([
    ["public/brand/gridninja-proof-star.svg", Buffer.from(proofStarSource(proofCoreText))],
    ["public/brand/gridninja-watermark.svg", Buffer.from(watermarkSource(detailedText))],
    ["src/app/icon.svg", proofCore],
    ["src/app/icon1.png", icon16],
    ["src/app/icon2.png", icon32],
    ["src/app/apple-icon.png", await squarePng(detailed, 180, 0.86, colors.navy)],
    ["src/app/favicon.ico", await pngToIco([icon16, icon32, icon48])],
    ["public/brand/icons/pwa-192.png", await squarePng(detailed, 192, 0.86, colors.navy)],
    ["public/brand/icons/pwa-512.png", await squarePng(detailed, 512, 0.86, colors.navy)],
    ["public/brand/icons/pwa-maskable-192.png", await squarePng(detailed, 192, 0.72, colors.site)],
    ["public/brand/icons/pwa-maskable-512.png", await squarePng(detailed, 512, 0.72, colors.site)],
    [
      "public/brand/social/gridninja-og-emblem.png",
      await sharp(detailed)
        .resize(400, 400, { fit: "contain" })
        .png({ compressionLevel: 9 })
        .toBuffer(),
    ],
    ["public/brand/social/linkedin-avatar.png", await squarePng(detailed, 400, 0.76, colors.navy)],
    ["public/brand/social/linkedin-banner.svg", Buffer.from(bannerSource)],
    [
      "public/brand/social/linkedin-banner.jpg",
      await sharp(Buffer.from(bannerSource))
        .jpeg({ quality: 90, chromaSubsampling: "4:4:4" })
        .toBuffer(),
    ],
  ])

  const favicon = outputs.get("src/app/favicon.ico")

  if (!favicon || favicon.length > 32 * 1024) {
    throw new Error(
      `Generated favicon exceeds the 32KB limit (${favicon?.length ?? 0} bytes).`
    )
  }

  return outputs
}

async function checkOutputs(outputs) {
  const mismatches = []

  for (const [relativePath, expected] of outputs) {
    let actual

    try {
      actual = await readFile(path.join(root, relativePath))
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        mismatches.push(`${relativePath} (missing)`)
        continue
      }
      throw error
    }

    if (!actual.equals(expected)) {
      mismatches.push(`${relativePath} (expected ${sha256(expected)}, received ${sha256(actual)})`)
    }
  }

  if (mismatches.length > 0) {
    throw new Error(
      `Brand derivatives are stale. Run npm run brand:generate.\n${mismatches
        .map((value) => `- ${value}`)
        .join("\n")}`
    )
  }
}

async function writeOutputs(outputs) {
  for (const [relativePath, content] of outputs) {
    const outputPath = path.join(root, relativePath)
    await mkdir(path.dirname(outputPath), { recursive: true })
    await writeFile(outputPath, content)
  }
}

await verifyCanonicalMasters()
const outputs = await buildExpectedOutputs()

if (checkOnly) {
  await checkOutputs(outputs)
  console.log(`Verified ${outputs.size} deterministic GridNinja derivatives.`)
} else {
  await writeOutputs(outputs)
  console.log(`Verified canonical sources and generated ${outputs.size} GridNinja derivatives.`)
}
