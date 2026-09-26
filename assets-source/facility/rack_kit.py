"""Shared, dimensioned rack construction and two authored server face variants.

The same reusable front kit is used by the miniature and inspection specimen.
It describes illustrative manufacture, never a vendor rating or a capacity model.
"""
from dataclasses import dataclass
from surface_contract import REVISION, surface_spec


@dataclass(frozen=True)
class RackEnvelope:
    width: float = .78
    depth: float = 1.24
    height: float = 2.55
    sheet: float = .016
    frame: float = .036
    frame_bevel: float = .002
    module_bevel: float = .0007


ENVELOPE = RackEnvelope()


def surface(obj, region):
    spec=surface_spec(region)
    obj['gnSurfaceContract']=REVISION
    obj['gnSurfaceRegion'] = region
    obj['gnSurfaceTileMetres']=list(spec.metric_size)
    obj['gnSurfaceSeed']=str(spec.seed)
    obj['gnBakeReceiverFamily']=spec.receiver_family
    if region=='polymer':obj['gnSurfaceRole']='polymer'
    return obj


def front_module(g, parent, center, width, height, variant='compute', detail=False):
    """A faceplate behind its perimeter, with real pockets and raised latches.

    Blender front is -Y. All offsets derive from one front plane, so the
    equipment cannot accidentally protrude through its enclosing door.
    """
    x,y,z=center
    plate=g.box('Kit server faceplate '+variant,(x,y,z),(width,.018,height),'Graphite',parent,
                ENVELOPE.module_bevel,bevel_segments=1,keep_bevel=detail)
    surface(plate,'paint')
    for side in [-1,1]:
        xx=x+side*(width/2-.033)
        surface(g.box('Kit recessed latch pocket',(xx,y-.012,z),(.041,.013,height*.62),'Dark',parent) if detail else g.panel('Kit latch pocket backing',(xx,y-.0185,z),.041,height*.62,'Dark',parent,surface='polymer'),'polymer')
        g.box('Kit captive lever',(xx,y-.021,z),(.014,.012,height*.43),'Steel',parent,
              .0015,bevel_segments=1,keep_bevel=detail)
    usable=width-.14
    if variant=='compute':
        for side in [-1,1]:
            surface(g.panel('Kit compute vent',(x+side*usable*.255,y-.0105,z),usable*.43,height*.69,
                             'Grille',parent,surface='face_a'),'face_a')
    else:
        # Two distinct, repeated drive/module carriers and one blanking strip.
        for slot in range(3):
            xx=x+(slot-1)*usable/3
            if detail:g.box('Kit modular carrier recess',(xx,y-.011,z),(usable/3-.010,.012,height*.72),'Dark',parent)
            else:g.panel('Kit carrier backing',(xx,y-.017,z),usable/3-.010,height*.72,'Dark',parent,surface='rubber')
            surface(g.panel('Kit carrier ventilation',(xx,y-.018,z),usable/3-.023,height*.53,
                            'Grille',parent,surface='face_b'),'face_b')
        if detail:g.box('Kit blanking strip',(x,y-.012,z+height*.405),(usable,.008,.013),'Dark',parent)
        else:g.panel('Kit blanking strip',(x,y-.016,z+height*.405),usable,.013,'Dark',parent,surface='rubber')
    # A printed asset/face identifier occupies an existing material batch.
    surface(g.panel('Kit printed module identifier',(x+width*.22,y-.023,z-height*.36),width*.14,height*.12,
                    'Steel',parent,surface='label'),'label')
    return plate


def enclosure(g,parent,origin,base,side_parent=None,door_parent=None,detail=False,articulated=False):
    """One metric cabinet/frame/rail/roof master for both export derivatives."""
    x,y=origin;e=ENVELOPE;w,d,h=e.width,e.depth,e.height;front=y-d/2
    side_parent=side_parent or parent;door_parent=door_parent or parent
    surround_parent=parent if articulated else door_parent
    # Thin manufactured walls replace the solid cube. A dark equipment field
    # sits behind the module bank; no transparent view through solid equipment.
    for sign in [-1,1]:
        panel=g.box('Kit rack side panel',(x+sign*(w/2-e.sheet/2),y,base+h/2),
              (e.sheet,d,h-.025),'Graphite',side_parent if sign>0 else parent,e.frame_bevel,bevel_segments=2 if detail else 1,keep_bevel=True)
        if sign > 0 and side_parent == parent:
            # This field belongs to the fixed right wall and its surrounding
            # construction. The removable specimen panel cannot inherit it.
            g.spatial_receiver(panel,'rack_panel',0,1,
                               (x+w/2,y-d/2,base+.0125),
                               (0,1,0),(0,0,1),(d,h-.025))
        g.box('Kit door upright',(x+sign*(w/2-e.frame/2),front-.008,base+h/2),
              (e.frame,.040,h-.035),'Graphite',surround_parent,.002,bevel_segments=2 if detail else 1,keep_bevel=True)
        g.box('Kit front mounting rail',(x+sign*(w/2-(.047 if articulated else .067)),front+.052,base+h/2),
              (.014 if articulated else .022,.022,h-.13),'Steel',parent,.001,keep_bevel=False)
    g.box('Kit rear panel',(x,y+d/2-.008,base+h/2),(w-.025,e.sheet,h-.025),'Graphite',parent,.002)
    # The rear capture chamber supplies the dark recess; a solid decorative
    # backing would incorrectly obstruct the illustrative ventilation passage.
    for z in [base+.025,base+h-.025]:
        g.box('Kit door cross rail',(x,front-.008,z),(w-.035,.040,.035),'Graphite',surround_parent,.0015,keep_bevel=True)
    # V6 roof has a real rear exhaust aperture. Four sheet sections retain
    # the envelope; no invisible solid cover blocks the captured air passage.
    roof_z=base+h+.025;aperture_x=.58;aperture_y0=y+.36;aperture_y1=y+.60
    g.box('Kit front roof sheet',(x,(y-d/2+aperture_y0)/2,roof_z),(w-.012,aperture_y0-(y-d/2),.034),'Graphite',parent)
    for sign in [-1,1]:
        g.box('Kit exhaust roof side',(x+sign*(w/2-.053),(aperture_y0+aperture_y1)/2,roof_z),(.094,.24,.034),'Graphite',parent)
    g.box('Kit rear roof sheet',(x,y+d/2-.009,roof_z),(w-.012,.022,.034),'Graphite',parent)
    if detail:
        # Existing tray bodies stop at +0.35m. The captured rear passage is
        # +0.36..+0.60m, and remains open to the roof collar.
        for sign in [-1,1]:
            g.box('Rack exhaust chamber cheek',(x+sign*.30,y+.47,base+h/2),(.012,.24,h-.10),'Graphite',parent)
    # Four thin collar walls terminate in the row-return collector in overview;
    # the representative specimen exposes the open facility interface.
    for sign in [-1,1]:
        g.box('Rack exhaust collar side',(x+sign*.298,y+.48,roof_z+.09),(.012,.24,.18),'Graphite',parent)
        g.box('Rack exhaust collar end',(x,y+.48+sign*.114,roof_z+.09),(.584,.012,.18),'Graphite',parent)
    return front


