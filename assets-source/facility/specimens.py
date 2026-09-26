"""Two honest, hollow illustrative assemblies, authored independently of the site.

No vendor construction, redundancy, cooling result, rating or CFD is claimed.
Reuses the pinned authoring primitives and atlas; each part is material-batched.
"""
import copy
import gzip
import hashlib
import json
from pathlib import Path
import struct
import sys

import bpy
from mathutils import Vector

HERE=Path(__file__).resolve().parent
if str(HERE) not in sys.path:sys.path.insert(0,str(HERE))


def build_all(out,kinds=('rack','cooling')):
    import generate as g
    from engineering_metadata import bounds_yup,source_modules,yup
    from surface_bake import bind
    import export
    descriptors=json.loads((out/'specimen-descriptors.json').read_text()) if (out/'specimen-descriptors.json').exists() else {}
    for kind in kinds:
        master=HERE/f'{kind}-specimen.blend'
        # Manual refinements survive regeneration of this independent master.
        if master.exists():bpy.ops.wm.open_mainfile(filepath=str(master))
        else:bpy.ops.wm.read_factory_settings(use_empty=True)
        for name in ['AUTHORING','EXPORT']:
            col=bpy.data.collections.get(name)
            if col:
                for obj in list(col.objects):bpy.data.objects.remove(obj,do_unlink=True)
                bpy.data.collections.remove(col)
        for collection_name in ['AUTHORING','AUTHORING_MANUAL','EXPORT','REFERENCE']:
            if not bpy.data.collections.get(collection_name):
                col=bpy.data.collections.new(collection_name);bpy.context.scene.collection.children.link(col)
        for blocks in [bpy.data.meshes,bpy.data.curves]:
            for block in list(blocks):
                if block.users==0:blocks.remove(block)
        g.collection=bpy.data.collections['AUTHORING'];g.STATIC={};g.DOMAIN={};g.NORMAL_CHECKS=[];g.MATERIALS={}
        bpy.context.scene.unit_settings.system='METRIC';bpy.context.scene.unit_settings.scale_length=1
        for name,metal,rough in [('Graphite',0,.50),('Steel',1,.34),('Trim',1,.28),('Dark',0,.76),('Copper',1,.32),('Amber',0,.4),('Platform',0,.78),('Grille',0,.55)]:g.material(name,metal,rough)
        normal=bpy.data.images.load(str(HERE/'surface-normal.png'),check_existing=False)
        orm=bpy.data.images.load(str(HERE/'surface-orm.png'),check_existing=False)
        normal.colorspace_settings.name='Non-Color';orm.colorspace_settings.name='Non-Color';normal.pack();orm.pack()
        labels=bpy.data.images.load(str(HERE/'surface-color.png'),check_existing=False);labels.pack()
        bind(g.MATERIALS,normal,orm,labels,masked=(kind=='rack'))
        system='workloads' if kind=='rack' else 'cooling'
        root=g.semantic(g.empty('GN_SPECIMEN_ROOT'),'GN_SPECIMEN_ROOT',system,'specimen_root')
        parts=[]
        def part(identity,label,role,connections):
            obj=g.semantic(g.empty(identity,root),identity,system,'specimen_part')
            parts.append({'id':identity,'index':len(parts),'label':label,'role':role,'objectId':identity,'connections':connections,'object':obj})
            return obj
        box=g.box;cy=g.cylinder;tube=g.tube;ring=g.ring;panel=g.panel
        def pierced_flange(name,x,y,z,parent):
            """A real bored hole through a thin rectangular mounting flange."""
            import math
            vertices=[];faces=[];steps=12
            for yy in [y-.004,y+.004]:
                for inner in [False,True]:
                    for i in range(steps):
                        angle=i*math.tau/steps;cx=math.cos(angle);sz=math.sin(angle)
                        radius=.0065 if inner else min(.018/max(abs(cx),1e-8),.037/max(abs(sz),1e-8))
                        vertices.append((x+cx*radius,yy,z+sz*radius))
            for i in range(steps):
                j=(i+1)%steps
                faces.extend([(i,j,steps+j,steps+i),(2*steps+i,3*steps+i,3*steps+j,2*steps+j),
                              (i,2*steps+i,2*steps+j,j),(steps+i,steps+j,3*steps+j,3*steps+i)])
            return g.mesh(name,vertices,faces,'Steel',parent)
        if kind=='rack':
            frame=part('GN_RACK_FRAME','Load-bearing frame','structural_frame',['GN_RACK_PANEL','GN_RACK_DOOR','GN_RACK_SERVERS','GN_RACK_TRAY','GN_RACK_POWER'])
            side=part('GN_RACK_PANEL','Removable side panel','removable_panel',['GN_RACK_FRAME'])
            door=part('GN_RACK_DOOR','Perforated front door','front_door',['GN_RACK_FRAME'])
            servers=part('GN_RACK_SERVERS','Server tray bank','server_trays',['GN_RACK_FRAME','GN_RACK_POWER'])
            tray=part('GN_RACK_TRAY','Representative service tray','service_tray',['GN_RACK_FRAME','GN_RACK_POWER'])
            power=part('GN_RACK_POWER','Single-feed distribution and cable management','illustrative_electrical',['GN_RACK_SERVERS','GN_RACK_TRAY'])
            box('Specimen display plinth',(0,0,.035),(1.12,1.44,.07),'Platform',frame,.022)
            from rack_kit import ENVELOPE,enclosure,front_module
            enclosure(g,frame,(0,0),.13,side_parent=side,door_parent=door,detail=True,articulated=True)
            from rack_motion import author_door
            author_door(g,frame,door)
            for x in [-.29,.29]:
                for y in [-.47,.47]:box('Leveling foot',(x,y,.11),(.09,.10,.08),'Dark',frame)
            for z in [.35,2.45]:cy('Panel captive latch',(.389,-.32,z),(.401,-.32,z),.022,'Steel',side,sides=10)
            from rack_kit import front_module,stationary_module_core
            for slot in range(8):
                z=.33+slot*.287
                body=tray if slot==4 else servers
                for x in [-.322,.322]:
                    for dz in [-.052,.052]:pierced_flange('Pierced rack mounting flange',x*1.10,-.518,z+dz,frame)
                if slot!=4:
                    stationary_module_core(g,frame,body,z)
                else:
                    for x in [-.322,.322]:
                        box('Tray supporting rail',(x,-.005,z-.102),(.029,.82,.016),'Steel',frame)
                        box('Telescoping tray slide',(x*.92,-.055,z-.055),(.016,.78,.022),'Trim',body)
                        for y in [-.37,-.02,.29]:
                            sign=1 if x>0 else -1
                            cy('Tray side captive screw',(x-sign*.006,y,z+.035),(x+sign*.003,y,z+.035),.008,'Trim',body,sides=8)
                    box('Service tray base',(0,-.075,z-.072),(.624,.83,.018),'Steel',body,.005)
                    for x in [-.307,.307]:box('Service tray sidewall',(x,-.075,z+.002),(.018,.83,.16),'Graphite',body,.005)
                    box('Service tray circuit carrier',(0,-.075,z-.052),(.55,.78,.014),'Dark',body,.002)
                    for x in [-.13,.13]:
                        for y in [-.36,-.02]:
                            box('Illustrative heat spreader',(x,y,z-.02),(.16,.14,.05),'Steel',body,.004)
                            for fin in range(5):box('Heat spreader fin',(x-.06+fin*.03,y,z+.027),(.007,.14,.06),'Trim',body)
                    # Insulating bodies with a restrained recessed contact face,
                    # inside the original connector envelope. These are symbolic
                    # service interfaces, not solid blocks of exposed copper.
                    for x in [-.22,-.12,-.02,.08,.18]:
                        box('Module connector insulating housing',(x,.276,z-.015),(.035,.036,.045),'Dark',body)
                        panel('Module connector exposed contact',(x,.2575,z-.012),.023,.012,'Copper',body,surface='copper')
                    for x in [-.25,.25]:
                        for y in [-.43,.26]:cy('Circuit carrier standoff',(x,y,z-.055),(x,y,z-.025),.009,'Copper',body,sides=8)
                front_module(g,body,(0,-.564,z),.635,.218,'compute' if slot%3 else 'carrier',detail=True)
                led=g.semantic(g.empty(f'GN_SPECIMEN_LED_{slot:02d}',body),f'GN_SPECIMEN_LED_{slot:02d}','workloads','activity_led');led.location=(.214,-.589,z+.045)
                # The service tray is shown isolated: its supply plug is parked
                # on the fixed rail, visibly disconnected from the tray inlet.
                # No cable is parented across the moving/fixed boundary.
                endpoint=(.335,.365,z)
                tube('Terminated server supply lead',[(.337,.445,z),(.29,.445,z),(.29,.365,z),endpoint],.009,'Dark',power,sides=6)
                # The fixed parked plug and moving receiver use separate roots.
                # All housings remain inside the old 35x40x32mm plug envelope;
                # the dark rear strain relief sits within the existing cable run.
                box('Parked disconnected service plug' if slot==4 else 'Rail-mounted service connector',(.335,.3635,z),(.035,.035,.032),'Dark',power)
                for dx in [-.006,.006]:panel('Plug exposed contact',(.335+dx,.3455,z),.009,.014,'Copper',power,surface='copper')
                if slot==4:
                    cy('Parked plug strain relief',(.3015,.365,z),(.3175,.365,z),.006,'Dark',power,sides=6)
                    box('Isolated service tray inlet',(.3052,.314,z),(.0224,.024,.032),'Dark',tray)
                    for dy in [-.0045,.0045]:panel('Service inlet contact',(.3165,.314+dy,z),.003,.014,'Copper',tray,side='side',surface='copper')
            box('Single-feed rear PDU',(.337,.47,1.42),(.056,.065,2.28),'Dark',power,.008)
            tube('Roof inlet to PDU',[(.24,.40,2.725),(.24,.40,2.64),(.337,.40,2.64),(.337,.47,2.56)],.014,'Copper',power,sides=8)
            box('Roof inlet enclosure',(.24,.40,2.725),(.09,.09,.05),'Graphite',power,.006)
            for z in [.5,.92,1.35,1.77]:box('Cable saddle',(.285,.44,z),(.12,.022,.035),'Steel',power)
            for z in [.4,.82,1.25,1.67]:
                tube('Cable management service loop',[(.29,.40,z),(.22,.40,z),(.22,.33,z-.07),(.29,.33,z-.09),(.337,.40,z-.09)],.009,'Dark',power,sides=6)
                box('Cable comb',(.255,.33,z-.07),(.11,.032,.023),'Graphite',power)
            closed_camera={'camera':[3.2,2.7,4.0],'target':[0,1.10,0],'padding':1.12}
            cut_camera={'camera':[3.3,2.5,4.0],'target':[0,1.08,0],'padding':1.12}
            service_camera={'camera':[3.0,4.8,3.8],'target':[0,1.10,.14],'padding':1.12}
            hidden={'GN_RACK_PANEL'}
            translations={'GN_RACK_TRAY':[0,0,.18]}
        else:
            frame=part('GN_COOLER_FRAME','Hollow structural casing and plenum','structural_frame',['GN_COOLER_PANEL','GN_COOLER_COIL','GN_COOLER_FAN'])
            side=part('GN_COOLER_PANEL','Removable service panels','removable_panel',['GN_COOLER_FRAME'])
            coil=part('GN_COOLER_COIL','Illustrative fin-and-tube heat exchanger','heat_exchanger',['GN_COOLER_MANIFOLD'])
            manifold=part('GN_COOLER_MANIFOLD','Paired liquid service headers','illustrative_liquid_circuit',['GN_COOLER_COIL'])
            fan=part('GN_COOLER_FAN','Axial fan and motor support','fan_assembly',['GN_COOLER_FRAME','GN_COOLER_GUARD'])
            guard=part('GN_COOLER_GUARD','Stationary fan guard','stationary_guard',['GN_COOLER_FAN'])
            box('Specimen display plinth',(0,0,.035),(1.32,1.31,.07),'Platform',frame,.02)
            for x in [-.51,.51]:
                for y in [-.45,.45]:box('Cooling structural upright',(x,y,1.08),(.05,.05,1.94),'Steel',frame,.01)
                box('Cooling mounting rail',(x,0,.13),(.08,.98,.10),'Graphite',frame,.012)
            casing=box('Cooling fixed left wall',(-.542,0,1.05),(.024,.95,1.80),'Graphite',frame,.022)
            casing['gnSpatialRegion']='cooler_panel';casing['gnSpatialAxis']=0
            box('Cooling fixed back wall',(0,.48,1.05),(1.07,.024,1.80),'Graphite',frame,.022)
            casing=box('Cooling removable right wall',(.542,0,1.05),(.024,.95,1.80),'Graphite',side,.022)
            casing['gnSpatialRegion']='cooler_panel';casing['gnSpatialAxis']=0
            for z in [.17,1.94]:box('Cooling front service frame',(0,-.48,z),(1.07,.026,.035),'Graphite',side,.008)
            for x in [-.52,.52]:box('Cooling front side frame',(x,-.48,1.05),(.035,.026,1.80),'Graphite',side,.008)
            panel('Cooling intake grille',(0,-.493,1.02),.98,1.66,'Grille',side,repeat=4,surface='coil')
            for z in [.30,1.78]:cy('Service captive fastener',(.548,-.31,z),(.562,-.31,z),.026,'Trim',side,sides=10)
            for z in [.29,1.60]:box('Coil retaining bracket',(0,-.07,z),(.93,.61,.035),'Graphite',coil,.01)
            # Real separated fin plates and a continuous serpentine tube; the
            # geometric topology is illustrative, without thermal performance.
            for i in range(30):box('Cooling fin plate',(-.435+i*.03,-.04,.945),(.006,.55,1.24),'Steel',coil)
            path=[]
            for row in range(12):
                z=.37+row*.104
                if row%2==0:path.extend([(-.45,-.10,z),(.45,-.10,z)])
                else:path.extend([(.45,-.10,z),(-.45,-.10,z)])
            tube('Continuous illustrative coil tube',path,.015,'Copper',coil,sides=8)
            for circuit,z in [('inlet',.37),('outlet',1.514)]:
                yy=.36 if circuit=='inlet' else .43
                tube('Coil '+circuit+' service connection',[(-.45,-.10,z),(-.49,-.10,z),(-.49,yy,z),(.47,yy,z),(.47,yy,.23)],.021,'Copper',manifold,sides=10)
                cy('External '+circuit+' stub',(.47,yy,.12),(.47,yy,.25),.032,'Steel',manifold,sides=12)
                box('Manual service valve body',(.47,yy,.33),(.064,.055,.09),'Copper',manifold,.008)
                box('Valve lever',(.46,yy,.34),(.14,.022,.022),'Trim',manifold)
                for zz in [.65,1.1]:box('Header clamp',(.47,yy,zz),(.064,.054,.025),'Dark',manifold)
            # An open deck built around the aperture instead of a solid cube
            # makes the fan/plenum opening genuinely visible in the cutaway.
            for x in [-.475,.475]:box('Fan deck side',(x,0,1.995),(.12,1.02,.04),'Graphite',frame,.012)
            for y in [-.46,.46]:box('Fan deck end',(0,y,1.995),(.86,.10,.04),'Graphite',frame,.01)
            ring('Fan circular shroud',(0,0,2.02),.423,.026,'Steel',fan,segments=40)
            cy('Fan motor',(0,0,1.90),(0,0,2.055),.09,'Graphite',fan,sides=20)
            for x in [-1,1]:cy('Motor support',(x*.40,0,1.94),(0,0,1.94),.013,'Steel',fan,sides=8)
            import math
            vertices=[];faces=[]
            for blade in range(5):
                a=blade*math.tau/5;start=len(vertices)
                for skin in [-1,1]:
                    for radial in range(5):
                        t=radial/4;r=.09+t*.31
                        for chord in range(3):
                            u=chord/2-.5;y=u*(.13+.07*t)+t*t*.045
                            vertices.append((math.cos(a)*r-math.sin(a)*y,math.sin(a)*r+math.cos(a)*y,u*.04+skin*.003))
                for layer in range(2):
                    for row in range(4):
                        for col in range(2):
                            v=start+layer*15+row*3+col;face=(v,v+1,v+4,v+3);faces.append(tuple(reversed(face)) if layer else face)
                for row in range(4):
                    for col in [0,2]:
                        v=start+row*3+col;face=(v,v+3,v+18,v+15);faces.append(face if col==0 else tuple(reversed(face)))
                for row in [0,4]:
                    for col in range(2):
                        v=start+row*3+col;face=(v,v+1,v+16,v+15);faces.append(tuple(reversed(face)) if row==0 else face)
            rotor=g.mesh('GN_SPECIMEN_FAN_ROTOR',vertices,faces,'Trim',fan,smooth=True,static=False)
            rotor.location=(0,0,2.033);g.semantic(rotor,rotor.name,'cooling','fan_rotor')
            for radius in [.15,.24,.33,.42]:ring('Stationary fan guard',(0,0,2.085),radius,.006,'Steel',guard,segments=40)
            for i in range(4):
                a=i*math.tau/4;cy('Guard support',(0,0,2.085),(.423*math.cos(a),.423*math.sin(a),2.085),.008,'Steel',guard,sides=8)
            closed_camera={'camera':[3.4,2.7,4.0],'target':[0,1.10,0],'padding':1.12}
            cut_camera={'camera':[3.4,2.5,4.0],'target':[0,1.10,0],'padding':1.12}
            service_camera={'camera':[2.2,2.8,5.2],'target':[.06,1.0,.04],'padding':1.12}
            hidden={'GN_COOLER_PANEL'}
            translations={}
        bpy.context.view_layer.update()
        # Each independent part retains one transform root; all surfaces under
        # it are concatenated per material, preserving normals and selection IDs.
        for item in parts:
            meshes=[obj for obj in g.collection.objects if obj.type=='MESH' and obj.parent==item['object']]
            points=[obj.matrix_world@Vector(p) for obj in meshes for p in obj.bound_box]
            item['bounds']=bounds_yup(points)
            for obj in meshes:obj['gnEquipmentIndex']=item['index']
        for obj in bpy.data.collections['AUTHORING_MANUAL'].objects:
            if obj.type!='MESH':continue
            target=obj.get('gnPartId');part_obj=next((p['object'] for p in parts if p['id']==target),None)
            if part_obj is None or len(obj.data.materials)!=1 or obj.data.materials[0].name not in g.MATERIALS:raise ValueError('Manual specimen mesh requires gnPartId and one palette material')
            obj['gnEquipmentIndex']=next(p['index'] for p in parts if p['id']==target)
            g.STATIC.setdefault((part_obj.name,obj.data.materials[0].name),[]).append(obj)
        for item in parts:
            meshes=[obj for obj in [*g.collection.objects,*bpy.data.collections['AUTHORING_MANUAL'].objects] if obj.type=='MESH' and (obj.parent==item['object'] or obj.get('gnPartId')==item['id'])]
            item['bounds']=bounds_yup([obj.matrix_world@Vector(p) for obj in meshes for p in obj.bound_box])
        metadata={'schemaVersion':'facility-specimen.v1','kind':kind,'system':system,
                  'parts':[{k:v for k,v in item.items() if k!='object'} for item in parts],'poses':{}}
        for pose,camera in [('closed',closed_camera),('cutaway',cut_camera),('service',service_camera)]:
            metadata['poses'][pose]={'camera':camera,'transforms':[{'id':p['objectId'],'position':translations.get(p['id'],[0,0,0]) if pose=='service' else [0,0,0],'visible':pose=='closed' or p['id'] not in hidden} for p in parts]}
        if kind=='rack':
            from rack_motion import motion_metadata,validate_authoring
            metadata['rackMotion']=motion_metadata()
            motion_report=validate_authoring(g,parts,metadata['rackMotion'])
            metadata['rackMotion']['fitBounds']=motion_report['fitBounds']
            for pose in metadata['poses'].values():
                next(t for t in pose['transforms'] if t['id']=='GN_RACK_DOOR')['position']=metadata['rackMotion']['hingePosition']
            metadata['rackMotion'].pop('hingePosition')
        root['gnSpecimen']=json.dumps(metadata,separators=(',',':'))
        g.collection=bpy.data.collections['EXPORT'];roots={}
        for original in [root,*[p['object'] for p in parts]]:
            clone=original.copy();g.collection.objects.link(clone);roots[original.name]=clone;clone.parent=roots.get(original.parent.name) if original.parent else None
        # merge_export historically returns GN_EXPORT; the alias does not add a
        # scene node and leaves the independent specimen root identity intact.
        roots['GN_EXPORT']=roots['GN_SPECIMEN_ROOT'];g.merge_export(g.collection,roots)
        if kind=='rack':
            from rack_motion import localize_door
            localize_door(roots['GN_RACK_DOOR'])
        for identity,clone in roots.items():
            if identity=='GN_EXPORT':continue
            original=bpy.data.objects.get(identity)
            if original and original!=clone:original.name=identity+'.AUTHORING'
            clone.name=identity
        for obj in list(g.collection.objects):
            if obj.get('gnRole') in ['fan_rotor','activity_led']:
                original=bpy.data.objects.get(obj['gnId'])
                if original and original!=obj:original.name=obj['gnId']+'.AUTHORING'
                obj.name=obj['gnId']
        bpy.data.collections['AUTHORING'].hide_render=True;bpy.data.collections['AUTHORING'].hide_viewport=True
        bpy.data.collections['AUTHORING_MANUAL'].hide_render=True;bpy.data.collections['AUTHORING_MANUAL'].hide_viewport=True
        if bpy.context.scene.world is None:bpy.context.scene.world=bpy.data.worlds.new('Specimen studio world')
        g.setup_review()
        bpy.ops.wm.save_as_mainfile(filepath=str(master),compress=True)
        profile=copy.deepcopy(json.loads((HERE/'render-profile.json').read_text()));profile.update(closed_camera);profile.pop('ecosystem',None);profile.pop('inspection',None)
        if profile['lighting'].get('finite'):
            profile['lighting']['finite'].update(position=[2.4,.45,-1.7] if kind=='rack' else [2.4,1.5,-2.0],intensity=3 if kind=='rack' else 6)
        profile['led']['size']=[.018,.012,.012]
        required=['GN_SPECIMEN_ROOT',*[p['id'] for p in parts]]
        descriptor={'kind':kind,'label':'Representative rack construction' if kind=='rack' else 'Illustrative cooling assembly','system':system,'profile':profile,'requiredIds':required}
        descriptors[kind]=descriptor
        export_specimen(out/f'{kind}.glb',master,descriptor)
        if kind=='rack':
            motion_report['modelSha256']=hashlib.sha256((out/'rack.glb').read_bytes()).hexdigest()
            motion_report['sourceModules']=source_modules(HERE)
            (out/'rack-motion-validation.json').write_text(json.dumps(motion_report,indent=2)+'\n')
        (out/f'{kind}-metadata.json').write_text(json.dumps(metadata,indent=2)+'\n')
    (out/'specimen-descriptors.json').write_text(json.dumps(descriptors,indent=2)+'\n')


