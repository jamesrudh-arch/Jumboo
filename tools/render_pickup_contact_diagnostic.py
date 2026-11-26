#!/usr/bin/env python3
"""Reproduce a failed pickup contact diagnostic; not a production animation."""
import bpy,os,math
from pathlib import Path
from mathutils import Vector,Matrix
R=Path(__file__).resolve().parents[1];bpy.ops.wm.open_mainfile(filepath=str(R/'brand/intro/phone/incoming_call_study.blend'));s=bpy.context.scene
phone=bpy.data.objects.new('phone control',None);s.collection.objects.link(phone)
for o in list(s.objects):
 if (o.type in {'MESH','FONT'} and o.name!='bench') or o.name=='screen light':o.parent=phone
phone.location=(-.408,-.35,.925)
bench=bpy.data.objects['bench'];bench.location=(-.4,-.45,.907);bench.dimensions=(.85,.55,.035)
bpy.ops.import_scene.gltf(filepath=str(R/'brand/characters/marcus/marcus_approved_source.glb'));rig=next(o for o in s.objects if o.type=='ARMATURE');rig.animation_data_clear()
for b in rig.pose.bones:b.matrix_basis.identity()
for n in ('RightArm','RightForeArm'):
 b=rig.pose.bones[n];b.rotation_mode='XYZ'
for f,arm,fore in [(1,(0,0,0),(0,0,0)),(16,(-.721,0,0),(.372,0,-.613)),(22,(-.721,0,0),(.372,0,-.613)),(40,(-.365,0,0),(-.963,-.486,-.749))]:
 for name,v in [('RightArm',arm),('RightForeArm',fore)]:
  b=rig.pose.bones[name];b.rotation_euler=v;b.keyframe_insert('rotation_euler',frame=f)
s.frame_set(22);bpy.context.view_layer.update();bind=(rig.matrix_world @ rig.pose.bones['RightHand'].matrix).copy();initial=phone.matrix_world.copy()
for f in range(1,41):
 s.frame_set(f);bpy.context.view_layer.update()
 if f>=22:
  M=(rig.matrix_world @ rig.pose.bones['RightHand'].matrix) @ bind.inverted() @ initial
  phone.location,phone.rotation_quaternion,phone.scale=M.decompose();phone.rotation_mode='QUATERNION'
 else:phone.location=(-.408,-.35,.925);phone.rotation_mode='QUATERNION';phone.rotation_quaternion=(1,0,0,0);phone.scale=(1,1,1)
 phone.keyframe_insert('location',frame=f);phone.keyframe_insert('rotation_quaternion',frame=f);phone.keyframe_insert('scale',frame=f)
for o in [bpy.data.objects['window'],bpy.data.objects['warm lamp']]:o.data.energy=0
s.world.color=(.09,.09,.09)
def light(name,loc,energy,size,target):
 d=bpy.data.lights.new(name,'AREA');d.energy=energy;d.size=size;o=bpy.data.objects.new(name,d);s.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
light('key',(-1,-2,3),350,3,(0,0,1));light('rim',(1,1,2),220,2,(0,0,1))
cam=s.camera;cam.location=(-1.8,-2.8,1.8);cam.data.lens=55;cam.rotation_euler=(Vector((-.3,-.15,1.2))-cam.location).to_track_quat('-Z','Y').to_euler();s.render.engine='CYCLES';s.cycles.samples=12;s.cycles.use_denoising=True;s.render.resolution_x=960;s.render.resolution_y=720
for f,name in ((22,'pickup_contact_diagnostic.png'),(40,'pickup_hold_diagnostic.png')):
 s.frame_set(f);s.render.filepath=str(R/'docs/previews/intro'/name);bpy.ops.render.render(write_still=True)
os._exit(0)
