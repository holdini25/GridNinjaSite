"""Hash-bound, private Cycles material laboratory; never edits source masters.

Blender --background --factory-startup --python scripts/qa/premium-cycles-lab.py --
  --source build/facility/facility-v11/release --manifest-hash SHA --subject rack
  --output build/qa/gpu-release-20260927/cycles/rack --device metal --samples 64

The GLB is the geometry/material source. Camera fitting follows production math,
but this physically lit Cycles reference does not reproduce the browser PMREM,
tone mapper, activity instances or semantic highlight shaders. Website approval
and production posters must still come from the browser renderer.
"""
import argparse
import copy
import json
import math
import os
from pathlib import Path
import resource
import sys
import time
import traceback

import bpy
import numpy as np
from mathutils import Vector

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(ROOT / 'assets-source/facility'))
from cycles_lab_contract import REVISION, MODES, SUBJECTS, apply_pose, camera_fit, canonical, glb_write, load_release, metadata, sha256, subset_model
from compute import configure
from bake_job import atomic_write


def arguments():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True, type=Path)
    parser.add_argument('--manifest-hash', required=True)
    parser.add_argument('--subject', required=True, choices=[*SUBJECTS, 'overview', 'rack-specimen', 'cooling-specimen'])
    parser.add_argument('--pose', choices=['closed', 'cutaway', 'service'], default='closed')
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--device', choices=['cpu', 'metal', 'hybrid'], default='metal')
    parser.add_argument('--metalrt', choices=['AUTO', 'ON', 'OFF'], default='AUTO')
    parser.add_argument('--threads', type=int, default=4)
    parser.add_argument('--preset', choices=['preview', 'reference', 'benchmark'], default='preview')
    parser.add_argument('--samples', type=int)
    parser.add_argument('--seed', type=int, default=19)
    parser.add_argument('--width', type=int, default=1600)
    parser.add_argument('--height', type=int, default=1200)
    parser.add_argument('--modes', default=','.join(MODES))
    parser.add_argument('--repetitions', type=int, default=1)
    parser.add_argument('--warmup', action='store_true', help='Render one separately recorded full first-mode warmup')
    parser.add_argument('--prepare-only', action='store_true', help='Save scene/settings without rendering')
    parser.add_argument('--denoise', choices=['none', 'oidn'], default='none')
    parser.add_argument('--rig', choices=['neutral-v1', 'broad-v1', 'service-v1'], default='neutral-v1')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    args.sample_override = args.samples is not None
    args.samples = args.samples if args.samples is not None else 64 if args.preset == 'preview' else 256
    args.adaptive_threshold = .02 if args.preset == 'preview' else .005 if args.preset == 'reference' else 0.
    args.modes = args.modes.split(',')
    if len(set(args.modes)) != len(args.modes) or not set(args.modes) <= set(MODES) or not args.modes:
        parser.error('Choose unique modes: ' + ','.join(MODES))
    if not 1 <= args.samples <= 4096 or not 1 <= args.repetitions <= 5 or not 64 <= args.width <= 4096 or not 64 <= args.height <= 4096:
        parser.error('Invalid sample/repetition/resolution bounds')
    if not 0 <= args.seed <= 2147483647:
        parser.error('Seed must be a nonnegative 31-bit integer')
    if args.pose != 'closed' and not args.subject.endswith('-specimen'):
        parser.error('Poses belong to specimen assets')
    return args


def to_blender(xyz):
    return Vector((xyz[0], -xyz[2], xyz[1]))


def hide_nonrendered_nodes(doc):
    for node in doc['nodes']:
        if node.get('extras', {}).get('gnRole') in {'selection_accent', 'selection_accent_root', 'picking_proxy'}:
            node.pop('mesh', None)
            node['children'] = []


def union_bounds(bounds):
    return {'min': [min(item['min'][i] for item in bounds) for i in range(3)],
            'max': [max(item['max'][i] for item in bounds) for i in range(3)]}


