/** Duration measured only by the existing frame owner while a stationary probe
 * is permitted. Finite inspection and suspended time cannot spend its budget. */
export function createStationaryProbe() {
  let remaining = 0, permitted = false, previousSample = false
  return {
    get pending() { return remaining > 0 },
    get remainingSeconds() { return remaining },
    reset(seconds: number) {
      if (!Number.isFinite(seconds) || seconds < 0) throw new Error("invalid_stationary_probe_duration")
      remaining = seconds; permitted = previousSample = false
    },
    configure(allowed: boolean) {
      permitted = allowed && remaining > 0
      if (!permitted) previousSample = false
      return permitted
    },
    sample(delta: number) {
      if (!permitted) return 0
      // The first permitted frame establishes continuity. Its interval may
      // belong to a prior interaction, hidden period or suspended preference.
      const elapsed = previousSample && Number.isFinite(delta) ? Math.max(0, delta) : 0
      previousSample = true
      const consumed = Math.min(remaining, elapsed)
      remaining = Math.max(0, remaining - consumed)
      if (remaining < 1e-9) remaining = 0
      return consumed
    },
  }
}
