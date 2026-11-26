#!/usr/bin/env python3
"""Stress poses for visual diagnosis, not a finished animation or game asset."""
import bpy, math, os
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'brand/characters/marcus/marcus_neck_test.blend'))
s=bpy.context.scene;rig=bpy.data.objects['Marcus test skeleton'];rig.animation_data_clear()
poses=[('rest',{}),('arms',{'upperarm_l':(0,0,25),'upperarm_r':(0,0,-25),'lowerarm_l':(20,0,0),'lowerarm_r':(20,0,0)}),('legs',{'thigh_l':(25,0,0),'calf_l':(-30,0,0),'thigh_r':(-15,0,0),'calf_r':(-12,0,0)}),('head',{'neck_01':(10,8,0),'head':(12,12,0)})]
for frame,(name,rotations) in enumerate(poses,1):
 for bone in rig.pose.bones:
  bone.rotation_mode='XYZ';bone.rotation_euler=tuple(math.radians(x) for x in rotations.get(bone.name,(0,0,0)));bone.keyframe_insert(data_path='rotation_euler',frame=frame)
s.frame_start=1;s.frame_end=4;s.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'brand/characters/marcus/marcus_deformation_audit.blend'))
s.cycles.samples=16;s.render.resolution_x=600;s.render.resolution_y=750
for frame,(name,_) in enumerate(poses,1):
 s.frame_set(frame);s.render.filepath=str(ROOT/f'docs/previews/marcus/stress_{name}.png');bpy.ops.render.render(write_still=True)
print('Saved diagnostic stress poses',flush=True);os._exit(0)
