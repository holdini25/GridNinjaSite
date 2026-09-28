"""Repeat the rack sweep proof and reject two unsafe authored-motion fixtures.

Read-only with respect to Blender masters. Writes only the requested report.
"""
import argparse
import json
import os
from pathlib import Path
import sys
import bpy

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
if bpy.app.version!=(5,2,2) or bpy.app.build_hash.decode()!='d13f752e3b9c':raise RuntimeError('Pinned Blender required')
parser=argparse.ArgumentParser();parser.add_argument('--out',required=True)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
lock=HERE/'generation.lock';fd=os.open(lock,os.O_CREAT|os.O_EXCL|os.O_WRONLY);os.close(fd)
try:
    import generate as g
    import rack_motion as motion
    bpy.data.collections['AUTHORING'].hide_viewport=False
    g.collection=bpy.data.collections['AUTHORING']
    parts=[{'id':obj['gnId'],'object':obj} for obj in g.collection.objects if obj.get('gnRole')=='specimen_part']
    if len(parts)!=6:raise ValueError('Expected six authored rack parts')
    result=motion.validate_authoring(g,parts,motion.motion_metadata())
    cases=[{'name':'authored continuous hinge and rail clearance','passed':result['result']=='passed'}]
    original=motion.OPEN_ANGLE
    for name,angle in [('inward hinge swing rejected',-original),('tray extension with closed door rejected',0.)]:
        motion.OPEN_ANGLE=angle
        try:motion.validate_authoring(g,parts,motion.motion_metadata())
        except ValueError as error:cases.append({'name':name,'passed':True,'rejection':str(error)})
        else:raise ValueError('Unsafe motion fixture accepted: '+name)
    motion.OPEN_ANGLE=original
    report={'schemaVersion':'facility-rack-motion-adversarial.v1','result':'passed','checks':cases,
            'sourceMaster':'assets-source/facility/rack-specimen.blend','writesMaster':False}
    destination=Path(args.out);destination.parent.mkdir(parents=True,exist_ok=True)
    destination.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))
finally:lock.unlink(missing_ok=True)
