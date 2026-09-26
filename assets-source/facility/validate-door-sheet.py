"""Read-only v9 two-skin rack door construction and UV registration check."""
import argparse
import hashlib
import json
from pathlib import Path
import sys
import bpy

parser=argparse.ArgumentParser();parser.add_argument('--out',required=True)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
objects=list(bpy.data.collections['AUTHORING'].objects)
front=next(obj for obj in objects if obj.name.startswith('Moving door perforations'))
back=next(obj for obj in objects if obj.name.startswith('Moving door inner perforations'))
assert front.parent==back.parent and front.parent.get('gnId')=='GN_RACK_DOOR'
assert len(front.data.vertices)==len(back.data.vertices)
maximum=0.
for a,b in zip(front.data.vertices,back.data.vertices):
    delta=b.co-a.co
    maximum=max(maximum,abs(delta.x),abs(delta.z),abs(delta.y-.0015))
assert maximum<1e-6, 'Door skins must retain a real 1.5mm separation'
for a,b in zip(front.data.polygons,back.data.polygons):
    assert tuple(a.vertices)==tuple(reversed(b.vertices))
    assert a.normal.dot(b.normal)<-.999, 'Both skins need outward-facing normals'
def uv(mesh):
    layer=mesh.uv_layers.active
    return {loop.vertex_index:tuple(layer.data[loop.index].uv) for loop in mesh.loops}
assert uv(front.data)==uv(back.data), 'MASK apertures must align through the sheet'
assert front.data.materials[0]==back.data.materials[0], 'Door skins must share the existing material batch'
report={'schemaVersion':'facility-door-sheet.v1','result':'pass','separationMetres':.0015,
        'maxCoordinateErrorMetres':maximum,'registeredApertureUVs':True,'opposedOutwardNormals':True,
        'sharedExistingMaterial':True,'verticesPerSkin':len(front.data.vertices),'writesMaster':False,
        'masterSha256':hashlib.sha256(Path(bpy.data.filepath).read_bytes()).hexdigest()}
path=Path(args.out);path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
