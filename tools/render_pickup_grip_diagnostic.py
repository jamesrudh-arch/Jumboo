#!/usr/bin/env python3
"""Experimental finger-side pickup diagnostic; not a production scene."""
import bpy,os,math,json
from pathlib import Path
from mathutils import Vector,Matrix,Quaternion
R=Path(__file__).resolve().parents[1];bpy.ops.wm.open_mainfile(filepath=str(R/'brand/intro/phone/incoming_call_study.blend'));s=bpy.context.scene
phone=bpy.data.objects.new('phone control',None);s.collection.objects.link(phone)
for o in list(s.objects):
 if (o.type in {'MESH','FONT'} and o.name!='bench') or o.name=='screen light':o.parent=phone
phone.location=(-.325,-.30,1.0);phone.rotation_mode='QUATERNION';phone.rotation_quaternion=Quaternion(Vector((0,0,1)),math.pi/2)
bench=bpy.data.objects['bench'];bench.location=(-.4,-.45,.9825);bench.dimensions=(.85,.55,.035)
bpy.ops.import_scene.gltf(filepath=str(R/'brand/characters/marcus/marcus_approved_source.glb'));rig=next(o for o in s.objects if o.type=='ARMATURE');rig.animation_data_clear()
for b in rig.pose.bones:b.matrix_basis.identity()
for n in ('RightArm','RightForeArm'):
 b=rig.pose.bones[n];b.rotation_mode='XYZ'
for f,arm,fore in [(1,(0,0,0),(0,0,0)),(16,(-.721,0,0),(.372,0,-.613)),(22,(-.721,0,0),(.372,0,-.613)),(40,(-.365,0,0),(-.963,-.486,-.749))]:
 for name,v in [('RightArm',arm),('RightForeArm',fore)]:
  b=rig.pose.bones[name];b.rotation_euler=v;b.keyframe_insert('rotation_euler',frame=f)
s.frame_set(16);bpy.context.view_layer.update()
wrist=rig.pose.bones['RightHand'];wrist.rotation_mode='QUATERNION';basis=wrist.matrix.to_quaternion();turn=basis.inverted() @ Quaternion(Vector((0,1,0)),math.radians(-70)) @ basis
for f,q in [(1,Quaternion()),(16,turn),(22,turn),(40,turn)]:wrist.rotation_quaternion=q;wrist.keyframe_insert('rotation_quaternion',frame=f)
# Adjust reach and wrist orientation so the fingers approach the long edges.
s.frame_set(22);bpy.context.view_layer.update();orient=wrist.matrix.to_quaternion();axis=(rig.pose.bones['RightHandMiddle1'].head-wrist.head).normalized();desired=Quaternion(axis,math.radians(90)) @ orient
for frame in (16,22):
 for name,rot in [('RightArm',(-.401,0,0)),('RightForeArm',(-.35,0,-.6))]:
  b=rig.pose.bones[name];b.rotation_euler=rot;b.keyframe_insert('rotation_euler',frame=frame)
s.frame_set(22);bpy.context.view_layer.update();cur=wrist.matrix.to_quaternion();grip=wrist.rotation_quaternion @ cur.inverted() @ desired
for frame in (16,22,40):wrist.rotation_quaternion=grip;wrist.keyframe_insert('rotation_quaternion',frame=frame)
for b in rig.pose.bones:
 if b.name.startswith(('RightHandIndex','RightHandMiddle','RightHandRing','RightHandPinky')):
  b.rotation_mode='XYZ'
  for frame,angle in [(1,0),(16,0),(22,-.35),(40,-.35)]:b.rotation_euler.x=angle;b.keyframe_insert('rotation_euler',frame=frame)
s.frame_set(22);bpy.context.view_layer.update()
for n in ('RightHand','RightHandMiddle3','RightHandIndex3','RightHandThumb3'):
 print(n,tuple(round(v,3) for v in rig.matrix_world@rig.pose.bones[n].head),flush=True)
