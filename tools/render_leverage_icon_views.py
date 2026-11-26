#!/usr/bin/env python3
"""Render side and rear inspection views from the existing 3D icon scene."""
from pathlib import Path
import os
import bpy
from mathutils import Vector
root=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(root/'brand/leverage/leverage_icon_3d.blend'))
s=bpy.context.scene;cam=s.camera
for name,position in [('side',(9,0,3.5)),('rear',(0,9,3.5))]:
 cam.location=position;cam.rotation_euler=(Vector((0,0,3.5))-cam.location).to_track_quat('-Z','Y').to_euler();s.render.filepath=str(root/f'docs/previews/leverage_icon_3d_{name}.png');bpy.ops.render.render(write_still=True)
print('Side/rear icon views saved',flush=True);os._exit(0)
