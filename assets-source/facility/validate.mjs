/** Validate real GLB bytes, Khronos conformance, and the product asset contract. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { resolve, dirname } from 'node:path';
import { validateBytes } from 'gltf-validator';
import { validateSurfaces } from './validate-surfaces.mjs';
import { validateAirConstruction } from './validate-air.mjs';

const path = resolve(process.argv[2] ?? 'build/facility/facility.glb');
const bytes = await readFile(path);
const assert = (test, message) => { if (!test) throw new Error(message); };
assert(bytes.readUInt32LE(0) === 0x46546c67 && bytes.readUInt32LE(4) === 2, 'GLB 2 header required');
assert(bytes.readUInt32LE(8) === bytes.length, 'Declared byte length differs');
assert(bytes.length <= 2_500_000, 'Decoded GLB budget exceeded');
const jsonLength = bytes.readUInt32LE(12);
const data = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
const binaryOffset = 28 + jsonLength;
const floatAttribute = (index, arity) => {
  const accessor = data.accessors[index], view = data.bufferViews[accessor.bufferView];
  assert(accessor.componentType === 5126, 'Expected inspectable float vertex attributes');
  const offset = binaryOffset + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  return Array.from({ length: accessor.count }, (_, i) => Array.from({ length: arity }, (_, k) => bytes.readFloatLE(offset + i * (view.byteStride ?? arity * 4) + k * 4)));
};
const nodeById = new Map();
const parentOf = new Map();
data.nodes.forEach((node, index) => {
  if (node.extras?.gnId) {
    assert(!nodeById.has(node.extras.gnId), `Duplicate identity ${node.extras.gnId}`);
    nodeById.set(node.extras.gnId, { node, index });
  }
  for (const child of node.children ?? []) {
    assert(!parentOf.has(child), 'Multiple parents');
    parentOf.set(child, index);
  }
});
const descendantOf = (child, ancestor) => {
  let index = nodeById.get(child)?.index;
  const target = nodeById.get(ancestor)?.index;
  const visited = new Set();
  while (index !== undefined && !visited.has(index)) {
    if (index === target) return true;
    visited.add(index);
    index = parentOf.get(index);
  }
  return false;
};
if (nodeById.has('GN_SPECIMEN_ROOT')) {
  const { validateSpecimen } = await import('./validate-specimen.mjs');
  await validateSpecimen({ bytes, data, nodeById, parentOf, floatAttribute, path });
  process.exit(0);
}
const root = nodeById.get('GN_EXPORT');
assert(root && !parentOf.has(root.index), 'Missing independent GN_EXPORT');
assert(!root.node.translation && !root.node.rotation && !root.node.scale && !root.node.matrix,
  'Root must export identity transform');
const topologyRaw = root.node.extras?.gnTopology;
const topology = topologyRaw ? typeof topologyRaw === 'string' ? JSON.parse(topologyRaw) : topologyRaw : null;
const topologyChecks = topology ? { equipmentCount: topology.equipment.length, portCount: topology.ports.length, routeCount: topology.routes.length, internalLinkCount: topology.internalLinks.length, routeVertexCount: 0, equipmentVertexCount: 0 } : null;
const routeCoverage = new Map();
if (topology) {
  assert(['facility-topology.v1', 'facility-topology.v2'].includes(topology.schemaVersion), 'Topology version');
  const ids = new Set(topology.equipment.map(item => item.id));
  assert(ids.size === topology.equipment.length && topology.equipment.every((item, i) => item.index === i), 'Dense unique equipment identities');
  const ports = new Map(topology.ports.map(port => [port.id, port]));
  assert(ports.size === topology.ports.length && topology.ports.every(port => ids.has(port.equipmentId) && port.position.length === 3 && port.position.every(Number.isFinite)), 'Invalid equipment port');
  assert(new Set(topology.routes.map(route => route.id)).size === topology.routes.length, 'Unique route identities');
  for (const [index, route] of topology.routes.entries()) {
    assert(route.index === index && ports.has(route.from) && ports.has(route.to), 'Invalid route index or port');
    assert(route.path.length >= 2 && route.path.every(point => point.length === 3 && point.every(Number.isFinite)), 'Finite rendered route path');
    const length = route.path.slice(1).reduce((sum, point, i) => sum + Math.hypot(...point.map((v, k) => v - route.path[i][k])), 0);
    assert(Math.abs(length - route.lengthMetres) < .0001, 'Rendered centerline length differs');
    for (const [point, portId] of [[route.path[0], route.from], [route.path.at(-1), route.to]]) assert(Math.hypot(...point.map((v, k) => v - ports.get(portId).position[k])) <= .001, 'Route does not terminate at authored port');
    assert(ports.get(route.from).service === route.service && ports.get(route.to).service === route.service, 'Route service mismatch');
    routeCoverage.set(index, { min: Infinity, max: -Infinity });
  }
  for (const link of topology.internalLinks) {
    assert(ports.has(link.from) && ports.has(link.to), 'Invalid internal connection');
    assert(ports.get(link.from).equipmentId === ports.get(link.to).equipmentId && ports.get(link.from).service === ports.get(link.to).service, 'Internal links must connect the same authored service component');
  }
  if (topology.schemaVersion === 'facility-topology.v2') {
    const { ecosystem } = topology;
    assert(ecosystem && topology.equipment.length <= 96 && topology.routes.length <= 128, 'Bounded v6 ecosystem identities');
    assert(topology.ports.every(p => ['electrical', 'air', 'water', 'reserve-illustrative'].includes(p.medium)), 'Every v6 port needs a medium');
    const routeMap = new Map(topology.routes.map(r => [r.id, r]));
    const positionAt = (route, ratio) => {
      let remaining = ratio * route.lengthMetres;
      for (let i = 1; i < route.path.length; i++) {
        const a = route.path[i - 1], b = route.path[i], length = Math.hypot(...a.map((n, k) => n - b[k]));
        if (remaining <= length + .000001) return a.map((n, k) => n + (b[k] - n) * remaining / length);
        remaining -= length;
      }
      return route.path.at(-1);
    };
    for (const route of topology.routes) assert(route.medium === ports.get(route.from).medium && route.medium === ports.get(route.to).medium, 'Route cross-medium contamination');
    for (const branch of ecosystem.branches) {
      const route = routeMap.get(branch.routeId), port = ports.get(branch.portId);
      assert(route && port && branch.s >= 0 && branch.s <= 1, 'Invalid branch');
      const point = positionAt(route, branch.s);
      assert(Math.hypot(...point.map((n, k) => n - port.position[k])) < .001, `Branch ${branch.portId} does not meet its rendered route`);
    }
    const passages = new Map(ecosystem.passages.map(p => [p.id, p]));
    for (const passage of ecosystem.passages) {
      const a = ports.get(passage.from), b = ports.get(passage.to);
      assert(a && b && a.equipmentId === passage.equipmentId && b.equipmentId === passage.equipmentId, 'Passage equipment mismatch');
      assert(a.medium === passage.medium && b.medium === passage.medium, 'Passage cross-medium contamination');
      for (const [point, port] of [[passage.path[0], a], [passage.path.at(-1), b]]) assert(Math.hypot(...point.map((n, k) => n - port.position[k])) < .001, 'Internal passage termination mismatch');
    }
    for (const coupling of ecosystem.thermalCouplings) assert(passages.get(coupling.airPassage)?.medium === 'air' && passages.get(coupling.waterPassage)?.medium === 'water', 'Thermal exchange is a relationship between distinct fluid passages');
    for (const room of ecosystem.openAirDomains) assert([...room.outlets, ...room.inlets].every(id => ports.get(id)?.medium === 'air'), 'Open room must contain only air endpoints');
    assert(ecosystem.racks.length === 12 && new Set(ecosystem.racks.flatMap(r => r.ledIndices)).size === 48, 'All rack LEDs are mapped exactly once');
    for (const rack of ecosystem.racks) for (const key of ['electrical', 'exhaust', 'coolingSupply', 'coolingReturn']) {
      const segments = rack[key]; let previous;
      assert(segments.length > 0, 'Empty rack itinerary');
      for (const segment of segments) {
        const route = routeMap.get(segment.routeId);
        assert(route && segment.fromS >= 0 && segment.fromS <= 1 && segment.toS >= 0 && segment.toS <= 1, 'Invalid trace subrange');
        const start = positionAt(route, segment.fromS), end = positionAt(route, segment.toS);
        if (previous) assert(Math.hypot(...start.map((n, k) => n - previous[k])) < .01, `${rack.equipmentId} ${key} has a discontinuity`);
        previous = end;
      }
    }
    assert(ecosystem.sections.length === 1 && ecosystem.sections[0].coverIds[0] === 'GN_AIR_SECTION_COVERS', 'Section cover identity');
    assert(nodeById.has('GN_AIR_SECTION_COVERS') && descendantOf('GN_AIR_SECTION_COVERS', 'GN_COOLING'), 'Section covers need a stable cooling root');
    topologyChecks.ecosystem = { branches: ecosystem.branches.length, passages: ecosystem.passages.length, racks: ecosystem.racks.length, thermalCouplings: ecosystem.thermalCouplings.length, exactItineraries: true, mediaSeparated: true };
  }
}
assert(nodeById.has('GN_PLATFORM'), 'Missing visible platform');
for (const key of ['POWER', 'COOLING', 'STORAGE', 'WORKLOADS']) {
  for (const id of [`GN_${key}`, `GN_ACCENT_${key}`, `GN_PICK_${key}`]) {
    assert(nodeById.has(id) && descendantOf(id, 'GN_EXPORT'), `${id} missing or outside export root`);
  }
  assert(descendantOf(`GN_ACCENT_${key}`, `GN_${key}`), `${key} accent ancestry`);
  const proxy = nodeById.get(`GN_PICK_${key}`).node;
  assert(proxy.mesh !== undefined && proxy.extras.gnRole === 'picking_proxy', `${key} proxy contract`);
  assert(descendantOf(`GN_PICK_${key}`, `GN_${key}`), `${key} proxy ancestry`);
}
for (let i = 0; i < 48; i++) {
  const id = `GN_LED_${String(i).padStart(2, '0')}`;
  const node = nodeById.get(id)?.node;
  assert(node && node.mesh === undefined && node.extras.gnRole === 'activity_led', `${id} missing empty anchor`);
  assert(!node.rotation && !node.scale, `${id} front-facing transform`);
  assert(descendantOf(id, 'GN_WORKLOADS'), `${id} outside workloads`);
  assert(node.translation?.every(Number.isFinite), `${id} invalid position`);
}
const fans = [];
for (let i = 0; i < 4; i++) {
  const id = `GN_FAN_ROTOR_${String(i).padStart(2, '0')}`;
  const node = nodeById.get(id)?.node;
  assert(node && node.mesh !== undefined && node.extras.gnRole === 'fan_rotor', `${id} missing rotor`);
  assert(descendantOf(id, 'GN_COOLING') && !node.rotation && !node.scale, `${id} invalid ancestry or rest transform`);
  const accessor = data.accessors[data.meshes[node.mesh].primitives[0].attributes.POSITION];
  const size = accessor.max.map((v, k) => v - accessor.min[k]);
  assert(size[1] < .07 && size[0] > .6 && size[2] > .6, `${id} must have local Y shaft`);
  assert(Math.abs((accessor.min[0] + accessor.max[0]) / 2) < .035 &&
    Math.abs((accessor.min[2] + accessor.max[2]) / 2) < .035, `${id} off-center shaft`);
  fans.push({ gnId: id, axisLocal: [0, 1, 0], shaftVerifiedFromGeometry: true });
}
let triangles = 0;
let drawCalls = 0;
let geometryBytes = 0;
const usedViews = new Set();
const materials = new Set();
let checkedNormals = 0, checkedUVs = 0, verticesWithUVSeams = 0, maxNormalLengthError = 0;
for (const node of data.nodes) {
  if (node.mesh === undefined || node.extras?.gnRole === 'picking_proxy') continue;
  for (const primitive of data.meshes[node.mesh].primitives) {
    assert((primitive.mode ?? 4) === 4, 'Only triangle primitives are supported');
    drawCalls++;
    materials.add(primitive.material);
    const normals = floatAttribute(primitive.attributes.NORMAL, 3);
    if (topology) {
      assert(primitive.attributes._GN_EQUIPMENT_ID !== undefined, 'Missing equipment vertex identity');
      const equipmentIds = floatAttribute(primitive.attributes._GN_EQUIPMENT_ID, 1).flat();
      assert(equipmentIds.every(id => Number.isInteger(id) && id >= -1 && id < topology.equipment.length), 'Invalid equipment vertex identity');
      topologyChecks.equipmentVertexCount += equipmentIds.filter(id => id >= 0).length;
      if (primitive.attributes._GN_ROUTE_ID !== undefined) {
        assert(primitive.attributes._GN_ROUTE_S !== undefined, 'Route distance missing');
        const routeIds = floatAttribute(primitive.attributes._GN_ROUTE_ID, 1).flat();
        const distances = floatAttribute(primitive.attributes._GN_ROUTE_S, 1).flat();
        for (let i = 0; i < routeIds.length; i++) {
          const id = routeIds[i], distance = distances[i];
          assert(Number.isInteger(id) && id >= -1 && id < topology.routes.length, 'Invalid route vertex identity');
          if (id < 0) { assert(distance === -1, 'Nonroute sentinel'); continue; }
          assert(distance >= 0 && distance <= 1, 'Normalized authored route distance required');
          assert(topology.routes[id].system === node.extras.gnDomain, 'Route attribute/system mismatch');
          const coverage = routeCoverage.get(id); coverage.min = Math.min(coverage.min, distance); coverage.max = Math.max(coverage.max, distance);
          topologyChecks.routeVertexCount++;
        }
      }
    }
    for (const normal of normals) {
      assert(normal.every(Number.isFinite), 'Nonfinite exported corner normal');
      const error = Math.abs(Math.hypot(...normal) - 1);
      assert(error < .002, 'Nonunit exported corner normal');
      maxNormalLengthError = Math.max(maxNormalLengthError, error);
      checkedNormals++;
    }
    if (data.materials[primitive.material].normalTexture) {
      assert(primitive.attributes.TEXCOORD_0 !== undefined, 'Baked material requires explicit UV corners');
      const uvs = floatAttribute(primitive.attributes.TEXCOORD_0, 2);
      const positions = floatAttribute(primitive.attributes.POSITION, 3);
      const atPosition = new Map();
      uvs.forEach((uv, index) => {
        assert(uv.every(value => Number.isFinite(value) && value >= 0 && value <= 1), 'Invalid surface atlas UV');
        const key = positions[index].map(value => value.toFixed(5)).join(',');
        if (!atPosition.has(key)) atPosition.set(key, new Set());
        atPosition.get(key).add(uv.map(value => value.toFixed(6)).join(','));
        checkedUVs++;
      });
      verticesWithUVSeams += [...atPosition.values()].filter(values => values.size > 1).length;
    }
    triangles += data.accessors[primitive.indices].count / 3;
    for (const index of [...Object.values(primitive.attributes), primitive.indices]) {
      usedViews.add(data.accessors[index].bufferView);
    }
  }
}
for (const index of usedViews) geometryBytes += data.bufferViews[index].byteLength;
if (topology) for (const [index, coverage] of routeCoverage) assert(coverage.min <= .001 && coverage.max >= .999, `Route ${index} not represented end to end on rendered accents`);
assert(triangles <= 60_000, 'Rendered triangle target exceeded');
assert(drawCalls + 1 <= 40, 'Still draw budget, including LED batch, exceeded');
assert(materials.size + 2 <= 10, 'Material budget including shared accent and LED exceeded');
assert(!data.animations?.length, 'Authored animation clips must not be exported');
assert(!data.extensionsUsed?.length, 'External decoder/extension dependency not permitted');
assert(data.buffers.every((buffer) => !buffer.uri), 'External buffers are prohibited');
assert(data.images.every((image) => image.bufferView !== undefined && !image.uri), 'Embed atlas image');
const usesBakedSurfaces = data.materials.some(material => material.normalTexture);
const semanticSurfaces = validateSurfaces({ bytes, data, floatAttribute, assetPath: path });
if (semanticSurfaces) assert(drawCalls + 1 <= 39, 'V5 overview draw-call ceiling exceeded');
if (usesBakedSurfaces && !semanticSurfaces) {
  assert(data.textures.length === 2 && data.images.length === 2, 'V3 surface images and texture descriptors must be shared');
  for (const material of data.materials) {
    assert(material.normalTexture && material.occlusionTexture && material.pbrMetallicRoughness?.metallicRoughnessTexture, 'Incomplete normal/ORM material binding');
    assert(material.occlusionTexture.index === material.pbrMetallicRoughness.metallicRoughnessTexture.index, 'AO/roughness/metallic must share the ORM texture');
  }
  assert(verticesWithUVSeams > 0, 'Atlas seam vertices were lost');
}
const airConstruction = validateAirConstruction({ bytes, data, topology, floatAttribute });
const validation = await validateBytes(new Uint8Array(bytes), {
  uri: path,
  maxIssues: 100,
  externalResourceFunction: async () => { throw new Error('External resource requested'); },
});
const textures = data.images.map(image => {
  const view = data.bufferViews[image.bufferView];
  const offset = 28 + jsonLength + (view.byteOffset ?? 0);
  assert(view.byteLength >= 33 && offset + view.byteLength <= bytes.length, 'Image bufferView bounds');
  const imageBytes = bytes.subarray(offset, offset + view.byteLength);
  assert(image.mimeType === 'image/png', 'Use inspectable PNG source atlases');
  const width = imageBytes.readUInt32BE(16);
  const height = imageBytes.readUInt32BE(20);
  const exact = semanticSurfaces?.textures.find(item => item.width === width && item.height === height);
  return { width, height, rgbaBytesWithMipmaps: exact?.rgbaBytesWithMipmaps ?? Math.ceil(width * height * 4 * 4 / 3) };
});
assert(geometryBytes + textures.reduce((sum, image) => sum + image.rgbaBytesWithMipmaps, 0) <= 32 * 1024 * 1024,
  'Estimated geometry and texture allocation exceeds 32 MiB');
const report = {
  schemaVersion: 1,
  glb: path,
  sha256: createHash('sha256').update(bytes).digest('hex'),
  byteLength: bytes.length,
  gzipBytes: gzipSync(bytes, { level: 9 }).length,
  gzipLevel: 9,
  brotliBytes: brotliCompressSync(bytes).length,
  triangles,
  staticDrawCallsIncludingLedBatch: drawCalls + 1,
  authoredMaterials: materials.size,
  expectedRuntimeMaterials: materials.size + (semanticSurfaces ? 1 : 2),
  geometryBytes,
  textureBytesRgbaWithMipmaps: textures.reduce((sum, image) => sum + image.rgbaBytesWithMipmaps, 0),
  textures,
  semanticIdentityCount: nodeById.size,
  surfaceAttributes: { checkedNormals, maxNormalLengthError, checkedUVs, verticesWithUVSeams, usesBakedSurfaces, sharedTextureDescriptors: data.textures.length },
  semanticSurfaces,
  fans,
  topologyChecks,
  airConstruction,
  khronos: validation,
};
const reportPath = resolve(process.argv[3] ?? resolve(dirname(path), 'validation.json'));
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
assert(validation.issues.numErrors === 0, `Khronos validation found ${validation.issues.numErrors} errors`);
console.log(JSON.stringify({ ...report, khronos: validation.issues }, null, 2));
