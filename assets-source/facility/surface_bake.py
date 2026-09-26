"""Cycles-baked normal/occlusion atlas; all images remain inspectable PNGs.

The lower atlas contains actual ray-traced ambient occlusion of the foundation,
rack plinth and reusable spatial construction receivers. Upper tiles contain selected-to-active bakes of
high-detail grille/coil surfaces. Rotors and picking proxies never occlude AO.
This is visual occlusion only, not thermal, airflow or capacity simulation.
"""
import hashlib
import io
import json
import math
import os
from pathlib import Path
import resource
import sys
import time

import bpy
import numpy as np
from bake_job import BakeCache, atomic_write, canonical_bytes, fingerprint, projection_settings

HERE=Path(__file__).resolve().parent
from surface_contract import SIZE, GUTTER, REVISION as SURFACE_REVISION, NOISE_SEED_NAMESPACE, TILES as CONTRACT_TILES, METRES as CONTRACT_METRES, reviewed_finishes, surface_spec, tile_uv
TILES=dict(CONTRACT_TILES)
METRES=dict(CONTRACT_METRES)
PAINT_ROUGHNESS=float(json.loads((HERE/'scene.json').read_text())['surfaceBake'].get('paintRoughness',.42))
FINISHES=reviewed_finishes(PAINT_ROUGHNESS)
BAKE_CACHE = None
BAKE_JOBS = []


def motion_group(obj):
    """Explicit authoring tags win; old articulated roots remain fail-safe."""
    current = obj
    moving = {'GN_RACK_DOOR', 'GN_RACK_TRAY', 'GN_RACK_PANEL', 'GN_COOLER_PANEL', 'GN_AIR_SECTION_COVERS'}
    while current:
        if current.get('gnMotionGroup'): return str(current['gnMotionGroup'])
        if current.get('gnId') in moving or current.get('gnRole') == 'fan_rotor':
            return str(current.get('gnId', current.name))
        current = current.parent
    return 'static'


def node_tree_fingerprint(tree):
    if not tree: return None
    def value(item):
        if item is None or isinstance(item,(str,bool,int,float)): return item
        try: return [value(part) for part in item]
        except TypeError: return {'type':type(item).__name__,'name':getattr(item,'name',None)}
    nodes=[]
    def scalar_properties(item):
        return {prop.identifier:value(getattr(item,prop.identifier)) for prop in item.bl_rna.properties
                if prop.type in {'BOOLEAN','INT','FLOAT','STRING','ENUM'} and prop.identifier not in {'rna_type'}
                and hasattr(item,prop.identifier)}
    for node in sorted(tree.nodes,key=lambda node:node.name):
        if node.name=='Bake destination':continue
        entry={'name':node.name,'type':node.bl_idname,'properties':scalar_properties(node),
               'inputs':[(socket.identifier,value(socket.default_value)) for socket in node.inputs if hasattr(socket,'default_value')]}
        if node.type=='TEX_IMAGE' and node.image:
            img=node.image
            encoded=bytes(img.packed_file.data) if img.packed_file and not img.is_dirty else np.asarray(pixels(img),dtype='<f4').tobytes()
            entry['image']={'sha256':hashlib.sha256(encoded).hexdigest(),'size':list(img.size),
                            'colorSpace':img.colorspace_settings.name,'interpolation':node.interpolation,'extension':node.extension}
        if node.type=='GROUP':entry['group']=node_tree_fingerprint(node.node_tree)
        if hasattr(node,'color_ramp'):
            entry['ramp']={'properties':scalar_properties(node.color_ramp),
                           'elements':[{'position':element.position,'color':list(element.color)} for element in node.color_ramp.elements]}
        if hasattr(node,'mapping') and hasattr(node.mapping,'curves'):
            entry['mapping']={'properties':scalar_properties(node.mapping),
                              'curves':[[{'location':list(point.location),'handleType':point.handle_type} for point in curve.points]
                                        for curve in node.mapping.curves]}
        for setting in ('texture_mapping','color_mapping','image_user'):
            if hasattr(node,setting):entry[setting]=scalar_properties(getattr(node,setting))
        nodes.append(entry)
    return fingerprint({'nodes':nodes,'links':sorted((link.from_node.name,link.from_socket.identifier,link.to_node.name,link.to_socket.identifier)
                       for link in tree.links if link.from_node.name!='Bake destination' and link.to_node.name!='Bake destination')})


