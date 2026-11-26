#!/usr/bin/env python3
"""Experimental longer CMU phone-hold body motion, not lip-synced or gameplay."""
from pathlib import Path
import os, json, math
import bpy
import numpy as np
from scipy.optimize import least_squares
from mathutils import Vector, Euler
from PIL import Image

R = Path(__file__).resolve().parents[1]
source = R / 'tools/preview_mocap_phone_grip.py'
# Use the established body/prop fit, stopping before its render and audit loop.
body = (R/'tools/preview_cmu_phone_body.py').read_text().split('# The 60 fps catalogue')[0].replace('frames=list(range(100,401,10))','frames=list(range(100,1101,10))')
__file__=str(R/'tools/preview_cmu_phone_body.py'); exec(compile(body, __file__, 'exec'))
grip = source.read_text().split('# Place original 3D phone geometry')[1].split('\n',1)[1].split("mesh=bpy.data.objects['char1']")[0]
exec(compile(grip, str(source), 'exec'))
names = ('LeftArm', 'LeftForeArm', 'LeftHand')
bones = [rig.pose.bones[n] for n in names]
s.frame_set(23); bpy.context.view_layer.update()
headmatrix = (rig.matrix_world @ rig.pose.bones['Head'].matrix).copy()
ear_local = headmatrix.inverted() @ Vector((.15, -.045, 1.65))
normal_local = headmatrix.to_quaternion().inverted() @ Vector((-.99, 0, 0))
long_local = headmatrix.to_quaternion().inverted() @ Vector((0, 0, 1))
previous = np.array([-.4085, -.5077, .0574, -.2706, .6644, .1231, .3634, .8532, -.1647])
solutions = {}
gaps = {}
for frame in range(23, 102):
    s.frame_set(frame); bpy.context.view_layer.update()
    base = [b.rotation_quaternion.copy() for b in bones]
    hm = rig.matrix_world @ rig.pose.bones['Head'].matrix
    target = hm @ ear_local
    normal_goal = (hm.to_quaternion() @ normal_local).normalized()
    long_goal = (hm.to_quaternion() @ long_local).normalized()
    elbow_goal = rig.matrix_world @ rig.pose.bones['LeftArm'].head + Vector((.047, -.1445, -.0705))
    prior = previous.copy()
    def pose(v):
        for i, bone in enumerate(bones):
            bone.rotation_quaternion = base[i] @ Euler(tuple(v[3*i:3*i+3]), 'XYZ').to_quaternion()
        bpy.context.view_layer.update()
        phone.matrix_world = (rig.matrix_world @ rig.pose.bones['LeftHand'].matrix) @ hand_ref.inverted() @ reference
        bpy.context.view_layer.update()
    def objective(v):
        pose(v)
        top = phone.matrix_world @ Vector((0, .069, .0095))
        normal = (phone.matrix_world.to_3x3() @ Vector((0, 0, 1))).normalized()
        long = (phone.matrix_world.to_3x3() @ Vector((0, 1, 0))).normalized()
        elbow = rig.matrix_world @ rig.pose.bones['LeftForeArm'].head
        return np.r_[(np.array(top)-np.array(target))*30, (np.array(normal)-np.array(normal_goal))*.65,
                     (np.array(long)-np.array(long_goal))*.65, (np.array(elbow)-np.array(elbow_goal))*6,
                     np.array(v)*.08, (np.array(v)-prior)*.25]
    result = least_squares(objective, previous, bounds=(-1.5, 1.5), diff_step=.001, max_nfev=250, xtol=1e-8, ftol=1e-8)
    pose(result.x); solutions[frame] = result.x.copy(); previous = result.x.copy()
    gaps[frame] = round((phone.matrix_world @ Vector((0, .069, .0095)) - target).length*1000, 2)
    for bone in bones: bone.keyframe_insert('rotation_quaternion', frame=frame)
    print('hold frame', frame, 'landmark error mm', gaps[frame], flush=True)
for frame in range(16, 23):
    s.frame_set(frame); bpy.context.view_layer.update()
    t = (frame-15)/8; t = t*t*(3-2*t)
    for i, bone in enumerate(bones):
        bone.rotation_quaternion = bone.rotation_quaternion @ Euler(tuple(solutions[23][3*i:3*i+3]*t), 'XYZ').to_quaternion()
        bone.keyframe_insert('rotation_quaternion', frame=frame)


