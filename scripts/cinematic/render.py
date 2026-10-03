"""Bounded cinematic authoring and resumable Cycles rendering from the editable master.

Run with pinned Blender --background --factory-startup --python-exit-code 2
--python scripts/cinematic/render.py -- --mode studies --output build/cinematic/cinematic-v1.
Never writes source master, registered browser releases or user preferences.
"""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import resource
import sys
import time

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'assets-source/facility'
sys.path.insert(0, str(SOURCE))
from compute import configure
from bake_job import atomic_write


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def write_json(path, value):
    atomic_write(path, (json.dumps(value, indent=2, allow_nan=False)+'\n').encode())


def rgb(value):
    colors=[int(value[index:index+2],16)/255 for index in (1,3,5)]
    return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in colors)+(1,)


def material(name, color, metal, roughness):
    mat=bpy.data.materials.new('CINEMA_'+name)
    mat.use_nodes=True
    bsdf=mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value=rgb(color)
    bsdf.inputs['Metallic'].default_value=metal
    bsdf.inputs['Roughness'].default_value=roughness
    if name in {'Graphite','Platform'}:
        nodes=mat.node_tree.nodes; links=mat.node_tree.links
        coords=nodes.new('ShaderNodeTexCoord')
        grain=nodes.new('ShaderNodeTexNoise'); grain.inputs['Scale'].default_value=22
        grain.inputs['Detail'].default_value=2
        links.new(coords.outputs['Object'],grain.inputs['Vector'])
        rough=nodes.new('ShaderNodeMapRange')
        rough.inputs['From Min'].default_value=0;rough.inputs['From Max'].default_value=1
        rough.inputs['To Min'].default_value=roughness-.025;rough.inputs['To Max'].default_value=roughness+.025
        links.new(grain.outputs['Fac'],rough.inputs['Value']);links.new(rough.outputs['Result'],bsdf.inputs['Roughness'])
    return mat


def cube(collection,name,location,size,mat,bevel=0):
    x,y,z=[v/2 for v in size]
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata([(-x,-y,-z),(x,-y,-z),(x,y,-z),(-x,y,-z),(-x,-y,z),(x,-y,z),(x,y,z),(-x,y,z)],[],[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])
    mesh.materials.append(mat)
    obj=bpy.data.objects.new(name,mesh);collection.objects.link(obj);obj.location=location
    if bevel:
        mod=obj.modifiers.new('Manufactured edge','BEVEL');mod.width=bevel;mod.segments=3
        mod=obj.modifiers.new('Panel normals','WEIGHTED_NORMAL');mod.keep_sharp=True
    return obj


def driver(socket,expression):
    curve=socket.driver_add('default_value');curve.driver.expression=expression


