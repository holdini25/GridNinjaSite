/** An explicit empty override keeps the ordinary static fallback available.
 * @param {Record<string, string | undefined>} env
 */
export function selectedCinematicReleaseId(env = process.env) {
  return env.CINEMATIC_ASSET_RELEASE ?? "cinematic-v1"
}
