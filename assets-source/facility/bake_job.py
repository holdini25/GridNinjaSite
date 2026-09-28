"""Reproducible, process-local bake jobs; no Blender import or global settings.

Only validated complete entries are published. A cache entry is an optimization,
never evidence that the candidate passed its browser or asset release gates.
"""
from contextlib import contextmanager
import hashlib
import json
import math
import os
from pathlib import Path
import tempfile

REVISION = 'metric-bake-jobs.v1'


def canonical_bytes(value):
    def convert(item):
        # Blender ID properties and mathutils vectors are containers, but the
        # standard encoder does not recognize them. Never stringify an opaque
        # object: that would hide values or insert a process memory address.
        if hasattr(item,'to_dict'):return item.to_dict()
        if hasattr(item,'to_list'):return item.to_list()
        if hasattr(item,'tolist'):return item.tolist()
        if isinstance(item,(set,frozenset)):return sorted(item)
        if hasattr(item,'__iter__') and not isinstance(item,(str,bytes,bytearray)):
            return list(item)
        raise TypeError('Unsupported bake fingerprint value: '+type(item).__name__)
    return json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False, default=convert).encode()


def fingerprint(value):
    return hashlib.sha256(canonical_bytes(value)).hexdigest()


def atomic_write(path, payload):
    """Publish within one filesystem, leaving the prior complete file on failure."""
    path = Path(path); path.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary = tempfile.mkstemp(prefix='.' + path.name + '.', dir=path.parent)
    try:
        with os.fdopen(handle, 'wb') as stream:
            stream.write(payload); stream.flush(); os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary): os.unlink(temporary)


def projection_settings(minimum, maximum, clearance=.001):
    """Signed high-minus-low displacement bounds in metres, along the low normal."""
    if not all(math.isfinite(value) for value in (minimum, maximum, clearance)) or minimum > maximum or clearance <= 0:
        raise ValueError('Invalid metric projection bounds')
    # The cage starts above the highest feature. Its ray must reach the lowest
    # possible feature plus a recorded clearance; no scene-wide 200 mm rays.
    cage = max(0., maximum) + clearance
    return {'cageExtrusionMetres': cage,
            'maxRayDistanceMetres': cage - min(0., minimum) + clearance,
            'displacementBoundsMetres': [minimum, maximum], 'clearanceMetres': clearance}


def belongs_to_receiver(occluder_group, receiver_group):
    """Static surfaces ignore detachable parts; moving surfaces keep self AO only."""
    return occluder_group == receiver_group


class BakeCache:
    def __init__(self, directory):
        self.directory = Path(directory)

    def _key(self, recipe):
        return fingerprint({'pipeline': REVISION, 'recipe': recipe})

    def get(self, recipe):
        key = self._key(recipe); root = self.directory / key
        try:
            manifest = json.loads((root / 'manifest.json').read_text())
            if manifest.get('key') != key or manifest.get('revision') != REVISION or canonical_bytes(manifest.get('recipe')) != canonical_bytes(recipe):
                return None
            payload = (root / 'result.npy').read_bytes()
            if len(payload) != manifest['bytes'] or hashlib.sha256(payload).hexdigest() != manifest['sha256']:
                return None
            return payload
        except (OSError, KeyError, ValueError, TypeError):
            return None

    def put(self, recipe, payload):
        key = self._key(recipe); root = self.directory / key
        atomic_write(root / 'result.npy', payload)
        # Manifest last is the commit marker. Readers reject partial/old pairs.
        atomic_write(root / 'manifest.json', canonical_bytes({
            'revision': REVISION, 'key': key, 'recipe': recipe, 'bytes': len(payload),
            'sha256': hashlib.sha256(payload).hexdigest(),
        }))
        return key


@contextmanager
def output_lock(directory):
    """Exclusive publisher for one candidate; never deletes another job's lock."""
    directory = Path(directory); directory.mkdir(parents=True, exist_ok=True)
    lock = directory / '.bake-write.lock'
    descriptor = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    try:
        os.write(descriptor, canonical_bytes({'pid': os.getpid(), 'revision': REVISION}))
        yield
    finally:
        os.close(descriptor); lock.unlink(missing_ok=True)
