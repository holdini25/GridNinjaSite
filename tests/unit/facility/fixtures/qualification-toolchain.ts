// Synthetic assertion input only; this never claims installed package identity.
export const qualificationToolchainFixture = () => ({
  schemaVersion: "gridninja-qualification-toolchain.v1",
  versions: { node: "22.23.2", lighthouse: "13.5.0", puppeteerCore: "25.13.0", chromeLauncher: "1.2.2", chrome: "155.0.8059.79" },
  actualNode: "22.23.2",
  manifestSha256: "a".repeat(64), lockSha256: "b".repeat(64),
  resolvedPackages: {
    lighthouse: "node_modules/lighthouse/package.json",
    "puppeteer-core": "node_modules/puppeteer-core/package.json",
    "chrome-launcher": "node_modules/chrome-launcher/package.json",
  },
})
