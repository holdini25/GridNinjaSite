// Copy to the repository root or an ignored subdirectory; always run from the app root.
// Diagnostic only. It preserves the production media player and existing observation contract.
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { resolve, join } from "node:path"
import { createRequire } from "node:module"
import { pathToFileURL, fileURLToPath } from "node:url"
import { gzipSync } from "node:zlib"

const SHA = "e126078526cc096421cc4dcea74676da37e67264"
const EXPECTED_CHROME = "157.0.8103.50"
const smoke = process.argv.length === 3 && process.argv[2] === "--local-smoke"
const root = process.cwd()
const app = rel => import(pathToFileURL(resolve(root, rel)).href)
const require = createRequire(resolve(root, "package.json"))
const { chromium } = require("@playwright/test")
const { observeCinematicLoop } = await app("scripts/cinematic/measure-page.mjs")
const { assertCinematicMotion, CINEMATIC_MOTION_LIMITS } = await app("scripts/cinematic/motion-evidence.mjs")
const { sourceRevision, releaseIdentity } = await app("scripts/facility/performance-contract.mjs")
const { acquireComputeLock } = await app("scripts/facility/compute-lock.mjs")
const out = resolve("build/qa", smoke ? "november-release/linux-loop-trace/local-smoke" : "linux-loop-trace-results")
const count = smoke ? 1 : 5
const launch = { headless: true, channel: "chrome" }
const viewport = { width: 1440, height: 1100 }
const categories = ["blink.user_timing","media","cc","viz","graphics.pipeline","gpu","toplevel","devtools.timeline",
  "disabled-by-default-media","disabled-by-default-devtools.timeline.frame","disabled-by-default-display.framedisplayed","benchmark"]
