"""Deterministic, editable GridNinja facility. Blender 5.2.2 LTS, no add-ons.

  /Applications/Blender.app/Contents/MacOS/Blender --background --python \
    assets-source/facility/generate.py -- --out build/facility

Existing AUTHORING_MANUAL and REFERENCE collections survive regeneration.
Generated geometry is editable in AUTHORING; EXPORT contains optimized clones.
The scene is illustrative; its dimensions and equipment convey no capacity claim.
"""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import sys

import bpy
from mathutils import Matrix, Vector

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))
from surface_contract import (REVISION as SURFACE_REVISION, MATERIAL_REGIONS,
                              bounds as surface_bounds, metric_size, segmented_box,
                              surface_spec, tile_uv, contact_frame as author_contact_frame,
                              validate_contact_frame)
CONFIG = json.loads((HERE / 'scene.json').read_text())
MASTER = HERE / 'facility-master.blend'
TAU = math.tau
MATERIALS = {}
DOMAIN = {}
STATIC = {}
collection = None
BENCHMARK = False
NORMAL_CHECKS = []
COOLER_CIRCUITS = {}
ROW_Y = [-1.35,.90]
REAR_LIFT = .12
RESERVE_POSITIONS = [(3.40,-2.18),(4.28,-1.55)]


def srgb(value):
    return value / 12.92 if value < 0.04045 else ((value + 0.055) / 1.055) ** 2.4


def encode_srgb(value):
    return value*12.92 if value<.0031308 else 1.055*value**(1/2.4)-.055


def color(hex_value):
    return tuple(srgb(int(hex_value[i:i + 2], 16) / 255) for i in (1, 3, 5)) + (1,)


def semantic(obj, identity, domain=None, role=None):
    obj['gnId'] = identity
    if domain:
        obj['gnDomain'] = domain
    if role:
        obj['gnRole'] = role
        if role == 'fan_rotor':
            obj['gnMotionGroup'] = identity
    return obj


def link(obj, parent=None):
    collection.objects.link(obj)
    if parent:
        obj.parent = parent
    return obj


def empty(name, parent=None):
    return link(bpy.data.objects.new(name, None), parent)


def surface_metadata(obj, region):
    """Record physical surface intent without relying on object-name matching."""
    spec = surface_spec(region)
    obj['gnSurfaceContract'] = SURFACE_REVISION
    obj['gnSurfaceRegion'] = region
    obj['gnSurfaceTileMetres'] = list(spec.metric_size)
    obj['gnSurfaceSeed'] = str(spec.seed)
    obj['gnBakeReceiverFamily'] = spec.receiver_family
    return obj


def motion_group(parent):
    moving = {'GN_RACK_DOOR', 'GN_RACK_TRAY', 'GN_RACK_PANEL',
              'GN_COOLER_PANEL', 'GN_AIR_SECTION_COVERS'}
    while parent:
        identity = parent.get('gnId')
        if identity in moving or parent.get('gnRole') == 'fan_rotor':
            return identity
        parent = parent.parent
    return 'static'


def spatial_receiver(obj, region, axis, sign, origin, u, v, size):
    """An authored, outward receiver frame in the mesh's local metric space."""
    obj['gnSpatialRegion'] = region
    obj['gnSpatialAxis'] = axis
    obj['gnSpatialSign'] = sign
    obj['gnBakeReceiverFamily'] = region
    obj['gnBakeReceiverAxis'] = axis
    obj['gnBakeReceiverSign'] = sign
    obj['gnBakeFrame'] = json.dumps({'origin': list(origin), 'u': list(u),
                                   'v': list(v), 'size': list(size)}, separators=(',', ':'))
    return obj


def add_surface_frame(obj, region, axis, sign, origin, u, v, size):
    """Scalar contact fields may mirror; geometry and normal-map frames do not."""
    frame = author_contact_frame(region, axis, sign, origin, u, v, size)
    frames=json.loads(obj.get('gnSurfaceFrames','[]'));frames.append(frame)
    obj['gnSurfaceFrames']=json.dumps(frames,separators=(',',':'))
    return frame


def material(name, metallic, roughness):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    for node in list(nodes):
        if node.type not in {'BSDF_PRINCIPLED', 'OUTPUT_MATERIAL'}:
            nodes.remove(node)
    bsdf = nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = color(CONFIG['palette'][name])
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    if name == 'Amber':
        bsdf.inputs['Emission Color'].default_value = color(CONFIG['palette'][name])
        bsdf.inputs['Emission Strength'].default_value = 0.32
    mat.diffuse_color = color(CONFIG['palette'][name])
    roles={'Graphite':'powder-coat','Steel':'bare-metal','Trim':'bare-metal','Dark':'rubber','Copper':'copper','Amber':'indicator','Platform':'platform','Grille':'grille'}
    mat['gnSurfaceRole']=roles[name]
    mat.use_backface_culling=True
    MATERIALS[name] = mat
    return mat


def make_atlas():
    """Bake sub-pixel perforation / machining detail into one shared 128px tile."""
    size = 128
    img = bpy.data.images.get('GN_SharedPerforation')
    if img:
        bpy.data.images.remove(img)
    img = bpy.data.images.new('GN_SharedPerforation', size, size, alpha=False)
    pixels = []
    for y in range(size):
        for x in range(size):
            row = y // 8
            px = (x + (4 if row % 2 else 0)) % 8 - 4
            py = y % 8 - 4
            d = math.sqrt(px * px + py * py)
            v = 0.16 if d < 2.1 else 0.44 if d < 2.8 else 0.65
            v += (((x * 17 + y * 29) % 13) - 6) * 0.002
            # Keep grille luminance variations within the approved neutral
            # graphite palette rather than baking a blue tint into the image.
            base=tuple(int(CONFIG['palette']['Grille'][i:i+2],16)/255 for i in (1,3,5))
            pixels.extend((v*base[0],v*base[1],v*base[2],1))
    img.pixels.foreach_set(pixels)
    img.filepath_raw = str(HERE / 'perforation-atlas.png')
    img.file_format = 'PNG'
    img.save()
    img.pack()
    tex = MATERIALS['Grille'].node_tree.nodes.new('ShaderNodeTexImage')
    tex.image = img
    tex.extension = 'REPEAT'
    tex.interpolation = 'Linear'
    bsdf = MATERIALS['Grille'].node_tree.nodes.get('Principled BSDF')
    MATERIALS['Grille'].node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])


