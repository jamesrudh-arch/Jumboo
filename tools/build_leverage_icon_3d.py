#!/usr/bin/env python3
"""Make a compact V/fulcrum icon from the approved 3D title's existing geometry."""
from pathlib import Path
import math,os
import bpy
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'brand/leverage';PREVIEW=ROOT/'docs/previews'
bpy.ops.wm.open_mainfile(filepath=str(OUT/'leverage_custom_3d.blend'))
# Keep the exact approved L/V meshes and pivot; remove unrelated title/stage.
keep=[o for o in bpy.data.objects if o.name.startswith('Letter 3 V ') or o.name=='V fulcrum | copper']
for ob in list(bpy.data.objects):
 if ob not in keep:bpy.data.objects.remove(ob,do_unlink=True)
# Reposition entire groups, without changing their shape or relative component placement.
for ob in keep:
 ob.location.x+=1.63
# Physical machined icon bezel, not a flat 2D background.
mat=bpy.data.materials.new('Icon bezel | graphite');mat.use_nodes=True
bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(.023,.031,.038,1);bs.inputs['Metallic'].default_value=.72;bs.inputs['Roughness'].default_value=.28
bpy.ops.mesh.primitive_cube_add(size=1,location=(0,.30,3.50));plate=bpy.context.object;plate.name='Rounded icon housing';plate.scale=(2.75,.38,2.75);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);plate.data.materials.append(mat)
bev=plate.modifiers.new('Rounded corners','BEVEL');bev.width=.25;bev.segments=8;plate.modifiers.new('Weighted highlights','WEIGHTED_NORMAL')
bpy.context.view_layer.objects.active=plate
for mod in list(plate.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
keep.append(plate)
# Export just icon components, not camera or lights.
bpy.ops.object.select_all(action='DESELECT')
for ob in keep:ob.select_set(True)
bpy.context.view_layer.objects.active=plate
bpy.ops.export_scene.gltf(filepath=str(OUT/'leverage_icon_3d.glb'),export_format='GLB',use_selection=True)
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=40;s.cycles.use_denoising=True;s.render.resolution_x=1024;s.render.resolution_y=1024;s.render.resolution_percentage=100;s.view_settings.view_transform='AgX';s.render.image_settings.file_format='PNG'
w=bpy.data.worlds[0];w.use_nodes=True;w.node_tree.nodes['Background'].inputs['Color'].default_value=(.004,.008,.012,1);w.node_tree.nodes['Background'].inputs['Strength'].default_value=.2;s.world=w
def area(name,location,energy,color,size):
 data=bpy.data.lights.new(name,'AREA');data.energy=energy;data.color=color;data.shape='DISK';data.size=size;ob=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(ob);ob.location=location;ob.rotation_euler=(Vector((0,0,3.4))-ob.location).to_track_quat('-Z','Y').to_euler()
area('Soft cool key',(-4,-5,7),850,(.73,.85,1),4);area('Warm rim',(4,0,6),900,(1,.56,.29),3);area('Front fill',(0,-5,3.2),500,(1,.93,.82),3)
cd=bpy.data.cameras.new('Icon camera');cam=bpy.data.objects.new('Icon camera',cd);bpy.context.collection.objects.link(cam);s.camera=cam;cd.type='ORTHO';cd.ortho_scale=3.25
cam.location=(2.4,-9,5.1);cam.rotation_euler=(Vector((0,0,3.47))-cam.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'leverage_icon_3d.blend'))
s.render.filepath=str(PREVIEW/'leverage_icon_3d_three_quarter.png');bpy.ops.render.render(write_still=True)
cam.location=(0,-9,3.5);cam.rotation_euler=(Vector((0,0,3.5))-cam.location).to_track_quat('-Z','Y').to_euler()
s.render.filepath=str(PREVIEW/'leverage_icon_3d_front.png');bpy.ops.render.render(write_still=True)
print('3D icon assets saved',flush=True);os._exit(0)
