import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

import { act, fireEvent, render, screen } from "@testing-library/react"
import { renderToString } from "react-dom/server"
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"

import {
  GridNinjaLogo,
  GridNinjaMark,
  type GridNinjaLogoVariant,
} from "@/components/brand/gridninja-logo"
import { testMatchMedia } from "../../support/match-media"

const expectedAssets: Record<
  Exclude<GridNinjaLogoVariant, "monochrome">,
  string
> = {
  "proof-core": "gridninja-favicon-proof-core.svg",
  micro: "gridninja-mark-micro.svg",
  detailed: "gridninja-emblem-detailed-dark.svg",
  ceremonial: "gridninja-emblem-ceremonial.svg",
  light: "gridninja-badge-light.svg",
  watermark: "gridninja-watermark.svg",
}

type IntersectionObserverHarness = {
  callback: IntersectionObserverCallback
  disconnect: ReturnType<typeof vi.fn>
  observed: Set<Element>
}

const intersectionObservers: IntersectionObserverHarness[] = []

beforeAll(() => {
  vi.stubGlobal(
    "IntersectionObserver",
    class IntersectionObserverStub {
      readonly callback: IntersectionObserverCallback
      readonly disconnect = vi.fn()
      readonly observed = new Set<Element>()

      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback
        intersectionObservers.push(this)
      }

      observe(element: Element) {
        this.observed.add(element)
      }

      unobserve() {}
      takeRecords() {
        return []
      }
    }
  )
})

beforeEach(() => {
  intersectionObservers.length = 0
})

afterAll(() => vi.unstubAllGlobals())

