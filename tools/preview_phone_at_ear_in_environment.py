#!/usr/bin/env python3
"""Offline lighting/framing test; not an assertion of intro story location/order."""
from pathlib import Path
import bpy, os
from PIL import Image
R = Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(R/'brand/intro/cinematic_shot_study.blend'))
s = bpy.context.scene
# Preserve the approved environment/camera; replace only its static stand-in.
oldrig = bpy.data.objects['Armature']
for obj in list(oldrig.children): bpy.data.objects.remove(obj, do_unlink=True)
bpy.data.objects.remove(oldrig, do_unlink=True)
phone_parts = ['phone grip control','side button.001','side button','machined phone body','lower note','glass panel','earpiece','display surface','decline caption','decline button','caller name','caller detail','call state','black front bezel','answer caption','answer button']
wanted = ['Armature','char1'] + phone_parts
with bpy.data.libraries.load(str(R/'brand/intro/phone/phone_at_ear_study.blend'), link=False) as (available, loaded):
    assert all(n in available.objects for n in wanted)
    loaded.objects = wanted
for obj in loaded.objects:
    if obj.name not in s.collection.objects: s.collection.objects.link(obj)
s.frame_start=1; s.frame_end=31; s.frame_set(27)
s.render.engine='CYCLES'; s.cycles.samples=16; s.cycles.use_denoising=True
s.render.resolution_x=960; s.render.resolution_y=540; s.render.resolution_percentage=100
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(R/'brand/intro/phone/environment_phone_at_ear_study.blend'))
s.render.filepath=str(R/'docs/previews/intro/environment_phone_at_ear_frame.png')
bpy.ops.render.render(write_still=True)
# Render whole frames only: the saved prop animation was sampled at half frames.
s.render.resolution_x=640; s.render.resolution_y=360; s.cycles.samples=6
images=[]
for frame in range(1,32):
    s.frame_set(frame); s.render.filepath=f'/tmp/environment_phone_{frame:03}.png'
    bpy.ops.render.render(write_still=True)
    with Image.open(s.render.filepath) as im: images.append(im.convert('RGB'))
images[0].save(R/'docs/previews/intro/environment_phone_at_ear_motion.gif',save_all=True,append_images=images[1:],duration=166,loop=0,optimize=False)
print('Offline environment and phone motion study saved',flush=True);os._exit(0)
