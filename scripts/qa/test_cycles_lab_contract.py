"""GPU-free regression tests for hash binding, semantics, framing and poses."""
import json
import math
from pathlib import Path
import struct
import tempfile
import unittest
from cycles_lab_contract import apply_pose, camera_fit, glb_read, glb_write, load_release, sha256, subset_model

class CyclesLabContractTests(unittest.TestCase):
    def fixture(self):
        binary = struct.pack('<6f6H', 2, 2, 2, 4, 4, 4, 0, 1, 2, 3, 4, 5)
        doc = {'asset': {'version': '2.0'}, 'buffers': [{'byteLength': len(binary)}],
               'bufferViews': [{'buffer': 0, 'byteOffset': 0, 'byteLength': 24}, {'buffer': 0, 'byteOffset': 24, 'byteLength': 12}],
               'accessors': [{'bufferView': 0, 'componentType': 5126, 'count': 6, 'type': 'SCALAR'},
                             {'bufferView': 1, 'componentType': 5123, 'count': 6, 'type': 'SCALAR'}],
               'meshes': [{'primitives': [{'indices': 1, 'attributes': {'_GN_EQUIPMENT_ID': 0, 'NORMAL': 9, 'TEXCOORD_0': 10}}]}],
               'nodes': [{'mesh': 0, 'extras': {'gnRole': 'equipment_surface'}}]}
        return doc, binary
    def test_filter_retains_normals_uvs_and_exact_identity(self):
        doc, binary = self.fixture()
        result, output, count = subset_model(doc, binary, 2)
        self.assertEqual(count, 1)
        self.assertEqual(output[:len(binary)], binary)
        primitive = result['meshes'][result['nodes'][0]['mesh']]['primitives'][0]
        self.assertEqual(primitive['attributes'], doc['meshes'][0]['primitives'][0]['attributes'])
        self.assertEqual(result['accessors'][primitive['indices']]['count'], 3)
        self.assertEqual(doc['nodes'][0]['mesh'], 0)
        self.assertEqual(glb_read(glb_write(result, output))[0], result)
    def test_cross_identity_triangle_rejected(self):
        doc, binary = self.fixture()
        bad = struct.pack('<6f', 2, 4, 2, 4, 4, 4) + binary[24:]
        with self.assertRaisesRegex(ValueError, 'crosses equipment'): subset_model(doc, bad, 2)
    def test_picking_does_not_render(self):
        doc, binary = self.fixture()
        doc['nodes'].append({'mesh': 0, 'extras': {'gnRole': 'picking_proxy'}})
        result, _, _ = subset_model(doc, binary, 2)
        self.assertNotIn('mesh', result['nodes'][1])
    def test_hash_and_embedded_texture_checks(self):
        doc, binary = self.fixture()
        payload = glb_write(doc, binary)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'facility.glb').write_bytes(payload)
            manifest = json.dumps({'files': [{'file': 'facility.glb', 'bytes': len(payload), 'sha256': sha256(payload)}]}).encode()
            (root / 'manifest.json').write_bytes(manifest)
            load_release(root, sha256(manifest), 'facility.glb')
            with self.assertRaisesRegex(ValueError, 'manifest'): load_release(root, '0'*64, 'facility.glb')
            (root / 'facility.glb').write_bytes(payload[:-1])
            with self.assertRaisesRegex(ValueError, 'identity'): load_release(root, sha256(manifest), 'facility.glb')
        doc['images'] = [{'uri': 'https://example.invalid/x.png'}]
        with self.assertRaisesRegex(ValueError, 'External textures'): glb_read(glb_write(doc, binary))
    def test_asymmetric_orthographic_fit_and_no_resize_drift(self):
        profile = {'camera': [0, 0, 10], 'target': [0, 0, 0], 'padding': 1.12}
        bounds = {'min': [1, -1, -1], 'max': [3, 1, 1]}
        frame = camera_fit(profile, bounds, 400, 800)
        self.assertEqual(frame['target'], [2., 0., 0.])
        self.assertAlmostEqual(frame['verticalSpan'], 4.48)
        self.assertAlmostEqual(frame['horizontalSpan'], 2.24)
        self.assertEqual(frame, camera_fit(profile, bounds, 400, 800))
    def test_perspective_corners_fit_with_depth_and_padding(self):
        profile = {'camera': [3, 2, 5], 'target': [0, 0, 0], 'padding': 1.12, 'projection': 'perspective', 'fov': 32}
        bounds = {'min': [-1, -2, -1], 'max': [1, 2, 1]}
        frame = camera_fit(profile, bounds, 390, 844)
        for corner in range(8):
            point = [bounds['max' if corner & (1 << i) else 'min'][i] - frame['position'][i] for i in range(3)]
            dot = lambda axis: sum(point[i]*frame[axis][i] for i in range(3))
            depth = -dot('back')
            self.assertLessEqual(abs(dot('up'))*1.12, depth*math.tan(math.radians(16)) + 1e-9)
            self.assertLessEqual(abs(dot('right'))*1.12, depth*math.tan(math.radians(16))*390/844 + 1e-9)
    def test_service_door_and_tray_do_not_imply_cutaway(self):
        specimen = {'poses': {'service': {'transforms': [{'id': 'door', 'position': [-.3, 1, .6], 'visible': True},
                                                        {'id': 'panel', 'position': [0, 0, 0], 'visible': False}]}},
                    'rackMotion': {'door': {'objectId': 'door', 'open': [0, -.8, 0, .6]},
                                   'tray': {'objectId': 'tray', 'extended': [0, 0, .18]}, 'cutawayObjectIds': ['panel']}}
        doc = {'nodes': [{'extras': {'gnSpecimen': json.dumps(specimen)}},
                         *[{'extras': {'gnId': name}, 'children': [99]} for name in ['door', 'tray', 'panel']]]}
        apply_pose(doc, 'service')
        self.assertEqual(doc['nodes'][1]['rotation'], [0, -.8, 0, .6])
        self.assertEqual(doc['nodes'][2]['translation'], [0, 0, .18])
        self.assertEqual(doc['nodes'][3]['children'], [99])

if __name__ == '__main__': unittest.main()