def prepare_asset(args, output):
    kind = args.subject.removesuffix('-specimen') if args.subject.endswith('-specimen') else 'overview'
    filename = kind + '.glb' if kind != 'overview' else 'facility.glb'
    manifest, doc, binary, entry = load_release(args.source, args.manifest_hash, filename)
    profile = manifest['profile'] if kind == 'overview' else manifest['specimens'][kind]['profile']
    camera = copy.deepcopy(profile)
    selected = None
    if args.subject in SUBJECTS:
        topology = metadata(doc, 'gnTopology')
        equipment = next(item for item in topology['equipment'] if item['id'] == SUBJECTS[args.subject])
        doc, binary, selected = subset_model(doc, binary, equipment['index'])
        bounds = equipment['bounds']
        # A selected-system view preserves overview direction and centers the
        # authored bounds, exactly as production inspectionCamera does.
        target = [(bounds['min'][i] + bounds['max'][i]) / 2 for i in range(3)]
        camera = {'camera': [target[i] + profile['camera'][i] - profile['target'][i] for i in range(3)],
                  'target': target, 'padding': profile['padding']}
    elif kind != 'overview':
        specimen = apply_pose(doc, args.pose)
        motion = specimen.get('rackMotion')
        camera = motion['camera'] if motion else specimen['poses'][args.pose]['camera']
        bounds = motion['fitBounds'] if motion else union_bounds([item['bounds'] for item in specimen['parts']])
    else:
        bounds = profile['inspection']['fitSubjects']['overview']
        if args.width < 640 and profile.get('inspection', {}).get('mobile'):
            camera = profile['inspection']['mobile']
    hide_nonrendered_nodes(doc)
    payload = glb_write(doc, binary)
    destination = output / 'lab-input.glb'
    atomic_write(destination, payload)
    frame = camera_fit(camera, bounds, args.width, args.height)
    return destination, frame, profile, {'filename': filename, 'bytes': entry['bytes'], 'sha256': entry['sha256'],
                                       'labInputSha256': sha256(payload), 'selectedTriangles': selected,
                                       'equipmentId': SUBJECTS.get(args.subject), 'bounds': bounds, 'cameraProfile': camera}


def setup_camera(scene, frame):
    data = bpy.data.cameras.new('GN_LAB_CAMERA')
    camera = bpy.data.objects.new(data.name, data)
    scene.collection.objects.link(camera)
    camera.location = to_blender(frame['position'])
    camera.rotation_euler = (to_blender(frame['target']) - camera.location).to_track_quat('-Z', 'Y').to_euler()
    data.clip_start, data.clip_end = frame['near'], frame['far']
    data.sensor_fit = 'VERTICAL'
    if frame['projection'] == 'perspective':
        data.type = 'PERSP'
        data.angle_y = math.radians(frame['fov'])
    else:
        data.type = 'ORTHO'
        data.ortho_scale = frame['verticalSpan']
    scene.camera = camera


def validate_camera(scene, frame):
    """Verify actual Blender projection/axis conversion against browser-fit math."""
    from bpy_extras.object_utils import world_to_camera_view
    bpy.context.view_layer.update()
    bounds = frame['bounds']
    maximum_error = 0.
    for index in range(8):
        point = Vector([bounds['max' if index & (1 << axis) else 'min'][axis] for axis in range(3)])
        relative = point - Vector(frame['position'])
        x, y, z = (relative.dot(Vector(frame[axis])) for axis in ('right', 'up', 'back'))
        if frame['projection'] == 'perspective':
            tangent = math.tan(math.radians(frame['fov'])/2)
            expected = (.5 + x/(-2*z*tangent*frame['aspect']), .5 + y/(-2*z*tangent))
        else:
            expected = (.5 + x/frame['horizontalSpan'], .5 + y/frame['verticalSpan'])
        actual = world_to_camera_view(scene, scene.camera, to_blender(point))
        maximum_error = max(maximum_error, abs(expected[0]-actual.x), abs(expected[1]-actual.y))
    if maximum_error > .0001:
        raise ValueError('Blender/browser geometric projection mismatch: ' + str(maximum_error))
    return {'maxNormalizedProjectionError': maximum_error, 'tolerance': .0001, 'points': 8,
            'note': 'Camera geometry/axes only; not shading or tone-mapping parity'}