def export_specimen(destination,master,descriptor):
    import export
    from engineering_metadata import source_modules
    destination=Path(destination);objects=list(bpy.data.collections['EXPORT'].objects)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:obj.select_set(True)
    root=next(obj for obj in objects if obj.get('gnId')=='GN_SPECIMEN_ROOT');bpy.context.view_layer.objects.active=root
    bpy.ops.export_scene.gltf(filepath=str(destination),export_format='GLB',use_selection=True,export_extras=True,export_yup=True,export_animations=False,export_cameras=False,export_lights=False,export_apply=False,export_materials='EXPORT',export_gpu_instances=False,export_texcoords=True,export_normals=True,export_tangents=False,export_attributes=True)
    raw=export.share_buffer_views(export.weld_exact_vertices(export.finish_surfaces(export.share_texture_descriptors(destination.read_bytes()))));destination.write_bytes(raw)
    data=json.loads(raw[20:20+struct.unpack_from('<I',raw,12)[0]])
    primitives=[p for mesh in data.get('meshes',[]) for p in mesh['primitives']]
    triangles=sum(data['accessors'][p['indices']]['count']//3 for p in primitives)
    kind=descriptor['kind'];ceiling=24000 if kind=='rack' else 18000;draw_ceiling=35 if kind=='rack' else 30
    draws=len(primitives)+(1 if kind=='rack' else 0)
    if len(raw)>1000000 or triangles>ceiling or draws>draw_ceiling:raise ValueError(f'{kind} specimen budget exceeded: {len(raw)} bytes, {triangles} triangles, {draws} draws')
    report={'schemaVersion':1,'kind':kind,'blenderVersion':bpy.app.version_string,'blenderBuildHash':bpy.app.build_hash.decode(),
            'source':str(master.relative_to(HERE.parent.parent)),'sourceSha256':hashlib.sha256(master.read_bytes()).hexdigest(),
            'generatorSha256':hashlib.sha256((HERE/'generate.py').read_bytes()).hexdigest(),'sourceModules':source_modules(HERE),
            'exportBytes':len(raw),'gzipBytes':len(gzip.compress(raw,compresslevel=9,mtime=0)),'gzipLevel':9,'sha256':hashlib.sha256(raw).hexdigest(),
            'embeddedImages':export.embedded_images(raw),'renderedTriangles':triangles,'meshDrawCalls':len(primitives),'drawCallsWithLedInstances':draws,'materialCount':len(data['materials']),
            'semanticIds':sorted(n['extras']['gnId'] for n in data['nodes'] if n.get('extras',{}).get('gnId')),'profile':descriptor['profile'],
            'constructionChecks':{'hollowCasing':True,'independentPanelThicknessMetres':.016 if kind=='rack' else .024,'independentPartRoots':6,'serviceTrayTravelMetres':.18 if kind=='rack' else 0,'ratingsOrTelemetry':False}}
    (destination.parent/f'{kind}-asset-report.json').write_text(json.dumps(report,indent=2)+'\n')
    print('SPECIMEN_EXPORT '+json.dumps({key:report[key] for key in ['kind','exportBytes','renderedTriangles','drawCallsWithLedInstances','materialCount','sha256']}))


if __name__=='__main__':
    import argparse,os
    if bpy.app.version!=(5,2,2) or bpy.app.build_hash.decode()!='d13f752e3b9c':raise RuntimeError('Pinned Blender required')
    parser=argparse.ArgumentParser();parser.add_argument('--out',required=True);parser.add_argument('--reexport',choices=['rack','cooling']);parser.add_argument('--only',choices=['rack','cooling'])
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:]);out=Path(args.out).resolve();out.mkdir(parents=True,exist_ok=True)
    lock=HERE/'generation.lock';fd=os.open(lock,os.O_CREAT|os.O_EXCL|os.O_WRONLY);os.close(fd)
    try:
        if args.reexport:
            kind=args.reexport;descriptor=json.loads((out/'specimen-descriptors.json').read_text())[kind]
            export_specimen(out/f'{kind}.glb',HERE/f'{kind}-specimen.blend',descriptor)
        else:build_all(out,(args.only,) if args.only else ('rack','cooling'))
    finally:lock.unlink(missing_ok=True)
