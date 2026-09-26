"""Measured spatial-bake microbenchmark. Does not save masters/preferences."""
import argparse
import hashlib
import json
from pathlib import Path
import statistics
import sys
import time
import bpy

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from compute import configure
from surface_bake import TILES, GUTTER, image, bake
from spatial_bake import run

parser = argparse.ArgumentParser()
parser.add_argument('--mode', required=True, choices=['cpu','metal','hybrid'])
parser.add_argument('--out', required=True)
parser.add_argument('--context', choices=['development','exclusive'], default='development')
args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
master = HERE/'facility-master.blend'
bpy.ops.wm.open_mainfile(filepath=str(master))
config = configure(args.mode)
scene = bpy.context.scene; scene.cycles.samples = 64; scene.cycles.use_denoising = False; scene.cycles.seed = 19
scratch = bpy.data.collections.new('GN_COMPUTE_BENCHMARK'); scene.collection.children.link(scratch)
material = bpy.data.materials.new('GN_BENCHMARK_RECEIVER'); material.use_nodes = True
measurements = []
for repetition in range(4):
    started = time.perf_counter()
    fields, records = run(scratch, material, TILES, GUTTER, image, bake)
    measurements.append({'repetition':repetition, 'kind':'warmup' if repetition==0 else 'measured',
                         'seconds':time.perf_counter()-started,
                         'outputSha256':hashlib.sha256(b''.join(fields[key]['ao'].tobytes()+fields[key]['color'].tobytes() for key in sorted(fields))).hexdigest(),
                         'receivers':records})
report = {'schemaVersion':1, 'workload':'Three actual authored spatial AO/direct-light receivers, 64 samples; same scene and atlas resolutions',
          'sourceMasterSha256':hashlib.sha256(master.read_bytes()).hexdigest(),
          'sourceHashes':{name:hashlib.sha256((HERE/name).read_bytes()).hexdigest() for name in ['compute.py','spatial_bake.py','surface_bake.py','benchmark-compute.py']},
          'executionContext':args.context, 'configuration':config, 'runs':measurements, 'medianSeconds':statistics.median(row['seconds'] for row in measurements[1:]),
          'limits':['Microbenchmark, not total asset-generation time.', 'CPU/GPU devices can produce different floating-point samples.', 'No GPU-only benchmark proves physical mobile performance.']}
destination = Path(args.out); destination.parent.mkdir(parents=True, exist_ok=True); destination.write_text(json.dumps(report,indent=2)+'\n')
print('GN_COMPUTE_BENCHMARK '+json.dumps({'mode':args.mode,'medianSeconds':report['medianSeconds'],'report':str(destination)}))
