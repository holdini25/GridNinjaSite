import { mkdir, writeFile } from "node:fs/promises"
import { dirname } from "node:path"

/** Save all available raw evidence independently. Exclusive creation prevents a
 * repeated callback or later capture from replacing an earlier artifact.
 * @param {any} result
 * @param {{ report: string, trace: string, network: string }} paths
 * @param {(value: any, indent?: number) => string | undefined} serialize
 */
export async function preserveLighthouseArtifacts(result, paths, serialize = (value, indent) => JSON.stringify(value, null, indent)) {
  const artifacts = [
    { name: "report", value: result?.lhr ?? { missingReport: true }, present: result?.lhr != null, indent: 2 },
    { name: "trace", value: result?.artifacts?.Trace ?? null, present: result?.artifacts?.Trace != null },
    { name: "network", value: result?.artifacts?.DevtoolsLog ?? null, present: result?.artifacts?.DevtoolsLog != null },
  ]
  const settled = await Promise.allSettled(artifacts.map(async artifact => {
    const path = paths[artifact.name]
    const json = serialize(artifact.value, artifact.indent)
    if (typeof json !== "string") throw new Error(`Cannot serialize Lighthouse ${artifact.name}`)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, `${json}\n`, { flag: "wx" })
  }))
  return {
    schemaVersion: "facility-lighthouse-artifacts.v1",
    complete: settled.every(outcome => outcome.status === "fulfilled"),
    files: Object.fromEntries(artifacts.map((artifact, index) => {
      const outcome = settled[index]
      return [artifact.name, {
        path: paths[artifact.name], present: artifact.present,
        status: outcome.status === "fulfilled" ? "written" : "failed",
        ...(outcome.status === "rejected" ? { error: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason) } : {}),
      }]
    })),
  }
}

/** @param {Awaited<ReturnType<typeof preserveLighthouseArtifacts>>} receipt */
export function lighthouseArtifactFailure(receipt) {
  if (receipt.complete) return null
  const failures = Object.entries(receipt.files).filter(([, file]) => file.status === "failed")
  return new Error(`Lighthouse raw evidence preservation failed: ${failures.map(([name, file]) => `${name}: ${file.error}`).join("; ")}`)
}