def make_contact_atlas():
    """Analytically bake soft equipment contact footprints, with no runtime pass.

    Two 256px regions share one texture: the foundation and raised rack plinth.
    Other steel surfaces sample a neutral corner texel. These deliberately soft
    color variations convey contact, not simulated light or measured conditions.
    """
    width,height=512,256
    image=bpy.data.images.get('GN_SharedContactAtlas')
    if image:bpy.data.images.remove(image)
    image=bpy.data.images.new('GN_SharedContactAtlas',width,height,alpha=False)
    # x, y, half-width, half-depth, softness, strength
    floor=[(0,-.2,3.14,2.19,.16,.32)]
    floor += [(-4.11+i*.67,-.29,.32,.52,.22,.46) for i in range(3)]
    floor += [(-2.145+i*1.43,2.39,.63,.56,.22,.45) for i in range(4)]
    floor += [(3.61+i*.75,-2.03,.355,.68,.25,.50) for i in range(2)]
    rack_footprints=[(-2.275+i*.91,y,.39,.62,.16,.52)
                     for y in [-1.1,.77] for i in range(6)]
    palette={name:color(CONFIG['palette'][name]) for name in ['Platform','Steel']}
    pixels=[]
    for j in range(height):
        for i in range(width):
            steel=i>=256
            local_i=i-256 if steel else i
            x=(local_i/255-.5)*(6.28 if steel else 10.8)
            y=(j/255-.5)*(4.38 if steel else 7.6)-(.2 if steel else 0)
            shade=1.0
            for cx,cy,hx,hy,softness,strength in (rack_footprints if steel else floor):
                dx=max(abs(x-cx)-hx,0)
                dy=max(abs(y-cy)-hy,0)
                shade*=1-strength*math.exp(-(dx*dx+dy*dy)/(2*softness*softness))
            shade=max(.35,shade)
            if steel and i>=510 and j>=254:shade=1.0
            base=palette['Steel' if steel else 'Platform']
            # Generated byte images save their assigned values directly; encode
            # linear-light attenuation before writing the sRGB PNG samples.
            pixels.extend((encode_srgb(base[0]*shade),encode_srgb(base[1]*shade),encode_srgb(base[2]*shade),1))
    image.pixels.foreach_set(pixels)
    image.filepath_raw=str(HERE/'contact-atlas.png')
    image.file_format='PNG';image.save();image.pack()
    for name in ['Platform','Steel']:
        material=MATERIALS[name]
        tex=material.node_tree.nodes.new('ShaderNodeTexImage')
        tex.image=image;tex.extension='EXTEND';tex.interpolation='Linear'
        material.node_tree.links.new(tex.outputs['Color'],material.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])


def mesh(name, verts, faces, mat, parent, bevel=0, smooth=False, static=True, bevel_segments=1):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.materials.append(MATERIALS[mat])
    data.update()
    obj = link(bpy.data.objects.new(name, data), parent)
    surface_metadata(obj, MATERIAL_REGIONS.get(mat, 'neutral'))
    obj['gnMotionGroup'] = motion_group(parent)
    lows,highs=surface_bounds(verts)
    if mat in {'Steel','Trim','Dark','Copper'} and max(highs[k]-lows[k] for k in range(3))<=.075:
        obj['gnSurfaceUniform']='sub-75mm uniform manufactured part'
    if bevel:
        mod = obj.modifiers.new('Industrial edge chamfer', 'BEVEL')
        mod.width = bevel
        mod.segments = bevel_segments
        mod.affect = 'EDGES'
        mod.limit_method = 'ANGLE'
        mod.angle_limit = math.radians(30)
        mod.harden_normals = True
        normals = obj.modifiers.new('Weighted panel normals', 'WEIGHTED_NORMAL')
        normals.keep_sharp = True
        normals.weight = 50
    if smooth:
        for poly in data.polygons:
            poly.use_smooth = True
    if static:
        STATIC.setdefault((parent.name, mat), []).append(obj)
    return obj


