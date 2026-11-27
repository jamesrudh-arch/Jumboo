#!/usr/bin/env python3
"""Repackage the pinned Poly Haven 1K generator glTF as a self-contained GLB.

Run with Blender's Python: blender --background --python tools/prepare_warehouse_generator.py -- /path/to/portable_generator/1k/portable_generator_1k.gltf
No geometry simplification or material authoring is applied.
"""
import hashlib
import os
import sys
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[1]
EXPECTED = {
    'portable_generator_1k.gltf': 'd5afe27834f824dfe753391713c45be03479e8100831f320796030531f61b848',
    'portable_generator.bin': 'fb7dcfedec1331ad541569e4ca8d4157284b2164084b7fe5a97928d4abc0ea2d',
    'textures/portable_generator_arm_1k.jpg': '10236e967baddd90ec7d4ab68969b06fb419f98782a2796db94edc0249b0dad2',
    'textures/portable_generator_diff_1k.jpg': '32acc300105a2df2290d872889b24e1b29ff1ca2c56c0a0cf8fbba0c5966a063',
    'textures/portable_generator_nor_gl_1k.jpg': '8a868edab1a2f5ffa50b2b1680c2c342491b3eeeac443734178c445c7286c25d',
    'textures/portable_generator_spec_1k.jpg': 'acf30e81c367898eb846f353d77e404f6831ac23bf071e0e718fddb8881b86cb',
}
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
if len(args) != 1:
    raise SystemExit('Provide the path to portable_generator_1k.gltf')
source = Path(args[0]).resolve()
for relative, expected in EXPECTED.items():
    actual = hashlib.sha256((source.parent / relative).read_bytes()).hexdigest()
    if actual != expected:
        raise ValueError(f'Unexpected hash for {relative}: {actual}')
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(source))
output = ROOT / 'brand/intro/warehouse_assets/portable_generator.glb'
output.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(output), export_format='GLB')
print('Output:', output, hashlib.sha256(output.read_bytes()).hexdigest(), flush=True)
# Avoid crash on interpreter shutdown in some standalone bpy installations.
if os.environ.get('BYPASS_BPY_SHUTDOWN') == '1':
    os._exit(0)
