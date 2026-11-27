#!/usr/bin/env python3
"""Export existing imperfect call studies as game-compatible 3D animation.

These assets do not solve the discontinuous grip, constitute a finished intro,
change the game sequence, or replace the original Blender scenes. Requires bpy
4.2. Output should be verified in Godot/Xogot before inclusion in the opening.
"""
from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'game/assets/intro'
SOURCES = [
    ('phone/experiments/table_pickup_contact_study.blend', 'provisional_pickup.glb'),
    ('phone/connected_call_performance_study.blend', 'provisional_conversation.glb'),
]


def export(relative, filename):
    bpy.ops.wm.open_mainfile(filepath=str(ROOT / 'brand/intro' / relative))
    scene = bpy.context.scene
    if filename.endswith('conversation.glb'):
        # Source dialogue covers frames 23–101 over 24.3596 seconds. The
        # Blender study renders on this scale rather than at its nominal FPS.
        scene.render.fps = 24
        scene.render.fps_base = 78 / (24 * 24.359614512471655)
    scene.frame_set(scene.frame_start)
    bpy.context.view_layer.update()
    armature = bpy.data.objects['Armature']
    phone = bpy.data.objects['phone grip control']
    selected = [armature, bpy.data.objects['char1'], phone]
    mouth = bpy.data.objects.get('provisional mouth interior')
    if mouth:
        selected.append(mouth)
    # The proxy slab is included for the provisional pickup only.
    table = bpy.data.objects.get('table')
    if table:
        selected.append(table)
    for ob in list(phone.children):
        # Visibility changes do not export as glTF animation. Retain only the
        # screen state visible at the beginning; no live call UI is implied.
        if ob.hide_render or ob.hide_viewport:
            continue
        if ob.type == 'FONT':
            # glTF doesn't support text objects; conversion is in-memory only.
            bpy.ops.object.select_all(action='DESELECT')
            ob.select_set(True)
            bpy.context.view_layer.objects.active = ob
            bpy.ops.object.convert(target='MESH')
            ob = bpy.context.view_layer.objects.active
        if ob.type == 'MESH':
            selected.append(ob)
    bpy.ops.object.select_all(action='DESELECT')
    for ob in selected:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = armature
    OUTPUT.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(OUTPUT / filename), export_format='GLB',
        use_selection=True, export_animations=True, export_animation_mode='SCENE',
        export_frame_range=True, export_force_sampling=True, export_bake_animation=True,
        export_anim_scene_split_object=False, export_anim_slide_to_zero=True,
        export_cameras=False, export_lights=False)
    print('Exported', filename, flush=True)


if __name__ == '__main__':
    for source, name in SOURCES:
        export(source, name)
