"""Typed illustrative service topology, with measured geometric terminations.

These records describe authored visual connections. No quantity here estimates
electrical ratings, cooling flow, storage dispatchability or usable capacity.
"""
from dataclasses import dataclass,asdict
import json
import math
from pathlib import Path
from mathutils import Vector
import bpy


@dataclass
class Port:
    id:str
    component:str
    domain:str
    service:str
    position:tuple
    normal:tuple
    enclosure_bounds:tuple
    enclosure_source:str
    enclosure_distance_metres:float


class ServiceGraph:
    def __init__(self,box,cylinder,tube,domains):
        self.box=box;self.cylinder=cylinder;self.tube=tube;self.domains=domains
        self.ports={};self.routes=[];self.supports=0
        camera=json.loads((Path(__file__).resolve().parent/'scene.json').read_text())['camera']['position']
        self.camera=Vector((camera[0],-camera[2],camera[1]))

    def port(self,identity,component,domain,service,position,normal,bounds,bounds_source):
        if identity in self.ports:raise ValueError('Duplicate service port')
        point=Vector(position);axis=Vector(normal)
        if abs(axis.length-1)>1e-6:raise ValueError('Invalid port normal')
        # Every termination must lie on/within 6cm of its actual authored enclosure.
        distance=math.sqrt(sum(max(bounds[0][k]-point[k],0,point[k]-bounds[1][k])**2 for k in range(3)))
        if distance>.06:raise ValueError(f'{identity} has no equipment surface at its termination')
        p=Port(identity,component,domain,service,tuple(position),tuple(normal),bounds,bounds_source,distance)
        parent=self.domains[domain]
        for obj in [self.cylinder('Port gasket '+identity,point-axis*.014,point+axis*.012,.045,'Dark',parent,sides=10),
                    self.cylinder('Port collar '+identity,point+axis*.010,point+axis*.041,.032,'Steel' if domain=='workloads' else 'Copper',parent,sides=10)]:
            obj['gnEquipmentId']=component
        self.ports[identity]=p
        return identity

    def route(self,identity,domain,service,start,end,via,kind='pipe',radius=.023):
        a=self.ports[start];b=self.ports[end]
        if a.service!=service or b.service!=service:raise ValueError('Incompatible illustrative service types')
        path=[a.position,*via,b.position]
        if any(not all(math.isfinite(v) for v in point) for point in path):raise ValueError('Nonfinite service path')
        if any((Vector(p)-Vector(q)).length<.005 for p,q in zip(path,path[1:])):raise ValueError('Degenerate service segment')
        root=self.domains[domain];accent=self.domains['accent_'+domain]
        route_index=len(self.routes)
        rendered=path
        accent_objects=[]
        if kind=='busway':
            # Rectangular busway cross-section and fastened enclosure distinguish
            # electrical infrastructure from fluid pipes; copper marks selection.
            for index,(p,q) in enumerate(zip(path,path[1:])):
                p=Vector(p);q=Vector(q);delta=q-p
                body=self.box('Enclosed busway '+identity+str(index),(0,0,0),(.105,.07,delta.length),'Steel',root,.007)
                center=(p+q)/2;rotation=delta.to_track_quat('Z','Y')
                body.location=center;body.rotation_euler=rotation.to_euler()
                view=(self.camera-center).normalized()
                axes=[(Vector((1,0,0)),.105/2),(Vector((0,1,0)),.07/2)]
                axis,extent=max(axes,key=lambda entry:abs((rotation@entry[0]).dot(view)))
                sign=1 if (rotation@axis).dot(view)>=0 else -1
                # The accent is a raised flat inlay on the visible face, not a
                # tube buried inside the opaque busway enclosure.
                offset=axis*sign*(extent+.003)
                dimensions=(.004,.024,delta.length) if axis.x else (.024,.004,delta.length)
                strip=self.box('Visible busway accent '+identity+str(index),(0,0,0),dimensions,'Copper',accent)
                strip.location=center+rotation@offset;strip.rotation_euler=rotation.to_euler()
                accent_objects.append(strip)
                if abs(offset.dot(axis))-.002<=extent:raise ValueError('Selection inlay buried inside busway')
        else:
            # Short segmented fillets avoid the sharp pinched miters in v2.
            curved=[Vector(path[0])]
            for i in range(1,len(path)-1):
                p=Vector(path[i]);before=Vector(path[i-1]);after=Vector(path[i+1])
                trim=min(.09,(p-before).length*.24,(after-p).length*.24)
                entry=p+(before-p).normalized()*trim;leave=p+(after-p).normalized()*trim
                curved.append(entry)
                for step in [1,2,3]:
                    t=step/3;curved.append((1-t)**2*entry+2*(1-t)*t*p+t*t*leave)
            curved.append(Vector(path[-1]))
            accent_objects.append(self.tube('Terminated pipe '+identity,curved,radius,'Copper',accent,sides=8))
            rendered=[list(p) for p in curved]
        for obj in accent_objects:
            obj['gnRouteIndex']=route_index
            obj['gnRoutePath']=json.dumps([list(p) for p in rendered],separators=(',',':'))
        self.routes.append({'id':identity,'domain':domain,'service':service,'from':start,'to':end,'profile':kind,'path':[list(p) for p in path],
                            'renderedPath':[list(p) for p in rendered],'renderedLengthMetres':sum((Vector(p)-Vector(q)).length for p,q in zip(rendered,rendered[1:])),
                            'selectionAccent':{'placement':'camera-visible raised busway face','widthMetres':.024,'minimumSurfaceClearanceMetres':.001} if kind=='busway' else {'placement':'exposed copper pipe'},
                            'lengthMetres':sum((Vector(p)-Vector(q)).length for p,q in zip(path,path[1:]))})

    def support(self,domain,position,height=.1,width=.22):
        x,y,z=position;parent=self.domains[domain]
        self.box('Service saddle bracket',(x,y,z-height/2),(width,.038,height),'Steel',parent,.003)
        self.box('Service saddle foot',(x,y,z-height),(.12,.13,.026),'Dark',parent,.003)
        self.supports+=1

    def validate(self,path):
        connected={name for route in self.routes for name in [route['from'],route['to']]}
        if set(self.ports)!=connected:raise ValueError('Unconnected visible service port')
        if len({route['id'] for route in self.routes})!=len(self.routes):raise ValueError('Duplicate route identity')
        for route in self.routes:
            if tuple(route['path'][0])!=self.ports[route['from']].position or tuple(route['path'][-1])!=self.ports[route['to']].position:
                raise ValueError('Route does not terminate at its referenced ports')
        report={'schemaVersion':1,'scope':'Illustrative geometric connectivity only; no electrical, hydraulic or capacity calculation',
                'ports':[asdict(p) for p in self.ports.values()],'routes':self.routes,'supportCount':self.supports,
                'checks':{'uniquePortIds':True,'uniqueRouteIds':True,'serviceTypesMatch':True,'allPortsConnected':True,'equipmentTerminationsWithinSixCentimetres':True,
                          'finiteNondegenerateSegments':True,'routeEndpointToleranceMetres':0},'result':'passed'}
        Path(path).write_text(json.dumps(report,indent=2)+'\n')
        return report


