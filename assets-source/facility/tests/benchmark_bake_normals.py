"""Explicit GPU-lease job: physically asymmetric normal-bake and cache benchmark.

This is not part of CPU unit discovery. It renders only temporary test planes,
never opens a facility master or publishes an atlas.
"""
import argparse
import json
from pathlib import Path
import sys
import time

import bpy
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import surface_bake as surface
from bake_job import BakeCache, atomic_write, projection_settings
from compute import configure


def run(output,device):
    output=Path(output).resolve();output.mkdir(parents=True,exist_ok=True)
    started=time.perf_counter();compute=configure(device)
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    scene=bpy.context.scene;scene.cycles.samples=64;scene.cycles.seed=19
    scene.cycles.use_adaptive_sampling=False;scene.cycles.use_denoising=False
    collection=bpy.data.collections.new('Metric normal fixtures');scene.collection.children.link(collection)
    mat=bpy.data.materials.new('Metric normal fixture');mat.use_nodes=True
    surface.BAKE_CACHE=BakeCache(output/'cache');surface.BAKE_JOBS=[];checks=[]
    fixtures=[('u',.018,0.,False),('v',0.,.016,False),('asymmetric',.018,.006,False),('rotated',.018,.006,True)]
    for name,du,dv,rotated in fixtures:
        width,height=.3,.2
        low=surface.plane('Fixture low '+name,(0,0,width,height),0,collection,mat)
        if rotated:
            for item,uv in zip(low.data.uv_layers.active.data,[(0,0),(0,1),(1,1),(1,0)]):item.uv=uv
        vertices=[(u*width,v*height,.003+du*u+dv*v) for u,v in [(0,0),(1,0),(1,1),(0,1)]]
        mesh=bpy.data.meshes.new('Fixture high '+name);mesh.from_pydata(vertices,[],[(0,1,2,3)])
        high=bpy.data.objects.new(mesh.name,mesh);collection.objects.link(high)
        projection=projection_settings(min(v[2] for v in vertices),max(v[2] for v in vertices))
        img=surface.image('Metric fixture '+name,32,32)
        result=surface.bake(low,img,'NORMAL',high,projection)
        repeat=surface.bake(low,img,'NORMAL',high,projection)
        if not surface.BAKE_JOBS[-1]['cacheHit'] or not np.array_equal(result,repeat):raise AssertionError('Exact repeated fixture did not hit verified cache')
        expected=np.array([-du/width,-dv/height,1.],dtype=np.float64);expected/=np.linalg.norm(expected)
        if rotated:expected=expected[[1,0,2]]
        decoded=result[4:-4,4:-4,:3]*2-1
        measured=decoded.mean(axis=(0,1));measured/=np.linalg.norm(measured)
        error=float(np.max(np.abs(measured-expected)))
        if error>.012:raise AssertionError(f'{name} normal slope/handedness mismatch: {measured} != {expected}')
        checks.append({'name':name,'metricSize':[width,height],'heightDerivative':[du/width,dv/height],
                       'expectedTangentNormal':expected.tolist(),'measuredTangentNormal':measured.tolist(),
                       'maxComponentError':error,'cacheBitIdentical':True,'projection':projection})
        for obj in (high,low):
            data=obj.data;bpy.data.objects.remove(obj,do_unlink=True)
            if not data.users:bpy.data.meshes.remove(data)
        bpy.data.images.remove(img)
    report={'result':'passed','compute':compute,'checks':checks,'jobs':surface.BAKE_JOBS,
            'seconds':time.perf_counter()-started,'writesCanonicalAssets':False,
            'scope':'Asymmetric physical slopes and explicit rotated UV basis; no claim of whole-asset visual approval'}
    atomic_write(output/'report.json',(json.dumps(report,indent=2)+'\n').encode())
    print('METRIC_NORMAL_BENCHMARK '+json.dumps({'result':'passed','fixtures':len(checks),'seconds':report['seconds']}))


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--out',required=True);parser.add_argument('--device',choices=['cpu','metal','hybrid'],default='metal')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:]);run(args.out,args.device)
