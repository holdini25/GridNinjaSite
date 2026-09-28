"""Regression checks for contact receiver planes and moving-tray independence."""
from pathlib import Path
import sys
import unittest

sys.path.insert(0,str(Path(__file__).resolve().parent))
from rack_kit import folded_support_rail
from surface_contract import contact_frame,contact_face_matches

class Generator:
    def __init__(self):self.objects=[]
    def box(self,name,center,size,material,parent):
        obj={'name':name,'center':center,'size':size,'material':material};self.objects.append(obj);return obj
    def add_surface_frame(self,obj,*args):
        frame=contact_frame(*args);obj['gnSurfaceFrames']=[frame];return frame

class ContactIsolation(unittest.TestCase):
    def setUp(self):
        self.frame=contact_frame('rack_support',2,1,(.3365,-.415,-.094),(0,1,0),(-1,0,0),(.82,.029))
        self.face=[(.3075,-.415,-.094),(.3365,-.415,-.094),(.3365,.405,-.094),(.3075,.405,-.094)]
    def test_bearing_face_receives_contact(self):self.assertTrue(contact_face_matches(self.frame,(0,0,1),self.face))
    def test_parallel_web_top_cannot_receive_bearing_shadow(self):
        self.assertFalse(contact_face_matches(self.frame,(0,0,1),[(x,y,-.049) for x,y,z in self.face]))
    def test_cross_plane_face_rejected(self):
        crossing=self.face[:];crossing[0]=(*crossing[0][:2],-.093)
        self.assertFalse(contact_face_matches(self.frame,(0,0,1),crossing))
    def test_opposite_normal_rejected(self):self.assertFalse(contact_face_matches(self.frame,(0,0,-1),self.face))
    def test_rounding_tolerance_only(self):
        self.assertTrue(contact_face_matches(self.frame,(0,0,1),[(x,y,z+5e-7) for x,y,z in self.face]))
        self.assertFalse(contact_face_matches(self.frame,(0,0,1),[(x,y,z+2e-6) for x,y,z in self.face]))
    def test_service_support_has_no_chassis_contact_field(self):
        g=Generator();_,frame=folded_support_rail(g,'frame',.322,1.478,contact=False)
        self.assertIsNone(frame)
        self.assertTrue(all('gnSurfaceFrames' not in obj for obj in g.objects))
    def test_stationary_field_applies_only_to_bearing(self):
        g=Generator();_,frame=folded_support_rail(g,'frame',.322,1.478)
        self.assertEqual(frame['region'],'rack_support')
        self.assertEqual([obj['material'] for obj in g.objects if 'gnSurfaceFrames' in obj],['Steel'])
        self.assertTrue(all('gnSurfaceFrames' not in obj for obj in g.objects if obj['material']=='Graphite'))
    def test_service_geometry_matches_stationary_envelope(self):
        a=Generator();b=Generator();folded_support_rail(a,'frame',-.322,0.);folded_support_rail(b,'frame',-.322,0.,contact=False)
        self.assertEqual([(o['center'],o['size'],o['material']) for o in a.objects],[(o['center'],o['size'],o['material']) for o in b.objects])

if __name__=='__main__':unittest.main()
