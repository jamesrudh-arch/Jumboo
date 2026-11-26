#!/usr/bin/env python3
"""Rebuild a static 3D appearance study; input sources and rights in README.
Requires bpy 4.2 and MARCUS_SOURCE_DIR with the six named source GLBs.
This exploratory composite is not a rigged, animated or game-ready character.
"""
import bpy,os
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SRC=Path(os.environ['MARCUS_SOURCE_DIR'])
from mathutils import Vector
import bmesh
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for p in ['base_body.glb','clothing_jacket.glb','clothing_jeans.glb','clothing_shirt.glb','clothing_boots.glb']:
 bpy.ops.import_scene.gltf(filepath=str(SRC/p))
for o in list(bpy.context.scene.objects):
 if o.name.startswith('Icosphere') or o.name in {'Eyebrows','Eyelashes','Eyes','Teeth','Tongue'}:
  bpy.data.objects.remove(o,do_unlink=True);continue
 if o.type=='MESH' and o.data.shape_keys:
  for k in o.data.shape_keys.key_blocks:
   if k.name!='Basis': k.value={'gender_male':1.0,'age_old':.12,'corr_gender_male__age_old':.12}.get(k.name,0)
bpy.context.view_layer.update()
old=bpy.data.objects['Body']; deps=bpy.context.evaluated_depsgraph_get();ev=old.evaluated_get(deps);mesh=bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=deps);mesh.transform(old.matrix_world)
body=bpy.data.objects.new('Body static',mesh);bpy.context.scene.collection.objects.link(body);bpy.data.objects.remove(old,do_unlink=True)
bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.delete(bm,geom=[v for v in bm.verts if v.co.z>1.45],context='VERTS');bm.to_mesh(mesh);bm.free()
pre=set(bpy.context.scene.objects);bpy.ops.import_scene.gltf(filepath=str(SRC/'grab3d_man_base_rigged.glb'));new=set(bpy.context.scene.objects)-pre
for o in new:
 if o.animation_data:o.animation_data_clear()
 if o.type=='ARMATURE':o.data.pose_position='REST'
bpy.context.view_layer.update();src=next(o for o in new if o.type=='MESH' and o.name.startswith('char1'))
deps=bpy.context.evaluated_depsgraph_get();ev=src.evaluated_get(deps);m=bpy.data.meshes.new_from_object(ev,preserve_all_data_layers=True,depsgraph=deps);m.transform(src.matrix_world)
head=bpy.data.objects.new('Head static',m);bpy.context.scene.collection.objects.link(head)
for o in list(new):bpy.data.objects.remove(o,do_unlink=True)
bm=bmesh.new();bm.from_mesh(m);bmesh.ops.delete(bm,geom=[v for v in bm.verts if v.co.z<1.43],context='VERTS')
# Remove source shirt at the back while preserving the neck. Texture-assisted
# filtering is a review approximation, not production-ready character topology.
import numpy as np
image=next(n.image for n in m.materials[0].node_tree.nodes if n.type=='TEX_IMAGE' and 'basecolor' in n.image.name)
w,h=image.size; pixels=np.empty(w*h*4,dtype=np.float32);image.pixels.foreach_get(pixels);pixels=pixels.reshape((h,w,4))
uv=bm.loops.layers.uv.active; remove_faces=[]
for face in bm.faces:
 if sum(v.co.z for v in face.verts)/len(face.verts)>1.56: continue
 colors=[]
 for loop in face.loops:
  coord=loop[uv].uv;u=max(0,min(w-1,int(coord.x*w)));v=max(0,min(h-1,int(coord.y*h)));colors.append(pixels[v,u,:3])
 rgb=sum(colors)/len(colors)
 if rgb[0]-rgb[2]<.10 or sum(abs(v.co.x) for v in face.verts)/len(face.verts)>.09 or (sum(v.co.z for v in face.verts)/len(face.verts)<1.50 and sum(v.co.y for v in face.verts)/len(face.verts)>.095): remove_faces.append(face)
bmesh.ops.delete(bm,geom=remove_faces,context='FACES')
for v in bm.verts:v.co.z-=.035
bm.to_mesh(m);bm.free()
def tint(name,color):
 for slot in bpy.data.objects[name].material_slots:
  mat=slot.material
  if not mat or not mat.use_nodes:continue
  shader=next((n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
  if not shader or not shader.inputs['Base Color'].is_linked:continue
  links=mat.node_tree.links;link=shader.inputs['Base Color'].links[0];source=link.from_socket;links.remove(link)
  mix=mat.node_tree.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;mix.inputs[2].default_value=(*color,1);links.new(source,mix.inputs[1]);links.new(mix.outputs[0],shader.inputs['Base Color'])
tint('Cloth_jacket',(.22,.25,.27));tint('Cloth_jeans',(.3,.34,.37));tint('Cloth_shirt',(.55,.55,.50))
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=24;s.cycles.use_denoising=True;s.render.resolution_x=700;s.render.resolution_y=875;s.world.color=(.08,.08,.08)
bpy.context.view_layer.update()
boot=bpy.data.objects['Cloth_boots']; dg=bpy.context.evaluated_depsgraph_get(); bev=boot.evaluated_get(dg); bmsh=bev.to_mesh()
floor_z=min((bev.matrix_world @ v.co).z for v in bmsh.vertices)-.002
bev.to_mesh_clear()
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,floor_z));mat=bpy.data.materials.new('floor');mat.diffuse_color=(.05,.06,.07,1);bpy.context.object.data.materials.append(mat)
def light(loc,power,size):
 d=bpy.data.lights.new('light','AREA');d.energy=power;d.shape='DISK';d.size=size;o=bpy.data.objects.new('light',d);s.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
light((2,-4,5),360,4);light((-3,-2,3),170,4);light((1,3,4),430,3)
c=bpy.data.cameras.new('camera');cam=bpy.data.objects.new('camera',c);s.collection.objects.link(cam);s.camera=cam;c.type='ORTHO'
def camera(pos,target,scale):
 cam.location=pos;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();c.ortho_scale=scale
camera((2,-5,1.55),(0,0,.86),2.18)
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'brand/characters/marcus/marcus_character_study.blend'))
def render(name,pos,target,scale):
 camera(pos,target,scale);s.render.filepath=str(ROOT/'docs/previews/marcus'/name);bpy.ops.render.render(write_still=True)
render('front.png',(0,-6,1.0),(0,0,.86),2.18)
render('three_quarter.png',(2,-5,1.55),(0,0,.86),2.18)
render('side.png',(6,0,1.05),(0,0,.86),2.18)
render('rear.png',(0,6,1.05),(0,0,.86),2.18)
render('face_closeup.png',(.3,-4,1.55),(0,0,1.49),.55)
print('Static character appearance study saved',flush=True);os._exit(0)
