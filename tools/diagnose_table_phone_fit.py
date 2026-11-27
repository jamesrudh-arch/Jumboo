#!/usr/bin/env python3
"""Failed table contact diagnostic; does not create a pickup animation."""
import bpy,os,math,json,numpy as np
from pathlib import Path
R=Path(__file__).resolve().parents[1]
OUT=R/'docs/previews/intro'
from mathutils import Vector,Euler
from scipy.optimize import least_squares
bpy.ops.wm.open_mainfile(filepath=str(R/'brand/intro/phone/phone_at_ear_study.blend'));s=bpy.context.scene;r=bpy.data.objects['Armature'];p=bpy.data.objects['phone grip control'];s.frame_set(23);bpy.context.view_layer.update();bind=(r.matrix_world@r.pose.bones['LeftHand'].matrix).inverted()@p.matrix_world
p.animation_data_clear();names=('LeftArm','LeftForeArm','LeftHand');bones=[r.pose.bones[n] for n in names];s.frame_set(11);bpy.context.view_layer.update();base=[b.rotation_quaternion.copy() for b in bones];target=Vector((.33,-.40,.89))
def pose(v):
 for i,b in enumerate(bones):b.rotation_quaternion=base[i]@Euler(tuple(v[i*3:i*3+3]),'XYZ').to_quaternion()
 bpy.context.view_layer.update();p.matrix_world=(r.matrix_world@r.pose.bones['LeftHand'].matrix)@bind;bpy.context.view_layer.update()
def fun(v):
 pose(v);pos=p.matrix_world.translation;z=(p.matrix_world.to_3x3()@Vector((0,0,1))).normalized();y=(p.matrix_world.to_3x3()@Vector((0,1,0))).normalized()
 return np.r_[(np.array(pos)-np.array(target))*20,(np.array(z)-np.array((0,0,1)))*4,np.array(v)*.1]
rng=np.random.default_rng(7);best=None
for k in range(8):
 v=np.zeros(9) if k==0 else rng.uniform(-1.3,1.3,9)
 candidate=least_squares(fun,v,bounds=(-3.,3.),diff_step=.005,max_nfev=350)
 if best is None or candidate.cost<best.cost:best=candidate
 print('candidate',k,round(candidate.cost,4),flush=True)
sol=best;pose(sol.x)
for b in bones:b.keyframe_insert('rotation_quaternion',frame=11)
print('solution',np.round(sol.x,4),'pos',p.matrix_world.translation,'wrist',r.matrix_world@r.pose.bones['LeftHand'].head,'norm',p.matrix_world.to_3x3()@Vector((0,0,1)),'y',p.matrix_world.to_3x3()@Vector((0,1,0)),'cost',sol.cost,flush=True)
# Temporary diagnostic tabletop
bpy.ops.mesh.primitive_cube_add(size=1,location=(.42,-.45,.925));table=bpy.context.object;table.name='diagnostic tabletop';table.dimensions=(.60,.45,.04);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
mat=bpy.data.materials.new('table mat');mat.diffuse_color=(.19,.14,.1,1);table.data.materials.append(mat)
cam=s.camera;cam.data.type='ORTHO';cam.data.ortho_scale=1.05;s.render.resolution_x=720;s.render.resolution_y=720;s.cycles.samples=8
for name,loc in [('front',(1.7,-3.5,1.8)),('rear',(3,2.5,1.8))]:
 cam.location=loc;cam.rotation_euler=(Vector((.13,-.18,1.10))-cam.location).to_track_quat('-Z','Y').to_euler();s.render.filepath=str(OUT/('pickup_table_fit_'+name+'.png'));bpy.ops.render.render(write_still=True)
# Weighted hand vertices inside the tabletop box: diagnostic only.
bpy.context.view_layer.update();mesh=bpy.data.objects['char1'];ev=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get());em=ev.to_mesh();groups={g.index:g.name for g in mesh.vertex_groups};labels=('LeftHand','LeftHandThumb','LeftHandIndex','LeftHandMiddle','LeftHandRing','LeftHandPinky');counts={}
for label in labels:
 ids=[i for i,v in enumerate(mesh.data.vertices) if any(g.weight>.5 and (groups.get(g.group,'')==label if label=='LeftHand' else groups.get(g.group,'').startswith(label)) for g in v.groups)]
 inside=0
 for i in ids:
  v=ev.matrix_world@em.vertices[i].co;inside+=int(.12<v.x<.72 and -.675<v.y<-.225 and .905<v.z<.945)
 counts[label]=inside
ev.to_mesh_clear()
(OUT/'pickup_table_fit_audit.json').write_text(json.dumps({'method':'One posed frame; vertices with >50% group weight against tabletop box, not continuous or triangle collision QA.','table_bounds_m':{'x':[.12,.72],'y':[-.675,-.225],'z':[.905,.945]},'weighted_vertices_inside_table':counts,'phone_origin_m':list(p.matrix_world.translation),'phone_normal':list((p.matrix_world.to_3x3()@Vector((0,0,1))).normalized()),'optimization_cost':sol.cost},indent=2)+'\n')
print('diagnostic tabletop intersections',counts,flush=True);os._exit(0)
