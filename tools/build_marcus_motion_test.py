#!/usr/bin/env python3
"""Create an exploratory Blender-only deformation test from the approved study.
Not a walk cycle or a finished rig: see brand/characters/marcus/README.md.
Requires bpy 4.2, Pillow and the appearance-study .blend.
"""
import bpy, math, os
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'brand/characters/marcus/marcus_character_study.blend'))
s=bpy.context.scene
body=bpy.data.objects['Body static']
modifier=body.modifiers.new('Body deformation test','ARMATURE'); modifier.object=bpy.data.objects['Armature']
# The clothing rigs have matching rest skeletons; drive them together. The
# isolated head stays fixed: this is deliberately a lower-limb deformation test.
rigs=[o for o in s.objects if o.type=='ARMATURE']
assert len(rigs)==5 and len(body.vertex_groups)==53
for rig in rigs:
 for name in ('thigh_l','thigh_r','upperarm_l','upperarm_r'):
  bone=rig.pose.bones[name];bone.rotation_mode='XYZ'
  for frame,phase in ((1,0),(7,1),(13,0),(19,-1),(25,0)):
   scale={'thigh_l':22,'thigh_r':-22,'upperarm_l':-9,'upperarm_r':9}[name]
   bone.rotation_euler[0]=math.radians(scale*phase)
   bone.keyframe_insert(data_path='rotation_euler',frame=frame)
s.frame_start=1;s.frame_end=25;s.render.fps=12;s.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'brand/characters/marcus/marcus_motion_test.blend'))
s.render.resolution_x=400;s.render.resolution_y=500;s.cycles.samples=8
frames=[]
for frame in range(1,25,2):
 s.frame_set(frame);s.render.filepath=f'/tmp/marcus_motion_{frame:02d}.png';bpy.ops.render.render(write_still=True)
 frames.append(Image.open(s.render.filepath).convert('RGB'))
frames[0].save(ROOT/'docs/previews/marcus/deformation_test.gif',save_all=True,append_images=frames[1:],duration=167,loop=0,optimize=True)
print('Saved exploratory deformation test',flush=True);os._exit(0)
