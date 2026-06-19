export function getUrlParam(key: string) {
  if (typeof window === "undefined") {
    return null
  }

  return new URLSearchParams(window.location.search).get(key)
}

export function setUrlParam(
  key: string,
  value: string | undefined,
  options?: { hash?: string; mode?: "push" | "replace" }
) {
  if (typeof window === "undefined") {
    return
  }

  const url = new URL(window.location.href)
  if (value) {
    url.searchParams.set(key, value)
  } else {
    url.searchParams.delete(key)
  }

  if (options?.hash !== undefined) {
    url.hash = options.hash
  }

  const next = `${url.pathname}${url.search}${url.hash}`
  if (next === `${window.location.pathname}${window.location.search}${window.location.hash}`) {
    return
  }

  if (options?.mode === "replace") {
    window.history.replaceState(null, "", next)
    return
  }

  window.history.pushState(null, "", next)
}

export function getWhyGridNinjaContextParams() {
  if (typeof window === "undefined") {
    return {}
  }

  const params = new URLSearchParams(window.location.search)
  const context: Record<string, string> = {}
  const keys = [
    "proof",
    "persona",
    "scenario",
    "source",
    "comparator",
    "maturity",
  ]

  keys.forEach((key) => {
    const value = params.get(key)
    if (value) {
      context[key] = value
    }
  })

  return context
}

export function notifyWhyGridNinjaContextChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("why-gridninja-context"))
  }
}
