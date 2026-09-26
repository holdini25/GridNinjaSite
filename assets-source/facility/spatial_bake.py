"""V11 spatial contact/light receivers from evaluated authored construction.

Receivers share the existing atlases. There are no runtime lights or new images.
Moving rotors, removable duct covers, door and tray poses never cast baked AO.
"""
import hashlib
import json
import time
from pathlib import Path
import bpy
import numpy as np
from mathutils import Vector
from bake_job import belongs_to_receiver, fingerprint


RECEIVER_FAMILIES = [
    ('collector_top', 'air-row-0', 2, 1), ('rack_panel', 'rack-02', 0, 1),
    ('collector', 'air-row-0', 1, -1), ('cooler_panel', 'cooler-0', 0, 1),
]


def receivers_from_geometry(originals, graph):
    """Construct receiver planes from tagged evaluated parts, never world literals."""
    from surface_bake import motion_group
    results = []
    for region, equipment, default_axis, default_sign in RECEIVER_FAMILIES:
        candidates = [obj for obj in originals if obj.type == 'MESH' and obj.get('gnEquipmentId')
                      and (obj.get('gnBakeReceiverFamily') == region or obj.get('gnSpatialRegion') == region
                           or obj.get('gnSurfaceTopRegion') == region)]
        if not candidates: raise ValueError('Missing tagged spatial receiver: ' + region)
        # Prefer the explicit tag; compatibility sources may contain both sides.
        candidates.sort(key=lambda obj: (obj.get('gnEquipmentId') != equipment,
                                         obj.get('gnBakeReceiverFamily') != region,
                                         -obj.matrix_world.translation[default_axis] * default_sign, obj.name))
        source = candidates[0]; axis = int(source.get('gnBakeReceiverAxis', default_axis)); sign = int(source.get('gnBakeReceiverSign', default_sign))
        if axis not in (0, 1, 2) or sign not in (-1, 1): raise ValueError('Invalid receiver face direction')
        frame = json.loads(source['gnBakeFrame']) if source.get('gnBakeFrame') else None
        if frame:
            origin = Vector(frame['origin']); u = Vector(frame['u']); v = Vector(frame['v']); width, height = frame['size']
            if width <= 0 or height <= 0 or abs(u.length-1) > 1e-6 or abs(v.length-1) > 1e-6 or abs(u.dot(v)) > 1e-6:
                raise ValueError('Invalid metric receiver frame')
            local = [origin, origin+u*width, origin+u*width+v*height, origin+v*height]
        else:
            evaluated = source.evaluated_get(graph); mesh = evaluated.to_mesh()
            try:
                low = [min(vertex.co[i] for vertex in mesh.vertices) for i in range(3)]
                high = [max(vertex.co[i] for vertex in mesh.vertices) for i in range(3)]
            finally: evaluated.to_mesh_clear()
            axes = [i for i in range(3) if i != axis]
            origin = Vector(low); origin[axis] = high[axis] if sign > 0 else low[axis]
            u = Vector(); u[axes[0]] = 1.; v = Vector(); v[axes[1]] = 1.
            width = high[axes[0]]-low[axes[0]]; height = high[axes[1]]-low[axes[1]]
            if u.cross(v)[axis]*sign < 0: origin[axes[0]] = high[axes[0]]; u.negate()
            local = [origin, origin+u*width, origin+u*width+v*height, origin+v*height]
        corners = [source.matrix_world @ point for point in local]
        normal = (corners[1]-corners[0]).cross(corners[3]-corners[0]).normalized()
        # A submillimetre offset avoids the receiver intersecting its own skin.
        corners = [point + normal*.0005 for point in corners]
        results.append({'region': region, 'equipment': source['gnEquipmentId'], 'preferredEquipment': equipment, 'source': source.name,
                        'motionGroup': motion_group(source), 'normal': list(normal),
                        'corners': [list(point) for point in corners], 'receiverOffsetMetres': .0005,
                        'metricFootprint': [(corners[1]-corners[0]).length, (corners[3]-corners[0]).length],
                        'coverReceiver': region == 'collector_top', 'frameSource': 'authored' if frame else 'evaluated-bounds'})
    return results


