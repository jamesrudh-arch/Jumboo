#!/usr/bin/env python3
"""Render motion from the existing genuine Blender title geometry, no sound."""
from pathlib import Path
import math, os
import bpy
from mathutils import Vector
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'brand/leverage/leverage_title_3d.blend'))
scene=bpy.context.scene
scene.render.resolution_x=800; scene.render.resolution_y=450; scene.render.resolution_percentage=100
scene.cycles.samples=8; scene.cycles.use_denoising=True
scene.render.image_settings.file_format='PNG'
cam=scene.camera; light=bpy.data.objects['Warm edge']
folder=Path('/tmp/leverage-title-motion'); folder.mkdir(exist_ok=True)
frames=[]
for i in range(32):
 t=i/31
 smooth=t*t*(3-2*t)
 angle=.35*(1-smooth)
 cam.location=(18*math.sin(angle),-18*math.cos(angle),4.7-.7*smooth)
 cam.rotation_euler=(Vector((0,0,2.6))-cam.location).to_track_quat('-Z','Y').to_euler()
 light.location.x=5-9*smooth
 light.rotation_euler=(Vector((0,0,2.7))-light.location).to_track_quat('-Z','Y').to_euler()
 path=folder/f'frame_{i:03}.png';scene.render.filepath=str(path);bpy.ops.render.render(write_still=True)
 frames.append(Image.open(path).convert('RGB'))
out=ROOT/'docs/previews/leverage_logo_3d_motion.gif'
frames[0].save(out,save_all=True,append_images=frames[1:],duration=125,loop=0,optimize=True)
print('Saved 3D-rendered motion:',out,flush=True)
os._exit(0)
