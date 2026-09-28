export const CINEMATIC_PERFORMANCE_VERSION = "cinematic-performance.v1"
export const BASE_TRANSFER_BUDGET = 1_572_864
export const CINEMATIC_TRANSFER_BUDGETS = Object.freeze({ desktop: 4_194_304, mobile: 2_097_152 })
/** Only the selected cinematic home has the explicitly approved new ceiling.
 * Demo, assessment, ordinary routes and unproven profiles keep prior limits. */
export function routeTransferBudget(route, profile, settings = {}) {
  if (route !== "/" || !/^cinematic-v[1-9][0-9]*$/.test(settings.cinematic?.selectedRelease ?? "")) return BASE_TRANSFER_BUDGET
  if (profile === "desktop") return CINEMATIC_TRANSFER_BUDGETS.desktop
  if (profile === "mobile" || profile === "mobile-emulation") return CINEMATIC_TRANSFER_BUDGETS.mobile
  return BASE_TRANSFER_BUDGET
}
