#!/usr/bin/env python3
"""Screen CMU 79_36 body motion; not an approved pickup or a prop test."""
from pathlib import Path
import bpy
import os
from PIL import Image

root = Path(__file__).resolve().parents[1]
builder = root / 'tools/preview_cmu_phone_body.py'
source = builder.read_text().split('# The 60 fps catalogue')[0]
source = source.replace('cmu_80_25.bvh', 'cmu_79_36.bvh')
# The BVH contains a synthetic reference frame. Sample 30..510 inclusive.
source = source.replace('frames=list(range(100,401,10))', 'frames=list(range(30,511,30))')
__file__ = str(builder)
exec(compile(source, str(builder), 'exec'))
s.render.resolution_x = 400
s.render.resolution_y = 400
s.cycles.samples = 6
images = []
for frame in range(1, 18):
    s.frame_set(frame)
    s.render.filepath = f'/tmp/cmu_79_36_{frame:03}.png'
    bpy.ops.render.render(write_still=True)
    with Image.open(s.render.filepath) as image:
        images.append(image.convert('RGB'))
images[0].save(root / 'docs/previews/intro/cmu_79_36_body_candidate.gif',
               save_all=True, append_images=images[1:], duration=500, loop=0,
               optimize=False)
print('Saved coarse body-only candidate preview', flush=True)
os._exit(0)
