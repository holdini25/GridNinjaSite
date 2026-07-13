import { spawn } from "node:child_process"
import path from "node:path"

if (!process.env.TEST_DATABASE_URL?.trim()) {
  console.error(
    "TEST_DATABASE_URL is required. Use npm run test:integration for the optional local suite."
  )
  process.exitCode = 1
} else {
  const vitestCli = path.join(
    process.cwd(),
    "node_modules",
    "vitest",
    "vitest.mjs"
  )
  const child = spawn(
    process.execPath,
    [vitestCli, "run", "--config", "vitest.integration.config.ts"],
    {
      env: process.env,
      stdio: "inherit",
      windowsHide: true,
    }
  )

  child.once("error", (error) => {
    console.error(`Unable to start required integration tests: ${error.message}`)
    process.exitCode = 1
  })
  child.once("exit", (code, signal) => {
    if (signal) {
      console.error(`Required integration tests stopped by ${signal}.`)
      process.exitCode = 1
      return
    }

    process.exitCode = code ?? 1
  })
}
