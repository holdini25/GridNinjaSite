/** Prove v6 construction/topology checks reject actual corrupted GLB fixtures. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const path=resolve(process.argv[2]??'build/facility/facility-v6/facility.glb'), raw=await readFile(path);
const directory=resolve(dirname(path),'negative-fixtures');await mkdir(directory,{recursive:true});
const jsonLength=raw.readUInt32LE(12), source=JSON.parse(raw.subarray(20,20+jsonLength)), binary=raw.subarray(20+jsonLength);
const rootIndex=source.nodes.findIndex(n=>n.extras?.gnId==='GN_EXPORT'), topology=JSON.parse(source.nodes[rootIndex].extras.gnTopology);
const checks=[];
for(const kind of ['off-route-branch','cross-fluid-passage','blocked-internal-air-passage','missing-section-root']) {
  const data=structuredClone(source), t=structuredClone(topology);
  if(kind==='off-route-branch')t.ecosystem.branches[0].s+=.01;
  else if(kind==='cross-fluid-passage')t.ecosystem.passages.find(p=>p.medium==='water').medium='air';
  else if(kind==='blocked-internal-air-passage') {
    const p=t.ecosystem.passages[0], a=p.path[0], b=p.path.at(-1);
    p.path=[a,[a[0]+.60,a[1],a[2]-.30],b];p.lengthMetres=p.path.slice(1).reduce((s,b,i)=>s+Math.hypot(...b.map((v,k)=>v-p.path[i][k])),0);
  } else data.nodes.find(n=>n.extras?.gnId==='GN_AIR_SECTION_COVERS').extras.gnId='REMOVED_COVER';
  data.nodes[rootIndex].extras.gnTopology=JSON.stringify(t);
  const encoded=Buffer.from(JSON.stringify(data)), padded=Buffer.concat([encoded,Buffer.alloc((4-encoded.length%4)%4,32)]), header=Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(20+padded.length+binary.length,8);header.writeUInt32LE(padded.length,12);header.writeUInt32LE(0x4e4f534a,16);
  const output=resolve(directory,kind+'.glb');await writeFile(output,Buffer.concat([header,padded,binary]));
  const result=spawnSync(process.execPath,[resolve('assets-source/facility/validate.mjs'),output],{encoding:'utf8'});
  const reason=result.stderr.split('\n').find(l=>l.startsWith('Error: '))?.slice(7)??result.stderr.slice(0,500);
  const expected={'off-route-branch':'does not meet its rendered route','cross-fluid-passage':'Passage cross-medium contamination','blocked-internal-air-passage':'Blocked authored air passage','missing-section-root':'Section covers need a stable cooling root'};
  if(result.status===0 || !reason.includes(expected[kind]))throw new Error('Corrupt fixture did not fail for the expected reason: '+kind+' '+reason);
  checks.push({case:kind,rejected:true,reason});
}
const report={schemaVersion:1,assetSha256:createHash('sha256').update(raw).digest('hex'),checks,result:'passed'};
await writeFile(resolve(dirname(path),'air-adversarial-validation.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