describe("GridNinjaLogo", () => {
  it.each(Object.entries(expectedAssets))(
    "maps the %s variant to its canonical asset",
    (variant, filename) => {
      const { container } = render(
        <GridNinjaLogo
          variant={variant as GridNinjaLogoVariant}
          showWordmark={false}
        />
      )

      expect(container.querySelector("img")).toHaveAttribute(
        "src",
        expect.stringContaining(filename)
      )
    }
  )

  it("renders the monochrome master as a currentColor CSS mask", () => {
    const { container } = render(
      <GridNinjaLogo
        variant="monochrome"
        markClassName="size-12 text-cyan-400"
        showWordmark={false}
      />
    )

    const mark = container.querySelector<HTMLElement>(
      '[data-gridninja-mark="monochrome"]'
    )

    expect(mark).toBeInTheDocument()
    expect(container.querySelector("img")).not.toBeInTheDocument()
    expect(mark).toHaveAttribute("aria-hidden", "true")
    expect(mark).toHaveClass("size-12", "text-cyan-400")
    expect(mark?.style.backgroundColor).toBe("currentcolor")
    expect(mark?.style.maskImage).toContain(
      "/brand/gridninja-emblem-monochrome.svg"
    )
    expect(mark?.style.webkitMaskImage).toBe(mark?.style.maskImage)
  })

  it("allows the mark-only monochrome renderer to inherit an explicit color", () => {
    const { container } = render(
      <div style={{ color: "rgb(34, 211, 238)" }}>
        <GridNinjaMark variant="monochrome" className="size-16" />
      </div>
    )

    const mark = container.querySelector<HTMLElement>(
      '[data-gridninja-mark="monochrome"]'
    )!

    expect(mark).toHaveClass("size-16")
    expect(getComputedStyle(mark).color).toBe("rgb(34, 211, 238)")
    expect(mark.style.backgroundColor).toBe("currentcolor")
    expect(mark).toHaveAttribute("aria-hidden", "true")
  })

  it("keeps non-monochrome mark-only variants on Next Image", () => {
    const { container } = render(
      <GridNinjaMark variant="light" className="size-12" loading="lazy" />
    )

    const mark = container.querySelector("img")

    expect(mark).toHaveAttribute(
      "src",
      expect.stringContaining("gridninja-badge-light.svg")
    )
    expect(mark).toHaveAttribute("alt", "")
    expect(mark).toHaveAttribute("loading", "lazy")
  })

  it("uses visible live text as the accessible name by default", () => {
    const { container } = render(<GridNinjaLogo showSignature />)

    expect(screen.getByText("GridNinja")).toBeVisible()
    expect(
      screen.getByText("Infrastructure · Intelligence · Control")
    ).toBeVisible()
    expect(container.querySelector("img")).toHaveAttribute("alt", "")
  })

  it("uses one explicit accessible label without repeating visible text", () => {
    render(<GridNinjaLogo label="GridNinja brand" showSignature />)

    const logo = screen.getByRole("img", { name: "GridNinja brand" })
    expect(logo).toBeVisible()
    expect(logo.lastElementChild).toHaveAttribute("aria-hidden", "true")
  })

  it("hides mark-only artwork from assistive technology", () => {
    const { container } = render(
      <GridNinjaLogo variant="watermark" showWordmark={false} />
    )

    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true")
  })

  it("uses an inline, part-addressable copy only for micro interaction motion", () => {
    const matchMediaSpy = vi.spyOn(window, "matchMedia")
    const { container } = render(
      <GridNinjaLogo
        variant="micro"
        motion="micro-response"
        showWordmark={false}
      />
    )

    const logo = container.querySelector(
      '[data-logo-motion="micro-response"]'
    )
    const svg = logo?.querySelector("svg")

    expect(logo).toBeInTheDocument()
    expect(svg).toHaveAttribute("viewBox", "0 0 256 256")
    expect(svg?.querySelectorAll("[data-part]").length).toBeGreaterThan(2)
    expect(logo?.querySelector("img")).not.toBeInTheDocument()
    expect(matchMediaSpy).not.toHaveBeenCalled()
    expect(intersectionObservers).toHaveLength(0)
    matchMediaSpy.mockRestore()
  })

  it("exposes one-time guardian reveal semantics on the ceremonial inline copy", () => {
    const { container } = render(
      <GridNinjaLogo
        variant="ceremonial"
        motion="guardian-wake"
        reveal="once"
        showWordmark={false}
      />
    )

    const logo = container.querySelector(
      '[data-logo-motion="guardian-wake"]'
    )
    const svg = logo?.querySelector("svg")

    expect(logo).toHaveAttribute("data-logo-reveal", "once")
    expect(logo).toHaveAttribute("data-logo-revealed", "false")
    expect(logo).toHaveAttribute("data-logo-reveal-stage", "armed")
    expect(svg).toHaveAttribute("viewBox", "0 0 640 560")
    expect(svg?.querySelectorAll("[data-part]").length).toBeGreaterThan(2)
    expect(logo?.querySelector("img")).not.toBeInTheDocument()
  })

  it("server-renders the one-time guardian artwork visibly", () => {
    const markup = renderToString(
      <GridNinjaLogo
        variant="ceremonial"
        motion="guardian-wake"
        reveal="once"
        showWordmark={false}
      />
    )

    expect(markup).toContain('data-logo-revealed="true"')
    expect(markup).toContain('data-logo-reveal-stage="settled"')
  })

  it("skips reveal arming when hydration finds the guardian in view", () => {
    const boundsSpy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue({
        bottom: 200,
        height: 160,
        left: 10,
        right: 190,
        top: 40,
        width: 180,
        x: 10,
        y: 40,
        toJSON: () => ({}),
      })

    const { container } = render(
      <GridNinjaLogo
        variant="ceremonial"
        motion="guardian-wake"
        reveal="once"
        showWordmark={false}
      />
    )
    const logo = container.querySelector(
      '[data-logo-motion="guardian-wake"]'
    )

    expect(logo).toHaveAttribute("data-logo-revealed", "true")
    expect(logo).toHaveAttribute("data-logo-reveal-stage", "settled")
    expect(intersectionObservers).toHaveLength(0)
    boundsSpy.mockRestore()
  })

  it("reveals an armed offscreen guardian once after intersection", () => {
    const { container } = render(
      <GridNinjaLogo
        variant="ceremonial"
        motion="guardian-wake"
        reveal="once"
        showWordmark={false}
      />
    )
    const logo = container.querySelector(
      '[data-logo-motion="guardian-wake"]'
    )
    const observer = intersectionObservers.at(-1)

    expect(observer?.observed.has(logo!)).toBe(true)
    act(() => {
      observer?.callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        observer as unknown as IntersectionObserver
      )
    })
    expect(logo).toHaveAttribute("data-logo-revealed", "true")
    expect(logo).toHaveAttribute("data-logo-reveal-stage", "revealed")
    expect(observer?.disconnect).toHaveBeenCalledOnce()
  })

  it("settles the guardian and clears tilt when reduced motion turns on", () => {
    testMatchMedia.setMatches("(pointer: fine)", true)
    const { container } = render(
      <GridNinjaLogo
        variant="ceremonial"
        motion="guardian-wake"
        reveal="once"
        showWordmark={false}
      />
    )
    const logo = container.querySelector(
      '[data-logo-motion="guardian-wake"]'
    ) as HTMLElement
    vi.spyOn(logo, "getBoundingClientRect").mockReturnValue({
      bottom: 100,
      height: 100,
      left: 0,
      right: 100,
      top: 0,
      width: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })

    fireEvent.pointerMove(logo, { clientX: 99, clientY: 1 })
    expect(logo.style.getPropertyValue("--gridninja-tilt-x")).not.toBe("0deg")
    expect(logo.style.getPropertyValue("--gridninja-tilt-y")).not.toBe("0deg")

    act(() => {
      testMatchMedia.setMatches("(prefers-reduced-motion: reduce)", true)
    })

    expect(logo.style.getPropertyValue("--gridninja-tilt-x")).toBe("0deg")
    expect(logo.style.getPropertyValue("--gridninja-tilt-y")).toBe("0deg")
    expect(logo).toHaveAttribute("data-logo-reveal-stage", "settled")
    expect(logo).toHaveAttribute("data-logo-revealed", "true")
  })

  it("remains usable when matchMedia and IntersectionObserver are unavailable", () => {
    const matchMedia = window.matchMedia
    const intersectionObserver = globalThis.IntersectionObserver
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: undefined,
    })
    vi.stubGlobal("IntersectionObserver", undefined)

    try {
      const { container } = render(
        <GridNinjaLogo
          variant="ceremonial"
          motion="guardian-wake"
          reveal="once"
          showWordmark={false}
        />
      )
      const logo = container.querySelector(
        '[data-logo-motion="guardian-wake"]'
      )

      expect(logo).toHaveAttribute("data-logo-revealed", "true")
      expect(logo).toHaveAttribute("data-logo-reveal-stage", "settled")
    } finally {
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        writable: true,
        value: matchMedia,
      })
      vi.stubGlobal("IntersectionObserver", intersectionObserver)
    }
  })

  it("keeps ordinary static placements on canonical external masters", () => {
    const { container } = render(
      <GridNinjaLogo variant="micro" showWordmark={false} />
    )

    expect(container.querySelector("[data-logo-motion]")).not.toBeInTheDocument()
    expect(container.querySelector("svg")).not.toBeInTheDocument()
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      expect.stringContaining("gridninja-mark-micro.svg")
    )
  })

  it("namespaces inline SVG definitions across logo instances", () => {
    const { container } = render(
      <>
        <GridNinjaLogo
          variant="micro"
          motion="micro-response"
          showWordmark={false}
        />
        <GridNinjaLogo
          variant="ceremonial"
          motion="guardian-wake"
          showWordmark={false}
        />
      </>
    )

    const ids = Array.from(container.querySelectorAll("svg [id]"), (element) =>
      element.getAttribute("id")
    ).filter((id): id is string => Boolean(id))

    expect(ids.length).toBeGreaterThan(0)
    expect(new Set(ids).size).toBe(ids.length)

    for (const reference of container.querySelectorAll("svg use")) {
      const href = reference.getAttribute("href")
      expect(href).toMatch(/^#.+/)
      expect(container.querySelector(href!)).toBeInTheDocument()
    }
  })

  it.each([
    ["micro", "gridninja-mark-micro.svg"],
    ["ceremonial", "gridninja-emblem-ceremonial.svg"],
  ] as const)(
    "keeps the animated %s geometry and palette aligned to its canonical master",
    async (variant, filename) => {
      const canonical = parseSvg(
        await readFile(
          resolve(process.cwd(), "public", "brand", filename),
          "utf8"
        )
      )
      const { container } = render(
        variant === "micro" ? (
          <GridNinjaLogo
            variant="micro"
            motion="micro-response"
            showWordmark={false}
          />
        ) : (
          <GridNinjaLogo
            variant="ceremonial"
            motion="guardian-wake"
            showWordmark={false}
          />
        )
      )
      const animated = container.querySelector("svg")!

      expect(readPathGeometry(animated, true)).toEqual(
        readPathGeometry(canonical, false)
      )
      expect(readCircleGeometry(animated, true)).toEqual(
        readCircleGeometry(canonical, false)
      )
      expect(readGradientDefinitions(animated)).toEqual(
        readGradientDefinitions(canonical)
      )
      expect(readTransforms(animated)).toEqual(readTransforms(canonical))
      expect(readLiteralPalette(animated)).toEqual(
        readLiteralPalette(canonical)
      )
      expect(readStrokeWidths(animated, true)).toEqual(
        readStrokeWidths(canonical, false)
      )
      expect(animated.querySelectorAll('[data-part="proof-glow"]')).toHaveLength(
        1
      )
      expect(
        animated.querySelectorAll('[data-part="proof-sweep"]')
      ).toHaveLength(1)
    }
  )
})

