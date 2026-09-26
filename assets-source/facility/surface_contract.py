"""Pure, immutable authoring contract for facility surface coordinates and bakes.

No Blender imports or configuration reads occur here. The generator, bake jobs
and validators consume the same metric footprints and atlas interiors. A bake
job may explicitly override reviewed paint roughness through reviewed_finishes.
This authoring data is not copied into the website's initial JavaScript.
"""
from dataclasses import dataclass, replace
import hashlib
import math
from types import MappingProxyType

REVISION = 'facility-surfaces.v3-contact-candidate'
# Appearance lineage is independent of atlas/schema revisions. Keep the
# reviewed attempt04 field phases when adding or rearranging receiver tiles.
NOISE_SEED_NAMESPACE = 'facility-surfaces.v2'
SIZE = 512
COLOR_SIZE = 256
GUTTER = 8
PAINT_ROUGHNESS = .42
UV_TOLERANCE = 1e-6

TILES = MappingProxyType({
    'floor': (0, 0, 256, 256), 'plinth': (256, 0, 128, 128),
    'rack_panel': (384, 0, 128, 128),
    'rack_core_side': (384, 128, 128, 64),
    'rack_support': (384, 192, 128, 64), 'collector': (256, 128, 128, 64),
    'cooler_panel': (256, 192, 128, 64), 'rack_a': (0, 256, 128, 256),
    'face_a': (128, 256, 128, 128), 'face_b': (128, 384, 128, 128),
    'coil': (256, 256, 128, 256), 'paint': (384, 256, 128, 64),
    'collector_top': (384, 320, 128, 64), 'label': (384, 384, 128, 64),
    'neutral': (384, 448, 32, 32), 'metal': (384, 448, 32, 32),
    'polished': (416, 448, 32, 32), 'rubber': (448, 448, 32, 32),
    'copper': (480, 448, 32, 32), 'indicator': (384, 480, 32, 32),
    'platform': (416, 480, 32, 32), 'polymer': (448, 480, 32, 32),
})

# Existing patterned/paint footprints are preserved. Uniform finishes now have
# broad, nonperiodic fields in metres; they are not stretched to each small part.
METRES = MappingProxyType({
    'paint': (4., 4.), 'rack_a': (.4, .8), 'face_a': (.30, .20),
    'face_b': (.20, .20), 'coil': (1.1, 3.),
    'floor': (10.8, 7.6), 'plinth': (6.28, 4.38),
    'rack_panel': (1.24, 2.525), 'rack_core_side': (.85, .17),
    'rack_support': (.82, .029), 'collector': (5.83, .30),
    'collector_top': (5.83, .65), 'cooler_panel': (1.12, 3.04),
    'neutral': (12., 12.), 'metal': (4., 4.), 'polished': (4., 4.),
    'rubber': (12., 12.), 'copper': (12., 12.), 'platform': (12., 12.),
    'polymer': (.5, .5), 'indicator': (1., 1.), 'label': (.24, .037),
})

FINISHES = MappingProxyType({
    'floor': (.78, 0), 'plinth': (.48, 0),
    'rack_panel': (PAINT_ROUGHNESS, 0), 'rack_core_side': (PAINT_ROUGHNESS, 0),
    'rack_support': (.37, 1), 'collector': (PAINT_ROUGHNESS, 0),
    'collector_top': (PAINT_ROUGHNESS, 0), 'cooler_panel': (PAINT_ROUGHNESS, 0),
    'rack_a': (.55, 0), 'face_a': (.55, 0), 'face_b': (.55, 0),
    'coil': (.55, 0), 'paint': (PAINT_ROUGHNESS, 0), 'label': (.45, 0),
    'metal': (.37, 1), 'polished': (.34, 1), 'rubber': (.76, 0),
    'copper': (.34, 1), 'indicator': (.4, 0), 'platform': (.78, 0),
    'polymer': (.40, 0),
})

MATERIAL_REGIONS = MappingProxyType({
    'Graphite': 'paint', 'Steel': 'metal', 'Trim': 'polished',
    'Dark': 'rubber', 'Copper': 'copper', 'Amber': 'indicator',
    'Platform': 'platform', 'Grille': 'rack_a',
})
PAINT_REGIONS = frozenset({'paint', 'rack_panel', 'collector', 'collector_top', 'cooler_panel', 'rack_core_side'})
SPATIAL_REGIONS = (PAINT_REGIONS - {'paint'}) | {'rack_support'}
PATTERN_REGIONS = frozenset({'rack_a', 'face_a', 'face_b', 'coil'})


def stable_seed(identity):
    """A stable unsigned seed, independent of PYTHONHASHSEED and process order."""
    return int.from_bytes(hashlib.sha256((NOISE_SEED_NAMESPACE + ':' + identity).encode()).digest()[:4], 'big')


