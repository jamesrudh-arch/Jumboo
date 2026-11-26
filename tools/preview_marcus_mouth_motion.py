#!/usr/bin/env python3
"""Provisional amplitude-driven jaw animation: not phoneme lip sync."""
import bpy,os,math,wave,json,struct
from pathlib import Path
from mathutils import Vector
import numpy as np
R=Path(__file__).resolve().parents[1];bpy.ops.wm.open_mainfile(filepath=str(R/'brand/intro/phone/conversation_motion_study.blend'));s=bpy.context.scene;rig=bpy.data.objects['Armature'];rig.data.pose_position='REST';s.frame_set(23);bpy.context.view_layer.update();o=bpy.data.objects['char1'];o.shape_key_add(name='Basis');sk=o.shape_key_add(name='Talking jaw');gi=o.vertex_groups['Head'].index
for i,v in enumerate(o.data.vertices):
 p=o.matrix_world@v.co;x,y,z=p;head=sum(g.weight for g in v.groups if g.group==gi)
 if head<.25:continue
 wx=max(0,1-abs(x)/.052)**1.4; wy=max(0,min(1,(-y-.035)/.035)); wz=max(0,min(1,(1.6-z)/.008))*max(0,min(1,(z-1.548)/.024));sk.data[i].co.z-=wx*wy*wz*head*.8
sk.value=0;bpy.context.view_layer.update();ev=o.evaluated_get(bpy.context.evaluated_depsgraph_get());inv=ev.matrix_world.inverted();target=[];closed=[];faces=[];N=48
for r in range(4):
 for j in range(N):
  a=2*math.pi*j/N;rr=r/3;x=.018*rr*math.cos(a);z=1.595+.0027*rr*math.sin(a);origin=inv@Vector((x,-1,z));direction=(inv.to_3x3()@Vector((0,1,0))).normalized();hit,loc,_,_=ev.ray_cast(origin,direction);y=(ev.matrix_world@loc).y-.004 if hit else -.092;target.append((x/.01,y/.01,z/.01));closed.append((0,-.092/.01,1.595/.01))
for r in range(3):
 for j in range(N):a=r*N+j;b=r*N+(j+1)%N;faces.append((a,b,b+N,a+N))
m=bpy.data.meshes.new('provisional mouth interior');m.from_pydata(closed,[],faces);m.update();mouth=bpy.data.objects.new('provisional mouth interior',m);s.collection.objects.link(mouth);mouth.matrix_world=o.matrix_world.copy();g=mouth.vertex_groups.new(name='Head');g.add(list(range(len(closed))),1.0,'REPLACE');mod=mouth.modifiers.new('Head deformation','ARMATURE');mod.object=rig;mouth.shape_key_add(name='Basis');key=mouth.shape_key_add(name='Open')
for p,v in zip(key.data,target):p.co=v
mat=bpy.data.materials.new('provisional mouth interior');mat.use_nodes=True;mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.045,.007,.008,1);m.materials.append(mat)
# Marcus-only amplitude drives the jaw; the brother's voice never opens it.
rig.data.pose_position='POSE'
import imageio_ffmpeg,subprocess
wavdir=R/'brand/intro/call_audio';voice=wavdir/'first_call_preview.wav'
with wave.open(str(voice),'rb') as w:rate=w.getframerate();samples=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').astype(np.float32)/32768;duration=len(samples)/rate
lines=[('marcus_01.wav',.35),('brother_01.wav',.25),('marcus_02.wav',.2),('brother_02.wav',.3),('marcus_03.wav',.2),('brother_03.wav',.4),('marcus_04.wav',0)]
segments=[];offset=0.0
for name,pause in lines:
 with wave.open(str(wavdir/name),'rb') as w:seconds=w.getnframes()/w.getframerate()
 segments.append({'name':name,'start':offset,'end':offset+seconds});offset+=seconds+pause
speech=[(x['start'],x['end']) for x in segments if x['name'].startswith('marcus_')]
count=math.ceil(duration*8); values=[]
for i in range(count):
 t=i/8;f=23+t*(78/duration);lo=max(0,int((t-.045)*rate));hi=min(len(samples),int((t+.045)*rate));rms=float(np.sqrt(np.mean(samples[lo:hi]**2))) if hi>lo else 0
 val=min(1,max(0,(rms-.006)*11)) if any(start<=t<end for start,end in speech) else 0
 sk.value=val;key.value=val;sk.keyframe_insert(data_path='value',frame=f);key.keyframe_insert(data_path='value',frame=f);values.append({'time':round(t,3),'value':round(val,4),'marcus_speaking_interval':any(start<=t<end for start,end in speech)})
for shape in (o.data.shape_keys,mouth.data.shape_keys):
 if shape.animation_data and shape.animation_data.action:
  for curve in shape.animation_data.action.fcurves:
   for point in curve.keyframe_points:point.interpolation='LINEAR'
s.frame_start=23;s.frame_end=101;s.frame_set(23)
bpy.ops.wm.save_as_mainfile(filepath=str(R/'brand/intro/phone/mouth_motion_study.blend'))
cam=s.camera;cam.data.type='ORTHO';cam.data.ortho_scale=.52;cam.location=(.8,-5,1.67);cam.rotation_euler=(Vector((.04,-.03,1.60))-cam.location).to_track_quat('-Z','Y').to_euler();s.render.resolution_x=320;s.render.resolution_y=320;s.cycles.samples=4;s.cycles.use_denoising=True
frame_dir=Path('/tmp/marcus_mouth_motion');frame_dir.mkdir(exist_ok=True)
for i in range(count):
 t=i/8;f=23+t*(78/duration);s.frame_set(int(f),subframe=f%1);bpy.context.view_layer.update();s.render.filepath=str(frame_dir/f'f_{i:03}.png');bpy.ops.render.render(write_still=True)
subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-y','-framerate','8','-i',str(frame_dir/'f_%03d.png'),'-i',str(voice),'-t',str(duration),'-c:v','libx264','-pix_fmt','yuv420p','-crf','20','-c:a','aac','-b:a','128k','-movflags','+faststart',str(R/'docs/previews/intro/mouth_motion_study.mp4')],check=True)
(R/'docs/previews/intro/mouth_motion_audit.json').write_text(json.dumps({'method':'Marcus-only mono audio RMS gates a provisional jaw and projected mouth interior; not phoneme alignment or true mouth topology. 8 fps samples.','duration_seconds':duration,'segments':segments,'samples':values},indent=2)+'\n')
print('Provisional mouth movement study complete',flush=True);os._exit(0)
