import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

// Palette revisions are release contracts. Reading the mutable scene palette
// would invalidate an immutable older release whenever authoring moves on.
const PALETTES = {
  'industrial-softbox-v2': { Graphite:'#242424', Steel:'#585858', Trim:'#808080', Dark:'#101010', Copper:'#d99a58', Amber:'#ffb35b', Platform:'#292929', Grille:'#303030' },
  'industrial-night-v1': { Graphite:'#292929', Steel:'#616161', Trim:'#7b7b7b', Dark:'#101010', Copper:'#d99a58', Amber:'#ffb35b', Platform:'#292929', Grille:'#383838' },
  'industrial-night-v2': { Graphite:'#292929', Steel:'#616161', Trim:'#7b7b7b', Dark:'#101010', Copper:'#d99a58', Amber:'#ffb35b', Platform:'#292929', Grille:'#383838' },
  'industrial-night-v3': { Graphite:'#292929', Steel:'#616161', Trim:'#7b7b7b', Dark:'#101010', Copper:'#d99a58', Amber:'#ffb35b', Platform:'#292929', Grille:'#383838' },
};

export function authoredSurfacePalette(assetPath, bytes) {
  const manifestPath = join(dirname(assetPath), 'manifest.json');
  let profile;
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const file = manifest.files?.find(file => file.file === basename(assetPath));
    if (!file || file.bytes !== bytes.length || file.sha256 !== createHash('sha256').update(bytes).digest('hex')) throw new Error('Surface palette manifest asset mismatch');
    profile = manifest.profile;
  } else {
    // Direct authoring validation happens before staging creates a manifest.
    profile = JSON.parse(readFileSync(new URL('./render-profile.json', import.meta.url), 'utf8'));
  }
  const palette = PALETTES[profile.lighting?.environment?.preset];
  if (!palette) throw new Error('Unsupported authored surface palette revision');
  return palette;
}

export function validateMaterialPalette(materials, palette) {
  const linear=value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4;
  for (const material of materials) {
    const hex=palette[material.name];
    if (!hex) throw new Error('Unknown authored palette material');
    const expected=[1,3,5].map(i=>linear(parseInt(hex.slice(i,i+2),16)/255));
    const factor=material.pbrMetallicRoughness?.baseColorFactor;
    if (!Array.isArray(factor)||!expected.every((v,i)=>Math.abs(v-factor[i])<1e-6)||factor[3]!==1) throw new Error('Authored linear palette factor lost: '+material.name);
  }
}