@dataclass(frozen=True)
class SurfaceSpec:
    id: str
    atlas_region: str
    metric_size: tuple[float, float]
    origin: tuple[float, float, float] = (0., 0., 0.)
    u_axis: tuple[float, float, float] = (1., 0., 0.)
    v_axis: tuple[float, float, float] = (0., 1., 0.)
    relief_metres: float = 0.
    roughness: float = PAINT_ROUGHNESS
    metalness: float = 0.
    normal_strength: float = 0.
    receiver_family: str = 'none'
    motion_group: str = 'static'
    seed: int = 0
    mapping: str = 'metric'

    def __post_init__(self):
        if len(self.metric_size) != 2 or any(len(vector) != 3 for vector in (self.origin, self.u_axis, self.v_axis)):
            raise ValueError('A surface needs two metric dimensions and three-component vectors')
        if self.atlas_region not in TILES:
            raise ValueError('Unknown surface atlas region: ' + self.atlas_region)
        values = (*self.metric_size, *self.origin, *self.u_axis, *self.v_axis,
                  self.relief_metres, self.roughness, self.metalness, self.normal_strength)
        if not all(math.isfinite(value) for value in values):
            raise ValueError('Surface values must be finite')
        if min(self.metric_size) <= 0 or self.relief_metres < 0:
            raise ValueError('Surface footprint must be positive and relief nonnegative')
        if not 0 <= self.roughness <= 1 or not 0 <= self.metalness <= 1 or self.normal_strength < 0:
            raise ValueError('Invalid physical material parameters')
        if any(abs(sum(value * value for value in axis) - 1) > 1e-6 for axis in (self.u_axis, self.v_axis)):
            raise ValueError('Surface axes must be unit length')
        if abs(sum(u * v for u, v in zip(self.u_axis, self.v_axis))) > 1e-6:
            raise ValueError('Surface axes must be orthogonal')
        if self.mapping not in {'metric', 'fit', 'constant'}:
            raise ValueError('Unknown surface mapping mode')


SURFACES = MappingProxyType({
    region: SurfaceSpec(
        id=region, atlas_region=region, metric_size=METRES[region],
        relief_metres=.0078 if region == 'coil' else .004 if region in PATTERN_REGIONS else 0.,
        roughness=FINISHES.get(region, FINISHES['metal'])[0],
        metalness=FINISHES.get(region, FINISHES['metal'])[1],
        normal_strength=.35 if region in PATTERN_REGIONS else 0.,
        receiver_family=region if region in SPATIAL_REGIONS or region in {'floor', 'plinth'} else 'none',
        seed=stable_seed(region),
        mapping='fit' if region in SPATIAL_REGIONS or region == 'label' else 'constant' if region in {'neutral', 'indicator'} else 'metric',
    ) for region in TILES
})


def surface_spec(region):
    return SURFACES[region]


def atlas_rect(region):
    return TILES[region]


def metric_size(region):
    return METRES[region]


def reviewed_finishes(paint_roughness=PAINT_ROUGHNESS):
    if not math.isfinite(paint_roughness) or not .35 <= paint_roughness <= .60:
        raise ValueError('Paint roughness must remain within the reviewed coating range')
    return {region: (paint_roughness if region in PAINT_REGIONS else roughness, metalness)
            for region, (roughness, metalness) in FINISHES.items()}


def tile_uv(region, u, v):
    """Map to padded UV0. Only numerical epsilon is corrected, never a crop."""
    if not all(math.isfinite(value) and -UV_TOLERANCE <= value <= 1 + UV_TOLERANCE for value in (u, v)):
        raise ValueError(f'Out-of-footprint UV for {region}: {(u, v)}; author a crop or segmentation')
    x, y, width, height = atlas_rect(region)
    return ((x + GUTTER + (width - 2 * GUTTER) * min(1., max(0., u))) / SIZE,
            (y + GUTTER + (height - 2 * GUTTER) * min(1., max(0., v))) / SIZE)


def project_uv(spec, position):
    if len(position) != 3 or not all(math.isfinite(value) for value in position):
        raise ValueError('A surface position must contain three finite coordinates')
    offset = tuple(value - origin for value, origin in zip(position, spec.origin))
    coordinates = (sum(a * b for a, b in zip(offset, spec.u_axis)) / spec.metric_size[0],
                   sum(a * b for a, b in zip(offset, spec.v_axis)) / spec.metric_size[1])
    return tile_uv(spec.atlas_region, *coordinates)


def frame_spec(region, origin, u_axis, v_axis, size=None, motion_group='static'):
    return replace(surface_spec(region), origin=tuple(origin), u_axis=tuple(u_axis),
                   v_axis=tuple(v_axis), metric_size=tuple(metric_size(region) if size is None else size), motion_group=motion_group)


