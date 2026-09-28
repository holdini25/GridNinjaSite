#!/usr/bin/env python3
"""Check exported rack support UVs against the v11 folded-rail contract.

Usage: python3 scripts/facility/validate-contact-export.py path/to/rack.glb

This focused regression check complements the full GLB/semantic validators. It
does not infer compatibility from a release number: only the explicitly named
construction contract, rack metadata, identity transforms, and atlas layout
below are supported. Changing construction or UV layout requires a new contract.
No Blender, image decoder, GPU, or mutable authoring modules are imported.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import struct
import sys


CONTRACT = "rack-contact-v11-folded-rail.v1"
EXPECTED = {"serviceBearingTriangles": 4, "staticBearingTriangles": 28,
            "webTopTriangles": 32}
EPSILON = 1e-6
PARTS = {"GN_RACK_FRAME": "structural_frame", "GN_RACK_PANEL": "removable_panel",
         "GN_RACK_DOOR": "front_door", "GN_RACK_SERVERS": "server_trays",
         "GN_RACK_TRAY": "service_tray", "GN_RACK_POWER": "illustrative_electrical"}
# Blender UV interiors: 512px atlas with 8px gutters. glTF V is flipped on read.
REGIONS = {"contact": (.765625, .390625, .984375, .484375),
           "metal": (.765625, .890625, .796875, .921875),
           "paint": (.765625, .515625, .984375, .609375)}


class InvalidAsset(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise InvalidAsset(message)


def integer(value, minimum=0):
    return type(value) is int and value >= minimum


def item(sequence, index, label):
    require(isinstance(sequence, list) and integer(index) and index < len(sequence),
            f"Invalid {label} index")
    require(isinstance(sequence[index], dict), f"Invalid {label} object")
    return sequence[index]


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, f"Duplicate JSON key: {key}")
        result[key] = value
    return result


def parse_json(raw):
    def invalid_constant(value):
        raise InvalidAsset(f"Nonfinite JSON: {value}")
    return json.loads(raw, object_pairs_hook=unique_object,
                      parse_constant=invalid_constant)


class Glb:
    def __init__(self, raw):
        require(28 <= len(raw) <= 1_000_000, "Rack GLB must be 28–1,000,000 bytes")
        magic, version, length = struct.unpack_from("<III", raw)
        require((magic, version, length) == (0x46546C67, 2, len(raw)), "Invalid GLB header/version/length")
        chunks = []
        offset = 12
        while offset < length:
            require(offset + 8 <= length, "Truncated GLB chunk header")
            size, kind = struct.unpack_from("<II", raw, offset)
            require(size > 0 and size % 4 == 0 and offset + 8 + size <= length,
                    "Invalid GLB chunk bounds/alignment")
            chunks.append((kind, raw[offset + 8:offset + 8 + size]))
            offset += 8 + size
        require([kind for kind, _ in chunks] == [0x4E4F534A, 0x004E4942],
                "Expected exactly one JSON chunk then one BIN chunk")
        self.data = parse_json(chunks[0][1])
        require(isinstance(self.data, dict) and self.data.get("asset", {}).get("version") == "2.0",
                "Unsupported glTF asset")
        require(not self.data.get("extensionsRequired"), "Compressed/extended GLB layouts are unsupported")
        buffers = self.data.get("buffers")
        require(isinstance(buffers, list) and len(buffers) == 1, "Expected one embedded buffer")
        buffer = item(buffers, 0, "buffer")
        self.binary = chunks[1][1]
        self.buffer_length = buffer.get("byteLength")
        require("uri" not in buffer and integer(self.buffer_length, 1)
                and 0 <= len(self.binary) - self.buffer_length <= 3, "Invalid embedded buffer length")
        require(not any(self.binary[self.buffer_length:]), "Invalid BIN padding")
        for index in range(len(self.data.get("bufferViews", []))):
            self.view(index)

    def view(self, index):
        view = item(self.data.get("bufferViews"), index, "bufferView")
        start, size = view.get("byteOffset", 0), view.get("byteLength")
        require(view.get("buffer") == 0 and integer(start) and integer(size, 1)
                and start + size <= self.buffer_length and not view.get("extensions"),
                "Invalid bufferView bounds or unsupported layout")
        return view, start, size

    def attribute(self, index, shape, index_buffer=False):
        accessor = item(self.data.get("accessors"), index, "accessor")
        component = accessor.get("componentType")
        formats = {5121: "B", 5123: "H", 5125: "I"} if index_buffer else {5126: "f"}
        require(accessor.get("type") == shape and component in formats
                and not accessor.get("normalized", False) and "sparse" not in accessor,
                "Unsupported accessor type, normalization, or sparse layout")
        count, start = accessor.get("count"), accessor.get("byteOffset", 0)
        require(integer(count, 1) and count <= 100_000 and integer(start), "Invalid accessor count/offset")
        view, base, size = self.view(accessor.get("bufferView"))
        arity = {"SCALAR": 1, "VEC2": 2, "VEC3": 3}[shape]
        component_size = struct.calcsize("<" + formats[component])
        width = component_size * arity
        stride = view.get("byteStride", width)
        require(integer(stride, width) and ("byteStride" not in view or
                (not index_buffer and stride <= 252 and stride % 4 == 0)), "Unsupported accessor stride")
        require((base + start) % component_size == 0 and start + (count - 1) * stride + width <= size,
                "Accessor exceeds its bufferView or is misaligned")
        values = [struct.unpack_from("<" + formats[component] * arity,
                                     self.binary, base + start + i * stride) for i in range(count)]
        require(all(math.isfinite(value) for row in values for value in row), "Nonfinite accessor value")
        return values

    def atlas(self, binding, dimensions):
        require(isinstance(binding, dict) and binding.get("texCoord", 0) == 0
                and not binding.get("extensions"), "Expected untransformed UV0 atlas binding")
        texture = item(self.data.get("textures"), binding.get("index"), "texture")
        image = item(self.data.get("images"), texture.get("source"), "image")
        require(image.get("mimeType") == "image/png" and "uri" not in image, "Expected embedded PNG atlas")
        _, offset, size = self.view(image.get("bufferView"))
        png = self.binary[offset:offset + size]
        require(size >= 33 and png[:8] == b"\x89PNG\r\n\x1a\n" and png[8:16] == b"\x00\x00\x00\rIHDR",
                "Invalid PNG header")
        require(struct.unpack_from(">II", png, 16) == dimensions, "Unsupported atlas dimensions")


def identity(node):
    require(node.get("translation", [0, 0, 0]) == [0, 0, 0]
            and node.get("rotation", [0, 0, 0, 1]) == [0, 0, 0, 1]
            and node.get("scale", [1, 1, 1]) == [1, 1, 1] and "matrix" not in node,
            "Rack frame coordinates must use identity node transforms")


def frame_meshes(glb):
    data = glb.data
    nodes = data.get("nodes")
    require(isinstance(nodes, list) and 0 < len(nodes) <= 128, "Unsupported rack node count")
    identities = {}
    for index, node in enumerate(nodes):
        require(isinstance(node, dict) and isinstance(node.get("extras", {}), dict), "Invalid node metadata")
        name = node.get("extras", {}).get("gnId")
        if name:
            require(isinstance(name, str) and name not in identities, "Duplicate/invalid semantic identity")
            identities[name] = index
    require(all(name in identities for name in ["GN_SPECIMEN_ROOT", *PARTS]), "Missing rack identity")
    root_index = identities["GN_SPECIMEN_ROOT"]
    root = nodes[root_index]
    identity(root)
    scene = item(data.get("scenes"), data.get("scene"), "scene")
    require(scene.get("nodes") == [root_index], "Unsupported rack scene root")
    extra = root["extras"]
    require(extra.get("gnRole") == "specimen_root" and extra.get("gnDomain") == "workloads",
            "Unsupported specimen root metadata")
    require(isinstance(extra.get("gnSpecimen"), str), "Missing serialized specimen contract")
    metadata = parse_json(extra["gnSpecimen"])
    require(metadata.get("schemaVersion") == "facility-specimen.v1" and metadata.get("kind") == "rack"
            and metadata.get("system") == "workloads", "Unsupported specimen metadata")
    parts = metadata.get("parts")
    require(isinstance(parts, list) and len(parts) == 6 and all(isinstance(p, dict) for p in parts),
            "Unsupported part inventory")
    require({p.get("id"): p.get("role") for p in parts} == PARTS
            and all(p.get("objectId") == p.get("id") for p in parts), "Unsupported rack part identities/roles")
    motion = metadata.get("rackMotion", {})
    require(motion.get("version") == 1 and motion.get("tray") == {
        "objectId": "GN_RACK_TRAY", "retracted": [0, 0, 0], "extended": [0, 0, .18]},
        "Unsupported rack motion/travel contract")
    require(set(root.get("children", [])) == {identities[name] for name in PARTS}
            and len(root["children"]) == 6, "Unsupported rack part ancestry")
    visited, mesh_indices = set(), set()

    def visit(index):
        require(integer(index) and index < len(nodes) and index not in visited,
                "Invalid, repeated, or cyclic rack node")
        visited.add(index)
        node = nodes[index]
        if "mesh" in node:
            require(integer(node["mesh"]) and node["mesh"] not in mesh_indices, "Instanced rack layout unsupported")
            mesh_indices.add(node["mesh"])
        for child in node.get("children", []):
            visit(child)
    visit(root_index)
    require(len(visited) == len(nodes), "Unreachable nodes in rack asset")
    frame = nodes[identities["GN_RACK_FRAME"]]
    identity(frame)
    children = frame.get("children", [])
    require(len(children) == 4, "Unsupported frame material batches")
    meshes = []
    for index in children:
        node = nodes[index]
        identity(node)
        require(not node.get("children") and node.get("extras", {}).get("gnRole") == "equipment_surface",
                "Unsupported frame surface ancestry")
        meshes.append(item(data.get("meshes"), node.get("mesh"), "mesh"))
    return meshes


def within(value, low, high):
    return low - EPSILON <= value <= high + EPSILON


def validate(raw, contract=CONTRACT):
    require(contract == CONTRACT, "Unsupported construction contract")
    glb = Glb(raw)
    counts = dict.fromkeys(EXPECTED, 0)
    coverage = {}
    for mesh in frame_meshes(glb):
        primitives = mesh.get("primitives")
        require(isinstance(primitives, list) and len(primitives) == 1, "Unsupported material batch primitives")
        primitive = primitives[0]
        require(primitive.get("mode", 4) == 4 and not primitive.get("extensions") and not primitive.get("targets"),
                "Expected plain indexed triangle geometry")
        attributes = primitive.get("attributes", {})
        positions = glb.attribute(attributes.get("POSITION"), "VEC3")
        normals = glb.attribute(attributes.get("NORMAL"), "VEC3")
        uv = [(u, 1 - v) for u, v in glb.attribute(attributes.get("TEXCOORD_0"), "VEC2")]
        equipment = glb.attribute(attributes.get("_GN_EQUIPMENT_ID"), "SCALAR")
        require(len(positions) == len(normals) == len(uv) == len(equipment), "Attribute count mismatch")
        require(all(value == (0.,) for value in equipment), "Frame mesh contains a different equipment identity")
        require(all(within(u, 0, 1) and within(v, 0, 1) for u, v in uv), "UV0 outside normalized atlas")
        indices = [row[0] for row in glb.attribute(primitive.get("indices"), "SCALAR", True)]
        require(len(indices) % 3 == 0 and max(indices) < len(positions), "Invalid triangle indices")
        material = item(glb.data.get("materials"), primitive.get("material"), "material")
        pbr = material.get("pbrMetallicRoughness", {})
        glb.atlas(pbr.get("metallicRoughnessTexture"), (512, 512))
        glb.atlas(material.get("occlusionTexture"), (512, 512))
        glb.atlas(pbr.get("baseColorTexture"), (256, 256))
        require(material["occlusionTexture"]["index"] == pbr["metallicRoughnessTexture"]["index"],
                "Occlusion and material response must share the ORM atlas")
        for start in range(0, len(indices), 3):
            triangle = indices[start:start + 3]
            points = [positions[index] for index in triangle]
            if not all(normals[index][1] > .9 for index in triangle):
                continue
            if not all(within(-point[2], -.415, .405) for point in points):
                continue
            for slot in range(8):
                height = .33 + slot * .287
                bearing = all(abs(p[1] - (height - .094)) < EPSILON
                              and within(abs(p[0]), .3075, .3365) for p in points)
                web = all(abs(p[1] - (height - .049)) < EPSILON
                          and within(abs(p[0]), .3305, .3365) for p in points)
                if not (bearing or web):
                    continue
                name = "webTopTriangles" if web else "serviceBearingTriangles" if slot == 4 else "staticBearingTriangles"
                region = "paint" if web else "metal" if slot == 4 else "contact"
                material_name, role = ("Graphite", "powder-coat") if web else ("Steel", "bare-metal")
                require(material.get("name") == material_name and material.get("extras", {}).get("gnSurfaceRole") == role,
                        f"{name} requires {material_name}/{role}")
                low_u, low_v, high_u, high_v = REGIONS[region]
                require(all(within(uv[index][0], low_u, high_u) and within(uv[index][1], low_v, high_v)
                            for index in triangle), f"{name} slot {slot}: UV0 outside {region} region")
                counts[name] += 1
                side = -1 if points[0][0] < 0 else 1
                require(all(point[0] * side > 0 for point in points), "Rail triangle crosses rack sides")
                key = (name, slot, side)
                coverage[key] = coverage.get(key, 0) + 1
    require(counts == EXPECTED, f"Unsupported rail geometry/counts: {counts}; expected {EXPECTED}")
    expected_coverage = {(name, slot, side): 2 for slot in range(8) for side in (-1, 1)
                         for name in ("webTopTriangles", "serviceBearingTriangles" if slot == 4 else "staticBearingTriangles")}
    require(coverage == expected_coverage, "Every slot must retain two bearing/web triangles on each side")
    return counts


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("model", type=Path, help="Explicit exported rack GLB to inspect")
    parser.add_argument("--contract", default=CONTRACT)
    parser.add_argument("--report", type=Path, help="Optional JSON report path; the model is never modified")
    args = parser.parse_args()
    if args.report and (args.report.resolve() == args.model.resolve()
                        or (args.report.exists() and args.model.exists() and args.report.samefile(args.model))):
        parser.error("Report path must not overwrite the input model")
    report = {"schemaVersion": "facility-contact-export-report.v1", "contract": args.contract,
              "model": str(args.model.resolve()), "expectedCounts": EXPECTED,
              "checks": ["service bearings exclude stationary-chassis contact shadows",
                         "static bearings retain their contact UV region",
                         "coated web tops exclude the lower receiver plane"]}
    try:
        require(args.model.stat().st_size <= 1_000_000, "Rack GLB exceeds 1,000,000 bytes")
        raw = args.model.read_bytes()
        report.update(sha256=hashlib.sha256(raw).hexdigest(), bytes=len(raw))
        report["observedCounts"] = validate(raw, args.contract)
        report["result"] = "pass"
    except (OSError, ValueError, TypeError, KeyError, AttributeError, struct.error) as error:
        report.update(result="fail", error=str(error))
    output = json.dumps(report, indent=2) + "\n"
    if args.report:
        args.report.write_text(output)
    print(output, end="")
    return 0 if report["result"] == "pass" else 1


if __name__ == "__main__":
    sys.exit(main())
