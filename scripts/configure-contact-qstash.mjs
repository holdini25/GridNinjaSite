import { Client } from "@upstash/qstash"

const token = process.env.QSTASH_TOKEN?.trim()
const publicUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim()

if (!token || !publicUrl) {
  throw new Error("QSTASH_TOKEN and NEXT_PUBLIC_SITE_URL are required.")
}

const baseUrl = new URL(publicUrl).origin
const qstash = new Client({ token })
const common = {
  body: "{}",
  headers: { "Content-Type": "application/json" },
  method: "POST",
  retries: 5,
  timeout: "30s",
}

const sweep = await qstash.schedules.create({
  ...common,
  destination: `${baseUrl}/api/internal/lead-sweep`,
  cron: "* * * * *",
  scheduleId: "gridninja-lead-sweep-v1",
  label: "GridNinja lead delivery recovery sweep",
})

const retention = await qstash.schedules.create({
  ...common,
  destination: `${baseUrl}/api/internal/lead-retention`,
  cron: "17 3 * * *",
  scheduleId: "gridninja-lead-retention-v1",
  label: "GridNinja lead retention",
})

console.log(
  JSON.stringify({
    sweepScheduleId: sweep.scheduleId,
    retentionScheduleId: retention.scheduleId,
  })
)