def geometry_fingerprint(obj, graph, material_cache=None):
    """Hash evaluated topology, normals, UV seams, semantics and transforms."""
    evaluated = obj.evaluated_get(graph); mesh = evaluated.to_mesh()
    try:
        digest = hashlib.sha256()
        def channel(name, values):
            digest.update(name.encode()); digest.update(canonical_bytes(values))
        channel('positions', [list(vertex.co) for vertex in mesh.vertices])
        channel('polygons', [{'vertices':list(face.vertices),'material':face.material_index,'smooth':face.use_smooth} for face in mesh.polygons])
        channel('normals', [list(item.vector) for item in mesh.corner_normals])
        channel('uv', {layer.name: [list(item.uv) for item in layer.data] for layer in mesh.uv_layers})
        channel('semantics', {attribute.name:{'domain':attribute.domain,'type':attribute.data_type,
                                              'values':[item.value for item in attribute.data]}
                              for attribute in mesh.attributes if attribute.name.startswith('_GN_')})
        channel('transform', [list(row) for row in obj.matrix_world])
        channel('rayVisibility',{name:getattr(obj,name) for name in ('visible_camera','visible_diffuse','visible_glossy','visible_transmission','visible_volume_scatter','visible_shadow') if hasattr(obj,name)})
        if material_cache is None:material_cache={}
        for material in mesh.materials:
            if material and material.name not in material_cache:
                material_cache[material.name]={'name':material.name,'color':list(material.diffuse_color),
                                              'metallic':material.metallic,'roughness':material.roughness,
                                              'nodes':node_tree_fingerprint(material.node_tree)}
        channel('materials',[material_cache[material.name] for material in mesh.materials if material])
        channel('surface', {key: obj[key] for key in obj.keys() if key.startswith(('gnSurface', 'gnBake', 'gnMotion', 'gnEquipment', 'gnRoute'))})
        return digest.hexdigest()
    finally: evaluated.to_mesh_clear()


def save_image_atomic(img, path):
    path = Path(path); path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name('.' + path.stem + f'.{os.getpid()}.png')
    try:
        img.filepath_raw = str(temporary); img.file_format = 'PNG'; img.save()
        optimize_png(temporary)
        atomic_write(path, temporary.read_bytes())
        img.filepath_raw = str(path); img.reload(); img.pack()
    finally: temporary.unlink(missing_ok=True)


def optimize_png(path):
    """Lossless IDAT deflate optimization; exact decoded scanlines are unchanged."""
    import struct,zlib
    raw=Path(path).read_bytes();chunks=[];payload=[];offset=8
    while offset<len(raw):
        length=struct.unpack_from('>I',raw,offset)[0];kind=raw[offset+4:offset+8]
        value=raw[offset+8:offset+8+length];offset+=length+12
        if kind==b'IDAT':payload.append(value)
        else:chunks.append((kind,value))
    scanlines=zlib.decompress(b''.join(payload));compressed=zlib.compress(scanlines,9)
    assert zlib.decompress(compressed)==scanlines
    def chunk(kind,value):return struct.pack('>I',len(value))+kind+value+struct.pack('>I',zlib.crc32(kind+value)&0xffffffff)
    result=raw[:8]
    for kind,value in chunks:
        if kind==b'IEND':result+=chunk(b'IDAT',compressed)
        result+=chunk(kind,value)
    if len(result)<len(raw):Path(path).write_bytes(result)


def image(name,width,height,alpha=False,floating=False):
    old=bpy.data.images.get(name)
    if old:bpy.data.images.remove(old)
    result=bpy.data.images.new(name,width=width,height=height,alpha=alpha,float_buffer=floating)
    result.colorspace_settings.name='Non-Color'
    return result


def plane(name,bounds,z,collection,material):
    x0,y0,x1,y1=bounds
    data=bpy.data.meshes.new(name)
    data.from_pydata([(x0,y0,z),(x1,y0,z),(x1,y1,z),(x0,y1,z)],[],[(0,1,2,3)])
    data.materials.append(material)
    uv=data.uv_layers.new(name='UVMap')
    for entry,p in zip(uv.data,[(0,0),(1,0),(1,1),(0,1)]):entry.uv=p
    obj=bpy.data.objects.new(name,data);collection.objects.link(obj)
    return obj


