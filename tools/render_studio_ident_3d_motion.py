#!/usr/bin/env python3
"""Render a camera/light movement from the real Blender studio-ident scene."""
from pathlib import Path
import math, os
import bpy
from mathutils import Vector
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'brand/studio/dyoungs_studio_ident.blend'))
scene=bpy.context.scene
scene.render.resolution_x=720; scene.render.resolution_y=540; scene.render.resolution_percentage=100
scene.cycles.samples=8; scene.cycles.use_denoising=True
scene.render.image_settings.file_format='PNG'
camera=scene.camera
light=bpy.data.objects['Warm metal rim']
frames_dir=Path('/tmp/leverage-studio-ident-frames'); frames_dir.mkdir(exist_ok=True)
frames=[]
for i in range(32):
    t=i/31
    angle=0.5*(1-(t*t*(3-2*t)))
    camera.location=(12*math.sin(angle),-12*math.cos(angle),3.8-0.8*t)
    camera.rotation_euler=(Vector((0,0,2.45))-camera.location).to_track_quat('-Z','Y').to_euler()
    light.location.x=3.5-6*t
    light.rotation_euler=(Vector((0,0,2.8))-light.location).to_track_quat('-Z','Y').to_euler()
    path=frames_dir/f'frame_{i:03}.png'; scene.render.filepath=str(path)
    bpy.ops.render.render(write_still=True)
    frames.append(Image.open(path).convert('RGB'))
out=ROOT/'docs/previews/dyoungs_studio_3d_motion.gif'
frames[0].save(out,save_all=True,append_images=frames[1:],duration=125,loop=0,optimize=True)
print('Saved 3D motion preview:',out,flush=True)
# This sandbox's bpy wheel can crash during interpreter shutdown. All frames
# and the GIF have been written before this explicit process exit.
os._exit(0)
