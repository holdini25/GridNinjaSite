"""GPU-free fixtures: run with pinned Blender --background --factory-startup."""
import json
import math
from pathlib import Path
import struct
import sys
import unittest

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import bpy
from mathutils import Vector
import export
from surface_bake import detail_geometry, geometry_fingerprint, motion_group, node_tree_fingerprint
from surface_contract import METRES
from spatial_bake import receivers_from_geometry, RECEIVER_FAMILIES


class BlenderBakeTests(unittest.TestCase):
    def setUp(self):
        self.collection=bpy.data.collections.new('Bake fixture tests')
        bpy.context.scene.collection.children.link(self.collection)

    def tearDown(self):
        for obj in list(self.collection.objects):
            mesh=obj.data;bpy.data.objects.remove(obj,do_unlink=True)
            if mesh and mesh.users==0:bpy.data.meshes.remove(mesh)
        bpy.data.collections.remove(self.collection)

    def mesh(self,name,vertices,faces):
        mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces)
        obj=bpy.data.objects.new(name,mesh);self.collection.objects.link(obj)
        return obj

    def test_detail_mesh_uses_declared_metres_not_unit_square(self):
        for kind in ('rack_a','face_a','face_b','coil'):
            vertices,faces=detail_geometry(kind,16);width,height=METRES[kind]
            self.assertAlmostEqual(max(v[0] for v in vertices),width)
            self.assertAlmostEqual(max(v[1] for v in vertices),height)
            self.assertLessEqual(max(v[2] for v in vertices),.007801)
            self.assertEqual(len(faces),256)

    def test_hash_detects_topology_and_uv_changes_at_same_positions(self):
        obj=self.mesh('Fingerprint plane',[(0,0,0),(1,0,0),(1,1,0),(0,1,0)],[(0,1,2,3)])
        uv=obj.data.uv_layers.new(name='UVMap')
        for item,point in zip(uv.data,[(0,0),(1,0),(1,1),(0,1)]):item.uv=point
        bpy.context.view_layer.update();graph=bpy.context.evaluated_depsgraph_get()
        initial=geometry_fingerprint(obj,graph)
        uv.data[0].uv=(.25,0);obj.data.update();bpy.context.view_layer.update()
        self.assertNotEqual(initial,geometry_fingerprint(obj,graph))
        obj['gnSurfacePhysicalFootprint']=[.3,.2]
        initial=geometry_fingerprint(obj,graph)
        obj['gnSurfacePhysicalFootprint']=[.4,.2]
        self.assertNotEqual(initial,geometry_fingerprint(obj,graph))
        obj['gnMotionGroup']='door';self.assertEqual(motion_group(obj),'door')

    def test_cache_hash_includes_ramp_and_noise_settings(self):
        mat=bpy.data.materials.new('Node hash fixture');mat.use_nodes=True
        try:
            ramp=mat.node_tree.nodes.new('ShaderNodeValToRGB')
            initial=node_tree_fingerprint(mat.node_tree);ramp.color_ramp.elements[0].position=.2
            self.assertNotEqual(initial,node_tree_fingerprint(mat.node_tree))
            noise=mat.node_tree.nodes.new('ShaderNodeTexNoise')
            initial=node_tree_fingerprint(mat.node_tree);noise.noise_dimensions='4D'
            self.assertNotEqual(initial,node_tree_fingerprint(mat.node_tree))
        finally:bpy.data.materials.remove(mat)

    def test_receivers_follow_authored_bounds_and_motion_groups(self):
        objects=[]
        for index,(region,equipment,axis,sign) in enumerate(RECEIVER_FAMILIES):
            obj=self.mesh(region,[(x,y,z) for x in (0,2) for y in (0,3) for z in (0,4)],[(0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)])
            obj['gnEquipmentId']=equipment;obj['gnBakeReceiverFamily']=region
            obj['gnBakeReceiverAxis']=axis;obj['gnBakeReceiverSign']=sign
            obj['gnMotionGroup']='cover' if region=='collector_top' else 'static'
            obj.location=(10+index,20,30);objects.append(obj)
        bpy.context.view_layer.update()
        records=receivers_from_geometry(objects,bpy.context.evaluated_depsgraph_get())
        self.assertEqual(records[0]['motionGroup'],'cover')
        for record,(_,_,axis,sign) in zip(records,RECEIVER_FAMILIES):
            self.assertAlmostEqual(record['normal'][axis],sign)
            self.assertTrue(all(point[0]>=9 for point in record['corners']))
        before=records[1]['corners'][0][0];objects[1].location.x+=5;bpy.context.view_layer.update()
        after=receivers_from_geometry(objects,bpy.context.evaluated_depsgraph_get())[1]['corners'][0][0]
        self.assertAlmostEqual(after-before,5)

    def test_explicit_tangent_basis_handles_rotated_and_mirrored_uv(self):
        mat=bpy.data.materials.new('BasisFixture')
        try:
            for uv,expected_tangent,expected_sign in [
                ([(0,0),(1,0),(1,1),(0,1)],(1,0,0),1),
                ([(0,0),(0,1),(1,1),(1,0)],(0,1,0),-1),
                ([(1,0),(0,0),(0,1),(1,1)],(-1,0,0),-1),
            ]:
                binary=bytearray();views=[];accessors=[]
                def attribute(values,arity,component=5126):
                    binary.extend(b'\0'*((-len(binary))%4));start=len(binary)
                    fmt='<'+('f' if component==5126 else 'H')*arity
                    for value in values:binary.extend(struct.pack(fmt,*value))
                    views.append({'buffer':0,'byteOffset':start,'byteLength':len(binary)-start})
                    accessors.append({'bufferView':len(views)-1,'componentType':component,'count':len(values),'type':{1:'SCALAR',2:'VEC2',3:'VEC3',4:'VEC4'}[arity]})
                    return len(accessors)-1
                attrs={'POSITION':attribute([(0,0,0),(2,0,0),(2,3,0),(0,3,0)],3),
                       'NORMAL':attribute([(0,0,1)]*4,3),'TEXCOORD_0':attribute(uv,2)}
                indices=attribute([(0,),(1,),(2,),(0,),(2,),(3,)],1,5123)
                data={'asset':{'version':'2.0'},'materials':[{'name':mat.name,'normalTexture':{'index':0}}],
                      'meshes':[{'primitives':[{'attributes':attrs,'indices':indices,'material':0}]}],
                      'accessors':accessors,'bufferViews':views,'buffers':[{'byteLength':len(binary)}]}
                encoded=json.dumps(data).encode();encoded+=b' '*((-len(encoded))%4);binary.extend(b'\0'*((-len(binary))%4))
                raw=struct.pack('<III',0x46546c67,2,28+len(encoded)+len(binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+binary
                result=export.finish_surfaces(raw);length=struct.unpack_from('<I',result,12)[0];gltf=json.loads(result[20:20+length])
                accessor=gltf['accessors'][gltf['meshes'][0]['primitives'][0]['attributes']['TANGENT']]
                view=gltf['bufferViews'][accessor['bufferView']]
                for index in range(4):
                    tangent=struct.unpack_from('<ffff',result,28+length+view['byteOffset']+index*16)
                    for actual,expected in zip(tangent[:3],expected_tangent):self.assertAlmostEqual(actual,expected)
                    self.assertEqual(tangent[3],expected_sign)
        finally:bpy.data.materials.remove(mat)


if __name__=='__main__':
    suite=unittest.defaultTestLoader.loadTestsFromTestCase(BlenderBakeTests)
    result=unittest.TextTestRunner(verbosity=2).run(suite)
    if not result.wasSuccessful():raise SystemExit(1)