def pixels(img):
    data=np.empty(len(img.pixels),dtype=np.float32);img.pixels.foreach_get(data)
    return data.reshape(img.size[1],img.size[0],4)


def bake(target,img,kind,high=None,projection=None):
    bpy.ops.object.select_all(action='DESELECT')
    nodes=target.data.materials[0].node_tree.nodes
    for node in nodes:node.select=False
    tex=nodes.get('Bake destination') or nodes.new('ShaderNodeTexImage')
    tex.name='Bake destination';tex.image=img;tex.select=True;nodes.active=tex
    target.select_set(True);bpy.context.view_layer.objects.active=target
    if high:high.select_set(True)
    scene=bpy.context.scene
    scene.render.bake.use_selected_to_active=high is not None
    scene.render.bake.use_cage=False
    projection = projection or projection_settings(0., 0.)
    scene.render.bake.cage_extrusion=projection['cageExtrusionMetres']
    scene.render.bake.max_ray_distance=projection['maxRayDistanceMetres']
    scene.render.bake.normal_space='TANGENT'
    scene.render.bake.normal_r='POS_X';scene.render.bake.normal_g='POS_Y';scene.render.bake.normal_b='POS_Z'
    scene.render.bake.margin=2
    scene.render.bake.margin_type='EXTEND'
    scene.render.bake.use_clear=True
    graph = bpy.context.evaluated_depsgraph_get()
    material_cache={}
    preferences = bpy.context.preferences.addons['cycles'].preferences
    recipe = {'kind': kind, 'blender': bpy.app.version_string, 'build': bpy.app.build_hash.decode(),
              'sources': {path.name: hashlib.sha256(path.read_bytes()).hexdigest() for path in sorted(HERE.glob('*.py'))},
              'target': geometry_fingerprint(target, graph, material_cache), 'high': geometry_fingerprint(high, graph, material_cache) if high else None,
              'occluders': {obj.name: geometry_fingerprint(obj, graph, material_cache) for obj in sorted(scene.objects, key=lambda obj: obj.name)
                            if obj.type == 'MESH' and not obj.hide_render and obj != target},
              'lights': {obj.name: {'matrix': [list(row) for row in obj.matrix_world], 'type': obj.data.type,
                                   'energy': obj.data.energy, 'color': list(obj.data.color),
                                   'size': getattr(obj.data, 'size', 0.), 'sizeY': getattr(obj.data, 'size_y', 0.)}
                         for obj in scene.objects if obj.type == 'LIGHT' and not obj.hide_render},
              'size': list(img.size), 'imageFloat':img.is_float,'imageColorSpace':img.colorspace_settings.name,
              'samples': scene.cycles.samples, 'seed': scene.cycles.seed,
              'worldColor': list(scene.world.color), 'worldNodes':node_tree_fingerprint(scene.world.node_tree),'aoDistance': scene.world.light_settings.distance,
              'projection': projection, 'margin': scene.render.bake.margin,
              'useCage':scene.render.bake.use_cage,'marginType':scene.render.bake.margin_type,
              'passes': [scene.render.bake.use_pass_direct, scene.render.bake.use_pass_indirect, scene.render.bake.use_pass_color],
              'normalBasis': 'tangent:+X,+Y,+Z', 'denoising': scene.cycles.use_denoising,
              'adaptiveSampling':scene.cycles.use_adaptive_sampling,'adaptiveThreshold':scene.cycles.adaptive_threshold,
              'frame':scene.frame_current,'subframe':scene.frame_subframe,
              'metalRT':preferences.metalrt,'kernelOptimization':preferences.kernel_optimization_level,
              'cyclesDevice': scene.cycles.device, 'cpuThreads': scene.render.threads,
              'devices': [{'name': device.name, 'type': device.type} for device in preferences.devices if device.use]}
    started = time.perf_counter(); cached = BAKE_CACHE.get(recipe) if BAKE_CACHE else None
    result = None
    if cached:
        try:
            value = np.load(io.BytesIO(cached), allow_pickle=False)
            if value.dtype == np.float32 and value.shape == (img.size[1], img.size[0], 4) and np.isfinite(value).all(): result = value
        except (ValueError, OSError): pass
    hit = result is not None
    if not hit:
        if 'FINISHED' not in bpy.ops.object.bake(type=kind):raise RuntimeError('Blender did not finish the bake')
        result = pixels(img)
        if not np.isfinite(result).all(): raise ValueError('Bake produced nonfinite samples')
        if kind=='NORMAL':
            lengths=np.linalg.norm(result[:,:,:3]*2-1,axis=2)
            if np.any((lengths<.94)|(lengths>1.06)):raise ValueError('Normal bake contains projection misses or invalid vectors')
        if BAKE_CACHE:
            stream = io.BytesIO(); np.save(stream, result, allow_pickle=False); BAKE_CACHE.put(recipe, stream.getvalue())
    BAKE_JOBS.append({'target': target.name, 'kind': kind, 'key': fingerprint(recipe), 'cacheHit': hit,
                      'cacheKey':BAKE_CACHE._key(recipe) if BAKE_CACHE else None,
                      'seconds': time.perf_counter()-started, 'size': list(img.size), 'projection': projection,
                      'cyclesDevice': scene.cycles.device, 'devices': recipe['devices'],
                      'cpuThreads':scene.render.threads,
                      'processPeakRssBytes':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss*(1 if sys.platform=='darwin' else 1024)})
    return result