def build_services(box,cylinder,tube,domains,row_y,reserve_positions,rear_lift,report_path):
    graph=ServiceGraph(box,cylinder,tube,domains)
    bpy.context.view_layer.update()
    equipment_bounds={}
    for obj in bpy.data.collections['AUTHORING'].objects:
        if obj.get('gnEquipmentId'):
            corners=[obj.matrix_world@Vector(p) for p in obj.bound_box]
            identity=obj['gnEquipmentId']
            if identity in equipment_bounds:corners.extend(Vector(p) for p in equipment_bounds[identity])
            equipment_bounds[identity]=(tuple(min(p[k] for p in corners) for k in range(3)),tuple(max(p[k] for p in corners) for k in range(3)))
    if len(equipment_bounds)!=21:raise ValueError('Expected 12 racks, four coolers, three switchgear cabinets and two reserve enclosures')
    def port(identity,component,domain,service,p,normal,half=(.09,.09,.05)):
        # Connector box/junction is itself modeled, ensuring the typed port has a
        # visible physical endpoint even when it is mounted on a busway branch.
        connector=box('Service connector '+identity,p,tuple(2*v for v in half),'Graphite',domains[domain],.008)
        connector['gnEquipmentId']=component
        bounds=equipment_bounds.get(component)
        source='authored_equipment_world_bounds'
        if bounds is None:
            # Junctions and collectors are explicit service components, separate
            # from the main cabinet inventory. Their own modeled bounds apply.
            bounds=(tuple(p[k]-half[k] for k in range(3)),tuple(p[k]+half[k] for k in range(3)))
            source='authored_service_junction_bounds'
        return graph.port(identity,component,domain,service,p,normal,bounds,source)
    for row,y in enumerate(row_y):
        height=3.16+row*rear_lift
        power_x=-3.44+row*.67
        source=port(f'power-top-{row}',f'switchgear-{row+1}','power','electrical',(power_x,-.29,2.75),(0,0,1))
        endpoint=port(f'bus-end-{row}',f'row-{row}-bus','power','electrical',(2.275,y,height),(0,0,1))
        graph.route(f'power-bus-{row}','power','electrical',source,endpoint,[(power_x,-.29,height),(power_x,y,height)],kind='busway')
        for index in range(6):
            x=-2.275+index*.91
            tap=port(f'bus-tap-{row}-{index}',f'row-{row}-bus','workloads','electrical',(x,y,height),(0,0,-1),half=(.055,.06,.038))
            roof=port(f'rack-in-{row}-{index}',f'rack-{row*6+index:02d}','workloads','electrical',(x,y,2.97+row*rear_lift),(0,0,1),half=(.05,.075,.016))
            graph.route(f'rack-feed-{row}-{index}','workloads','electrical',tap,roof,[],kind='busway')
            if index in [0,2,4]:graph.support('workloads',(x+.12,y,height-.01),height=.16)
    # Paired supply/return headers connect each cooler to an explicitly authored
    # collector at the side of the row; there are no loose pipe ends.
    for circuit,offset in [('supply',-.15),('return',.15)]:
        side_x=3.02+(offset+.15)*.5
        for obj in [box('Cooling collector enclosure',(side_x,3.23,.81),(.17,.23,.94),'Graphite',domains['cooling'],.016),
                    box('Cooling collector mounting foot',(side_x,3.23,.32),(.23,.31,.12),'Steel',domains['cooling'],.008)]:obj['gnEquipmentId']='cooling-collector-'+circuit
        collector=port('collector-'+circuit,'cooling-collector-'+circuit,'cooling',circuit,(side_x,3.23,1.10),(0,0,1),half=(.09,.10,.22))
        header_start=port('header-start-'+circuit,'cooling-header-'+circuit,'cooling',circuit,(-2.145+offset,3.20+offset,3.12),(1,0,0),half=(.035,.04,.04))
        graph.route('header-'+circuit,'cooling',circuit,header_start,collector,[(side_x,3.20+offset,3.12),(side_x,3.23,2.97)],radius=.029)
        for index in range(4):
            x=-2.145+index*1.43
            outlet=port(f'cooler-{index}-{circuit}',f'cooler-{index}','cooling',circuit,(x+offset,2.975,2.81),(0,1,0),half=(.06,.035,.06))
            tap=port(f'header-tap-{index}-{circuit}','cooling-header-'+circuit,'cooling',circuit,(x+offset,3.20+offset,3.12),(0,0,-1),half=(.035,.04,.04))
            graph.route(f'cooling-{index}-{circuit}','cooling',circuit,outlet,tap,[(x+offset,3.20+offset,2.81)],radius=.025)
        for x in [-1.43,0,1.43]:graph.support('cooling',(x,3.20+offset,3.10),height=.17)
    for index,(x,y) in enumerate(reserve_positions):
        source=port(f'reserve-out-{index}',f'reserve-{index}','storage','reserve-illustrative',(x,y+.69,.86),(0,1,0),half=(.09,.035,.08))
        tx=-4.11+index*.67
        target=port(f'reserve-switch-{index}',f'switchgear-{index}','storage','reserve-illustrative',(tx,-.84,.70),(0,-1,0),half=(.055,.025,.065))
        route_y=-2.91-index*.16
        graph.route(f'reserve-link-{index}','storage','reserve-illustrative',source,target,
                    [(x,y+.86,.86),(x,y+.86,.39),(4.87,y+.86,.39),(4.87,route_y,.39),(tx,route_y,.39),(tx,-.84,.39)],kind='busway')
        for sx in [-2.4,0,2.4]:graph.support('storage',(sx,route_y,.39),height=.10,width=.14)
    return graph.validate(report_path)
