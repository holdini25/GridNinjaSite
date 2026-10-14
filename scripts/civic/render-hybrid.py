"""Private native plates for civic hybrid artwork; run through run-hybrid.py."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import resource
import sys
import time

import bpy

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'assets-source/civic/hybrid-v2/scene.py'
sys.path.insert(0, str(ROOT / 'assets-source/facility'))
from compute import configure


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def write(path, value):
    path.write_text(json.dumps(value, indent=2, allow_nan=False)+'\n')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--mode',choices=['studies','final','reference'],default='studies')
    parser.add_argument('--family',choices=['all','A-shared-landscape','B-grounded-architecture','C-civic-landscape'],default='all')
    parser.add_argument('--composition',choices=['all','landscape','portrait'],default='all')
    parser.add_argument('--samples',type=int)
    parser.add_argument('--lighting',choices=['balanced-blue-hour','warm-horizon','cool-overcast'],default='balanced-blue-hour')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    output=args.output.resolve()
    if not output.is_relative_to(ROOT/'build/civic-hybrid'):raise ValueError('Private output under build/civic-hybrid required')
    if args.mode!='studies' and args.family=='all':raise ValueError('Reviewed family required')
    samples=args.samples or {'studies':32,'final':256,'reference':512}[args.mode]
    if samples<1 or samples>512:raise ValueError('Bounded sample count required')
    output.mkdir(parents=True,exist_ok=True)
    report_path=output/'render-record.json'
    if report_path.exists():raise ValueError('Fresh immutable output directory required')
    sources={str(p.relative_to(ROOT)):sha(p) for p in [SOURCE,Path(__file__),ROOT/'scripts/civic/run-hybrid.py',ROOT/'assets-source/facility/compute.py']}
    spec=importlib.util.spec_from_file_location('civic_hybrid_scene',SOURCE)
    art=importlib.util.module_from_spec(spec);spec.loader.exec_module(art)
    started=time.time();geometry=art.build(args.lighting);scene=bpy.context.scene
    device=configure('metal',threads=4)
    scene.cycles.samples=samples;scene.cycles.use_adaptive_sampling=True
    scene.cycles.adaptive_threshold=.02 if args.mode=='studies' else .005
    scene.cycles.use_denoising=True;scene.cycles.denoiser='OPENIMAGEDENOISE'
    if hasattr(scene.cycles,'denoising_use_gpu'):scene.cycles.denoising_use_gpu=True
    scene.cycles.max_bounces=6;scene.cycles.diffuse_bounces=3;scene.cycles.glossy_bounces=3
    scene.cycles.transparent_max_bounces=6
    scene.cycles.seed=art.SEED
    scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB';scene.render.image_settings.color_depth='16'
    families=list(art.CAMERAS) if args.family=='all' else [args.family]
    compositions=['landscape','portrait'] if args.composition=='all' else [args.composition]
    dims={'landscape':[960,540],'portrait':[600,720]} if args.mode=='studies' else {'landscape':[3840,2160],'portrait':[1360,1632]}
    # The saved .blend includes all six usable cameras, not only the last render.
    for family in art.CAMERAS:
        for comp in ['landscape','portrait']:art.set_camera(scene,family,comp,*dims[comp])
    art.set_camera(scene,families[0],compositions[0],*dims[compositions[0]])
    scene_path=output/'civic-scene.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(scene_path),compress=True)
    report={'schema':'gridninja.civic-native.v2','status':'running','mode':args.mode,'blenderVersion':bpy.app.version_string,'blenderBuild':bpy.app.build_hash.decode(),'engine':'CYCLES','device':'METAL','compute':device,'startedUnix':started,'sourceHashes':sources,'geometry':geometry,'scene':str(scene_path.relative_to(ROOT)),'sceneSha256':sha(scene_path),'settings':{'samples':samples,'adaptiveThreshold':scene.cycles.adaptive_threshold,'seed':art.SEED,'maxBounces':scene.cycles.max_bounces,'denoising':'OPENIMAGEDENOISE','gpuDenoisingRequested':getattr(scene.cycles,'denoising_use_gpu',None),'color':{'viewTransform':scene.view_settings.view_transform,'look':scene.view_settings.look,'exposure':scene.view_settings.exposure,'display':scene.display_settings.display_device,'png':'16-bit display-referred RGB sRGB','exr':'32-bit float scene-linear RGBA'}} ,'images':[]}
    write(report_path,report)
    for family in families:
        for comp in compositions:
            folder=output/family;folder.mkdir(exist_ok=True)
            camera=art.set_camera(scene,family,comp,*dims[comp]);path=folder/(comp+'.png')
            scene.render.filepath=str(path)
            before=time.time();bpy.ops.render.render(write_still=True)
            row={'family':family,'composition':comp,'camera':scene.camera.name,'cameraSettings':camera,'path':str(path.relative_to(ROOT)),'sha256':sha(path),'width':dims[comp][0],'height':dims[comp][1],'renderSeconds':time.time()-before,'pngBytes':path.stat().st_size}
            if args.mode!='studies':
                exr=folder/(comp+'.exr')
                scene.render.image_settings.file_format='OPEN_EXR';scene.render.image_settings.color_depth='32';scene.render.image_settings.color_mode='RGBA';scene.render.image_settings.exr_codec='ZIP'
                bpy.data.images['Render Result'].save_render(str(exr),scene=scene)
                row.update(exr=str(exr.relative_to(ROOT)),exrSha256=sha(exr),exrBytes=exr.stat().st_size)
                scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_depth='16';scene.render.image_settings.color_mode='RGB'
            report['images'].append(row);write(report_path,report)
            print('CIVIC_IMAGE_COMPLETE '+json.dumps(row),flush=True)
    report.update(status='complete',finishedUnix=time.time(),totalSeconds=time.time()-started,maxResidentBytes=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)
    if any(sha(ROOT/p)!=digest for p,digest in sources.items()):raise RuntimeError('Authoring source changed during render')
    write(report_path,report)


if __name__=='__main__':main()
