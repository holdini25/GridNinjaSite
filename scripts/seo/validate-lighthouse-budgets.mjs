import { readdir, readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

const require = createRequire(import.meta.url)

export const LIGHTHOUSE_RESOURCE_BUDGETS = Object.freeze({
  totalBytes: 1_572_864,
  fontBytes: 163_840,
  insightScriptBytes: 204_800,
  largestImageBytes: 256_000,
})

export function validateLighthouseReport(report) {
  const route = reportPathname(report)
  const violations = []
  const summary = getAuditItems(report, "resource-summary", route, violations)
  const requests = getAuditItems(report, "network-requests", route, violations)

  if (summary) {
    enforceSummaryBudget(
      summary,
      "total",
      LIGHTHOUSE_RESOURCE_BUDGETS.totalBytes,
      route,
      violations
    )
    enforceSummaryBudget(
      summary,
      "font",
      LIGHTHOUSE_RESOURCE_BUDGETS.fontBytes,
      route,
      violations
    )

    if (isInsightArticle(route)) {
      enforceSummaryBudget(
        summary,
        "script",
        LIGHTHOUSE_RESOURCE_BUDGETS.insightScriptBytes,
        route,
        violations
      )
    }
  }

  if (requests) {
    const images = requests.filter(
      (request) => String(request.resourceType).toLowerCase() === "image"
    )
    const invalidImage = images.find(
      (request) => !Number.isFinite(request.transferSize)
    )

    if (invalidImage) {
      violations.push(`${route}: image request is missing transferSize`)
    } else {
      const largestImage = images.reduce(
        (largest, request) => Math.max(largest, request.transferSize),
        0
      )
      if (largestImage > LIGHTHOUSE_RESOURCE_BUDGETS.largestImageBytes) {
        violations.push(
          formatBudgetViolation(
            route,
            "largest image",
            largestImage,
            LIGHTHOUSE_RESOURCE_BUDGETS.largestImageBytes
          )
        )
      }
    }
  }

  return violations
}

export function validateLighthouseReports(
  reports,
  { expectedUrls, numberOfRuns }
) {
  const violations = []
  const counts = new Map()

  for (const report of reports) {
    const route = reportPathname(report)
    counts.set(route, (counts.get(route) ?? 0) + 1)
    violations.push(...validateLighthouseReport(report))
  }

  for (const url of expectedUrls) {
    const route = new URL(url).pathname
    const count = counts.get(route) ?? 0
    if (count < numberOfRuns) {
      violations.push(
        `${route}: expected at least ${numberOfRuns} Lighthouse reports, received ${count}`
      )
    }
  }

  return violations.sort()
}

function reportPathname(report) {
  const reportUrl = report.finalUrl ?? report.requestedUrl
  if (typeof reportUrl !== "string") {
    throw new Error("Lighthouse report is missing finalUrl and requestedUrl")
  }
  return new URL(reportUrl).pathname
}

function getAuditItems(report, auditId, route, violations) {
  const audit = report.audits?.[auditId]
  const items = audit?.details?.items
  if (!Array.isArray(items)) {
    violations.push(`${route}: Lighthouse audit ${auditId} has no resource items`)
    return null
  }
  return items
}

function enforceSummaryBudget(items, resourceType, budget, route, violations) {
  const resource = items.find((item) => item.resourceType === resourceType)
  if (!resource || !Number.isFinite(resource.transferSize)) {
    violations.push(`${route}: resource summary is missing ${resourceType} transferSize`)
    return
  }
  if (resource.transferSize > budget) {
    violations.push(
      formatBudgetViolation(
        route,
        `${resourceType} transfer`,
        resource.transferSize,
        budget
      )
    )
  }
}

function formatBudgetViolation(route, label, actual, budget) {
  return `${route}: ${label} ${formatKiB(actual)} exceeds ${formatKiB(budget)}`
}

function formatKiB(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`
}

function isInsightArticle(route) {
  return route.startsWith("/insights/")
}

async function collectLighthouseReports(directory) {
  const files = await collectJsonFiles(directory)
  const reports = []

  for (const file of files) {
    const document = JSON.parse(await readFile(file, "utf8"))
    if (document?.lighthouseVersion && document?.audits) {
      reports.push(document)
    }
  }

  if (reports.length === 0) {
    throw new Error(`No Lighthouse reports found in ${directory}`)
  }
  return reports
}

async function collectJsonFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await collectJsonFiles(path)))
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(path)
    }
  }

  return files.sort()
}

async function main() {
  const config = require("../../lighthouserc.cjs")
  const reportDirectory = resolve(
    process.argv[2] ?? config.ci.upload.outputDir
  )
  const reports = await collectLighthouseReports(reportDirectory)
  const violations = validateLighthouseReports(reports, {
    expectedUrls: config.ci.collect.url,
    numberOfRuns: config.ci.collect.numberOfRuns,
  })

  if (violations.length > 0) {
    throw new Error(
      `Lighthouse resource budgets failed:\n- ${violations.join("\n- ")}`
    )
  }

  console.log(
    `Lighthouse resource budgets passed for ${reports.length} reports across ${config.ci.collect.url.length} routes.`
  )
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
