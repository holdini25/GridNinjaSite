"""Compare preserved benchmark pixels in Blender's bundled image decoder.

Blender --background --factory-startup --python-exit-code 2 --python <script>
  -- --directory build/qa/PRIVATE_CYCLES --output build/qa/PRIVATE_NEW_REPORT.json
No rendering, preference or master writes. Differences inform review; they are
not an automatic claim of perceptual equivalence or craft approval.
"""
import argparse
import hashlib
import json
from pathlib import Path
import statistics
import sys
import bpy
import numpy as np

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--directory',type=Path,required=True)
p.add_argument('--output',type=Path,required=True)
p.add_argument('--atlas-series',default='02')
a=p.parse_args(sys.argv[sys.argv.index('--')+1:])
root=Path(__file__).resolve().parent.parent.parent
if a.output.exists() or not a.output.resolve().is_relative_to(root/'build/qa'):raise ValueError('Fresh report under build/qa required')
digest=lambda data:hashlib.sha256(data).hexdigest()

def load(path,expected=None):
    payload=path.read_bytes()
    if expected and digest(payload)!=expected:raise ValueError('Artifact hash mismatch: '+str(path))
    image=bpy.data.images.load(str(path),check_existing=False)
    try:
        image.colorspace_settings.name='Non-Color'
        image.reload()
        pixels=np.empty(image.size[0]*image.size[1]*4,dtype=np.float32)
        image.pixels.foreach_get(pixels)
        if not np.isfinite(pixels).all():raise ValueError('Nonfinite pixels')
        return pixels.reshape((image.size[1],image.size[0],4)).copy()
    finally:bpy.data.images.remove(image)

def difference(reference,candidate):
    if reference.shape!=candidate.shape:raise ValueError('Image dimensions differ')
    delta=np.abs(candidate-reference).astype(np.float64)
    return {'rmse':float(np.sqrt(np.mean(delta**2))),'maxAbs':float(delta.max()),
            'p99Abs':float(np.percentile(delta,99)),
            'channels':[{'channel':name,'rmse':float(np.sqrt(np.mean(delta[:,:,i]**2))),'maxAbs':float(delta[:,:,i].max())} for i,name in enumerate('RGBA')]}

report={'schemaVersion':'cycles-benchmark-comparison.v1','status':'incomplete','sources':{},'render':{},'atlas':{},
        'interpretation':'Decoded numerical differences, not byte equality or automated visual approval. EXRs are scene-linear. PNG atlas code values are decoded without color conversion.',
        'constraints':'Four CPU threads; MetalRT AUTO; one serialized job at a time. No extrapolation to all scenes or physical phones.'}
render_images={};atlas_images={};modes=['cpu','metal','hybrid'];render_identity=None;atlas_identity=None
for mode in modes:
    path=a.directory/('render-'+mode+'01')/'report.json';raw=path.read_bytes();r=json.loads(raw)
    if r['status']!='pass':raise ValueError('Failed render benchmark '+mode)
    if r['sampling']['adaptive'] or r['sampling']['samples']!=256 or r['sampling']['denoise']!='none':raise ValueError('Unmatched render settings')
    if r['arguments']['width']!=1600 or r['arguments']['height']!=1200:raise ValueError('Unmatched benchmark resolution')
    identity=json.dumps({key:r[key] for key in ['source','camera','lighting','sampling','sourceHashes']},sort_keys=True)
    if render_identity is not None and identity!=render_identity:raise ValueError('Render inputs differ across devices')
    render_identity=identity
    rows=[row for row in r['renders'] if row['kind']=='measured']
    if len(rows)!=3:raise ValueError('Need exactly three measured render repetitions')
    report['sources'][str(path)]=digest(raw)
    report['render'][mode]={'medianSeconds':statistics.median(row['renderSeconds'] for row in rows),
                            'runsSeconds':[row['renderSeconds'] for row in rows],
                            'firstInvocationSeconds':r['renders'][0]['renderSeconds'],
                            'peakRSSBytes':max(row['peakRSSBytes'] for row in r['renders']),
                            'configuration':r['configuration']}
    for row in rows:
        item=next(item for item in row['files'] if item['file'].endswith('.exr'))
        render_images[(mode,row['repetition'])]=load(path.parent/item['file'],item['sha256'])