def detail_height(kind,u,v):
    if kind=='coil':
        # Closely spaced corrugated heat-exchanger fins with larger cross rails.
        fin=.5+.5*math.cos(v*math.tau*42)
        cross=math.exp(-((u-.13)/.018)**2)+math.exp(-((u-.87)/.018)**2)
        return .0018*fin+.006*min(1,cross)
    columns,rows={'rack_a':(14,30),'face_a':(12,5),'face_b':(5,8)}[kind]
    dx=(u*columns+(.5 if int(v*rows)%2 else 0))%1-.5
    dy=(v*rows)%1-.5
    r=math.sqrt(dx*dx+dy*dy)
    # Rounded perforation shoulders over a recessed backing field, baked into
    # a normal map instead of expanding the exported mesh into thousands of holes.
    recess=.0018*(1-max(0,min(1,(r-.22)/.13)))
    frame=.001 if min(u,1-u)<.022 or min(v,1-v)<.018 else 0
    return .003-recess+frame


def detail_geometry(kind, subdivisions=192):
    """Metric high receiver shared by the actual bake and GPU-free validation."""
    width, height = METRES[kind]
    if subdivisions < 2: raise ValueError('Detail subdivisions must be at least two')
    vertices = [(x/subdivisions*width, y/subdivisions*height,
                 detail_height(kind,x/subdivisions,y/subdivisions))
                for y in range(subdivisions+1) for x in range(subdivisions+1)]
    faces=[]
    for y in range(subdivisions):
        for x in range(subdivisions):
            a=y*(subdivisions+1)+x;faces.append((a,a+1,a+subdivisions+2,a+subdivisions+1))
    return vertices, faces


def finish_field(region, width, height):
    """Broad roughness variation in physical metres; no dirty or metallic paint."""
    spec=surface_spec(region);metres_x,metres_y=spec.metric_size
    yy,xx=np.mgrid[0:height,0:width]
    x=(xx+.5)/width*metres_x;y=(yy+.5)/height*metres_y
    phase=(spec.seed%65536)/65536*math.tau
    amplitude={'paint':.003,'rack_panel':.003,'collector':.003,'collector_top':.003,'cooler_panel':.003,
               'metal':.016,'polished':.012,'copper':.012,'rubber':.006,'polymer':.008}.get(region,0.)
    variation=.7*np.sin(x*4.9+phase)*np.cos(y*3.1-phase)+.3*np.sin((x+y)*1.3+phase)
    return np.clip(FINISHES[region][0]+amplitude*variation,0,1).astype(np.float32)


