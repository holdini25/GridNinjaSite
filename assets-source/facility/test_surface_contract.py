"""CPU-only invariants for physical UVs and bounded coplanar segmentation.

Run: python3 -m unittest discover -s assets-source/facility -p 'test_surface_contract.py'
No Blender process, generated files, render device or master write is required.
"""
from dataclasses import FrozenInstanceError, replace
import math
import unittest

from surface_contract import (COLOR_SIZE, FINISHES, GUTTER, METRES, SIZE, SURFACES,
                              TILES, bounds, frame_spec, project_uv,
                              reviewed_finishes, segmented_box, stable_seed,
                              surface_spec, tile_uv)


def cross(a,b):
    return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])


class SurfaceContractTests(unittest.TestCase):
    def test_contract_is_immutable_and_regions_are_complete(self):
        self.assertEqual(set(TILES),set(METRES))
        self.assertEqual(set(TILES),set(SURFACES))
        with self.assertRaises(TypeError):TILES['paint']=(0,0,1,1)
        with self.assertRaises(TypeError):FINISHES['paint']=(0,1)
        with self.assertRaises(FrozenInstanceError):surface_spec('paint').roughness=.1

    def test_atlas_rectangles_are_padded_and_only_neutral_aliases_metal(self):
        seen={}
        for region,(x,y,w,h) in TILES.items():
            self.assertGreater(w,2*GUTTER);self.assertGreater(h,2*GUTTER)
            self.assertGreaterEqual(x,0);self.assertGreaterEqual(y,0)
            self.assertLessEqual(x+w,SIZE);self.assertLessEqual(y+h,SIZE)
            self.assertEqual([v%2 for v in (x,y,w,h,GUTTER)],[0]*5)
            for pixel in ((xx,yy) for xx in range(x,x+w) for yy in range(y,y+h)):
                if pixel in seen:self.assertEqual({region,seen[pixel]},{'neutral','metal'})
                seen[pixel]=region
        self.assertEqual(COLOR_SIZE,SIZE//2)

    def test_reviewed_metric_pattern_footprints_stay_fixed(self):
        self.assertEqual(METRES['paint'],(4.,4.))
        self.assertEqual(METRES['rack_a'],(.4,.8))
        self.assertEqual(METRES['face_a'],(.3,.2))
        self.assertEqual(METRES['face_b'],(.2,.2))
        self.assertEqual(METRES['coil'],(1.1,3.))
        self.assertEqual(FINISHES['paint'],(.42,0))

    def test_uv_rejects_unintended_clamping_and_nonfinite_values(self):
        for coords in [(-.01,.5),(1.01,.5),(.5,-1),(.5,2),(math.nan,0),(0,math.inf)]:
            with self.subTest(coords=coords),self.assertRaises(ValueError):tile_uv('paint',*coords)
        self.assertEqual(tile_uv('paint',-1e-8,1+1e-8),tile_uv('paint',0,1))

    def test_metric_projection_preserves_pitch_on_small_crops(self):
        spec=frame_spec('face_a',(2,3,4),(0,1,0),(0,0,1))
        start=project_uv(spec,(2,3,4))
        full=project_uv(spec,(2,3.3,4.2))
        half=project_uv(spec,(2,3.15,4.1))
        for axis in range(2):self.assertAlmostEqual(half[axis],(start[axis]+full[axis])/2)
        with self.assertRaises(ValueError):project_uv(spec,(2,3.4,4.1))

    def test_frame_rejects_scale_shear_and_invalid_physical_values(self):
        spec=surface_spec('paint')
        for override in [{'u_axis':(2,0,0)},{'v_axis':(1,0,0)},{'metric_size':(0,1)},
                         {'roughness':1.1},{'metalness':-1},{'relief_metres':-.1},
                         {'origin':(math.nan,0,0)},{'origin':(0,0)},{'metric_size':(1,2,3)}]:
            with self.subTest(override=override),self.assertRaises(ValueError):replace(spec,**override)

    def test_finish_override_is_explicit_and_does_not_mutate_contract(self):
        reviewed=reviewed_finishes(.45)
        self.assertEqual(reviewed['paint'],(.45,0));self.assertEqual(reviewed['collector'],(.45,0))
        self.assertEqual(FINISHES['paint'],(.42,0));self.assertEqual(reviewed['copper'],(.34,1))
        for value in [.3,.61,math.nan]:
            with self.assertRaises(ValueError):reviewed_finishes(value)

    def test_seed_is_identity_bound_and_stable(self):
        self.assertEqual(stable_seed('paint'),surface_spec('paint').seed)
        self.assertEqual(len({stable_seed(name) for name in SURFACES}),len(SURFACES))
        self.assertTrue(all(0<=spec.seed<2**32 for spec in SURFACES.values()))

    def test_evaluated_bounds_scan_handles_generator_and_empty_input(self):
        self.assertEqual(bounds(iter([(1,2,3),(-1,4,0)])),((-1,2,0),(1,4,3)))
        with self.assertRaises(ValueError):bounds([])

    def test_projection_and_segmentation_reject_invalid_dimension_shapes(self):
        for position in [(0,0),(0,0,0,0),(0,math.inf,0)]:
            with self.assertRaises(ValueError):project_uv(surface_spec('paint'),position)
        for size in [(0,1,1),(-1,1,1),(1,1),(1,math.nan,1)]:
            with self.assertRaises(ValueError):segmented_box((0,0,0),size,(4,4))

    def test_coplanar_splits_preserve_envelope_outward_normals_and_closed_edges(self):
        center=(.25,-.87,3.31)
        for size in [(5.83,.008,.3),(6.59,.275,.008),(1.24,.016,2.525),(8.5,7.8,.04)]:
            with self.subTest(size=size):
                vertices,faces=segmented_box(center,size,(4.,4.))
                low,high=bounds(vertices)
                for axis in range(3):
                    self.assertAlmostEqual(low[axis],center[axis]-size[axis]/2)
                    self.assertAlmostEqual(high[axis],center[axis]+size[axis]/2)
                edges={}
                for face in faces:
                    points=[vertices[i] for i in face]
                    a=tuple(points[1][k]-points[0][k] for k in range(3))
                    b=tuple(points[2][k]-points[0][k] for k in range(3))
                    normal=cross(a,b)
                    middle=tuple(sum(p[k] for p in points)/len(points)-center[k] for k in range(3))
                    self.assertGreater(sum(normal[k]*middle[k] for k in range(3)),0)
                    face_low,face_high=bounds(points)
                    self.assertLessEqual(max(face_high[k]-face_low[k] for k in range(3)),4+1e-9)
                    for i,j in zip(face,face[1:]+face[:1]):
                        key=tuple(sorted((i,j)));edges.setdefault(key,[]).append((i,j))
                for directed in edges.values():
                    self.assertEqual(len(directed),2)
                    self.assertEqual(directed[0],tuple(reversed(directed[1])))
                if max(size)<4:self.assertEqual(sum(len(face)-2 for face in faces),12)
                if 4<max(size)<8 and sorted(size)[1]<4:
                    self.assertEqual(sum(len(face)-2 for face in faces),20)


if __name__=='__main__':unittest.main()