phone.rotation_mode='QUATERNION'; last=None
for i in range(201):
 frame=1+i/2;s.frame_set(int(frame),subframe=frame%1);bpy.context.view_layer.update();phone.matrix_world=(rig.matrix_world@rig.pose.bones['LeftHand'].matrix)@hand_ref.inverted()@reference;q=phone.rotation_quaternion.copy()
 if last is not None and q.dot(last)<0:q.negate()
 phone.rotation_quaternion=q;last=q.copy()
 for prop in ('location','rotation_quaternion','scale'):phone.keyframe_insert(prop,frame=frame)
s.frame_start=23;s.frame_end=101;s.frame_set(23)
bpy.ops.wm.save_as_mainfile(filepath=str(R/'brand/intro/phone/conversation_motion_study.blend'))
# Use the same rigid phone/hand relation on each rendered sample. The phone box
# audit is coarse: it cannot establish triangle-level or continuous contact.
mesh=bpy.data.objects['char1'];groups={g.index:g.name for g in mesh.vertex_groups}
labels=['Head','LeftHand','LeftHandThumb','LeftHandIndex','LeftHandMiddle','LeftHandRing','LeftHandPinky']
ids={name:[j for j,v in enumerate(mesh.data.vertices) if any(g.weight>.5 and (groups.get(g.group,'')==name if name in ('Head','LeftHand') else groups.get(g.group,'').startswith(name)) for g in v.groups)] for name in labels}
import subprocess, wave, imageio_ffmpeg
frames=Path('/tmp/conversation_motion');frames.mkdir(exist_ok=True)
cam=s.camera;cam.data.type='ORTHO';cam.data.ortho_scale=1.2;cam.location=(1.7,-3.4,1.8);cam.rotation_euler=(Vector((0,0,1.35))-cam.location).to_track_quat('-Z','Y').to_euler();s.render.resolution_x=480;s.render.resolution_y=480;s.cycles.samples=6
report={}
for i in range(157):
 f=23+i/2;s.frame_set(int(f),subframe=f%1);bpy.context.view_layer.update();phone.matrix_world=(rig.matrix_world@rig.pose.bones['LeftHand'].matrix)@hand_ref.inverted()@reference;bpy.context.view_layer.update()
 ev=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get());em=ev.to_mesh();conv=phone.matrix_world.inverted()@ev.matrix_world;item={}
 for name,vi in ids.items():
  inside=0;nearest=100
  for idx in vi:
   v=conv@em.vertices[idx].co;inside+=int(-.039<v.x<.039 and -.079<v.y<.079 and 0<v.z<.010);nearest=min(nearest,math.sqrt(max(abs(v.x)-.039,0)**2+max(abs(v.y)-.079,0)**2+max(-v.z,0,v.z-.010)**2))
  item[name]={'vertices_inside_phone_box':inside,'min_distance_mm':round(nearest*1000,2)}
 ev.to_mesh_clear();report[str(f)]=item;s.render.filepath=str(frames/f'frame_{i:03}.png');bpy.ops.render.render(write_still=True)
voice=R/'brand/intro/call_audio/first_call_preview.wav'
with wave.open(str(voice),'rb') as wav: duration=wav.getnframes()/wav.getframerate()
rate=157/duration
subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-y','-framerate',str(rate),'-i',str(frames/'frame_%03d.png'),'-i',str(voice),'-vf','scale=432:432,pad=768:432:(ow-iw)/2:0:color=black','-c:v','libx264','-pix_fmt','yuv420p','-crf','20','-c:a','aac','-b:a','128k','-shortest','-movflags','+faststart',str(R/'docs/previews/intro/conversation_motion_study.mp4')],check=True)
(R/'docs/previews/intro/conversation_motion_audit.json').write_text(json.dumps({'method':'157 half-frame weighted-vertex/approximate-phone-box samples; no triangle or continuous collision test. Target is approximate ear landmark.','whole_frame_landmark_error_mm':gaps,'frames':report,'render_fps':rate,'voice_seconds':duration},indent=2)+'\n')
print('Conversation body-motion study saved',flush=True);os._exit(0)
