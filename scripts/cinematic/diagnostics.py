"""Bounded pass archive from a frozen cinematic scene, separate from production.

Blender 5.2 --background --factory-startup --python diagnostics.py --
--output build/cinematic/cinematic-v1 --composition desktop --frames 0,1,2.
Adds diagnostic passes to an in-memory scene only; never changes its source blend.
"""
import argparse
import hashlib
import json
from pathlib import Path
import sys
import time

import bpy

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'assets-source/facility'))
from compute import configure
from bake_job import atomic_write


def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def write(path,value):atomic_write(path,(json.dumps(value,indent=2)+'\n').encode())


def file_node(tree,directory,name,kind):
    node=tree.nodes.new('CompositorNodeOutputFile')
    node.directory=str(directory);node.file_name=name
    node.format.media_type='MULTI_LAYER_IMAGE' if kind=='OPEN_EXR_MULTILAYER' else 'IMAGE'
    node.format.file_format=kind
    node.save_as_render=kind=='PNG'
    if hasattr(node,'use_file_extension'):node.use_file_extension=True
    # Float32 preserves every object index; half floats lose odd integers above2048.
    node.format.color_depth='32' if kind=='OPEN_EXR_MULTILAYER' else '8'
    node.format.color_mode='RGBA' if kind=='OPEN_EXR_MULTILAYER' else 'RGB'
    if kind=='OPEN_EXR_MULTILAYER':node.format.exr_codec='ZIP'
    node.file_output_items.clear()
    return node


def connect(tree,node,name,output,kind='RGBA'):
    node.file_output_items.new(kind,name)
    tree.links.new(output,node.inputs[name])


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--output',required=True,type=Path)
    p.add_argument('--composition',choices=['desktop','mobile'],default='desktop')
    p.add_argument('--frames',default='0,1,2')
    p.add_argument('--attempt',default='passes01')
    p.add_argument('--device',choices=['metal','cpu'],default='metal')
    a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);base=a.output.resolve()
    if not base.is_relative_to(ROOT/'build/cinematic'):raise ValueError('Private build directory required')
    frames=[int(v) for v in a.frames.split(',')]
    if len(frames)>3 or not frames or any(v<0 or v>299 for v in frames):raise ValueError('At most three production frames may be diagnosed')
    source=base/f'{a.composition}-cinematic-master.blend';source_hash=sha(source)
    if not a.attempt.replace('-','').isalnum():raise ValueError('Simple diagnostic attempt name required')
    dest=base/'diagnostics'/a.attempt/a.composition
    if dest.exists():raise ValueError('Diagnostic output already exists; preserve it and use a new output scene copy')
    dest.mkdir(parents=True)
    bpy.ops.wm.open_mainfile(filepath=str(source))
    scene=bpy.context.scene;device=configure(a.device,metalrt='AUTO',threads=4)
    layer=scene.view_layers[0]
    layer.cycles.denoising_store_passes=True
    layer.use_pass_normal=True;layer.use_pass_diffuse_color=True;layer.use_pass_object_index=True
    # Stable per-object index map. This is a geometric diagnostic, not a new semantic source.
    objects=sorted([o for o in scene.objects if o.type=='MESH'],key=lambda o:o.name)
    object_map={}
    for index,obj in enumerate(objects,1):
        obj.pass_index=index
        object_map[str(index)]={'name':obj.name,'equipmentId':obj.get('gnEquipmentId'),'domain':obj.get('gnDomain'),'role':obj.get('gnRole')}
    layer.update_render_passes()
    tree=scene.compositing_node_group
    render=next(n for n in tree.nodes if n.bl_idname=='CompositorNodeRLayers')
    final=next(n for n in tree.nodes if n.bl_idname=='CompositorNodeAlphaOver')
    bpy.context.view_layer.update()
    print('DIAGNOSTIC_SOCKETS '+json.dumps([s.name for s in render.outputs]),flush=True)
    exr=file_node(tree,dest,'passes-','OPEN_EXR_MULTILAYER')
    for name in ['Image','Noisy Image','Denoising Normal','Denoising Albedo','Normal','Diffuse Color']:
        connect(tree,exr,name.replace(' ','_'),render.outputs[name])
    connect(tree,exr,'Object_Index',render.outputs['Object Index'],'FLOAT')
    raw=tree.nodes.new('CompositorNodeAlphaOver')
    raw.inputs['Background'].default_value=final.inputs['Background'].default_value
    raw.inputs['Factor'].default_value=1
    tree.links.new(render.outputs['Noisy Image'],raw.inputs['Foreground'])
    png=file_node(tree,dest,'comparison-','PNG')
    connect(tree,png,'raw',raw.outputs['Image']);connect(tree,png,'denoised',final.outputs['Image'])
    report={'version':'cinematic-diagnostics.v1','status':'running','sourceBlend':str(source),'sourceBlendSha256':source_hash,
      'diagnosticScriptSha256':sha(__file__),'composition':a.composition,'device':device,
      'samples':scene.cycles.samples,'adaptiveThreshold':scene.cycles.adaptive_threshold,
      'passNames':[item.name for item in exr.file_output_items],
      'objectIndexMap':object_map,'frames':[],
      'limitations':['Object Index pass is not antialiased; use for inspection, not final compositing edges.',
       'Raw and denoised beauty share the same render samples. PNG comparisons use the production grade and background.',
       'This small diagnostic archive is separate from the 300-frame production receipt identities.']}
    write(dest/'report.json',report)
    for frame in frames:
        exr.file_name=f'passes-{frame:04d}'
        png.file_name=f'comparison-{frame:04d}-'
        scene.frame_set(frame);before=time.perf_counter();bpy.ops.render.render();elapsed=time.perf_counter()-before
        report['frames'].append({'frame':frame,'seconds':elapsed});write(dest/'report.json',report)
    files=sorted(path for path in dest.iterdir() if path.suffix in ['.png','.exr'])
    if len(files)!=len(frames)*3:raise ValueError(f'Unexpected diagnostic output count: {len(files)}')
    report['files']=[{'file':path.name,'bytes':path.stat().st_size,'sha256':sha(path)} for path in files]
    report['sourceBlendUnmodified']=sha(source)==source_hash
    report['status']='complete';write(dest/'report.json',report)
    print('DIAGNOSTIC_COMPLETE '+json.dumps({'files':len(files),'frames':frames,'sourceUnmodified':report['sourceBlendUnmodified']}),flush=True)


if __name__=='__main__':main()
