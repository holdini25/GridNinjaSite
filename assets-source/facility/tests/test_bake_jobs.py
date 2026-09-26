import math
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from bake_job import BakeCache, atomic_write, belongs_to_receiver, fingerprint, output_lock, projection_settings


class BakeJobTests(unittest.TestCase):
    def test_projection_encloses_positive_and_negative_relief(self):
        for low, high in [(0., .0018), (-.002, .006), (.0012, .004)]:
            result = projection_settings(low, high)
            self.assertGreater(result['cageExtrusionMetres'], high)
            self.assertLess(result['cageExtrusionMetres']-result['maxRayDistanceMetres'], low)
            self.assertLess(result['maxRayDistanceMetres'], .02)
        for low, high in [(1,0), (math.nan,1), (0,math.inf)]:
            with self.assertRaises(ValueError): projection_settings(low,high)

    def test_motion_partition_does_not_bake_a_removed_cover_shadow(self):
        self.assertTrue(belongs_to_receiver('static','static'))
        self.assertTrue(belongs_to_receiver('GN_RACK_DOOR','GN_RACK_DOOR'))
        self.assertFalse(belongs_to_receiver('GN_RACK_DOOR','static'))
        self.assertFalse(belongs_to_receiver('static','GN_RACK_TRAY'))

    def test_cache_requires_complete_matching_hash_and_recipe(self):
        with tempfile.TemporaryDirectory() as directory:
            cache=BakeCache(directory);recipe={'backend':'CPU','vertices':[1,2],'uv':(.1,.2)}
            self.assertIsNone(cache.get(recipe))
            key=cache.put(recipe,b'complete result')
            self.assertEqual(cache.get(recipe),b'complete result')
            self.assertIsNone(cache.get({**recipe,'backend':'METAL'}))
            self.assertIsNone(cache.get({**recipe,'uv':(.1,.3)}))
            (Path(directory)/key/'result.npy').write_bytes(b'corrupt')
            self.assertIsNone(cache.get(recipe))

    def test_atomic_output_and_exclusive_publisher(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'file';atomic_write(path,b'old');atomic_write(path,b'new')
            self.assertEqual(path.read_bytes(),b'new')
            with output_lock(directory):
                with self.assertRaises(FileExistsError):
                    with output_lock(directory): pass
                self.assertTrue((Path(directory)/'.bake-write.lock').exists())
            self.assertFalse((Path(directory)/'.bake-write.lock').exists())

    def test_fingerprint_rejects_nonfinite_values(self):
        with self.assertRaises(ValueError): fingerprint({'normal': math.nan})
        self.assertNotEqual(fingerprint({'positions':[1],'indices':[0,1,2]}),
                            fingerprint({'positions':[1],'indices':[0,2,1]}))

    def test_blender_style_id_arrays_are_hashed_by_value(self):
        class Array:
            def to_list(self):return [1.,2.,3.]
        self.assertEqual(fingerprint({'array':Array()}),fingerprint({'array':[1.,2.,3.]}))


if __name__=='__main__': unittest.main()
