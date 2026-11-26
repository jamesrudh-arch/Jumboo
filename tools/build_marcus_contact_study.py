#!/usr/bin/env python3
"""Exploratory IK and covered-leg masking, not a finished walk or game asset.
Requires Blender bpy 4.2 and Pillow; starts from the separate neck experiment.
"""
import bpy,bmesh,os
from pathlib import Path
from mathutils import Vector
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'brand/characters/marcus/marcus_neck_test.blend'))
s=bpy.context.scene;rig=bpy.data.objects['Marcus test skeleton'];rig.animation_data_clear();s.frame_set(1)
# The trousers and boots are part of this fixed outfit. Remove only source-body
# vertices under them; retained source scene preserves the unmasked original.
body=bpy.data.objects['Marcus body'];bm=bmesh.new();bm.from_mesh(body.data)
verts=[v for v in bm.verts if v.co.z<.82];assert verts
bmesh.ops.delete(bm,geom=verts,context='VERTS');bm.to_mesh(body.data);bm.free();body.data.update()
# Armature-deformed objects must follow armature object translation; preserve
# rest-world transforms when parenting and do not parent world-space IK targets.
for name in ('Marcus body','Marcus head (graft)','Cloth_jacket','Cloth_shirt','Cloth_jeans','Cloth_boots'):
 obj=bpy.data.objects[name];world=obj.matrix_world.copy();obj.parent=rig;obj.matrix_parent_inverse=rig.matrix_world.inverted();obj.matrix_world=world
for side in ('l','r'):
 bone=rig.data.bones['foot_'+side];target=bpy.data.objects.new('foot target '+side,None);s.collection.objects.link(target);target.matrix_world=rig.matrix_world@bone.matrix_local
 ik=rig.pose.bones['calf_'+side].constraints.new('IK');ik.target=target;ik.chain_count=2;ik.use_stretch=False
 rotation=rig.pose.bones['foot_'+side].constraints.new('COPY_ROTATION');rotation.target=target;rotation.target_space='WORLD';rotation.owner_space='WORLD'
 base=target.location.copy();keys=([(1,0,0),(7,-.15,.07),(13,-.30,0),(19,-.30,0),(25,-.30,0)] if side=='l' else [(1,0,0),(7,0,0),(13,0,0),(19,-.15,.07),(25,-.30,0)])
 for frame,forward,height in keys:
  target.location=(base.x,base.y+forward,base.z+height);target.keyframe_insert(data_path='location',frame=frame)
 for curve in target.animation_data.action.fcurves:
  for key in curve.keyframe_points:key.interpolation='LINEAR'
for frame in range(1,26):
 rig.location.y=-.30*(frame-1)/24;rig.location.z=-.045;rig.keyframe_insert(data_path='location',frame=frame)
s.frame_start=1;s.frame_end=25;s.render.fps=12;s.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'brand/characters/marcus/marcus_contact_study.blend'))
s.cycles.samples=12;s.render.resolution_x=500;s.render.resolution_y=625;cam=s.camera;cam.data.ortho_scale=2.18
frames=[]
for frame in range(1,25,2):
 s.frame_set(frame);y=-.30*(frame-1)/24;cam.location=(6,y,1.05);cam.rotation_euler=(Vector((0,y,.86))-cam.location).to_track_quat('-Z','Y').to_euler();s.render.filepath=f'/tmp/marcus_contact_{frame:02d}.png';bpy.ops.render.render(write_still=True);frames.append(Image.open(s.render.filepath).convert('RGB'))
frames[0].save(ROOT/'docs/previews/marcus/contact_study_side.gif',save_all=True,append_images=frames[1:],duration=167,loop=0,optimize=True)
# Images show a swing pose from front/rear and its side for clothing inspection.
for view,pos in [('front',(0,-6,1.05)),('rear',(0,6,1.05)),('side',(6,0,1.05))]:
 s.frame_set(7);y=-.075;cam.location=(pos[0],pos[1]+y,pos[2]);cam.rotation_euler=(Vector((0,y,.86))-cam.location).to_track_quat('-Z','Y').to_euler();s.render.filepath=str(ROOT/f'docs/previews/marcus/contact_{view}.png');bpy.ops.render.render(write_still=True)
print('Saved experimental IK contact study',flush=True);os._exit(0)