def prepare(args,settings):
    master=SOURCE/'facility-master.blend'
    master_hash=sha(master)
    bpy.ops.wm.open_mainfile(filepath=str(master))
    scene=bpy.context.scene
    for col in bpy.data.collections:
        col.hide_render=col.name not in {'AUTHORING','AUTHORING_MANUAL'}
        col.hide_viewport=col.hide_render
    bpy.context.view_layer.update()
    author=bpy.data.collections['AUTHORING']
    detail=bpy.data.collections.new('CINEMATIC_DETAIL');scene.collection.children.link(detail)
    rig=bpy.data.collections.new('CINEMATIC_RIG');scene.collection.children.link(rig)
    materials={name:material(name,*values) for name,values in {
        'Graphite':('#292f34',0,.45),'Steel':('#727c82',1,.42),
        'Trim':('#899196',1,.40),'Dark':('#111518',0,.72),
        'Copper':('#d99a58',.65,.36),'Amber':('#ffb15a',0,.38),
        'Platform':('#272e33',0,.76),'Grille':('#161d22',.25,.52),
        'DuctCoating':('#1d252b',0,.54),'FanBlade':('#30383e',.28,.44),
        'VentLouver':('#414a50',.5,.46)
    }.items()}
    materials['Amber'].node_tree.nodes.get('Principled BSDF').inputs['Emission Color'].default_value=rgb('#ffb15a')
    materials['Amber'].node_tree.nodes.get('Principled BSDF').inputs['Emission Strength'].default_value=.2
    equipment=set();rotors=[];lamps=[];points=[];vents=[]
    for obj in author.objects:
        if obj.get('gnRole') in {'picking_proxy','architectural_context'}:
            obj.hide_render=True;obj.hide_viewport=True;continue
        obj.hide_render=False
        if obj.type=='MESH':
            for index,mat in enumerate(obj.data.materials):
                if mat and mat.name in materials:obj.data.materials[index]=materials[mat.name]
            if obj.get('gnEquipmentId','').startswith('air-') and not obj.get('gnRoutePath'):
                for index in range(len(obj.data.materials)):obj.data.materials[index]=materials['DuctCoating']
            if obj.name.startswith(('Collector cover flange','Collector cover seam return')):
                for index in range(len(obj.data.materials)):obj.data.materials[index]=materials['Graphite']
            if obj.name.startswith('Enclosed busway'):
                for index in range(len(obj.data.materials)):obj.data.materials[index]=materials['Graphite']
            if obj.name.startswith(('Kit compute vent','Kit carrier ventilation')):vents.append(obj)
            for mod in obj.modifiers:
                if mod.type=='BEVEL':mod.segments=max(mod.segments,3)
            if obj.get('gnEquipmentId'):equipment.add(obj['gnEquipmentId'])
            points.extend(obj.matrix_world@Vector(p) for p in obj.bound_box)
        if obj.get('gnRole')=='fan_rotor':rotors.append(obj)
        if obj.get('gnRole')=='activity_led':lamps.append(obj)
    rotors.sort(key=lambda obj:obj.get('gnId',obj.name));lamps.sort(key=lambda obj:obj.get('gnId',obj.name))
    if len(rotors)!=4 or len(lamps)!=48:raise ValueError('Unexpected authored fan/LED identity')
    for index,obj in enumerate(rotors):
        for slot in range(len(obj.data.materials)):obj.data.materials[slot]=materials['FanBlade']
        obj.rotation_mode='XYZ'
        curve=obj.driver_add('rotation_euler',2)
        curve.driver.expression=f'{settings["rotorPhase"][index]}+2*pi*{settings["rotorTurns"][index]}*frame/{settings["frameCount"]}'
        if hasattr(obj,'cycles'):obj.cycles.motion_steps=3
    for index,anchor in enumerate(lamps):
        mat=material(f'LED_{index:02d}','#ffb56b',0,.30)
        bsdf=mat.node_tree.nodes.get('Principled BSDF')
        bsdf.inputs['Emission Color'].default_value=rgb('#ffad51')
        if index%4==3:bsdf.inputs['Emission Strength'].default_value=2.2
        else:
            phase=(index*.61803398875)%1
            # Periodic sparse pulses, distinct rack/lamp phases; no frame-history state.
            driver(bsdf.inputs['Emission Strength'],f'0.8+5.0*pow(max(0,cos(2*pi*(frame/300+{phase}))),48)')
        position=anchor.matrix_world.translation+Vector((0,-.04,0))
        lamp=cube(detail,f'CINEMA_LED_{index:02d}',position,(.034,.012,.020),mat,.004)
        lamp['gnId']=anchor.get('gnId');lamp['gnDomain']='workloads';lamp['gnRole']='activity_led'
        lamp['gnCinematicMountOffsetMetres']=[0,-.04,0]
    # Five formed vertical louvers within each already-authored module vent.
    # Their deep gaps produce physical occlusion without painting fake AO.
    for index,vent in enumerate(vents):
        coords=[vent.matrix_world@vertex.co for vertex in vent.data.vertices]
        lo=Vector(tuple(min(p[axis] for p in coords) for axis in range(3)))
        hi=Vector(tuple(max(p[axis] for p in coords) for axis in range(3)))
        center=(lo+hi)/2;width=hi.x-lo.x;height=hi.z-lo.z
        count=5 if width>.16 else 3
        for slot in range(count):
            position=(center.x-width*.41+slot*width*.82/(count-1),center.y-.0035,center.z)
            item=cube(detail,f'Module vent formed louver {index} {slot}',position,(width*.064,.007,height*.9),materials['VentLouver'],.0012)
            item['gnEquipmentId']=vent.get('gnEquipmentId','');item['gnSourceObject']=vent.name
    for row,y in enumerate([-1.35,.9]):
        for seam in [-1.87,-.05,1.77]:
            item=cube(detail,f'Collector formed splice {row} {seam}',(seam,y+.48-.329,3.31+row*.12),(.036,.012,.258),materials['Graphite'],.0025)
            item['gnEquipmentId']=f'air-row-{row}'
    # Modest modeled edge beads help the real thin cooler panels catch light.
    # Geometry remains tied to each existing cooling unit; no new system topology.
    for index,x in enumerate([-2.145,-.715,.715,2.145]):
        for yy in [1.836,2.944]:
            item=cube(detail,f'Cooler panel folded bead {index} {yy}',(x+.632,yy,1.86),(.012,.024,2.94),materials['Graphite'],.003)
            item['gnEquipmentId']=f'cooler-{index:02d}'
    world=bpy.data.worlds.new('CINEMA_WORLD');world.use_nodes=True;scene.world=world
    world.node_tree.nodes.get('Background').inputs['Color'].default_value=(.17,.20,.23,1)
    world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.10
    # Full-frame opaque background is delivered in the movie, avoiding alpha/video compositors.
    bg=material('Backdrop','#020303',0,1)
    floor=cube(detail,'Cinematic ground',(0,0,-.055),(200,200,.08),bg)
    floor['gnRole']='cinematic_background'
    floor.is_shadow_catcher=True
    lights=[
        ('KEY',(-4.8,-5.6,10.5),2600,7.0,4.5,(1,.94,.87)),
        ('FILL',(5.0,-6.5,5.0),650,6.0,4.0,(.82,.9,1)),
        ('RIM',(3.0,6.2,8.0),1900,5.0,2.5,(.88,.93,1)),
        ('STRIP',(-6.5,1.3,4.5),850,1.5,5.0,(1,.94,.88))
    ]
    for name,position,watts,width,height,color in lights:
        data=bpy.data.lights.new('CINEMA_'+name,'AREA');data.energy=watts;data.shape='RECTANGLE';data.size=width;data.size_y=height;data.color=color
        obj=bpy.data.objects.new(data.name,data);rig.objects.link(obj);obj.location=position
        obj.rotation_euler=(Vector((0,0,1.3))-obj.location).to_track_quat('-Z','Y').to_euler()
    camera_data=bpy.data.cameras.new('CINEMA_CAMERA');camera_data.type='ORTHO';camera_data.clip_end=250
    camera=bpy.data.objects.new('CINEMA_CAMERA',camera_data);rig.objects.link(camera);scene.camera=camera
    scene.render.engine='CYCLES'
    device=configure(args.device,metalrt='AUTO',threads=4)
    scene.cycles.samples=args.samples or settings['samples']
    scene.cycles.use_adaptive_sampling=True;scene.cycles.adaptive_threshold=settings['adaptiveThreshold']
    scene.cycles.seed=settings['seed'];scene.cycles.use_animated_seed=False
    scene.cycles.use_denoising=True;scene.cycles.denoiser='OPENIMAGEDENOISE'
    scene.cycles.denoising_input_passes='RGB_ALBEDO_NORMAL';scene.cycles.denoising_use_gpu=args.device!='cpu'
    scene.cycles.max_bounces=8;scene.cycles.diffuse_bounces=3;scene.cycles.glossy_bounces=4
    scene.cycles.transmission_bounces=4;scene.cycles.transparent_max_bounces=8
    scene.render.use_persistent_data=True
    scene.render.film_transparent=True
    scene.use_nodes=True
    compositor=bpy.data.node_groups.new('CINEMA_COMPOSITOR','CompositorNodeTree')
    scene.compositing_node_group=compositor
    compositor.interface.new_socket(name='Image',in_out='OUTPUT',socket_type='NodeSocketColor')
    layers=compositor.nodes.new('CompositorNodeRLayers')
    over=compositor.nodes.new('CompositorNodeAlphaOver')
    over.inputs['Background'].default_value=rgb('#080b0c')
    over.inputs['Factor'].default_value=1
    compositor.links.new(layers.outputs['Image'],over.inputs['Foreground'])
    output=compositor.nodes.new('NodeGroupOutput')
    compositor.links.new(over.outputs['Image'],output.inputs['Image'])
    scene.render.use_motion_blur=True;scene.render.motion_blur_shutter=settings['shutterFrames']
    scene.render.fps=settings['fps'];scene.frame_start=0;scene.frame_end=settings['frameCount']-1
    scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
    scene.view_settings.exposure=0;scene.view_settings.gamma=1
    scene.render.resolution_percentage=100
    return scene,points,{'masterSha256':master_hash,'settingsSha256':sha(args.settings),'rendererSha256':sha(__file__),
                         'device':device,'equipmentIds':sorted(equipment),'rotorIds':[obj.get('gnId') for obj in rotors],
                         'ledCount':len(lamps),'lights':lights,'originalMasterUnmodified':sha(master)==master_hash,
                         'color':{'transform':'AgX','look':'Medium High Contrast','exposure':0,'delivery':'SDR'} }


