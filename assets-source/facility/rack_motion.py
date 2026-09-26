"""Authored rack hinge/rail geometry and conservative, sampled sweep validation.

Only the leaf moves. Connectivity is deliberately isolated, not a live service
procedure or mechanically certified design. All distances are metres.
"""
import math
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

HINGE = Vector((-.377, -.657, 1.405))
OPEN_ANGLE = math.radians(-110)
TRAVEL = .18


def author_door(g, frame, door):
    """Stationary surround stays in frame; a smaller leaf clears it outwards."""
    for x in [-.341,.341]:
        g.box('Moving door leaf stile',(x,-.665,1.405),(.020,.018,2.45),'Graphite',door,.0015,keep_bevel=True)
    for z in [.180,2.630]:
        g.box('Moving door leaf end rail',(0,-.665,z),(.682,.018,.022),'Graphite',door,.0015,keep_bevel=True)
    front=g.panel('Moving door perforations',(0,-.671,1.405),.662,2.432,'Grille',door,repeat=4,surface='rack_a')
    # The open leaf presents its inside face to the service camera. A second
    # outward-wound skin 1.5mm behind the front preserves that real sheet depth
    # without globally enabling double-sided materials or adding a draw call.
    vertices=[(v.co.x,v.co.y+.0015,v.co.z) for v in front.data.vertices]
    faces=[tuple(reversed(p.vertices)) for p in front.data.polygons]
    back=g.mesh('Moving door inner perforations',vertices,faces,'Grille',door)
    for key in front.keys():back[key]=front[key]
    uv_by_vertex={loop.vertex_index:front.data.uv_layers.active.data[loop.index].uv.copy() for loop in front.data.loops}
    uv=back.data.uv_layers.new(name='UVMap')
    for loop in back.data.loops:uv.data[loop.index].uv=uv_by_vertex[loop.vertex_index]
    back['gnSheetSeparationMetres']=.0015
    g.box('Moving recessed door handle',(.313,-.683,1.47),(.025,.018,.24),'Trim',door,.004)
    for z in [.39,1.405,2.42]:
        # A hollow moving sleeve turns around a narrower fixed pin. Separate
        # stationary upper/lower knuckles have explicit axial clearance.
        vertices=[];faces=[];n=12
        for zz in [z-.013,z+.013]:
            for r in [.004,.006]:
                for i in range(n):
                    a=i*math.tau/n;vertices.append((HINGE.x+r*math.cos(a),HINGE.y+r*math.sin(a),zz))
        for i in range(n):
            j=(i+1)%n
            faces += [(i,j,n+j,n+i),(2*n+i,3*n+i,3*n+j,2*n+j),
                      (i,2*n+i,2*n+j,j),(n+i,n+j,3*n+j,3*n+i)]
        g.mesh('Moving hinge sleeve',vertices,faces,'Steel',door)
        g.box('Moving hinge leaf',(-.3585,-.662,z),(.028,.008,.026),'Steel',door)
        for dz in [-.0276,.0276]:
            g.cylinder('Fixed hinge knuckle',(HINGE.x,HINGE.y,z+dz-.0126),(HINGE.x,HINGE.y,z+dz+.0126),.006,'Steel',frame,sides=12)
            g.box('Fixed hinge mount',(-.377,-.637,z+dz),(.019,.040,.023),'Graphite',frame)
        g.cylinder('Fixed hinge pin',(HINGE.x,HINGE.y,z-.042),(HINGE.x,HINGE.y,z+.042),.0035,'Steel',frame,sides=12)


