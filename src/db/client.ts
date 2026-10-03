import "server-only"

import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"

import * as schema from "@/db/schema"

export function createDatabase(databaseUrl: string) {
  const client = neon(databaseUrl)

  return drizzle({ client, schema })
}

export type LeadDatabase = ReturnType<typeof createDatabase>

let database: LeadDatabase | undefined

export function getDatabase(): LeadDatabase {
  if (database) {
    return database
  }

  const databaseUrl = process.env.DATABASE_URL?.trim()
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for lead persistence.")
  }

  database = createDatabase(databaseUrl)
  return database
}
