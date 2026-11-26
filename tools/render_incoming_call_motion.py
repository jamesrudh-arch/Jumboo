#!/usr/bin/env python3
"""Offline incoming-call motion and synthesized sound study, not gameplay."""
import bpy, math, os, struct, wave, subprocess, tempfile
from pathlib import Path
from PIL import Image
import imageio_ffmpeg
R=Path(__file__).resolve().parents[1]; P=R/'brand/intro/phone'; OUT=R/'docs/previews/intro'; OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(P/'incoming_call_study.blend'));s=bpy.context.scene
phone=bpy.data.objects.new('phone motion control',None);s.collection.objects.link(phone)
for obj in list(s.objects):
 if obj.type in {'MESH','FONT'} and obj.name!='bench':obj.parent=phone
lamp=bpy.data.objects['screen light'];lamp.parent=phone
# Two gentle vibration bursts separated by a pause. This is an authored animation, not measured hardware motion.
def pulse(t):return (0<=t<.75) or (1.55<=t<2.3)
s.frame_start=1;s.frame_end=36;s.render.fps=12
for f in range(1,37):
 t=(f-1)/12;active=pulse(t)
 phone.location.x=(.0007 if f%2 else -.0007) if active else 0
 phone.rotation_euler.z=(.004 if f%2 else -.004) if active else 0
 phone.keyframe_insert('location',frame=f);phone.keyframe_insert('rotation_euler',frame=f)
 lamp.data.energy=.022 if active else .006;lamp.data.keyframe_insert('energy',frame=f)
# Soft white emissive rim remains a visual study and does not model the actual display's electronics.
white=bpy.data.materials['cool screen type'];shader=white.node_tree.nodes.get('Principled BSDF');em=shader.inputs['Emission Strength']
for f in range(1,37):
 em.default_value=3.0 if pulse((f-1)/12) else 1.5;em.keyframe_insert('default_value',frame=f)
s.render.engine='CYCLES';s.cycles.samples=8;s.cycles.use_denoising=True;s.render.resolution_x=768;s.render.resolution_y=432;s.render.resolution_percentage=100
s.use_nodes=True;n=s.node_tree.nodes;n.clear();rl=n.new('CompositorNodeRLayers');g=n.new('CompositorNodeGlare');g.glare_type='FOG_GLOW';g.threshold=1.0;g.quality='HIGH';g.size=7;comp=n.new('CompositorNodeComposite');s.node_tree.links.new(rl.outputs['Image'],g.inputs['Image']);s.node_tree.links.new(g.outputs['Image'],comp.inputs['Image'])
s.frame_set(1);bpy.ops.wm.save_as_mainfile(filepath=str(P/'incoming_call_motion.blend'))
with tempfile.TemporaryDirectory(prefix='leverage-call-') as tmp:
 tmp=Path(tmp)
 for f in range(1,37):
  s.frame_set(f);s.render.filepath=str(tmp/('frame_%03d.png'%f));bpy.ops.render.render(write_still=True)
  if f==5:
   Image.open(s.render.filepath).save(OUT/'incoming_call_motion_frame.png')
 # Original synthesized ringing and subtle buzzing, not a recording of a real phone.
 rate=44100;ring=tmp/'ring.wav'
 with wave.open(str(ring),'wb') as w:
  w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate);data=bytearray()
  for i in range(rate*3):
   t=i/rate;local=t if t<.75 else t-1.55;active=pulse(t)
   if active:
    fade=max(0,min(1,local/.04,(.75-local)/.05));sample=fade*(.16*math.sin(2*math.pi*620*t)+.12*math.sin(2*math.pi*820*t)+.035*math.sin(2*math.pi*118*t)*(0.5+0.5*math.sin(2*math.pi*21*t)))
   else:sample=0
   data.extend(struct.pack('<h',int(max(-1,min(1,sample))*32767)))
  w.writeframes(data)
 cmd=[imageio_ffmpeg.get_ffmpeg_exe(),'-y','-loglevel','error','-framerate','12','-i',str(tmp/'frame_%03d.png'),'-i',str(ring),'-c:v','libx264','-pix_fmt','yuv420p','-crf','20','-c:a','aac','-b:a','128k','-movflags','+faststart','-shortest',str(OUT/'incoming_call_motion.mp4')]
 subprocess.run(cmd,check=True)
print('Saved 3D render, animation and synthesized sound',flush=True);os._exit(0)
