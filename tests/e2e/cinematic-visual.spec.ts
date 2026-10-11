import {expect,test} from "@playwright/test"
import sharp from "sharp"
import { captureVisitedReviewPage } from "../../scripts/facility/review-page-capture.mjs"

test.skip(process.env.CINEMATIC_E2E !== "1", "Requires the selected cinematic release")

for (const size of [{width:1366,height:768},{width:390,height:844}]) {
  test(`cinematic composition and native poster/video correspondence at ${size.width}px`, async ({page},testInfo) => {
    await page.setViewportSize(size)
    await page.emulateMedia({reducedMotion:"reduce"})
    await page.goto("/")
    const player=page.getByTestId("cinematic-facility"),stage=player.locator(".cinematic-stage")
    // Visibility is evaluated before motion preference; visit the player whose
    // reduced-motion behavior is being inspected, including the stacked hero.
    await stage.scrollIntoViewIfNeeded()
    await expect(player).toHaveAttribute("data-reason","reduced-motion")
    await player.locator("img").evaluate(image=>(image as HTMLImageElement).decode())
    const posterCapture=await stage.screenshot({path:testInfo.outputPath("poster-stage.png")})
    await player.getByRole("button",{name:"Play facility animation"}).click()
    await expect(player).toHaveAttribute("data-state","playing",{timeout:20_000})
    await expect(player).toHaveAttribute("data-frame-evidence","presented-frame")
    await player.getByRole("button",{name:"Pause facility animation"}).click()
    const videoCapture=await stage.screenshot({path:testInfo.outputPath("video-stage.png")})
    const videoRatio=await player.locator("video").evaluate(element=>{
      const media=element as HTMLVideoElement
      return media.videoWidth/media.videoHeight
    })
    const samples=async (bytes:Buffer)=>{
      const {data,info}=await sharp(bytes).removeAlpha().raw().toBuffer({resolveWithObject:true})
      const width=Math.min(info.width,info.height*videoRatio),height=width/videoRatio
      const left=(info.width-width)/2,top=(info.height-height)/2
      const points=[[left+6,top+6],[left+width-7,top+6],[left+6,top+height-7],[left+width-7,top+height-7]]
      return points.map(([x,y])=>{
        const offset=(Math.floor(y)*info.width+Math.floor(x))*info.channels
        return [...data.subarray(offset,offset+3)]
      })
    }
    const color={poster:await samples(posterCapture),video:await samples(videoCapture)}
    const backdropDelta=Math.max(...color.poster.flatMap((sample,index)=>sample.map((channel,colorIndex)=>Math.abs(channel-color.video[index][colorIndex]))))
    expect(backdropDelta,"The native video backdrop must match its encoded-first-frame poster").toBeLessThanOrEqual(4)
    await testInfo.attach("native-poster-video-color",{body:Buffer.from(JSON.stringify({...color,backdropDelta},null,2)),contentType:"application/json"})
    await page.evaluate(()=>window.scrollTo(0,0))
    const bounds=await page.evaluate(()=>{
      const boundsFor=(selector:string)=>{
        const rect=document.querySelector(selector)!.getBoundingClientRect()
        return {x:rect.x,y:rect.y,width:rect.width,height:rect.height,bottom:rect.bottom,right:rect.right}
      }
      return {viewport:{width:innerWidth,height:innerHeight},hero:boundsFor(".gn-home-hero"),stage:boundsFor(".cinematic-stage"),decision:boundsFor(".gn-home-decision"),intro:boundsFor(".gn-home-intro"),video:boundsFor(".cinematic-video")}
    })
    if(size.width===1366) expect(bounds.decision.bottom).toBeLessThanOrEqual(size.height)
    expect(bounds.decision.right).toBeLessThanOrEqual(size.width)
    await testInfo.attach("composition-bounds",{body:Buffer.from(JSON.stringify(bounds,null,2)),contentType:"application/json"})
    if(size.width<640) {
      // Native lazy images and content-visibility sections should be visited
      // before a full-page review capture; an unseen placeholder is not artwork.
      for(const section of await page.locator(".gn-home > section, footer").all()) await section.scrollIntoViewIfNeeded()
      for(const image of await page.locator(".gn-home img").all()) {
        await image.scrollIntoViewIfNeeded()
        await image.evaluate(element=>(element as HTMLImageElement).decode())
      }
      await page.evaluate(()=>window.scrollTo(0,0))
    }
    if(size.width<640) {
      const painting = await captureVisitedReviewPage(page, testInfo.outputPath("homepage.png"), { scrollMethod: "programmatic" })
      await testInfo.attach("homepage-review-painting", { body: Buffer.from(JSON.stringify(painting, null, 2)), contentType: "application/json" })
    } else await page.screenshot({path:testInfo.outputPath("homepage.png"),fullPage:false})
  })
}

