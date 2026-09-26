import assert from "node:assert/strict"
import { mkdir,writeFile } from "node:fs/promises"
import { execFileSync } from "node:child_process"
import { chromium } from "@playwright/test"
import { provenance,verifiedBuildIdentity } from "./performance-contract.mjs"
const duration=Number(process.env.FACILITY_SUSTAIN_SECONDS ?? 900)
assert(duration>=15 && duration<=1800)
const output=`build/facility/${(await verifiedBuildIdentity()).buildSettings.selectedRelease}`
const baseURL=process.env.FACILITY_BASE_URL ?? "http://localhost:3000"
const browser=await chromium.launch({channel:"chrome",headless:false,args:["--use-angle=metal","--use-gl=angle"],ignoreDefaultArgs:["--use-angle=swiftshader","--disable-gpu"]})
const context=await browser.newContext({viewport:{width:1440,height:1100},deviceScaleFactor:2}),page=await context.newPage()
await page.addInitScript(()=>{window.__GN_FACILITY_DIAGNOSTICS__=true})
const report={measuredAt:new Date().toISOString(),provenance:await provenance(browser.version(),{duration,baseURL,native:true}),result:"incomplete",samples:[],interactions:[],errors:[],lifecycleEvents:[]}
let intentionalShutdown=false
const lifecycle=event=>report.lifecycleEvents.push({event,at:new Date().toISOString(),intentionalShutdown})
page.on("pageerror",error=>report.errors.push(error.message))
page.on("close",()=>lifecycle("page-close"));page.on("crash",()=>lifecycle("page-crash"))
context.on("close",()=>lifecycle("context-close"));browser.on("disconnected",()=>lifecycle("browser-disconnected"))
try{
  await page.goto(baseURL,{waitUntil:"load"})
  // Reveal the server preview to trigger enhancement without holding a node
  // reference across its replacement. Begin the timed run on the live viewer.
  await page.locator(".facility-stage").evaluate(element=>element.scrollIntoView({block:"center",behavior:"instant"}))
  await page.waitForFunction(()=>document.querySelectorAll('[data-testid="facility-inspection"] .facility-systems button').length===4)
  await page.locator(".facility-systems button").first().waitFor({state:"visible"})
  await page.locator(".facility-stage").scrollIntoViewIfNeeded()
  const canvas=page.locator("canvas[data-ready=true]");await canvas.waitFor({timeout:15000})
  report.renderer=await canvas.evaluate(el=>{const gl=el.getContext("webgl2"),ext=gl.getExtension("WEBGL_debug_renderer_info");return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):"unavailable"})
  assert(/Apple M5.*Metal|Metal.*Apple M5/i.test(report.renderer),"M5 Metal unavailable")
  await page.waitForFunction(()=>document.querySelector("canvas[data-ready=true]")?.__gnFacilitySnapshot().transitionRemaining===0)
  report.initialCameraFrustum=await canvas.evaluate(el=>el.__gnFacilitySnapshot().cameraFrustum)
  assert.equal(report.initialCameraFrustum.length,4,"Missing initial camera framing")
  try{report.thermalBefore=execFileSync("pmset",["-g","therm"],{encoding:"utf8"})}catch{report.thermalBefore="unavailable"}
  const start=performance.now()
  while(performance.now()-start<duration*1000){
    await page.waitForTimeout(1000)
    const snapshot=await canvas.evaluate(el=>el.__gnFacilitySnapshot())
    report.samples.push({elapsedSeconds:(performance.now()-start)/1000,...snapshot})
    assert(snapshot.peakEstimatedBytes<=32*1024*1024,"Allocation ceiling exceeded")
    assert.equal(snapshot.hiddenFrameCount,0,"Hidden document rendered a frame")
    assert(snapshot.cameraFrustum?.length===4 && snapshot.cameraFrustum.every((value,index)=>Number.isFinite(value) && Math.abs(value-report.initialCameraFrustum[index])<1e-6),"Authored overview camera changed during sustained rendering")
    if(report.samples.length%60===0){
      const index=(report.interactions.length%4),button=page.locator(".facility-systems button").nth(index),began=performance.now()
      await button.click()
      await page.waitForFunction(({index,frames})=>document.querySelectorAll(".facility-systems button")[index]?.getAttribute("aria-pressed")==="true" && document.querySelector("canvas[data-ready=true]").__gnFacilitySnapshot().frames>frames,{index,frames:snapshot.frames})
      report.interactions.push({elapsedSeconds:(performance.now()-start)/1000,systemIndex:index,inputThroughFrameMs:performance.now()-began})
      await page.mouse.move(0,0)
      console.log(JSON.stringify({seconds:report.samples.length,tier:snapshot.quality,missedRatio:snapshot.missedRatio,cpuP95:snapshot.cpuP95}))
    }
  }
  try{report.thermalAfter=execFileSync("pmset",["-g","therm"],{encoding:"utf8"})}catch{report.thermalAfter="unavailable"}
  assert.deepEqual(report.errors,[])
  const sorted=values=>values.slice().sort((a,b)=>a-b),p95=values=>sorted(values)[Math.floor((values.length-1)*.95)]
  report.summary={elapsedSeconds:(performance.now()-start)/1000,sampleCount:report.samples.length,tiers:[...new Set(report.samples.map(sample=>sample.quality))],maxPeakEstimatedBytes:Math.max(...report.samples.map(sample=>sample.peakEstimatedBytes)),cpuP95:p95(report.samples.map(sample=>sample.cpuP95)),cadenceP95:p95(report.samples.map(sample=>sample.frameP95)),maxMissedRatio:Math.max(...report.samples.map(sample=>sample.missedRatio)),interactionP95:report.interactions.length?p95(report.interactions.map(sample=>sample.inputThroughFrameMs)):null,hiddenFrames:Math.max(...report.samples.map(sample=>sample.hiddenFrameCount))}
  assert.deepEqual(await verifiedBuildIdentity(),{sourceRevision:report.provenance.sourceRevision,buildId:report.provenance.buildId,releases:report.provenance.releases,buildSettings:report.provenance.buildSettings})
  report.result="pass"
}catch(error){report.result="fail";report.failure=error instanceof Error?error.message:String(error);process.exitCode=1}
finally{intentionalShutdown=true;await context.close().catch(error=>report.errors.push(`Context cleanup: ${error.message}`));await browser.close().catch(error=>report.errors.push(`Browser cleanup: ${error.message}`));await mkdir(output,{recursive:true});await writeFile(`${output}/sustained-chrome-m5.json`,JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify({result:report.result,failure:report.failure,samples:report.samples.length}))}
