type MediaQueryChangeListener = NonNullable<MediaQueryList["onchange"]>

type MutableMediaQueryList = MediaQueryList & {
  setMatches(matches: boolean): void
}

export type MatchMediaController = {
  matchMedia: (query: string) => MediaQueryList
  reset(): void
  setMatches(query: string, matches: boolean): void
}

export function createMatchMediaController(
  initialMatches: Record<string, boolean> = {}
): MatchMediaController {
  const initial = new Map(Object.entries(initialMatches))
  const queries = new Map<string, MutableMediaQueryList>()

  const getQuery = (query: string) => {
    const existing = queries.get(query)

    if (existing) {
      return existing
    }

    const listeners = new Set<MediaQueryChangeListener>()
    const legacyListeners = new Set<MediaQueryChangeListener>()
    let matches = initial.get(query) ?? false
    let onchange: MediaQueryChangeListener | null = null

    const mediaQueryList: MutableMediaQueryList = {
      get matches() {
        return matches
      },
      media: query,
      get onchange() {
        return onchange
      },
      set onchange(listener) {
        onchange = listener
      },
      addEventListener<K extends keyof MediaQueryListEventMap>(
        type: K,
        listener: (
          this: MediaQueryList,
          event: MediaQueryListEventMap[K]
        ) => unknown
      ) {
        if (type === "change" && typeof listener === "function") {
          listeners.add(listener as MediaQueryChangeListener)
        }
      },
      removeEventListener<K extends keyof MediaQueryListEventMap>(
        type: K,
        listener: (
          this: MediaQueryList,
          event: MediaQueryListEventMap[K]
        ) => unknown
      ) {
        if (type === "change" && typeof listener === "function") {
          listeners.delete(listener as MediaQueryChangeListener)
        }
      },
      addListener(listener) {
        if (listener) {
          legacyListeners.add(listener)
        }
      },
      removeListener(listener) {
        if (listener) {
          legacyListeners.delete(listener)
        }
      },
      dispatchEvent(event) {
        if (event.type !== "change") {
          return true
        }

        for (const listener of listeners) {
          listener.call(mediaQueryList, event as MediaQueryListEvent)
        }
        for (const listener of legacyListeners) {
          listener.call(mediaQueryList, event as MediaQueryListEvent)
        }
        onchange?.call(mediaQueryList, event as MediaQueryListEvent)
        return !event.defaultPrevented
      },
      setMatches(nextMatches) {
        if (matches === nextMatches) {
          return
        }

        matches = nextMatches
        const event = new Event("change") as MediaQueryListEvent
        Object.defineProperties(event, {
          matches: { value: matches },
          media: { value: query },
        })
        mediaQueryList.dispatchEvent(event)
      },
    }

    queries.set(query, mediaQueryList)
    return mediaQueryList
  }

  return {
    matchMedia: getQuery,
    reset() {
      queries.clear()
    },
    setMatches(query, matches) {
      getQuery(query).setMatches(matches)
    },
  }
}

export const testMatchMedia = createMatchMediaController()

export function installTestMatchMedia() {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: testMatchMedia.matchMedia,
  })
}