def camera_fit(scene,points,width,height,azimuth,elevation,padding):
    target=Vector((0,0,1.25));distance=24
    az=math.radians(azimuth);el=math.radians(elevation)
    cam=scene.camera;cam.location=target+Vector((math.sin(az)*math.cos(el),-math.cos(az)*math.cos(el),math.sin(el)))*distance
    cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    bpy.context.view_layer.update()
    inv=cam.matrix_world.inverted();projected=[inv@p for p in points]
    xmin,xmax=min(p.x for p in projected),max(p.x for p in projected)
    ymin,ymax=min(p.y for p in projected),max(p.y for p in projected)
    span=max(ymax-ymin,(xmax-xmin)/(width/height))*padding
    cam.location+=cam.rotation_euler.to_matrix()@Vector(((xmin+xmax)/2,(ymin+ymax)/2,0))
    cam.data.ortho_scale=span
    # Vertical sensor fit makes ortho_scale the vertical span at any aspect.
    cam.data.sensor_fit='VERTICAL'
    scene.render.resolution_x=width;scene.render.resolution_y=height
    bpy.context.view_layer.update()
    inspection=[]
    ray=cam.rotation_euler.to_matrix()@Vector((0,0,1))
    for index in range(4):
        lamp=bpy.data.objects.get(f'CINEMA_LED_{index:02d}')
        if lamp:
            center=lamp.matrix_world.translation
            hit,location,normal,face,obj,matrix=scene.ray_cast(bpy.context.evaluated_depsgraph_get(),center+ray*50,-ray)
            inspection.append({'led':lamp.name,'position':list(center),'firstHit':obj.name if hit else None})
    print('CINEMATIC_LED_VISIBILITY '+json.dumps(inspection),flush=True)
    from bpy_extras.object_utils import world_to_camera_view
    anchors=[]
    for label,identity,feature in [('Power','switchgear-0','upper-front'),('Cooling','cooler-3','fan-center'),('Workloads','rack-05','front-module')]:
        members=[obj for obj in bpy.data.collections['AUTHORING'].objects if obj.type=='MESH' and obj.get('gnEquipmentId')==identity]
        coords=[obj.matrix_world@Vector(p) for obj in members for p in obj.bound_box]
        if not coords:raise ValueError('Missing callout equipment '+identity)
        low=Vector(tuple(min(p[axis] for p in coords) for axis in range(3)))
        high=Vector(tuple(max(p[axis] for p in coords) for axis in range(3)))
        point=(low+high)/2
        if feature=='fan-center':point=Vector((2.145,2.39,3.456))
        elif feature=='upper-front':point.y=low.y;point.z=low.z+(high.z-low.z)*.78
        else:point.y=low.y;point.z=low.z+(high.z-low.z)*.61
        screen=world_to_camera_view(scene,cam,point)
        anchors.append({'label':label,'equipmentId':identity,'feature':feature,'worldMetres':list(point),
                        'xPercent':round(screen.x*100,4),'yPercent':round((1-screen.y)*100,4),'inFrame':0<=screen.x<=1 and 0<=screen.y<=1})
    return {'position':list(cam.location),'rotation':list(cam.rotation_euler),'orthographicSpan':span,'width':width,'height':height,'azimuth':azimuth,'elevation':elevation,'padding':padding,'anchors':anchors}


