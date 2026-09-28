let moduleRequest: Promise<typeof import("./nav-drawer-dialog")> | undefined

export function loadNavigationDrawer() {
  moduleRequest ??= import("./nav-drawer-dialog").catch(error => {
    moduleRequest = undefined
    throw error
  })
  return moduleRequest
}
