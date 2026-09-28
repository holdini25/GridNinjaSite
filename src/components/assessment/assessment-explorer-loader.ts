/** Keep the interactive explorer out of the initial server-rendered brief. */
export function loadAssessmentExplorer() {
  return import("./assessment-explorer")
}

/** A static preview is tied to its server response; history restores it natively. */
export function reloadAssessmentLocation() {
  window.location.reload()
}
