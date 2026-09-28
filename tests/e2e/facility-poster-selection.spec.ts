import { expect, test } from "@playwright/test"
import { FACILITY_POSTER_PLACEHOLDER } from "../../src/components/facility/use-poster-acquisition"
import { createPosterDecoder } from "../../src/lib/facility/poster-decode"

const origin = "https://facility-poster.invalid"
const desktop = `${origin}/poster-desktop.webp`, mobile = `${origin}/poster-mobile.webp`
const image = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="#080808"/></svg>'

test("native picture selection defers both real posters offscreen on mobile, then manual acquisition decodes only mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const requested: string[] = []
  await page.route(`${origin}/**`, async route => { requested.push(route.request().url()); await route.fulfill({ contentType: "image/svg+xml", body: image }) })
  await page.setContent(`<meta name="viewport" content="width=device-width, initial-scale=1"><button id="activate">Explore in 3D</button><output data-state="pending" data-ready="false"></output><div style="height:2000px"></div><picture><source media="(max-width: 639px)" srcset="${FACILITY_POSTER_PLACEHOLDER}"><img src="${desktop}" width="340" height="255" alt="Facility" loading="eager" fetchpriority="high"></picture>`)
  const poster = page.locator("img")
  await poster.evaluate(element => (element as HTMLImageElement).decode())
  expect(await poster.evaluate(element => (element as HTMLImageElement).currentSrc)).toBe(FACILITY_POSTER_PLACEHOLDER)
  expect(await poster.evaluate(element => element.getBoundingClientRect().top)).toBeGreaterThan(1044)
  expect(requested).toEqual([])

  // Exercise the production decoder against the browser's native picture state.
  // This fixture deliberately has no graphics, timers, server or GPU workload.
  await page.addScriptTag({ content: `
    const createDecoder = (${createPosterDecoder.toString()});
    const poster = document.querySelector('img'), output = document.querySelector('output');
    const decoder = createDecoder(() => poster, () => '${mobile}', state => {
      output.dataset.state = state;
      if (state === 'decoded') requestAnimationFrame(() => requestAnimationFrame(() => { output.dataset.ready = String(decoder.isDecoded()); }));
    });
    poster.addEventListener('load', () => decoder.decode());
    decoder.decode();
    document.querySelector('#activate').addEventListener('click', () => {
      document.querySelector('source').srcset = '${mobile}';
      queueMicrotask(() => decoder.decode());
    });
  ` })
  await expect(page.locator("output")).toHaveAttribute("data-state", "pending")
  await expect(page.locator("output")).toHaveAttribute("data-ready", "false")
  await page.getByRole("button", { name: "Explore in 3D" }).click()
  await expect(page.locator("output")).toHaveAttribute("data-ready", "true")
  expect(await poster.evaluate(element => (element as HTMLImageElement).currentSrc)).toBe(mobile)
  expect(requested).toEqual([mobile])
})

test("the 640px desktop breakpoint still discovers the real desktop poster immediately", async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 844 })
  const requested: string[] = []
  await page.route(`${origin}/**`, async route => { requested.push(route.request().url()); await route.fulfill({ contentType: "image/svg+xml", body: image }) })
  await page.setContent(`<meta name="viewport" content="width=device-width, initial-scale=1"><picture><source media="(max-width: 639px)" srcset="${FACILITY_POSTER_PLACEHOLDER}"><img src="${desktop}" width="340" height="255" alt="Facility" loading="eager" fetchpriority="high"></picture>`)
  const poster = page.locator("img")
  await poster.evaluate(element => (element as HTMLImageElement).decode())
  expect(await poster.evaluate(element => (element as HTMLImageElement).currentSrc)).toBe(desktop)
  expect(requested).toEqual([desktop])
  await page.setViewportSize({ width: 639, height: 844 })
  await expect.poll(() => poster.evaluate(element => (element as HTMLImageElement).currentSrc)).toBe(FACILITY_POSTER_PLACEHOLDER)
  expect(requested).toEqual([desktop])
})
