/** Keep native navigation available when privacy settings or the browser reject history writes. */
export function writeAssessmentHistory(href: string, navigation = {
  push: (destination: string) => window.history.pushState(null, "", destination),
  native: (destination: string) => window.location.assign(destination),
}) {
  try { navigation.push(href); return true }
  catch { navigation.native(href); return false }
}
