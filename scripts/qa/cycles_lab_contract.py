"""GPU-free contracts for the private Cycles lab. No deployment or master writes."""
import copy
import hashlib
import json
import math
from pathlib import Path
import struct

REVISION = 'premium-cycles-lab.v1'
SUBJECTS = {'rack': 'rack-02', 'collector': 'air-row-0', 'cooler': 'cooler-0'}
MODES = ('final', 'gray', 'normal', 'roughness', 'ao')


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def canonical(data):
    return json.dumps(data, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()


def glb_read(data):
    if len(data) < 28 or struct.unpack_from('<III', data) != (0x46546c67, 2, len(data)):
        raise ValueError('Invalid GLB header')
    json_length, json_kind = struct.unpack_from('<II', data, 12)
    if json_kind != 0x4e4f534a or json_length % 4:
        raise ValueError('Invalid GLB JSON chunk')
    doc = json.loads(data[20:20 + json_length])
    offset = 20 + json_length
    binary_length, binary_kind = struct.unpack_from('<II', data, offset)
    if binary_kind != 0x004e4942 or offset + 8 + binary_length != len(data):
        raise ValueError('Invalid GLB binary chunk')
    binary = data[offset + 8:]
    if len(doc.get('buffers', [])) != 1 or doc['buffers'][0].get('uri'):
        raise ValueError('Only embedded, single-buffer models are supported')
    if any(image.get('uri') for image in doc.get('images', [])):
        raise ValueError('External textures are not allowed')
    return doc, binary


def glb_write(doc, binary):
    doc['buffers'][0]['byteLength'] = len(binary)
    encoded = canonical(doc)
    encoded += b' ' * (-len(encoded) % 4)
    binary += b'\0' * (-len(binary) % 4)
    return struct.pack('<III', 0x46546c67, 2, 28 + len(encoded) + len(binary)) + struct.pack('<II', len(encoded), 0x4e4f534a) + encoded + struct.pack('<II', len(binary), 0x004e4942) + binary


def load_release(directory, expected_hash, filename):
    root = Path(directory).resolve()
    manifest_bytes = (root / 'manifest.json').read_bytes()
    if sha256(manifest_bytes) != expected_hash:
        raise ValueError('Source manifest hash mismatch')
    manifest = json.loads(manifest_bytes)
    entries = [item for item in manifest['files'] if item['file'] == filename]
    if len(entries) != 1 or Path(filename).name != filename:
        raise ValueError('Model is not uniquely allowlisted')
    payload = (root / filename).read_bytes()
    if len(payload) != entries[0]['bytes'] or sha256(payload) != entries[0]['sha256']:
        raise ValueError('Source model identity mismatch')
    doc, binary = glb_read(payload)
    return manifest, doc, binary, entries[0]


def scalars(doc, binary, index):
    accessor = doc['accessors'][index]
    if accessor.get('sparse') or accessor['type'] != 'SCALAR' or accessor.get('normalized'):
        raise ValueError('Unsupported scalar accessor')
    formats = {5121: 'B', 5123: 'H', 5125: 'I', 5126: 'f'}
    fmt = '<' + formats[accessor['componentType']]
    size = struct.calcsize(fmt)
    view = doc['bufferViews'][accessor['bufferView']]
    if view.get('buffer', 0) != 0:
        raise ValueError('External buffer')
    offset = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
    stride = view.get('byteStride', size)
    if stride < size or offset + max(0, accessor['count'] - 1) * stride + size > view.get('byteOffset', 0) + view['byteLength']:
        raise ValueError('Accessor overrun')
    return [struct.unpack_from(fmt, binary, offset + i * stride)[0] for i in range(accessor['count'])]


def metadata(doc, key):
    values = [node['extras'][key] for node in doc['nodes'] if key in node.get('extras', {})]
    if len(values) != 1:
        raise ValueError('Missing or duplicate metadata: ' + key)
    return json.loads(values[0])


def subset_model(doc, binary, equipment_index):
    """Filter whole triangles by authored identity, retaining normal/UV/semantic buffers."""
    doc = copy.deepcopy(doc)
    binary = bytearray(binary)
    selected = 0
    for node in doc['nodes']:
        if 'mesh' not in node:
            continue
        role = node.get('extras', {}).get('gnRole')
        if role in {'selection_accent', 'picking_proxy'}:
            del node['mesh']
            continue
        mesh = copy.deepcopy(doc['meshes'][node['mesh']])
        primitives = []
        for primitive in mesh['primitives']:
            if primitive.get('mode', 4) != 4 or 'indices' not in primitive:
                raise ValueError('Only indexed triangles are supported')
            attribute = primitive['attributes'].get('_GN_EQUIPMENT_ID')
            if attribute is None:
                if node.get('extras', {}).get('gnEquipmentIndex') == equipment_index:
                    primitives.append(primitive)
                    selected += doc['accessors'][primitive['indices']]['count'] // 3
                continue
            identities = scalars(doc, binary, attribute)
            indices = scalars(doc, binary, primitive['indices'])
            if len(indices) % 3:
                raise ValueError('Invalid triangle count')
            kept = []
            for start in range(0, len(indices), 3):
                triangle = indices[start:start + 3]
                ids = [identities[index] for index in triangle]
                if equipment_index in ids:
                    if any(value != equipment_index for value in ids):
                        raise ValueError('Triangle crosses equipment identities')
                    kept.extend(triangle)
            if not kept:
                continue
            binary.extend(b'\0' * (-len(binary) % 4))
            view = len(doc['bufferViews'])
            doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': len(kept) * 4, 'target': 34963})
            binary.extend(struct.pack('<' + 'I' * len(kept), *kept))
            primitive['indices'] = len(doc['accessors'])
            doc['accessors'].append({'bufferView': view, 'componentType': 5125, 'count': len(kept), 'type': 'SCALAR'})
            selected += len(kept) // 3
            primitives.append(primitive)
        if primitives:
            mesh['primitives'] = primitives
            node['mesh'] = len(doc['meshes'])
            doc['meshes'].append(mesh)
        else:
            del node['mesh']
    if not selected:
        raise ValueError('No rendered triangles for selected equipment')
    return doc, bytes(binary), selected


def apply_pose(doc, pose):
    specimen = metadata(doc, 'gnSpecimen')
    nodes = {node.get('extras', {}).get('gnId'): node for node in doc['nodes']}
    motion = specimen.get('rackMotion')
    transforms = specimen['poses'][pose]['transforms']
    for transform in transforms:
        node = nodes[transform['id']]
        node['translation'] = transform['position']
        visible = transform['visible'] if not motion else not (pose == 'cutaway' and transform['id'] in motion['cutawayObjectIds'])
        if not visible:
            node['children'] = []
            node.pop('mesh', None)
    if motion:
        door = motion['door']
        nodes[door['objectId']]['rotation'] = door['open' if pose == 'service' else 'closed']
        tray = motion['tray']
        nodes[tray['objectId']]['translation'] = tray['extended' if pose == 'service' else 'retracted']
    return specimen


def camera_fit(profile, bounds, width, height, points=None):
    """Same projected-AABB fit as inspection-camera.ts; glTF Y-up coordinates."""
    def sub(a, b): return [a[i] - b[i] for i in range(3)]
    def dot(a, b): return sum(a[i] * b[i] for i in range(3))
    def cross(a, b): return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]
    def unit(a):
        length = math.sqrt(dot(a, a))
        if length < 1e-8: raise ValueError('Degenerate camera')
        return [value / length for value in a]
    if width <= 0 or height <= 0 or not 1 <= profile['padding'] <= 2:
        raise ValueError('Invalid camera dimensions/padding')
    target = profile['target']
    back = unit(sub(profile['camera'], target))
    right = unit(cross([0, 1, 0], back))
    up = cross(back, right)
    points = points if points is not None else [[bounds['max' if i & (1 << axis) else 'min'][axis] for axis in range(3)] for i in range(8)]
    projected = [[dot(sub(point, target), axis) for axis in (right, up, back)] for point in points]
    aspect = width / height
    padding = profile['padding']
    result = {'target': list(target), 'position': list(profile['camera']), 'right': right, 'up': up, 'back': back,
              'projection': profile.get('projection', 'orthographic'), 'near': .1, 'far': 150., 'padding': padding, 'aspect': aspect,
              'bounds': bounds, 'fitAlgorithm': 'inspection-camera.ts/projected-aabb-v1'}
    if result['projection'] == 'perspective':
        fov = profile['fov']
        tangent = math.tan(math.radians(fov) / 2)
        distance = max(.1, *(max(z + padding*abs(x)/(tangent*aspect), z + padding*abs(y)/tangent) for x, y, z in projected))
        maximum_z = max(point[2] for point in projected)
        distance = max(distance, maximum_z + .1)
        result.update(position=[target[i] + back[i]*distance for i in range(3)], fov=fov,
                      near=max(.01, min(.1, (distance-maximum_z)*.5)), far=max(150., (distance-min(point[2] for point in projected))*2))
    else:
        low = [min(point[i] for point in projected) for i in range(2)]
        high = [max(point[i] for point in projected) for i in range(2)]
        center = [(low[i] + high[i]) / 2 for i in range(2)]
        half_height = max((high[1]-low[1])*padding/2, (high[0]-low[0])*padding/(2*aspect))
        offset = [right[i]*center[0] + up[i]*center[1] for i in range(3)]
        result.update(position=[profile['camera'][i]+offset[i] for i in range(3)], target=[target[i]+offset[i] for i in range(3)],
                      verticalSpan=half_height*2, horizontalSpan=half_height*2*aspect)
    return result
