#!/usr/bin/env python3
"""Refine a *diagnostic* contact study, not a finished walking animation."""
import bpy,os
from pathlib import Path
from mathutils import Vector
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'brand/characters/marcus/marcus_contact_study.blend'))
s=bpy.context.scene;boots=bpy.data.objects['Cloth_boots']
# Keep outsole almost rigid while transitioning smoothly to original ankle
# weights. This is specific to these boots and this skeleton, not a general fit.
for vertex in boots.data.vertices:
 if vertex.co.z>=.055:continue
 side='l' if vertex.co.x>0 else 'r';ball=boots.vertex_groups['ball_'+side];blend=max(0,min(1,(.055-vertex.co.z)/.03));weights=[(w.group,w.weight) for w in vertex.groups]
 for group,weight in weights:
  if group==ball.index:continue
  value=weight*(1-blend)
  if value>1e-6:boots.vertex_groups[group].add([vertex.index],value,'REPLACE')
  else:boots.vertex_groups[group].remove([vertex.index])
 current=next((w for group,w in weights if group==ball.index),0);ball.add([vertex.index],current*(1-blend)+blend,'REPLACE')
# Compensate for measured initial ~2mm sole/floor offset; applies to swing too.
for side in ('l','r'):
 target=bpy.data.objects['foot target '+side]
 for curve in target.animation_data.action.fcurves:
  if curve.data_path=='location' and curve.array_index==2:
   for key in curve.keyframe_points:
    key.co.y-=.00198;key.handle_left.y-=.00198;key.handle_right.y-=.00198
s.frame_set(1);bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'brand/characters/marcus/marcus_ground_contact.blend'))
s.cycles.samples=8;s.render.resolution_x=400;s.render.resolution_y=500;cam=s.camera;cam.data.ortho_scale=2.18;frames=[]
for frame in range(1,25,2):
 s.frame_set(frame);y=-.30*(frame-1)/24;cam.location=(6,y,1.05);cam.rotation_euler=(Vector((0,y,.86))-cam.location).to_track_quat('-Z','Y').to_euler();s.render.filepath=f'/tmp/marcus_ground_{frame:02d}.png';bpy.ops.render.render(write_still=True);frames.append(Image.open(s.render.filepath).convert('RGB'))
frames[0].save(ROOT/'docs/previews/marcus/ground_contact_side.gif',save_all=True,append_images=frames[1:],duration=167,loop=0,optimize=True)
print('Saved diagnostic ground-contact test',flush=True);os._exit(0)
