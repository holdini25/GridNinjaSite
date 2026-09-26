/** Operate public controls, including the v8 independent cutaway state. */
export async function chooseStillImage(viewer) {
  const summary = viewer.getByLabel("Display options", { exact: true })
  if (!await summary.evaluate(element => element.parentElement.open)) await summary.click()
  await viewer.getByRole("button", { name: "Use still image", exact: true }).click()
}

export async function chooseAssembly(viewer, kind) {
  await viewer.getByRole("button", { name: kind === "rack" ? "Inspect rack construction" : "Inspect cooling construction", exact: true, includeHidden: true }).evaluate(button => button.click())
}
export async function choosePose(viewer, kind, pose) {
  const mechanical = kind === "rack" && await viewer.locator('[aria-label="Rack actions"]').count() > 0
  const click = name => viewer.getByRole("button", { name, exact: true, includeHidden: true }).evaluate(button => button.click())
  if (!mechanical) { await click(pose === "closed" ? "Restore closed assembly" : pose === "cutaway" ? "Reveal interior" : kind === "rack" ? "Extend server tray" : "Inspect coil and manifold"); return }
  // Starting each reference pose closed makes captures independent of prior pose.
  if (await viewer.locator('.facility-rack-actions').getByRole("button", { name: "Close rack", exact: true, includeHidden: true }).count()) await viewer.locator('.facility-rack-actions').getByRole("button", { name: "Close rack", exact: true, includeHidden: true }).evaluate(button => button.click())
  if (await viewer.getByRole("button", { name: "Restore side panel", exact: true, includeHidden: true }).count()) await click("Restore side panel")
  if (pose === "cutaway") await click("Cutaway view")
  if (pose === "service") await viewer.locator('.facility-rack-actions').getByRole("button", { name: "Extend server tray", exact: true, includeHidden: true }).evaluate(button => button.click())
}
