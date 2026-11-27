#!/usr/bin/env python3
"""Check exported call poses against source scenes, not runtime/art quality.

Requires Blender Python 4.2. Does not validate contact, UI, audio or Godot.
"""
from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parents[1]
CASES = [
    (ROOT / 'brand/intro/phone/experiments/table_pickup_contact_study.blend',
     ROOT / 'game/assets/intro/provisional_pickup.glb', 22 / 6),
    (ROOT / 'brand/intro/phone/connected_call_performance_study.blend',
     ROOT / 'game/assets/intro/provisional_conversation.glb', 24.359614512471655),
]


def landmarks(armature, phone):
    return (armature.matrix_world @ armature.pose.bones['LeftHand'].head,
            phone.matrix_world.translation.copy())


def verify(source, exported, duration):
    bpy.ops.wm.open_mainfile(filepath=str(source))
    scene = bpy.context.scene
    armature = bpy.data.objects['Armature']
    phone = bpy.data.objects['phone grip control']
    expected = []
    for t in (0., .5, 1.):
        frame = scene.frame_start + t * (scene.frame_end - scene.frame_start)
        scene.frame_set(int(frame), subframe=frame % 1)
        bpy.context.view_layer.update()
        expected.append(landmarks(armature, phone))
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.fps = 24
    bpy.ops.import_scene.gltf(filepath=str(exported))
    armatures = [ob for ob in bpy.data.objects if ob.type == 'ARMATURE']
    assert len(armatures) == 1, f'{exported.name}: unexpected armature count'
    armature = armatures[0]
    phone = bpy.data.objects['phone grip control']
    for ob in (armature, phone):
        assert ob.animation_data and ob.animation_data.action, f'{ob.name}: animation missing'
    for t, reference in zip((0., .5, 1.), expected):
        frame = t * duration * scene.render.fps
        scene.frame_set(int(frame), subframe=frame % 1)
        bpy.context.view_layer.update()
        current = landmarks(armature, phone)
        errors = [(x - y).length for x, y in zip(current, reference)]
        assert max(errors) < .0001, f'{exported.name} at {t}: landmark error {errors}'
    print(f'PASS {exported.name}: wrist and phone match three sampled source poses', flush=True)


if __name__ == '__main__':
    for case in CASES:
        verify(*case)
