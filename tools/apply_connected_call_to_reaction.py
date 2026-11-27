#!/usr/bin/env python3
"""Create a separate call-performance scene with a connected phone display."""
from pathlib import Path
import bpy,os
from mathutils import Vector
R=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(R/'brand/intro/phone/call_reaction_study.blend'));s=bpy.context.scene
# The entire source performance begins after the call connects. Do not modify it.
bpy.data.objects['call state'].data.body='CALL CONNECTED'
bpy.data.objects['lower note'].data.body='Voice call'
bpy.data.objects['answer button'].hide_render=True;bpy.data.objects['answer button'].hide_viewport=True
bpy.data.objects['answer caption'].hide_render=True;bpy.data.objects['answer caption'].hide_viewport=True
red=bpy.data.objects['decline button'];red.location.x=0
caption=bpy.data.objects['decline caption'];caption.location.x=0;caption.data.body='END CALL'
base=bpy.data.objects['caller detail'];base.hide_render=True;base.hide_viewport=True
# Frame 23 is dialogue start; source study maps 78 frames to 24.3596 seconds.
duration=24.359614512471655
for sec in range(25):
 ob=base.copy();ob.data=base.data.copy();ob.name=f'elapsed call {sec:02d}';ob.data.body=f'00:{sec:02d}';s.collection.objects.link(ob)
 start=23+sec*78/duration;end=23+(sec+1)*78/duration
 marks={23.0:sec!=0,start:False,end:True}
 for f,hidden in sorted(marks.items()):
  for prop in ('hide_render','hide_viewport'):
   setattr(ob,prop,hidden);ob.keyframe_insert(data_path=prop,frame=f)
 if ob.animation_data and ob.animation_data.action:
  for curve in ob.animation_data.action.fcurves:
   for point in curve.keyframe_points:point.interpolation='CONSTANT'
s.frame_start=23;s.frame_end=101;s.frame_set(23);bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(R/'brand/intro/phone/connected_call_performance_study.blend'))
# A diagnostic view from the screen side: this is not a proposed cinematic shot.
f=23+8*78/duration;s.frame_set(int(f),subframe=f%1);bpy.context.view_layer.update();phone=bpy.data.objects['phone grip control'];normal=(phone.matrix_world.to_3x3()@Vector((0,0,1))).normalized();target=phone.matrix_world@Vector((0,0,.009))
cam=s.camera;cam.data.type='ORTHO';cam.data.ortho_scale=.26;cam.location=target+normal*.5;cam.rotation_euler=phone.matrix_world.to_quaternion().to_euler()
s.render.resolution_x=640;s.render.resolution_y=640;s.render.resolution_percentage=100;s.cycles.samples=12;s.render.filepath=str(R/'docs/previews/intro/connected_call_in_hand_diagnostic.png');bpy.ops.render.render(write_still=True)
# Second diagnostic hides the head/hand to inspect the screen, not a normal shot.
for name in ('char1','provisional mouth interior'):
 ob=bpy.data.objects.get(name)
 if ob:ob.hide_render=True
s.render.filepath=str(R/'docs/previews/intro/connected_call_screen_isolated.png');bpy.ops.render.render(write_still=True)
print('Separate connected-call performance scene saved',flush=True);os._exit(0)