def smooth(data, passes=1):
    for _ in range(passes):
        p = np.pad(data, ((0, 0), (1, 1), (0, 0)), mode='edge')
        data = (p[:, :-2] + 2*p[:, 1:-1] + p[:, 2:])/4
        p = np.pad(data, ((1, 1), (0, 0), (0, 0)), mode='edge')
        data = (p[:-2] + 2*p[1:-1] + p[2:])/4
    return data


def run(scratch, material, tiles, gutter, image, bake, samples=64):
    """Bake reusable surfaces using only their actual static equipment family."""
    scene = bpy.context.scene
    direct_enabled=json.loads((Path(__file__).resolve().parent/'scene.json').read_text())['surfaceBake'].get('spatialDirectLighting',True)
    saved = {obj: obj.hide_render for obj in bpy.data.objects if obj.type in {'MESH', 'LIGHT'}}
    saved_pass = (scene.render.bake.use_pass_direct, scene.render.bake.use_pass_indirect, scene.render.bake.use_pass_color)
    saved_distance = scene.world.light_settings.distance
    saved_world = scene.world.color[:]
    graph = bpy.context.evaluated_depsgraph_get()
    originals = list(bpy.data.collections['AUTHORING'].objects)
    from surface_bake import geometry_fingerprint, motion_group
    receivers = receivers_from_geometry(originals, graph)
    results = {}; records = []
    temporary = []
    try:
        for obj in saved: obj.hide_render = True
        scene.world.light_settings.distance = .18
        for receiver in receivers:
            started = time.perf_counter()
            clones = []
            for source in originals:
                if source.type != 'MESH' or source.get('gnEquipmentId') != receiver['equipment']:
                    continue
                if source.get('gnRole') in {'fan_rotor', 'picking_proxy'}:
                    continue
                if not belongs_to_receiver(motion_group(source), receiver['motionGroup']): continue
                if receiver.get('coverReceiver'):
                    # Only flange contacts that move with this cover may shade
                    # its top. Never transfer a closed-cover shadow inside ducts.
                    if source.get('gnBakeCoverRole')!='contact_occluder':continue
                evaluated = source.evaluated_get(graph)
                mesh = bpy.data.meshes.new_from_object(evaluated, depsgraph=graph)
                clone = bpy.data.objects.new('Spatial bake '+source.name, mesh)
                scratch.objects.link(clone); clone.matrix_world = source.matrix_world.copy()
                clone.hide_render = False; clones.append(clone); temporary.append(clone)
            if not clones: raise ValueError('Spatial receiver has no authored construction: '+receiver['equipment'])
            mesh = bpy.data.meshes.new('Spatial receiver '+receiver['region'])
            mesh.from_pydata(receiver['corners'], [], [(0, 1, 2, 3)])
            mesh.materials.append(material)
            uv = mesh.uv_layers.new(name='UVMap')
            for entry, point in zip(uv.data, [(0,0), (1,0), (1,1), (0,1)]): entry.uv = point
            target = bpy.data.objects.new(mesh.name, mesh); scratch.objects.link(target); temporary.append(target)
            x,y,w,h = tiles[receiver['region']]
            target_image = image('GN_SpatialAO_'+receiver['region'], w-2*gutter, h-2*gutter)
            raw_ao = bake(target, target_image, 'AO')[:, :, :1]
            ao = smooth(raw_ao, 1)[:, :, 0]
            # Keep the physical contact field, with an explicit artistic floor
            # preventing this coarse shared atlas from crushing painted blacks.
            ao = np.clip(ao, .72, 1.)
            bpy.data.images.remove(target_image)
            if not direct_enabled or receiver.get('coverReceiver'):
                color=np.ones(((h-2*gutter)//2,(w-2*gutter)//2,3),dtype=np.float32)
                results[receiver['region']]={'ao':ao,'color':color}
                records.append({**receiver,'type':'CYCLES_SPATIAL_AO_ONLY','samples':samples,
                                'resolution':[w-2*gutter,h-2*gutter],'aoDistanceMetres':.18,
                                'rawAoRange':[float(raw_ao.min()),float(raw_ao.max())],'aoRange':[float(ao.min()),float(ao.max())],
                                'colorRange':[1.,1.],'normalization':'AO minimum .72; no direct illumination in base color',
                                'authoredMeshCount':len(clones),'seconds':time.perf_counter()-started,
                                'excluded':'moving objects excluded except co-moving cover flanges on their own cover receiver',
                                'occluderIds':[source.name for source in clones],
                                'geometrySha256':fingerprint({clone.name:geometry_fingerprint(clone,graph) for clone in clones})})
                for obj in [*clones,target]:
                    data=obj.data;temporary.remove(obj);bpy.data.objects.remove(obj,do_unlink=True)
                    if data.users==0:bpy.data.meshes.remove(data)
                continue
            # Broad neutral service fill. Position derives from the receiver
            # bounds and orientation; no warm albedo is painted onto graphite.
            points = [Vector(point) for point in receiver['corners']]
            center = sum(points, Vector())/4
            normal = Vector(receiver['normal'])
            lamp = bpy.data.lights.new('Spatial neutral service softbox', 'AREA')
            lamp.energy = 500; lamp.shape = 'RECTANGLE'; lamp.size = 2.8; lamp.size_y = 2.0; lamp.color = (1.,1.,1.)
            light = bpy.data.objects.new(lamp.name, lamp); scratch.objects.link(light); temporary.append(light)
            light.location = center + normal*2.8 + Vector((0,0,2.2))
            light.rotation_euler = (center-light.location).to_track_quat('-Z','Y').to_euler()
            scene.render.bake.use_pass_direct = True; scene.render.bake.use_pass_indirect = False; scene.render.bake.use_pass_color = False
            # Direct radiance must stay floating point until normalization;
            # an 8-bit image clips values above one and flattens the surface.
            target_image = image('GN_SpatialLight_'+receiver['region'], w-2*gutter, h-2*gutter, floating=True)
            direct = bake(target, target_image, 'DIFFUSE')[:, :, :3]
            luminance = direct.mean(axis=2)
            scale = max(float(np.percentile(luminance, 98)), 1e-6)
            modulation = .55 + .45*np.clip(smooth(direct, 2)/scale, 0, 1)
            # Match the corresponding UV0 layout at half resolution, box-filtered.
            color = modulation.reshape((h-2*gutter)//2, 2, (w-2*gutter)//2, 2, 3).mean(axis=(1,3))
            results[receiver['region']] = {'ao': ao, 'color': color}
            records.append({**receiver, 'type':'CYCLES_SPATIAL_AO_AND_DIFFUSE_DIRECT', 'samples':samples,
                            'resolution':[w-2*gutter,h-2*gutter], 'aoDistanceMetres':.18,
                            'rawAoRange':[float(raw_ao.min()),float(raw_ao.max())], 'aoRange':[float(ao.min()),float(ao.max())],
                            'colorRange':[float(color.min()),float(color.max())], 'directRadianceMaximum':float(luminance.max()),
                            'normalization':'98th percentile, neutral 0.55–1.0 linear albedo modulation, encoded sRGB on save; AO minimum 0.72',
                            'authoredMeshCount':len(clones), 'seconds':time.perf_counter()-started,
                            'excluded':'fan rotors, picking proxies, removable duct covers; no moving door/tray receiver',
                            'occluderIds':[source.name for source in clones],
                            'geometrySha256':fingerprint({clone.name:geometry_fingerprint(clone,graph) for clone in clones})})
            bpy.data.images.remove(target_image)
            for obj in [*clones, target, light]:
                data = obj.data; temporary.remove(obj); bpy.data.objects.remove(obj, do_unlink=True)
                if data.users == 0:
                    (bpy.data.meshes if isinstance(data, bpy.types.Mesh) else bpy.data.lights).remove(data)
        return results, records
    finally:
        for obj in temporary:
            if obj.name in bpy.data.objects: bpy.data.objects.remove(obj, do_unlink=True)
        for obj, value in saved.items(): obj.hide_render = value
        scene.render.bake.use_pass_direct, scene.render.bake.use_pass_indirect, scene.render.bake.use_pass_color = saved_pass
        scene.world.light_settings.distance = saved_distance
        scene.world.color = saved_world


def bake_stationary_rack_core(materials,scratch,material,tiles,gutter,image,bake):
    """Two scalar contact fields from the same static core used in the rack.

    No door, removable panel, service tray or adjacent-slot geometry can cast
    into these reusable fields. Steel and paint remain separate atlas finishes.
    """
    import sys
    from rack_kit import stationary_module_core
    from surface_bake import geometry_fingerprint
    from bake_job import fingerprint
    from surface_contract import validate_contact_frame
    generators=[sys.modules.get('__main__'),sys.modules.get('generate')]
    g=next((module for module in generators if module and getattr(module,'MATERIALS',None) is materials),None)
    if g is None:raise RuntimeError('Cannot identify the owning authoring generator')
    before=set(scratch.objects)
    saved_visibility={obj:obj.hide_render for obj in bpy.data.objects if obj.type=='MESH'}
    old_collection,old_static=g.collection,g.STATIC
    old_distance=bpy.context.scene.world.light_settings.distance
    results={};records=[]
    try:
        for obj in saved_visibility:obj.hide_render=True
        g.collection=scratch;g.STATIC={}
        parent=g.empty('GN_BAKE_STATIC_MODULE_CORE')
        core=stationary_module_core(g,parent,parent,0.)
        meshes=[obj for obj in scratch.objects if obj not in before and obj.type=='MESH']
        for obj in meshes:obj.hide_render=False
        bpy.context.view_layer.update();graph=bpy.context.evaluated_depsgraph_get()
        signature=fingerprint({obj.name:geometry_fingerprint(obj,graph) for obj in meshes})
        bpy.context.scene.world.light_settings.distance=.08
        for region,receiver in core['receivers'].items():
            started=time.perf_counter();frame=validate_contact_frame(receiver['frame'],outward=True)
            origin=Vector(frame['origin']);u=Vector(frame['u']);v=Vector(frame['v']);w,h=frame['size']
            normal=Vector();normal[frame['axis']]=frame['sign']
            origin+=normal*.0005
            points=[origin,origin+u*w,origin+u*w+v*h,origin+v*h]
            data=bpy.data.meshes.new('Static module receiver '+region)
            data.from_pydata(points,[],[(0,1,2,3)]);data.materials.append(material)
            uv=data.uv_layers.new(name='UVMap')
            for item,point in zip(uv.data,[(0,0),(1,0),(1,1),(0,1)]):item.uv=point
            target=bpy.data.objects.new(data.name,data);scratch.objects.link(target)
            x,y,width,height=tiles[region]
            target_image=image('GN_ModuleContact_'+region,width-2*gutter,height-2*gutter)
            try:
                raw=bake(target,target_image,'AO')[:,:,:1]
                ao=np.clip(smooth(raw,1)[:,:,0],.42,1.)
                if float(ao.max()-ao.min())<.02:raise ValueError('Contact receiver has no spatially resolved construction: '+region)
                results[region]={'ao':ao,'color':np.ones(((height-2*gutter)//2,(width-2*gutter)//2,3),dtype=np.float32)}
                records.append({'region':region,'type':'CYCLES_STATIC_MODULE_CORE_AO',
                    'receiverFrame':frame,'metricFootprint':frame['size'],'resolution':[width-2*gutter,height-2*gutter],
                    'aoDistanceMetres':.08,'receiverOffsetMetres':.0005,'aoFloor':.42,
                    'rawAoRange':[float(raw.min()),float(raw.max())],'aoRange':[float(ao.min()),float(ao.max())],
                    'aoMean':float(ao.mean()),'contactCoverageBelowPoint9':float(np.mean(ao<.9)),
                    'constructionFamily':'stationary-server-core.v1','constructionSource':'rack_kit.stationary_module_core',
                    'geometrySha256':signature,'occluderNames':[obj.name for obj in meshes],
                    'excluded':['service tray','door','removable panel','neighboring modules'],
                    'reuse':'Only identical stationary module cores and mirrored support pairs',
                    'seconds':time.perf_counter()-started})
            finally:
                bpy.data.objects.remove(target,do_unlink=True)
                if data.users==0:bpy.data.meshes.remove(data)
                bpy.data.images.remove(target_image)
        return results,records
    finally:
        g.collection=old_collection;g.STATIC=old_static
        bpy.context.scene.world.light_settings.distance=old_distance
        for obj in list(scratch.objects):
            if obj in before:continue
            data=obj.data if obj.type=='MESH' else None
            bpy.data.objects.remove(obj,do_unlink=True)
            if data and data.users==0:bpy.data.meshes.remove(data)
        for obj,visible in saved_visibility.items():obj.hide_render=visible