def cooling_contour_fit(profile, bounds, width, height):
    """Actual visible contour plus exact full-turn rotor support, like production."""
    bpy.context.view_layer.update()
    basis = camera_fit(profile, bounds, width, height)
    right, up = Vector(basis['right']), Vector(basis['up'])
    to_gltf = lambda value: Vector((value.x, value.z, -value.y))
    points = []
    for obj in bpy.context.scene.objects:
        if obj.type != 'MESH': continue
        rotor = obj
        while rotor and rotor.get('gnRole') != 'fan_rotor': rotor = rotor.parent
        # Imported GLBs retain the Y-up -> Z-up conversion. A specimen rotor's
        # authored local Y shaft is Blender local Z after the import conversion.
        for index in {vertex for polygon in obj.data.polygons for vertex in polygon.vertices}:
            vertex = obj.data.vertices[index].co
            if not rotor:
                points.append(list(to_gltf(obj.matrix_world @ vertex)))
                continue
            local = rotor.matrix_world.inverted() @ obj.matrix_world @ vertex
            axial = Vector((0, 0, local.z))
            radial = local - axial
            tangent = Vector((0, 0, 1)).cross(radial)
            center = to_gltf(rotor.matrix_world @ axial)
            radial = to_gltf(rotor.matrix_world.to_3x3() @ radial)
            tangent = to_gltf(rotor.matrix_world.to_3x3() @ tangent)
            rx, ry = math.hypot(right.dot(radial), right.dot(tangent)), math.hypot(up.dot(radial), up.dot(tangent))
            points.extend([list(center + right*rx), list(center-right*rx), list(center+up*ry), list(center-up*ry)])
    frame = camera_fit(profile, bounds, width, height, points=points)
    frame['fitAlgorithm'] = 'render-framing.ts/visible-contour-and-full-rotor-sweep-v1'
    return frame


def setup_lights(scene, bounds, preset):
    """Scene-relative physical area lights; powers are watts, not browser candela."""
    center = Vector([(bounds['min'][i] + bounds['max'][i]) / 2 for i in range(3)])
    scale = max(bounds['max'][i] - bounds['min'][i] for i in range(3)) / 3
    rig = [
        {'id': 'overhead', 'offset': [-2.2, 3.6, 1.8], 'size': [3.8, 2.4], 'watts': 650.},
        {'id': 'rear', 'offset': [2.4, 2.4, -2.6], 'size': [.6, 2.4], 'watts': 260.},
        {'id': 'front', 'offset': [.4, .8, 3.2], 'size': [2.2, 1.8], 'watts': 95.},
    ]
    if preset == 'broad-v1':
        rig[0]['size'] = [5., 3.2]
        rig[0]['watts'] = 760.
    elif preset == 'service-v1':
        rig[2]['size'] = [3.2, 2.4]
        rig[2]['watts'] = 160.
    collection = bpy.data.collections.new('REFERENCE_CYCLES_AREA_LIGHTS')
    scene.collection.children.link(collection)
    for item in rig:
        item['position'] = list(center + Vector(item['offset']) * scale)
        item['target'] = list(center)
        item['metres'] = [value * scale for value in item['size']]
        item['powerWatts'] = item['watts'] * scale**2
        data = bpy.data.lights.new('GN_LAB_' + item['id'], 'AREA')
        data.shape = 'RECTANGLE'
        data.size, data.size_y = item['metres']
        data.energy = item['powerWatts']
        data.color = (1, 1, 1)
        light = bpy.data.objects.new(data.name, data)
        collection.objects.link(light)
        light.location = to_blender(item['position'])
        light.rotation_euler = (to_blender(item['target']) - light.location).to_track_quat('-Z', 'Y').to_euler()
    world = bpy.data.worlds.new('GN_LAB_WORLD')
    world.use_nodes = True
    scene.world = world
    tree = world.node_tree
    tree.nodes.clear()
    ambient = tree.nodes.new('ShaderNodeBackground')
    ambient.inputs['Color'].default_value = (.18, .18, .18, 1)
    ambient.inputs['Strength'].default_value = .12
    camera_background = tree.nodes.new('ShaderNodeBackground')
    camera_background.inputs['Color'].default_value = (.002428216, .002428216, .002428216, 1)
    camera_background.inputs['Strength'].default_value = 1.
    path = tree.nodes.new('ShaderNodeLightPath')
    mix = tree.nodes.new('ShaderNodeMixShader')
    tree.links.new(path.outputs['Is Camera Ray'], mix.inputs[0])
    tree.links.new(ambient.outputs[0], mix.inputs[1])
    tree.links.new(camera_background.outputs[0], mix.inputs[2])
    output = tree.nodes.new('ShaderNodeOutputWorld')
    tree.links.new(mix.outputs[0], output.inputs[0])
    return {'preset': preset, 'areaLights': rig, 'ambientLinear': [.18, .18, .18], 'ambientStrength': .12,
            'note': 'Independent neutral Cycles studio. No watt/candela or environment-response parity is claimed.'}