/** Actual embedded image, PBR, UV, tangent and rotor checks for semantic v5 assets. */
export function validateSurfaces({ bytes, data, floatAttribute, kind = 'overview', assetPath }) {
  const assert=(value,message)=>{if(!value)throw new Error(message);};
  if(!data.materials.some(m=>m.extras?.gnSurfaceRole))return null;
  const start=28+bytes.readUInt32LE(12);
  const roles=new Set(['powder-coat','bare-metal','polymer','rubber','copper','grille','platform','label','indicator']);
  const mipBytes=(w,h)=>{let n=0;for(;;){n+=w*h*4;if(w===1&&h===1)return n;w=Math.max(1,w>>1);h=Math.max(1,h>>1);}};
  assert(data.images.length===3 && data.textures.length===3,'V5 requires three shared PNG atlases');
  const textures=data.images.map(image=>{
    assert(image.mimeType==='image/png'&&image.bufferView!==undefined&&!image.uri,'Embedded PNG required');
    const v=data.bufferViews[image.bufferView],off=start+(v.byteOffset??0);
    assert(v.byteLength>=33&&off>=start&&off+v.byteLength<=bytes.length,'PNG bufferView bounds invalid');
    const b=bytes.subarray(off,off+v.byteLength);
    assert(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'PNG signature');
    const width=b.readUInt32BE(16),height=b.readUInt32BE(20);
    assert((width===512&&height===512)||(width===256&&height===256),'Atlas dimensions');
    if(width===256)assert(v.byteLength<=24576&&b[25]===6,'Color atlas must be RGBA ≤24KiB');
    return {width,height,encodedBytes:v.byteLength,sha256:createHash('sha256').update(b).digest('hex'),rgbaBytesWithMipmaps:mipBytes(width,height)};
  });
  assert(textures.filter(t=>t.width===512).length===2&&textures.filter(t=>t.width===256).length===1,'Two 512 and one 256 atlas required');
  const imageFor=texture=>textures[data.textures[texture.index].source];
  validateMaterialPalette(data.materials, authoredSurfacePalette(assetPath, bytes));
  let maskCount=0;
  for(const m of data.materials){
    const role=m.extras?.gnSurfaceRole,pbr=m.pbrMetallicRoughness;
    assert(roles.has(role),'Missing/unknown surface role');
    assert(m.doubleSided!==true,'V5 uses front-sided geometry');
    assert(pbr?.metallicRoughnessTexture&&m.occlusionTexture&&pbr.baseColorTexture,'Missing v5 atlas bindings');
    assert(m.occlusionTexture.index===pbr.metallicRoughnessTexture.index,'ORM must share texture descriptor');
    assert((pbr.roughnessFactor??1)===1&&(pbr.metallicFactor??1)===1,'Final mapped roughness/metalness require factor 1');
    assert(imageFor(pbr.metallicRoughnessTexture).width===512&&imageFor(pbr.baseColorTexture).width===256,'Wrong atlas binding');
    if(m.normalTexture){assert(role==='grille'&&m.normalTexture.scale>0&&m.normalTexture.scale<=.5,'Only restrained grille normals');assert(imageFor(m.normalTexture).width===512,'Normal atlas dimension');}
    assert(!m.alphaMode||m.alphaMode==='OPAQUE'||(kind==='rack'&&m.alphaMode==='MASK'),'Only rack may use MASK');
    if(m.alphaMode==='MASK'){
      maskCount++;
      assert(role==='grille'&&m.alphaCutoff===.5&&m.extras.gnCutoutMinFeatureTexels>=1&&m.extras.gnCutoutMinFeatureTexels<=16,'Invalid cutout feature/cutoff');
    }
  }
  assert(maskCount===(kind==='rack'?1:0),'Incorrect masked material count');
  let checkedUVs=0,paintVertices=0,paintUVPairs=new Set(),tangentBytes=0,checkedTangents=0,maxTangentDot=0,normalPrimitives=0;
  const indexValues=index=>{
    const a=data.accessors[index],v=data.bufferViews[a.bufferView],size={5121:1,5123:2,5125:4}[a.componentType];
    assert(size,'Index component type');const off=start+(v.byteOffset??0)+(a.byteOffset??0);
    return Array.from({length:a.count},(_,i)=>size===1?bytes.readUInt8(off+i):size===2?bytes.readUInt16LE(off+i*2):bytes.readUInt32LE(off+i*4));
  };
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
  const sub=(a,b)=>a.map((v,i)=>v-b[i]);
  for(const mesh of data.meshes)for(const p of mesh.primitives){
    const m=data.materials[p.material],a=p.attributes;
    assert(a.TEXCOORD_0!==undefined,'Every primitive requires UV0');
    const uv=floatAttribute(a.TEXCOORD_0,2);
    assert(uv.every(v=>v.every(c=>Number.isFinite(c)&&c>=0&&c<=1)),'Finite normalized UV0');checkedUVs+=uv.length;
    if(m.extras.gnSurfaceRole==='powder-coat'){paintVertices+=uv.length;for(const v of uv)paintUVPairs.add(v.map(x=>x.toFixed(6)).join(','));}
    if(m.normalTexture){
      normalPrimitives++;assert(a.TANGENT!==undefined,'Authored planar normal receiver must carry basis');
      const ts=floatAttribute(a.TANGENT,4),ns=floatAttribute(a.NORMAL,3),pos=floatAttribute(a.POSITION,3),ii=indexValues(p.indices);
      tangentBytes+=ts.length*16;
      ts.forEach((t,i)=>{const d=Math.abs(dot(t.slice(0,3),ns[i]));maxTangentDot=Math.max(maxTangentDot,d);assert(Math.abs(Math.hypot(...t.slice(0,3))-1)<.002&&d<.002&&Math.abs(t[3])===1,'Invalid tangent basis');checkedTangents++;});
      for(let k=0;k<ii.length;k+=3){
        const [ia,ib,ic]=ii.slice(k,k+3),e1=sub(pos[ib],pos[ia]),e2=sub(pos[ic],pos[ia]),u1=sub(uv[ib],uv[ia]),u2=sub(uv[ic],uv[ia]);
        const det=u1[0]*u2[1]-u1[1]*u2[0];assert(Math.abs(det)>1e-12,'Degenerate normal receiver UV');
        const bt=e2.map((v,j)=>(v*u1[0]-e1[j]*u2[0])/det);
        assert(dot(cross(ns[ia],ts[ia].slice(0,3)),bt)*ts[ia][3]>0,'Tangent handedness disagrees with UV seam');
      }
    }else assert(a.TANGENT===undefined,'Non-normal surfaces must not allocate tangents');
  }
  assert(paintVertices>0&&paintUVPairs.size>30,'Paint faces need actual UV coverage, not constant samples');
  const rotors=[];
  for(const node of data.nodes.filter(n=>n.extras?.gnRole==='fan_rotor')){
    let volume=0,topNormal=0,topArea=0;
    for(const p of data.meshes[node.mesh].primitives){
      const pos=floatAttribute(p.attributes.POSITION,3),ii=indexValues(p.indices);
      for(let k=0;k<ii.length;k+=3){const [a,b,c]=ii.slice(k,k+3).map(i=>pos[i]);const normal=cross(sub(b,a),sub(c,a));volume+=dot(a,cross(b,c))/6;if((a[1]+b[1]+c[1])/3>.009){topNormal+=normal[1];topArea+=Math.hypot(...normal);}}
    }
    assert(volume>0&&topNormal>0,'Rotor winding must point outwards and upward on upper skin');
    rotors.push({id:node.extras.gnId,signedVolume:volume,upperSkinAreaNormalY:topNormal,upperSkinArea:topArea});
  }
  const textureBytesRgbaWithMipmaps=textures.reduce((s,t)=>s+t.rgbaBytesWithMipmaps,0);
  assert(textureBytesRgbaWithMipmaps<=3145728,'V5 texture allocation ceiling');
  return {pipeline:'pbr-semantic-v2',textures,textureBytesRgbaWithMipmaps,maskCount,checkedUVs,paintVertices,uniquePaintUVPairs:paintUVPairs.size,normalPrimitives,checkedTangents,tangentBytes,maxTangentDot,rotors};
}