def render_frame(scene,directory,frame,report,identity):
    directory.mkdir(parents=True,exist_ok=True)
    receipt=directory/f'{frame:04d}.json';exr=directory/f'{frame:04d}.exr';png=directory/f'{frame:04d}.png'
    expected=hashlib.sha256(json.dumps(identity,sort_keys=True).encode()).hexdigest()
    if receipt.exists():
        prior=json.loads(receipt.read_text())
        if prior.get('identity')==expected and all(Path(directory/row['file']).exists() and sha(directory/row['file'])==row['sha256'] for row in prior['files']):
            return {**prior,'cacheHit':True}
        raise ValueError('Existing frame has incompatible identity or incomplete data; use a fresh attempt')
    scene.frame_set(frame)
    before=time.perf_counter();bpy.ops.render.render();seconds=time.perf_counter()-before
    result=bpy.data.images['Render Result']
    scene.render.image_settings.file_format='OPEN_EXR';scene.render.image_settings.color_depth='16';scene.render.image_settings.color_mode='RGB';scene.render.image_settings.exr_codec='ZIP'
    result.save_render(str(exr),scene=scene)
    scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_depth='8';scene.render.image_settings.color_mode='RGB'
    result.save_render(str(png),scene=scene)
    row={'frame':frame,'seconds':seconds,'identity':expected,'width':scene.render.resolution_x,'height':scene.render.resolution_y,
         'peakProcessRssBytes':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
         'files':[{'file':p.name,'bytes':p.stat().st_size,'sha256':sha(p)} for p in [exr,png]],'cacheHit':False}
    write_json(receipt,row);print('CINEMATIC_FRAME '+json.dumps({'frame':frame,'seconds':round(seconds,3),'path':str(png)}),flush=True)
    return row


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--settings',type=Path,default=SOURCE/'cinematic/settings.json')
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--mode',choices=['studies','proof','production','prepare'],default='studies')
    parser.add_argument('--device',choices=['metal','cpu'],default='metal')
    parser.add_argument('--composition',choices=['desktop','mobile','both'],default='both')
    parser.add_argument('--samples',type=int)
    parser.add_argument('--start',type=int,default=0);parser.add_argument('--end',type=int)
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    output=args.output.resolve()
    if not output.is_relative_to(ROOT/'build/cinematic'):raise ValueError('Output must be a private cinematic build directory')
    settings=json.loads(args.settings.read_text());output.mkdir(parents=True,exist_ok=True)
    scene,points,source=prepare(args,settings)
    report={'version':'cinematic-render.v1','mode':args.mode,'source':source,'settings':settings,'frames':[],'status':'running'}
    report_path=output/f'{args.mode}-{args.composition}-report.json'
    write_json(report_path,report)
    comps=['desktop','mobile'] if args.composition=='both' else [args.composition]
    studies=[('A-current',42,32),('B-front',42,28),('C-oblique',34,27)] if args.mode=='studies' else [('final',settings['camera']['azimuthDegrees'],settings['camera']['elevationDegrees'])]
    for name,az,el in studies:
        for comp in comps:
            dimensions=settings['compositions'][comp]
            width,height=dimensions['width'],dimensions['height']
            if args.mode=='studies':width,height=(960,600) if comp=='desktop' else (640,480)
            camera=camera_fit(scene,points,width,height,az,el,settings['camera']['padding'])
            identity={'source':source,'settings':settings,'camera':camera,'samples':scene.cycles.samples,'blur':scene.render.motion_blur_shutter}
            if args.mode=='prepare':
                bpy.ops.wm.save_as_mainfile(filepath=str(output/f'{comp}-cinematic-master.blend'),compress=True);continue
            frames=[0] if args.mode=='studies' else list(range(args.start,args.end if args.end is not None else 30 if args.mode=='proof' else settings['frameCount']))
            if args.mode=='proof':frames+=list(range(296,301))
            directory=output/args.mode/(name+'-'+comp if args.mode=='studies' else comp)
            for frame in sorted(set(frames)):
                row=render_frame(scene,directory,frame,report,identity)
                report['frames'].append({**row,'composition':comp,'study':name,'camera':camera});write_json(report_path,report)
            if args.mode!='studies':bpy.ops.wm.save_as_mainfile(filepath=str(output/f'{comp}-cinematic-master.blend'),compress=True)
    report['status']='complete';write_json(report_path,report)


if __name__=='__main__':main()