def diagnostic_material(original, mode):
    material = original.copy()
    material.name = original.name + '_LAB_' + mode
    tree = material.node_tree
    principled = next((node for node in tree.nodes if node.type == 'BSDF_PRINCIPLED'), None)
    if principled is None:
        raise ValueError('Diagnostic requires imported Principled BSDF: ' + original.name)
    if mode == 'gray':
        for name, value in [('Base Color', (.25, .25, .25, 1)), ('Metallic', 0.), ('Roughness', .65), ('Emission Strength', 0.)]:
            socket = principled.inputs[name]
            for link in list(socket.links): tree.links.remove(link)
            socket.default_value = value
        for link in list(principled.inputs['Normal'].links): tree.links.remove(link)
        return material
    output = next(node for node in tree.nodes if node.type == 'OUTPUT_MATERIAL' and node.is_active_output)
    emission = tree.nodes.new('ShaderNodeEmission')
    emission.inputs['Strength'].default_value = 1.
    if mode == 'roughness':
        socket = principled.inputs['Roughness']
        if socket.is_linked: tree.links.new(socket.links[0].from_socket, emission.inputs['Color'])
        else: emission.inputs['Color'].default_value = (socket.default_value,) * 3 + (1,)
    elif mode == 'ao':
        settings = next((node for node in tree.nodes if node.type == 'GROUP' and 'Occlusion' in node.inputs), None)
        if settings and settings.inputs['Occlusion'].is_linked:
            tree.links.new(settings.inputs['Occlusion'].links[0].from_socket, emission.inputs['Color'])
        else:
            emission.inputs['Color'].default_value = (1, 1, 1, 1)
    elif mode == 'normal':
        socket = principled.inputs['Normal']
        source = socket.links[0].from_socket if socket.is_linked else tree.nodes.new('ShaderNodeNewGeometry').outputs['Normal']
        scale = tree.nodes.new('ShaderNodeVectorMath')
        scale.operation = 'SCALE'
        scale.inputs[3].default_value = .5
        tree.links.new(source, scale.inputs[0])
        add = tree.nodes.new('ShaderNodeVectorMath')
        add.operation = 'ADD'
        add.inputs[1].default_value = (.5, .5, .5)
        tree.links.new(scale.outputs[0], add.inputs[0])
        tree.links.new(add.outputs[0], emission.inputs['Color'])
    # Preserve original masked coverage in every technical diagnostic.
    alpha = principled.inputs['Alpha']
    if alpha.is_linked or alpha.default_value < 1:
        transparent = tree.nodes.new('ShaderNodeBsdfTransparent')
        mix = tree.nodes.new('ShaderNodeMixShader')
        if alpha.is_linked: tree.links.new(alpha.links[0].from_socket, mix.inputs[0])
        else: mix.inputs[0].default_value = alpha.default_value
        tree.links.new(transparent.outputs[0], mix.inputs[1])
        tree.links.new(emission.outputs[0], mix.inputs[2])
        tree.links.new(mix.outputs[0], output.inputs['Surface'])
    else:
        tree.links.new(emission.outputs[0], output.inputs['Surface'])
    return material


def file_record(path):
    payload = path.read_bytes()
    return {'file': path.name, 'bytes': len(payload), 'sha256': sha256(payload)}


def validate_exr(path, width, height):
    image = bpy.data.images.load(str(path), check_existing=False)
    try:
        if tuple(image.size) != (width, height): raise ValueError('Unexpected rendered resolution')
        pixels = np.empty(width * height * 4, dtype=np.float32)
        image.pixels.foreach_get(pixels)
        if not np.isfinite(pixels).all(): raise ValueError('Render contains nonfinite pixels')
        rgb = pixels.reshape((-1, 4))[:, :3]
        if float(rgb.std()) < 1e-6: raise ValueError('Render has no visible surface variation')
        return {'finite': True, 'minimum': float(rgb.min()), 'maximum': float(rgb.max()),
                'rgbPercentiles': [float(value) for value in np.percentile(rgb, [1, 50, 99])],
                'note': 'Sanity checks only; not visual craft approval'}
    finally:
        bpy.data.images.remove(image)


