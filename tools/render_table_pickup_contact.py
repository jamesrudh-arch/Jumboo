#!/usr/bin/env python3
"""Render the experimental table-to-ear pickup; no dialogue or final edit.

Requires Blender 4.2 Python and imageio-ffmpeg. The authored scene is the
source: this script only sets a diagnostic camera and renders half-frames.
"""
from pathlib import Path
import subprocess
import tempfile
import bpy
import imageio_ffmpeg
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
scene_path = ROOT / 'brand/intro/phone/experiments/table_pickup_contact_study.blend'
output = ROOT / 'docs/previews/intro/table_pickup_contact_study.mp4'
bpy.ops.wm.open_mainfile(filepath=str(scene_path))
s = bpy.context.scene
camera = s.camera
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 1.18
camera.location = (1.8, -4, 1.8)
camera.rotation_euler = (Vector((.18, -.16, 1.30)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
s.render.resolution_x = 480
s.render.resolution_y = 480
s.render.resolution_percentage = 100
s.render.engine = 'CYCLES'
s.cycles.samples = 6
s.cycles.use_denoising = True
with tempfile.TemporaryDirectory(prefix='pickup-contact-') as tmp:
    frames = Path(tmp)
    for i in range(45):
        f = 1 + i / 2
        s.frame_set(int(f), subframe=f % 1)
        s.render.filepath = str(frames / f'frame_{i:03d}.png')
        bpy.ops.render.render(write_still=True)
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-y', '-framerate', '12',
                    '-i', str(frames / 'frame_%03d.png'), '-c:v', 'libx264',
                    '-pix_fmt', 'yuv420p', '-crf', '19', '-movflags', '+faststart',
                    str(output)], check=True)
print(f'Wrote {output}', flush=True)