def contact_frame(region, axis, sign, origin, u, v, size):
    """Validate scalar AO coordinates, including a deliberate mirrored frame.

    This mapping never changes geometric normals. Mirroring is permitted for a
    symmetric scalar field; an actual bake receiver must also face outward.
    """
    if type(axis) is not int or axis not in (0, 1, 2):
        raise ValueError('Contact face axis must be 0, 1 or 2')
    if type(sign) is not int or sign not in (-1, 1):
        raise ValueError('Contact face sign must be -1 or 1')
    if not isinstance(region, str) or region not in SPATIAL_REGIONS:
        raise ValueError('Contact mapping requires a spatial atlas region')
    try:
        spec = frame_spec(region, origin, u, v, size)
    except (TypeError, KeyError, ValueError) as exc:
        raise ValueError('Invalid contact surface frame') from exc
    if any(isinstance(value, bool) for vector in (spec.origin, spec.u_axis, spec.v_axis, spec.metric_size) for value in vector):
        raise ValueError('Contact frame coordinates must be real numbers, not booleans')
    if abs(spec.u_axis[axis]) > 1e-6 or abs(spec.v_axis[axis]) > 1e-6:
        raise ValueError('Contact coordinates must lie in the selected face plane')
    if spec.normal_strength != 0:
        raise ValueError('Mirrored contact fields cannot contain tangent-space normals')
    return {'region': region, 'axis': axis, 'sign': sign,
            'origin': list(spec.origin), 'u': list(spec.u_axis), 'v': list(spec.v_axis),
            'size': list(spec.metric_size), 'kind': 'scalar-contact'}


def validate_contact_frame(frame, *, outward=False):
    """Fail closed when reading serialized authoring metadata before export."""
    expected = {'region', 'axis', 'sign', 'origin', 'u', 'v', 'size', 'kind'}
    if not isinstance(frame, dict) or set(frame) != expected or frame['kind'] != 'scalar-contact':
        raise ValueError('Unsupported contact frame metadata')
    result = contact_frame(**{key: frame[key] for key in expected if key != 'kind'})
    if outward:
        u, v = result['u'], result['v']
        cross = (u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0])
        if cross[result['axis']] * result['sign'] < 1 - 1e-6:
            raise ValueError('Bake receiver winding must face outward')
    return result


def bounds(points):
    """One pass per evaluated mesh, rather than a scan per face corner."""
    iterator = iter(points)
    try:
        first = tuple(next(iterator))
    except StopIteration as exc:
        raise ValueError('Cannot map an empty surface') from exc
    low, high = list(first), list(first)
    for point in iterator:
        for axis in range(3):
            low[axis] = min(low[axis], point[axis])
            high[axis] = max(high[axis], point[axis])
    return tuple(low), tuple(high)


def segmented_box(center, size, footprint):
    """Outward coplanar quads; split only faces exceeding the metric footprint.

    Vertices are deduplicated at shared coordinates. Edge/UV discontinuities
    remain corner attributes during Blender's evaluated batching and export.
    """
    if len(center) != 3 or len(size) != 3 or len(footprint) != 2:
        raise ValueError('Box requires three dimensions and a two-dimensional surface footprint')
    if not all(math.isfinite(value) for value in (*center, *size, *footprint)) or min((*size, *footprint)) <= 0:
        raise ValueError('Box size and surface footprint must be finite and positive')
    vertices, faces, indices = [], [], {}
    low = tuple(c - extent / 2 for c, extent in zip(center, size))
    high = tuple(c + extent / 2 for c, extent in zip(center, size))
    # u cross v points toward each face's outward normal.
    for axis, sign, ua, us, va in [(0, -1, 1, -1, 2), (0, 1, 1, 1, 2),
                                   (1, -1, 0, 1, 2), (1, 1, 0, -1, 2),
                                   (2, -1, 0, -1, 1), (2, 1, 0, 1, 1)]:
        counts = [max(1, math.ceil(size[ua] / footprint[0] - 1e-10)),
                  max(1, math.ceil(size[va] / footprint[1] - 1e-10))]
        for row in range(counts[1]):
            for col in range(counts[0]):
                face = []
                for cu, cv in [(col, row), (col + 1, row), (col + 1, row + 1), (col, row + 1)]:
                    coordinate = list(low)
                    coordinate[axis] = high[axis] if sign > 0 else low[axis]
                    du = min(cu * footprint[0], size[ua])
                    coordinate[ua] = low[ua] + du
                    coordinate[va] = low[va] + min(cv * footprint[1], size[va])
                    key = tuple(round(value, 12) for value in coordinate)
                    if key not in indices:
                        indices[key] = len(vertices)
                        vertices.append(tuple(coordinate))
                    face.append(indices[key])
                if us < 0:
                    face.reverse()
                faces.append(tuple(face))
    return vertices, faces
