"""Uncached, fixed-input Cycles bake benchmarks; no master/preference saves.

Full-atlas mode writes images only in an explicit private source copy under
build/qa. Timing excludes mesh generation/export and browser rendering.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import resource
import shutil
import statistics
import sys
import time
import traceback
import bpy

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--mode', required=True, choices=['cpu', 'metal', 'hybrid'])
parser.add_argument('--out', required=True, type=Path)
parser.add_argument('--source', type=Path, default=HERE)
parser.add_argument('--master', type=Path)
parser.add_argument('--workload', choices=['spatial', 'full-atlas'], default='spatial')
parser.add_argument('--samples', type=int, default=64)
parser.add_argument('--repetitions', type=int, default=3)
parser.add_argument('--threads', type=int, default=4)
parser.add_argument('--metalrt', choices=['AUTO', 'ON', 'OFF'], default='AUTO')
parser.add_argument('--spatial-device', choices=['requested', 'cpu'], default='requested')
parser.add_argument('--context', choices=['development', 'exclusive'], default='development')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
if not 1 <= args.samples <= 4096 or not 1 <= args.repetitions <= 5:
    parser.error('Invalid samples or repetitions')
args.source = args.source.resolve()
args.out = args.out.resolve()
if not args.out.is_relative_to(ROOT / 'build/qa') or args.out.exists():
    parser.error('Use a new report path under build/qa')
if args.workload == 'full-atlas' and not args.source.is_relative_to(ROOT / 'build/qa'):
    parser.error('Full-atlas benchmark requires an isolated source copy under build/qa')
master = (args.master or args.source / 'facility-master.blend').resolve()
os.environ.update(GN_CYCLES_DEVICE=args.mode, GN_METALRT=args.metalrt,
                  GN_CYCLES_CPU_THREADS=str(args.threads), GN_BAKE_SAMPLES=str(args.samples),
                  GN_BAKE_CACHE='off', GN_BAKE_SPATIAL_COMPUTE=args.spatial_device)
sys.path.insert(0, str(args.source))
from compute import configure
from bake_job import atomic_write
import surface_bake
from spatial_bake import run

digest = lambda data: hashlib.sha256(data).hexdigest()
source_paths = list(dict.fromkeys([Path(__file__).resolve(), master, args.source / 'scene.json', *sorted(args.source.glob('*.py'))]))
source_hashes = {str(path): digest(path.read_bytes()) for path in source_paths}
report = {'schemaVersion': 2, 'status': 'incomplete', 'workload': args.workload,
          'sourceMasterSha256': source_hashes[str(master)], 'sourceHashes': source_hashes,
          'executionContext': args.context, 'samples': args.samples, 'seed': 19,
          'adaptiveSampling': False, 'animatedSeed': False, 'cache': 'off', 'spatialDevicePolicy': args.spatial_device, 'runs': [],
          'limits': ['Bake-pipeline timing, not total generation/export or website rendering.',
                     'CPU/GPU outputs can differ numerically; hashes identify outputs, not parity.',
                     'First invocation includes preparation but does not prove cold filesystem/driver caches.',
                     'Peak process RSS is not physical GPU allocation or total unified-memory use.']}
args.out.parent.mkdir(parents=True, exist_ok=True)
started = time.perf_counter()
def save(): atomic_write(args.out, (json.dumps(report, indent=2, allow_nan=False) + '\n').encode())
save()
try:
    for repetition in range(args.repetitions + 1):
        bpy.ops.wm.open_mainfile(filepath=str(master))
        config = configure(args.mode, metalrt=args.metalrt, threads=args.threads)
        report['configuration'] = config
        scene = bpy.context.scene
        scene.cycles.samples = args.samples
        scene.cycles.use_denoising = False
        scene.cycles.use_adaptive_sampling = False
        scene.cycles.use_animated_seed = False
        scene.cycles.seed = 19
        surface_bake.BAKE_CACHE = None
        surface_bake.BAKE_JOBS = []
        trial = args.out.parent / (args.out.stem + '-trials') / f'{repetition:02d}'
        trial.mkdir(parents=True, exist_ok=False)
        before = time.perf_counter()
        if args.workload == 'spatial':
            scratch = bpy.data.collections.new('GN_COMPUTE_BENCHMARK')
            scene.collection.children.link(scratch)
            material = bpy.data.materials.new('GN_BENCHMARK_RECEIVER')
            material.use_nodes = True
            fields, records = run(scratch, material, surface_bake.TILES, surface_bake.GUTTER,
                                  surface_bake.image, surface_bake.bake, samples=args.samples)
            elapsed = time.perf_counter() - before
            payload = b''.join(fields[key]['ao'].tobytes() + fields[key]['color'].tobytes() for key in sorted(fields))
            output_hash = digest(payload)
            outputs = {'decodedReceiverFieldsSha256': output_hash}
            jobs = surface_bake.BAKE_JOBS
            surface_bake.np.savez_compressed(trial / 'receiver-fields.npz', **{key + '_' + channel: value[channel] for key, value in fields.items() for channel in ('ao', 'color')})
        else:
            materials = {name: bpy.data.materials[name] for name in ['Graphite', 'Steel', 'Trim', 'Dark', 'Copper', 'Amber', 'Platform', 'Grille']}
            # The stationary construction receiver uses the same generator
            # helpers as production, but never invokes main or saves a master.
            import generate
            generate.MATERIALS = materials
            generate.collection = bpy.data.collections['AUTHORING']
            surface_bake.bake_surfaces(materials, trial)
            elapsed = time.perf_counter() - before
            baked = json.loads((trial / 'bake-report.json').read_text())
            if baked.get('cachePolicy') != 'off':
                raise ValueError('Full-atlas source does not implement explicit disabled cache')
            jobs = surface_bake.BAKE_JOBS
            records = baked['stages']
            outputs = {name: digest((args.source / name).read_bytes()) for name in ['surface-normal.png', 'surface-orm.png', 'surface-color.png']}
            for name, expected in outputs.items():
                shutil.copy2(args.source / name, trial / name)
                if digest((trial / name).read_bytes()) != expected:
                    raise ValueError('Trial atlas copy changed')
            output_hash = digest(json.dumps(outputs, sort_keys=True).encode())
        if not jobs or any(job.get('cacheHit') or job.get('samples', args.samples) != args.samples for job in jobs):
            raise ValueError('Benchmark used cache or inconsistent samples')
        expected_devices = sorted((item['name'], item['type']) for item in config['enabledDevices'])
        for job in jobs:
            spatial_override = args.workload == 'full-atlas' and args.spatial_device == 'cpu' and job['target'].startswith(('Spatial receiver ', 'Static module receiver '))
            expected = baked['spatialCompute'] if spatial_override else config
            devices = sorted((item['name'], item['type']) for item in expected['enabledDevices'])
            if job['cyclesDevice'] != expected['cyclesDevice'] or sorted((item['name'], item['type']) for item in job['devices']) != devices:
                raise ValueError('Benchmark silently switched compute device')
        report['runs'].append({'repetition': repetition, 'kind': 'warmup' if repetition == 0 else 'measured',
                               'seconds': elapsed, 'outputSha256': output_hash, 'outputs': outputs,
                               'artifactDirectory': str(trial), 'timingBoundary': 'Bake function including its image writes; excludes validation/hash checks and per-trial preservation copies',
                               'receiverCount': len(records), 'jobCount': len(jobs), 'receivers': records, 'jobs': jobs,
                               'mixedCompute': len({(job['cyclesDevice'], tuple(sorted(item['type'] for item in job['devices']))) for job in jobs}) > 1,
                               'peakRSSBytes': resource.getrusage(resource.RUSAGE_SELF).ru_maxrss * (1 if sys.platform == 'darwin' else 1024)})
        save()
    report['medianSeconds'] = statistics.median(row['seconds'] for row in report['runs'][1:])
    report['sourceUnchanged'] = all(digest(path.read_bytes()) == source_hashes[str(path)] for path in source_paths)
    if not report['sourceUnchanged']: raise RuntimeError('Source changed during benchmark')
    report['elapsedSeconds'] = time.perf_counter() - started
    report['status'] = 'pass'
    save()
    print('GN_COMPUTE_BENCHMARK ' + json.dumps({'mode': args.mode, 'workload': args.workload, 'medianSeconds': report['medianSeconds'], 'report': str(args.out)}))
except Exception:
    report['status'] = 'fail'
    report['error'] = traceback.format_exc()
    report['elapsedSeconds'] = time.perf_counter() - started
    save()
    raise
