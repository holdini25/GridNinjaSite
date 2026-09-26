import { chooseAssembly, choosePose } from "./inspection-actions.mjs"
import assert from "node:assert/strict"
import { mkdir, writeFile, readFile, open, rm } from "node:fs/promises"
import { join } from "node:path"
import { chromium } from "@playwright/test"
import sharp from "sharp"
import { hash, manifestSchema, releasePattern } from "./validate-release.mjs"

const args = process.argv.slice(2)
assert(args.length === 2 && args[0] === "--release" && releasePattern.test(args[1]), "Usage: capture-posters.mjs --release facility-vN")
const release = args[1]
const baseURL = process.env.FACILITY_BASE_URL ?? "http://localhost:3001"
const headed = process.env.FACILITY_HEADED === "1"
const angle = process.env.FACILITY_ANGLE
assert(!angle || angle === "metal", "FACILITY_ANGLE supports only metal")
const graphicsInfo = async canvas => {
  const graphics = await canvas.evaluate(element => {
    const gl = element.getContext("webgl2")
    const debug = gl?.getExtension("WEBGL_debug_renderer_info")
    return {
      renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : "unavailable",
      vendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : "unavailable",
      antialias: gl?.getContextAttributes()?.antialias ?? false,
    }
  })
  if (angle === "metal") assert(/Apple M5.*Metal|Metal.*Apple M5/i.test(graphics.renderer) && !/SwiftShader|llvmpipe|software/i.test(graphics.renderer), `Native M5 Metal requested but actual renderer is ${graphics.renderer}`)
  return graphics
}
const activateViewer = async (page, inspector) => {
  const pathname = new URL(page.url()).pathname
  await inspector.locator(".facility-stage").evaluate(node=>node.scrollIntoView({block:"center"}))
  // The server shell exposes a native activation link before the interactive
  // island replaces it with buttons. Use that public intent before readiness.
  await inspector.locator("a[data-facility-activate], button.facility-action--activate").evaluateAll(controls=>controls[0]?.click())
  await inspector.locator(".facility-systems button").first().waitFor()
  await inspector.getByRole("button",{name:"Explore in 3D"}).evaluateAll(buttons=>buttons[0]?.click())
  await inspector.locator("canvas[data-ready=true]").waitFor()
  assert.equal(new URL(page.url()).pathname,pathname,"Capture activation navigated away from its intended page")
}
const output = join("build/facility", release)
await mkdir(output, {recursive:true})
const leasePath = "assets-source/facility/generation.lock"
const lease = await open(leasePath, "wx").catch(error => { throw new Error(`Facility writer lease unavailable: ${error.code}; finish the active Blender/package/capture operation first.`) })
let browser
try {
  await lease.writeFile(JSON.stringify({pid:process.pid,operation:"capture",release})+"\n")
  const manifest = manifestSchema.parse(JSON.parse(await readFile(join(output,"release/manifest.json"),"utf8")))
  assert.equal(manifest.release,release)
  const background=manifest.profile.background
  browser = await chromium.launch({channel:"chrome",headless:!headed,...(angle ? {args:[`--use-angle=${angle}`,"--use-gl=angle"],ignoreDefaultArgs:["--use-angle=swiftshader","--disable-gpu"]} : {})})
  const page = await browser.newPage({viewport:{width:1600,height:1100},deviceScaleFactor:1})
  await page.addInitScript(() => { window.__GN_FACILITY_DIAGNOSTICS__ = true })
  await page.emulateMedia({reducedMotion:"reduce"})
  await page.goto(baseURL)
  const inspector = page.getByTestId("facility-inspection")
  assert.equal(await inspector.getAttribute("data-release"),release,"Preview served a different facility release")
  await activateViewer(page, inspector)
  await page.addStyleTag({content:`
    .facility-inspection {position:fixed!important;left:0!important;top:0!important;width:1362px!important;z-index:99999!important}
    .facility-heading,.facility-toolbar,.facility-stage-caption,.facility-systems,.facility-assessment-caption,.facility-explanation,.facility-scope {display:none!important}
    .facility-stage{width:1360px!important;height:800px!important;aspect-ratio:1.7!important}
  `})
  const canvas = inspector.locator("canvas")
  const graphics = await graphicsInfo(canvas)
  await page.waitForTimeout(300)
  const tiles = []
  let neutralPixels
  const selectionPixels = {}
  for (const system of ["neutral","power","cooling","storage","workloads"]) {
    if(system!=="neutral") await inspector.locator(".facility-systems").getByRole("button",{name:new RegExp(system,"i"),includeHidden:true}).evaluate(element=>element.click())
    await page.waitForTimeout(100)
    const png = await canvas.screenshot({path:`${output}/state-${system}.png`})
    const pixels = await sharp(png).removeAlpha().raw().toBuffer()
    if(system==="neutral") {
      neutralPixels = pixels
      for(const [name,width] of (manifest.profile.inspection ? [["desktop",1360]] : [["desktop",1360],["mobile",680]])) {
        await sharp(png).resize(width).webp({quality:82}).toFile(`${output}/poster-${name}.webp`)
      }
    } else {
      let changed = 0
      for (let index = 0; index < pixels.length; index += 3) {
        if (Math.max(Math.abs(pixels[index] - neutralPixels[index]), Math.abs(pixels[index + 1] - neutralPixels[index + 1]), Math.abs(pixels[index + 2] - neutralPixels[index + 2])) >= 8) changed++
      }
      // Captures are still and share a camera. Catch valid-but-occluded accent
      // geometry: a semantic binding alone does not establish a visible selection.
      assert(changed >= 100, `${system} highlight is visually absent (${changed} changed pixels)`)
      selectionPixels[system] = changed
    }
    const tile=await sharp(png).resize(680,400).extend({top:36,bottom:0,left:0,right:0,background}).composite([{input:Buffer.from(`<svg width="680" height="36"><text x="20" y="25" fill="#eeeeee" font-family="sans-serif" font-size="18">${system.toUpperCase()}</text></svg>`),left:0,top:0}]).png().toBuffer()
    tiles.push({input:tile,left:system==="neutral"?340:((tiles.length-1)%2)*680,top:system==="neutral"?0:436+Math.floor((tiles.length-1)/2)*436})
  }
  await sharp({create:{width:1360,height:1308,channels:3,background}}).composite(tiles).png().toFile(`${output}/contact-sheet.png`)
  const metadata=await canvas.evaluate(element=>({...element.__gnFacilitySnapshot(),width:element.width,height:element.height}))
  assert(metadata.drawCalls <= (manifest.profile.inspection ? 39 : 40), `Still-render draw budget exceeded: ${metadata.drawCalls}`)
  assert(metadata.materials <= 10, `Material budget exceeded: ${metadata.materials}`)
  assert(metadata.estimatedBytes <= 32 * 1024 * 1024, `Asset/environment allocation exceeded: ${metadata.estimatedBytes}`)
  let mobileMetadata
  if (manifest.profile.inspection) {
    // Capture the authored portrait composition at an actual mobile CSS width,
    // rather than resampling the desktop orthographic frame.
    const mobileContext = await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,reducedMotion:"reduce"})
    try {
      const mobilePage = await mobileContext.newPage()
      await mobilePage.addInitScript(() => { window.__GN_FACILITY_DIAGNOSTICS__ = true })
      await mobilePage.goto(baseURL)
      const mobileInspector = mobilePage.getByTestId("facility-inspection")
      await activateViewer(mobilePage, mobileInspector)
      await mobilePage.addStyleTag({content:'.facility-inspection{position:fixed!important;left:0!important;top:0!important;width:342px!important;z-index:99999!important}.facility-inspection>:not(.facility-stage),.facility-stage-caption,.facility-rack-handles,.facility-rack-leaders{display:none!important}.facility-stage{width:340px!important;height:255px!important;aspect-ratio:4/3!important}'})
      const mobileCanvas = mobileInspector.locator("canvas")
      await mobilePage.waitForFunction(() => {
        const canvas = document.querySelector("canvas[data-ready=true]")
        const rect = canvas?.getBoundingClientRect()
        return rect?.width === 340 && rect?.height === 255 && canvas.width > 0 && canvas.height > 0
      })
      await mobilePage.evaluate(() => new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
      const clip = await mobileCanvas.boundingBox()
      assert(clip && clip.width === 340 && clip.height === 255,"Mobile camera bounds did not settle")
      // Native headed Chrome's locator screenshots can round this 255px-high
      // mobile element to 256px. Exact viewport clipping preserves camera pixels.
      const png = await mobilePage.screenshot({clip,path:`${output}/state-mobile-neutral.png`})
      const image = await sharp(png).metadata()
      assert.deepEqual([image.width,image.height],[680,510],"Mobile capture pixel dimensions differ from the approved 4:3 composition")
      await sharp(png).webp({quality:82}).toFile(`${output}/poster-mobile.webp`)
      mobileMetadata = {...await mobileCanvas.evaluate(element=>({...element.__gnFacilitySnapshot(),cssWidth:element.clientWidth,cssHeight:element.clientHeight})),graphics:await graphicsInfo(mobileCanvas),captureClip:clip,encodedSize:[image.width,image.height]}
      assert.deepEqual([mobileMetadata.cssWidth,mobileMetadata.cssHeight],[340,255])
    } finally { await mobileContext.close() }
  }
  const specimens = {}
  if (manifest.specimens) {
    await page.goto(baseURL + "/demo")
    await activateViewer(page, inspector)
    await page.addStyleTag({content:`.facility-inspection {position:fixed!important;left:0!important;top:0!important;width:1362px!important;z-index:99999!important}.facility-inspection > :not(.facility-stage){display:none!important}.facility-stage-caption,.facility-rack-handles,.facility-rack-leaders{display:none!important}.facility-stage{width:1360px!important;height:800px!important;aspect-ratio:1.7!important}`})
    const specimenTiles = []
    for (const [kind, descriptor] of Object.entries(manifest.specimens)) {
      await chooseAssembly(inspector, kind)
      await page.waitForFunction(kind=>document.querySelector('[data-testid="facility-inspection"]')?.getAttribute("data-view")===kind,kind,{timeout:10000})
      const poses = {}
      for(const pose of ["closed","cutaway","service"]) {
        if(pose !== "closed") await choosePose(inspector, kind, pose)
        await page.waitForFunction(pose=>document.querySelector('[data-testid="facility-inspection"]')?.getAttribute("data-pose")===pose,pose,{timeout:10000})
        await page.waitForTimeout(350)
        const png=await canvas.screenshot({path:`${output}/${kind}-${pose}.png`})
        if(pose !== "service") {
          let quality=82,webp
          do {webp=await sharp(png).webp({quality}).toBuffer();quality-=5} while(webp.length>60*1024 && quality>=47)
          assert(webp.length<=60*1024,`${kind} ${pose} poster exceeds 60 KiB`)
          await writeFile(`${output}/${kind}-${pose}.webp`,webp)
        }
        poses[pose]=await canvas.evaluate(element=>element.__gnFacilitySnapshot())
        assert(poses[pose].drawCalls <= (kind === "rack" ? 35 : 30),`${kind} draw-call ceiling`)
        assert(poses[pose].triangles <= (kind === "rack" ? 24000 : 18000),`${kind} triangle ceiling`)
        const tile=await sharp(png).resize(680,400).extend({top:36,bottom:0,left:0,right:0,background}).composite([{input:Buffer.from(`<svg width="680" height="36"><text x="20" y="25" fill="#eeeeee" font-family="sans-serif" font-size="18">${kind.toUpperCase()} · ${pose.toUpperCase()}</text></svg>`),left:0,top:0}]).png().toBuffer()
        const index=specimenTiles.length
        specimenTiles.push({input:tile,left:(index%2)*680,top:Math.floor(index/2)*436})
      }
      specimens[kind]={modelSha256:manifest.files.find(file=>file.file===`${kind}.glb`).sha256,profileSha256:hash(Buffer.from(JSON.stringify(descriptor.profile))),graphics:await graphicsInfo(canvas),poses}
    }
    await sharp({create:{width:1360,height:1308,channels:3,background}}).composite(specimenTiles).png().toFile(`${output}/specimen-contact-sheet.png`)
  }
  const posters=Object.fromEntries(await Promise.all(manifest.files.filter(file=>file.file.endsWith(".webp")).map(async ({file})=>[file,hash(await readFile(join(output,file)))])))
  await writeFile(`${output}/capture-profile.json`,JSON.stringify({release,baseURL,browser:browser.version(),launch:{channel:"chrome",headed,angle:angle??"default"},graphics,viewport:[1360,800],mobileViewport:manifest.profile.inspection?[340,255]:undefined,reducedMotion:true,modelSha256:manifest.files.find(file=>file.file==="facility.glb").sha256,profileSha256:hash(Buffer.from(JSON.stringify(manifest.profile))),posters,metadata,mobileMetadata,selectionPixels,specimens},null,2)+"\n")
  console.log("Captured overview selection states and all assembly poses from the actual browser renderer.")
} finally {
  try { await browser?.close() } finally {
    try { await lease.close() } finally { await rm(leasePath,{force:true}) }
  }
}