def bind(materials,normal,orm,labels=None,masked=False):
    group=bpy.data.node_groups.get('glTF Material Output')
    if not group:
        group=bpy.data.node_groups.new('glTF Material Output','ShaderNodeTree')
        group.interface.new_socket(name='Occlusion',in_out='INPUT',socket_type='NodeSocketFloat')
    for name,mat in materials.items():
        nodes=mat.node_tree.nodes;links=mat.node_tree.links
        for node in list(nodes):
            if node.type not in {'BSDF_PRINCIPLED','OUTPUT_MATERIAL'}:nodes.remove(node)
        bsdf=nodes.get('Principled BSDF')
        texture=nodes.new('ShaderNodeTexImage');texture.image=orm
        split=nodes.new('ShaderNodeSeparateColor');split.mode='RGB'
        links.new(texture.outputs['Color'],split.inputs[0])
        for channel,socket in [('Green','Roughness'),('Blue','Metallic')]:
            bsdf.inputs[socket].default_value=1.0
            links.new(split.outputs[channel],bsdf.inputs[socket])
        out=nodes.new('ShaderNodeGroup');out.node_tree=group
        links.new(split.outputs['Red'],out.inputs['Occlusion'])
        # Only actual baked grille/fin surfaces need tangent-space normals.
        # Flat painted walls use manufactured roughness and geometric bevels.
        if name=='Grille':
            texture=nodes.new('ShaderNodeTexImage');texture.image=normal
            normal_node=nodes.new('ShaderNodeNormalMap');normal_node.inputs['Strength'].default_value=.35
            links.new(texture.outputs['Color'],normal_node.inputs['Color']);links.new(normal_node.outputs['Normal'],bsdf.inputs['Normal'])
        if labels:
            texture=nodes.new('ShaderNodeTexImage');texture.image=labels
            multiply=nodes.new('ShaderNodeMixRGB');multiply.blend_type='MULTIPLY';multiply.inputs[0].default_value=1
            multiply.inputs[2].default_value=bsdf.inputs['Base Color'].default_value
            links.new(texture.outputs['Color'],multiply.inputs[1]);links.new(multiply.outputs[0],bsdf.inputs['Base Color'])
            if name=='Grille' and masked:
                links.new(texture.outputs['Alpha'],bsdf.inputs['Alpha'])
                mat['gnCutoutMinFeatureTexels']=1.0
                mat['gnCoverageAtlas']='surface-color.png'
            elif 'gnCutoutMinFeatureTexels' in mat:del mat['gnCutoutMinFeatureTexels']


def build_color_atlas(floor_light=None,spatial=None):
    """Small authored labels and geometric coverage; no photograph or fake telemetry."""
    data=np.ones((256,256,4),dtype=np.float32)
    direct_enabled=json.loads((HERE/'scene.json').read_text())['surfaceBake'].get('spatialDirectLighting',True)
    if floor_light is not None and direct_enabled:
        # Actual Cycles direct-light bake, normalized as restrained illustrative
        # service illumination. It changes no material roughness or AO channel.
        data[:128,:128,:3]=np.pad(floor_light,((4,4),(4,4),(0,0)),mode='edge')
    for region,values in (spatial or {}).items():
        x,y,w,h=TILES[region];x//=2;y//=2;w//=2;h//=2
        linear=values['color']
        encoded=np.where(linear<=.0031308,linear*12.92,1.055*np.power(linear,1/2.4)-.055)
        data[y:y+h,x:x+w,:3]=np.pad(encoded,((4,4),(4,4),(0,0)),mode='edge')
    for kind in ['rack_a','face_a','face_b']:
        x,y,w,h=TILES[kind];x//=2;y//=2;w//=2;h//=2;pad=GUTTER//2
        cols,rows={'rack_a':(14,30),'face_a':(12,5),'face_b':(5,8)}[kind]
        for yy in range(pad,h-pad):
            for xx in range(pad,w-pad):
                u=(xx-pad+.5)/(w-2*pad);v=(yy-pad+.5)/(h-2*pad)
                dx=(u*cols+(.5 if int(v*rows)%2 else 0))%1-.5;dy=(v*rows)%1-.5
                data[y+yy,x+xx,3]=0 if dx*dx+dy*dy<.30**2 else 1
    x,y,w,h=TILES['label'];x//=2;y//=2;w//=2;h//=2
    data[y+4:y+h-4,x+4:x+w-4,:3]=.08
    glyphs={'G':['01110','10000','10111','10001','01110'],'N':['10001','11001','10101','10011','10001'],'0':['01110','10011','10101','11001','01110'],'1':['00100','01100','00100','00100','01110']}
    for letter,ch in enumerate('GN'):
        for yy,row in enumerate(glyphs[ch]):
            for xx,pixel in enumerate(row):
                if pixel=='1':data[y+11+(4-yy)*2:y+13+(4-yy)*2,x+22+letter*11+xx*2:x+24+letter*11+xx*2,:3]=.85
    result=image('GN_SurfaceColor',256,256,alpha=True);result.colorspace_settings.name='sRGB'
    result.pixels.foreach_set(data.ravel());save_image_atomic(result,HERE/'surface-color.png')
    if (HERE/'surface-color.png').stat().st_size>24576:raise ValueError('Color atlas exceeds 24 KiB')
    return result


