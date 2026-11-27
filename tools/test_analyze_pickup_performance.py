#!/usr/bin/env python3
"""Self-contained Blender-Python test for the pickup motion diagnostics."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import bpy

ROOT = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='pickup-analysis-test-') as temp:
    scene_path = Path(temp) / 'fixture.blend'
    report = Path(temp) / 'report.json'
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    armature = bpy.data.armatures.new('Fixture')
    rig = bpy.data.objects.new('Armature', armature)
    bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bone = armature.edit_bones.new('LeftHand')
    bone.head = (0, 0, 0)
    bone.tail = (0, 1, 0)
    bpy.ops.object.mode_set(mode='POSE')
    pose = rig.pose.bones['LeftHand']
    pose.rotation_mode = 'QUATERNION'
    for frame, x in ((1, 0), (11, 1)):
        pose.location = (x, 0, 0)
        pose.keyframe_insert('location', frame=frame)
    for curve in rig.animation_data.action.fcurves:
        for point in curve.keyframe_points:
            point.interpolation = 'LINEAR'
    scene = bpy.context.scene
    scene.frame_start, scene.frame_end, scene.render.fps = 1, 11, 10
    bpy.ops.wm.save_as_mainfile(filepath=str(scene_path))
    subprocess.run([sys.executable, str(ROOT / 'tools/analyze_pickup_performance.py'),
                    '--', str(scene_path), '--output', str(report)], check=True)
    data = json.loads(report.read_text())
    assert data['sample_count'] == 81
    assert abs(data['peak_wrist_speed_m_per_s']['value'] - 1) < .001
    assert data['peak_wrist_acceleration_m_per_s2']['value'] < .01
    assert data['peak_wrist_angular_speed_deg_per_s']['value'] < .1
    print('Constant-speed fixture passed', flush=True)
