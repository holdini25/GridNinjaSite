"""Export an atlas contract without importing/executing Blender authoring code."""
import argparse
import ast
import hashlib
import json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--authoring', required=True, type=Path)
parser.add_argument('--bake-report', required=True, type=Path)
parser.add_argument('--output', required=True, type=Path)
args = parser.parse_args()
source = args.authoring.read_bytes()
report_bytes = args.bake_report.read_bytes()
report = json.loads(report_bytes)
digest = lambda value: hashlib.sha256(value).hexdigest()
assert digest(source) == report['sourceSha256'], 'Authoring source does not match bake provenance'
values = {}
if 'atlasTiles' in report:
    assert report['atlasOrigin'] == 'bottom-left'
    layout_digest = digest(json.dumps(report['atlasTiles'], sort_keys=True, separators=(',', ':'), allow_nan=False).encode())
    assert layout_digest == report['atlasLayoutSha256'], 'Atlas layout does not match its recorded hash'
    values = {'TILES': report['atlasTiles'], 'SIZE': report['resolution'][0], 'GUTTER': report['gutterPixels']}
else:
    for item in ast.parse(source).body:
        if isinstance(item, ast.Assign):
            for target in item.targets:
                if isinstance(target, ast.Name) and target.id in {'TILES', 'SIZE', 'GUTTER'}:
                    assert target.id not in values, 'Repeated atlas declaration'
                    values[target.id] = ast.literal_eval(item.value)
assert set(values) == {'TILES', 'SIZE', 'GUTTER'}, 'Explicit atlas declarations required'
assert report['resolution'] == [values['SIZE'], values['SIZE']]
assert report['gutterPixels'] == values['GUTTER']
orm = next(item for item in report['images'] if item['file'] == 'surface-orm.png')
regions = {name: {'rect': list(rect), 'roughness': report['ormFinishes'][name][0], 'metalness': report['ormFinishes'][name][1]} for name, rect in values['TILES'].items() if name in report['ormFinishes']}
result = {'schemaVersion': 'facility-benchmark-surfaces.v1', 'coordinateOrigin': 'bottom-left', 'resolution': report['resolution'], 'gutterPixels': report['gutterPixels'], 'roughnessChannel': 1, 'roughnessMultiplier': report['roughnessMultiplier'], 'ormSha256': orm['sha256'], 'authoringSha256': digest(source), 'bakeReportSha256': digest(report_bytes), 'regions': regions}
out = args.output.resolve()
assert out.is_relative_to(Path('build/qa').resolve()), 'Diagnostics must remain under build/qa'
out.parent.mkdir(parents=True, exist_ok=True)
with out.open('x') as handle:
    handle.write(json.dumps(result, indent=2) + '\n')
print(json.dumps({'output': str(out), 'sha256': digest(out.read_bytes()), 'regions': len(regions)}))
