#!/usr/bin/env python3
"""Experimental phone fit on approved body-preview rig; not a pickup scene."""
import bpy,os,json,math
from pathlib import Path
from mathutils import Vector,Matrix
from PIL import Image
R=Path(__file__).resolve().parents[1]
# Reuse exactly the body retarget builder; stop before its preview-render loop.
source=(R/'tools/preview_cmu_phone_body.py').read_text();marker='# The 60 fps catalogue'
assert source.count(marker)==1
exec(compile(source.split(marker)[0],str(R/'tools/preview_cmu_phone_body.py'),'exec'))
# Place original 3D phone geometry on a separate control, without editing the source.
needed=['machined phone body','black front bezel','glass panel','display surface','earpiece','decline button','answer button','side button','side button.001','call state','caller name','caller detail','lower note','decline caption','answer caption']
with bpy.data.libraries.load(str(R/'brand/intro/phone/incoming_call_study.blend'),link=False) as (available,loaded):loaded.objects=[n for n in available.objects if n in needed]
phone=bpy.data.objects.new('phone grip control',None);s.collection.objects.link(phone)
for ob in loaded.objects:s.collection.objects.link(ob);ob.parent=phone
s.frame_set(23);bpy.context.view_layer.update();point=lambda n:rig.matrix_world @ rig.pose.bones[n].head
w=point('LeftHand');f=point('LeftHandMiddle3');th=point('LeftHandThumb3');pk=point('LeftHandPinky3');head=point('Head');y=(f-w).normalized();x=th-pk;x=(x-y*x.dot(y)).normalized();z=x.cross(y).normalized();mid=(w+f)*.5
if z.dot(head-mid)<0:x=-x;z=-z
mid+=z*.012+x*(-.015)+y*(-.01)+z*.018
phone.matrix_world=Matrix(((x.x,y.x,z.x,mid.x),(x.y,y.y,z.y,mid.y),(x.z,y.z,z.z,mid.z),(0,0,0,1)))
for name,angle in [('LeftHandThumb',-.2),('LeftHandIndex',-.3),('LeftHandMiddle',-.2),('LeftHandRing',-.4),('LeftHandPinky',-.2)]:
 for b in rig.pose.bones:
  if b.name.startswith(name):b.rotation_mode='XYZ';b.rotation_euler.x=angle
bpy.context.view_layer.update();reference=phone.matrix_world.copy();hand_ref=(rig.matrix_world@rig.pose.bones['LeftHand'].matrix).copy()
mesh=bpy.data.objects['char1'];gps={g.index:g.name for g in mesh.vertex_groups};labels=['Head','LeftHand','LeftHandThumb','LeftHandIndex','LeftHandMiddle','LeftHandRing','LeftHandPinky']
ids={label:[i for i,v in enumerate(mesh.data.vertices) if any(g.weight>.5 and (gps.get(g.group,'')==label if label in ('Head','LeftHand') else gps.get(g.group,'').startswith(label)) for g in v.groups)] for label in labels}
report={};images=[];s.render.resolution_x=480;s.render.resolution_y=480;s.cycles.samples=6
for i in range(61):
 f=1+i/2
 s.frame_set(int(f),subframe=f%1);bpy.context.view_layer.update();phone.matrix_world=(rig.matrix_world@rig.pose.bones['LeftHand'].matrix)@hand_ref.inverted()@reference;bpy.context.view_layer.update()
 ev=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get());em=ev.to_mesh();conv=phone.matrix_world.inverted()@ev.matrix_world;item={}
 for name,vi in ids.items():
  inside=0;nearest=100
  for idx in vi:
   v=conv@em.vertices[idx].co;inside+=int(-.039<v.x<.039 and -.079<v.y<.079 and 0<v.z<.010);d=math.sqrt(max(abs(v.x)-.039,0)**2+max(abs(v.y)-.079,0)**2+max(-v.z,0,v.z-.010)**2);nearest=min(nearest,d)
  item[name]={'vertices_inside_phone_box':inside,'min_distance_mm':round(nearest*1000,2)}
 ev.to_mesh_clear();report[str(f)]=item
 s.render.filepath=f'/tmp/cmu_phone_grip_{i:03}.png';bpy.ops.render.render(write_still=True);im=Image.open(s.render.filepath).convert('RGB');images.append(im.copy())
 if i==44:
  # Offline close views reveal placement; not a user-facing device screenshot.
  oldloc=cam.location.copy();oldrot=cam.rotation_euler.copy();oldscale=cam.data.ortho_scale;cam.data.ortho_scale=.64;s.render.resolution_x=800;s.render.resolution_y=800;s.cycles.samples=12
  for name,loc in [('front',(1.7,-3.4,1.8)),('rear',(3,2.5,1.8))]:
   cam.location=loc;cam.rotation_euler=(Vector((0,-.01,1.56))-cam.location).to_track_quat('-Z','Y').to_euler();s.render.filepath=str(R/f'docs/previews/intro/cmu_phone_grip_{name}.png');bpy.ops.render.render(write_still=True)
  cam.location=oldloc;cam.rotation_euler=oldrot;cam.data.ortho_scale=oldscale;s.render.resolution_x=480;s.render.resolution_y=480;s.cycles.samples=6
images[0].save(R/'docs/previews/intro/cmu_phone_grip_motion.gif',save_all=True,append_images=images[1:],duration=83,loop=0,optimize=False)
(R/'docs/previews/intro/cmu_phone_grip_audit.json').write_text(json.dumps({'method':'more-than-50-percent-weighted vertices tested against approximate phone bounding box, half-frame samples only; not continuous, full mesh or triangle-intersection QA','source_frames':'100-400 at intervals of 10','assumed_source_fps':60,'frames':report},indent=2)+'\n')
print('Phone-hold experiment saved; not a finished pickup',flush=True);os._exit(0)