def motion_metadata():
    return {'version':1,
            'door':{'objectId':'GN_RACK_DOOR','closed':[0,0,0,1],
                    'open':[0,math.sin(OPEN_ANGLE/2),0,math.cos(OPEN_ANGLE/2)]},
            'tray':{'objectId':'GN_RACK_TRAY','retracted':[0,0,0],'extended':[0,0,TRAVEL]},
            'cutawayObjectIds':['GN_RACK_PANEL'],
            # Reviewed 30-degree front/side view gives the module fronts and
            # service tray more screen area, with the open leaf on the left.
            # Swept bounds remain fixed while the mechanical parts move.
            'camera':{'camera':[3.2,3.7,5.8],'target':[-.05,1.35,.20],'padding':1.12},
            'fitBounds':{'min':[-.7,0,-.72],'max':[.56,2.885,1.45]},
            # Explicit, stationary cutaway view. These bounds isolate the tray,
            # both slides and the parked connector without inventing geometry.
            'serviceDetail':{'version':1,
                             'camera':{'camera':[2.2,2.35,1.55],'target':[.015,1.48,.17],'padding':1.12},
                             'fitBounds':{'min':[-.345,1.34,-.46],'max':[.375,1.62,.80]},
                             'partIds':['GN_RACK_TRAY','GN_RACK_FRAME','GN_RACK_POWER'],
                             'requiresCutaway':True},
            'anchors':[{'id':'door','objectId':'GN_RACK_DOOR','position':[.690,.065,.048]},
                       {'id':'tray','objectId':'GN_RACK_TRAY','position':[.22,1.478,.598]}],
            'hingePosition':[HINGE.x,HINGE.z,-HINGE.y]}


def localize_door(root):
    """Move the semantic root to the shaft while preserving authored world geometry."""
    # merge_export emits world-space vertices. Shift each leaf mesh once and
    # translate its root, retaining mesh UVs and evaluated split normals.
    for child in root.children:
        if child.type!='MESH':raise ValueError('Unexpected moving leaf child')
        child.data.transform(Matrix.Translation(-HINGE))
    root.location=HINGE
    root['gnRole']='specimen_part'
    root['gnJoint']='hinge'
    root['gnAxisLocal']=[0.,0.,1.]