bind=(rig.matrix_world @ rig.pose.bones['RightHand'].matrix).copy();initial=phone.matrix_world.copy()
for f in range(1,41):
 s.frame_set(f);bpy.context.view_layer.update()
 if f>=22:
  M=(rig.matrix_world @ rig.pose.bones['RightHand'].matrix) @ bind.inverted() @ initial
  phone.location,phone.rotation_quaternion,phone.scale=M.decompose();phone.rotation_mode='QUATERNION'
 else:phone.location=(-.325,-.30,1.0);phone.rotation_mode='QUATERNION';phone.rotation_quaternion=Quaternion(Vector((0,0,1)),math.pi/2);phone.scale=(1,1,1)
 phone.keyframe_insert('location',frame=f);phone.keyframe_insert('rotation_quaternion',frame=f);phone.keyframe_insert('scale',frame=f)
for o in [bpy.data.objects['window'],bpy.data.objects['warm lamp']]:o.data.energy=0
s.world.color=(.09,.09,.09)
def light(name,loc,energy,size,target):
 d=bpy.data.lights.new(name,'AREA');d.energy=energy;d.size=size;o=bpy.data.objects.new(name,d);s.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
light('key',(-1,-2,3),350,3,(0,0,1));light('rim',(1,1,2),220,2,(0,0,1))
cam=s.camera;cam.location=(-1.8,-2.8,1.8);cam.data.lens=55;cam.rotation_euler=(Vector((-.3,-.15,1.2))-cam.location).to_track_quat('-Z','Y').to_euler();s.render.engine='CYCLES';s.cycles.samples=12;s.cycles.use_denoising=True;s.render.resolution_x=960;s.render.resolution_y=720
# Sample high-weight finger vertices against the phone's bounding box. This is
# a coarse diagnostic, not a triangle intersection or continuous-motion test.
mesh=next(o for o in s.objects if o.type=='MESH' and o.name.startswith('char1'))
groups={g.index:g.name for g in mesh.vertex_groups};labels=('RightHandThumb','RightHandIndex','RightHandMiddle','RightHandRing','RightHandPinky')
ids={name:[i for i,v in enumerate(mesh.data.vertices) if any(g.weight>.5 and groups.get(g.group,'').startswith(name) for g in v.groups)] for name in labels}
report={}
for f,name in ((22,'pickup_grip_contact.png'),(40,'pickup_grip_hold.png')):
 s.frame_set(f);bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();ev=mesh.evaluated_get(deps);evaluated=ev.to_mesh();to_phone=phone.matrix_world.inverted() @ ev.matrix_world
 result={}
 for label,indices in ids.items():
  nearest=1e9;inside=0
  for idx in indices:
   v=to_phone @ evaluated.vertices[idx].co
   inside+=int(-.039<v.x<.039 and -.079<v.y<.079 and 0<v.z<.010)
   dist=math.sqrt(max(abs(v.x)-.039,0)**2+max(abs(v.y)-.079,0)**2+max(-v.z,0,v.z-.010)**2);nearest=min(nearest,dist)
  result[label]={'sampled_vertices':len(indices),'minimum_distance_to_box_m':round(nearest,6),'vertices_inside_box':inside}
 ev.to_mesh_clear();report[str(f)]=result
 if f==22:cam.location=(-.85,-1.15,1.55);cam.data.lens=80;target=(-.32,-.30,1.025)
 else:cam.location=(-1,-1.5,1.7);cam.data.lens=100;target=(-.25,-.33,1.29)
 cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler()
 s.render.filepath=str(R/'docs/previews/intro'/name);bpy.ops.render.render(write_still=True)
(R/'docs/previews/intro/pickup_grip_metrics.json').write_text(json.dumps({'method':'weighted vertex-to-phone bounding box; snapshots only, not triangle collision or continuous contact proof','frames':report},indent=2)+'\n')
os._exit(0)
