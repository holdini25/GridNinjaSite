"""Process-scoped Cycles device selection. Never saves Blender preferences."""
import os
import platform
import bpy


def configure(mode=None, *, metalrt=None, threads=None):
    mode = mode or os.environ.get('GN_CYCLES_DEVICE', 'metal')
    if mode not in {'cpu', 'metal', 'hybrid'}:
        raise ValueError('GN_CYCLES_DEVICE must be cpu, metal or hybrid')
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.render.threads_mode = 'FIXED'
    threads=int(threads if threads is not None else os.environ.get('GN_CYCLES_CPU_THREADS','4'))
    if threads not in range(1,7):raise ValueError('GN_CYCLES_CPU_THREADS must be 1–6')
    scene.render.threads = threads
    preferences = bpy.context.preferences.addons['cycles'].preferences
    preferences.compute_device_type = 'METAL'
    metalrt = metalrt or os.environ.get('GN_METALRT', 'AUTO')
    if metalrt not in {'AUTO', 'ON', 'OFF'}:
        raise ValueError('GN_METALRT must be AUTO, ON or OFF')
    preferences.metalrt = metalrt
    preferences.kernel_optimization_level = 'FULL'
    preferences.get_devices()
    metal = [device for device in preferences.devices if device.type == 'METAL']
    if mode != 'cpu' and not metal:
        raise RuntimeError('Requested Metal device is unavailable; CPU fallback must be explicit')
    for device in preferences.devices:
        device.use = device.type == 'CPU' if mode == 'cpu' else device.type == 'METAL' or (mode == 'hybrid' and device.type == 'CPU')
    scene.cycles.device = 'CPU' if mode == 'cpu' else 'GPU'
    return {'requested': mode, 'cyclesDevice': scene.cycles.device,
            'computeBackend': preferences.compute_device_type, 'cpuThreadLimit': threads,
            'metalRT': preferences.metalrt, 'kernelOptimization': preferences.kernel_optimization_level,
            'enabledDevices': [{'name': device.name, 'type': device.type} for device in preferences.devices if device.use],
            'blender': bpy.app.version_string, 'blenderBuild': bpy.app.build_hash.decode(),
            'platform': platform.platform(), 'savedPreferences': False,
            'metalBinaryArchivesDisabled': os.environ.get('CYCLES_METAL_DISABLE_BINARY_ARCHIVES') == '1',
            'note': 'Enabled devices are configuration evidence; task timing does not establish CPU/GPU work split.'}
