#!/usr/bin/env python3
"""Body-only CMU 80_08 retarget inspection; not a phone pickup."""
from pathlib import Path
import bpy, os
from PIL import Image
R = Path(__file__).resolve().parents[1]
p = R/'tools/preview_cmu_phone_body.py'
source = p.read_text().split('# The 60 fps catalogue')[0]
source = source.replace('cmu_80_25.bvh', 'cmu_80_08.bvh')
# Avoid reference frame 1; examine the whole trial at a coarse 20-frame interval.
source = source.replace('frames=list(range(100,401,10))', 'frames=list(range(20,881,20))')
exec(compile(source, str(p), 'exec'))
s.render.resolution_x=400; s.render.resolution_y=400; s.cycles.samples=6
images=[]
for frame in range(1,45):
    s.frame_set(frame); s.render.filepath=f'/tmp/cmu_80_08_{frame:03}.png'
    bpy.ops.render.render(write_still=True)
    with Image.open(s.render.filepath) as im: images.append(im.convert('RGB'))
images[0].save(R/'docs/previews/intro/cmu_80_08_body_candidate.gif',save_all=True,append_images=images[1:],duration=333,loop=0,optimize=False)
print('Candidate body-only inspection saved',flush=True); os._exit(0)