def bake_surfaces(materials,report_directory):
    global BAKE_CACHE, BAKE_JOBS
    BAKE_CACHE=BakeCache(Path(os.environ.get('GN_BAKE_CACHE_DIR',str(Path(report_directory)/'bake-cache'))))
    BAKE_JOBS=[]
    scene=bpy.context.scene
    from compute import configure
    compute=configure()
    scene.render.engine='CYCLES';scene.cycles.samples=64;scene.cycles.use_denoising=False
    scene.cycles.use_adaptive_sampling=False
    scene.cycles.seed=19
    scene.world.light_settings.distance=.75
    scratch=bpy.data.collections.new('GN_BAKE_TEMP');scene.collection.children.link(scratch)
    mat=bpy.data.materials.new('GN_BAKE_TARGET');mat.use_nodes=True
    saved_visibility={obj:obj.hide_render for obj in bpy.data.objects if obj.type=='MESH'}
    normal_data=np.ones((SIZE,SIZE,4),dtype=np.float32);normal_data[:,:,:2]=.5
    orm_data=np.ones((SIZE,SIZE,4),dtype=np.float32)
    for region,(roughness,metalness) in FINISHES.items():
        x,y,w,h=TILES[region];orm_data[y:y+h,x:x+w,1]=roughness;orm_data[y:y+h,x:x+w,2]=metalness
    stages=[];floor_light=None;spatial={}
    try:
        for obj in saved_visibility:
            if obj.get('gnRole') in {'fan_rotor','picking_proxy'} or motion_group(obj)!='static':obj.hide_render=True
        for name,bounds,z in [('floor',(-5.4,-3.8,5.4,3.8),.266),('plinth',(-3.14,-2.39,3.14,1.99),.329)]:
            target=plane('Bake '+name,bounds,z,scratch,mat)
            x,y,w,h=TILES[name]
            img=image('GN_AO_'+name,w-2*GUTTER,h-2*GUTTER)
            result=bake(target,img,'AO')
            ao=result[:,:,0]
            # A small separable filter reduces bake noise without changing the
            # ray-traced origin of the contact shadows. Padding is edge-clamped.
            padded=np.pad(ao,((0,0),(1,1)),mode='edge')
            ao=(padded[:,:-2]+2*padded[:,1:-1]+padded[:,2:])/4
            padded=np.pad(ao,((1,1),(0,0)),mode='edge')
            ao=(padded[:-2,:]+2*padded[1:-1,:]+padded[2:,:])/4
            orm_data[y:y+h,x:x+w,0]=np.pad(ao,GUTTER,mode='edge')
            stages.append({'receiver':name,'type':'CYCLES_AO','samples':64,'aoDistanceMetres':.75,'filter':'edge-clamped separable 1-2-1','minimum':float(ao.min()),'maximum':float(ao.max())})
            bpy.data.objects.remove(target,do_unlink=True);bpy.data.images.remove(img)
        # Bake the two authored practical fixtures only. Existing review lights
        # are disabled for this pass, then restored; no lamp or shadow map is
        # added to the browser renderer. The 120px interior receives a smooth,
        # limited-range colour modulation in the existing 256px atlas.
        import json
        if json.loads((HERE/'scene.json').read_text())['surfaceBake'].get('spatialDirectLighting',False):
            presentation=json.loads((Path(report_directory)/'presentation-report.json').read_text())
            saved_lights={obj:obj.hide_render for obj in bpy.data.objects if obj.type=='LIGHT'}
            saved_pass=(scene.render.bake.use_pass_direct,scene.render.bake.use_pass_indirect,scene.render.bake.use_pass_color)
            try:
                for obj in saved_lights:obj.hide_render=True
                for fixture in presentation['fixtures']:
                    lamp=bpy.data.lights.new(fixture['id']+' bake','AREA');lamp.energy=95;lamp.shape='RECTANGLE';lamp.size=.09;lamp.size_y=.98;lamp.color=(1.,.88,.71)
                    obj=bpy.data.objects.new(lamp.name,lamp);scratch.objects.link(obj);obj.location=fixture['authoringPosition']
                    # Area lamps emit along their local -Z, exactly below the lens.
                target=plane('Bake practical floor',(-5.4,-3.8,5.4,3.8),.266,scratch,mat)
                img=image('GN_PracticalFloor',120,120)
                scene.render.bake.use_pass_direct=True;scene.render.bake.use_pass_indirect=False;scene.render.bake.use_pass_color=False
                result=bake(target,img,'DIFFUSE')[:,:,:3]
                luminance=result.mean(axis=2);scale=max(float(np.percentile(luminance,98)),1e-5)
                result=np.clip(result/scale,0,1)
                for _ in range(3):
                    padded=np.pad(result,((0,0),(1,1),(0,0)),mode='edge');result=(padded[:,:-2]+2*padded[:,1:-1]+padded[:,2:])/4
                    padded=np.pad(result,((1,1),(0,0),(0,0)),mode='edge');result=(padded[:-2]+2*padded[1:-1]+padded[2:])/4
                floor_light=.88+.12*result
                stages.append({'receiver':'floor-practical-illumination','type':'CYCLES_DIFFUSE_DIRECT','samples':64,'resolution':[120,120],'fixtureIds':[f['id'] for f in presentation['fixtures']],
                               'normalization':'98th-percentile direct radiance, clamped and mapped to 0.88–1.0 albedo modulation','filter':'three separable 1-2-1 passes','rawMaximum':float(luminance.max())})
                bpy.data.objects.remove(target,do_unlink=True);bpy.data.images.remove(img)
            finally:
                for obj,value in saved_lights.items():obj.hide_render=value
                scene.render.bake.use_pass_direct,scene.render.bake.use_pass_indirect,scene.render.bake.use_pass_color=saved_pass
                for obj in list(scratch.objects):
                    if obj.type=='LIGHT':bpy.data.objects.remove(obj,do_unlink=True)
        from spatial_bake import run as bake_spatial
        # The measured small-receiver workload is faster on four CPU threads.
        # Keep the larger floor/detail ray workloads on the requested device;
        # device choices remain process-local and are recorded independently.
        spatial_compute=configure('cpu')
        try:
            spatial,spatial_stages=bake_spatial(scratch,mat,TILES,GUTTER,image,bake)
            from spatial_bake import bake_stationary_rack_core
            core_fields,core_stages=bake_stationary_rack_core(materials,scratch,mat,TILES,GUTTER,image,bake)
            spatial.update(core_fields);spatial_stages.extend(core_stages)
        finally:
            configure(compute['requested'])
        stages.extend(spatial_stages)
        for region,values in spatial.items():
            x,y,w,h=TILES[region]
            orm_data[y:y+h,x:x+w,0]=np.pad(values['ao'],GUTTER,mode='edge')
        # Isolate the detail prototype from the facility during surface bakes.
        for obj in saved_visibility:obj.hide_render=True
        scene.world.light_settings.distance=.08
        for kind in ['rack_a','face_a','face_b','coil']:
            width,height=METRES[kind]
            target=plane('Low '+kind,(0,0,width,height),0,scratch,mat)
            n=192;vertices,faces=detail_geometry(kind,n)
            data=bpy.data.meshes.new('High '+kind);data.from_pydata(vertices,[],faces)
            for polygon in data.polygons:polygon.use_smooth=True
            high=bpy.data.objects.new('High '+kind,data);scratch.objects.link(high)
            x,y,w,h=TILES[kind]
            relief=[vertex[2] for vertex in vertices];projection=projection_settings(min(relief),max(relief))
            img=image('GN_NORMAL_'+kind,w-2*GUTTER,h-2*GUTTER);result=bake(target,img,'NORMAL',high,projection)
            normal_data[y:y+h,x:x+w,:]=np.pad(result,((GUTTER,GUTTER),(GUTTER,GUTTER),(0,0)),mode='edge')
            bpy.data.images.remove(img)
            img=image('GN_DETAIL_AO_'+kind,w-2*GUTTER,h-2*GUTTER);result=bake(target,img,'AO',high,projection)
            orm_data[y:y+h,x:x+w,0]=np.pad(result[:,:,0],GUTTER,mode='edge')
            orm_data[y:y+h,x:x+w,1]=.55
            stages.append({'receiver':kind,'type':'CYCLES_SELECTED_TO_ACTIVE_NORMAL_AND_AO','samples':64,'aoDistanceMetres':.08,
                           'metricFootprint':[width,height],**projection,'highTriangles':n*n*2})
            bpy.data.objects.remove(target,do_unlink=True);bpy.data.objects.remove(high,do_unlink=True);bpy.data.images.remove(img)
        # Low-amplitude repeatable manufacturing variation, intentionally broad
        # enough to survive minification. It is roughness, not visible dirt.
        variation_ranges={}
        for region in ['paint','rack_panel','collector','collector_top','cooler_panel','metal','polished','copper','rubber','polymer']:
            x,y,w,h=TILES[region]
            variation=finish_field(region,w-2*GUTTER,h-2*GUTTER)
            orm_data[y:y+h,x:x+w,1]=np.pad(variation,GUTTER,mode='edge')
            variation_ranges[region]=[float(variation.min()),float(variation.max())]
        normal=image('GN_SurfaceNormal',SIZE,SIZE);orm=image('GN_SurfaceORM',SIZE,SIZE)
        normal.pixels.foreach_set(normal_data.ravel());orm.pixels.foreach_set(orm_data.ravel())
        records=[]
        for img,filename in [(normal,'surface-normal.png'),(orm,'surface-orm.png')]:
            save_image_atomic(img,HERE/filename)
            raw=(HERE/filename).read_bytes();records.append({'file':filename,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()})
        labels=build_color_atlas(floor_light,spatial)
        label_bytes=(HERE/'surface-color.png').read_bytes();records.append({'file':'surface-color.png','bytes':len(label_bytes),'sha256':hashlib.sha256(label_bytes).hexdigest()})
        bind(materials,normal,orm,labels)
        report={'schemaVersion':1,'engine':'Blender Cycles','blender':bpy.app.version_string,'seed':19,'compute':compute,'spatialCompute':spatial_compute,
                'resolution':[SIZE,SIZE],'colorResolution':[256,256],'gutterPixels':GUTTER,'normalMappedRoles':['grille'],'directIlluminationInColorAtlas':json.loads((HERE/'scene.json').read_text())['surfaceBake'].get('spatialDirectLighting',True),'metricTileFootprints':METRES,'ormFinishes':FINISHES,'roughnessMultiplier':1,'excludedRoles':['fan_rotor','picking_proxy'],
                'surfaceContractRevision':SURFACE_REVISION,'noiseSeedNamespace':NOISE_SEED_NAMESPACE,'atlasTiles':TILES,'atlasOrigin':'bottom-left','atlasLayoutSha256':fingerprint(TILES),
                'roughnessVariationRanges':variation_ranges,
                'stages':stages,'jobs':BAKE_JOBS,'images':records,'sourceSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                'notes':['Actual Cycles ray-traced AO and selected-to-active surface normal bakes.','AO is a visual shading aid, not physical airflow or capacity evidence.','No rotor pose or rotor shadow is baked into a receiver.']}
        atomic_write(Path(report_directory)/'bake-report.json',(json.dumps(report,indent=2)+'\n').encode())
        return report
    finally:
        BAKE_CACHE=None
        for obj,value in saved_visibility.items():obj.hide_render=value
        for obj in list(scratch.objects):bpy.data.objects.remove(obj,do_unlink=True)
        bpy.data.collections.remove(scratch)
        if not mat.users:bpy.data.materials.remove(mat)
