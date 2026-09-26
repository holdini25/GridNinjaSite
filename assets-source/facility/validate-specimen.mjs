import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { validateBytes } from 'gltf-validator';
import { validateSurfaces } from './validate-surfaces.mjs';

/** Validate actual exported construction, not the generator's success flag. */
export async function validateSpecimen({ bytes, data, nodeById, parentOf, floatAttribute, path }) {
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const root = nodeById.get('GN_SPECIMEN_ROOT');
  assert(root && !parentOf.has(root.index), 'Specimen root must be independent');
  assert(!root.node.translation && !root.node.rotation && !root.node.scale && !root.node.matrix, 'Specimen root must be identity');
  const raw = root.node.extras.gnSpecimen;
  const metadata = typeof raw === 'string' ? JSON.parse(raw) : raw;
  assert(metadata.schemaVersion === 'facility-specimen.v1' && ['rack', 'cooling'].includes(metadata.kind), 'Specimen metadata version/kind');
  assert(metadata.parts.length === 6 && new Set(metadata.parts.map(p => p.id)).size === 6, 'Six distinct parts required');
  assert(bytes.length <= 1_000_000, 'Specimen GLB exceeds 1 MB');
  const partIds = new Set(metadata.parts.map(p => p.objectId));
  const descendants = (index, ancestor) => {
    for (let current = index; current !== undefined; current = parentOf.get(current)) if (current === ancestor) return true;
    return false;
  };
  const finiteVector = value => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
  let triangles = 0, draws = 0, geometryBytes = 0, checkedNormals = 0;
  const usedViews = new Set(), materials = new Set();
  const triangleSets = new Map(metadata.parts.map(part => [part.objectId, []]));
  const jsonLength = bytes.readUInt32LE(12), binaryOffset = 28 + jsonLength;
  const indices = index => {
    const accessor = data.accessors[index], view = data.bufferViews[accessor.bufferView];
    const size = accessor.componentType === 5125 ? 4 : 2;
    const start = binaryOffset + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    return Array.from({ length: accessor.count }, (_, i) => size === 4 ? bytes.readUInt32LE(start + i * size) : bytes.readUInt16LE(start + i * size));
  };
  for (const [nodeIndex, node] of data.nodes.entries()) {
    if (node.mesh === undefined) continue;
    assert(descendants(nodeIndex, root.index), 'Mesh outside specimen root');
    const part = metadata.parts.find(p => descendants(nodeIndex, nodeById.get(p.objectId)?.index));
    assert(part, 'Every specimen mesh must belong to an authored part');
    for (const primitive of data.meshes[node.mesh].primitives) {
      draws++; materials.add(primitive.material);
      const pos = floatAttribute(primitive.attributes.POSITION, 3);
      const normals = floatAttribute(primitive.attributes.NORMAL, 3);
      assert(normals.every(normal => normal.every(Number.isFinite) && Math.abs(Math.hypot(...normal) - 1) < .002), 'Invalid specimen corner normals');
      checkedNormals += normals.length;
      assert(primitive.attributes._GN_EQUIPMENT_ID !== undefined, 'Missing specimen part-selection attribute');
      const equipment = floatAttribute(primitive.attributes._GN_EQUIPMENT_ID, 1).flat();
      assert(equipment.every(value => value === part.index), 'Part index disagrees with ancestry');
      const ii = indices(primitive.indices);
      triangles += ii.length / 3;
      for (const accessor of [...Object.values(primitive.attributes), primitive.indices]) usedViews.add(data.accessors[accessor].bufferView);
      // Articulated door roots carry their authored hinge translation. Include
      // every ancestor so bounds describe the closed world-space assembly.
      const translation = [0, 0, 0];
      for (let current = nodeIndex; current !== undefined; current = parentOf.get(current)) {
        const ancestor = data.nodes[current];
        assert(!ancestor.rotation && !ancestor.scale && !ancestor.matrix, 'Unexpected closed specimen transform');
        for (let k = 0; k < 3; k++) translation[k] += ancestor.translation?.[k] ?? 0;
      }
      const translated = pos.map(point => point.map((v, k) => v + translation[k]));
      for (let i = 0; i < ii.length; i += 3) triangleSets.get(part.objectId).push(ii.slice(i, i + 3).map(index => translated[index]));
    }
  }
  for (const view of usedViews) geometryBytes += data.bufferViews[view].byteLength;
  for (const [index, part] of metadata.parts.entries()) {
    assert(part.index === index && nodeById.has(part.objectId), 'Dense part indices and stable identities required');
    assert(descendants(nodeById.get(part.objectId).index, root.index), 'Part outside root');
    assert(part.connections.every(id => partIds.has(id)), 'Unknown connected part');
    assert(finiteVector(part.bounds.min) && finiteVector(part.bounds.max), 'Nonfinite part bounds');
    const points = triangleSets.get(part.objectId).flat();
    assert(points.length > 0, 'Empty specimen part');
    for (const point of points) for (let k = 0; k < 3; k++) assert(point[k] >= part.bounds.min[k] - .01 && point[k] <= part.bounds.max[k] + .01, 'Part geometry outside authored bounds');
  }
  for (const pose of ['closed', 'cutaway', 'service']) {
    const definition = metadata.poses[pose];
    assert(definition && finiteVector(definition.camera.camera) && finiteVector(definition.camera.target) && definition.camera.padding >= 1.1, 'Invalid specimen pose camera');
    assert(definition.transforms.length === 6 && new Set(definition.transforms.map(t => t.id)).size === 6, 'Pose must list every part once');
    for (const transform of definition.transforms) assert(partIds.has(transform.id) && finiteVector(transform.position) && typeof transform.visible === 'boolean', 'Invalid absolute local pose transform');
  }
  assert(metadata.poses.closed.transforms.every(t => t.visible), 'Closed pose must retain all parts');
  assert(metadata.poses.cutaway.transforms.some(t => !t.visible), 'Cutaway must remove a real panel');
  // Ray along +X from a point. An odd number of distinct intersections means
  // solid material. Sample the central plenum/rail space to reject solid cubes.
  const inSolid = (point, triangles) => {
    const hits = [];
    for (const [a, b, c] of triangles) {
      const ay = a[1] - point[1], az = a[2] - point[2];
      const by = b[1] - point[1], bz = b[2] - point[2];
      const cy = c[1] - point[1], cz = c[2] - point[2];
      const d = (by - ay) * (cz - az) - (cy - ay) * (bz - az);
      if (Math.abs(d) < 1e-12) continue;
      const u = (-ay * (cz - az) + az * (cy - ay)) / d;
      const v = (-(by - ay) * az + (bz - az) * ay) / d;
      if (u < -1e-7 || v < -1e-7 || u + v > 1.0000001) continue;
      const x = a[0] + u * (b[0] - a[0]) + v * (c[0] - a[0]);
      if (x > point[0] + 1e-6 && !hits.some(value => Math.abs(value - x) < 1e-5)) hits.push(x);
    }
    return hits.length % 2 === 1;
  };
  const frameId = metadata.kind === 'rack' ? 'GN_RACK_FRAME' : 'GN_COOLER_FRAME';
  const cavitySamples = metadata.kind === 'rack' ? [[0, .5, 0], [0, 1.1, 0], [0, 1.7, 0]] : [[0, 1.7, 0], [.2, 1.8, .1], [-.2, 1.8, .1]];
  assert(cavitySamples.every(point => !inSolid(point, triangleSets.get(frameId))), 'Chassis is solid instead of hollow');
  if (metadata.kind === 'rack') {
    const panel = metadata.parts.find(p => p.id === 'GN_RACK_PANEL');
    assert(panel.bounds.max[0] - panel.bounds.min[0] < .05, 'Rack side panel must have real thin wall geometry');
    const tray = metadata.poses.service.transforms.find(t => t.id === 'GN_RACK_TRAY');
    assert(Math.abs(tray.position[2] - .18) < 1e-6, 'Service tray must extend 180mm');
  } else {
    const rotor = nodeById.get('GN_SPECIMEN_FAN_ROTOR')?.node;
    assert(rotor?.extras.gnRole === 'fan_rotor' && rotor.extras.gnDomain === 'cooling', 'Independent cooling rotor missing');
    const guard = nodeById.get('GN_COOLER_GUARD');
    assert(!descendants(guard.index, nodeById.get('GN_SPECIMEN_FAN_ROTOR').index), 'Fan guard must remain stationary');
  }
  let motionChecks;
  if (metadata.rackMotion) {
    const motion = metadata.rackMotion;
    const quaternion = value => Array.isArray(value) && value.length === 4 && value.every(Number.isFinite) && Math.abs(Math.hypot(...value) - 1) < 1e-6;
    assert(metadata.kind === 'rack' && motion.version === 1, 'Rack motion version/kind');
    assert(motion.door.objectId === 'GN_RACK_DOOR' && motion.tray.objectId === 'GN_RACK_TRAY', 'Rack motion IDs');
    assert(quaternion(motion.door.closed) && quaternion(motion.door.open), 'Rack motion quaternions');
    assert(motion.door.closed.every((value, index) => Math.abs(value - [0,0,0,1][index]) < 1e-7), 'Closed door rotation');
    const angle = 2 * Math.acos(Math.abs(motion.door.open[3]));
    assert(Math.abs(angle - 110 * Math.PI / 180) < 1e-6 && motion.door.open[1] < 0 && Math.abs(motion.door.open[0]) + Math.abs(motion.door.open[2]) < 1e-7, 'Door must swing outward 110 degrees around Y');
    assert(finiteVector(motion.tray.retracted) && finiteVector(motion.tray.extended) && motion.tray.retracted.every(v => v === 0) && motion.tray.extended.every((v, i) => Math.abs(v - [0,0,.18][i]) < 1e-6), 'Tray travel must be 180mm');
    assert(motion.cutawayObjectIds.length === 1 && motion.cutawayObjectIds[0] === 'GN_RACK_PANEL', 'Independent side-panel cutaway');
    const doorNode = nodeById.get(motion.door.objectId), trayNode = nodeById.get(motion.tray.objectId);
    assert(!descendants(doorNode.index, trayNode.index) && !descendants(trayNode.index, doorNode.index), 'Door/tray ancestry');
    assert(finiteVector(doorNode.node.translation) && Math.abs(doorNode.node.translation[0] + .377) < 1e-6 && Math.abs(doorNode.node.translation[2] - .657) < 1e-6, 'Authored hinge shaft translation');
    assert(finiteVector(motion.fitBounds.min) && finiteVector(motion.fitBounds.max), 'Swept fit bounds');
    assert(motion.anchors.length === 2 && new Set(motion.anchors.map(a => a.id)).size === 2 && motion.anchors.every(a => ['door','tray'].includes(a.id) && partIds.has(a.objectId) && finiteVector(a.position)), 'Local projected interaction anchors');
    motionChecks = { authoredHingePosition: doorNode.node.translation, quaternionAngleDegrees: angle * 180 / Math.PI, outward: true, travelMetres: .18, independentCutaway: true, fixedCamera: true };
  }
  const semanticSurfaces = validateSurfaces({bytes,data,floatAttribute,kind:metadata.kind,assetPath:path});
  const textures = (data.images ?? []).map(image => {
    assert(image.mimeType === 'image/png' && image.bufferView !== undefined && !image.uri, 'Embedded PNG atlas required');
    const view = data.bufferViews[image.bufferView], offset = binaryOffset + (view.byteOffset ?? 0);
    assert(view.byteLength >= 33 && offset + view.byteLength <= bytes.length, 'Image bufferView bounds');
    const width = bytes.readUInt32BE(offset + 16), height = bytes.readUInt32BE(offset + 20);
    const exact = semanticSurfaces?.textures.find(item => item.width === width && item.height === height);
    return { width, height, bytes: exact?.rgbaBytesWithMipmaps ?? Math.ceil(width * height * 4 * 4 / 3) };
  });
  const allocation = geometryBytes + textures.reduce((sum, texture) => sum + texture.bytes, 0);
  const actualDraws = draws + (metadata.kind === 'rack' ? 1 : 0);
  assert(triangles <= (metadata.kind === 'rack' ? 24000 : 18000) && actualDraws <= (metadata.kind === 'rack' ? 35 : 30), 'Specimen rendered complexity exceeds budget');
  assert(materials.size + (metadata.kind === 'rack' ? 1 : 0) <= 10 && allocation <= 6 * 1024 * 1024, 'Specimen allocation/material budget exceeded');
  assert(!data.animations?.length && !data.extensionsUsed?.length && data.buffers.every(b => !b.uri), 'Unexpected animation/decoder/resource dependency');
  const validation = await validateBytes(new Uint8Array(bytes), { uri: path, maxIssues: 100, externalResourceFunction: async () => { throw new Error('External resource'); } });
  const report = { schemaVersion: 1, kind: metadata.kind, glb: path, sha256: createHash('sha256').update(bytes).digest('hex'), byteLength: bytes.length, gzipBytes: gzipSync(bytes, { level: 9 }).length, brotliBytes: brotliCompressSync(bytes).length, triangles, staticDrawCallsIncludingLedBatch: actualDraws, authoredMaterials: materials.size, expectedRuntimeMaterials: materials.size + (metadata.kind === 'rack' ? 1 : 0), geometryBytes, textures, estimatedBytes: allocation, semanticIdentityCount: nodeById.size, checkedNormals, semanticSurfaces, constructionChecks: { rayTestedEmptyCavityPoints: cavitySamples, hollowChassis: true, partBoundsContainGeometry: true, allPoseRootsBound: true, ...(motionChecks ? { motion: motionChecks } : {}) }, khronos: validation };
  await writeFile(resolve(process.argv[3] ?? resolve(dirname(path), metadata.kind + '-validation.json')), JSON.stringify(report, null, 2) + '\n');
  assert(validation.issues.numErrors === 0, `Khronos specimen errors: ${validation.issues.numErrors}`);
  console.log(JSON.stringify({ ...report, khronos: validation.issues }, null, 2));
}
