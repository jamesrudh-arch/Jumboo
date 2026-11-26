#!/usr/bin/env python3
"""Offline CMU retarget feasibility preview; no phone, finger motion or runtime."""
import bpy,os,math
from PIL import Image
from pathlib import Path
from mathutils import Vector,Matrix
R=Path(__file__).resolve().parents[1];bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False);s=bpy.context.scene
bpy.ops.import_anim.bvh(filepath=str(R/'brand/intro/mocap_research/cmu_80_25.bvh'),global_scale=.01,axis_forward='-Z',axis_up='Y',update_scene_fps=False);src=bpy.context.object;src.hide_render=True
before=set(s.objects);bpy.ops.import_scene.gltf(filepath=str(R/'brand/characters/marcus/marcus_approved_source.glb'));rig=next(o for o in set(s.objects)-before if o.type=='ARMATURE');rig.animation_data_clear()
for b in rig.pose.bones:b.matrix_basis.identity();b.rotation_mode='QUATERNION'
bpy.context.view_layer.update();mapping={'Hips':'Hips','Spine':'Spine','neck':'Neck','Head':'Head','LeftShoulder':'LeftShoulder','LeftArm':'LeftArm','LeftForeArm':'LeftForeArm','LeftHand':'LeftHand','RightShoulder':'RightShoulder','RightArm':'RightArm','RightForeArm':'RightForeArm','RightHand':'RightHand','LeftUpLeg':'LeftUpLeg','LeftLeg':'LeftLeg','LeftFoot':'LeftFoot','RightUpLeg':'RightUpLeg','RightLeg':'RightLeg','RightFoot':'RightFoot'}
s.frame_set(1);bpy.context.view_layer.update();src_ref={t:(src.matrix_world.to_quaternion() @ src.pose.bones[n].matrix.to_quaternion()) for t,n in mapping.items()};# Align target shoulder-to-elbow and elbow-to-wrist directions with source's reference T-pose.
for side in ('Left','Right'):
 for bone,child in ((side+'Arm',side+'ForeArm'),(side+'ForeArm',side+'Hand')):
  b=rig.pose.bones[bone];bt=rig.pose.bones[child];sb=src.pose.bones[bone];sc=src.pose.bones[child]
  bpy.context.view_layer.update();tv=(rig.matrix_world.to_3x3() @ (bt.head-b.head)).normalized();sv=(src.matrix_world.to_3x3() @ (sc.head-sb.head)).normalized();delta=tv.rotation_difference(sv);rot=rig.matrix_world.to_quaternion().inverted() @ delta @ rig.matrix_world.to_quaternion() @ b.matrix.to_quaternion();b.matrix=Matrix.Translation(b.head) @ rot.to_matrix().to_4x4();bpy.context.view_layer.update()
dst_ref={t:rig.pose.bones[t].matrix.to_quaternion() for t in mapping}; print('mapping',list(mapping),flush=True)
def depth(b):
 n=0
 while b.parent:b=b.parent;n+=1
 return n
order=sorted(mapping,key=lambda t:depth(rig.pose.bones[t]));frames=list(range(100,401,10));
for k,frame in enumerate(frames,1):
 s.frame_set(frame);bpy.context.view_layer.update()
 for t in order:
  b=rig.pose.bones[t];sq=src.matrix_world.to_quaternion() @ src.pose.bones[mapping[t]].matrix.to_quaternion();delta=sq @ src_ref[t].inverted();dest=rig.matrix_world.to_quaternion().inverted() @ delta @ rig.matrix_world.to_quaternion() @ dst_ref[t];bpy.context.view_layer.update();b.matrix=Matrix.Translation(b.head) @ dest.to_matrix().to_4x4();bpy.context.view_layer.update();b.keyframe_insert(data_path='rotation_quaternion',frame=k)
 print('baked',frame,k,flush=True) if k%10==0 else None
src.animation_data_clear();src.hide_viewport=True
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.002));mat=bpy.data.materials.new('floor');mat.diffuse_color=(.05,.06,.07,1);bpy.context.object.data.materials.append(mat)
def light(loc,power,size):
 d=bpy.data.lights.new('light','AREA');d.energy=power;d.size=size;o=bpy.data.objects.new('light',d);s.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
light((2,-4,5),360,4);light((-3,-2,3),170,4);light((1,3,4),430,3)
c=bpy.data.cameras.new('camera');cam=bpy.data.objects.new('camera',c);s.collection.objects.link(cam);s.camera=cam;c.type='ORTHO';c.ortho_scale=2.2;cam.location=(3,-6,1.5);cam.rotation_euler=(Vector((0,0,1))-cam.location).to_track_quat('-Z','Y').to_euler();s.render.engine='CYCLES';s.cycles.samples=10;s.cycles.use_denoising=True;s.render.resolution_x=600;s.render.resolution_y=600;s.world.color=(.08,.08,.08)
# The 60 fps catalogue rate is an assumption for this preview; the BVH header
# disagrees. The inserted reference frame is never presented as capture.
s.cycles.samples=6;s.render.resolution_x=400;s.render.resolution_y=400
images=[]
for i in range(61):
 f=1+i/2;s.frame_set(int(f),subframe=f%1);s.render.filepath=f'/tmp/cmu_phone_preview_{i:03}.png';bpy.ops.render.render(write_still=True)
 image=Image.open(s.render.filepath).convert('RGB');images.append(image.copy())
 if i==44:image.save(R/'docs/previews/intro/cmu_phone_body_frame.png')
images[0].save(R/'docs/previews/intro/cmu_phone_body_preview.gif',save_all=True,append_images=images[1:],duration=83,loop=0,optimize=False)
print('Saved candidate body-motion preview; no prop or finger animation',flush=True);os._exit(0)