for mode in ['cpu','metal','hybrid','mixed']:
    path=a.directory/('atlas-'+mode+a.atlas_series+'.json');raw=path.read_bytes();r=json.loads(raw)
    if r['status']!='pass' or r['cache']!='off' or r['samples']!=64:raise ValueError('Invalid atlas benchmark '+mode)
    identity=json.dumps({key:r[key] for key in ['sourceMasterSha256','sourceHashes','samples','seed','adaptiveSampling','animatedSeed']},sort_keys=True)
    if atlas_identity is not None and identity!=atlas_identity:raise ValueError('Atlas inputs differ across devices')
    atlas_identity=identity
    rows=[row for row in r['runs'] if row['kind']=='measured']
    if len(rows)!=3:raise ValueError('Need exactly three measured bake repetitions')
    report['sources'][str(path)]=digest(raw)
    report['atlas'][mode]={'medianSeconds':r['medianSeconds'],'runsSeconds':[row['seconds'] for row in rows],
                           'firstInvocationSeconds':r['runs'][0]['seconds'],'configuration':r['configuration'],
                           'spatialDevicePolicy':r['spatialDevicePolicy'], 'mixedCompute':rows[0]['mixedCompute'],
                           'tinyReceiverJobSeconds':[sum(job['seconds'] for job in row['jobs'] if job['target'].startswith(('Spatial receiver ', 'Static module receiver '))) for row in rows],
                           'tinyReceiverJobCount':sum(job['target'].startswith(('Spatial receiver ', 'Static module receiver ')) for job in rows[0]['jobs']),
                           'peakRSSBytes':max(row['peakRSSBytes'] for row in r['runs'])}
    for row in rows:
        for name,expected in row['outputs'].items():
            atlas_images[(mode,row['repetition'],name)]=load(Path(row['artifactDirectory'])/name,expected)
report['renderComparisons']=[];report['atlasComparisons']=[]
for mode in ['metal','hybrid']:
    for repetition in range(3):
        cpu=render_images[('cpu',repetition)];candidate=render_images[(mode,repetition)]
        metrics=difference(cpu,candidate)
        foreground=np.any(np.abs(cpu[:,:,:3]-.002428216)>1e-4,axis=2)|np.any(np.abs(candidate[:,:,:3]-.002428216)>1e-4,axis=2)
        delta=np.abs(cpu[:,:,:3]-candidate[:,:,:3]).astype(np.float64)[foreground]
        metrics['foregroundRGB']={'pixelCount':int(foreground.sum()),'rmse':float(np.sqrt(np.mean(delta**2))), 'maxAbs':float(delta.max())}
        report['renderComparisons'].append({'against':'cpu','mode':mode,'repetition':repetition,**metrics})
for mode in ['metal','hybrid','mixed']:
    for repetition in range(1,4):
        for name in ['surface-normal.png','surface-orm.png','surface-color.png']:
            report['atlasComparisons'].append({'against':'cpu','mode':mode,'repetition':repetition,'atlas':name,
                **difference(atlas_images[('cpu',repetition,name)],atlas_images[(mode,repetition,name)])})
report['status']='pass'
report['scriptSha256']=digest(Path(__file__).read_bytes())
a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(report,indent=2,allow_nan=False)+'\n')
print(json.dumps({'report':str(a.output),'render':{k:round(v['medianSeconds'],3) for k,v in report['render'].items()},'atlas':{k:round(v['medianSeconds'],3) for k,v in report['atlas'].items()}}))