def validate_authoring(g,parts,motion):
    """BVH intersection checks on evaluated authoring triangles across motion.

    Tests 0..110 degrees at 0.5 degree steps, including the closed endpoint,
    with the tray retracted; then 0..180mm at 1mm steps with the door fully
    open. Stationary frame includes the plinth, surrounds and hinge pins.
    Every material mesh participates, including thin perforation receivers.
    """
    import bpy
    bpy.context.view_layer.update()
    graph=bpy.context.evaluated_depsgraph_get()
    triangles={p['id']:[] for p in parts};named={}
    for p in parts:
        for obj in [*g.collection.objects,*bpy.data.collections['AUTHORING_MANUAL'].objects]:
            if obj.type!='MESH' or (obj.parent!=p['object'] and obj.get('gnPartId')!=p['id']):continue
            evaluated=obj.evaluated_get(graph);mesh=evaluated.to_mesh();mesh.calc_loop_triangles()
            tris=[tuple(obj.matrix_world@mesh.vertices[i].co for i in face.vertices) for face in mesh.loop_triangles]
            triangles[p['id']].extend(tris);named[obj.name]=tris
            evaluated.to_mesh_clear()
    def bvh(tris):
        points=[p for tri in tris for p in tri]
        return BVHTree.FromPolygons(points,[(i,i+1,i+2) for i in range(0,len(points),3)],all_triangles=True,epsilon=0.)
    frame=triangles['GN_RACK_FRAME'];door=triangles['GN_RACK_DOOR'];tray=triangles['GN_RACK_TRAY']
    fixed=frame+triangles['GN_RACK_SERVERS']+triangles['GN_RACK_POWER']+triangles['GN_RACK_PANEL']
    fixed_bvh=bvh(fixed);tray_bvh=bvh(tray)
    points=[p for tris in triangles.values() for tri in tris for p in tri]
    failures=[];door_steps=221;rail_steps=181
    for step in range(door_steps):
        rotation=Matrix.Rotation(OPEN_ANGLE*step/(door_steps-1),3,'Z')
        moved=[tuple(HINGE+rotation@(p-HINGE) for p in tri) for tri in door]
        moving=bvh(moved);points.extend(p for tri in moved for p in tri)
        hits=moving.overlap(fixed_bvh);tray_hits=moving.overlap(tray_bvh)
        if hits or tray_hits:
            failures.append({'phase':'door','angleDegrees':math.degrees(OPEN_ANGLE)*step/(door_steps-1),'fixedOverlaps':len(hits),'trayOverlaps':len(tray_hits)})
    opened=[tuple(HINGE+Matrix.Rotation(OPEN_ANGLE,3,'Z')@(p-HINGE) for p in tri) for tri in door]
    door_bvh=bvh(opened)
    # Rails are structurally independent; the moving tray may not intersect
    # fixed supports, surrounding trays, power harness or the open leaf.
    for step in range(rail_steps):
        shift=Vector((0,-TRAVEL*step/(rail_steps-1),0))
        moved=[tuple(p+shift for p in tri) for tri in tray];moving=bvh(moved)
        points.extend(p for tri in moved for p in tri)
        hits=moving.overlap(fixed_bvh);door_hits=moving.overlap(door_bvh)
        if hits or door_hits:
            failures.append({'phase':'tray','travelMetres':TRAVEL*step/(rail_steps-1),'fixedOverlaps':len(hits),'doorOverlaps':len(door_hits)})
    if failures:
        # Names make a generator failure actionable instead of concealing an
        # interpenetrating rail or frame behind a coarse aggregate bound.
        at=failures[0];phase=at['phase']
        rotation=Matrix.Rotation(math.radians(at.get('angleDegrees',-110)),3,'Z')
        moving=bvh([tuple(HINGE+rotation@(p-HINGE) for p in tri) for tri in door]) if phase=='door' else bvh([tuple(p+Vector((0,-at['travelMetres'],0)) for p in tri) for tri in tray])
        targets={obj.name for obj in g.collection.objects if obj.type=='MESH' and obj.parent and obj.parent.get('gnId')!=('GN_RACK_DOOR' if phase=='door' else 'GN_RACK_TRAY')}
        names=[name for name in targets if name in named and moving.overlap(bvh(named[name]))]
        raise ValueError(f'Rack motion collision: {failures[:3]} with {names}')
    from engineering_metadata import bounds_yup
    bounds=bounds_yup(points)
    # Expand by the maximal arc between samples: at <0.76m radius a half-degree
    # step spans <6.7mm. A 7mm envelope guard covers unsampled visual extents.
    bounds={'min':[round(v-.007,6) for v in bounds['min']], 'max':[round(v+.007,6) for v in bounds['max']]}
    closed_gap=min(p.y for tri in tray for p in tri)-max(p.y for tri in door for p in tri)
    continuous=prove_continuous_clearance(door,tray,fixed)
    return {'schemaVersion':'facility-rack-motion-validation.v1','result':'passed',
            'method':'Evaluated triangle BVH intersection at 0.5-degree door and 1mm tray steps; conservative fit-bound guard; not a mechanical certification',
            'doorSamples':door_steps,'traySamples':rail_steps,'doorDegrees':110,'trayTravelMetres':TRAVEL,
            'hingePositionYup':[HINGE.x,HINGE.z,-HINGE.y],'axisLocalYup':[0,1,0],
            'closedDoorTrayFrontalPlaneSeparationMetres':closed_gap,'frameIncludes':['stationary surround','hinge pins','plinth','support rails'],
            'doorLeafOnly':True,'cutawayIndependent':True,'serviceConnector':'disconnected plug parked on fixed rail; isolated inlet moves with tray',
            'intersections':0,'fitBounds':bounds,'continuousClearance':continuous,
            'limits':'Continuous geometric nonintersection is conditional on the authored interlock; no mechanical certification.'}


