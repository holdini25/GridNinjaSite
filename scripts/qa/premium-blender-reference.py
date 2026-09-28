"""Create a separate, editable Blender geometry/light-direction diagnostic.

Run using Blender --background --factory-startup --python <this> -- <arguments>.
This never renders, saves preferences, edits authoring masters or claims parity
between Cycles and the browser's PMREM/photometric lighting.
"""
import argparse
import hashlib
import json
from pathlib import Path
import sys
import bpy
from mathutils import Vector

parser = argparse.ArgumentParser()
parser.add_argument('--source', required=True, type=Path)
parser.add_argument('--manifest-hash', required=True)
parser.add_argument('--kind', choices=['overview', 'rack', 'cooling'], required=True)
parser.add_argument('--output', required=True, type=Path)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
raw = (args.source / 'manifest.json').read_bytes()
digest = lambda value: hashlib.sha256(value).hexdigest()
assert digest(raw) == args.manifest_hash, 'Manifest changed'
manifest = json.loads(raw)
filename = 'facility.glb' if args.kind == 'overview' else args.kind + '.glb'
asset = (args.source / filename).read_bytes()
entry = next(item for item in manifest['files'] if item['file'] == filename)
assert digest(asset) == entry['sha256'] and len(asset) == entry['bytes'], 'Model identity mismatch'
out = args.output.resolve()
assert out.is_relative_to(Path('build/qa').resolve()) and not out.exists(), 'Use a fresh build/qa output directory'
out.mkdir(parents=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str((args.source / filename).resolve()))
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
profile = manifest['profile'] if args.kind == 'overview' else manifest['specimens'][args.kind]['profile']
lighting = manifest['profile']['lighting']
to_blender = lambda xyz: Vector((xyz[0], -xyz[2], xyz[1]))
def rgb_linear(hex_color):
    values = [int(hex_color[index:index + 2], 16) / 255 for index in (1, 3, 5)]
    return [value / 12.92 if value <= .04045 else ((value + .055) / 1.055) ** 2.4 for value in values]

lights = bpy.data.collections.new('REFERENCE_LIGHT_DIRECTIONS')
scene.collection.children.link(lights)
target = to_blender(profile['target'])
for index, source in enumerate(lighting['directional']):
    data = bpy.data.lights.new('Browser key direction ' + str(index), 'SUN')
    data.color = rgb_linear(source['color']); data.energy = source['intensity']
    lamp = bpy.data.objects.new(data.name, data); lights.objects.link(lamp)
    lamp.location = to_blender(source['position']); lamp.rotation_euler = (target - lamp.location).to_track_quat('-Z', 'Y').to_euler()
    lamp['gnReferenceOnly'] = True
finite = profile['lighting'].get('finite')
if finite:
    data = bpy.data.lights.new('Browser finite light direction', 'POINT')
    data.color = rgb_linear(finite['color']); data.energy = finite['intensity']
    lamp = bpy.data.objects.new(data.name, data); lights.objects.link(lamp)
    lamp.location = to_blender(finite['position'])
    lamp['gnBrowserCandela'] = finite['intensity']
    lamp['gnReferenceOnly'] = True
    lamp['gnEnergyNote'] = 'Numeric reference only: Blender watts and browser candela are not equivalent.'
camera_data = bpy.data.cameras.new('Diagnostic camera')
camera = bpy.data.objects.new(camera_data.name, camera_data); scene.collection.objects.link(camera)
camera.location = to_blender(profile['camera']); camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera_data.type = 'ORTHO'; camera_data.ortho_scale = 13 if args.kind == 'overview' else 4
scene.camera = camera
scene.render.resolution_x = 1020; scene.render.resolution_y = 600
scene.render.resolution_percentage = 100
scene['gnDiagnosticPurpose'] = 'Inspect imported geometry, atlas bindings and source light directions; final appearance is reviewed in browser.'
scene['gnSourceManifestSha256'] = digest(raw)
scene['gnSourceModelSha256'] = digest(asset)
scene['gnBrowserRenderProfile'] = json.dumps(profile, sort_keys=True)
scene['gnProductionCameraFit'] = 'Browser bounds-derived fitting is authoritative; this orthographic camera is an authoring aid.'
scene['gnNoRenderPerformed'] = True
destination = out / (args.kind + '-reference.blend')
bpy.ops.wm.save_as_mainfile(filepath=str(destination))
report = {'schemaVersion': 'premium-blender-reference.v1', 'purpose': scene['gnDiagnosticPurpose'], 'sourceManifestSha256': digest(raw), 'sourceModelSha256': digest(asset), 'blender': bpy.app.version_string, 'output': str(destination), 'sha256': digest(destination.read_bytes()), 'rendered': False, 'globalPreferencesChanged': False, 'limits': ['No Cycles/browser pixel parity claimed', 'Numeric finite-light energy is a direction/placement aid, not a unit conversion', 'Website camera fitting and PMREM remain authoritative']}
(out / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report))
