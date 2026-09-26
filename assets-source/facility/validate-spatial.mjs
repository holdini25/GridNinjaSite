/** Validate actual exported receivers against the pinned, reviewed contact-atlas contract. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
// These are deliberately versioned expectations, not acceptance criteria inferred
// from an arbitrary bake report. New layouts require an explicit validator review.
export const CONTACT_TILES = Object.freeze({
  floor: [0, 0, 256, 256], plinth: [256, 0, 128, 128],
  rack_panel: [384, 0, 128, 128], rack_core_side: [384, 128, 128, 64],
  rack_support: [384, 192, 128, 64], collector: [256, 128, 128, 64],
  cooler_panel: [256, 192, 128, 64], rack_a: [0, 256, 128, 256],
  face_a: [128, 256, 128, 128], face_b: [128, 384, 128, 128],
  coil: [256, 256, 128, 256], paint: [384, 256, 128, 64],
  collector_top: [384, 320, 128, 64], label: [384, 384, 128, 64],
  neutral: [384, 448, 32, 32], metal: [384, 448, 32, 32],
  polished: [416, 448, 32, 32], rubber: [448, 448, 32, 32],
  copper: [480, 448, 32, 32], indicator: [384, 480, 32, 32],
  platform: [416, 480, 32, 32], polymer: [448, 480, 32, 32],
});
export const PAINT_ROLES = Object.freeze(['paint', 'rack_panel', 'rack_core_side', 'collector', 'collector_top', 'cooler_panel']);
const fixedFinishes = {
  floor: [.78, 0], plinth: [.48, 0], rack_support: [.37, 1],
  rack_a: [.55, 0], face_a: [.55, 0], face_b: [.55, 0], coil: [.55, 0],
  label: [.45, 0], metal: [.37, 1], polished: [.34, 1], rubber: [.76, 0],
  copper: [.34, 1], indicator: [.4, 0], platform: [.78, 0], polymer: [.4, 0],
};
const receiverRoles = [...PAINT_ROLES, 'rack_support'];
const expectedReceivers = {
  overview: ['paint', 'rack_panel', 'collector', 'collector_top', 'cooler_panel'],
  rack: ['paint', 'rack_core_side', 'rack_support'],
  cooling: ['paint', 'cooler_panel'],
};
const layoutHash = tiles => hash(JSON.stringify(Object.fromEntries(Object.entries(tiles).sort(([a], [b]) => a.localeCompare(b, 'en')))));

export function validateBakeContract(report) {
  assert.equal(report.schemaVersion, 1, 'Unsupported bake report schema');
  assert.equal(report.surfaceContractRevision, 'facility-surfaces.v3-contact-candidate', 'Unsupported surface layout revision');
  assert.deepEqual(report.atlasTiles, CONTACT_TILES, 'Unsupported atlas layout/role set');
  assert.equal(report.atlasLayoutSha256, layoutHash(report.atlasTiles), 'Atlas layout hash mismatch');
  assert.deepEqual(report.resolution, [512, 512], 'ORM dimensions');
  assert.deepEqual(report.colorResolution, [256, 256], 'Color dimensions');
  assert.equal(report.gutterPixels, 8, 'Atlas gutter');
  assert.equal(report.atlasOrigin, 'bottom-left', 'Atlas origin');
  assert.equal(report.noiseSeedNamespace, 'facility-surfaces.v2', 'Surface noise lineage');
  assert.equal(report.directIlluminationInColorAtlas, false, 'Unsupported baked direct illumination');
  assert.equal(report.roughnessMultiplier, 1, 'Roughness must not be multiplied twice');
  const finishes = report.ormFinishes;
  assert(finishes && typeof finishes === 'object', 'Missing finish contract');
  assert.deepEqual(Object.keys(finishes).sort(), [...PAINT_ROLES, ...Object.keys(fixedFinishes)].sort(), 'Unexpected finish role set');
  const paintRoughness = finishes.paint?.[0];
  assert(Number.isFinite(paintRoughness) && paintRoughness >= .35 && paintRoughness <= .60, 'Paint roughness outside reviewed .35–.60 coating range');
  for (const role of PAINT_ROLES) assert.deepEqual(finishes[role], [paintRoughness, 0], `Inconsistent nonmetallic paint finish: ${role}`);
  for (const [role, finish] of Object.entries(fixedFinishes)) assert.deepEqual(finishes[role], finish, `Unreviewed fixed finish: ${role}`);
  assert.equal(report.images?.length, 3, 'Three embedded atlas image records required');
  assert.deepEqual(report.images.map(image => image.file).sort(), ['surface-color.png', 'surface-normal.png', 'surface-orm.png']);
  for (const image of report.images) assert(/^[a-f0-9]{64}$/.test(image.sha256) && Number.isSafeInteger(image.bytes) && image.bytes > 0, 'Invalid atlas image identity');
  return { paintRoughness };
}

export function readBakeReport(bytes, expectedSha256) {
  assert(/^[a-f0-9]{64}$/.test(expectedSha256 ?? ''), 'Explicit --bake-report-hash SHA256 required');
  assert.equal(hash(bytes), expectedSha256, 'Bake report hash mismatch');
  const report = JSON.parse(bytes);
  validateBakeContract(report);
  return report;
}

/** Raw image/UV core also used by focused, synthetic negative fixtures. */
export function validateSpatialSamples({ report, role, coordinates, orm, color }) {
  const { paintRoughness } = validateBakeContract(report);
  assert(Object.hasOwn(expectedReceivers, role), 'Unsupported model role');
  assert.equal(orm.length, 512 * 512 * 4, 'Decoded ORM dimensions/channels');
  assert.equal(color.length, 256 * 256 * 4, 'Decoded color dimensions/channels');
  for (const entry of coordinates) assert(entry.uv.length === 2 && entry.uv.every(n => Number.isFinite(n) && n >= 0 && n <= 1), 'Invalid receiver UV');
  return receiverRoles.map(name => {
    const [x, y, w, h] = report.atlasTiles[name];
    const material = name === 'rack_support' ? 'Steel' : 'Graphite';
    const coords = coordinates.filter(entry => entry.material === material && entry.uv[0] >= (x + 7.99) / 512 && entry.uv[0] <= (x + w - 7.99) / 512 && 1 - entry.uv[1] >= (y + 7.99) / 512 && 1 - entry.uv[1] <= (y + h - 7.99) / 512).map(entry => entry.uv);
    if (expectedReceivers[role].includes(name)) {
      assert(coords.length >= 4, `Missing spatial UV receiver ${name}`);
      const spans = [0, 1].map(axis => Math.max(...coords.map(uv => uv[axis])) - Math.min(...coords.map(uv => uv[axis])));
      assert(spans.every(span => span > 1 / 512), `Collapsed spatial UV receiver ${name}`);
    }
    let minAo = 255, maxAo = 0, minRoughness = 255, maxRoughness = 0;
    const contact = name === 'rack_core_side' || name === 'rack_support';
    const roughness = name === 'rack_support' ? .37 : paintRoughness;
    // Quantization allowance is <1 byte; manufacturing variation is at most .003.
    const variation = contact ? 0 : .003;
    const low = Math.floor((roughness - variation) * 255), high = Math.ceil((roughness + variation) * 255);
    for (let yy = y + 8; yy < y + h - 8; yy++) for (let xx = x + 8; xx < x + w - 8; xx++) {
      const offset = ((511 - yy) * 512 + xx) * 4;
      const ao = orm[offset], rough = orm[offset + 1];
      minAo = Math.min(minAo, ao); maxAo = Math.max(maxAo, ao);
      minRoughness = Math.min(minRoughness, rough); maxRoughness = Math.max(maxRoughness, rough);
      assert.equal(orm[offset + 2], name === 'rack_support' ? 255 : 0, `Incorrect metalness: ${name}`);
      assert.equal(orm[offset + 3], 255, `ORM must be opaque: ${name}`);
    }
    assert(minAo >= Math.floor((contact ? .42 : .72) * 255), `Spatial AO floor: ${name}`);
    assert(minRoughness >= low && maxRoughness <= high, `Unexpected roughness: ${name}`);
    if (['rack_core_side', 'rack_support', 'collector', 'collector_top', 'cooler_panel'].includes(name)) assert(maxAo - minAo >= 2, `Missing contact AO field: ${name}`);
    for (let yy = y / 2 + 4; yy < (y + h) / 2 - 4; yy++) for (let xx = x / 2 + 4; xx < (x + w) / 2 - 4; xx++) {
      const offset = ((255 - yy) * 256 + xx) * 4;
      for (let channel = 0; channel < 4; channel++) assert.equal(color[offset + channel], 255, `Direct illumination/tint/cutout must be absent: ${name}`);
    }
    return { name, material, uvVertices: coords.length, aoRange: [minAo, maxAo], roughnessRange: [minRoughness, maxRoughness], requiredReceiver: expectedReceivers[role].includes(name) };
  });
}

