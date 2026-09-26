"""Validate and export the isolated EXPORT collection without changing its master."""
import gzip
import hashlib
import json
import math
import os
from pathlib import Path
import struct
import sys

import bpy
from mathutils import Vector
from bake_job import atomic_write

HERE=Path(__file__).resolve().parent
if str(HERE) not in sys.path:sys.path.insert(0,str(HERE))
REQUIRED=['GN_EXPORT','GN_PLATFORM','GN_POWER','GN_COOLING','GN_STORAGE','GN_WORKLOADS',
          *[f'GN_ACCENT_{key}' for key in ['POWER','COOLING','STORAGE','WORKLOADS']],
          *[f'GN_PICK_{key}' for key in ['POWER','COOLING','STORAGE','WORKLOADS']],
          *[f'GN_FAN_ROTOR_{i:02d}' for i in range(4)],*[f'GN_LED_{i:02d}' for i in range(48)]]


def share_texture_descriptors(raw):
    """Intern identical texture/sampler descriptors while preserving GLB buffers.

    Blender can emit a separate texture descriptor per material for the same
    shared atlas. glTFLoader caches by descriptor index, so this otherwise
    duplicates GPU allocations even though the embedded image bytes are shared.
    """
    length=struct.unpack_from('<I',raw,12)[0]
    data=json.loads(raw[20:20+length])
    unique=[];indices={};remap={}
    for index,texture in enumerate(data.get('textures',[])):
        key=json.dumps(texture,sort_keys=True,separators=(',',':'))
        if key not in indices:indices[key]=len(unique);unique.append(texture)
        remap[index]=indices[key]
    def rewrite(value):
        if isinstance(value,dict):
            for key,entry in value.items():
                if key.endswith('Texture') and isinstance(entry,dict) and 'index' in entry:entry['index']=remap[entry['index']]
                else:rewrite(entry)
        elif isinstance(value,list):
            for entry in value:rewrite(entry)
    rewrite(data.get('materials',[]));data['textures']=unique
    encoded=json.dumps(data,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
    binary=raw[20+length:]
    return struct.pack('<III',0x46546c67,2,20+len(encoded)+len(binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+binary


def share_buffer_views(raw):
    """Losslessly intern identical typed buffer views with four-byte alignment.

    Reuses complete byte-identical views only when target/stride/metadata match;
    all accessor offsets, component types and corner/semantic values stay exact.
    """
    length=struct.unpack_from('<I',raw,12)[0]
    data=json.loads(raw[20:20+length]);source=raw[28+length:]
    binary=bytearray();views=[];remap={};seen={}
    element_strides={}
    for accessor in data['accessors']:
        if 'bufferView' not in accessor:continue
        view_index=accessor['bufferView'];view=data['bufferViews'][view_index]
        if view.get('target')!=34962:continue
        arity={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[accessor['type']]
        component={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4}[accessor['componentType']]
        element_strides[view_index]=view.get('byteStride',arity*component)
    for index,view in enumerate(data['bufferViews']):
        payload=source[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]
        descriptor={k:v for k,v in view.items() if k not in {'byteOffset','buffer'}}
        key=(json.dumps(descriptor,sort_keys=True,separators=(',',':')),element_strides.get(index),payload)
        if key not in seen:
            binary.extend(b'\0'*((-len(binary))%4));seen[key]=len(views)
            views.append({**descriptor,'buffer':0,'byteOffset':len(binary)})
            binary.extend(payload)
        elif index in element_strides:
            # glTF requires an explicit stride when multiple vertex accessors
            # reference one view, even when their byte arrays coincide exactly.
            views[seen[key]]['byteStride']=element_strides[index]
        remap[index]=seen[key]
    for accessor in data.get('accessors',[]):
        if 'bufferView' in accessor:accessor['bufferView']=remap[accessor['bufferView']]
        if accessor.get('sparse'):
            for key in ['indices','values']:accessor['sparse'][key]['bufferView']=remap[accessor['sparse'][key]['bufferView']]
    for image in data.get('images',[]):
        if 'bufferView' in image:image['bufferView']=remap[image['bufferView']]
    # Complete-view interning misses constant semantic buffers and repeated
    # structural index sequences whose exact bytes occupy a subrange of a
    # larger view. Reuse those bytes without changing any accessor/attribute.
    # Matching requires identical view metadata and four-byte alignment.
    shared=bytearray();shared_views=[None]*len(views);groups={}
    for index in sorted(range(len(views)),key=lambda i:views[i]['byteLength'],reverse=True):
        view=views[index];payload=bytes(binary[view['byteOffset']:view['byteOffset']+view['byteLength']])
        key=json.dumps({k:v for k,v in view.items() if k not in {'buffer','byteOffset','byteLength'}},sort_keys=True,separators=(',',':'))
        found=None
        for previous,offset in groups.get(key,[]):
            match=previous.find(payload)
            while match>=0 and match%4:match=previous.find(payload,match+1)
            if match>=0:found=offset+match;break
        if found is None:
            shared.extend(b'\0'*((-len(shared))%4));found=len(shared);shared.extend(payload)
            groups.setdefault(key,[]).append((payload,found))
        shared_views[index]={**view,'byteOffset':found}
    binary=shared
    data['bufferViews']=shared_views;data['buffers'][0]['byteLength']=len(binary)
    encoded=json.dumps(data,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
    binary.extend(b'\0'*((-len(binary))%4))
    return struct.pack('<III',0x46546c67,2,28+len(encoded)+len(binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+binary


def weld_exact_vertices(raw):
    """Losslessly weld only complete byte-identical corner/semantic tuples.

    A coordinate match alone is insufficient: UV seams, custom normals,
    tangents, equipment indices and signed route distances all participate.
    Primitive order and triangle winding remain unchanged.
    """
    length=struct.unpack_from('<I',raw,12)[0]
    data=json.loads(raw[20:20+length]);source=raw[28+length:]
    binary=bytearray();views=[];accessors=[]
    types={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}
    sizes={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4}
    def values(index):
        a=data['accessors'][index];v=data['bufferViews'][a['bufferView']]
        size=types[a['type']]*sizes[a['componentType']];stride=v.get('byteStride',size)
        start=v.get('byteOffset',0)+a.get('byteOffset',0)
        return [source[start+i*stride:start+i*stride+size] for i in range(a['count'])]
    def append(payload,target=None):
        binary.extend(b'\0'*((-len(binary))%4));view={'buffer':0,'byteOffset':len(binary),'byteLength':len(payload)}
        if target:view['target']=target
        views.append(view);binary.extend(payload);return len(views)-1
    for mesh in data['meshes']:
        for primitive in mesh['primitives']:
            names=sorted(primitive['attributes']);channels=[values(primitive['attributes'][name]) for name in names]
            unique={};remap=[];retained=[]
            for i,packet in enumerate(zip(*channels)):
                if packet not in unique:unique[packet]=len(retained);retained.append(i)
                remap.append(unique[packet])
            for name,channel in zip(names,channels):
                previous=data['accessors'][primitive['attributes'][name]]
                accessor={k:v for k,v in previous.items() if k not in {'bufferView','byteOffset','count'}}
                accessor.update(bufferView=append(b''.join(channel[i] for i in retained),34962),count=len(retained))
                primitive['attributes'][name]=len(accessors);accessors.append(accessor)
            previous=data['accessors'][primitive['indices']];fmt={5121:'<B',5123:'<H',5125:'<I'}[previous['componentType']]
            raw_indices=[remap[struct.unpack(fmt,v)[0]] for v in values(primitive['indices'])]
            positions=[struct.unpack('<fff',channels[names.index('POSITION')][i]) for i in retained]
            indices=[]
            for start in range(0,len(raw_indices),3):
                tri=raw_indices[start:start+3]
                if len(set(tri))<3:continue
                a,b,c=[positions[i] for i in tri];u=[b[k]-a[k] for k in range(3)];v=[c[k]-a[k] for k in range(3)]
                cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
                if all(value==0 for value in cross):continue
                indices.extend(tri)
            component=5123 if max(indices)<65536 else 5125;fmt='<H' if component==5123 else '<I'
            accessor={'bufferView':append(b''.join(struct.pack(fmt,i) for i in indices),34963),'componentType':component,'count':len(indices),'type':'SCALAR'}
            primitive['indices']=len(accessors);accessors.append(accessor)
    for image in data.get('images',[]):
        view=data['bufferViews'][image['bufferView']];start=view.get('byteOffset',0)
        image['bufferView']=append(source[start:start+view['byteLength']])
    data['accessors']=accessors;data['bufferViews']=views;data['buffers']=[{'byteLength':len(binary)}]
    encoded=json.dumps(data,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4);binary.extend(b'\0'*((-len(binary))%4))
    return struct.pack('<III',0x46546c67,2,28+len(encoded)+len(binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+binary


def rendered_triangles(gltf):
    return sum(gltf['accessors'][p['indices']]['count']//3 for node in gltf['nodes']
               if 'mesh' in node and node.get('extras',{}).get('gnRole')!='picking_proxy'
               for p in gltf['meshes'][node['mesh']]['primitives'])


def finish_surfaces(raw):
    """Attach tangent bases only to normal-mapped primitives, never globally.

    The normal-mapped surfaces are planar authored atlas receivers. Explicit
    triangle UV derivatives and retained corner normals define their tangent
    basis; untextured mechanical bevels incur no tangent allocation.
    """
    import numpy as np
    length=struct.unpack_from('<I',raw,12)[0]
    data=json.loads(raw[20:20+length]);binary=bytearray(raw[28+length:])
    def values(index):
        a=data['accessors'][index];v=data['bufferViews'][a['bufferView']]
        arity={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
        dtype={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']]
        item=np.dtype(dtype).itemsize;offset=v.get('byteOffset',0)+a.get('byteOffset',0)
        return np.ndarray((a['count'],arity),dtype=dtype,buffer=binary,offset=offset,
                          strides=(v.get('byteStride',arity*item),item)).copy()
    for mat in data.get('materials',[]):
        if mat.get('extras',{}).get('gnCutoutMinFeatureTexels'):
            mat['alphaMode']='MASK';mat['alphaCutoff']=.5
        else:
            mat.pop('alphaMode',None);mat.pop('alphaCutoff',None)
        mat['doubleSided']=False
        # Blender's generic MixRGB multiply is not reliably recognized as a
        # glTF baseColorFactor. Preserve the authored linear palette explicitly.
        authored=bpy.data.materials.get(mat['name'])
        if authored is None:raise ValueError('Missing authored material '+mat['name'])
        mat.setdefault('pbrMetallicRoughness',{})['baseColorFactor']=[round(v,8) for v in authored.diffuse_color]
    for mesh in data.get('meshes',[]):
        for primitive in mesh['primitives']:
            mat=data['materials'][primitive['material']]
            if not mat.get('normalTexture'):continue
            a=primitive['attributes'];p=values(a['POSITION']);uv=values(a['TEXCOORD_0']);normals=values(a['NORMAL'])
            if not all(np.isfinite(channel).all() for channel in (p,uv,normals)):
                raise ValueError('Nonfinite normal-mapped receiver attribute')
            if np.any(np.abs(np.linalg.norm(normals,axis=1)-1)>.002):
                raise ValueError('Normal-mapped receiver corner normals must be unit length')
            tri=values(primitive['indices']).reshape(-1,3);tan=np.zeros_like(p);bitan=np.zeros_like(p)
            for ia,ib,ic in tri:
                e1=p[ib]-p[ia];e2=p[ic]-p[ia];d1=uv[ib]-uv[ia];d2=uv[ic]-uv[ia]
                det=d1[0]*d2[1]-d1[1]*d2[0]
                if abs(det)<1e-10:raise ValueError('Normal-mapped receiver has degenerate UVs')
                t=(e1*d2[1]-e2*d1[1])/det;b=(e2*d1[0]-e1*d2[0])/det
                for index in [ia,ib,ic]:tan[index]+=t;bitan[index]+=b
            tan-=normals*np.sum(normals*tan,axis=1)[:,None]
            norms=np.linalg.norm(tan,axis=1)
            if np.any(norms<1e-8):raise ValueError('Invalid authored tangent basis')
            tan/=norms[:,None]
            sign=np.where(np.sum(np.cross(normals,tan)*bitan,axis=1)<0,-1,1)
            if not np.isfinite(tan).all() or np.any(np.abs(np.sum(normals*tan,axis=1))>.002):
                raise ValueError('Tangent orthogonality was lost')
            packed=np.column_stack((tan,sign)).astype('<f4').tobytes()
            binary.extend(b'\0'*((-len(binary))%4));offset=len(binary);binary.extend(packed)
            view=len(data['bufferViews']);data['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(packed),'target':34962})
            accessor=len(data['accessors']);data['accessors'].append({'bufferView':view,'componentType':5126,'count':len(p),'type':'VEC4'})
            a['TANGENT']=accessor
    data['buffers'][0]['byteLength']=len(binary)
    encoded=json.dumps(data,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
    binary.extend(b'\0'*((-len(binary))%4))
    return struct.pack('<III',0x46546c67,2,28+len(encoded)+len(binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+binary


def embedded_images(raw):
    length=struct.unpack_from('<I',raw,12)[0];data=json.loads(raw[20:20+length]);start=28+length
    return [{'name':image.get('name'),'bytes':data['bufferViews'][image['bufferView']]['byteLength'],
             'sha256':hashlib.sha256(raw[start+data['bufferViews'][image['bufferView']].get('byteOffset',0):start+data['bufferViews'][image['bufferView']].get('byteOffset',0)+data['bufferViews'][image['bufferView']]['byteLength']]).hexdigest()} for image in data.get('images',[])]


def export_scene(destination):
    destination=Path(destination)
    objects=list(bpy.data.collections['EXPORT'].objects)
    ids={obj.get('gnId'):obj for obj in objects if obj.get('gnId')}
    if len(ids)!=sum(bool(obj.get('gnId')) for obj in objects):raise ValueError('Duplicate semantic identity')
    if set(REQUIRED)-ids.keys():raise ValueError(f'Missing: {set(REQUIRED)-ids.keys()}')
    root=ids['GN_EXPORT']
    if root.parent or any(abs(root.matrix_world[i][j]-(1 if i==j else 0))>1e-7 for i in range(4) for j in range(4)):
        raise ValueError('GN_EXPORT must have identity world transform')
    triangles=0;draws=0;materials=set();points=[]
    for obj in objects:
        ancestor=obj
        while ancestor.parent:ancestor=ancestor.parent
        if ancestor!=root:raise ValueError(f'Outside root: {obj.name}')
        if obj.type=='MESH' and obj.get('gnRole')!='picking_proxy':
            if obj.modifiers:raise ValueError('Export modifier was not baked')
            obj.data.calc_loop_triangles();triangles+=len(obj.data.loop_triangles)
            draws+=len(obj.data.materials)
            materials.update(mat.name for mat in obj.data.materials)
            points.extend([obj.matrix_world@v.co for v in obj.data.vertices])
    if triangles>40000 or draws+1>39 or len(materials)+1>10:raise ValueError('Overview authoring budget exceeded')
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:obj.select_set(True)
    bpy.context.view_layer.objects.active=root
    destination.parent.mkdir(parents=True,exist_ok=True)
    temporary=destination.with_name('.'+destination.stem+f'.{os.getpid()}.tmp.glb')
    try:
        bpy.ops.export_scene.gltf(filepath=str(temporary),export_format='GLB',use_selection=True,
            export_extras=True,export_yup=True,export_animations=False,export_cameras=False,
            export_lights=False,export_apply=False,export_materials='EXPORT',export_gpu_instances=False,
            export_texcoords=True,export_normals=True,export_tangents=False,export_attributes=True)
        raw=share_buffer_views(weld_exact_vertices(finish_surfaces(share_texture_descriptors(temporary.read_bytes()))))
    finally:temporary.unlink(missing_ok=True)
    if len(raw)>2500000:raise ValueError(f'GLB too large: {len(raw)}')
    length=struct.unpack_from('<I',raw,12)[0]
    gltf=json.loads(raw[20:20+length])
    exported={node.get('extras',{}).get('gnId'):node for node in gltf['nodes'] if node.get('extras',{}).get('gnId')}
    if set(REQUIRED)-exported.keys():raise ValueError('Exporter lost identities')
    atomic_write(destination,raw)
    # glTF exporter remaps Blender position (x,y,z) to (x,z,-y); fan geometry is baked in local Y-up.
    bounds={'min':[min(p.x for p in points),min(p.z for p in points),-max(p.y for p in points)],
            'max':[max(p.x for p in points),max(p.z for p in points),-min(p.y for p in points)]}
    profile=json.loads((HERE/'render-profile.json').read_text())
    motion=profile.get('motion',{})
    report={'schemaVersion':1,'blenderVersion':bpy.app.version_string,
        'blenderBuildHash':bpy.app.build_hash.decode(),'source':'assets-source/facility/facility-master.blend',
        'sourceSha256':hashlib.sha256((HERE/'facility-master.blend').read_bytes()).hexdigest(),
        'generatorSha256':hashlib.sha256((HERE/'generate.py').read_bytes()).hexdigest(),
        'exportBytes':len(raw),'gzipBytes':len(gzip.compress(raw,compresslevel=9,mtime=0)),'gzipLevel':9,
        'sha256':hashlib.sha256(raw).hexdigest(),'authoredTriangles':triangles,'renderedTriangles':rendered_triangles(gltf),'meshDrawCalls':draws,
        'drawCallsWithLedInstances':draws+1,'materials':sorted(materials),'materialCount':len(materials),
        'meshCount':len(gltf.get('meshes',[])),'bounds':bounds,
        'textureDescriptorCount':len(gltf.get('textures',[])),
        'embeddedImages':embedded_images(raw),
        'expectedRuntimeMaterials':len(materials)+1,
        'rackKit':{'envelopeMetres':[.78,1.24,2.55],'overviewDoorSkin':'omitted for readable recessed module construction','specimenDoorSkin':'MASK over a real recessed module bank','branding':'GN only; inventory identity belongs to semantic metadata'},
        'sourceModules':__import__('engineering_metadata').source_modules(HERE),
        'semanticIds':sorted(exported),
        'fanBindings':[{'gnId':f'GN_FAN_ROTOR_{i:02d}','axisLocal':[0,1,0],
                        'visualRadiansPerSecond':motion.get('fanRadiansPerSecond',1.6),
                        'phaseOffsetRadians':motion.get('fanPhaseOffsets',[0,0,0,0])[i]} for i in range(4)],
        'ledBindings':[{'gnId':f'GN_LED_{i:02d}','domain':'workloads'} for i in range(48)],
        'profile':profile,
        'notes':['Synthetic equipment relationships, not an engineering design or capacity model.',
                 'Static meshes are merged per subsystem and material; fans and LED anchors retain independent identities.',
                 'Picking proxies must be excluded from render passes by the browser asset factory.',
                 'No animation, compression extension, external texture, or decoder dependency.',
                 'Khronos and browser-render validation are separate release gates.']}
    atomic_write(destination.parent/'asset-report.json',(json.dumps(report,indent=2)+'\n').encode())
    atomic_write(HERE/'toolchain.json',(json.dumps({'blender':bpy.app.version_string,'buildHash':bpy.app.build_hash.decode(),
        'platform':'macOS arm64','units':'metres','exportAxis':'glTF Y-up','format':'GLB 2.0',
        'compressionExtensions':[],'dependencies':'Blender bundled Python and glTF exporter only'},indent=2)+'\n').encode())
    print('FACILITY_EXPORT '+json.dumps({k:v for k,v in report.items() if k not in ['semanticIds','ledBindings','notes']}))
    return report


if __name__=='__main__':
    import argparse
    if bpy.app.version!=(5,2,2) or bpy.app.build_hash.decode()!='d13f752e3b9c':
        raise RuntimeError('Use pinned Blender 5.2.2 LTS build d13f752e3b9c for reproducible exports')
    parser=argparse.ArgumentParser();parser.add_argument('--out',required=True)
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    lock=HERE/'generation.lock'
    descriptor=os.open(lock,os.O_CREAT|os.O_EXCL|os.O_WRONLY)
    try:
        os.write(descriptor,json.dumps({'pid':os.getpid(),'operation':'export'}).encode())
        export_scene(args.out)
    finally:
        os.close(descriptor)
        lock.unlink(missing_ok=True)