def overview_rack(g,x,y,index):
    import bpy
    before=set(bpy.data.objects)
    e=ENVELOPE;w,d,h=e.width,e.depth,e.height;base=.34
    parent=g.DOMAIN['workloads'];front=y-d/2
    enclosure(g,parent,(x,y),base)
    levels=8
    for slot in range(levels):
        z=base+.20+slot*.287
        variant='compute' if (index+slot//3)%2==0 else 'carrier'
        front_module(g,parent,(x,front+.055,z),w-.135,.218,variant)
        g.panel('Kit module lower reveal',(x,front+.0595,z-.118),w-.125,.013,'Dark',parent,surface='rubber')
    # Small real hinges and a quiet latch retain the enclosing door silhouette.
    for z in [base+.31,base+h-.31]:
        g.box('Kit door hinge',(x-w/2+.013,front-.020,z),(.027,.027,.052),'Steel',parent)
    surface(g.box('Kit door latch',(x+w/2-.031,front-.034,base+h*.53),(.018,.021,.19),'Dark',parent,.002,keep_bevel=True),'polymer')
    for sign in [-1,1]:
        for end in [-1,1]:
            g.box('Kit leveling foot',(x+sign*.29,y+end*.47,.302),(.09,.10,.095),'Dark',parent)
    for led in range(4):
        identity=f'GN_LED_{index*4+led:02d}'
        anchor=g.semantic(g.empty(identity,parent),identity,'workloads','activity_led')
        anchor.location=(x+.25,front+.029,.62+led*.58)
    surface(g.panel('Kit rack inventory label',(x-.15,front-.030,base+h-.095),.24,.037,'Steel',parent,surface='label'),'label')
    for obj in set(bpy.data.objects)-before:
        if obj.type=='MESH':obj['gnEquipmentId']=f'rack-{index:02d}'
        if index>=6:obj.location.z+=g.REAR_LIFT


def stationary_module_core(g, frame, body, z):
    """Actual shared static server/rail construction used by specimen and bake.

    The service tray, panels, adjacent modules and door are absent by contract.
    Each stationary slot has these same rigid relative dimensions.
    """
    result={'receivers':{}}
    for x in [-.322,.322]:
        support=g.box('Tray supporting rail',(x,-.005,z-.102),(.029,.82,.016),'Steel',frame)
        side=1 if x>0 else -1
        rail_frame=g.add_surface_frame(support,'rack_support',2,1,
            (x+side*.0145,-.415,z-.094),(0,1,0),(-side,0,0),(.82,.029))
        if side>0:result['receivers']['rack_support']={'object':support,'frame':rail_frame}
        g.box('Telescoping tray slide',(x*.92,-.055,z-.055),(.016,.78,.022),'Trim',body)
        for y in [-.37,.29]:
            g.cylinder('Tray side captive screw',(x-side*.006,y,z+.035),(x+side*.003,y,z+.035),.008,'Trim',body,sides=8)
    chassis=g.box('Enclosed representative server tray',(0,-.075,z),(.624,.85,.17),'Graphite',body,.01)
    for sign in [-1,1]:
        face=g.add_surface_frame(chassis,'rack_core_side',0,sign,
            (sign*.312,-.5,z-.085),(0,1,0),(0,0,1),(.85,.17))
        if sign>0:result['receivers']['rack_core_side']={'object':chassis,'frame':face}
    g.box('Server blanking / module front',(0,-.508,z),(.60,.016,.15),'Dark',body)
    for x in [-.306,.306]:g.box('Chassis folded flange',(x,-.075,z+.078),(.023,.83,.008),'Steel',body)
    return result
