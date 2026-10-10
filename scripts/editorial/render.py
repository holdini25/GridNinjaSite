"""Bounded editorial stills; import the immutable cinematic rig, never save its source."""
import argparse
import importlib.util
import json
from pathlib import Path
import sys

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('cinematic_renderer', ROOT / 'scripts/cinematic/render.py')
cinema = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cinema)
SUBJECTS = ('ai-workload', 'colocation-hall', 'platform-systems')


def isolate(subject, baseline):
    """Change visible subject geometry, not merely the image crop."""
    author = bpy.data.collections['AUTHORING']
    anchors = {obj.get('gnId'): obj.get('gnEquipmentId', '') for obj in author.objects if obj.get('gnId')}
    # The authored LED anchor identity is stable but the empty has no equipment
    # property: four consecutive anchors belong to each rack in the source kit.
    for index in range(48):
        anchors[f'GN_LED_{index:02d}'] = f'rack-{index // 4:02d}'
    selected = {'rack-04', 'rack-05'} if subject == 'ai-workload' else {f'rack-{n:02d}' for n in range(12)}
    visible = []
    for obj, originally_hidden in baseline:
        equipment = obj.get('gnEquipmentId', '') or anchors.get(obj.get('gnId'), '')
        hide = originally_hidden
        if subject != 'platform-systems' and obj.type == 'MESH' and obj.get('gnRole') != 'cinematic_background':
            hide = hide or equipment not in selected
        obj.hide_render = hide
        if obj.type == 'MESH' and not hide and obj.get('gnRole') != 'cinematic_background':
            visible.append(obj)
    bpy.context.view_layer.update()
    points = [obj.matrix_world @ Vector(p) for obj in visible for p in obj.bound_box]
    if not points:
        raise ValueError('Empty editorial subject')
    return points, sorted({obj.get('gnEquipmentId') for obj in visible if obj.get('gnEquipmentId')})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--settings', type=Path, default=ROOT / 'assets-source/editorial/settings.json')
    parser.add_argument('--mode', choices=['studies', 'final', 'reference'], default='studies')
    parser.add_argument('--family', choices=['all', 'A-instrument', 'B-architectural', 'C-frontal'], default='all')
    parser.add_argument('--subject', choices=['all', *SUBJECTS], default='all')
    parser.add_argument('--device', choices=['metal', 'cpu'], default='metal')
    parser.add_argument('--samples', type=int)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    output = args.output.resolve()
    if not output.is_relative_to(ROOT / 'build/cinematic/editorial'):
        raise ValueError('Private editorial output required')
    if args.mode != 'studies' and args.family == 'all':
        raise ValueError('Choose a reviewed family before final/reference rendering')
    args.samples = args.samples or {'studies': 32, 'final': 128, 'reference': 256}[args.mode]
    if args.samples < 1 or args.samples > 512:
        raise ValueError('Sample count outside bounded still range')
    settings = json.loads(args.settings.read_text())
    report_path = output / f'{args.mode}-{args.family}-{args.subject}-report.json'
    if report_path.exists():
        raise ValueError('Use a fresh output directory; attempts are immutable')
    output.mkdir(parents=True, exist_ok=True)
    scene, _, source = cinema.prepare(args, settings)
    scene.render.use_motion_blur = False
    source['editorialRendererSha256'] = cinema.sha(__file__)
    source['supervisorSha256'] = cinema.sha(ROOT / 'scripts/editorial/run.py')
    source['computeSourceSha256'] = cinema.sha(ROOT / 'assets-source/facility/compute.py')
    source['blenderVersion'] = bpy.app.version_string
    source['blenderBuildHash'] = bpy.app.build_hash.decode()
    source['sourceMaster'] = 'assets-source/facility/facility-master.blend'
    baseline = [(obj, obj.hide_render) for name in ['AUTHORING', 'AUTHORING_MANUAL', 'CINEMATIC_DETAIL']
                if name in bpy.data.collections for obj in bpy.data.collections[name].objects]
    report = {'version': 'editorial-render.v1', 'mode': args.mode, 'source': source, 'settings': settings,
              'samples': args.samples, 'threads': 4, 'adaptiveThreshold': settings['adaptiveThreshold'],
              'frame': 0, 'motionBlur': False, 'frames': [], 'status': 'running'}
    cinema.write_json(report_path, report)
    families = list(settings['families']) if args.family == 'all' else [args.family]
    subjects = SUBJECTS if args.subject == 'all' else [args.subject]
    width, height = settings['studyDimensions' if args.mode == 'studies' else 'masterDimensions']
    for family in families:
        for subject in subjects:
            points, equipment = isolate(subject, baseline)
            azimuth, elevation, padding = settings['families'][family][subject]
            camera = cinema.camera_fit(scene, points, width, height, azimuth, elevation, padding)
            camera.pop('anchors', None)  # Editorial illustrations have no live system callouts.
            identity = {'source': source, 'settings': settings, 'camera': camera, 'samples': args.samples,
                        'subject': subject, 'family': family, 'equipmentIds': equipment, 'motionBlur': False}
            row = cinema.render_frame(scene, output / family / subject, 0, report, identity)
            report['frames'].append({**row, 'subject': subject, 'family': family, 'camera': camera, 'equipmentIds': equipment})
            cinema.write_json(report_path, report)
    if cinema.sha(ROOT / source['sourceMaster']) != source['masterSha256']:
        raise ValueError('Source master changed during render')
    report['status'] = 'complete'
    cinema.write_json(report_path, report)


if __name__ == '__main__':
    main()
