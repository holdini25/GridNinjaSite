/** Regression contract for a single continuous overview rack exhaust shell.
 * CPU only. Full Khronos validation precedes bounded geometry reads.
 * Usage: node scripts/facility/validate-collar-export.mjs <facility.glb> [report.json]
 * Standalone rack specimens intentionally retain their short collar and are
 * unsupported here. A new duct footprint requires a new construction contract.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { validateBytes } from 'gltf-validator';

const contract = 'overview-rack-exhaust-shell.v1';
const args = process.argv.slice(2);
assert(args.length >= 1 && args.length <= 2, 'Usage: validate-collar-export.mjs <facility.glb> [report.json]');
const model = resolve(args[0]), reportPath = args[1] ? resolve(args[1]) : undefined;
if (reportPath) assert(await realpath(model) !== await realpath(reportPath).catch(() => reportPath), 'Report cannot overwrite model');
const bytes = await readFile(model);
const report = { schemaVersion: 'facility-collar-export-report.v1', contract, model,
  sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length,
  expected: { racks: 12, inspectedWallFaces: 96, trianglesPerFace: 2, samplesPerFace: 12 } };

try {
  assert(bytes.length >= 28 && bytes.length <= 2_500_000, 'Overview GLB size');
  assert(bytes.readUInt32LE(0) === 0x46546c67 && bytes.readUInt32LE(4) === 2 && bytes.readUInt32LE(8) === bytes.length, 'GLB header');
  const jsonLength = bytes.readUInt32LE(12), binaryHeader = 20 + jsonLength;
  assert(jsonLength % 4 === 0 && binaryHeader + 8 <= bytes.length && bytes.readUInt32LE(16) === 0x4e4f534a, 'GLB JSON chunk');
  assert(bytes.readUInt32LE(binaryHeader + 4) === 0x004e4942 && binaryHeader + 8 + bytes.readUInt32LE(binaryHeader) === bytes.length, 'GLB BIN chunk');
  const validation = await validateBytes(new Uint8Array(bytes), { maxIssues: 20 });
  assert.equal(validation.issues.numErrors, 0, 'Khronos validation must pass before geometry inspection');
  const data = JSON.parse(bytes.subarray(20, binaryHeader).toString('utf8'));
  assert(!data.extensionsRequired?.length && data.buffers.length === 1 && !data.buffers[0].uri, 'Inspectable embedded geometry required');
  const start = binaryHeader + 8;
  const read = (index, type, componentType) => {
    const a = data.accessors[index];
    assert(a && a.type === type && (!componentType || a.componentType === componentType) && !a.sparse && !a.normalized, 'Accessor contract');
    const v = data.bufferViews[a.bufferView], arity = { SCALAR: 1, VEC3: 3 }[type];
    const size = { 5126: 4, 5125: 4, 5123: 2, 5121: 1 }[a.componentType];
    assert(size && v.buffer === 0, 'Accessor component/buffer');
    const readValue = a.componentType === 5126 ? 'readFloatLE' : a.componentType === 5125 ? 'readUInt32LE' : a.componentType === 5123 ? 'readUInt16LE' : 'readUInt8';
    const stride = v.byteStride ?? arity * size;
    const offset = start + (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
    return Array.from({ length: a.count }, (_, i) => Array.from({ length: arity }, (_, k) => bytes[readValue](offset + i * stride + k * size)));
  };
  const byId = new Map();
  for (const node of data.nodes) {
    if (node.extras?.gnId === undefined) continue;
    const id = node.extras.gnId;
    assert(typeof id === 'string' && id.length > 0 && !byId.has(id), 'Missing/duplicate node semantic identity');
    byId.set(id, node);
  }
  const root = byId.get('GN_EXPORT');
  assert(root && !byId.has('GN_SPECIMEN_ROOT'), 'Only overview assets are supported');
  const topology = JSON.parse(root.extras.gnTopology);
  assert.equal(topology.schemaVersion, 'facility-topology.v2', 'Topology contract');
  assert(Array.isArray(topology.equipment) && topology.equipment.every(e => typeof e.id === 'string' && e.id.length > 0 && Number.isInteger(e.index) && e.index >= 0), 'Missing equipment semantic identity');
  assert(new Set(topology.equipment.map(e => e.id)).size === topology.equipment.length &&
    new Set(topology.equipment.map(e => e.index)).size === topology.equipment.length, 'Duplicate equipment semantic identity/index');
  const racks = topology.equipment.filter(e => /^rack-\d{2}$/.test(e.id));
  assert.equal(racks.length, 12, 'Twelve authored racks required');
  const triangles = new Map(racks.map(e => [e.index, []]));
  const parents = new Map();
  data.nodes.forEach((node, index) => (node.children ?? []).forEach(child => {
    assert(!parents.has(child), 'Multiple parents'); parents.set(child, index);
  }));
  const identityPath = index => {
    const seen = new Set();
    while (index !== undefined) {
      assert(!seen.has(index), 'Cyclic node hierarchy'); seen.add(index);
      const n = data.nodes[index];
      assert(!n.matrix && (!n.translation || n.translation.every(v => v === 0)) &&
        (!n.scale || n.scale.every(v => v === 1)) && (!n.rotation || n.rotation.every((v, i) => v === (i === 3 ? 1 : 0))), 'Identity geometry transforms required');
      index = parents.get(index);
    }
  };
  data.nodes.forEach((node, index) => {
    if (node.extras?.gnRole !== 'equipment_surface' || node.extras?.gnDomain !== 'workloads' || node.mesh === undefined) return;
    identityPath(index);
    for (const primitive of data.meshes[node.mesh].primitives) {
      assert.equal(primitive.mode ?? 4, 4, 'Triangle primitives required');
      const a = primitive.attributes;
      const positions = read(a.POSITION, 'VEC3', 5126), normals = read(a.NORMAL, 'VEC3', 5126);
      const ids = read(a._GN_EQUIPMENT_ID, 'SCALAR', 5126), indices = read(primitive.indices, 'SCALAR').flat();
      for (let i = 0; i < indices.length; i += 3) {
        const ii = indices.slice(i, i + 3), id = ids[ii[0]][0];
        if (!triangles.has(id)) continue;
        assert(ii.every(j => ids[j][0] === id), 'Mixed equipment triangle');
        triangles.get(id).push({ points: ii.map(j => positions[j]), normals: ii.map(j => normals[j]) });
      }
    }
  });
  const insideTriangle = (p, points) => {
    const [a, b, c] = points;
    const cross = (u, v, w) => (v[0] - u[0]) * (w[1] - u[1]) - (v[1] - u[1]) * (w[0] - u[0]);
    const signs = [cross(a, b, p), cross(b, c, p), cross(c, a, p)];
    return signs.every(v => v >= -1e-8) || signs.every(v => v <= 1e-8);
  };
  const issues = [], faces = [];
  for (let i = 0; i < 12; i++) {
    const rack = racks.find(e => e.id === `rack-${String(i).padStart(2, '0')}`);
    assert(rack, 'Contiguous rack identities required');
    const row = i >= 6 ? 1 : 0, x = -2.275 + (i % 6) * .91, z = -([-1.35, .90][row] + .48);
    const floor = 2.915 + row * .12, top = 3.16 + row * .12;
    const route = topology.routes.find(r => r.id === `air-rack-${row}-${i % 6}`);
    assert(route?.medium === 'air' && Math.abs(route.path[0][0] - x) < 1e-6 && Math.abs(route.path[0][1] - floor) < 1e-6 && Math.abs(route.path[0][2] - z) < 1e-6, 'Authored collar origin differs from contract');
    const definitions = [
      ['outer-left', 0, x - .304, -1, z - .12, z + .12], ['inner-left', 0, x - .292, 1, z - .12, z + .12],
      ['outer-right', 0, x + .304, 1, z - .12, z + .12], ['inner-right', 0, x + .292, -1, z - .12, z + .12],
      ['outer-front', 2, z + .12, 1, x - .292, x + .292], ['inner-front', 2, z + .108, -1, x - .292, x + .292],
      ['outer-back', 2, z - .12, -1, x - .292, x + .292], ['inner-back', 2, z - .108, 1, x - .292, x + .292],
    ];
    for (const [name, axis, plane, normal, low, high] of definitions) {
      const tangent = axis === 0 ? 2 : 0;
      const onFace = triangles.get(rack.index).filter(t => t.points.every((p, j) => Math.abs(p[axis] - plane) < 1e-6 &&
        p[1] >= floor - 1e-6 && p[1] <= top + 1e-6 && p[tangent] >= low - 1e-6 && p[tangent] <= high + 1e-6 && t.normals[j][axis] * normal > .999));
      if (onFace.length !== 2) issues.push(`${rack.id}/${name}: ${onFace.length} triangles; expected one two-triangle wall`);
      let sampleCount = 0;
      for (const fraction of [.19, .47, .79]) for (const height of [.037, .101, .167, .217]) {
        const point = [low + (high - low) * fraction, floor + height];
        const hits = onFace.filter(t => insideTriangle(point, t.points.map(p => [p[tangent], p[1]]))).length;
        if (hits !== 1) issues.push(`${rack.id}/${name}: ${hits} wall layers at ${point.join(',')}; expected one`);
        sampleCount++;
      }
      faces.push({ rack: rack.id, face: name, triangles: onFace.length, sampleCount });
    }
  }
  report.observed = { racks: racks.length, inspectedWallFaces: faces.length,
    triangles: faces.reduce((n, face) => n + face.triangles, 0), samples: faces.reduce((n, face) => n + face.sampleCount, 0) };
  report.violationCount = issues.length;
  report.issues = issues.slice(0, 16);
  assert.equal(issues.length, 0, 'Overlapping, missing, or unsupported exhaust walls');
  report.result = 'pass';
} catch (error) {
  report.result = 'fail'; report.error = error.message;
}
const output = JSON.stringify(report, null, 2) + '\n';
if (reportPath) await writeFile(reportPath, output, { flag: 'wx' });
console.log(output.trimEnd());
if (report.result !== 'pass') process.exitCode = 1;
