import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { chromium } from "@playwright/test"
import { assessmentFixtures } from "../../src/content/assessments/fixtures"
import { parsePublicationManifest } from "../../src/lib/assessment/publications"
import { serializeAssessment } from "../../src/lib/assessment/invariants"
import { assessmentNarrative, BRIEF_TEMPLATE_VERSION, renderAssessmentBrief } from "../../src/lib/assessment/brief-template"

const root = join(process.cwd(), "src/content/assessment-publications")
const sha256 = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex")
const browser = await chromium.launch()
try {
  for (const record of Object.values(assessmentFixtures)) {
    if (record.publication.templateVersion !== BRIEF_TEMPLATE_VERSION) throw new Error("Template version mismatch")
    const directory = join(root, record.publication.id, `v${record.publication.version}`)
    const files: Record<string, string | Buffer> = {
      "snapshot.json": serializeAssessment(record),
      "narrative.json": `${JSON.stringify(assessmentNarrative(record), null, 2)}\n`,
      "brief.html": renderAssessmentBrief(record),
    }
    if (existsSync(directory)) {
      for (const [file, expected] of Object.entries(files)) {
        if ((await readFile(join(directory, file), "utf8")) !== expected) throw new Error(`${directory}/${file} is immutable; increment the publication version`)
      }
      const manifest = parsePublicationManifest(JSON.parse(await readFile(join(directory, "manifest.json"), "utf8")))
      for (const artifact of manifest.artifacts) {
        const bytes = await readFile(join(directory, artifact.file))
        if (bytes.length !== artifact.bytes || sha256(bytes) !== artifact.sha256) throw new Error(`${directory}/${artifact.file} failed integrity verification`)
      }
      console.log(`Retained ${record.publication.id} v${record.publication.version}`)
      continue
    }
    const page = await browser.newPage()
    await page.route("**/*", (route) => route.abort())
    await page.setContent(files["brief.html"] as string)
    files["brief.pdf"] = await page.pdf({ format: "Letter", preferCSSPageSize: true, printBackground: true, tagged: true, outline: true })
    await page.close()
    await mkdir(directory, { recursive: true })
    for (const [file, bytes] of Object.entries(files)) await writeFile(join(directory, file), bytes, { flag: "wx" })
    const manifest = {
      schemaVersion: "assessment-publication.v1", publicationId: record.publication.id,
      version: record.publication.version, status: "available", provenance: "synthetic",
      narrativeVersion: record.publication.narrativeVersion, templateVersion: BRIEF_TEMPLATE_VERSION,
      artifacts: Object.entries(files).map(([file, bytes]) => ({ file, sha256: sha256(bytes), bytes: Buffer.byteLength(bytes) })),
    }
    await writeFile(join(directory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" })
    console.log(`Created ${record.publication.id} v${record.publication.version}`)
  }
} finally { await browser.close() }