for (const width of [320, 390, 819, 960, 1366]) {
  test(`evidence media, qualifications and copy remain within ordered, non-overlapping cards at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: width === 1366 ? 768 : 844 })
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/")
    await page.evaluate(() => document.fonts.ready)
    const evidence = page.locator(".gn-home-evidence")
    await evidence.scrollIntoViewIfNeeded()
    for (const image of await evidence.locator("img").all()) {
      await image.scrollIntoViewIfNeeded()
      await image.evaluate(async element => {
        const image = element as HTMLImageElement
        await image.decode()
        if (!image.naturalWidth || !image.naturalHeight) throw new Error("Supporting image did not decode")
      })
    }
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
    const cards = await evidence.locator(".gn-home-evidence-card").evaluateAll(elements => {
      const bounds = (element: Element) => {
        const rect = element.getBoundingClientRect()
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height }
      }
      return elements.map(element => {
        const media = element.querySelector("[data-artwork-slot]")!
        const slot = media.getAttribute("data-artwork-slot")
        const art = media.querySelector(slot === "brief" ? ".gn-home-paper" : slot === "proof" ? "svg" : "img")!
        const qualification = media.querySelector(slot === "brief" ? "small" : "figcaption")!
        return {
          slot,
          card: bounds(element),
          media: bounds(media),
          art: bounds(art),
          qualification: bounds(qualification),
          qualificationText: qualification.textContent,
          briefFields: slot === "brief" ? [...art.querySelectorAll("div, p, strong, small")].map(field => ({ bounds: bounds(field), text: field.textContent })) : [],
          photo: slot === "platform" ? { src: (art as HTMLImageElement).currentSrc, width: (art as HTMLImageElement).naturalWidth, height: (art as HTMLImageElement).naturalHeight } : null,
          copy: bounds(element.querySelector(".gn-home-evidence-copy")!),
          label: bounds(element.querySelector(".gn-home-card-label")!),
          title: bounds(element.querySelector("h3")!),
          body: bounds(element.querySelector(".gn-home-evidence-copy > p:not(.gn-home-card-label)")!),
          link: bounds(element.querySelector(".gn-home-text-link")!),
        }
      })
    })
    expect(cards).toHaveLength(3)
    expect(cards.map(card => card.slot)).toEqual(["brief", "proof", "platform"])
    expect(cards[0].qualificationText).toBe("Synthetic example · No operational authority")
    expect(cards[0].briefFields.map(field => field.text).join(" ")).toContain("DEMO-01-B · v1.0.0")
    expect(cards[1].qualificationText?.replace(/\s+/g, " ")).toBe("Modeled result → review Gate operating permission")
    expect(cards[2].qualificationText).toBe("Illustrative facility · declared boundary")
    expect(cards[2].photo?.src).toMatch(/\/assets\/editorial\/editorial-v1\/platform-systems-\d+\.webp$/)
    expect(cards[2].photo?.width).toBeGreaterThan(0)
    expect(cards[2].photo?.height).toBeGreaterThan(0)
    const contained = (inner: typeof cards[number]["card"], outer: typeof cards[number]["card"], label: string) => {
      expect(inner.width, `${label}: positive width`).toBeGreaterThan(0)
      expect(inner.height, `${label}: positive height`).toBeGreaterThan(0)
      expect(inner.left, `${label}: left edge`).toBeGreaterThanOrEqual(outer.left - 1)
      expect(inner.right, `${label}: right edge`).toBeLessThanOrEqual(outer.right + 1)
      expect(inner.top, `${label}: top edge`).toBeGreaterThanOrEqual(outer.top - 1)
      expect(inner.bottom, `${label}: bottom edge`).toBeLessThanOrEqual(outer.bottom + 1)
    }
    cards.forEach((card, index) => {
      for (const part of ["media", "copy", "label", "title", "body", "link"] as const) contained(card[part], card.card, `Card ${index} ${part}`)
      contained(card.art, card.media, `Card ${index} artwork`)
      contained(card.qualification, card.media, `Card ${index} qualification`)
      if (card.slot === "brief") {
        for (const field of card.briefFields) contained(field.bounds, card.art, `Card ${index} document field`)
      } else {
        expect(card.art.bottom, `Card ${index} artwork before qualification`).toBeLessThanOrEqual(card.qualification.top + 1)
      }
      expect(card.label.bottom, `Card ${index} label before title`).toBeLessThanOrEqual(card.title.top + 1)
      expect(card.title.bottom, `Card ${index} title before body`).toBeLessThanOrEqual(card.body.top + 1)
      expect(card.body.bottom, `Card ${index} body before link`).toBeLessThanOrEqual(card.link.top + 1)
      if (width <= 819 || width >= 1120) {
        expect(card.media.bottom, `Card ${index} media before copy`).toBeLessThanOrEqual(card.label.top + 1)
      } else {
        expect(card.media.right, `Card ${index} tablet media beside copy`).toBeLessThanOrEqual(card.copy.left + 1)
      }
      for (const other of cards.slice(index + 1)) {
        const horizontalOverlap = Math.min(card.card.right, other.card.right) - Math.max(card.card.left, other.card.left)
        const verticalOverlap = Math.min(card.card.bottom, other.card.bottom) - Math.max(card.card.top, other.card.top)
        expect(horizontalOverlap > 1 && verticalOverlap > 1, `Card ${index} overlaps a later card`).toBe(false)
      }
    })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    await testInfo.attach("evidence-card-bounds", { body: Buffer.from(JSON.stringify({ width, cards }, null, 2)), contentType: "application/json" })
    await evidence.evaluate(element => element.scrollIntoView({ block: "start", behavior: "instant" }))
    await page.screenshot({ path: testInfo.outputPath("evidence-viewport.png"), fullPage: false })
  })
}
