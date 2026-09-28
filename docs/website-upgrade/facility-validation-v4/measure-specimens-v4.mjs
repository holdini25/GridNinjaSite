import assert from 'node:assert/strict'
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {resolve} from 'node:path'
import {chromium} from '@playwright/test'
const {TransferLedger,settleTransfers,provenance,verifiedBuildIdentity}=await import(pathToFileURL(resolve('scripts/facility/performance-contract.mjs')).href)
const baseURL=process.env.FACILITY_BASE_URL??'http://127.0.0.1:3000'
const browser=await chromium.launch({channel:'chrome',headless:false,args:['--use-angle=metal','--use-gl=angle'],ignoreDefaultArgs:['--use-angle=swiftshader','--disable-gpu']})
const context=await browser.newContext({viewport:{width:1440,height:1100}}),page=await context.newPage(),cdp=await context.newCDPSession(page),ledger=new TransferLedger()
await cdp.send('Network.enable')
for(const[event,method]of[['requestWillBeSent','request'],['responseReceived','response'],['dataReceived','data'],['loadingFinished','finished'],['loadingFailed','failed']])cdp.on(`Network.${event}`,value=>ledger[method](value))
const report={measuredAt:new Date().toISOString(),provenance:await provenance(browser.version(),{baseURL,freshContext:true,cacheEnabled:true,supplementalHarnessSha256:createHash('sha256').update(await readFile(fileURLToPath(import.meta.url))).digest('hex')}),steps:[],errors:[],result:'incomplete'}
page.on('pageerror',error=>report.errors.push(error.message))
try{
 await page.goto(baseURL+'/demo',{waitUntil:'load'});const viewer=page.getByTestId('facility-inspection');await viewer.locator('.facility-stage').scrollIntoViewIfNeeded();await viewer.locator('canvas[data-ready=true]').waitFor({timeout:15000})
 const initial=await settleTransfers(ledger);report.automatic={bytes:initial.bytes,specimenRequests:initial.requests.filter(request=>/\/(rack|cooling)\.glb$/.test(new URL(request.url).pathname))};assert.equal(report.automatic.specimenRequests.length,0)
 await viewer.getByRole('button',{name:'Pause',exact:true}).click()
 for(const kind of ['rack','overview','cooling','overview']){
  const start=ledger.snapshot().requests.length;const began=performance.now()
  await viewer.getByRole('button',{name:kind==='rack'?'Server rack':kind==='cooling'?'Cooling assembly':'Overview',exact:true}).click()
  await page.waitForFunction(kind=>document.querySelector('[data-testid="facility-inspection"]').dataset.view===kind,kind,{timeout:12000})
  const settled=await settleTransfers(ledger),requests=settled.requests.slice(start),model=kind==='overview'?'facility.glb':`${kind}.glb`
  assert(requests.some(request=>new URL(request.url).pathname.endsWith('/'+model)))
  report.steps.push({kind,explicit:true,readyMs:performance.now()-began,bytes:requests.reduce((sum,request)=>sum+request.bytes,0),requests})
 }
 assert.deepEqual(report.errors,[])
 assert.deepEqual(await verifiedBuildIdentity(),{sourceRevision:report.provenance.sourceRevision,buildId:report.provenance.buildId,releases:report.provenance.releases,buildSettings:report.provenance.buildSettings})
 report.result='pass'
}catch(error){report.result='fail';report.failure=error.message;process.exitCode=1}finally{await context.close();await browser.close();await mkdir('build/facility/facility-v4',{recursive:true});await writeFile('build/facility/facility-v4/specimen-transfers.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({result:report.result,failure:report.failure,steps:report.steps.map(({kind,bytes,readyMs})=>({kind,bytes,readyMs}))}))}