export async function validateSpatialFile(file, bakePath, expectedHash) {
  const bytes = await readFile(file), bakeBytes = await readFile(bakePath);
  const bake = readBakeReport(bakeBytes, expectedHash);
  assert(bytes.length >= 28 && bytes.readUInt32LE(0) === 0x46546c67 && bytes.readUInt32LE(4) === 2 && bytes.readUInt32LE(8) === bytes.length, 'Invalid GLB2 header');
  const length = bytes.readUInt32LE(12), data = JSON.parse(bytes.subarray(20, 20 + length)), binary = bytes.subarray(28 + length);
  const viewBytes = index => { const view = data.bufferViews[index]; assert(view && !view.buffer && (view.byteOffset ?? 0) + view.byteLength <= binary.length, 'Invalid embedded view'); return binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength); };
  const textures = new Map();
  for (const record of bake.images) {
    const matches = data.images.filter(image => image.name === record.file.replace('.png', ''));
    assert.equal(matches.length, 1, `Missing/duplicate embedded atlas: ${record.file}`);
    assert.equal(matches[0].mimeType, 'image/png', 'Embedded PNG required');
    const payload = viewBytes(matches[0].bufferView);
    assert.equal(payload.length, record.bytes, `Embedded image length mismatch: ${record.file}`);
    assert.equal(hash(payload), record.sha256, `Embedded image hash mismatch: ${record.file}`);
    const decoded = await sharp(payload).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const size = record.file === 'surface-color.png' ? 256 : 512;
    assert(decoded.info.width === size && decoded.info.height === size && decoded.info.channels === 4, 'Embedded atlas dimensions');
    textures.set(record.file, { ...decoded, imageIndex: data.images.indexOf(matches[0]) });
  }
  const coordinates = [];
  for (const mesh of data.meshes) for (const primitive of mesh.primitives) {
    const material = data.materials[primitive.material];
    if (!['Graphite', 'Steel'].includes(material.name)) continue;
    const pbr = material.pbrMetallicRoughness;
    for (const [binding, imageName] of [[pbr.metallicRoughnessTexture, 'surface-orm.png'], [pbr.baseColorTexture, 'surface-color.png'], [material.occlusionTexture, 'surface-orm.png']]) {
      assert(binding && (binding.texCoord ?? 0) === 0 && !binding.extensions?.KHR_texture_transform, 'Spatial atlas must use untransformed UV0');
      assert.equal(data.textures[binding.index]?.source, textures.get(imageName).imageIndex, 'Wrong spatial texture binding');
    }
    assert.equal(pbr.roughnessFactor ?? 1, 1, 'Runtime roughness multiplier');
    const accessor = data.accessors[primitive.attributes.TEXCOORD_0];
    assert(accessor && accessor.componentType === 5126 && accessor.type === 'VEC2' && !accessor.sparse && !accessor.normalized, 'Float UV0 required');
    const view = data.bufferViews[accessor.bufferView], payload = viewBytes(accessor.bufferView), stride = view.byteStride ?? 8, start = accessor.byteOffset ?? 0;
    assert(start + Math.max(0, accessor.count - 1) * stride + 8 <= payload.length, 'UV accessor outside buffer');
    for (let i = 0; i < accessor.count; i++) coordinates.push({ material: material.name, uv: [payload.readFloatLE(start + i * stride), payload.readFloatLE(start + i * stride + 4)] });
  }
  const root = data.nodes.find(node => node.extras?.gnId === 'GN_SPECIMEN_ROOT');
  const role = root ? basename(file) === 'rack.glb' ? 'rack' : basename(file) === 'cooling.glb' ? 'cooling' : null : 'overview';
  const receivers = validateSpatialSamples({ report: bake, role, coordinates, orm: textures.get('surface-orm.png').data, color: textures.get('surface-color.png').data });
  return { schemaVersion: 2, result: 'passed', file, role, sha256: hash(bytes), bakeReportSha256: hash(bakeBytes), surfaceContractRevision: bake.surfaceContractRevision, paintRoughness: bake.ormFinishes.paint[0], receivers, notes: ['Actual embedded image, hash, channel, binding and UV checks; not browser visual approval.', 'Shared authored construction receivers, not a site lighting or thermal model.'] };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [file, ...args] = process.argv.slice(2);
  assert(file, 'Pass the candidate GLB path');
  const options = new Map();
  for (let i = 0; i < args.length; i += 2) { assert(['--bake-report', '--bake-report-hash'].includes(args[i]) && args[i + 1] && !options.has(args[i]), 'Invalid/duplicate spatial validator option'); options.set(args[i], args[i + 1]); }
  const result = await validateSpatialFile(file, options.get('--bake-report') ?? join(dirname(file), 'bake-report.json'), options.get('--bake-report-hash'));
  const name = result.role === 'overview' ? 'spatial-validation.json' : `${result.role}-spatial-validation.json`;
  await writeFile(join(dirname(file), name), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
}
