#!/usr/bin/env python3
"""Offline automatic incoming-to-connected screen study, not a working phone."""
from pathlib import Path
import bpy,os,subprocess
import imageio_ffmpeg
R=Path(__file__).resolve().parents[1];out=R/'docs/previews/intro';out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(R/'brand/intro/phone/incoming_call_study.blend'));s=bpy.context.scene
# Work on a copy: original approved incoming phone remains untouched.
bpy.data.objects['call state'].data.body='CALL CONNECTED'
bpy.data.objects['lower note'].data.body='Voice call'
bpy.data.objects['answer button'].hide_render=True;bpy.data.objects['answer caption'].hide_render=True
red=bpy.data.objects['decline button'];red.location.x=0
caption=bpy.data.objects['decline caption'];caption.location.x=0;caption.data.body='END CALL'
base=bpy.data.objects['caller detail'];base.hide_render=True
# Separate text objects keep timer change reproducible in the saved .blend.
for sec in range(3):
 text=base.copy();text.data=base.data.copy();text.name=f'connected elapsed {sec:02d}';text.data.body=f'00:0{sec}';s.collection.objects.link(text)
 for f in (1,sec*12+1,(sec+1)*12+1,37):
  if f>37:continue
  text.hide_render=not(sec*12+1<=f<(sec+1)*12+1);text.keyframe_insert(data_path='hide_render',frame=f)
 if text.animation_data and text.animation_data.action:
  for curve in text.animation_data.action.fcurves:
   for point in curve.keyframe_points:point.interpolation='CONSTANT'
s.frame_start=1;s.frame_end=36;s.render.fps=12;s.render.engine='CYCLES';s.cycles.samples=8;s.cycles.use_denoising=True;s.render.resolution_x=768;s.render.resolution_y=432;s.render.resolution_percentage=100;s.frame_set(1)
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(R/'brand/intro/phone/connected_call_study.blend'))
frames=Path('/tmp/connected_call_frames');frames.mkdir(exist_ok=True)
for f in range(1,37):
 s.frame_set(f);s.render.filepath=str(frames/f'f_{f:03}.png');bpy.ops.render.render(write_still=True)
 if f==16:
  from PIL import Image
  with Image.open(s.render.filepath) as im:im.save(out/'connected_call_study.png')
# An editorial cut shows automatic connection, not a hand or pickup animation.
# Incoming sound ends at 2.5s, dialogue starts immediately after that cut.
filters='[0:v]trim=duration=2.5,setpts=PTS-STARTPTS[v0];[1:v]trim=duration=3,setpts=PTS-STARTPTS[v1];[v0][v1]concat=n=2:v=1:a=0[video];[0:a]atrim=duration=2.5,asetpts=PTS-STARTPTS[a0];[2:a]atrim=duration=3,asetpts=PTS-STARTPTS[a1];[a0][a1]concat=n=2:v=0:a=1[audio]'
subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-y','-i',str(out/'incoming_call_motion.mp4'),'-framerate','12','-i',str(frames/'f_%03d.png'),'-i',str(R/'brand/intro/call_audio/first_call_preview.wav'),'-filter_complex',filters,'-map','[video]','-map','[audio]','-c:v','libx264','-pix_fmt','yuv420p','-crf','20','-c:a','aac','-b:a','128k','-movflags','+faststart',str(out/'connected_call_transition.mp4')],check=True)
print('Connected screen study saved',flush=True);os._exit(0)