const limits = { maxTraceBufferKiB: 32768, maxRawBytes: 64*1024*1024, maxWindowEvents: 32000, maxGzipBytes: 4*1024*1024, flankUs: 350000 }
const digest = b => createHash("sha256").update(b).digest("hex")
const json = async (name,value) => writeFile(join(out,name),JSON.stringify(value,null,2)+"\n",{ mode:0o600 })
const sleep = ms => new Promise(r=>setTimeout(r,ms))
const deadline = async (p,ms,stage) => {
  let timer
  try { return await Promise.race([p,new Promise((_,rej)=>{timer=setTimeout(()=>rej(Error(stage+"_timeout")),ms)})]) }
  finally { clearTimeout(timer) }
}
const message = error => {
  // Store no embedded (potentially external) URL, page data, source snippet or remote arguments.
  const first = String(error?.message??error).split("\n")[0]
  if (/^(Cinematic |No complete active cinematic loop|Too few actual video|Missing (native|observed|first|Cinematic)|Unclosed or invalid cinematic|Contradictory |Observed cinematic|Invalid (native|cinematic))/.test(first) && /^[\w ,.:;()/'-]{1,160}$/.test(first)) return first
  if (/^[a-z][a-z0-9_]{0,100}$/.test(first)) return first
  return String(error?.name??"Error")+":details-omitted"
}
const expect = (condition,description) => { if(!condition)throw Error(description) }
const knownThread = new Set(["CrRendererMain","CrBrowserMain","CrGpuMain","Compositor","VizCompositorThread","CompositorTileWorker1","Media","Chrome_ChildIOThread"])
const timelineNames = new Set(["Paint","PrePaint","RasterTask","Layout","UpdateLayoutTree","UpdateLayerTree","Layerize","FunctionCall","FireAnimationFrame","EventDispatch","RunTask","CompositeLayers","UpdateLayer","Commit","AnimationFrame","AnimationFrame::Render","AnimationFrame::StyleAndLayout","AnimationFrame::Presentation"])
const interesting = /video|frame|present|swap|buffer|decode|render|seek|paint|raster|layout|layer|commit|draw|task|surface|submit|activat|display|demux|animation/i
const idKey = /^(?:sequence_number|frame_seq_id|frame_sequence|frame_sequence_number|frame_number|frame_index|frame_id|video_frame_id|video_frame_unique_id|frame_token|local_frame_token|compositor_frame_token|frame_sink_id|frame_sink_client_id|frame_sink_source_id|client_id|sink_id|display_id|display_trace_id|surface_frame_trace_id|track_uuid|flow_id|step|trace_id|layer_id|layer_tree_id|surface_id|source_id|quad_id|decoder_id|player_id|stream_id|media_time(?:stamp)?(?:_us|_ms|_s)?|media_timestamp(?:_us|_ms)?|presentation_timestamp(?:_us|_ms)?|presentation_time(?:_us|_ms)?|expected_display_time(?:_us|_ms)?|pts(?:_us|_ms)?|timestamp(?:_us|_ms)?|duration(?:_us|_ms)?|dropped|is_dropped|has_damage|is_main_frame|frame_reporter_type|has_missing_content|status|count)$/
const safeEnum = /^(?:PRESENTED|DROPPED|NO_UPDATE_DESIRED|NO_UPDATE|MISSED|SUBMITTED|SUCCESS|FAILURE|STEP_[A-Z_]+|STATE_[A-Z_]+|DROPPED_[A-Z_]+)$/
const numericId = /^(?:0x[\da-f]{1,16}|\d{1,20}(?:[:/,]\d{1,12}){0,3})$/i
const normalize = s=>s.replace(/([a-z0-9])([A-Z])/g,"$1_$2").toLowerCase()
function fields(args) {
 const result={}
 function scan(value,depth,prefix) {
  if(!value||typeof value!=="object"||Array.isArray(value)||depth>5)return
  for(const [raw,v] of Object.entries(value)) {
   const key=normalize(raw)
   if(!/^[a-z0-9_]{1,65}$/.test(key)) continue
   if(key==="aggregated_surface_frame_trace_ids"&&Array.isArray(v)){
    const ids=v.filter(id=>Number.isSafeInteger(id)||typeof id==="string"&&numericId.test(id))
    if(ids.length===v.length&&v.length<=64)result["aggregated_surface_frame_trace_ids"]=ids
    continue
   }
   if(v&&typeof v==="object") {scan(v,depth+1,[...prefix,key]);continue}
   if(!idKey.test(key)||Object.keys(result).length>=32)continue
   if(typeof v==="number"&&Number.isFinite(v)||typeof v==="boolean"|| typeof v==="string"&&(numericId.test(v)||safeEnum.test(v))) {
    // Keys in retained paths are structural Chrome field names; reject arbitrary labels.
    const safePrefix=prefix.filter(p=>/^(data|args|frame|surface|chrome_graphics_pipeline|.*_args|.*_id|.*_reporter|.*_feedback|.*_info|.*_metadata|.*_state)$/.test(p))
    result[[...safePrefix,key].join(".")]=v
   }
  }
 }
 scan(args,0,[])
 return result
}
function safeName(e,marks) {
 const n=e.name??"", cat=e.cat??""
 if(marks.includes(n)&&cat.includes("blink.user_timing"))return n
 if(cat.includes("blink.user_timing")||cat.includes("metadata"))return null
 if(timelineNames.has(n)||["Pre-submit buffering","Graphics.Pipeline","Graphics.Pipeline.DrawAndSwap","VideoFrameSubmitter"].includes(n))return n
 if(!interesting.test(n)||!cat.split(",").some(c=>categories.includes(c)))return null
 // Keep only code-like native instrument names. No dynamic strings, URLs, JS names or stack frames.
 if(!/^[A-Za-z][A-Za-z0-9_:.-]{1,120}$/.test(n))return null
 return n
}
const flagsFor = s=>({media:/video|decoder|demux|seek|buffer/i.test(s),feedback:/framepresented|presentationfeedback|didpresent|presentcompositorframe|swapbufferscomplete|presentationcompositorframe|swapbuffersack|animationframe::presentation/i.test(s),paint:/paint|layout|raster/i.test(s),task:/runtask|processtask/i.test(s)})
function intersectUs(start,end,p,q){return Math.max(0,Math.min(end,q)-Math.max(start,p))}
function mergeSpans(spans){
 let sum=0,left=null,right=0
 for(const [a,b] of spans.sort((x,y)=>x[0]-y[0])){
  if(left===null){left=a;right=b}else if(a>right){sum+=right-left;left=a;right=b}else right=Math.max(right,b)
 }
 return left===null?0:sum+right-left
}
// Track identity is scoped to this trace, process and ID namespace. A local ID's numeric value is not a compositor frame token.
function track(e){
 if(e.traceId_global!==undefined)return "global:"+e.traceId_global
 if(e.traceId_local!==undefined)return e.pid+":local:"+e.traceId_local
 if(e.track_uuid!==undefined)return e.pid+":track:"+e.track_uuid
 return null
}
function namedIntervals(events,name){
 const pending=new Map(),intervals=[]
 for(const e of events.filter(e=>e.name===name)){
  const id=track(e);if(id===null)continue
  if(e.ph==="X"&&e.dur>0){intervals.push({id,begin:e.ts,end:e.ts+e.dur});continue}
  if(e.ph==="b"){
   const old=pending.get(id)
   pending.set(id,{ts:e.ts,depth:(old?.depth??0)+1,ambiguous:Boolean(old)})
  }else if(e.ph==="e"&&pending.has(id)){
   const begin=pending.get(id)
   if(begin.depth===1){
    if(!begin.ambiguous&&e.ts>=begin.ts)intervals.push({id,begin:begin.ts,end:e.ts})
    pending.delete(id)
   }else begin.depth--
  }
 }
 return intervals
}
export function traceStages(events,zeroPts){
 const allSubmit=events.filter(e=>e.name==="VideoFrameSubmitter::SubmitFrame"&&e.ph==="X"&&e.dur>0)
 const preEnds=events.filter(e=>e.name==="Pre-submit buffering"&&e.ph==="e")
 const preIntervals=namedIntervals(events,"Pre-submit buffering"),feedbackIntervals=namedIntervals(events,"VideoFrameSubmitter")
 const zeroSubmits=allSubmit.filter(e=>e.fields?.media_timestamp_us===0)
 const zeroSelected=zeroPts.filter(e=>e.name==="VideoFrameCompositor::SetCurrentFrame")
 const submissions=zeroSubmits.slice(0,12).map(s=>{
  const candidates=preEnds.filter(e=>e.pid===s.pid&&e.tid===s.tid&&s.ts<e.ts&&e.ts<s.ts+s.dur&&allSubmit.filter(o=>o.pid===e.pid&&o.tid===e.tid&&o.ts<e.ts&&e.ts<o.ts+o.dur).length===1)
  const e=candidates.length===1?candidates[0]:null,id=e&&track(e)
  const pre=id?preIntervals.filter(i=>i.id===id&&i.end===e.ts):[]
  // In Chromium 157 Pre-submit buffering and its outer VideoFrameSubmitter interval both begin at decode_end_time.
  // The latter ends at the feedback timestamp, including failed presentations; its timing alone cannot establish display success.
  const feedback=pre.length===1?feedbackIntervals.filter(f=>f.id===id&&f.begin===pre[0].begin&&f.end>=e.ts):[]
  return {submitUs:s.ts,endUs:s.ts+s.dur,uniquePreSubmitEndUs:e?.ts??null,trackId:id??null,
   feedbackUs:feedback.length===1?feedback[0].end:null,strictlyInsideSingleSubmit:!!e,matchingTrackAndDecodeBegin:feedback.length===1}
 })
 const step=e=>e.fields?.["chrome_graphics_pipeline.step"]
 const received=events.filter(e=>step(e)==="STEP_RECEIVE_COMPOSITOR_FRAME")
 const aggregated=events.filter(e=>step(e)==="STEP_SURFACE_AGGREGATION")
 const field=(e,end)=>[...Object.entries(e.fields??{}),...Object.entries(e.endFields??{})].find(([k])=>k===end||k.endsWith("."+end))?.[1]
 const validId=x=>(typeof x==="string"&&numericId.test(x)&&!/^(?:0|0x0+)$/.test(x))||(Number.isSafeInteger(x)&&x>0)
 const vizLinks=[]
 for(const a of aggregated){
  const ids=field(a,"aggregated_surface_frame_trace_ids"),display=field(a,"display_trace_id")
  if(!Array.isArray(ids)||!validId(display))continue
  for(const r of received){
   const surface=field(r,"surface_frame_trace_id")
   if(r.ts<=a.ts&&validId(surface)&&ids.some(id=>String(id)===String(surface))&&vizLinks.length<32)vizLinks.push({receivedUs:r.ts,aggregationUs:a.ts,surfaceFrameTraceId:surface,displayTraceId:display})
  }
 }
 const feedbackSeen=submissions.some(s=>s.matchingTrackAndDecodeBegin),prepared=submissions.some(s=>s.strictlyInsideSingleSubmit)
 return {zeroPtsSelectedEvents:zeroSelected.length,zeroPtsSubmitAttempts:zeroSubmits.length,submissions,successfulPhysicalPresentationProven:false,
  strongestStage:feedbackSeen?"prepared_for_submission_with_submitter_feedback_timestamp_success_unknown":prepared?"prepared_for_submission_past_early_returns":zeroSubmits.length?"zero_pts_submit_attempt_only":zeroSelected.length?"zero_pts_selected_as_current":zeroPts.length?"explicit_zero_media_pts_seen_at_other_instrument":"no_explicit_zero_media_pts_in_trace",
  viz:{receiveEvents:received.length,aggregateEvents:aggregated.length,typedSurfaceToDisplayLinks:vizLinks,
   displayFeedbackEvents:events.filter(e=>e.name==="Display::FrameDisplayed").length,
   limitation:"A compositor surface trace ID is not a video-frame token. Aggregate/display feedback cannot prove presentation of a particular PTS without a compatible media-to-surface identity."}}
}
export function analyze(raw,anchorData,motion,run) {
 const events=raw.traceEvents??raw
 expect(Array.isArray(events),"missing_trace_events")
 const marks=anchorData.map(a=>a.name);const mapped=anchorData.map(a=>{
  const hits=events.filter(e=>e.name===a.name&&e.cat?.includes("blink.user_timing")&&Number.isFinite(e.ts))
  const e=hits.find(x=>["R","I","i"].includes(x.ph))??hits[0]
  return {...a,traceHits:hits.length,traceUs:e?.ts??null,pid:e?.pid??null,tid:e?.tid??null,offsetUs:e?e.ts-a.jsMs*1000:null}
 })
 const calibration= mapped.length===2 && mapped.every(a=>a.traceHits===1&&Number.isFinite(a.offsetUs)) && mapped[0].pid===mapped[1].pid && mapped[0].tid===mapped[1].tid && Math.abs(mapped[0].offsetUs-mapped[1].offsetUs)<=1000
 const offset=calibration?(mapped[0].offsetUs+mapped[1].offsetUs)/2:null
 const seam=motion?.loopBoundaries?.[0]
 const start=calibration&&seam?seam.fromFrame.expectedDisplayTimeMs*1000+offset:null, end=calibration&&seam?seam.toFrame.expectedDisplayTimeMs*1000+offset:null
 const anchorRange=mapped.filter(a=>a.traceUs!==null).map(a=>a.traceUs)
 const fallbackEnd=anchorRange.at(-1)??events.reduce((v,e)=>Number.isFinite(e.ts)?Math.max(v,e.ts):v,0)
 const low=start!==null?start-limits.flankUs:fallbackEnd-2000000,high=end!==null?end+limits.flankUs:fallbackEnd+1000
 const threads={}, stacks=new Map(), normalized=[];let included=0
 function retain(e,duration=e.dur??0) {
  const name=safeName(e,marks);if(!name||!Number.isFinite(e.ts))return
  const isMark=marks.includes(name)
  if(!isMark&&(e.ts>high||e.ts+duration<low))return
  included++
  if(normalized.length>=limits.maxWindowEvents&&!isMark)return
  const row={name,cat:(e.cat??"").split(",").filter(c=>categories.includes(c)).join(","),ph:e.ph,pid:e.pid,tid:e.tid,ts:e.ts}
  if(duration>0)row.dur=duration
  const args=fields(e.args)
  // Chromium 157 uses VideoFrame::AsHumanReadableString at these two instrument points. Extract ONLY the numeric media PTS; a trace point in SubmitFrame may precede an early return.
  if(/(?:VideoFrameCompositor::SetCurrentFrame|VideoFrameSubmitter::SubmitFrame)$/.test(name)&&typeof e.args?.frame==="string"){
   const m=/(?:^|[ ,;])timestamp:\s*(-?\d+)(?=\s|,|;|$)/.exec(e.args.frame)
   if(m&&Number.isSafeInteger(Number(m[1])))args.media_timestamp_us=Number(m[1])
  }
  if(Object.keys(args).length)row.fields=args
  if(e.endArgs){const ef=fields(e.endArgs);if(Object.keys(ef).length)row.endFields=ef}
  for(const k of ["bind_id","track_uuid","flow_in","flow_out"])if(typeof e[k]==="boolean"||Number.isSafeInteger(e[k])||typeof e[k]==="string"&&numericId.test(e[k]))row[k]=e[k]
  if(typeof e.id==="number"||typeof e.id==="string"&&numericId.test(e.id))row.traceEventId=e.id
  if(e.id2)for(const k of ["local","global"])if(typeof e.id2[k]==="number"||typeof e.id2[k]==="string"&&numericId.test(e.id2[k]))row["traceId_"+k]=e.id2[k]
  normalized.push(row)
 }
 // Trace events can be emitted in separate chunks; pair nested synchronous B/E on each thread in timestamp order.
 for(const e of [...events].sort((a,b)=>a.ts-b.ts)){
  const key=e.pid+":"+e.tid
  if(e.ph==="M"&&e.name==="thread_name"&&knownThread.has(e.args?.name)){threads[key]=e.args.name;continue}
  if(e.ph==="B"){let stack=stacks.get(key);if(!stack){stack=[];stacks.set(key,stack)}stack.push(e);continue}
  if(e.ph==="E"){const begin=stacks.get(key)?.pop();if(begin)retain({...begin,ph:"X",endArgs:e.args},Math.max(0,e.ts-begin.ts));continue}
  retain(e)
 }
 normalized.sort((a,b)=>a.ts-b.ts)
 const completeWindow=Boolean(start!==null&&end>start&&mapped[0].traceUs<=start&&mapped.at(-1).traceUs>=end&&included<=limits.maxWindowEvents)
 const seamRows=completeWindow?normalized.filter(e=>e.ts<=end&&e.ts+(e.dur??0)>=start):[]
 const main=e=>e.pid===mapped[0]?.pid&&e.tid===mapped[0]?.tid
 const spanSummary=predicate=>{const rows=seamRows.filter(e=>predicate(e)&&e.dur>0);return {
  count:rows.length,unionOverlapMs:mergeSpans(rows.map(e=>[Math.max(e.ts,start),Math.min(e.ts+e.dur,end)]))/1000,
  longestOverlapMs:rows.length?Math.max(...rows.map(e=>intersectUs(e.ts,e.ts+e.dur,start,end)))/1000:0}}
 const zeroPts=normalized.filter(e=>flagsFor(e.name).media&&Object.entries(e.fields??{}).some(([key,value])=>/(^|\.)(?:media_time(?:stamp)?|pts)(?:_us|_ms|_s)?$/.test(key)&&value===0))
 const feedback=normalized.filter(e=>flagsFor(e.name).feedback)
 const tokens=e=>Object.entries(e.fields??{}).filter(([k])=>/(^|\.)(frame_token|compositor_frame_token)$/.test(k)).map(([,v])=>String(v))
 const stageEvidence=traceStages(normalized,zeroPts)
 const candidateTokenMatches=zeroPts.flatMap(z=>feedback.filter(f=>f.ts>=z.ts&&tokens(z).some(t=>tokens(f).includes(t))).slice(0,8).map(f=>({ptsEvent:z.name,ptsUs:z.ts,feedbackEvent:f.name,feedbackUs:f.ts,tokens:tokens(z).filter(t=>tokens(f).includes(t))}))).slice(0,32)
 // A temporal overlap, a compositor cadence event or a generic timestamp 0 cannot identify a video presentation.
 return {analysis:{run,calibrated:calibration,anchors:mapped,windowComplete:completeWindow,expectedBoundaryUs:[start,end],retainedUs:[low,high],
  totalTraceEvents:events.length,eligibleWindowEvents:included,retainedEvents:normalized.length,trimmed:included>limits.maxWindowEvents,
  mainThreadPaintLayout:completeWindow?spanSummary(e=>main(e)&&flagsFor(e.name).paint):null,
  mainThreadTasks:completeWindow?spanSummary(e=>main(e)&&flagsFor(e.name).task):null,
  mediaWindowCounts:histogram(normalized.filter(e=>flagsFor(e.name).media)),feedbackWindowCounts:histogram(feedback),
  explicitMediaZeroPtsEvents:zeroPts.slice(0,24),candidateTokenMatches,stageEvidence,
  frameZeroIdentification:!completeWindow?"uncalibrated_or_incomplete":stageEvidence.strongestStage,
  interpretation:"Task overlap is descriptive. A missing rVFC frame is not reconstructed from unrelated display events. Event IDs and frame sequence numbers are not interchangeable. Endpoints are compositor proxies, not physical scanout."},
  trace:{schema:"gridninja.diagnostic.native-loop-window.v1",run,recognizedThreads:threads,traceEvents:normalized}}
}
function histogram(events){const m=new Map();for(const e of events)m.set(e.name,(m.get(e.name)??0)+1);return Object.fromEntries([...m.entries()].sort((a,b)=>b[1]-a[1]).slice(0,60))}
async function collectTrace(session) {
 const completed=new Promise(resolve=>session.once("Tracing.tracingComplete",resolve))
 await session.send("Tracing.end")
 const receipt=await deadline(completed,10000,"trace_end")
 expect(receipt.stream,"trace_stream_missing")
 const chunks=[];let bytes=0
 try{
  while(true){
   const part=await deadline(session.send("IO.read",{handle:receipt.stream,size:524288}),4000,"trace_read")
   const buf=Buffer.from(part.data,part.base64Encoded?"base64":"utf8");bytes+=buf.length
   expect(bytes<=limits.maxRawBytes,"trace_input_cap")
   chunks.push(buf);if(part.eof)break
  }
 }finally{await session.send("IO.close",{handle:receipt.stream}).catch(()=>{})}
 return {raw:JSON.parse(Buffer.concat(chunks).toString("utf8"),(key,value,context)=>typeof value==="number"&&Number.isInteger(value)&&!Number.isSafeInteger(value)&&context?.source&&/^-?\d+$/.test(context.source)?context.source:value),bytes,dataLossOccurred:receipt.dataLossOccurred===true}
}
async function anchor(page,name){
 const clock=await page.evaluate(name=>{
  const mark=performance.mark(name)
  return {name,jsMs:mark.startTime}
 },name)
 return clock
}
async function environment(browser){
 const session=await browser.newBrowserCDPSession()
 try {
  const result=await session.send("SystemInfo.getInfo")
  return {renderer:result.gpu?.auxAttributes?.glRenderer??"unavailable",videoDecode:result.gpu?.featureStatus?.video_decode??"unavailable",chrome:browser.version()}
 }finally{await session.detach()}
}
async function snapshot(page) {
 return page.evaluate(()=>{
  const root=document.querySelector('[data-testid="cinematic-facility"]'), v=root?.querySelector("video")
  if(!v)return {video:false,visible:document.visibilityState==="visible"}
  const r=v.getBoundingClientRect(),w=Math.max(0,Math.min(innerWidth,r.right)-Math.max(0,r.left)),h=Math.max(0,Math.min(innerHeight,r.bottom)-Math.max(0,r.top))
  return {video:true,visible:document.visibilityState==="visible",focus:document.hasFocus(),fraction:r.width*r.height>0?w*h/(r.width*r.height):0,paused:v.paused,loop:v.loop,muted:v.muted,rate:v.playbackRate,time:v.currentTime,duration:v.duration,
   readyState:v.readyState,seeking:v.seeking,width:v.videoWidth,height:v.videoHeight,release:root.dataset.release==="cinematic-v1",rendition:root.dataset.rendition==="desktop",
   expectedSource:new URL(v.currentSrc||location.href).origin===location.origin&&new URL(v.currentSrc||location.href).pathname==="/assets/cinematic/cinematic-v1/desktop.mp4"}
 })
}
async function inspectRun(browser,origin,run) {
 const record={run,startedAt:new Date().toISOString(),stage:"create_context",pageErrorCount:0,remotePageRequestCount:0,approvedMovieRequestCount:0,approvedMovieResponses:[],motion:null,gate:{result:"unobserved"},diagnosticComplete:false}
 const context=await browser.newContext({viewport});let page,session,tracing=false,finished=false
 const anchors=[]
 try{
  page=await context.newPage();session=await context.newCDPSession(page)
  page.on("pageerror",()=>record.pageErrorCount++)
  await session.send("Network.enable");await session.send("Network.setCacheDisabled",{cacheDisabled:true})
  // The pinned build performs only local requests on Home. Keep the launch args untouched and fail if the page attempts remote access.
  await session.send("Network.setBlockedURLs",{urlPatterns:[{urlPattern:origin+"/*",block:false}],urls:["http://*","https://*","ws://*","wss://*"]})
  session.on("Network.requestWillBeSent",({request})=>{
   try {const u=new URL(request.url)
    if(["http:","https:","ws:","wss:"].includes(u.protocol)&&u.origin!==origin)record.remotePageRequestCount++
    if(u.origin===origin&&u.pathname==="/assets/cinematic/cinematic-v1/desktop.mp4")record.approvedMovieRequestCount++
   }catch{}
  })
  session.on("Network.responseReceived",({response})=>{
   if(response.url===origin+"/assets/cinematic/cinematic-v1/desktop.mp4"&&record.approvedMovieResponses.length<8)record.approvedMovieResponses.push(response.status)
  })
  record.stage="load"
  const response=await page.goto(origin+"/",{waitUntil:"load",timeout:30000});expect(response?.status()===200&&page.url()===origin+"/","unexpected_home_response")
  await page.bringToFront()
  const stage=page.getByTestId("cinematic-facility")
  await stage.locator(".cinematic-stage").scrollIntoViewIfNeeded({timeout:12000})
  await stage.locator("img").evaluate(img=>img.decode(),null,{timeout:12000})
  await page.waitForFunction(()=>{const s=document.querySelector('[data-testid="cinematic-facility"]');return s?.dataset.state==="playing"&&s.dataset.frameEvidence==="presented-frame"},null,{timeout:18000})
  record.startState=await snapshot(page)
  expect(record.startState.expectedSource&&record.startState.release&&record.startState.loop&&record.startState.rate===1&&record.startState.duration===10&&record.startState.width===1280&&record.startState.height===800,"unexpected_native_player_state")
  record.stage="observe_native_loop"
  // Reuse the exact, unmodified contract. A separate read-only media-clock poll arms tracing before the wrap, then stops.
  const observe=stage.locator("video").evaluate(observeCinematicLoop,null,{timeout:29000}).then(m=>({motion:m}),e=>({error:message(e)}))
  const armed=page.waitForFunction(()=>{const v=document.querySelector('[data-testid="cinematic-facility"] video');return v&&!v.paused&&v.currentTime>=7.0&&v.currentTime<=8.9},null,{polling:100,timeout:12000}).then(async handle=>{await handle.dispose();return true},()=>false)
  const start=await Promise.race([armed,observe.then(()=>false)])
  let traceError
  if(start){
    try{
     await session.send("Tracing.start",{traceConfig:{recordMode:"recordContinuously",traceBufferSizeInKb:limits.maxTraceBufferKiB,excludedCategories:["*"],includedCategories:categories},
      transferMode:"ReturnAsStream",streamFormat:"json",streamCompression:"none"})
     tracing=true;anchors.push(await anchor(page,"GN_NATIVE_LOOP_BEGIN_"+run));record.traceStartState=await snapshot(page)
    }catch(e){traceError=message(e)}
  }else traceError="trace_window_not_armed"
  const observation=await observe
  if(observation.motion){
   record.motion=observation.motion
   try{record.gate={result:"pass",validation:assertCinematicMotion(record.motion)}}catch(e){record.gate={result:"fail",reason:message(e)}}
  }else record.gate={result:"fail",reason:observation.error}
  if(tracing){
   await sleep(250)
   anchors.push(await anchor(page,"GN_NATIVE_LOOP_END_"+run))
   record.stage="read_trace"
   const trace=await collectTrace(session);tracing=false
   const {analysis,trace:clean}=analyze(trace.raw,anchors,record.motion,run)
   record.trace={...analysis,bytesRead:trace.bytes,dataLossOccurred:trace.dataLossOccurred,windowFile:"run-"+run+"-trace.json.gz"}
   const gz=gzipSync(JSON.stringify(clean));expect(gz.length<=limits.maxGzipBytes,"trace_output_cap")
   await writeFile(join(out,record.trace.windowFile),gz,{flag:"wx",mode:0o600})
   record.trace.windowGzipBytes=gz.length;record.trace.windowSha256=digest(gz)
  }
  if(traceError)record.traceError=traceError
  record.endState=await snapshot(page)
  // An unavailable direct presentation ID is a legitimate diagnostic outcome. Missing clock calibration/data is not.
  record.diagnosticComplete=Boolean(record.motion&&record.trace?.windowComplete&&!record.trace?.dataLossOccurred&&!traceError&&!record.remotePageRequestCount&&!record.pageErrorCount&&
    record.approvedMovieRequestCount&&record.approvedMovieResponses.some(status=>status===200||status===206))
  record.stage="complete";finished=true
 }catch(e){record.error=message(e)}
 finally{
  if(tracing) await deadline(collectTrace(session),12000,"trace_cleanup").catch(()=>{})
  if(page&&!finished) record.endState=await snapshot(page).catch(()=>null)
  await context.close().catch(()=>{})
  record.finishedAt=new Date().toISOString()
  await json("run-"+run+".json",record)
 }
 return {run,diagnosticComplete:record.diagnosticComplete,stage:record.stage,error:record.error??record.traceError??null,gate:record.gate.result,gateReason:record.gate.reason??null,
  expectedDisplayGapsMs:record.motion?.loopBoundaries?.map(b=>b.expectedDisplayGapMs)??[],unobservedFrameCount:record.motion?.skippedCallbackFrames??null,
  identification:record.trace?.frameZeroIdentification??null,calibrated:record.trace?.calibrated??false,traceDataLoss:record.trace?.dataLossOccurred??null}
}

let summary
async function main(){
assert(smoke || process.argv.length === 2, "Only --local-smoke is supported")
await mkdir(resolve("build/qa"),{recursive:true})
await mkdir(out,{mode:0o700}) // Never overwrite a prior collection.
summary={schema:"gridninja.native-loop-diagnostic.v1",diagnosticOnly:true,mode:smoke?"local-smoke":"linux-x86_64",startedAt:new Date().toISOString(),stage:"preflight",requiredRuns:count,
 viewport,launch,categories,limits,nativeLimits:CINEMATIC_MOTION_LIMITS,runs:[],result:"incomplete"}
let browser,release
try{
 const git=(...args)=>execFileSync("git",args,{cwd:root,encoding:"utf8",stdio:["ignore","pipe","ignore"]}).trim()
 expect(git("rev-parse","HEAD")===SHA,"wrong_checkout_head");expect(git("status","--porcelain","--untracked-files=no")==="","tracked_tree_dirty")
 expect(smoke?process.platform==="darwin"&&process.arch==="arm64":process.platform==="linux"&&process.arch==="x64","wrong_platform")
 const target=new URL(process.env.FACILITY_BASE_URL??"http://localhost:3000")
 expect(target.protocol==="http:"&&["localhost","127.0.0.1","[::1]"].includes(target.hostname)&&target.port&&target.href===target.origin+"/","invalid_loopback_origin")
 const recorded=JSON.parse(await readFile(".next/facility-build.json","utf8")).identity
 const buildId=(await readFile(".next/BUILD_ID","utf8")).trim()
 expect(buildId===recorded.buildId&&recorded.sourceRevision===await sourceRevision(),"build_source_identity_mismatch")
 expect(JSON.stringify(await releaseIdentity())===JSON.stringify(recorded.releases),"release_identity_mismatch")
 expect(recorded.buildSettings?.cinematic?.selectedRelease==="cinematic-v1"&&recorded.buildSettings.cinematic.mode==="auto"&&!recorded.buildSettings.cinematic.preview,"wrong_cinematic_selection")
 const served=await fetch(target.origin+"/_next/static/"+encodeURIComponent(buildId)+"/_buildManifest.js",{method:"HEAD",redirect:"manual",signal:AbortSignal.timeout(5000)})
 expect(served.status===200&&(served.headers.get("content-type")??"").includes("javascript"),"served_build_manifest_mismatch")
 summary.build={commit:SHA,buildId,sourceRevision:recorded.sourceRevision,cinematic:recorded.buildSettings.cinematic}
 summary.driverSha256=digest(await readFile(fileURLToPath(import.meta.url)))
 summary.platform={os:process.platform,arch:process.arch,node:process.version,playwright:require("@playwright/test/package.json").version}
 release=await acquireComputeLock("bounded-native-loop-trace")
 browser=await chromium.launch(launch)
 const env=await environment(browser);summary.browser=env
 expect(smoke||env.chrome===EXPECTED_CHROME,"linux_chrome_version_mismatch")
 summary.matchesFailedLinuxEnvironment=!smoke&&/SwiftShader/i.test(env.renderer)
 summary.rendererComparison=smoke?"local_smoke_only":summary.matchesFailedLinuxEnvironment?"matched_swiftshader_renderer":"limited_renderer_differs"
 summary.decoderFeatureLimitation="SystemInfo video_decode is a browser capability indication, not the decoder used for an individual video."
 summary.stage="collect";await json("summary.json",summary)
 for(let n=1;n<=count;n++){
  const run=await deadline(inspectRun(browser,target.origin,n),105000,"run_watchdog")
  summary.runs.push(run);await json("summary.json",summary)
  console.log("loop",n,"gate",run.gate,"evidence",run.diagnosticComplete?"complete":"incomplete",run.gateReason??"")
 }
 summary.stage="complete";summary.result=summary.runs.every(r=>r.diagnosticComplete)?"collected":"incomplete"
}catch(e){summary.error=message(e)}
finally{
 try{await browser?.close()}finally{await release?.()}
 summary.finishedAt=new Date().toISOString();await json("summary.json",summary)
 console.log("Diagnostic result:",summary.result,". Records:","build/qa/"+(smoke?"november-release/linux-loop-trace/local-smoke":"linux-loop-trace-results"))
 if(summary.result!=="collected")process.exitCode=1
}

}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main()
