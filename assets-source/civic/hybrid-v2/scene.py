"""Editable, metre-scale fictional civic site. No service or authority claims."""
import math
import random

import bpy
from mathutils import Vector

SEED = 20261011


def build(lighting='balanced-blue-hour'):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    rng = random.Random(SEED)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1
    groups = {}
    for name in ['Facility', 'Exterior cooling', 'Substation', 'Community', 'Landscape', 'Lighting', 'Cameras']:
        col = bpy.data.collections.new(name)
        scene.collection.children.link(col)
        groups[name] = col
    active = groups['Facility']

    def material(name, color, rough=.6, metal=0, emission=0, noise=0):
        mat = bpy.data.materials.new(name)
        mat.use_nodes = True
        node = mat.node_tree.nodes.get('Principled BSDF')
        col = tuple((c/12.92 if c <= .04045 else ((c+.055)/1.055)**2.4) for c in color)
        node.inputs['Base Color'].default_value = (*col, 1)
        node.inputs['Roughness'].default_value = rough
        node.inputs['Metallic'].default_value = metal
        if emission:
            node.inputs['Emission Color'].default_value = (*col, 1)
            node.inputs['Emission Strength'].default_value = emission
        if noise:
            tex = mat.node_tree.nodes.new('ShaderNodeTexNoise')
            tex.inputs['Scale'].default_value = noise
            tex.inputs['Detail'].default_value = 3
            bump = mat.node_tree.nodes.new('ShaderNodeBump')
            bump.inputs['Strength'].default_value = .22
            bump.inputs['Distance'].default_value = .06
            mat.node_tree.links.new(tex.outputs['Fac'], bump.inputs['Height'])
            mat.node_tree.links.new(bump.outputs['Normal'], node.inputs['Normal'])
        return mat

    mats = {
        'wall': material('Graphite coated metal', (.31,.34,.36), .49, .35, noise=9),
        'fin': material('Folded aluminium fins', (.43,.47,.49), .38, .65),
        'concrete': material('Precast limestone concrete', (.54,.55,.53), .88, noise=3),
        'roof': material('Roof membrane', (.24,.27,.28), .85, noise=8),
        'dark': material('Dark service recesses', (.075,.09,.10), .7),
        'glass': material('Neutral blue glazing', (.19,.29,.34), .18, .35),
        'steel': material('Galvanized structural steel', (.65,.69,.70), .43, .58),
        'fan': material('Fan wells and blades', (.12,.15,.16), .48, .35),
        'road': material('Asphalt', (.15,.165,.17), .92, noise=14),
        'gravel': material('Substation stone', (.39,.40,.37), .93, noise=12),
        'soil': material('Rolling dark meadow', (.18,.22,.17), .98, noise=.7),
        'mark': material('Worn painted traffic lines', (.65,.66,.61), .87),
        'light': material('Warm shielded luminaire', (1,.72,.40), .4, emission=7),
        'window': material('Occupied warm rooms', (.95,.66,.38), .35, emission=.6),
        'bark': material('Tree bark', (.22,.20,.17), .97, noise=12),
        'leaf0': material('Deep oak leaves', (.13,.21,.135), .92),
        'leaf1': material('Cool beech leaves', (.19,.255,.18), .89),
        'leaf2': material('Muted pine needles', (.13,.20,.18), .91),
        'brick': material('Community warm brick', (.43,.38,.32), .87, noise=4),
        'render': material('Community stone render', (.55,.55,.49), .92, noise=6),
        'tile': material('Community slate', (.25,.28,.30), .83, noise=10),
    }
    unit = None

    def cube(name, pos, size, key, bevel=0):
        nonlocal unit
        if unit is None:
            unit = bpy.data.meshes.new('Unit cuboid')
            unit.from_pydata([(-.5,-.5,-.5),(.5,-.5,-.5),(.5,.5,-.5),(-.5,.5,-.5),(-.5,-.5,.5),(.5,-.5,.5),(.5,.5,.5),(-.5,.5,.5)], [], [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])
        mesh = unit.copy()
        mesh.name = name
        mesh.materials.append(mats[key])
        for vertex in mesh.vertices:
            for axis in range(3): vertex.co[axis] *= size[axis]
        obj = bpy.data.objects.new(name, mesh)
        active.objects.link(obj)
        obj.location = pos
        if bevel:
            mod = obj.modifiers.new('Physical softened edges', 'BEVEL')
            mod.width = bevel; mod.segments = 2
            mod = obj.modifiers.new('Weighted face normals', 'WEIGHTED_NORMAL')
        return obj

    cylinders = {}
    def cylinder(name, pos, radius, depth, key, sides=16):
        identity = (sides,key)
        if identity not in cylinders:
            verts = [(math.cos(a*math.tau/sides),math.sin(a*math.tau/sides),z) for z in [-.5,.5] for a in range(sides)]
            faces = [tuple(reversed(range(sides))), tuple(range(sides,sides*2))]
            faces += [(i,(i+1)%sides,(i+1)%sides+sides,i+sides) for i in range(sides)]
            mesh = bpy.data.meshes.new(name)
            mesh.from_pydata(verts,[],faces); mesh.materials.append(mats[key])
            for face in mesh.polygons[2:]: face.use_smooth = True
            cylinders[identity] = mesh
        obj=bpy.data.objects.new(name,cylinders[identity]);active.objects.link(obj)
        obj.location=pos;obj.scale=(radius,radius,depth)
        return obj

    def beam(name, a, b, radius, key, sides=8):
        av,bv=Vector(a),Vector(b)
        obj=cylinder(name,(av+bv)/2,radius,(bv-av).length,key,sides)
        obj.rotation_euler=(bv-av).to_track_quat('Z','Y').to_euler()
        return obj

    def line(name, points, radius, key):
        curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D'
        spline=curve.splines.new('POLY');spline.points.add(len(points)-1)
        for point, pos in zip(spline.points,points): point.co=(*pos,1)
        curve.bevel_depth=radius;curve.bevel_resolution=1
        obj=bpy.data.objects.new(name,curve);active.objects.link(obj);curve.materials.append(mats[key])
        return obj

    def light(name,pos,energy,size,color,target=None):
        data=bpy.data.lights.new(name,'AREA');data.energy=energy;data.shape='DISK';data.size=size;data.color=color
        obj=bpy.data.objects.new(name,data);groups['Lighting'].objects.link(obj);obj.location=pos
        target=target or (pos[0],pos[1],0)
        obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
        return obj

    def fence(name,x0,y0,x1,y1,height=2.7):
        # Real physical fence, never a luminous control perimeter.
        for a,b in [((x0,y0),(x1,y0)),((x1,y0),(x1,y1)),((x1,y1),(x0,y1)),((x0,y1),(x0,y0))]:
            length=math.dist(a,b);steps=max(1,int(length/3.6))
            for i in range(steps+1):
                p=(a[0]+(b[0]-a[0])*i/steps,a[1]+(b[1]-a[1])*i/steps)
                cylinder(name+' post',(*p,height/2),.052,height,'steel',8)
            for z in [.4,height-.15]:line(name+' rail',[(*a,z),(*b,z)],.025,'steel')

    # 180 × 108 m industrial mass; 14 m parapet, restrained entrance glazing.
    cube('Facility foundation',(0,0,.3),(185,113,.6),'concrete',.18)
    # A genuinely recessed central entrance: opaque hall wings surround an
    # atrium instead of placing a glass decal over a solid facade box.
    cube('Facility rear hall envelope',(0,13,6.9),(180,82,13.2),'wall',.16)
    cube('Facility west hall wing',(-56,-41,6.9),(68,26,13.2),'wall',.16)
    cube('Facility east hall wing',(57,-41,6.9),(66,26,13.2),'wall',.16)
    cube('Low precast base',(0,-54.13,1.4),(180,.3,2.2),'concrete',.06)
    cube('Membrane roof',(0,0,13.65),(178,106,.45),'roof',.07)
    for x in [-89.6,89.6]:cube('Parapet side',(x,0,14.1),(.8,109,1.0),'wall',.08)
    for y in [-54,54]:cube('Parapet front rear',(0,y,14.1),(180,.8,1.0),'wall',.08)
    for x in range(-87,89,4):
        cube('Facade standing seam',(x,-54.22,8),(.14,.22,10.4),'fin',.025)
        if x<-24 or x>28:
            cube('Lower ventilation recess',(x,-54.3,5.9),(3.1,.15,7.1),'dark')
            for z in [2.8+i*.55 for i in range(13)]:cube('Formed external louver',(x,-54.55,z),(3.15,.4,.09),'fin',.012)
    for y in range(-49,52,5):
        cube('West service panel',(-90.15,y,7.8),(.2,4.7,10.5),'wall',.03)
        cube('East facade fin',(90.2,y,7.4),(.45,.18,12.3),'fin',.03)
    cube('Lobby glazing',(2,-54.48,6.15),(41,.16,10.5),'glass')
    for x in range(-18,24,3):cube('Lobby mullion',(x,-54.62,6.1),(.13,.16,10.6),'fin')
    for z in [2.8,6,9.3]:cube('Lobby transom',(2,-54.62,z),(41,.16,.14),'fin')
    cube('Lobby warm interior',(2,-54.0,4.8),(38,.12,7.5),'window')
    cube('Stone entrance portal',(2,-54.9,12.05),(46,1.1,1.5),'concrete',.08)
    cube('Entry canopy',(2,-60,4.9),(22,11,.48),'wall',.06)
    for x in [-7,11]:cylinder('Canopy structural column',(x,-64.3,2.5),.13,4.8,'steel')
    for x in [-4,2,8]:cube('Entrance paired doors',(x,-54.86,1.8),(2.8,.16,3.5),'glass')
    light('Warm entrance wash',(2,-58,4.55),3200,9,(1,.69,.40),(2,-64,.4))

    active=groups['Exterior cooling']
    # Distinct horizontal dry-cooler assemblies, service lanes and guard rails.
    for row,y in enumerate([-30,0,30]):
        cube('Equipment support slab',(0,y,14.1),(148,16,.45),'concrete',.05)
        for i,x in enumerate([-63,-45,-27,-9,9,27,45,63]):
            cube('Dry cooler galvanized chassis',(x,y,15.2),(14.8,11.4,1.3),'steel',.09)
            cube('Dark finned heat exchanger',(x,y,16.05),(14.2,10.9,.55),'dark',.04)
            for dx in [-4.7,0,4.7]:
                for dy in [-2.7,2.7]:
                    cylinder('Fan rim',(x+dx,y+dy,16.55),2.05,.5,'steel',32)
                    cylinder('Fan recess',(x+dx,y+dy,16.85),1.86,.12,'fan',32)
                    cylinder('Fan hub',(x+dx,y+dy,17.0),.28,.16,'steel',12)
                    for blade in range(5):
                        theta=blade*math.tau/5+i*.29
                        obj=cube('Fan blade',(x+dx+math.cos(theta)*.9,y+dy+math.sin(theta)*.9,16.94),(1.55,.45,.09),'fin')
                        obj.rotation_euler[2]=theta+.35
            for dy in [-5.75,5.75]:
                for dx in [-6.7,-2.2,2.2,6.7]:cube('Cooler coil frame',(x+dx,y+dy,15.55),(.13,.14,1.8),'fin')
        # Generous unobstructed service lanes between assemblies.
        for z in [15.6,16.2]:line('Safety handrail',[(-76,y-8.6,z),(76,y-8.6,z)],.028,'steel')
        for x in range(-76,77,8):cylinder('Safety handrail support',(x,y-8.6,15.2),.035,2.0,'steel',8)
    for x in [-81,81]:
        cube('Plant service corridor',(x,0,13.95),(5,96,.12),'concrete')
        for y in [-26,26]:cube('Roof air handling enclosure',(x,y,16.2),(9,14,4.5),'wall',.08)
    for y in [-45,45]:
        line('Roof circulation pipe',[(-75,y,14.6),(75,y,14.6)],.16,'steel')
        for x in range(-72,73,12):cube('Pipe saddle',(x,y,14.25),(.5,.55,.55),'concrete',.04)

    # Architectural refinement: a credible two-level industrial envelope.
    # Only the shell is taller. Doors, canopy, trees and cooling-unit dimensions
    # keep their real-world scale; plant moves up onto the higher roof.
    human_scale=('Facility foundation','Entry canopy','Canopy structural column','Entrance paired doors')
    for obj in groups['Facility'].objects:
        if any(obj.name.startswith(name) for name in human_scale):continue
        obj.location.z*=1.5
        obj.scale.z*=1.5
    roof_lift=6.9375
    for obj in groups['Exterior cooling'].objects:obj.location.z+=roof_lift
    active=groups['Facility']
    # Deep fin returns and restrained precast piers give the facade physical
    # rhythm and shadow depth; the roof does not carry the entire focal story.
    for x in [-84,-76,-68,-60,-52,-44,-36,36,44,52,60,68,76,84]:
        cube('Deep facade fin',(x,-54.85,10.8),(.42,1.40,17.8),'fin',.05)
    for x in [-89,-23,26,89]:
        cube('Front precast pier',(x,-54.8,10.4),(1.8,1.50,20.0),'concrete',.09)
    for z in [7.1,14.2]:
        for x in [-56,58]:cube('Wing horizontal reveal',(x,-54.75,z),(63,.80,.38),'fin',.035)
    cube('Facade top coping',(0,-54.7,20.65),(180,1.25,.60),'fin',.06)
    for x in [-90.25,90.25]:
        cube('Precast corner return',(x,-50.7,10.4),(.72,7.2,20),'concrete',.09)
    old_portal=bpy.data.objects.get('Stone entrance portal')
    if old_portal:old_portal.hide_render=True
    cube('Deep entrance portal head',(2,-55.1,19.15),(47.5,2.6,1.8),'concrete',.10)
    cube('Atrium recessed rear wall',(2,-34,9.0),(40,1,17.3),'concrete',.06)
    glass=mats['glass'].node_tree.nodes.get('Principled BSDF')
    glass.inputs['Metallic'].default_value=0
    glass.inputs['Transmission Weight'].default_value=.65
    glass.inputs['IOR'].default_value=1.45
    glass.inputs['Roughness'].default_value=.12
    interior=bpy.data.objects.get('Lobby warm interior')
    if interior:interior.hide_render=True
    for z in [6.0,12.0]:
        cube('Visible atrium mezzanine floor',(2,-43.3,z),(39,18.4,.42),'concrete',.04)
        cube('Atrium warm ceiling inset',(2,-46,z-.26),(36,6,.06),'window')
        cube('Atrium floor-edge shadow',(2,-53.0,z),(39,.34,.65),'wall',.035)
    for x in [-17,-5,7,19]:
        cube('Recessed atrium column',(x,-44.5,8.8),(.6,.6,17),'concrete',.06)
    for z in [5.4,11.4,16.8]:
        light('Warm atrium interior',(2,-39,z),2100,10,(1,.74,.50),(2,-55,z-2))
    # Service manifolds and more legible plant enclosures preserve exactly the
    # three original fan banks and their assembly footprints.
    active=groups['Exterior cooling']
    for y in [-21.2,8.8,38.8]:
        line('Cooling service manifold',[(-74,y,22.2),(74,y,22.2)],.22,'steel')
        for x in range(-72,73,18):
            cube('Manifold support',(x,y,21.4),(.38,.55,1.45),'concrete',.035)
            line('Cooling branch pipe',[(x,y,22.2),(x,y-2.6,22.2),(x,y-2.6,21.4)],.13,'steel')
    for x in [-81,81]:
        for y in [-26,26]:
            for z in [21.55+i*.45 for i in range(8)]:
                cube('Plant enclosure formed louver',(x+(4.57 if x>0 else -4.57),y,z),(.18,12.4,.12),'fin',.015)
            for dx in [-2.9,-1.45,0,1.45,2.9]:
                cube('Plant enclosure top grille',(x+dx,y,25.43),(.18,12.4,.10),'steel',.012)

    active=groups['Landscape']
    cube('Facility site apron',(0,0,-.18),(238,163,.3),'road',.04)
    cube('Facility perimeter sidewalk',(0,-73,.02),(235,6,.15),'concrete',.07)
    fence('Facility physical boundary',-121,-84,121,86)
    for x in range(-105,113,18):
        if -22<x<25:continue
        for y in [-64,-77]:cube('Parking stall marking',(x,y,.017),(.14,5.4,.025),'mark')
    cube('Entry access road',(11,-152,-.045),(10,140,.1),'road')
    cube('Public road',(0,-218,-.045),(920,11,.10),'road')
    cube('Eastern connector',(126,-8,-.05),(10,420,.1),'road')
    cube('Neighborhood street',(-8,244,-.15),(212,9,.3),'road')
    cube('Neighborhood lane',(-31,297,-.15),(9,110,.3),'road')
    for x in range(-115,117,28):
        cylinder('Facility pole',(x,-79,4),.09,8,'wall',10)
        cube('Shielded pole lantern',(x,-79,8.05),(1.1,.8,.15),'light')
        light('Site path pool',(x,-79,7.9),950,1.0,(1,.72,.44))
    for x in [-76,-38,40,78]:light('Facade grazing pool',(x,-57,1.1),500,.9,(1,.72,.47),(x,-54,7))
    # No flat presentation plinth: one continuous, gently rolling landscape.
    def terrain_z(x,y):
        z=4.5*math.sin(x/128)*math.sin(y/190)+3*math.sin((x+y)/245)
        if -140<x<155 and -240<y<110:return -.35
        if -228<x<-72 and 120<y<256:return -.35
        if -105<x<90 and 206<y<372:return -.30
        return z-.7
    verts=[];faces=[];n=75
    for yi in range(n):
        y=-3500+yi*100
        for xi in range(n):
            x=-3500+xi*100;verts.append((x,y,terrain_z(x,y)))
    for y in range(n-1):
        for x in range(n-1):i=y*n+x;faces.append((i,i+1,i+1+n,i+n))
    mesh=bpy.data.meshes.new('Continuous rolling land');mesh.from_pydata(verts,[],faces);mesh.materials.append(mats['soil'])
    obj=bpy.data.objects.new('Rolling landscape without diorama edge',mesh);active.objects.link(obj)
    for poly in mesh.polygons:poly.use_smooth=True

    active=groups['Substation']
    gx,gy=-148,151
    cube('Separate substation gravel',(gx,gy,.02),(122,94,.2),'gravel')
    fence('Substation own enclosure',gx-63,gy-49,gx+63,gy+49,3)
    for x in [gx-39,gx,gx+39]:
        cube('Transformer concrete pad',(x,gy, .32),(17,23,.6),'concrete',.1)
        cube('Transformer main tank',(x,gy,4.9),(11.6,15,8.5),'steel',.18)
        for dx in [-6,6]:
            for yy in range(-5,6):cube('Transformer radiator',(x+dx,gy+yy,4),(2.2,.28,6),'fin',.025)
        for dx in [-3,0,3]:
            cylinder('High voltage bushing',(x+dx,gy,11),.30,4.0,'concrete',12)
            for z in [9.4+i*.4 for i in range(9)]:cylinder('Insulator skirt',(x+dx,gy,z),.69,.17,'concrete',12)
        cylinder('Conservator tank',(x,gy+5,8),1.0,7,'steel').rotation_euler[1]=math.pi/2
    for y in [gy-30,gy+31]:
        for x in [gx-51,gx-17,gx+17,gx+51]:
            cube('Gantry wide steel column',(x,y,7),(.85,.85,14),'steel',.05)
        for z in [12.1,14.2]:beam('Gantry truss chord',(gx-54,y,z),(gx+54,y,z),.23,'steel')
        for x in range(int(gx)-54,int(gx)+51,6):
            beam('Gantry truss diagonal',(x,y,12.1),(x+6,y,14.2),.14,'steel')
            beam('Gantry truss diagonal',(x,y,14.2),(x+6,y,12.1),.14,'steel')
        for x in range(int(gx)-45,int(gx)+46,15):
            cylinder('Switch support',(x,y-7,3),.11,6,'steel',8)
            cylinder('Switch insulator',(x,y-7,6.8),.32,1.5,'concrete',12)
            cube('Circuit breaker cabinet',(x,y-13,1.8),(2.6,3.3,3.6),'steel',.10)
            for dx in [-.7,.7]:
                cylinder('Breaker bushing',(x+dx,y-13,4.65),.33,2.4,'concrete',12)
                for z in [3.7+i*.35 for i in range(6)]:cylinder('Breaker porcelain skirt',(x+dx,y-13,z),.56,.14,'concrete',12)
    for x in [gx-38,gx,gx+38]:
        for dx in [-3,0,3]:line('Neutral bus conductor',[(x+dx,gy-30,12),(x+dx,gy-10,10.8),(x+dx,gy+11,10.8),(x+dx,gy+31,12)],.047,'steel')
    # Two lattice towers are structural silhouettes, not glowing connection lines.
    for tx,ty in [(gx-51,gy+73),(gx+72,gy+82)]:
        for dx,dy in [(-4,-4),(4,-4),(4,4),(-4,4)]:
            beam('Lattice tower leg',(tx+dx,ty+dy,0),(tx+dx*.28,ty+dy*.28,43),.32,'steel')
        for z in [5,12,19,26,33]:
            w=4*(1-z/54)
            for side in [-1,1]:
                beam('Tower diagonal',(tx-w,ty+side*w,z),(tx+w*.76,ty+side*w*.76,z+7),.13,'steel')
                beam('Tower diagonal',(tx+w,ty+side*w,z),(tx-w*.76,ty+side*w*.76,z+7),.13,'steel')
                beam('Tower side diagonal',(tx+side*w,ty-w,z),(tx+side*w*.76,ty+w*.76,z+7),.13,'steel')
            beam('Tower girder',(tx-w,ty-w,z),(tx+w,ty-w,z),.075,'steel')
        for z,w in [(29,10),(36,8)]:
            beam('Tower crossarm',(tx-w,ty,z),(tx+w,ty,z),.28,'steel')
            beam('Tower crossarm brace',(tx-w,ty,z),(tx,ty,z+3),.20,'steel')
            beam('Tower crossarm brace',(tx+w,ty,z),(tx,ty,z+3),.20,'steel')
            for dx in [-w,w]:
                cylinder('Tower suspended insulator',(tx+dx,ty,z-1.3),.38,2.6,'concrete',12)
    for dx,z in [(-9,29),(9,29),(-7,36),(7,36)]:
        pts=[]
        for i in range(18):
            t=i/17;pts.append((gx-51+dx+123*t,gy+73+9*t,z-4.5*math.sin(math.pi*t)))
        line('Transmission conductor',pts,.04,'steel')
    # Keep a visible landscape buffer between the lattice towers and homes.
    # This is illustrative siting, not a verified engineering clearance.
    for obj in groups['Substation'].objects:
        if obj.name.startswith(('Lattice tower','Tower ','Transmission conductor')):
            obj.location.x-=40;obj.location.y+=12
    for x,y in [(gx-53,gy-35),(gx+53,gy+35)]:
        cylinder('Grid yard light pole',(x,y,6),.12,12,'steel',8)
        light('Grid yard quiet area light',(x,y,12),2100,2.0,(1,.84,.68))

    active=groups['Community']
    homes=[]
    for row,y in enumerate([222,265,308,351]):
        for col,x in enumerate([-90,-54,-10,30,70]):
            if row==3 and col<2:continue
            x+=rng.uniform(-5,5);y+=rng.uniform(-3,3)
            w=rng.uniform(11,15);d=rng.uniform(9,12);h=rng.uniform(5.0,6.4)
            homes.append((x,y,w,d,h))
            cube('Community home',(x,y,h/2),(w,d,h),'brick' if (row+col)%3 else 'render',.06)
            z=h;peak=rng.uniform(2.8,4.0)
            vs=[(-w*.56,-d*.57,0),(w*.56,-d*.57,0),(w*.56,d*.57,0),(-w*.56,d*.57,0),(-w*.56,0,peak),(w*.56,0,peak)]
            m=bpy.data.meshes.new('Pitched domestic roof');m.from_pydata(vs,[],[(0,1,5,4),(3,4,5,2),(0,4,3),(1,2,5)]);m.materials.append(mats['tile'])
            ob=bpy.data.objects.new('Community pitched roof',m);active.objects.link(ob);ob.location=(x,y,z)
            for floor in [1.6,4.25]:
                for dx in [-w*.31,0,w*.31]:
                    cube('Residential window',(x+dx,y-d/2-.04,floor),(1.45,.05,1.35),'window' if rng.random()<.48 else 'glass')
            cube('Residential front door',(x,y-d/2-.07,1.25),(1.1,.08,2.4),'dark')
            cube('Domestic front path',(x,y-d/2-3,.015),(1.4,6,.055),'concrete')
            if col%2==0:
                cube('Detached garage',(x+w*.8,y-1,1.6),(5.3,6.2,3.2),'render',.05)
                cube('Garage roof',(x+w*.8,y-1,3.3),(5.7,6.6,.3),'tile',.06)
            if row<2 and col%2:light('Domestic porch',(x,y-d*.5-.3,2.8),55,.5,(1,.71,.44))

    active=groups['Landscape']
    # Real leaf planes and branched trunks, reused as complete varied trees.
    # Geometry is intentionally irregular; no spheres form visible crowns.
    tree_meshes=[]
    for species in range(8):
        local=random.Random(SEED+species*117)
        verts=[];faces=[];indices=[]
        height=local.uniform(11,18);spread=height*local.uniform(.24,.36)
        def limb(a,b,radius):
            a,b=Vector(a),Vector(b);direction=(b-a).normalized();u=direction.cross(Vector((0,1,0))).normalized();v=direction.cross(u)
            start=len(verts)
            for center,rr in [(a,radius),(b,radius*.32)]:
                for j in range(6):verts.append(tuple(center+(u*math.cos(j*math.tau/6)+v*math.sin(j*math.tau/6))*rr))
            for j in range(6):faces.append((start+j,start+(j+1)%6,start+(j+1)%6+6,start+j+6));indices.append(0)
        limb((0,0,0),(.18,.1,height*.88),.34)
        for branch in range(24):
            theta=branch*2.39996+local.uniform(-.25,.25)
            f=branch/24;z=height*(.33+.57*f)
            reach=spread*(.7+.3*math.sin(f*math.pi))*(1-.55*f)
            tip=Vector((math.cos(theta)*reach,math.sin(theta)*reach,z+height*.10))
            limb((0,0,z-height*.12),tip,.1*(1-f*.5))
            for leaf in range(155):
                az=local.random()*math.tau;r=math.sqrt(local.random())*spread*.44
                p=tip+Vector((math.cos(az)*r,math.sin(az)*r,local.uniform(-1.25,1.55)))
                size=local.uniform(.30,.62)
                ang=local.random()*math.tau
                u=Vector((math.cos(ang),math.sin(ang),local.uniform(-.4,.4)))*size
                v=Vector((-math.sin(ang),math.cos(ang),local.uniform(-.8,.8)))*size*.50
                start=len(verts);verts.extend([tuple(p-u),tuple(p+v),tuple(p+u),tuple(p-v)])
                faces.append((start,start+1,start+2,start+3));indices.append(1+(branch+leaf)%3)
        mesh=bpy.data.meshes.new('Branched tree species '+str(species));mesh.from_pydata(verts,[],faces)
        for name in ['bark','leaf0','leaf1','leaf2']:mesh.materials.append(mats[name])
        for polygon,index in zip(mesh.polygons,indices):polygon.material_index=index
        tree_meshes.append(mesh)
    planted=0
    def tree(x,y,scale=1):
        nonlocal planted
        mesh=tree_meshes[planted%len(tree_meshes)]
        ob=bpy.data.objects.new('Mature tree '+str(planted),mesh);active.objects.link(ob)
        ob.location=(x,y,terrain_z(x,y));ob.scale=(scale* rng.uniform(.86,1.08),scale,scale*rng.uniform(.94,1.12));ob.rotation_euler[2]=rng.random()*math.tau
        planted+=1
    for _ in range(2300):
        x=rng.uniform(-540,600);y=rng.uniform(-440,760)
        if -132<x<156 and -240<y<101:continue
        if -218<x<-79 and 95<y<243:continue
        if -105<x<90 and 206<y<373:continue
        if abs(y+218)<12 or abs(x-126)<10 or (126<x<322 and abs(y-199)<10):continue
        # Patchy woodland and meadow, not uniform planted rows.
        if math.sin(x/43)*math.cos(y/59)>.67:continue
        tree(x,y,rng.uniform(.55,1.35))
    for x in range(-107,114,21):
        if -18<x<27:continue
        tree(x,-69,.48)
    for x,y,w,d,h in homes:
        tree(x-w*.68,y+3,rng.uniform(.55,.9))

    world=bpy.data.worlds.new('Early blue hour open sky');world.use_nodes=True;scene.world=world
    moods={
        'balanced-blue-hour':{'world':(.30,.40,.55,1),'strength':.50,'sun':1.15,'key':(.85,.90,1),'exposure':.50,'fill':1100000},
        'warm-horizon':{'world':(.29,.36,.48,1),'strength':.44,'sun':1.45,'key':(1,.84,.68),'exposure':.45,'fill':1000000},
        'cool-overcast':{'world':(.35,.43,.55,1),'strength':.70,'sun':.72,'key':(.84,.90,1),'exposure':.65,'fill':1300000},
    }
    mood=moods[lighting]
    world.node_tree.nodes.get('Background').inputs['Color'].default_value=mood['world']
    world.node_tree.nodes.get('Background').inputs['Strength'].default_value=mood['strength']
    sun_data=bpy.data.lights.new('Broad late sky key','SUN');sun_data.energy=mood['sun'];sun_data.angle=math.radians(14);sun_data.color=mood['key']
    sun=bpy.data.objects.new('Broad late sky key',sun_data);groups['Lighting'].objects.link(sun);sun.rotation_euler=(math.radians(32),math.radians(-24),math.radians(-38))
    light('Soft front sky bounce',(-230,-210,300),mood['fill'],260,(.79,.86,1),(0,60,0))
    scene.view_settings.view_transform='AgX'
    scene.view_settings.look='AgX - Medium High Contrast'
    scene.view_settings.exposure=mood['exposure']
    scene.render.film_transparent=False
    scene.render.use_motion_blur=False
    scene['syntheticConcept']=True
    scene['claimBoundary']='Separate neighboring entities; no exported services, live control, benefits or operating authority.'
    scene['physicalScale']='Metres; facility 180x108 m with approximately 21 m roof and 21.9 m parapet; fictional architectural proportions.'
    return {'seed':SEED,'facilityDimensionsMetres':[180,108,21.9],'architectureRevision':'layered-facade-recessed-atrium-v3','coolingBanks':3,'coolerAssembliesPerBank':8,'houses':len(homes),'treeInstances':planted,'treeSpecies':len(tree_meshes),'lighting':lighting,'lightingValues':mood,'nativeScene':'new geometry; not reconstructed from existing raster images','synthetic':True}


