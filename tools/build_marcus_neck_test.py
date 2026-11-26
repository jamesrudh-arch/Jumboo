#!/usr/bin/env python3
"""Explore a rear neck extension on a copy of the unified rig, not a weld.
Requires bpy 4.2, Pillow and marcus_unified_rig_test.blend.
"""
import bpy, bmesh, os
from mathutils import Vector
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'brand/characters/marcus/marcus_unified_rig_test.blend'))
s=bpy.context.scene;h=bpy.data.objects['Marcus head (graft)']
# Cut the rear only, keeping the approved face and front neckline. Extend the
# resulting boundary down inside the work jacket. UVs and weights are inherited
# by bmesh from the cut edges; this remains a visually approximate graft.
bm=bmesh.new();bm.from_mesh(h.data);cut=1.50
bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.00001,plane_co=(0,0,cut),plane_no=(0,0,1),clear_inner=False)
remove=[f for f in bm.faces if f.calc_center_median().z<cut and f.calc_center_median().y>.05]
bmesh.ops.delete(bm,geom=remove,context='FACES')
edges=[e for e in bm.edges if e.is_boundary and all(abs(v.co.z-cut)<.0001 for v in e.verts) and (e.verts[0].co.y+e.verts[1].co.y)/2>.05]
assert len(edges)>0
result=bmesh.ops.extrude_edge_only(bm,edges=edges)
for v in result['geom']:
 if isinstance(v,bmesh.types.BMVert):
  v.co.z-=.06;v.co.y=min(v.co.y,.075);v.co.x*=.9
bm.to_mesh(h.data);bm.free();h.data.update()
s.frame_set(1);bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'brand/characters/marcus/marcus_neck_test.blend'))
cam=s.camera;s.cycles.samples=16;s.render.resolution_x=600;s.render.resolution_y=600
for name,pos,target,frame in [('neck_test_front.png',(0,-4,1.5),(0,0,1.48),7),('neck_test_rear.png',(0,4,1.5),(0,0,1.48),19),('neck_test_side.png',(4,0,1.5),(0,0,1.48),7)]:
 cam.data.ortho_scale=.6;cam.location=pos;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();s.frame_set(frame);s.render.filepath=str(ROOT/'docs/previews/marcus'/name);bpy.ops.render.render(write_still=True)
cam.data.ortho_scale=2.18;cam.location=(2,-5,1.55);cam.rotation_euler=(Vector((0,0,.86))-cam.location).to_track_quat('-Z','Y').to_euler();s.render.resolution_x=400;s.render.resolution_y=500;s.cycles.samples=8
frames=[]
for frame in range(1,25,2):
 s.frame_set(frame);s.render.filepath=f'/tmp/marcus_neck_motion_{frame:02d}.png';bpy.ops.render.render(write_still=True);frames.append(Image.open(s.render.filepath).convert('RGB'))
frames[0].save(ROOT/'docs/previews/marcus/neck_test_motion.gif',save_all=True,append_images=frames[1:],duration=167,loop=0,optimize=True)
print('Saved experimental neck extension and renders',flush=True);os._exit(0)
