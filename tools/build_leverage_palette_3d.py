#!/usr/bin/env python3
"""Render physical 3D palette materials for LEVERAGE identity review."""
from pathlib import Path
import math,os
import bpy
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'brand/leverage';VIEW=ROOT/'docs/previews'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=32;s.cycles.use_denoising=True;s.render.resolution_x=1600;s.render.resolution_y=1000;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG';s.view_settings.view_transform='AgX'
def linear(v):
 v=v/255
 return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4
def material(name,hexval,metallic=0,rough=.45):
 c=tuple(linear(int(hexval[i:i+2],16)) for i in (1,3,5));m=bpy.data.materials.new(name);m.use_nodes=True
 n=m.node_tree.nodes.get('Principled BSDF');n.inputs['Base Color'].default_value=(*c,1);n.inputs['Metallic'].default_value=metallic;n.inputs['Roughness'].default_value=rough
 m.diffuse_color=(*c,1);return m
paper=material('Type | paper','#F0EDE5',.18,.4);stage=material('Stage | charcoal','#10171D',.12,.45)
colors=[('INK','#10171D','CITY / SHADOW'),('PAPER','#F0EDE5','PRIMARY TYPE'),('STEEL','#8B9B9B','METAL / STRUCTURE'),('TIDAL','#8EBAB6','INFORMATION'),('AMBER','#E0B77E','LEAD / WARMTH'),('SIGNAL','#E88771','ALERT / SYMBOL')]
font=bpy.data.fonts.load(str(ROOT/'game/assets/fonts/BebasNeue-Regular.ttf'))
def text(name,body,pos,size,mat,spacing=1):
 c=bpy.data.curves.new(name,'FONT');c.body=body;c.font=font;c.size=size;c.space_character=spacing;c.align_x='CENTER';c.align_y='CENTER';c.extrude=.008;c.bevel_depth=.001;c.bevel_resolution=2
 ob=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(ob);ob.location=pos;ob.rotation_euler=(math.pi/2,0,0);ob.data.materials.append(mat)
 bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob;bpy.ops.object.convert(target='MESH')
text('Header','LEVERAGE  /  CINDER CITY', (0,-.06,4.7),.56,paper)
text('Header sub','BRAND COLOUR  /  MATERIAL STUDY',(0,-.06,4.17),.22,paper)
for i,(name,color,role) in enumerate(colors):
 x=(i-2.5)*1.9
 bpy.ops.mesh.primitive_cube_add(size=1, location=(x,0,2.9));o=bpy.context.object;o.name='3D swatch | '+name;o.scale=(1.45,.26,1.55);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 o.data.materials.append(material(name+' | '+color,color,.22 if name=='STEEL' else 0,.36))
 mod=o.modifiers.new('Soft chamfer','BEVEL');mod.width=.055;mod.segments=3;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
 text(name+' name',name,(x,-.12,1.72),.28,paper);text(name+' code',color,(x,-.12,1.39),.22,paper);text(name+' role',role,(x,-.12,1.1),.17,paper)
text('Footer','MATERIAL AND LIGHT CHANGE APPEARANCE  /  HEX VALUES ARE DESIGN TOKENS',(0,-.06,.35),.19,paper)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,0));bpy.context.object.data.materials.append(stage)
w=bpy.data.worlds[0];w.use_nodes=True;w.node_tree.nodes['Background'].inputs['Color'].default_value=(.005,.009,.012,1);w.node_tree.nodes['Background'].inputs['Strength'].default_value=.25;s.world=w
def light(name,pos,power,color,size):
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.color=color;d.shape='DISK';d.size=size;o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=pos;o.rotation_euler=(Vector((0,0,2.8))-o.location).to_track_quat('-Z','Y').to_euler()
light('Neutral key',(-3,-7,7),1450,(1,1,1),7);light('Warm edge',(5,1,5),800,(1,.7,.45),5);light('Cool fill',(-5,-2,5),600,(.7,.85,1),4)
cd=bpy.data.cameras.new('Camera');cam=bpy.data.objects.new('Camera',cd);bpy.context.collection.objects.link(cam);s.camera=cam;cd.type='ORTHO';cd.ortho_scale=12.6;cam.location=(1,-18,5);cam.rotation_euler=(Vector((0,0,2.5))-cam.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'leverage_palette_3d.blend'))
s.render.filepath=str(VIEW/'leverage_palette_3d.png');bpy.ops.render.render(write_still=True)
print('3D palette saved',flush=True);os._exit(0)