def prove_continuous_clearance(door, tray, fixed):
    """Interval separating-axis proof over actual triangles, no pose sampling gap.

    Vertex projection during hinge motion is a*sin(theta)+b*cos(theta)+c;
    evaluate its exact interval extrema on each fixed separating axis. Linear
    rail projections attain their extrema at endpoints. An interval is accepted
    only when every potentially overlapping triangle pair has a separating axis
    for its entire duration. Indeterminate intervals subdivide and fail closed.
    """
    import numpy as np
    obstacles=np.asarray(fixed,dtype=np.float64)
    low=obstacles.min(axis=1);high=obstacles.max(axis=1)
    checked=0;subdivisions=0;smallest_gap=float('inf')
    def projections(tri,axis,lo,hi,mode):
        if mode=='rail':
            values=[axis.dot(p+Vector((0,-t,0))) for p in tri for t in [lo,hi]]
        else:
            values=[]
            for p in tri:
                local=p-HINGE;a=axis.x*local.x+axis.y*local.y;b=-axis.x*local.y+axis.y*local.x
                c=axis.dot(HINGE)+axis.z*local.z
                angles=[lo,hi];extremum=math.atan2(b,a)
                for k in range(-2,3):
                    angle=extremum+k*math.pi
                    if lo<angle<hi:angles.append(angle)
                values.extend(a*math.cos(t)+b*math.sin(t)+c for t in angles)
        return min(values),max(values)
    def separate(tri,other,lo,hi,mode,depth=0):
        nonlocal checked,subdivisions,smallest_gap
        checked+=1
        middle=(lo+hi)/2
        pose=[HINGE+Matrix.Rotation(middle,3,'Z')@(p-HINGE) for p in tri] if mode=='hinge' else [p+Vector((0,-middle,0)) for p in tri]
        edges=[pose[(i+1)%3]-pose[i] for i in range(3)];other_edges=[other[(i+1)%3]-other[i] for i in range(3)]
        normal_a=edges[0].cross(edges[1]);normal_b=other_edges[0].cross(other_edges[1])
        axes=[normal_a,normal_b]+[a.cross(b) for a in edges for b in other_edges]
        # In-plane axes also handle coplanar triangles and sheet surfaces.
        axes.extend(normal_a.cross(e) for e in edges)
        axes.extend(normal_b.cross(e) for e in other_edges)
        for axis in axes:
            if axis.length_squared<1e-20:continue
            axis.normalize();amin,amax=projections(tri,axis,lo,hi,mode)
            values=[axis.dot(p) for p in other];bmin,bmax=min(values),max(values)
            gap=max(bmin-amax,amin-bmax)
            if gap>1e-6:
                smallest_gap=min(smallest_gap,gap);return
        if depth>=14:raise ValueError(f'Continuous {mode} clearance not proven on interval {lo}..{hi}')
        subdivisions+=1
        separate(tri,other,lo,middle,mode,depth+1);separate(tri,other,middle,hi,mode,depth+1)
    def run(tris,mode,lo,hi):
        for tri in tris:
            bounds=[projections(tri,Vector(axis),lo,hi,mode) for axis in [(1,0,0),(0,1,0),(0,0,1)]]
            minimum=np.asarray([b[0] for b in bounds]);maximum=np.asarray([b[1] for b in bounds])
            candidates=np.flatnonzero(np.all(high>=minimum-1e-9,axis=1)&np.all(low<=maximum+1e-9,axis=1))
            for index in candidates:separate(tri,[Vector(p) for p in obstacles[index]],lo,hi,mode)
    # Door operates only while the tray is retracted.
    obstacles=np.asarray(fixed+tray,dtype=np.float64);low=obstacles.min(axis=1);high=obstacles.max(axis=1)
    run(door,'hinge',OPEN_ANGLE,0.)
    # Tray operates only once the door has reached its fully open stop.
    opened=[tuple(HINGE+Matrix.Rotation(OPEN_ANGLE,3,'Z')@(p-HINGE) for p in tri) for tri in door]
    obstacles=np.asarray(fixed+opened,dtype=np.float64);low=obstacles.min(axis=1);high=obstacles.max(axis=1)
    run(tray,'rail',0.,TRAVEL)
    return {'method':'Analytic projection extrema and recursive interval separating-axis proof on evaluated triangles',
            'result':'passed','trianglePairIntervalChecks':checked,'subdivisions':subdivisions,
            'minimumSeparatingProjectionMetres':smallest_gap,'numericalSeparationToleranceMetres':1e-6,
            'doorIntervalDegrees':[0,110],'trayIntervalMetres':[0,TRAVEL],
            'conditions':['door motion with tray retracted','tray motion with door fully open'],
            'scope':'Geometric nonintersection only; no load, tolerance-stack, wear or service-safety certification'}
