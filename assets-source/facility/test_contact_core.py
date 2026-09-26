"""CPU contract checks for the shared static construction/AO fixture."""
import unittest
import math
from unittest.mock import patch

from rack_kit import stationary_module_core
import surface_contract
from surface_contract import TILES, tile_uv, contact_frame, validate_contact_frame, stable_seed


class AuthoringRecorder:
    def __init__(self):
        self.parts = []
        self.frames = []

    def box(self, name, position, size, material, parent, *args, **kwargs):
        part = dict(name=name, position=position, size=size, material=material, parent=parent)
        self.parts.append(part)
        return part

    def cylinder(self, name, start, end, radius, material, parent, **kwargs):
        self.parts.append(dict(name=name, parent=parent))

    def add_surface_frame(self, part, region, axis, sign, origin, u, v, size):
        frame = contact_frame(region, axis, sign, origin, u, v, size)
        self.frames.append((part, frame))
        return frame


class ContactCoreTests(unittest.TestCase):
    def test_bake_receivers_and_export_frames_share_valid_atlas_regions(self):
        author = AuthoringRecorder()
        core = stationary_module_core(author, "static-frame", "static-body", 0)
        self.assertEqual(set(core["receivers"]), {"rack_core_side", "rack_support"})
        self.assertEqual({frame["region"] for _, frame in author.frames}, set(core["receivers"]))
        for part, frame in author.frames:
            self.assertIn(frame["region"], TILES)
            self.assertIn(part["parent"], {"static-frame", "static-body"})
            self.assertAlmostEqual(sum(v*v for v in frame["u"]), 1)
            self.assertAlmostEqual(sum(v*v for v in frame["v"]), 1)
            self.assertAlmostEqual(sum(a*b for a,b in zip(frame["u"],frame["v"])), 0)
            for uv in [(0,0),(0,1),(1,0),(1,1)]:
                tile_uv(frame["region"], *uv)

    def test_stationary_fixture_excludes_all_moving_construction(self):
        author = AuthoringRecorder()
        stationary_module_core(author, "static-frame", "static-body", 0)
        names = [part["name"].lower() for part in author.parts]
        self.assertEqual(names.count("tray supporting rail"), 2)
        self.assertEqual(names.count("tray side captive screw"), 4)
        self.assertEqual(names.count("enclosed representative server tray"), 1)
        for forbidden in ["door", "service connector", "removable", "side panel", "service tray"]:
            self.assertFalse(any(forbidden in name for name in names))

    def test_receiver_frames_translate_with_their_stationary_slot(self):
        low, high = AuthoringRecorder(), AuthoringRecorder()
        stationary_module_core(low, "frame", "body", 0)
        stationary_module_core(high, "frame", "body", 1.3)
        self.assertEqual(len(low.frames), len(high.frames))
        for (left_part,left), (right_part,right) in zip(low.frames,high.frames):
            self.assertEqual(left["region"],right["region"])
            self.assertEqual(left["size"],right["size"])
            for point in ["position"]:
                self.assertAlmostEqual(right_part[point][2]-left_part[point][2],1.3)
            self.assertAlmostEqual(right["origin"][2]-left["origin"][2],1.3)

    def test_all_actual_bake_receivers_face_outward(self):
        author = AuthoringRecorder()
        core = stationary_module_core(author, "static-frame", "static-body", 0)
        for receiver in core["receivers"].values():
            validate_contact_frame(receiver["frame"], outward=True)

    def test_malformed_contact_frames_fail_before_authoring_or_export(self):
        valid = contact_frame("rack_core_side", 0, 1, (.312,-.5,-.085), (0,1,0), (0,0,1), (.85,.17))
        malformed = [
            {"axis": -1}, {"axis": 3}, {"axis": True}, {"axis": 1.0},
            {"sign": 0}, {"sign": True}, {"sign": math.inf},
            {"region": "missing"}, {"region": "rack_a"}, {"region": []},
            {"origin": (0,0)}, {"origin": (math.nan,0,0)}, {"origin": (0,math.inf,0)},
            {"origin": (0,"0",0)}, {"origin": (False,0,0)},
            {"u": (0,2,0)}, {"u": (0,0,1)}, {"u": (1,0,0)},
            {"v": (0,0,0)}, {"size": (0,1)}, {"size": (-1,1)},
            {"size": (1,math.nan)}, {"size": (1,2,3)},
            {"kind": "normal-map"}, {"unrecognized": 1},
        ]
        for change in malformed:
            with self.subTest(change=change), self.assertRaises(ValueError):
                validate_contact_frame({**valid, **change})
        for invalid in [None, [], {key:value for key,value in valid.items() if key!="kind"}]:
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                validate_contact_frame(invalid)

    def test_scalar_mirror_is_allowed_but_not_an_inward_bake_receiver(self):
        mirrored = contact_frame("rack_core_side", 0, -1, (-.312,-.5,-.085), (0,1,0), (0,0,1), (.85,.17))
        self.assertEqual(validate_contact_frame(mirrored),mirrored)
        with self.assertRaises(ValueError):
            validate_contact_frame(mirrored,outward=True)

    def test_attempt04_noise_identity_survives_atlas_contract_revisions(self):
        # Fixed values read from the preserved attempt04 source. These are the
        # reviewed appearance seeds, not recomputed expectations from new code.
        baseline = {"paint":3611615336,"rack_panel":3334338513,
                    "collector":3715224639,"collector_top":2022360533,
                    "cooler_panel":4121377583,"metal":1639067522,
                    "polished":1262295953,"copper":2058168825,
                    "rubber":3180463179,"polymer":2697103435}
        for region, expected in baseline.items():
            self.assertEqual(stable_seed(region),expected)
            self.assertEqual(surface_contract.surface_spec(region).seed,expected)
        with patch.object(surface_contract,"REVISION","future-layout-only-change"):
            self.assertEqual({name:stable_seed(name) for name in baseline},baseline)


if __name__ == "__main__":
    unittest.main()
