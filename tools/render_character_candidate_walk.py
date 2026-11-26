#!/usr/bin/env python3
"""Render the original source walk in Blender 4.2; not a gameplay or device test."""
import bpy,os
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
from mathutils import Vector
from PIL import Image
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False);bpy.ops.import_scene.gltf(filepath=str(ROOT/'brand/characters/marcus/marcus_approved_source.glb'));s=bpy.context.scene;rig=next(o for o in s.objects if o.type=='ARMATURE');print('ACTIONS',[(a.name,tuple(a.frame_range)) for a in bpy.data.actions],flush=True)
rig.animation_data_clear();rig.animation_data_create();rig.animation_data.action=bpy.data.actions['walk_Armature'];s.render.engine='CYCLES';s.cycles.samples=8;s.cycles.use_denoising=True;s.render.resolution_x=400;s.render.resolution_y=500;s.world.color=(.08,.08,.08)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.002));mat=bpy.data.materials.new('floor');mat.diffuse_color=(.05,.06,.07,1);bpy.context.object.data.materials.append(mat)
def light(loc,power,size):
 d=bpy.data.lights.new('light','AREA');d.energy=power;d.shape='DISK';d.size=size;o=bpy.data.objects.new('light',d);s.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
light((2,-4,5),360,4);light((-3,-2,3),170,4);light((1,3,4),430,3)
c=bpy.data.cameras.new('camera');cam=bpy.data.objects.new('camera',c);s.collection.objects.link(cam);s.camera=cam;c.type='ORTHO';c.ortho_scale=2.3;cam.location=(6,0,1.05);cam.rotation_euler=(Vector((0,0,.90))-cam.location).to_track_quat('-Z','Y').to_euler();images=[]
for f in range(0,24,2):
 s.frame_set(f);s.render.filepath=f'/tmp/casual_walk_{f:02}.png';bpy.ops.render.render(write_still=True);images.append(Image.open(s.render.filepath).convert('RGB'))
images[0].save(str(ROOT/'docs/previews/character_research/casual_man_walk.gif'),save_all=True,append_images=images[1:],duration=83,loop=0);os._exit(0)
