#!/usr/bin/env python3
"""Measure a pickup scene's wrist motion for diagnostics, not artistic scoring.

Runs in Blender 4.2 Python. Uses world-space hand-bone positions and orientation
at eighth-frame intervals. Frame rate comes from the scene unless --fps is set.
Outputs raw maxima and times; does not infer contact, acting quality or approval.
"""
import argparse
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    parser = argparse.ArgumentParser()
    parser.add_argument('scene', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--fps', type=float)
    parser.add_argument('--subdivisions', type=int, default=8)
    args = parser.parse_args(argv)
    if args.subdivisions < 1 or (args.fps is not None and args.fps <= 0):
        parser.error('fps and subdivisions must be positive')
    bpy.ops.wm.open_mainfile(filepath=str(args.scene.resolve()))
    scene = bpy.context.scene
    fps = args.fps or scene.render.fps / scene.render.fps_base
    rig = bpy.data.objects['Armature']
    bone = rig.pose.bones['LeftHand']
    phone = bpy.data.objects.get('phone grip control')
    dt = 1 / (fps * args.subdivisions)
    samples = []
    for i in range((scene.frame_end - scene.frame_start) * args.subdivisions + 1):
        f = scene.frame_start + i / args.subdivisions
        scene.frame_set(int(f), subframe=f % 1)
        bpy.context.view_layer.update()
        hand = rig.matrix_world @ bone.matrix
        samples.append((f, rig.matrix_world @ bone.head,
                        hand.to_quaternion().normalized(),
                        phone.matrix_world.translation.copy() if phone else None))
    velocity = []
    angular = []
    for a, b in zip(samples, samples[1:]):
        v = (b[1] - a[1]) / dt
        # q and -q represent the same rotation; abs(dot) takes the short arc.
        angle = 2 * math.acos(max(-1.0, min(1.0, abs(a[2].dot(b[2])))))
        velocity.append((b[0], v))
        angular.append((b[0], math.degrees(angle / dt)))
    acceleration = [(velocity[i][0], (velocity[i][1] - velocity[i-1][1]).length / dt)
                    for i in range(1, len(velocity))]
    def peak(values):
        frame, value = max(values, key=lambda item: item[1])
        return {'frame': frame, 'value': round(value, 3)}
    report = {
        'scene': str(args.scene), 'fps': fps, 'subdivisions': args.subdivisions,
        'sample_count': len(samples), 'hand': bone.name,
        'peak_wrist_speed_m_per_s': peak([(f, v.length) for f, v in velocity]),
        'peak_wrist_acceleration_m_per_s2': peak(acceleration),
        'peak_wrist_angular_speed_deg_per_s': peak(angular),
        'method': 'world-space bone-head finite differences; no visual or physical quality verdict',
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2), flush=True)

if __name__ == '__main__':
    main()
