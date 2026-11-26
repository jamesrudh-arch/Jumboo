#!/usr/bin/env python3
"""Recreate the accepted provisional phone-at-ear study (offline, not gameplay)."""
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
exec(compile(source.read_text().split("mesh=bpy.data.objects['char1']")[0], str(source), 'exec'))
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
for frame in range(23, 32):
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

# Preview and audit use direct attachment at each sampled frame. Bake at those
# same half frames into the blend, correcting quaternion signs to avoid flips.
phone.rotation_mode = 'QUATERNION'; last = None
for i in range(61):
    frame = 1+i/2; s.frame_set(int(frame), subframe=frame%1); bpy.context.view_layer.update()
    phone.matrix_world = (rig.matrix_world @ rig.pose.bones['LeftHand'].matrix) @ hand_ref.inverted() @ reference
    q = phone.rotation_quaternion.copy()
    if last is not None and q.dot(last) < 0: q.negate()
    phone.rotation_quaternion = q; last = q.copy()
    for prop in ('location', 'rotation_quaternion', 'scale'): phone.keyframe_insert(prop, frame=frame)
s.frame_set(23)
bpy.ops.wm.save_as_mainfile(filepath=str(R/'brand/intro/phone/phone_at_ear_study.blend'))
mesh = bpy.data.objects['char1']; groups = {g.index:g.name for g in mesh.vertex_groups}
labels = ['Head','LeftHand','LeftHandThumb','LeftHandIndex','LeftHandMiddle','LeftHandRing','LeftHandPinky']
ids = {name:[j for j,v in enumerate(mesh.data.vertices) if any(g.weight>.5 and (groups.get(g.group,'')==name if name in ('Head','LeftHand') else groups.get(g.group,'').startswith(name)) for g in v.groups)] for name in labels}
report = {}; images = []
cam = s.camera; cam.data.type = 'ORTHO'; cam.data.ortho_scale = 1.20
cam.location = (1.7,-3.4,1.8); cam.rotation_euler = (Vector((0,0,1.35))-cam.location).to_track_quat('-Z','Y').to_euler()
s.render.resolution_x = 480; s.render.resolution_y = 480; s.cycles.samples = 6
for i in range(61):
    frame = 1+i/2; s.frame_set(int(frame),subframe=frame%1); bpy.context.view_layer.update()
    phone.matrix_world = (rig.matrix_world @ rig.pose.bones['LeftHand'].matrix) @ hand_ref.inverted() @ reference; bpy.context.view_layer.update()
    ev = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get()); em = ev.to_mesh(); conv = phone.matrix_world.inverted() @ ev.matrix_world; item = {}
    for name, vertices in ids.items():
        inside = 0; nearest = 100
        for idx in vertices:
            v = conv @ em.vertices[idx].co
            inside += int(-.039<v.x<.039 and -.079<v.y<.079 and 0<v.z<.010)
            d = math.sqrt(max(abs(v.x)-.039,0)**2 + max(abs(v.y)-.079,0)**2 + max(-v.z,0,v.z-.010)**2)
            nearest = min(nearest, d)
        item[name] = {'vertices_inside_phone_box':inside, 'min_distance_mm':round(nearest*1000,2)}
    ev.to_mesh_clear(); report[str(frame)] = item
    s.render.filepath = f'/tmp/ear_preview_{i:03}.png'; bpy.ops.render.render(write_still=True)
    with Image.open(s.render.filepath) as im: images.append(im.convert('RGB'))
    if frame == 27:
        oldloc = cam.location.copy(); oldrot = cam.rotation_euler.copy(); oldscale = cam.data.ortho_scale
        cam.data.ortho_scale = .64; s.render.resolution_x = 800; s.render.resolution_y = 800; s.cycles.samples = 12
        for name,loc in [('front',(1.7,-3.4,1.8)),('rear',(3,2.5,1.8))]:
            cam.location = loc; cam.rotation_euler = (Vector((0,-.01,1.56))-cam.location).to_track_quat('-Z','Y').to_euler()
            s.render.filepath = str(R/f'docs/previews/intro/phone_at_ear_{name}.png'); bpy.ops.render.render(write_still=True)
        cam.location = oldloc; cam.rotation_euler = oldrot; cam.data.ortho_scale = oldscale
        s.render.resolution_x = 480; s.render.resolution_y = 480; s.cycles.samples = 6
images[0].save(R/'docs/previews/intro/phone_at_ear_motion.gif',save_all=True,append_images=images[1:],duration=83,loop=0,optimize=False)
(R/'docs/previews/intro/phone_at_ear_audit.json').write_text(json.dumps({'method':'Weighted vertices versus approximate phone bounding box at 61 half-frame samples; not continuous or triangle collision QA. Ear target is an approximate head-local landmark, not a measured skin surface.','whole_frame_landmark_error_mm':gaps,'frames':report},indent=2)+'\n')
print('Phone-at-ear review recreated',flush=True); os._exit(0)
