import assert from "node:assert/strict"

// Deliberately finite, reviewed application checks. This is not a general
// process supervisor: do not add servers, daemon launchers, shell snippets,
// runtime -e code, or commands that leave detached children after success.
const scripts = Object.freeze({
  quality: "validate", brand: "brand:check", lint: "lint", typecheck: "typecheck",
  unit: "test:unit", integration: "test:integration:required", build: "build",
  seo: "test:seo", "seo-smoke": "test:seo:smoke",
  lighthouse: "facility:lighthouse", "page-performance": "facility:measure",
  "performance-summary": "facility:performance:validate", "facility-browser": "facility:verify-browser",
  audit: "audit:prod", "publication-integrity": "assessment:validate",
})
const projects = Object.freeze({
  "browser-chrome": "chrome-stable", "browser-chromium": "chromium-desktop",
  "browser-firefox": "firefox-desktop", "browser-webkit": "webkit-desktop",
  "browser-chromium-mobile": "chromium-mobile", "browser-webkit-mobile": "webkit-mobile",
})

export function assertSupportedCommand(phase, command, args) {
  assert.equal(command, "npm", "Unsupported cleanup contract: only reviewed finite npm checks may qualify")
  if (projects[phase]) {
    assert.deepEqual(args.slice(0, 3), ["run", "test:e2e", "--"], "Browser qualification requires the reviewed test:e2e script")
    const flags = args.slice(3)
    const required = [`--project=${projects[phase]}`, "--workers=1"]
    const optional = ["--retries=0", "--reporter=list,json"]
    assert(required.every(flag => flags.includes(flag)) && new Set(flags).size === flags.length && flags.every(flag => [...required, ...optional].includes(flag)), "Unsupported browser flags or mismatched qualification phase")
  } else {
    assert(scripts[phase], "Unsupported cleanup contract: this phase has no reviewed finite command")
    assert.deepEqual(args, ["run", scripts[phase]], "Unsupported command for qualification phase")
  }
  return { id: `finite-npm:${phase}`, cleanupScope: "owned-process-group-and-live-verified-descendants", detachedAfterSuccess: "unsupported; nested supervisors must close their children" }
}