CAMERAS = {
    'A-shared-landscape': {'landscape': {'position':[300,-440,340], 'target':[25,80,0], 'lens':39, 'shiftX':-.26}, 'portrait': {'position':[210,-310,280], 'target':[0,95,0], 'lens':43, 'shiftX':-.10}},
    'B-grounded-architecture': {'landscape': {'position':[330,-490,260], 'target':[25,86,6], 'lens':41, 'shiftX':-.26}, 'portrait': {'position':[330,-470,305], 'target':[31,93,4], 'lens':43, 'shiftX':-.10}},
    'C-civic-landscape': {'landscape': {'position':[295,-440,460], 'target':[25,90,0], 'lens':41, 'shiftX':-.26}, 'portrait': {'position':[290,-430,440], 'target':[35,103,0], 'lens':43, 'shiftX':-.10}},
}


def set_camera(scene, family, composition, width, height):
    values=CAMERAS[family][composition]
    name=family+' '+composition
    obj=bpy.data.objects.get(name)
    if obj is None:
        data=bpy.data.cameras.new(name);obj=bpy.data.objects.new(name,data);bpy.data.collections['Cameras'].objects.link(obj)
    obj.location=values['position'];obj.rotation_euler=(Vector(values['target'])-obj.location).to_track_quat('-Z','Y').to_euler()
    obj.data.lens=values['lens'];obj.data.sensor_width=36;obj.data.shift_x=values['shiftX'];obj.data.clip_end=5000
    obj.data.dof.use_dof=False
    scene.camera=obj;scene.render.resolution_x=width;scene.render.resolution_y=height;scene.render.resolution_percentage=100
    return {**values,'resolution':[width,height],'sensorWidth':36,'depthOfField':False}
