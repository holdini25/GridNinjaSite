import assert from 'node:assert/strict'
import { mkdtemp, mkdir, cp, copyFile, readFile, writeFile, rm, symlink } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'

const root = process.cwd()
const temporary = await mkdtemp(join(tmpdir(), 'gridninja-packaging-test-'))
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const report = {
  measuredAt: new Date().toISOString(),
  scope: 'Isolated filesystem fixtures built from frozen v1/v2 artifacts. Capture hashes are reconstructed for packaging guard tests; no browser or deployment is run.',
  testScriptSha256: hash(await readFile(join(root, 'scripts/facility/test-packaging.mjs'))),
  checks: [],
}
const run = args => execFileSync(process.execPath, ['scripts/facility/package-release.mjs', ...args], { cwd: temporary, encoding: 'utf8', stdio: 'pipe' })
const fails = (name, args, pattern) => {
  let error
  try { run(args) } catch (caught) { error = caught }
  assert(error, `${name} did not reject`)
  assert.match(String(error.stderr), pattern, name)
  report.checks.push({ name, result: 'passed' })
}
const files = ['manifest.json', 'facility.glb', 'poster-desktop.webp', 'poster-mobile.webp']
const stageArgs = ['--release', 'facility-v2']
const freezeArgs = [...stageArgs, '--freeze']
const frozenRoot = join(root, 'src/content/facility-releases')
const realPaths = ['registry.json', ...['facility-v1', 'facility-v2'].flatMap(version => files.map(file => `${version}/${file}`))]
const realHashes = Object.fromEntries(await Promise.all(realPaths.map(async file => [file, hash(await readFile(join(frozenRoot, file)))])))
try {
  await mkdir(join(temporary, 'scripts/facility'), {recursive:true})
  await mkdir(join(temporary, 'assets-source/facility'), {recursive:true})
  await mkdir(join(temporary, 'src/content/facility-releases'), {recursive:true})
  await mkdir(join(temporary, 'src/lib/facility'), {recursive:true})
  const candidate = join(temporary, 'build/facility/facility-v2')
  await mkdir(candidate, {recursive:true})
  await symlink(join(root, 'node_modules'), join(temporary, 'node_modules'))
  for (const file of ['package-release.mjs', 'validate-release.mjs']) await copyFile(join(root,'scripts/facility',file), join(temporary,'scripts/facility',file))
  await copyFile(join(root, 'src/lib/facility/manifest-schema.mjs'), join(temporary, 'src/lib/facility/manifest-schema.mjs'))
  for (const file of ['generate.py','export.py','scene.json','surface_bake.py','service_routes.py','facility-master.blend','validate.mjs','validate-surfaces.mjs','validate-air.mjs']) await copyFile(join(root,'assets-source/facility',file),join(temporary,'assets-source/facility',file))
  // A clean checkout supplies these immutable fixture bytes. No ignored candidate
  // directory or Blender/browser process is required to test the packaging rules.
  const frozenManifest = JSON.parse(await readFile(join(frozenRoot,'facility-v2/manifest.json'),'utf8'))
  for (const file of files.filter(file => file !== 'manifest.json')) await copyFile(join(frozenRoot,'facility-v2',file),join(candidate,file))
  await writeFile(join(temporary,'assets-source/facility/render-profile.json'),JSON.stringify(frozenManifest.profile,null,2)+'\n')
  await writeFile(join(candidate,'asset-report.json'),JSON.stringify({
    sha256: hash(await readFile(join(candidate,'facility.glb'))),
    sourceSha256: hash(await readFile(join(temporary,'assets-source/facility/facility-master.blend'))),
    generatorSha256: hash(await readFile(join(temporary,'assets-source/facility/generate.py'))),
  })+'\n')
  await writeFile(join(candidate,'capture-profile.json'),JSON.stringify({
    release:'facility-v2',
    modelSha256:hash(await readFile(join(candidate,'facility.glb'))),
    profileSha256:hash(Buffer.from(JSON.stringify(frozenManifest.profile))),
    posters:Object.fromEntries(await Promise.all(['poster-desktop.webp','poster-mobile.webp'].map(async file=>[file,hash(await readFile(join(candidate,file)))]))),
  })+'\n')
  await cp(join(root,'src/content/facility-releases/facility-v1'),join(temporary,'src/content/facility-releases/facility-v1'),{recursive:true})
  const registryPath=join(temporary,'src/content/facility-releases/registry.json')
  const registry=JSON.parse(await readFile(join(root,'src/content/facility-releases/registry.json'),'utf8')).filter(entry=>entry.release==='facility-v1')
  await writeFile(registryPath,JSON.stringify(registry,null,2)+'\n')
  const priorHashes=Object.fromEntries(await Promise.all(files.map(async file=>[file,hash(await readFile(join(temporary,'src/content/facility-releases/facility-v1',file)))])))
  fails('Missing release identity', [], /explicit valid --release/)
  fails('Invalid/path release identity', ['--release','../facility-v2'], /explicit valid --release/)
  fails('Registered version cannot stage', ['--release','facility-v1'], /already registered/)
  const lease=join(temporary,'assets-source/facility/generation.lock')
  await writeFile(lease,'active fixture writer')
  fails('Concurrent writer refuses lease',stageArgs,/lease unavailable/)
  await rm(lease)
  run(stageArgs)
  report.checks.push({name:'Legacy source provenance stages with real GLB and poster validation',result:'passed'})
  const staged=join(temporary,'build/facility/facility-v2/release')
  const exportReportPath=join(candidate,'asset-report.json')
  const exportReport=JSON.parse(await readFile(exportReportPath,'utf8'))
  exportReport.sourceModules=Object.fromEntries(await Promise.all(['generate.py','export.py','scene.json','surface_bake.py','service_routes.py'].map(async file=>[file,hash(await readFile(join(temporary,'assets-source/facility',file)))])))
  await writeFile(exportReportPath,JSON.stringify(exportReport)+'\n')
  run(stageArgs)
  assert.deepEqual(JSON.parse(await readFile(join(staged,'manifest.json'),'utf8')).source.modules,exportReport.sourceModules)
  report.checks.push({name:'Complete source module provenance is pinned in the staged manifest',result:'passed'})
  const helper=join(temporary,'assets-source/facility/surface_bake.py')
  const helperBytes=await readFile(helper)
  await writeFile(helper,Buffer.concat([helperBytes,Buffer.from('\n# changed bake source\n')]))
  fails('Stale bake module rejects staging',stageArgs,/Source module changed after export/)
  fails('Changed bake module rejects freezing',freezeArgs,/Source changed after staging/)
  await writeFile(helper,helperBytes)
  const sceneInput=join(temporary,'assets-source/facility/scene.json')
  const sceneBytes=await readFile(sceneInput)
  await writeFile(sceneInput,Buffer.concat([sceneBytes,Buffer.from('\n')]))
  fails('Changed scene input rejects freezing',freezeArgs,/Source changed after staging/)
  await writeFile(sceneInput,sceneBytes)
  const manifestBefore=hash(await readFile(join(staged,'manifest.json')))
  const generator=join(temporary,'assets-source/facility/generate.py')
  const generatorBytes=await readFile(generator)
  await writeFile(generator,Buffer.concat([generatorBytes,Buffer.from('\n# altered fixture\n')]))
  fails('Stale generator rejects staging',stageArgs,/Generator changed after export/)
  await writeFile(generator,generatorBytes)
  assert.equal(hash(await readFile(join(staged,'manifest.json'))),manifestBefore)
  const poster=join(temporary,'build/facility/facility-v2/poster-mobile.webp')
  const posterBytes=await readFile(poster)
  await writeFile(poster,Buffer.from('not a WebP image'))
  fails('Invalid poster rejects staging',stageArgs,/unsupported image format|Input buffer/)
  await writeFile(poster,posterBytes)
  assert.equal(hash(await readFile(join(staged,'manifest.json'))),manifestBefore)
  report.checks.push({name:'Failed staging preserves prior complete stage',result:'passed'})
  const capturePath=join(temporary,'build/facility/facility-v2/capture-profile.json')
  const captureBytes=await readFile(capturePath)
  await rm(capturePath)
  fails('Missing browser capture rejects freezing',freezeArgs,/ENOENT/)
  await writeFile(capturePath,captureBytes)
  const capture=JSON.parse(captureBytes)
  capture.posters['poster-mobile.webp']='0'.repeat(64)
  await writeFile(capturePath,JSON.stringify(capture))
  fails('Stale browser poster provenance rejects freezing',freezeArgs,/poster differs from its browser capture/)
  await writeFile(capturePath,captureBytes)
  const profilePath=join(temporary,'assets-source/facility/render-profile.json')
  const profileBytes=await readFile(profilePath)
  const profile=JSON.parse(profileBytes); profile.background='#000000'
  await writeFile(profilePath,JSON.stringify(profile))
  fails('Changed render profile rejects freezing',freezeArgs,/Render profile changed after staging/)
  await writeFile(profilePath,profileBytes)
  const stagedPoster=join(staged,'poster-mobile.webp')
  const stagedPosterBytes=await readFile(stagedPoster)
  const corrupt=Buffer.from(stagedPosterBytes);corrupt[corrupt.length-1]^=1
  await writeFile(stagedPoster,corrupt)
  fails('Corrupt staged bytes reject freezing',freezeArgs,/digest mismatch/)
  await writeFile(stagedPoster,stagedPosterBytes)
  run(freezeArgs)
  assert.equal(JSON.parse(await readFile(registryPath,'utf8')).length,2)
  for (const file of files) {
    assert.equal(hash(await readFile(join(temporary,'src/content/facility-releases/facility-v1',file))),priorHashes[file])
    assert.equal(hash(await readFile(join(temporary,'src/content/facility-releases/facility-v2',file))),hash(await readFile(join(staged,file))))
  }
  report.checks.push({name:'Complete validated freeze preserves v1 and exact reviewed v2 bytes',result:'passed'})
  fails('Frozen identity cannot be reused',freezeArgs,/already registered/)
  assert.equal(hash(await readFile(join(root,'src/content/facility-releases/facility-v1/manifest.json'))),registry[0].manifestSha256)
  report.v1ManifestSha256=registry[0].manifestSha256
  report.result='passed'
} finally {
  await rm(temporary,{recursive:true,force:true})
  for (const file of realPaths) assert.equal(hash(await readFile(join(frozenRoot,file))),realHashes[file],`Real release changed during isolated test: ${file}`)
}
await mkdir(resolve('build/facility/facility-v2'),{recursive:true})
await writeFile(resolve('build/facility/facility-v2/version-workflow-validation.json'),JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify(report,null,2))