def box(name, p, size, mat, parent, bevel=0, static=True, bevel_segments=1, keep_bevel=False):
    x, y, z = size
    # Tiny release tabs, seams and support feet project below a pixel in the
    # fixed website view; keep their silhouette without spending bevel rings.
    if not keep_bevel and max(size)<.7 and bevel<=.009:bevel=0
    verts = [(p[0] + sx*x/2, p[1] + sy*y/2, p[2] + sz*z/2)
             for sx, sy, sz in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),
                                (-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
    faces = [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
    region = MATERIAL_REGIONS.get(mat, 'neutral')
    extent = metric_size(region)
    split = surface_spec(region).mapping == 'metric' and max(size) > min(extent) + 1e-7
    if split:
        verts, faces = segmented_box(p, size, extent)
    obj = mesh(name, verts, faces, mat, parent, bevel, static=static, bevel_segments=bevel_segments)
    if split:
        obj['gnSurfaceSegmented'] = True
        obj['gnSurfaceOriginalTriangles'] = 12
        obj['gnSurfaceAuthoredTriangles'] = sum(len(face) - 2 for face in faces)
    return obj


def cylinder(name, a, b, radius, mat, parent, sides=12, static=True):
    a, b = Vector(a), Vector(b)
    axis = (b-a).normalized()
    u = axis.cross(Vector((0,0,1)))
    if u.length < .01:
        u = axis.cross(Vector((0,1,0)))
    u.normalize()
    v = axis.cross(u)
    verts = [p + radius*(u*math.cos(TAU*i/sides) + v*math.sin(TAU*i/sides))
             for p in [a,b] for i in range(sides)]
    faces = [(i,(i+1)%sides,(i+1)%sides+sides,i+sides) for i in range(sides)]
    faces += [tuple(reversed(range(sides))), tuple(range(sides,2*sides))]
    obj=mesh(name, verts, faces, mat, parent, smooth=True, static=static)
    if mat in {'Steel','Trim','Dark','Copper'} and radius*2<=.06:
        obj['gnSurfaceUniform']='sub-60mm constant-section rod or cable'
    return obj


def tube(name, path, radius, mat, parent, sides=8):
    # Mitered joins are one continuous watertight pipe, not intersecting segments.
    verts = [];previous_axis=None;previous_u=None
    for i,p in enumerate(path):
        p=Vector(p)
        before=p-Vector(path[i-1]) if i else Vector(path[1])-p
        after=Vector(path[i+1])-p if i<len(path)-1 else before
        axis=(before.normalized()+after.normalized()).normalized()
        if axis.length<.1:raise ValueError('Tube centerline doubles back without a bend radius')
        if previous_axis is None:
            reference=min([Vector((1,0,0)),Vector((0,1,0)),Vector((0,0,1))],key=lambda v:abs(axis.dot(v)))
            u=axis.cross(reference).normalized()
        else:
            # Minimal rotation transports the cross-section continuously through
            # elbows and serpentine reversals. World-axis recomputation twists
            # neighboring rings by 180 degrees and creates bow-tie surfaces.
            u=previous_axis.rotation_difference(axis)@previous_u
            u=(u-axis*u.dot(axis)).normalized()
        v=axis.cross(u)
        for j in range(sides):verts.append(p+radius*(u*math.cos(TAU*j/sides)+v*math.sin(TAU*j/sides)))
        previous_axis=axis;previous_u=u
    faces = [(i*sides+j,i*sides+(j+1)%sides,(i+1)*sides+(j+1)%sides,(i+1)*sides+j)
             for i in range(len(path)-1) for j in range(sides)]
    faces += [tuple(reversed(range(sides))), tuple(range((len(path)-1)*sides,len(path)*sides))]
    obj=mesh(name, verts, faces, mat, parent, smooth=True)
    if mat in {'Steel','Trim','Dark','Copper'} and radius*2<=.06:
        # These fields have no resolvable surface detail across the section.
        # Constant sampling avoids creating UV seams around smooth cable bends.
        obj['gnSurfaceUniform']='sub-60mm constant-section formed tube or cable'
    return obj


def ring(name, pos, radius, thickness, mat, parent, segments=40, minor=4):
    verts=[]
    for i in range(segments):
        a=TAU*i/segments
        for j in range(minor):
            b=TAU*j/minor
            r=radius+thickness*math.cos(b)
            verts.append((pos[0]+r*math.cos(a),pos[1]+r*math.sin(a),pos[2]+thickness*math.sin(b)))
    faces=[(i*minor+j,((i+1)%segments)*minor+j,((i+1)%segments)*minor+(j+1)%minor,i*minor+(j+1)%minor)
           for i in range(segments) for j in range(minor)]
    obj=mesh(name,verts,faces,mat,parent,smooth=True)
    if mat in {'Steel','Trim','Dark','Copper'} and thickness*2<=.06:
        obj['gnSurfaceUniform']='sub-60mm constant-section formed guard'
    return obj


def panel(name, p, width, height, mat, parent, side='front', repeat=1, surface=None):
    region=surface or MATERIAL_REGIONS.get(mat, 'neutral')
    spec = surface_spec(region)
    extent = (width, height) if spec.mapping == 'fit' else spec.metric_size
    columns=max(1,math.ceil(width/extent[0]));rows=max(1,math.ceil(height/extent[1]))
    vertices=[];faces=[];coords=[]
    for row in range(rows):
        v0=row*extent[1];v1=min(height,v0+extent[1])
        for col in range(columns):
            u0=col*extent[0];u1=min(width,u0+extent[0]);start=len(vertices)
            for u,v in [(u0,v0),(u1,v0),(u1,v1),(u0,v1)]:
                vertices.append((p[0]-width/2+u,p[1],p[2]-height/2+v) if side=='front' else (p[0],p[1]-width/2+u,p[2]-height/2+v))
                coords.append(tile_uv(region,(u-u0)/extent[0],(v-v0)/extent[1]))
            faces.append(tuple(range(start,start+4)))
    obj=mesh(name,vertices,faces,mat,parent)
    surface_metadata(obj, region);obj['gnSurfacePreserveUV']=True
    obj['gnSurfaceWidthMetres']=width;obj['gnSurfaceHeightMetres']=height
    obj['gnSurfaceTileMetres']=list(extent)
    uv=obj.data.uv_layers.new(name='UVMap')
    for loop,co in zip(uv.data,coords):loop.uv=co
    return obj


def legacy_rack(x,y,index):
    existing=set(bpy.data.objects)
    parent=DOMAIN['workloads']
    w,d,h=.78,1.24,2.55
    base=.34
    refined=not BENCHMARK or index==0
    chassis=box(f'Rack {index:02d} chassis',(x,y,base+h/2),(w,d,h),'Graphite',parent,.027,bevel_segments=2 if refined else 1)
    chassis['gnEquipmentId']=f'rack-{index:02d}'
    # Recessed front and back fields, exposed rails, gasket and structural side panels.
    box(f'Rack {index:02d} door inset',(x,y-d/2-.014,1.64),(w-.085,.035,h-.13),'Dark',parent,.011)
    panel(f'Rack {index:02d} door perforations',(x,y-d/2-.034,1.66),w-.14,h-.28,'Grille',parent,repeat=2.8)
    for sign in [-1,1]:
        box(f'Rack {index:02d} frame',(x+sign*(w/2-.03),y-d/2-.04,1.64),(.037,.05,h-.06),'Steel',parent,.006)
        box('Chassis side seam',(x+sign*(w/2+.004),y,1.65),(.014,d-.19,h-.28),'Dark',parent)
    levels=8 if refined and index%2 else 10
    for level in range(levels):
        z=.56+level*(2.16/levels)
        box(f'Rack {index:02d} server sled {level:02d}',(x,y-d/2-.045,z),(w-.18,.036,.028),'Steel',parent)
        box('Sled release',(x-.245,y-d/2-.067,z+.037),(.039,.018,.055),'Trim',parent,.003)
        box('Sled serial plate',(x+.20,y-d/2-.069,z+.043),(.075,.008,.02),'Steel',parent)
        if refined:
            box('Recessed server module',(x,y-d/2-.047,z+.102),(w-.20,.026,.142 if levels==10 else .19),'Graphite',parent,.009)
            box('Server module release pocket',(x-.235,y-d/2-.064,z+.103),(.053,.013,.076),'Dark',parent,.004)
            if level%3==1:
                box('Module blanking panel',(x+.08,y-d/2-.067,z+.10),(.31,.010,.087),'Dark',parent,.003)
    box('Door latch',(x+.29,y-d/2-.075,1.75),(.024,.035,.23),'Trim',parent,.006)
    box('Top lid',(x,y,2.924),(w-.085,d-.09,.058),'Graphite',parent,.018)
    box('Top service inset',(x,y,2.957),(w-.23,d-.25,.008),'Graphite',parent,.018)
    for side in [-1,1]:
        for end in [-1,1]:
            box('Rack levelling foot',(x+side*.29,y+end*.47,.302),(.09,.10,.095),'Dark',parent)
    for led in range(4):
        identity=f'GN_LED_{index*4+led:02d}'
        anchor=semantic(empty(identity,parent),identity,'workloads','activity_led')
        anchor.location=(x+.25,y-d/2-.075,.62+led*.58)
        # Runtime PlaneGeometry is glTF-local +Z facing; the exported anchor is identity.
        anchor.rotation_euler=(0,0,0)
    # Number plates are modest identifying industrial marks, not telemetry.
    box('Rack inventory label',(x-.15,y-d/2-.072,2.79),(.26,.012,.051),'Trim',parent)
    for mark in range((index%3)+1):
        box('Inventory index mark',(x-.24+mark*.075,y-d/2-.082,2.79),(.035,.012,.021),'Dark',parent)
    for obj in set(bpy.data.objects)-existing:
        if obj.type=='MESH':obj['gnEquipmentId']=f'rack-{index:02d}'
        if index>=6:obj.location.z+=REAR_LIFT


def rack(x,y,index):
    # A material benchmark must use the same construction and material batches
    # as its eventual release. The former legacy-rack substitution introduced
    # another draw call and invalidated physical/visual A/B comparisons.
    from rack_kit import overview_rack
    overview_rack(sys.modules[__name__],x,y,index)


def cooler(x,index):
    existing=set(bpy.data.objects)
    parent=DOMAIN['cooling']
    y,z=2.39,1.86
    refined=True
    # V6 air handler: real thin walls, an open frontal return, interior coil,
    # upper plenum and an open fan deck. There is no solid block behind the fan.
    for side in [-1,1]:
        casing=box('Cooling casing side',(x+side*.618,y,z),(.024,1.12,3.04),'Graphite',parent,.002)
        if side > 0:
            spatial_receiver(casing, 'cooler_panel', 0, 1, (x+.630,y-.56,z-1.52),
                             (0,1,0), (0,0,1), (1.12,3.04))
        box('Cooling front rail',(x+side*.55,y-.55,z),(.055,.06,2.99),'Steel',parent)
    box('Cooling casing rear',(x,y+.548,z),(1.212,.024,3.04),'Graphite',parent)
    box('Cooling casing base',(x,y,.352),(1.212,1.072,.024),'Graphite',parent)
    for zz in [.39,3.28]:box('Cooling return opening flange',(x,y-.56,zz),(1.22,.04,.055),'Graphite',parent)
    # Recessed fin receiver and upright fins are downstream of the actual intake.
    for zz in [.80,1.40,2.0,2.60]:panel('Cooling recessed coil band',(x,y-.16,zz),1.04,.51,'Grille',parent,surface='coil')
    for i in range(10):box('Cooling interior fin',(x-.48+i*.106,y+.06,1.75),(.007,.42,2.30),'Steel',parent)
    for zz in [.57,2.92]:box('Coil structural rail',(x,y+.06,zz),(1.10,.45,.022),'Graphite',parent)
    circuit=[(x-.15,2.975,2.81),(x-.15,y+.33,2.81),(x-.45,y+.33,.65),(x-.45,y+.06,.65)]
    for rr in range(4):
        zz=.65+rr*.62
        if rr%2==0:circuit.extend([(x-.45,y+.06,zz),(x+.45,y+.06,zz)])
        else:circuit.extend([(x+.45,y+.06,zz),(x-.45,y+.06,zz)])
    circuit.extend([(x-.45,y+.33,2.51),(x+.15,y+.33,2.81),(x+.15,2.975,2.81)])
    circuit=[point for ii,point in enumerate(circuit) if ii==0 or point!=circuit[ii-1]]
    tube('Cooling authored internal liquid circuit',circuit,.017,'Copper',parent,sides=6)
    COOLER_CIRCUITS[index]=circuit
    if refined:
        # The side is a distinct manufactured panel, with restrained reveals.
        box('Cooling removable service panel',(x+.634,y+.12,1.56),(.024,.79,1.58),'Steel',parent,.002)
        for dz in [-.60,.60]:
            cylinder('Service panel fastener',(x+.647,y-.16,1.56+dz),(x+.657,y-.16,1.56+dz),.019,'Trim',parent,sides=8)
        for dy in [-.39,.39]:box('Cooling service panel reveal',(x+.65,y+dy,1.56),(.015,.014,1.42),'Dark',parent)
    for dx in [-.54,.54]:box('Cooling fan deck side',(x+dx,y,3.404),(.11,1.07,.065),'Graphite',parent)
    for dy in [-.49,.49]:box('Cooling fan deck end',(x,y+dy,3.404),(.97,.09,.065),'Graphite',parent)
    for dx in [-1,1]:cylinder('Fan motor support',(x+dx*.44,y,3.40),(x,y,3.40),.014,'Steel',parent,sides=6)
    ring('Fan rim',(x,y,3.453),.46,.026,'Steel',parent)
    ring('Fan inner rim',(x,y,3.456),.411,.012,'Steel',parent)
    for radius in [.23,.32]:
        ring('Fan guard',(x,y,3.483),radius,.006,'Steel',parent,segments=32)
    for i in range(4):
        a=TAU*i/4
        cylinder('Guard spoke',(x,y,3.488),(x+.452*math.cos(a),y+.452*math.sin(a),3.488),.009,'Steel',parent,sides=6)
    # Fan local +Z maps to glTF local +Y when transform is flattened by exporter.
    verts=[];faces=[]
    for i in range(5):
        a=TAU*i/5
        start=len(verts)
        # Tapered, swept airfoil with a finite trailing edge. No animation clips.
        for skin in [-1,1]:
            for radial in range(5):
                t=radial/4;r=.095+t*.32
                for chord in range(4):
                    u=chord/3-.5
                    xx=r;yy=u*(.10+.085*math.sin(t*math.pi*.78))+t*t*.045
                    zz=u*.036*(1-.28*t)+.008*math.sin((u+.5)*math.pi)+skin*.0025
                    verts.append((math.cos(a)*xx-math.sin(a)*yy,math.sin(a)*xx+math.cos(a)*yy,zz))
        for skin in range(2):
            for radial in range(4):
                for chord in range(3):
                    v=start+skin*20+radial*4+chord
                    face=(v,v+1,v+5,v+4)
                    faces.append(tuple(reversed(face)) if skin else face)
        for radial in range(4):
            for chord in [0,3]:
                v=start+radial*4+chord;face=(v,v+4,v+24,v+20);faces.append(face if chord==0 else tuple(reversed(face)))
        for chord in range(3):
            for radial in [0,4]:
                v=start+radial*4+chord;face=(v,v+1,v+21,v+20);faces.append(tuple(reversed(face)) if radial==0 else face)
    rotor=mesh(f'GN_FAN_ROTOR_{index:02d}',verts,faces,'Trim',parent,smooth=True,static=False)
    rotor.location=(x,y,3.456)
    semantic(rotor,rotor.name,'cooling','fan_rotor')
    cylinder('Fan spindle',(x,y,3.451),(x,y,3.51),.08,'Steel',parent,sides=16)
    # Short leg detail preserves a credible independent equipment silhouette.
    for xx in [-.45,.45]:
        box('Cooling mount',(x+xx,y,.315),(.12,.83,.16),'Graphite',parent,.012)
    for obj in set(bpy.data.objects)-existing:
        if obj.type=='MESH':obj['gnEquipmentId']=f'cooler-{index}'


def power():
    parent=DOMAIN['power']
    for i in range(3):
        existing=set(bpy.data.objects)
        x,y=-4.11+i*.67,-.29
        chassis=box('Switchgear casing',(x,y,1.52),(.64,1.04,2.35),'Graphite',parent,.025)
        chassis['gnEquipmentId']=f'switchgear-{i}'
        box('Switchgear door',(x,y-.538,1.5),(.555,.035,2.17),'Graphite',parent,.012)
        box('Switchgear raised panel',(x,y-.563,1.74),(.43,.022,1.58),'Steel',parent,.015)
        box('Switchgear display surround',(x-.04,y-.585,2.21),(.25,.025,.24),'Dark',parent,.012)
        box('Switchgear display',(x-.04,y-.602,2.23),(.16,.012,.085),'Graphite',parent)
        box('Switchgear indicator',(x+.067,y-.612,2.15),(.028,.012,.035),'Amber',parent)
        cylinder('Isolation selector',(x-.09,y-.582,1.95),(x-.09,y-.616,1.95),.047,'Dark',parent)
        box('Isolator handle',(x-.09,y-.636,1.95),(.021,.028,.10),'Trim',parent,.004)
        box('Door lever',(x+.195,y-.601,1.35),(.028,.027,.21),'Trim',parent,.007)
        panel('Switchgear vents',(x,y-.584,.63),.43,.20,'Grille',parent,repeat=4)
        box('Switchgear top',(x,y,2.71),(.59,.97,.075),'Graphite',parent,.014)
        box('Switchgear base',(x,y,.322),(.61,1.00,.15),'Dark',parent,.013)
        box('Switchgear ID plate',(x,y-.591,2.51),(.18,.014,.056),'Trim',parent)
        for obj in set(bpy.data.objects)-existing:
            if obj.type=='MESH':obj['gnEquipmentId']=f'switchgear-{i}'


def storage():
    parent=DOMAIN['storage']
    for i,(x,y) in enumerate(RESERVE_POSITIONS):
        existing=set(bpy.data.objects)
        chassis=box('Reserve cabinet',(x,y,1.28),(.71,1.36,1.89),'Graphite',parent,.032)
        chassis['gnEquipmentId']=f'reserve-{i}'
        box('Reserve front rim',(x,y-.699,1.28),(.65,.032,1.77),'Graphite',parent,.015)
        box('Reserve front recess',(x,y-.719,1.28),(.54,.018,1.58),'Dark',parent)
        for bank in range(6):
            z=.59+bank*.27
            box('Reserve module',(x,y-.743,z),(.49,.033,.23),'Graphite',parent,.008)
            panel('Reserve vent',(x-.04,y-.762,z),.32,.13,'Grille',parent,repeat=6)
            box('Module latch',(x+.22,y-.778,z),(.024,.025,.12),'Trim',parent,.003)
            box('Module status',(x+.16,y-.773,z+.025),(.016,.010,.022),'Amber',parent)
        box('Reserve lid',(x,y,2.249),(.63,1.29,.059),'Graphite',parent,.016)
        for stripe in range(8):
            box('Reserve top cooling slots',(x,y-.45+stripe*.13,2.281),(.40,.032,.008),'Dark',parent)
        panel('Reserve side vent',(x+.363,y,1.32),1.1,1.47,'Grille',parent,side='right',repeat=2.5)
        box('Reserve lower foot',(x,y,.303),(.63,1.2,.12),'Dark',parent,.01)
        for obj in set(bpy.data.objects)-existing:
            if obj.type=='MESH':obj['gnEquipmentId']=f'reserve-{i}'


def site():
    parent=DOMAIN['platform']
    box('Grounded foundation',(0,0,.13),(10.8,7.6,.26),'Platform',parent,.065)
    box('Foundation dark reveal',(0,0,.085),(10.86,7.66,.11),'Dark',parent,.035)
    box('Rack raised plinth',(0,-.2,.293),(6.28,4.38,.064),'Graphite',parent,.02)
    box('Rear rack service riser',(0,ROW_Y[1],.354),(5.83,1.46,.122),'Graphite',parent,.017)
    # Quiet inset tiles, service covers and platform seams.
    for x in [-4.8,-3.6,-2.4,-1.2,0,1.2,2.4,3.6,4.8]:
        box('Slab joint',(x,0,.264),(.011,7.37,.008),'Dark',parent)
    for y in [-3.2,-2.4,-1.2,0,1.2,2.4,3.2]:
        box('Slab joint',(0,y,.264),(10.52,.011,.008),'Dark',parent)
    for x in [-3.2,-1.7,-.2,1.3]:
        box('Service access cover',(x,-3.09,.284),(.64,.52,.037),'Steel',parent,.013)
        box('Access cover recess',(x,-3.09,.307),(.55,.43,.008),'Graphite',parent,.01)
        box('Access pull',(x+.14,-3.09,.319),(.035,.10,.01),'Steel',parent)
    # Low guardrails outline the rear service edge while keeping the composition open.
    for x in [-5.13,5.13]:
        for y in [-.5,1.55,3.4]:
            cylinder('Guardrail post',(x,y,.29),(x,y,.93),.023,'Steel',parent)
        for z in [.56,.93]:
            cylinder('Guardrail run',(x,-.5,z),(x,3.4,z),.021,'Steel',parent)
    for x in [-5.13,-2.55,0,2.55,5.13]:
        cylinder('Rear guardrail post',(x,3.4,.29),(x,3.4,.93),.023,'Steel',parent)
    for z in [.56,.93]:
        cylinder('Rear guardrail run',(-5.13,3.4,z),(5.13,3.4,z),.021,'Steel',parent)


def legacy_routes():
    power_acc=DOMAIN['accent_power']
    cool_acc=DOMAIN['accent_cooling']
    storage_acc=DOMAIN['accent_storage']
    work_acc=DOMAIN['accent_workloads']
    # Independent accents can change selection intensity without recoloring equipment.
    for offset in [0,.11,.22]:
        tube('Power floor route',[(-3.48,-.70,.35),(-3.48,-2.77-offset,.35),(2.86,-2.77-offset,.35),(2.86,.7,.35),(2.86,.7,2.99)],.018,'Copper',power_acc)
    for offset in [0,.13]:
        tube('Cooling service manifold',[(-2.47,1.79,2.91),(-2.65,1.55,3.08),(-2.65,-1.83,3.08),(2.59,-1.83,3.08),(2.79,-1.66,3.08),(2.79,1.65,3.08),(2.47,1.79,2.91)],.024,'Copper',cool_acc)
        # Second parallel circuit has a physically separated riser and return.
        for obj in STATIC[(cool_acc.name,'Copper')][-1:]:
            obj.location.z+=offset
            obj.location.x+=offset
    tube('Storage floor route',[(3.7,-1.42,.37),(3.15,-1.42,.37),(3.15,1.70,.37),(2.83,1.70,.37),(2.83,1.70,.98)],.023,'Copper',storage_acc)
    for y in [-1.03,.75]:
        tube('Workload top busway',[(-2.48,y,3.00),(2.53,y,3.00),(2.71,y-.14,2.86),(2.71,y-.14,.4)],.026,'Copper',work_acc)
        for x in [-2.275,-1.365,-.455,.455,1.365,2.275]:
            tube('Terminated rack tap',[(x,y,3.0),(x,y+.2,3.0),(x,y+.2,2.94)],.014,'Copper',work_acc,sides=6)


def service_lights():
    """Sparse architectural context, excluded from camera-fitting subjects.

    No photometric ratings: the warm static lenses and low-frequency floor
    illumination are compositional cues. Their dedicated authored identities
    survive in metadata while their surfaces share the existing batches.
    """
    parent=DOMAIN['platform'];fixtures=[]
    for i,x in enumerate([-4.78,4.78]):
        before=set(bpy.data.objects)
        y=.42;z=3.52
        box('Service light base',(x,y,.295),(.22,.24,.06),'Steel',parent,.008)
        box('Service light upright',(x,y,1.87),(.06,.07,3.10),'Steel',parent,.004)
        box('Service light cantilever',(x,y-.28,z-.05),(.065,.64,.06),'Steel',parent,.004)
        box('Service light housing',(x,y-.61,z),(.145,1.12,.095),'Graphite',parent,.004,keep_bevel=True)
        box('Service light recessed lens',(x,y-.61,z-.049),(.090,.98,.012),'Amber',parent)
        box('Service light upper seam',(x,y-.61,z+.049),(.10,1.00,.005),'Dark',parent)
        for obj in set(bpy.data.objects)-before:
            obj['gnRole']='architectural_context';obj['gnCameraFit']=False
            obj['gnContextId']=f'service-light-{i}'
        fixtures.append({'id':f'service-light-{i}','position':[x,z-.065,-(y-.61)],
                         'size':[.09,.98],'color':'#ffe3bc','authoringPosition':[x,y-.61,z-.065]})
    return fixtures


def presentation_metadata(topology, out):
    """Fit the engineered facility before adding the decorative service lights."""
    from engineering_metadata import bounds_yup
    objects=[o for o in bpy.data.collections['AUTHORING'].objects if o.type=='MESH' and o.get('gnRole')!='picking_proxy']
    bpy.context.view_layer.update()
    fit=bounds_yup([obj.matrix_world@Vector(p) for obj in objects for p in obj.bound_box])
    air_items=[e for e in topology['equipment'] if e['id'].startswith('air-')]
    air_points=[bound for e in air_items for bound in [e['bounds']['min'],e['bounds']['max']]]
    air_points.extend(point for passage in topology['ecosystem']['passages']
                      if passage['equipmentId'].startswith('cooler-') and passage['medium']=='air'
                      for point in passage['path'])
    air={'min':[min(point[k] for point in air_points) for k in range(3)],
         'max':[max(point[k] for point in air_points) for k in range(3)]}
    profile=json.loads((HERE/'render-profile.json').read_text())
    profile['inspection']['fitSubjects']={'overview':fit,'air-path':air}
    # The air detail looks down into real open collectors and intake openings.
    # Cooler feet belong to the overview; including them dilutes this subject.
    target=[round((air['min'][k]+air['max'][k])/2,6) for k in range(3)]
    azimuth=math.radians(42);elevation=math.radians(55);horizontal=8
    offset=[horizontal*math.sin(azimuth),horizontal*math.tan(elevation),horizontal*math.cos(azimuth)]
    profile['inspection']['details']['air-path'].update(target=target,camera=[round(target[k]+offset[k],6) for k in range(3)])
    (HERE/'render-profile.json').write_text(json.dumps(profile,indent=2)+'\n')
    index={'schemaVersion':'facility-equipment-index.v1','equipment':[{k:e[k] for k in ['id','label','system','role','bounds']} for e in topology['equipment']]}
    (out/'equipment-index.json').write_text(json.dumps(index,indent=2)+'\n')
    return {'version':1,'fitSubjects':profile['inspection']['fitSubjects'],'excludedContext':['service-light-0','service-light-1']}


def merge_export(export_col, roots):
    """Evaluate modifiers once and concatenate by domain/material, preserving UVs."""
    global collection
    collection = export_col
    graph = bpy.context.evaluated_depsgraph_get()
    from engineering_metadata import route_distance,scalar_attribute
    for (parent_name, mat), objects in STATIC.items():
        vertices=[];faces=[];smooth=[];uvs=[];corner_normals=[];equipment_ids=[];route_ids=[];route_s=[]
        mapped_corners=0;constant_corners=0;segmented_objects=0;added_triangles=0
        for obj in objects:
            evaluated=obj.evaluated_get(graph)
            data=evaluated.to_mesh()
            normal_matrix=obj.matrix_world.to_3x3().inverted().transposed()
            offset=len(vertices)
            local_points = [vertex.co.copy() for vertex in data.vertices]
            world_points = [obj.matrix_world @ point for point in local_points]
            local_low, local_high = surface_bounds(local_points)
            axis_scales = [obj.matrix_world.to_3x3().col[k].length for k in range(3)]
            if min(axis_scales) < 1e-9:
                raise ValueError(f'Degenerate surface transform: {obj.name}')
            vertices.extend(world_points)
            equipment_ids.extend([float(obj.get('gnEquipmentIndex',-1))]*len(data.vertices))
            route_ids.extend([float(obj.get('gnRouteIndex',-1))]*len(data.vertices))
            path=json.loads(obj['gnRoutePath']) if obj.get('gnRoutePath') else None
            route_length=sum((Vector(a)-Vector(b)).length for a,b in zip(path,path[1:])) if path else 1.
            route_s.extend([route_distance(point,path)/route_length for point in world_points] if path else [-1.]*len(data.vertices))
            uv=data.uv_layers.active
            contact_frames=[validate_contact_frame(frame)
                            for frame in json.loads(obj.get('gnSurfaceFrames','[]'))]
            segmented_objects += bool(obj.get('gnSurfaceSegmented'))
            added_triangles += obj.get('gnSurfaceAuthoredTriangles',12)-obj.get('gnSurfaceOriginalTriangles',12)
            for poly in data.polygons:
                faces.append(tuple(offset+i for i in poly.vertices))
                smooth.append(poly.use_smooth)
                region=obj.get('gnSurfaceRegion','neutral')
                spatial_region=obj.get('gnSpatialRegion')
                if spatial_region:
                    axis=int(obj['gnSpatialAxis'])
                    sign=obj.get('gnSpatialSign', -1 if spatial_region=='collector' else 1)
                    # Contact receivers apply to the authored exterior only.
                    # A removable specimen panel cannot inherit static context.
                    if poly.normal[axis]*sign>.9 and obj.get('gnMotionGroup','static')=='static':
                        region=spatial_region
                if obj.get('gnSurfaceTopRegion') and poly.normal.z>.9:
                    region=obj['gnSurfaceTopRegion']
                contact_frame=None
                for candidate in contact_frames:
                    if poly.normal[candidate['axis']]*candidate['sign']>.9:
                        if obj.get('gnMotionGroup','static')!='static':
                            raise ValueError('Static contact field attached to moving object: '+obj.name)
                        region=candidate['region'];contact_frame=candidate;break
                spec=surface_spec(region)
                axis=max(range(3),key=lambda k:abs(poly.normal[k]))
                axes=[k for k in range(3) if k!=axis]
                lows=local_low
                if obj.get('gnSurfaceSegmented') and spec.mapping=='metric':
                    lows,_=surface_bounds(local_points[index] for index in poly.vertices)
                extent=spec.metric_size
                if spec.mapping=='fit':
                    # Spatial bakes intentionally cover their actual receiver.
                    # Detail tiles always use metric mode and cannot be stretched.
                    extent=tuple((local_high[k]-local_low[k])*axis_scales[k] for k in axes)
                for loop_index in poly.loop_indices:
                    normal=(normal_matrix@data.corner_normals[loop_index].vector).normalized()
                    corner_normals.append(tuple(round(value,6) for value in normal))
                    vertex_index=data.loops[loop_index].vertex_index
                    p=world_points[vertex_index]
                    if obj.get('gnSurfacePreserveUV') and uv:
                        uvs.append(tuple(uv.data[loop_index].uv))
                    elif contact_frame:
                        local=local_points[vertex_index]
                        delta=[local[k]-contact_frame['origin'][k] for k in range(3)]
                        coordinates=[sum(delta[k]*contact_frame[basis][k] for k in range(3))/contact_frame['size'][j] for j,basis in enumerate(['u','v'])]
                        uvs.append(tile_uv(region,*coordinates));mapped_corners+=1
                    elif region=='floor':
                        uvs.append(tile_uv(region,p.x/10.8+.5,p.y/7.6+.5))
                    elif region=='plinth':
                        uvs.append(tile_uv(region,p.x/6.28+.5,(p.y+.2)/4.38+.5))
                    elif spec.mapping=='constant' or obj.get('gnSurfaceUniform'):
                        uvs.append(tile_uv(region,.5,.5))
                        constant_corners+=1
                    else:
                        local=local_points[vertex_index]
                        coords=[(local[k]-lows[k])*axis_scales[k]/extent[j] if extent[j]>1e-7 else .5
                                for j,k in enumerate(axes)]
                        try:
                            uvs.append(tile_uv(region,*coords))
                        except ValueError as exc:
                            raise ValueError(f'{obj.name} face {poly.index}: {exc}') from exc
                        mapped_corners+=1
            evaluated.to_mesh_clear()
        data=bpy.data.meshes.new(f'{parent_name}_{mat}')
        data.from_pydata(vertices,[],faces)
        data.materials.append(MATERIALS[mat])
        scalar_attribute(data,'_GN_EQUIPMENT_ID',equipment_ids)
        if 'ACCENT' in parent_name:
            scalar_attribute(data,'_GN_ROUTE_ID',route_ids)
            scalar_attribute(data,'_GN_ROUTE_S',route_s)
        uv=data.uv_layers.new(name='UVMap')
        for item,co in zip(uv.data,uvs):item.uv=co
        for poly in data.polygons:poly.use_smooth=True
        # Evaluated bevel/Weighted Normal results are corner attributes. Rebuilding
        # only face smoothing silently loses them; preserve them through batching.
        data.normals_split_custom_set(corner_normals)
        data.update()
        errors=[(data.corner_normals[i].vector-Vector(expected).normalized()).length for i,expected in enumerate(corner_normals)]
        if max(errors,default=0)>.002:raise ValueError(f'Corner normals were not preserved for {parent_name}/{mat}')
        uv_by_vertex={}
        for loop,item in zip(data.loops,uv.data):uv_by_vertex.setdefault(loop.vertex_index,set()).add(tuple(round(v,6) for v in item.uv))
        NORMAL_CHECKS.append({'batch':f'{parent_name}_{mat}','corners':len(corner_normals),'maxNormalVectorError':max(errors,default=0),
                              'customNormals':data.has_custom_normals,'verticesWithUVSeams':sum(len(values)>1 for values in uv_by_vertex.values()),
                              'surfaceContract':SURFACE_REVISION,'spatiallyMappedCorners':mapped_corners,
                              'constantSampleCorners':constant_corners,'segmentedObjects':segmented_objects,
                              'authoredAddedTriangles':added_triangles})
        obj=link(bpy.data.objects.new(data.name,data),roots[parent_name])
        obj['gnDomain']=roots[parent_name].get('gnDomain','platform')
        obj['gnRole']='selection_accent' if 'ACCENT' in parent_name else 'equipment_surface'
    for obj in list(bpy.data.objects):
        if obj.get('gnRole') not in {'fan_rotor','activity_led','picking_proxy'} or obj.users_collection[0] == export_col:
            continue
        clone=obj.copy()
        if obj.data:
            clone.data=obj.data.copy()
            if clone.type=='MESH':
                uv=clone.data.uv_layers.new(name='UVMap')
                for item in uv.data:item.uv=tile_uv(obj.get('gnSurfaceRegion','neutral'),.5,.5)
                scalar_attribute(clone.data,'_GN_EQUIPMENT_ID',[float(obj.get('gnEquipmentIndex',-1))]*len(clone.data.vertices))
        collection.objects.link(clone)
        clone.parent=roots[obj.parent.name]
    return roots['GN_EXPORT']


def setup_review():
    """Review-only camera/lights stay in REFERENCE and are never exported."""
    global collection
    collection=bpy.data.collections['REFERENCE']
    for obj in list(collection.objects):
        if obj.get('gnGeneratedReview'):bpy.data.objects.remove(obj,do_unlink=True)
    cam_data=bpy.data.cameras.new('Facility review orthographic')
    cam=link(bpy.data.objects.new('Facility review camera',cam_data))
    cam['gnGeneratedReview']=True
    cam.location=(12,-15,10.5)
    direction=Vector((0,0,1.10))-cam.location
    cam.rotation_euler=direction.to_track_quat('-Z','Y').to_euler()
    cam_data.type='ORTHO';cam_data.ortho_scale=14.7
    bpy.context.scene.camera=cam
    for name,position,energy,size in [
        ('Large cool key',(1,-6,11),2100,8),
        ('Soft side fill',(-7,-1,6),1650,7),
        ('Rear contour',(2,7,8),2600,6)]:
        lamp=bpy.data.lights.new(name,'AREA');lamp.energy=energy;lamp.shape='DISK';lamp.size=size
        obj=link(bpy.data.objects.new(name,lamp));obj.location=position;obj['gnGeneratedReview']=True
        obj.rotation_euler=(Vector((0,0,1))-obj.location).to_track_quat('-Z','Y').to_euler()
    scene=bpy.context.scene
    scene.render.engine='CYCLES';scene.cycles.samples=32
    scene.cycles.use_denoising=True
    scene.render.resolution_x=1440;scene.render.resolution_y=1080;scene.render.resolution_percentage=100
    scene.world.color=(.22,.22,.22)
    scene.render.film_transparent=True
    scene.view_settings.view_transform='AgX'


def main():
    global collection,BENCHMARK
    if bpy.app.version!=(5,2,2) or bpy.app.build_hash.decode()!='d13f752e3b9c':
        raise RuntimeError('Use pinned Blender 5.2.2 LTS build d13f752e3b9c for reproducible exports')
    parser=argparse.ArgumentParser()
    parser.add_argument('--out',default='build/facility')
    parser.add_argument('--render',action='store_true')
    parser.add_argument('--benchmark',action='store_true',help='Record review targets using unchanged production geometry and batches')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    BENCHMARK=args.benchmark
    out=Path(args.out).resolve();out.mkdir(parents=True,exist_ok=True)
    if BENCHMARK:
        (out/'benchmark-context.json').write_text(json.dumps({
            'schemaVersion':1,'purpose':'material-and-lighting-review',
            'geometryPolicy':'production-identical','targets':['rack-03','air-row-0','cooler-0'],
            'requiresVisualApproval':True,'publicRelease':False,
        },indent=2)+'\n')
    # Exclusive authoring lease; manual edits are never overwritten by a second generator.
    lock=HERE/'generation.lock'
    descriptor=os.open(lock,os.O_CREAT|os.O_EXCL|os.O_WRONLY)
    os.close(descriptor)
    try:
        if MASTER.exists():bpy.ops.wm.open_mainfile(filepath=str(MASTER))
        else:bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
        for name in ['AUTHORING','EXPORT']:
            old=bpy.data.collections.get(name)
            if old:
                for obj in list(old.objects):bpy.data.objects.remove(obj,do_unlink=True)
                bpy.data.collections.remove(old)
        # Remove generated data orphans so reruns retain stable data names and GLB bytes.
        for datablocks in [bpy.data.meshes,bpy.data.curves]:
            for block in list(datablocks):
                if block.users==0:datablocks.remove(block)
        for name in ['AUTHORING','AUTHORING_MANUAL','REFERENCE','EXPORT']:
            if not bpy.data.collections.get(name):
                col=bpy.data.collections.new(name);bpy.context.scene.collection.children.link(col)
        collection=bpy.data.collections['AUTHORING']
        bpy.context.scene.unit_settings.system='METRIC';bpy.context.scene.unit_settings.scale_length=1
        for name,metal,rough in [('Graphite',0,.50),('Steel',1,.34),('Trim',1,.28),
                                ('Dark',0,.76),('Copper',1,.32),('Amber',0,.4),
                                ('Platform',0,.78),('Grille',0,.55)]:material(name,metal,rough)
        sys.path.insert(0,str(HERE))
        root=semantic(empty('GN_EXPORT'),'GN_EXPORT')
        DOMAIN['root']=root
        for key in ['platform','power','cooling','storage','workloads','accent_power','accent_cooling','accent_storage','accent_workloads']:
            identity=f'GN_{key.upper()}'
            parent=DOMAIN[key.removeprefix('accent_')] if key.startswith('accent_') else root
            DOMAIN[key]=semantic(empty(identity,parent),identity,key.removeprefix('accent_'),
                                 'selection_accent_root' if key.startswith('accent') else 'system_root')
        site()
        for obj in collection.objects:
            if obj.name.startswith('Grounded foundation'):obj['gnSurfaceTopRegion']='floor'
            elif obj.name.startswith('Rack raised plinth'):obj['gnSurfaceTopRegion']='plinth'
        for row,y in enumerate(ROW_Y):
            for i in range(6):rack(-2.275+i*.91,y,row*6+i)
        for i in range(4):cooler(-2.145+i*1.43,i)
        power();storage()
        from service_routes import build_services
        service_report=build_services(box,cylinder,tube,DOMAIN,ROW_Y,RESERVE_POSITIONS,REAR_LIFT,out/'service-report.json')
        from air_circuit import build_air_circuit
        build_air_circuit(sys.modules[__name__], service_report, out)
        from engineering_metadata import compile_topology
        topology=compile_topology(service_report,list(bpy.data.collections['AUTHORING'].objects))
        root['gnTopology']=json.dumps(topology,separators=(',',':'))
        (out/'topology.json').write_text(json.dumps(topology,indent=2)+'\n')
        # Artists can add a mesh to AUTHORING_MANUAL with gnDomain set to one of the
        # five existing systems. Its evaluated surfaces join the same export batches.
        # It is never deleted or renamed by this generator.
        for obj in bpy.data.collections['AUTHORING_MANUAL'].objects:
            if obj.type!='MESH':continue
            key=obj.get('gnDomain')
            if key not in ['platform','power','cooling','storage','workloads']:
                raise ValueError(f'Manual mesh {obj.name} needs a supported gnDomain')
            if len(obj.data.materials)!=1 or obj.data.materials[0].name not in MATERIALS:
                raise ValueError(f'Manual mesh {obj.name} must use one approved palette material')
            STATIC.setdefault((DOMAIN[key].name,obj.data.materials[0].name),[]).append(obj)
        presentation=presentation_metadata(topology,out)
        presentation['fixtures']=service_lights()
        root['gnPresentation']=json.dumps(presentation,separators=(',',':'))
        (out/'presentation-report.json').write_text(json.dumps(presentation,indent=2)+'\n')
        # Proxy material is irrelevant; renderer removes proxy meshes from render traversal.
        for key,p,size in [
            ('power',(-3.44,-.29,1.58),(2.05,1.1,2.55)),
            ('cooling',(0,2.39,1.94),(5.7,1.22,3.3)),
            ('storage',(3.84,-1.865,1.3),(1.67,2.13,2.0)),
            ('workloads',(0,-.225,1.71),(5.55,3.55,2.80))]:
            obj=box(f'GN_PICK_{key.upper()}',p,size,'Dark',DOMAIN[key],static=False)
            semantic(obj,obj.name,key,'picking_proxy');obj.hide_render=True;obj.display_type='WIRE'
        # Duplicate only semantic empties before coalescing static geometry.
        collection=bpy.data.collections['EXPORT'];roots={}
        for original in [root,*DOMAIN.values()]:
            if original.name in roots:continue
            clone=original.copy();collection.objects.link(clone);roots[original.name]=clone
            clone.parent=roots.get(original.parent.name) if original.parent else None
        export_root=merge_export(collection,roots)
        (out/'normal-preservation-report.json').write_text(json.dumps({'schemaVersion':1,'method':'Evaluated modifier corner normals transformed with inverse-transpose, quantized to six decimals, copied into batch custom normals; UV corners retained independently',
            'batches':NORMAL_CHECKS,'maxNormalVectorError':max(row['maxNormalVectorError'] for row in NORMAL_CHECKS),
            'verticesWithUVSeams':sum(row['verticesWithUVSeams'] for row in NORMAL_CHECKS),'result':'passed'},indent=2)+'\n')
        # Stable export names match semantic IDs; originals keep .AUTHORING suffixes.
        for identity,clone in roots.items():
            original=bpy.data.objects.get(identity)
            if original and original!=clone:original.name=f'{identity}.AUTHORING'
            clone.name=identity
        for obj in list(collection.objects):
            if obj.get('gnRole') in {'fan_rotor','activity_led','picking_proxy'}:
                original=bpy.data.objects.get(obj['gnId'])
                if original and original!=obj:original.name=f"{obj['gnId']}.AUTHORING"
                obj.name=obj['gnId']
        bpy.data.collections['AUTHORING'].hide_render=True
        bpy.data.collections['AUTHORING'].hide_viewport=True
        bpy.data.collections['AUTHORING_MANUAL'].hide_render=True
        bpy.data.collections['AUTHORING_MANUAL'].hide_viewport=True
        from surface_bake import bake_surfaces
        bake_surfaces(MATERIALS,out)
        setup_review()
        # Store an artist-friendly master with export scene visible and editable authoring preserved.
        bpy.ops.wm.save_as_mainfile(filepath=str(MASTER),compress=True)
        sys.path.insert(0,str(HERE))
        import export
        export.export_scene(out/'facility.glb')
        if args.render:
            bpy.context.scene.render.filepath=str(out/'preview.png')
            bpy.ops.render.render(write_still=True)
        from specimens import build_all
        build_all(out)
    finally:
        lock.unlink(missing_ok=True)


if __name__=='__main__':main()
