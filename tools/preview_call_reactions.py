#!/usr/bin/env python3
"""Provisional dialogue-timed head and facial reactions, layered on the call study."""
from pathlib import Path
import bpy,os,math
import numpy as np
from mathutils import Vector,Euler
R=Path(__file__).resolve().parents[1];bpy.ops.wm.open_mainfile(filepath=str(R/'brand/intro/phone/mouth_motion_study.blend'));s=bpy.context.scene;rig=bpy.data.objects['Armature'];mesh=bpy.data.objects['char1'];brow=mesh.shape_key_add(name='Concerned brows');head=mesh.vertex_groups['Head'].index
for i,v in enumerate(mesh.data.vertices):
 x,y,z=mesh.matrix_world@v.co;w=sum(g.weight for g in v.groups if g.group==head)
 if w<.25:continue
 wx=math.exp(-((abs(x)-.032)/.023)**4);wz=math.exp(-((z-1.681)/.012)**4);wy=max(0,min(1,(-y-.036)/.025));weight=wx*wz*wy*w
 brow.data[i].co.z-=weight*.24;brow.data[i].co.x-=math.copysign(weight*.07,x)
 mouthcorner=math.exp(-((abs(x)-.019)/.012)**4)*math.exp(-((z-1.596)/.012)**4)*wy*w
 brow.data[i].co.z-=mouthcorner*.23
# Time (seconds), head local Euler offsets in degrees and brow tension. Small
# manual acting accents, layered over the approved mocap, not captured acting.
beats=[(0,0,0,0,0),(1.8,0,0,0,0),(2.6,-2.5,0,-1.0,.55),(3.5,1.5,0,-1.5,.8),(5.7,0,0,0,.45),(6.4,-1.0,0,0,.5),(7.4,0,0,0,.55),(9,-2.0,0,1.5,.85),(11,1.5,0,1,.75),(13.5,-1.5,0,0,.9),(14.5,0,0,-1,.85),(17.8,1,0,0,.7),(18.6,-2.5,0,1.5,1),(19.7,1.5,0,1,1),(21,0,0,0,.9),(22.4,-1.5,0,-1,.9),(24.36,0,0,0,.75)]
duration=24.359614512471655;sampletimes=[i/8 for i in range(math.ceil(duration*8))];pose=[];bone=rig.pose.bones['Head']
for t in sampletimes:
 f=23+t*78/duration;s.frame_set(int(f),subframe=f%1);bpy.context.view_layer.update();pose.append(bone.rotation_quaternion.copy())
for t,q in zip(sampletimes,pose):
 f=23+t*78/duration;vals=[float(np.interp(t,[b[0] for b in beats],[b[i] for b in beats])) for i in range(1,5)];bone.rotation_quaternion=q@Euler(tuple(math.radians(v) for v in vals[:3]),'XYZ').to_quaternion();bone.keyframe_insert(data_path='rotation_quaternion',frame=f);brow.value=vals[3];brow.keyframe_insert(data_path='value',frame=f)
for shape in (mesh.data.shape_keys,):
 if shape.animation_data and shape.animation_data.action:
  for curve in shape.animation_data.action.fcurves:
   if 'Concerned brows' in curve.data_path:
    for point in curve.keyframe_points:point.interpolation='LINEAR'
# Linear interpolation for authored head accents; leave other mocap channels intact.
if rig.animation_data and rig.animation_data.action:
 for curve in rig.animation_data.action.fcurves:
  if curve.data_path == 'pose.bones["Head"].rotation_quaternion':
   for point in curve.keyframe_points:point.interpolation='LINEAR'
cam=s.camera;cam.data.type='ORTHO';cam.data.ortho_scale=.52;cam.location=(.8,-5,1.67);cam.rotation_euler=(Vector((.04,-.03,1.60))-cam.location).to_track_quat('-Z','Y').to_euler();s.render.resolution_x=320;s.render.resolution_y=320;s.cycles.samples=4;s.cycles.use_denoising=True
s.frame_start=23;s.frame_end=101;s.frame_set(23);bpy.ops.wm.save_as_mainfile(filepath=str(R/'brand/intro/phone/call_reaction_study.blend'))
# Sample coarse head vs approximate phone box, not continuous or triangle QA.
phone=bpy.data.objects['phone grip control'];groups={g.index:g.name for g in mesh.vertex_groups};head_ids=[i for i,v in enumerate(mesh.data.vertices) if any(groups.get(g.group)=='Head' and g.weight>.5 for g in v.groups)]
from PIL import Image
import subprocess,imageio_ffmpeg,wave,json
frame_dir=Path('/tmp/marcus_call_reactions');frame_dir.mkdir(exist_ok=True);measurements=[]
for i,t in enumerate(sampletimes):
 f=23+t*78/duration;s.frame_set(int(f),subframe=f%1);bpy.context.view_layer.update();ev=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get());em=ev.to_mesh();conv=phone.matrix_world.inverted()@ev.matrix_world;inside=0;nearest=100
 for j in head_ids:
  v=conv@em.vertices[j].co;inside+=int(-.039<v.x<.039 and -.079<v.y<.079 and 0<v.z<.010);nearest=min(nearest,math.sqrt(max(abs(v.x)-.039,0)**2+max(abs(v.y)-.079,0)**2+max(-v.z,0,v.z-.010)**2))
 ev.to_mesh_clear();measurements.append({'time':round(t,3),'head_vertices_inside_phone_box':inside,'closest_head_vertex_to_box_mm':round(nearest*1000,2),'concern_value':round(brow.value,3)});s.render.filepath=str(frame_dir/f'f_{i:03}.png');bpy.ops.render.render(write_still=True)
voice=R/'brand/intro/call_audio/first_call_preview.wav'
subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-y','-framerate','8','-i',str(frame_dir/'f_%03d.png'),'-i',str(voice),'-t',str(duration),'-c:v','libx264','-pix_fmt','yuv420p','-crf','20','-c:a','aac','-b:a','128k','-movflags','+faststart',str(R/'docs/previews/intro/call_reaction_study.mp4')],check=True)
(R/'docs/previews/intro/call_reaction_audit.json').write_text(json.dumps({'method':'Head weighted vertices against approximate phone box at 8 fps. Not continuous or triangle collision QA.','samples':measurements},indent=2)+'\n')
print('Call reactions study complete',flush=True);os._exit(0)