def main():
    args = arguments()
    output = args.output.resolve()
    if not output.is_relative_to(ROOT / 'build/qa') or output.exists():
        raise ValueError('Use a fresh output directory inside build/qa')
    output.mkdir(parents=True)
    started = time.perf_counter()
    report = {'schemaVersion': REVISION, 'status': 'incomplete', 'arguments': {key: str(value) if isinstance(value, Path) else value for key, value in vars(args).items()},
              'manifestSha256': args.manifest_hash, 'renders': [], 'files': [],
              'limitations': ['Cycles reference, not browser parity or production posters.', 'Lights use independent watts; browser PMREM/candela are not converted.',
                             'No website LED instancing, animated activity or semantic highlight shaders.', 'Process peak RSS is not physical GPU allocation or a unified-memory pressure measurement.']}
    source_scripts = [Path(__file__), HERE / 'cycles_lab_contract.py', ROOT / 'assets-source/facility/compute.py']
    report['sourceHashes'] = {path.name: sha256(path.read_bytes()) for path in source_scripts}
    def checkpoint(): atomic_write(output / 'report.json', json.dumps(report, indent=2, allow_nan=False).encode() + b'\n')
    checkpoint()
    try:
        asset, frame, profile, source = prepare_asset(args, output)
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(asset))
        scene = bpy.context.scene
        scene.unit_settings.system = 'METRIC'
        report['source'] = source
        report['configuration'] = configure(args.device, metalrt=args.metalrt, threads=args.threads)
        scene.render.resolution_x, scene.render.resolution_y = args.width, args.height
        scene.render.resolution_percentage = 100
        scene.render.film_transparent = False
        scene.render.use_persistent_data = True
        scene.cycles.samples = args.samples
        scene.cycles.seed = args.seed
        scene.cycles.use_animated_seed = False
        scene.cycles.use_adaptive_sampling = args.adaptive_threshold > 0
        scene.cycles.adaptive_threshold = args.adaptive_threshold
        scene.cycles.use_denoising = False
        if args.denoise == 'oidn':
            scene.cycles.denoiser = 'OPENIMAGEDENOISE'
            scene.cycles.denoising_input_passes = 'RGB_ALBEDO_NORMAL'
            scene.cycles.denoising_use_gpu = args.device != 'cpu'
        scene.view_settings.view_transform = 'AgX'
        scene.view_settings.look = 'None'
        scene.view_settings.exposure = 0
        scene.view_settings.gamma = 1
        if args.subject == 'cooling-specimen':
            frame = cooling_contour_fit(source['cameraProfile'], source['bounds'], args.width, args.height)
        setup_camera(scene, frame)
        report['camera'] = frame
        report['cameraValidation'] = validate_camera(scene, frame)
        report['lighting'] = setup_lights(scene, source['bounds'], args.rig)
        report['sampling'] = {'samples': args.samples, 'seed': args.seed, 'adaptive': scene.cycles.use_adaptive_sampling,
                              'adaptiveThreshold': args.adaptive_threshold, 'sampleOverride': args.sample_override,
                              'persistentData': True, 'denoise': args.denoise,
                              'gpuDenoising': bool(args.denoise == 'oidn' and args.device != 'cpu')}
        report['browserProfile'] = profile
        report['colorManagement'] = {'beautyPNG': 'AgX / None / exposure 0 / gamma 1', 'diagnosticPNG': 'Standard / None / exposure 0 / gamma 1',
                                     'EXR': 'Scene-linear float32 RGBA, ZIP; numerical channels authoritative', 'normal': 'World-space perturbed normal encoded (normal + 1) / 2'}
        master = output / 'laboratory.blend'
        bpy.ops.wm.save_as_mainfile(filepath=str(master))
        report['files'].append(file_record(master))
        report['preparationSeconds'] = time.perf_counter() - started
        checkpoint()
        bindings = [(obj, index, material) for obj in bpy.data.objects if obj.type == 'MESH' for index, material in enumerate(obj.data.materials) if material]
        if not args.prepare_only:
            for mode_index, mode in enumerate(args.modes):
                replacements = {}
                for obj, index, material in bindings:
                    if mode == 'final': obj.data.materials[index] = material
                    else:
                        if material not in replacements: replacements[material] = diagnostic_material(material, mode)
                        obj.data.materials[index] = replacements[material]
                scene.view_settings.view_transform = 'AgX' if mode in {'final', 'gray'} else 'Standard'
                for repetition in range(-1 if args.warmup and mode_index == 0 else 0, args.repetitions):
                    name = mode + ('-warmup' if repetition < 0 else f'-{repetition + 1:02d}')
                    scene.render.image_settings.file_format = 'OPEN_EXR'
                    scene.render.image_settings.color_depth = '32'
                    scene.render.image_settings.color_mode = 'RGBA'
                    scene.render.image_settings.exr_codec = 'ZIP'
                    scene.cycles.use_denoising = False
                    before = time.perf_counter()
                    result = bpy.ops.render.render()
                    duration = time.perf_counter() - before
                    if 'FINISHED' not in result: raise RuntimeError('Cycles render did not finish')
                    image = bpy.data.images['Render Result']
                    exr = output / (name + '.exr')
                    image.save_render(str(exr), scene=scene)
                    image_quality = validate_exr(exr, args.width, args.height)
                    scene.render.image_settings.file_format = 'PNG'
                    scene.render.image_settings.color_depth = '8'
                    png = output / (name + '.png')
                    image.save_render(str(png), scene=scene)
                    row = {'mode': mode, 'repetition': repetition, 'kind': 'warmup' if repetition < 0 else 'measured',
                           'renderSeconds': duration, 'secondsInclude': 'Undenoised Cycles scene preparation, kernel/BVH work and sampling; excludes file encoding',
                           'peakRSSBytes': resource.getrusage(resource.RUSAGE_SELF).ru_maxrss * (1 if sys.platform == 'darwin' else 1024),
                           'files': [file_record(exr), file_record(png)], 'pixelSanity': image_quality}
                    if mode == 'final' and args.denoise == 'oidn':
                        # Retain the original undenoised float EXR. A second,
                        # explicitly timed render adds OIDN rather than replacing
                        # numerical reference data or hiding its added cost.
                        scene.cycles.use_denoising = True
                        denoise_started = time.perf_counter()
                        if 'FINISHED' not in bpy.ops.render.render(): raise RuntimeError('Denoised render did not finish')
                        row['oidnAdditionalRenderSeconds'] = time.perf_counter() - denoise_started
                        row['oidnTimingIncludes'] = 'Separate complete render plus OIDN, not denoiser-only time'
                        image = bpy.data.images['Render Result']
                        scene.render.image_settings.file_format = 'OPEN_EXR'
                        scene.render.image_settings.color_depth = '32'
                        denoised_exr = output / (name + '-oidn.exr')
                        image.save_render(str(denoised_exr), scene=scene)
                        row['oidnPixelSanity'] = validate_exr(denoised_exr, args.width, args.height)
                        scene.render.image_settings.file_format = 'PNG'
                        scene.render.image_settings.color_depth = '8'
                        denoised_png = output / (name + '-oidn.png')
                        image.save_render(str(denoised_png), scene=scene)
                        row['files'].extend([file_record(denoised_exr), file_record(denoised_png)])
                    report['renders'].append(row)
                    checkpoint()
                for obj, index, material in bindings: obj.data.materials[index] = material
                for material in replacements.values(): bpy.data.materials.remove(material)
        report['status'] = 'prepared' if args.prepare_only else 'pass'
        report['elapsedSeconds'] = time.perf_counter() - started
        report['sourceUnchanged'] = (sha256((args.source / 'manifest.json').read_bytes()) == args.manifest_hash
                                    and sha256((args.source / source['filename']).read_bytes()) == source['sha256']
                                    and all(sha256(path.read_bytes()) == report['sourceHashes'][path.name] for path in source_scripts))
        if not report['sourceUnchanged']: raise RuntimeError('Source changed during lab execution')
        checkpoint()
        print('GN_CYCLES_LAB ' + json.dumps({'status': report['status'], 'report': str(output / 'report.json'), 'renders': len(report['renders'])}))
    except Exception:
        report['status'] = 'fail'
        report['error'] = traceback.format_exc()
        report['elapsedSeconds'] = time.perf_counter() - started
        checkpoint()
        raise


if __name__ == '__main__':
    main()
