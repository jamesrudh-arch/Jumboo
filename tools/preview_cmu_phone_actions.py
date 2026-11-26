#!/usr/bin/env python3
"""Inspect CMU phone-dialing or glass-placement body motion, not a pickup."""
from pathlib import Path
import bpy, os, argparse
from PIL import Image
R = Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(); parser.add_argument('trial', choices=('26', '27')); args=parser.parse_args()
end = 1231 if args.trial == '26' else 1081
count = 41 if args.trial == '26' else 36
p = R/'tools/preview_cmu_phone_body.py'
source = p.read_text().split('# The 60 fps catalogue')[0]
source = source.replace('cmu_80_25.bvh', f'cmu_80_{args.trial}.bvh')
# Avoid reference frame 1; examine the whole trial at a coarse 30-frame interval.
source = source.replace('frames=list(range(100,401,10))', f'frames=list(range(30,{end},30))')
__file__=str(p); exec(compile(source, str(p), 'exec'))
s.render.resolution_x=400; s.render.resolution_y=400; s.cycles.samples=6
images=[]
for frame in range(1,count+1):
    s.frame_set(frame); s.render.filepath=f'/tmp/cmu_80_{args.trial}_{frame:03}.png'
    bpy.ops.render.render(write_still=True)
    with Image.open(s.render.filepath) as im: images.append(im.convert('RGB'))
images[0].save(R/f'docs/previews/intro/cmu_80_{args.trial}_body_candidate.gif',save_all=True,append_images=images[1:],duration=500,loop=0,optimize=False)
print('Candidate body-only inspection saved',flush=True); os._exit(0)
