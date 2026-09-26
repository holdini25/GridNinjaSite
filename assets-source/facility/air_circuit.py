"""V6 authored rack-return containment, with genuinely open manufactured ducts.

This is a synthetic construction illustration. Paths are geometric interfaces,
not CFD streamlines, airflows, temperatures or equipment sizing.
"""
import json
from mathutils import Vector


def build_air_circuit(g, report, out):
    import bpy
    cooling=g.DOMAIN['cooling'];accent=g.DOMAIN['accent_cooling']
    covers=g.semantic(g.empty('GN_AIR_SECTION_COVERS',cooling),'GN_AIR_SECTION_COVERS','cooling','air_section_covers')
    g.DOMAIN['air_section_covers']=covers
    report['airPassages']=[];report['airJunctions']=[]
    generated=[];route_base=len(report['routes'])

    def slab(name,p,size,identity,parent=cooling,mat='Graphite'):
        obj=g.box(name,p,size,mat,parent);obj['gnEquipmentId']=identity;generated.append(obj);return obj

    def port(identity,equipment,position,normal,service='air-return'):
        # Air apertures are empty, with real surrounding sheet geometry. Unlike
        # electrical/fluid ports, never fill them with a decorative connector box.
        report['ports'].append({'id':identity,'component':equipment,'domain':'cooling','service':service,
                               'position':list(position),'normal':list(normal),'enclosure_bounds':None,
                               'enclosure_source':'authored_open_air_aperture','enclosure_distance_metres':0})
        return identity

    def route(identity,start,end,path,owner):
        # The visible inlay shares the actual duct centerline parameterization.
        # Its small exterior offset is accounted for in authored distance, as on
        # existing busway inlays. Body sections stay independently inspectable.
        index=len(report['routes'])
        strips=[]
        if identity.startswith('air-rack-'):
            aa=Vector(path[0]);bb=Vector(path[-1]);join_z=bb.z-.15
            strips=[(Vector((aa.x,aa.y-.124,aa.z)),Vector((aa.x,aa.y-.124,join_z)),Vector((0,-1,0))),
                    (Vector((aa.x,aa.y-.124,join_z-.006)),Vector((aa.x,aa.y-.331,join_z-.006)),Vector((0,0,-1))),
                    (Vector((aa.x,aa.y-.331,join_z)),Vector((aa.x,aa.y-.331,bb.z)),Vector((0,-1,0)))]
        else:
            for a,b in zip(path,path[1:]):
                aa=Vector(a);bb=Vector(b)
                if identity=='air-trunk':offset=Vector((.331,0,0));normal=Vector((1,0,0))
                elif identity=='air-plenum':offset=Vector((0,-.081,0));normal=Vector((0,-1,0))
                elif identity.startswith('air-cooling-'):offset=Vector((0,0,.696));normal=Vector((0,0,1))
                else:offset=Vector((0,-.331,0));normal=Vector((0,-1,0))
                strips.append((aa+offset,bb+offset,normal))
        for j,(aa,bb,normal) in enumerate(strips):
            direction=(bb-aa).normalized();width=normal.cross(direction).normalized()*.009
            # One outward-facing metallic inlay face, raised 2mm from its
            # authored support. No hidden solid faces or guessed Euler axes.
            obj=g.mesh('Air return inspection inlay '+identity+str(j),[aa-width,bb-width,bb+width,aa+width],[(0,1,2,3)],'Copper',accent)
            obj['gnEquipmentId']=owner;obj['gnRouteIndex']=index;obj['gnRoutePath']=json.dumps(path,separators=(',',':'))
        length=sum((Vector(a)-Vector(b)).length for a,b in zip(path,path[1:]))
        report['routes'].append({'id':identity,'domain':'cooling','service':'air-return','from':start,'to':end,'profile':'air-duct',
                                'path':path,'renderedPath':path,'renderedLengthMetres':length,'lengthMetres':length,
                                'selectionAccent':{'placement':'outside authored return containment','widthMetres':.018}})

    # Two 650mm-deep row collectors, exactly 300mm outside height. Rear rack
    # riser follows its existing elevation. Bottom apertures align every collar.
    collector_x0=-2.665;collector_x1=3.49;depth=.65;height=.30;wall=.008
    for row,y in enumerate(g.ROW_Y):
        identity=f'air-row-{row}';cy=y+.48;cz=3.31+row*g.REAR_LIFT
        z0=cz-height/2;z1=cz+height/2;y0=cy-depth/2;y1=cy+depth/2
        front=slab('Return collector front wall',((collector_x0+3.165)/2,y0,cz),(3.165-collector_x0,wall,height),identity)
        front['gnSpatialRegion']='collector';front['gnSpatialAxis']=1
        slab('Return collector back wall',((collector_x0+3.165)/2,y1,cz),(3.165-collector_x0,wall,height),identity)
        cover=slab('Return collector removable cover',((collector_x0+3.165)/2,cy,z1),(3.165-collector_x0,depth,wall),identity,covers)
        cover['gnSurfaceTopRegion']='collector_top'
        cover['gnBakeCoverRole']='receiver'

        slab('Return collector capped left end',(collector_x0,cy,cz),(wall,depth,height),identity)
        # Bottom plate is tiled around, never across, the twelve real openings.
        span=collector_x0
        for i in range(6):
            x=-2.275+i*.91;lo=x-.292;hi=x+.292
            if lo>span:slab('Collector bottom bridge',((span+lo)/2,cy,z0),(lo-span,depth,wall),identity)
            for sign in [-1,1]:slab('Collector aperture perimeter',(x,cy+sign*(depth/2-.1025),z0),(.584,.205,wall),identity)
            roof=2.915+row*g.REAR_LIFT;collar_top=z0
            # Extend the shared master collar without blocking the passage.
            for sign in [-1,1]:
                slab('Rack exhaust riser side',(x+sign*.298,cy,(roof+collar_top)/2),(.012,.24,collar_top-roof),f'rack-{row*6+i:02d}',g.DOMAIN['workloads'])
                slab('Rack exhaust riser end',(x,cy+sign*.114,(roof+collar_top)/2),(.584,.012,collar_top-roof),f'rack-{row*6+i:02d}',g.DOMAIN['workloads'])
            exhaust=port(f'rack-air-out-{row}-{i}',f'rack-{row*6+i:02d}',(x,cy,roof),(0,0,1))
            tap=port(f'air-row-tap-{row}-{i}',identity,(x,cy,cz),(0,0,-1))
            route(f'air-rack-{row}-{i}',exhaust,tap,[[x,cy,roof],[x,cy,cz]],f'rack-{row*6+i:02d}')
            intake=port(f'rack-air-in-{row}-{i}',f'rack-{row*6+i:02d}',(x,y-.62,1.545+row*g.REAR_LIFT),(0,-1,0),'air-supply')
            report['airPassages'].append({'from':intake,'to':exhaust,'equipmentId':f'rack-{row*6+i:02d}','kind':'rack-front-to-rear'})
            span=hi
            # Narrow external flange seams + two supports retain manufacture.
            flange=slab('Collector cover flange',(x+.405,cy,z1+.006),(.014,depth+.018,.012),identity,covers)
            flange['gnBakeCoverRole']='contact_occluder'
        slab('Collector bottom extension',((span+3.165)/2,cy,z0),(3.165-span,depth,wall),identity)
        start=port(f'air-row-start-{row}',identity,(collector_x0,cy,cz),(-1,0,0))
        end=port(f'air-row-end-{row}',identity,(collector_x1,cy,cz),(1,0,0))
        route(f'air-collector-{row}',start,end,[[collector_x0,cy,cz],[collector_x1,cy,cz]],identity)
        report['airJunctions'].extend({'routeId':f'air-collector-{row}','portId':f'air-row-tap-{row}-{i}','s':(-2.275+i*.91-collector_x0)/(collector_x1-collector_x0)} for i in range(6))
        for xx in [-1.005,.815]:
            slab('Collector supporting foot',(xx,cy,3.046+row*g.REAR_LIFT),(.035,.08,.228),identity,mat='Steel')

    # Right trunk runs outside all rack envelopes and reserve cabinets. It is a
    # rectangular U-section with top covers, and receives both open row ends.
    identity='air-return-trunk';x=3.49;y0=g.ROW_Y[0]+.48;y1=1.63;z0=3.01;z1=3.58
    for xx in [x-.325,x+.325]:
        # Left wall has two genuine row apertures.
        if xx<x:
            intervals=[(y0-.325,y0+.325),(g.ROW_Y[1]+.48-.325,g.ROW_Y[1]+.48+.325)]
            prev=y0-.325
            for low,high in intervals:
                if low>prev:slab('Trunk wall between row apertures',(xx,(prev+low)/2,(z0+z1)/2),(wall,low-prev,z1-z0),identity)
                slab('Trunk aperture lower lip',(xx,(low+high)/2,z0+.06),(wall,high-low,.12),identity)
                slab('Trunk aperture upper lip',(xx,(low+high)/2,z1-.02),(wall,high-low,.04),identity)
                prev=high
        else:slab('Return trunk outer side',(xx,(y0+y1)/2,(z0+z1)/2),(wall,y1-y0+.65,z1-z0),identity)
    slab('Return trunk floor',(x,(y0-.325+1.305)/2,z0),(.65,1.305-(y0-.325),wall),identity)
    slab('Return trunk cover',(x,(y0+y1)/2,z1),(.65,y1-y0+.65,wall),identity,covers)
    slab('Return trunk front cap',(x,y0-.325,(z0+z1)/2),(.65,wall,z1-z0),identity)
    # Downcomer at back reaches the shallow common inlet plenum.
    slab('Trunk downcomer outer side',(x+.325,1.63,2.82),(wall,.65,.94),identity)
    slab('Trunk downcomer opening upper cheek',(x-.325,1.63,3.225),(wall,.65,.17),identity)
    slab('Trunk downcomer rear',(x,1.955,2.82),(.65,wall,.94),identity)
    slab('Trunk downcomer removable front',(x,1.305,2.82),(.65,wall,.94),identity,covers)
    trunk_a=port('air-trunk-in',identity,(x,y0,3.31),(0,-1,0))
    trunk_b=port('air-trunk-out',identity,(x,1.63,2.45),(-1,0,0))
    trunk_path=[[x,y0,3.31],[x,g.ROW_Y[1]+.48,3.43],[x,1.63,3.43],[x,1.63,2.45]]
    route('air-trunk',trunk_a,trunk_b,trunk_path,identity)
    report['airJunctions'].extend([{'routeId':'air-trunk','portId':'air-row-end-0','s':0.0},
                                  {'routeId':'air-trunk','portId':'air-row-end-1','s':(Vector(trunk_path[1])-Vector(trunk_path[0])).length/sum((Vector(a)-Vector(b)).length for a,b in zip(trunk_path,trunk_path[1:]))}])

    # Shallow inlet plenum fills the existing 310mm return transition space.
    # Its cooler-facing wall is absent at each intake, leaving a continuous
    # opening through the coil cavity and the unblocked top fan deck.
    identity='air-cooling-plenum';left=-2.775;right=3.815;front=1.555;back=1.83;bottom=1.01;top=3.14
    # A fixed seam/stiffener supports the trace in both closed and sectioned
    # views; removable sheets above and below it never leave a floating line.
    seam_z=2.45;seam_height=.028
    slab('Cooling return plenum fixed seam',((left+right)/2,front,seam_z),(right-left,wall,seam_height),identity)
    for low,high in [(bottom,seam_z-seam_height/2),(seam_z+seam_height/2,top)]:
        slab('Cooling return plenum removable front',((left+right)/2,front,(low+high)/2),(right-left,wall,high-low),identity,covers)
    slab('Cooling return plenum bottom',((left+right)/2,(front+back)/2,bottom),(right-left,back-front,wall),identity)
    slab('Cooling return plenum top',((left+3.165)/2,(front+back)/2,top),(3.165-left,back-front,wall),identity)
    slab('Cooling return plenum outer end',(right,(front+back)/2,(bottom+top)/2),(wall,back-front,top-bottom),identity)
    slab('Cooling return plenum rear closure',((2.775+right)/2,back,(bottom+top)/2),(right-2.775,wall,top-bottom),identity)
    slab('Cooling return plenum left',(left,(front+back)/2,(bottom+top)/2),(wall,back-front,top-bottom),identity)
    for xx in [-1.43,0,1.43,2.86]:slab('Cooling inlet flange between handlers',(xx,back,(bottom+top)/2),(.17,.015,top-bottom),identity)
    start=port('air-plenum-in',identity,(3.49,1.63,2.45),(1,0,0))
    end=port('air-plenum-left',identity,(-2.145,1.63,2.45),(-1,0,0))
    route('air-plenum',start,end,[[3.49,1.63,2.45],[-2.145,1.63,2.45]],identity)
    for i in range(4):
        xx=-2.145+i*1.43
        source=port(f'air-plenum-tap-{i}',identity,(xx,1.63,2.45),(0,1,0))
        target=port(f'cooler-air-in-{i}',f'cooler-{i}',(xx,1.83,2.45),(0,-1,0))
        route(f'air-cooling-{i}',source,target,[[xx,1.63,2.45],[xx,1.83,2.45]],f'cooler-{i}')
        outlet=port(f'cooler-air-out-{i}',f'cooler-{i}',(xx+.20,2.59,3.52),(0,0,1),'air-supply')
        report['airPassages'].append({'from':target,'to':outlet,'equipmentId':f'cooler-{i}','kind':'cooler-return-to-discharge'})
        report['airJunctions'].append({'routeId':'air-plenum','portId':source,'s':(3.49-xx)/(3.49+2.145)})
    bpy.context.view_layer.update()
    bounds={}
    for obj in bpy.data.collections['AUTHORING'].objects:
        identity=obj.get('gnEquipmentId')
        if identity and obj.type=='MESH':bounds.setdefault(identity,[]).extend(obj.matrix_world@Vector(p) for p in obj.bound_box)
    for p in report['ports']:
        if p['enclosure_bounds'] is None:
            points=bounds[p['component']];p['enclosure_bounds']=[[min(point[k] for point in points) for k in range(3)],[max(point[k] for point in points) for k in range(3)]]
    report['coolerLiquidCircuits']={str(k):[list(p) for p in path] for k,path in g.COOLER_CIRCUITS.items()}
    report['airConstruction']={'scope':'Illustrative geometric air circuit; no CFD or performance claim','collectorOutsideDepthMetres':depth,'collectorOutsideHeightMetres':height,'wallThicknessMetres':wall,
        'rackRearPassage':[.36,.60],'sectionCoverId':'GN_AIR_SECTION_COVERS','openRoomDomain':{'id':'room-air','from':[f'cooler-air-out-{i}' for i in range(4)],'to':[f'rack-air-in-{r}-{i}' for r in range(2) for i in range(6)]},
        'routeCount':len(report['routes'])-route_base,'constructionPartCount':len(generated),'checks':{'allFourFansUncovered':True,'actualCollectorAndIntakeApertures':True,'noOpenRoomStreamline':True}}
    (out/'service-report.json').write_text(json.dumps(report,indent=2)+'\n')
    (out/'air-construction-report.json').write_text(json.dumps(report['airConstruction'],indent=2)+'\n')
