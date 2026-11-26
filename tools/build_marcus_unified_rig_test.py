#!/usr/bin/env python3
"""Experimental unified skeleton and idle deformation test, not a game asset.
Requires the approved appearance-study blend, Blender bpy 4.2 and Pillow.
"""
import bpy, math, os
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'brand/characters/marcus/marcus_character_study.blend'))
s=bpy.context.scene
rig=bpy.data.objects['Armature']; rig.name='Marcus test skeleton'
body=bpy.data.objects['Body static'];body.name='Marcus body'
mod=body.modifiers.new('Marcus skeleton','ARMATURE');mod.object=rig
# Clothing source armatures share exactly the base rig's bone names and rest
# matrices. Verify this before replacing them; never silently retarget if not.
for garment in ('Cloth_jacket','Cloth_shirt','Cloth_jeans','Cloth_boots'):
 obj=bpy.data.objects[garment];modifier=next(m for m in obj.modifiers if m.type=='ARMATURE');old=modifier.object
 assert set(old.data.bones.keys())==set(rig.data.bones.keys())
 for b in rig.data.bones:
  a=b.matrix_local; c=old.data.bones[b.name].matrix_local
  assert max(abs(a[i][j]-c[i][j]) for i in range(4) for j in range(4))<1e-5, (garment,b.name)
 world=obj.matrix_world.copy();obj.parent=None;obj.matrix_world=world;modifier.object=rig
 bpy.data.objects.remove(old,do_unlink=True)
# The grafted head is a static cut mesh. Smoothly weight it to head and neck;
# this is a first approximation, not a welded or production-ready neck.
head=bpy.data.objects['Head static'];head.name='Marcus head (graft)'
gh=head.vertex_groups.new(name='head');gn=head.vertex_groups.new(name='neck_01')
for v in head.data.vertices:
 weight=max(0.0,min(1.0,(v.co.z-1.43)/.09))
 if weight>0:gh.add([v.index],weight,'REPLACE')
 if weight<1:gn.add([v.index],1-weight,'REPLACE')
mod=head.modifiers.new('Marcus skeleton','ARMATURE');mod.object=rig
# Small, restrained experimental head movement; no unsupported walking claim.
for name,axis,amount in [('head',1,3),('neck_01',1,1.5)]:
 bone=rig.pose.bones[name];bone.rotation_mode='XYZ'
 for frame,val in ((1,0),(7,1),(13,0),(19,-1),(25,0)):
  bone.rotation_euler[axis]=math.radians(amount*val);bone.keyframe_insert(data_path='rotation_euler',frame=frame)
s.frame_start=1;s.frame_end=25;s.render.fps=12;s.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'brand/characters/marcus/marcus_unified_rig_test.blend'))
s.render.resolution_x=400;s.render.resolution_y=500;s.cycles.samples=8
frames=[]
for frame in range(1,25,2):
 s.frame_set(frame);s.render.filepath=f'/tmp/marcus_unified_{frame:02d}.png';bpy.ops.render.render(write_still=True)
 frames.append(Image.open(s.render.filepath).convert('RGB'))
frames[0].save(ROOT/'docs/previews/marcus/unified_rig_test.gif',save_all=True,append_images=frames[1:],duration=167,loop=0,optimize=True)
print('Saved experimental single-skeleton study',flush=True);os._exit(0)