function parseSvg(source: string) {
  return new DOMParser().parseFromString(source, "image/svg+xml").documentElement
}

function readPathGeometry(svg: Element, excludeMotionOverlays: boolean) {
  return Array.from(svg.querySelectorAll("path"))
    .filter(
      (path) =>
        !excludeMotionOverlays ||
        !path.matches('[data-part="proof-glow"], [data-part="proof-sweep"]')
    )
    .map((path) => path.getAttribute("d"))
}

function readCircleGeometry(svg: Element, excludeMotionOverlays: boolean) {
  return Array.from(svg.querySelectorAll("circle"))
    .filter(
      (circle) =>
        !excludeMotionOverlays ||
        !circle.matches('[data-part="proof-sweep"]')
    )
    .map((circle) => [
      circle.getAttribute("cx"),
      circle.getAttribute("cy"),
      circle.getAttribute("r"),
    ])
}

function readGradientDefinitions(svg: Element) {
  return Array.from(svg.querySelectorAll("linearGradient")).map((gradient) => ({
    vector: ["x1", "y1", "x2", "y2"].map((attribute) =>
      gradient.getAttribute(attribute)
    ),
    stops: Array.from(gradient.querySelectorAll("stop")).map((stop) => [
      stop.getAttribute("offset"),
      stop.getAttribute("stop-color"),
    ]),
  }))
}

function readTransforms(svg: Element) {
  return Array.from(svg.querySelectorAll("[transform]"), (element) =>
    element.getAttribute("transform")
  )
}

function readLiteralPalette(svg: Element) {
  const colors = new Set<string>()

  for (const element of svg.querySelectorAll("[fill], [stroke], [stop-color]")) {
    for (const attribute of ["fill", "stroke", "stop-color"]) {
      const value = element.getAttribute(attribute)
      if (value && value !== "none" && !value.startsWith("url(")) {
        colors.add(value.toUpperCase())
      }
    }
  }

  return Array.from(colors).sort()
}

function readStrokeWidths(svg: Element, excludeMotionOverlays: boolean) {
  return Array.from(svg.querySelectorAll("[stroke-width]"))
    .filter(
      (element) =>
        !excludeMotionOverlays ||
        !element.matches('[data-part="proof-sweep"]')
    )
    .map((element) => element.getAttribute("stroke-width"))
}
