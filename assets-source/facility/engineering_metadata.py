"""Authored geometry identities and connectivity; never a facility solver."""
import json
import math
from mathutils import Vector


def yup(point):
    return [round(float(point[0]),6),round(float(point[2]),6),round(float(-point[1]),6)]


def bounds_yup(points):
    points=[yup(p) for p in points]
    return {'min':[min(p[k] for p in points) for k in range(3)],'max':[max(p[k] for p in points) for k in range(3)]}


def route_distance(point,path):
    """Project a surface vertex onto its authored centerline, once at export."""
    best=float('inf');distance=0.;cumulative=0.
    for aa,bb in zip(path,path[1:]):
        a=Vector(aa);delta=Vector(bb)-a;length=delta.length
        t=max(0.,min(1.,(point-a).dot(delta)/(length*length)))
        error=(point-a-delta*t).length_squared
        if error<best:best=error;distance=cumulative+t*length
        cumulative+=length
    return distance


def compile_topology(report,objects):
    import bpy
    bpy.context.view_layer.update()
    inventory={}
    for obj in objects:
        identity=obj.get('gnEquipmentId')
        if not identity or obj.type!='MESH':continue
        item=inventory.setdefault(identity,{'points':[],'system':obj.get('gnDomain')})
        item['points'].extend(obj.matrix_world@Vector(p) for p in obj.bound_box)
    for port in report['ports']:
        if port['component'] not in inventory:
            low,high=port['enclosure_bounds']
            inventory[port['component']]={'points':[Vector(low),Vector(high)],'system':port['domain']}
    def display(identity):
        if identity.startswith('rack-'):
            i=int(identity.split('-')[-1]);return f'Rack {i+1:02d}','workloads','server_rack',[390+(i%6)*85,310+(i//6)*110]
        if identity.startswith('switchgear-'):
            i=int(identity.split('-')[-1]);return f'Electrical cabinet {i+1}','power','electrical_distribution',[80,190+i*115]
        if identity.startswith('cooler-'):
            i=int(identity.split('-')[-1]);return f'Cooling unit {i+1}','cooling','heat_exchanger',[390+i*142,65]
        if identity.startswith('reserve-'):
            i=int(identity.split('-')[-1]);return f'Reserve cabinet {i+1}','storage','illustrative_reserve',[220+i*145,595]
        if identity.startswith('air-row-'):
            i=int(identity.rsplit('-',1)[1]);return f'Row {i+1} exhaust collector','cooling','air_return_collector',[370,485+i*42]
        if identity=='air-return-trunk':return 'Right-side return trunk','cooling','air_return_trunk',[935,435]
        if identity=='air-cooling-plenum':return 'Cooling return plenum','cooling','air_return_plenum',[750,235]
        if identity.startswith('row-'):
            i=int(identity.split('-')[1]);return f'Row {i+1} busway','power','service_junction',[260,310+i*110]
        circuit='Supply' if identity.endswith('supply') else 'Return'
        if identity.startswith('cooling-header'):
            return f'{circuit} header','cooling','service_junction',[410,150 if circuit=='Supply' else 215]
        return f'{circuit} collector','cooling','service_junction',[950,150 if circuit=='Supply' else 215]
    equipment=[]
    for index,identity in enumerate(sorted(inventory)):
        label,system,role,diagram=display(identity)
        equipment.append({'id':identity,'index':index,'label':label,'system':system,'role':role,'bounds':bounds_yup(inventory[identity]['points']),'diagram':diagram})
    indices={item['id']:item['index'] for item in equipment}
    for obj in objects:
        if obj.get('gnEquipmentId') in indices:obj['gnEquipmentIndex']=indices[obj['gnEquipmentId']]
    ports=[{'id':p['id'],'equipmentId':p['component'],'service':p['service'],'position':yup(p['position'])} for p in report['ports']]
    routes=[{'id':r['id'],'index':i,'system':r['domain'],'service':r['service'],'from':r['from'],'to':r['to'],
             'path':[yup(p) for p in r['renderedPath']],'lengthMetres':r['renderedLengthMetres']} for i,r in enumerate(report['routes'])]
    # These are explicit continuous bus/header connections. Supply and return
    # collectors remain independent; belonging to a cabinet never implies flow.
    links=[]
    for row in range(2):
        chain=[f'bus-end-{row}',*[f'bus-tap-{row}-{i}' for i in reversed(range(6))]]
        links.extend({'from':a,'to':b} for a,b in zip(chain,chain[1:]))
    for circuit in ['supply','return']:
        chain=['header-start-'+circuit,*[f'header-tap-{i}-{circuit}' for i in range(4)]]
        links.extend({'from':a,'to':b} for a,b in zip(chain,chain[1:]))
    result={'schemaVersion':'facility-topology.v2','equipment':equipment,'ports':ports,'routes':routes,'internalLinks':links}
    def medium(service):return 'water' if service in ['supply','return'] else 'air' if service.startswith('air-') else service
    for port in ports:
        port['medium']=medium(port['service']);port['role']=port['service']
    for route in routes:
        route['medium']=medium(route['service']);route['direction']='reverse' if route['service']=='supply' else 'forward' if route['service']!='reserve-illustrative' else 'none'
    port_map={item['id']:item for item in ports};route_map={item['id']:item for item in routes}
    branches=list(report['airJunctions'])
    def branch(port_id,route_id):
        route=route_map[route_id];point=Vector(port_map[port_id]['position'])
        distance=route_distance(point,route['path']);ratio=distance/route['lengthMetres']
        branches.append({'portId':port_id,'routeId':route_id,'s':round(ratio,9)})
        return ratio
    for row in range(2):
        for i in range(6):branch(f'bus-tap-{row}-{i}',f'power-bus-{row}')
    for circuit in ['supply','return']:
        for i in range(4):branch(f'header-tap-{i}-{circuit}','header-'+circuit)
    # The common downcomer/plenum interface has two coincident authored ports.
    branches.append({'portId':'air-plenum-in','routeId':'air-trunk','s':1.0})
    branch_map={(b['portId'],b['routeId']):b['s'] for b in branches}
    passages=[]
    def passage(identity,equipment,fluid,from_id,to_id,path):
        world=[yup(p) for p in path]
        passages.append({'id':identity,'equipmentId':equipment,'medium':fluid,'from':from_id,'to':to_id,'path':world,
                         'lengthMetres':sum((Vector(a)-Vector(b)).length for a,b in zip(world,world[1:]))})
    for p in report['airPassages']:
        a=next(item for item in report['ports'] if item['id']==p['from'])['position'];b=next(item for item in report['ports'] if item['id']==p['to'])['position']
        if p['kind']=='rack-front-to-rear':path=[a,[a[0],b[1],a[2]],b]
        else:path=[a,[a[0],2.08,2.30],[a[0],2.39,2.30],[a[0],2.79,2.30],[a[0],2.79,3.24],[b[0],b[1],3.24],b]
        passage(p['equipmentId']+'-air-passage',p['equipmentId'],'air',p['from'],p['to'],path)
    for i in range(4):passage(f'cooler-{i}-water-passage',f'cooler-{i}','water',f'cooler-{i}-supply',f'cooler-{i}-return',report['coolerLiquidCircuits'][str(i)])
    def segment(route_id,start=0.,end=1.):return {'routeId':route_id,'fromS':round(start,9),'toS':round(end,9)}
    racks=[]
    for row in range(2):
        for i in range(6):
            rack=row*6+i;cooler=min(3,i*4//6)
            racks.append({'equipmentId':f'rack-{rack:02d}','ledIndices':list(range(rack*4,rack*4+4)),'fanIndices':[0,1,2,3],
                'electrical':[segment(f'power-bus-{row}',0,branch_map[(f'bus-tap-{row}-{i}',f'power-bus-{row}')]),segment(f'rack-feed-{row}-{i}')],
                'exhaust':[segment(f'air-rack-{row}-{i}'),segment(f'air-collector-{row}',branch_map[(f'air-row-tap-{row}-{i}',f'air-collector-{row}')],1),
                    segment('air-trunk',branch_map[(f'air-row-end-{row}','air-trunk')],1),
                    segment('air-plenum',0,branch_map[(f'air-plenum-tap-{cooler}','air-plenum')]),segment(f'air-cooling-{cooler}')],
                'coolingSupply':[segment('header-supply',1,branch_map[(f'header-tap-{cooler}-supply','header-supply')]),segment(f'cooling-{cooler}-supply',1,0)],
                'coolingReturn':[segment(f'cooling-{cooler}-return'),segment('header-return',branch_map[(f'header-tap-{cooler}-return','header-return')],1)]})
    room=report['airConstruction']['openRoomDomain']
    result['ecosystem']={'branches':branches,'passages':passages,'openAirDomains':[{'id':room['id'],'label':'Open surrounding room air','outlets':room['from'],'inlets':room['to']}],
        'thermalCouplings':[{'id':f'cooler-{i}-thermal-exchange','equipmentId':f'cooler-{i}','airPassage':f'cooler-{i}-air-passage','waterPassage':f'cooler-{i}-water-passage'} for i in range(4)],
        'racks':racks,'sections':[{'id':'air-path','coverIds':['GN_AIR_SECTION_COVERS']}]}
    assert len(equipment)==31 and len(routes)==46 and len(ports)==108
    return result


def scalar_attribute(mesh,name,values):
    attribute=mesh.attributes.new(name=name,type='FLOAT',domain='POINT')
    attribute.data.foreach_set('value',values)


def source_modules(directory):
    import hashlib
    names=['generate.py','export.py','surface_contract.py','surface_bake.py','spatial_bake.py','bake_job.py','compute.py','service_routes.py','engineering_metadata.py','specimens.py','rack_kit.py','rack_motion.py','air_circuit.py','scene.json']
    return {name:hashlib.sha256((directory/name).read_bytes()).hexdigest() for name in names if (directory/name).exists()}
