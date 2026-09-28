/** Inspect actual v6 mesh triangles along authored clear-air sample paths. */
import { Ray, Vector3 } from 'three';
export function validateAirConstruction({ bytes, data, topology, floatAttribute }) {
  if (topology?.schemaVersion !== 'facility-topology.v2') return undefined;
  const binaryOffset = 28 + bytes.readUInt32LE(12), triangles = [];
  const indices = index => {
    const accessor=data.accessors[index], view=data.bufferViews[accessor.bufferView], size=accessor.componentType===5125?4:2;
    const offset=binaryOffset+(view.byteOffset??0)+(accessor.byteOffset??0);
    return Array.from({length:accessor.count},(_,i)=>size===4?bytes.readUInt32LE(offset+i*size):bytes.readUInt16LE(offset+i*size));
  };
  for (const node of data.nodes) {
    if (node.mesh===undefined || ['picking_proxy','fan_rotor','selection_accent'].includes(node.extras?.gnRole)) continue;
    for (const primitive of data.meshes[node.mesh].primitives) {
      const points=floatAttribute(primitive.attributes.POSITION,3).map(p=>new Vector3(...p.map((v,k)=>v+(node.translation?.[k]??0))));
      const ii=indices(primitive.indices);
      for(let i=0;i<ii.length;i+=3)triangles.push({node:node.name,points:[points[ii[i]],points[ii[i+1]],points[ii[i+2]]]});
    }
  }
  const sampled=[];
  function segmentClear(label,aa,bb) {
    const a=new Vector3(...aa), b=new Vector3(...bb), delta=b.clone().sub(a), length=delta.length();
    const ray=new Ray(a,delta.normalize()), hit=new Vector3();
    for(const tri of triangles) {
      if(ray.intersectTriangle(...tri.points,false,hit)) {
        const distance=hit.distanceTo(a);
        if(distance>.005 && distance<length-.005)throw new Error(`Blocked authored air passage ${label}: ${tri.node} at ${hit.toArray().join(',')}`);
      }
    }
    sampled.push({label,from:aa,to:bb});
  }
  for(const passage of topology.ecosystem.passages.filter(p=>p.medium==='air')) {
    for(let i=1;i<passage.path.length;i++)segmentClear(passage.id,passage.path[i-1],passage.path[i]);
  }
  for(const route of topology.routes.filter(p=>p.medium==='air')) {
    for(let i=1;i<route.path.length;i++)segmentClear(route.id,route.path[i-1],route.path[i]);
  }
  return { method:'Two-sided ray/triangle intersection against all stationary opaque visible meshes; no inference from authoring success flags. Moving rotor surfaces and raised accent inlays are excluded.', segmentCount:sampled.length,samples:sampled,result:'passed' };
}
