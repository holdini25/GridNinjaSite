import type { NeonQueryFunction } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import type { Pool, PoolClient } from "pg"
import * as leadSchema from "@/db/schema"
import * as observationsSchema from "@/db/observations-schema"

type LocalQuery = { text: string; params: unknown[]; options: { arrayMode?: boolean } }

// Keep production Neon/Drizzle query builders and lazy batch transactions, but
// execute them on disposable PostgreSQL. This adapter never contacts Neon.
export function localDatabase(pool: Pool) {
  async function execute(query: LocalQuery, connection: Pool | PoolClient = pool) {
    return connection.query({ text: query.text, values: query.params, ...(query.options.arrayMode ? { rowMode: "array" } : {}) })
  }
  const client = {
    query(text: string, params: unknown[], options: LocalQuery["options"] = {}) {
      const query = { text, params, options }
      return { ...query, then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => execute(query).then(resolve, reject) }
    },
    async transaction(queries: LocalQuery[]) {
      const connection = await pool.connect()
      try {
        await connection.query("begin")
        const results = []
        for (const query of queries) results.push(await execute(query, connection))
        await connection.query("commit")
        return results
      } catch (error) {
        await connection.query("rollback")
        throw error
      } finally { connection.release() }
    },
  }
  return drizzle({ client: client as unknown as NeonQueryFunction<false, false>, schema: { ...leadSchema, ...observationsSchema } })
}
