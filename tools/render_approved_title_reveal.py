#!/usr/bin/env python3
"""Render a 3D camera/light pass on the approved title and sync original sting."""
from pathlib import Path
import math,os,subprocess
import bpy
import imageio_ffmpeg
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'brand/leverage/leverage_custom_3d.blend'))
s=bpy.context.scene;s.render.resolution_x=800;s.render.resolution_y=450;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG';s.cycles.samples=8;s.cycles.use_denoising=True
cam=s.camera;light=bpy.data.objects['Warm edge'];frames=Path('/tmp/leverage-approved-title-reveal');frames.mkdir(exist_ok=True)
for i in range(32):
 t=i/31;smooth=t*t*(3-2*t);angle=.34*(1-smooth)
 cam.location=(18*math.sin(angle),-18*math.cos(angle),4.7-.7*smooth);cam.rotation_euler=(Vector((0,0,2.85))-cam.location).to_track_quat('-Z','Y').to_euler()
 light.location.x=5-9*smooth;light.rotation_euler=(Vector((0,0,3.2))-light.location).to_track_quat('-Z','Y').to_euler()
 s.render.filepath=str(frames/f'frame_{i:03}.png');bpy.ops.render.render(write_still=True)
out=ROOT/'docs/previews/leverage_approved_title_reveal.mp4'
subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-y','-framerate','8','-i',str(frames/'frame_%03d.png'),'-i',str(ROOT/'brand/leverage/leverage_title_sting.wav'),'-c:v','libx264','-pix_fmt','yuv420p','-crf','18','-c:a','aac','-b:a','192k','-shortest','-movflags','+faststart',str(out)],check=True)
print('3D title reveal saved:',out,flush=True);os._exit(0)
