#!/usr/bin/env python3
"""Export only the existing phone body as a temporary grip-search proxy.

This is NOT the finished phone, a scene, a pickup, or a production asset.
Run with Blender's Python (bpy 4.2); the approved scene is never saved.
"""
import argparse
from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'brand/intro/phone/phone_at_ear_study.blend'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    destination = args.output.resolve()
    if destination.suffix.lower() != '.glb' or destination == SOURCE.resolve():
        parser.error('output must be a .glb file')
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    bpy.context.scene.frame_set(23)
    control = bpy.data.objects['phone grip control']
    source = bpy.data.objects['machined phone body']
    bpy.ops.object.select_all(action='DESELECT')
    proxy = source.copy()
    proxy.data = source.data.copy()
    proxy.animation_data_clear()
    bpy.context.collection.objects.link(proxy)
    proxy.parent = None
    proxy.matrix_world = control.matrix_world.inverted() @ source.matrix_world
    proxy.select_set(True)
    bpy.context.view_layer.objects.active = proxy
    destination.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(destination), export_format='GLB', use_selection=True, export_animations=False)
    print('Proxy dimensions in scene units:', tuple(proxy.dimensions), flush=True)


if __name__ == '__main__':
    main()
