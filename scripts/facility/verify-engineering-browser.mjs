import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { chromium, expect } from "@playwright/test"
import { assertFrameBudget, assertCadenceBudget, assertRendererBudget, provenance, verifiedBuildIdentity } from "./performance-contract.mjs"
import { chooseAssembly, choosePose, chooseStillImage } from "./inspection-actions.mjs"

const baseURL=process.env.FACILITY_BASE_URL ?? "http://localhost:3000"
const headed=process.env.FACILITY_HEADED === "1", metal=process.env.FACILITY_ANGLE === "metal"
const output=`build/facility/${(await verifiedBuildIdentity()).buildSettings.selectedRelease}`
await mkdir(output,{recursive:true})
const browser=await chromium.launch({channel:"chrome",headless:!headed,...(metal?{args:["--use-angle=metal","--use-gl=angle"],ignoreDefaultArgs:["--use-angle=swiftshader","--disable-gpu"]}:{})})
const context=await browser.newContext({viewport:{width:1440,height:1100},deviceScaleFactor:metal?2:1,recordVideo:{dir:`${output}/motion`,size:{width:1440,height:1100}}})
const page=await context.newPage()
await page.addInitScript(()=>{window.__GN_FACILITY_DIAGNOSTICS__=true})
const report={measuredAt:new Date().toISOString(),provenance:await provenance(browser.version(),{baseURL,headed,metal,closeCycles:10,assetCycles:10}),result:"incomplete",errors:[],budgetFailures:[],cycles:[],assetCycles:[]}
// Complete independent lifecycle checks even if the timing gate fails on this run.
// Timing failures remain release failures and are never discarded.
const checkTiming=check=>{try{check()}catch(error){report.budgetFailures.push(error instanceof Error?error.message:String(error))}}
page.on("pageerror",error=>report.errors.push(error.message))
const viewer=page.getByTestId("facility-inspection"),canvas=viewer.locator("canvas")
const stats=(equipment=false)=>canvas.evaluate((el,include)=>el.__gnFacilitySnapshot(include),equipment)
const ready=()=>viewer.locator("canvas[data-ready=true]").waitFor({timeout:15000})
const revealEnhancedStage=async()=>{
  // Visibility starts deferred enhancement. Reveal atomically, then wait for
  // its controls before Playwright scrolls the persistent replacement stage.
  await viewer.locator(".facility-stage").evaluate(element=>element.scrollIntoView({block:"center",behavior:"instant"}))
  const systems=viewer.locator(".facility-systems button")
  await expect(systems).toHaveCount(4)
  await expect(systems.first()).toBeVisible()
  await viewer.locator(".facility-stage").scrollIntoViewIfNeeded()
}
const show=async(kind,pose="closed")=>{
  if(kind==="overview") await viewer.getByRole("button",{name:"Return to facility",exact:true}).click()
  else if(await viewer.getAttribute("data-view")!==kind) await chooseAssembly(viewer,kind)
  await page.waitForFunction(kind=>document.querySelector('[data-testid="facility-inspection"]')?.dataset.view===kind,kind,{timeout:12000})
  if(kind!=="overview"&&pose!=="closed"){
    await choosePose(viewer,kind,pose)
    await viewer.locator(".facility-stage").scrollIntoViewIfNeeded()
    await page.waitForFunction(pose=>document.querySelector('[data-testid="facility-inspection"]')?.dataset.pose===pose,pose,{timeout:12000})
  }
  await viewer.locator(".facility-stage").scrollIntoViewIfNeeded()
}
try{
  await page.goto(baseURL,{waitUntil:"load"})
  await revealEnhancedStage();await ready()
  report.graphics=await canvas.evaluate(el=>{const gl=el.getContext("webgl2"),ext=gl.getExtension("WEBGL_debug_renderer_info");return {renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):"unavailable",devicePixelRatio:devicePixelRatio}})
  const hardware=!/SwiftShader|llvmpipe|software|unavailable/i.test(report.graphics.renderer)
  if(metal)assert(/Apple M5.*Metal|Metal.*Apple M5/i.test(report.graphics.renderer),"Requested native M5 Metal unavailable")
  await page.mouse.move(0,0)
  report.ambientMethod=hardware?"natural-steady-cadence":"software-functional-fixed-cadence"
  if(hardware){
    await page.waitForFunction(()=>{const s=document.querySelector("canvas")?.__gnFacilitySnapshot?.();return s?.targetFps===30&&!s.qualityProbe&&s.transitionRemaining===0&&s.clockSeconds>s.interactionUntil},null,{timeout:15000})
    await canvas.evaluate(el=>el.__gnFacilityCapability(null))
  }else await canvas.evaluate(el=>el.__gnFacilityCapability(30))
  await page.waitForFunction(()=>document.querySelector("canvas")?.__gnFacilitySnapshot?.().sampleCount>=120,null,{timeout:15000})
  report.ambient=await stats();assertRendererBudget(report.ambient);assert.equal(report.ambient.targetFps,30)
  if(hardware)checkTiming(()=>assertCadenceBudget(report.ambient))
  const before=(await stats(true)).equipment
  const lightSamples=[]
  let after=before
  // Two arbitrary stills can legitimately both land between irregular pulses.
  // Sample across many authored event windows instead of requiring every pair to differ.
  for(let sample=0;sample<24;sample++){
    await page.waitForTimeout(80)
    after=(await stats(true)).equipment
    lightSamples.push(after.ledColors)
  }
  assert(after.fans.every((fan,index)=>fan.phase!==before.fans[index].phase),"Each rotor must turn independently")
  assert.equal(new Set(after.fans.map(f=>f.phase.toFixed(4))).size,4)
  assert(new Set(lightSamples.map(colors=>JSON.stringify(colors))).size>1,"Activity lights must change across authored event windows")
  let maxConcurrentActivity=0
  for(const colors of lightSamples){
    assert.equal(colors.length,48*3)
    let active=0
    for(let lamp=0;lamp<48;lamp++){
      const brightness=colors[lamp*3]
      assert(brightness>=.12-1e-6&&brightness<=1+1e-6,"LED brightness outside authored range")
      assert.equal(colors[lamp*3+1],brightness);assert.equal(colors[lamp*3+2],brightness)
      if(lamp%4===3)assert(Math.abs(brightness-.5)<1e-6,"Status lamp did not remain steady")
      else if(brightness>.12001)active++
    }
    assert(active<=3,"More than three simultaneous activity pulses")
    maxConcurrentActivity=Math.max(maxConcurrentActivity,active)
  }
  report.motion={before,after,lightSamples,maxConcurrentActivity,steadyStatusLamps:12}
  await canvas.evaluate(el=>el.__gnFacilityCapability(60))
  await page.waitForFunction(()=>document.querySelector("canvas")?.__gnFacilitySnapshot?.().sampleCount>=120,null,{timeout:15000})
  report.capability=await stats();if(hardware)checkTiming(()=>assertFrameBudget(report.capability,20))
  await canvas.evaluate(el=>el.__gnFacilityCapability(null))
  await viewer.getByRole("button",{name:"Pause",exact:true}).click();await page.waitForTimeout(400)
  const paused=await stats(true);await page.waitForTimeout(500)
  assert.equal((await stats()).frames,paused.frames,"Pause left continuing scene frames")
  assert.deepEqual((await stats(true)).equipment,paused.equipment)
  report.paused=paused
  await viewer.getByRole("button",{name:"Resume",exact:true}).click()
  await page.evaluate(()=>scrollTo({top:document.body.scrollHeight,behavior:"instant"}));await page.waitForTimeout(500)
  const offscreen=await stats(true);await page.waitForTimeout(500)
  assert.equal((await stats()).frames,offscreen.frames,"Offscreen frames continued")
  report.offscreen=offscreen
  await viewer.locator(".facility-stage").scrollIntoViewIfNeeded()
  const cdp=await context.newCDPSession(page)
  for(let cycle=1;cycle<=10;cycle++){
    await chooseStillImage(viewer);assert.equal(await canvas.count(),0)
    await page.waitForTimeout(100);assert.equal(await canvas.count(),0,"Close reopened automatically")
    await viewer.getByRole("button",{name:"Explore in 3D",exact:true}).click();await ready()
    await cdp.send("HeapProfiler.collectGarbage")
    report.cycles.push({cycle,...await stats(),usedJSHeapBytes:(await cdp.send("Runtime.getHeapUsage")).usedSize})
  }
  for(const cycle of report.cycles){assert.equal(cycle.geometries,report.cycles[0].geometries);assert.equal(cycle.textures,report.cycles[0].textures);assert.equal(cycle.estimatedBytes,report.cycles[0].estimatedBytes)}
  assert(report.cycles.at(-1).usedJSHeapBytes<=report.cycles[0].usedJSHeapBytes+8*1024*1024,"Open/close retained >8MiB JS")
  await page.goto(baseURL+"/demo",{waitUntil:"load"});await revealEnhancedStage();await ready()
  await canvas.evaluate(el=>el.__sessionIdentity="same-renderer")
  for(let cycle=1;cycle<=10;cycle++){
    const kind=cycle%2?"rack":"cooling"
    await show(kind,"cutaway")
    const settlingBefore=await stats()
    // Entering/revealing an assembly may still have a finite highlight response.
    // Observe the actual sole scheduler becoming idle before testing cessation.
    await page.waitForFunction(()=>{
      const s=document.querySelector('[data-testid="facility-inspection"] canvas')?.__gnFacilitySnapshot?.()
      return s&&s.schedulerPending===0&&s.transitionRemaining===0&&s.clockSeconds>=s.interactionUntil&&!s.rackMotion?.moving
    },null,{timeout:2000})
    const specimen=await stats(true),frames=specimen.frames
    await page.waitForTimeout(350)
    assert.equal((await stats()).frames,frames,"Opened assembly continues ambient motion")
    await show(kind,"service");await page.waitForTimeout(350)
    await canvas.screenshot({path:`${output}/${kind}-service-browser.png`})
    await show("overview");await page.waitForTimeout(350)
    assert.equal(await canvas.evaluate(el=>el.__sessionIdentity),"same-renderer","Asset switch created a second renderer")
    await cdp.send("HeapProfiler.collectGarbage")
    const overview=await stats()
    assert(overview.peakEstimatedBytes<=32*1024*1024,"Staging allocation exceeded32MiB")
    report.assetCycles.push({cycle,kind,settlingBefore,specimen,overview,usedJSHeapBytes:(await cdp.send("Runtime.getHeapUsage")).usedSize})
  }
  const warm=report.assetCycles[1]
  assert(report.assetCycles.at(-1).usedJSHeapBytes<=warm.usedJSHeapBytes+8*1024*1024,"Asset switches retained >8MiB JS")
  await page.emulateMedia({reducedMotion:"reduce"});await page.waitForTimeout(500)
  const reduced=await stats(true);await page.waitForTimeout(400)
  assert.equal((await stats()).frames,reduced.frames,"Reduced motion continued rendering")
  report.reduced=reduced
  assert.deepEqual(report.errors,[])
  assert.deepEqual(await verifiedBuildIdentity(),{sourceRevision:report.provenance.sourceRevision,buildId:report.provenance.buildId,releases:report.provenance.releases,buildSettings:report.provenance.buildSettings})
  report.result=report.budgetFailures.length?"fail":"pass"
  if(report.budgetFailures.length){report.failure=report.budgetFailures.join("; ");process.exitCode=1}
}catch(error){report.result="fail";report.failure=error instanceof Error?error.message:String(error);process.exitCode=1}
finally{await context.close();await browser.close();await writeFile(`${output}/browser-validation${metal?"-native":""}.json`,JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify({result:report.result,failure:report.failure,graphics:report.graphics}))}
