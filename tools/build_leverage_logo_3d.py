#!/usr/bin/env python3
"""Build a separate, review-only 3D LEVERAGE title asset in Blender 4.2."""
from pathlib import Path
import math, os
import bpy
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'brand/leverage'; VIEW=ROOT/'docs/previews'
OUT.mkdir(parents=True,exist_ok=True); VIEW.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
s=bpy.context.scene; s.render.engine='CYCLES'; s.cycles.samples=24; s.cycles.use_denoising=True
s.render.resolution_x=1600; s.render.resolution_y=900; s.render.resolution_percentage=100
s.render.image_settings.file_format='PNG'; s.view_settings.view_transform='AgX'
def mat(name,c,metal,rough):
 m=bpy.data.materials.new(name); m.use_nodes=True; n=m.node_tree.nodes.get('Principled BSDF'); n.inputs['Base Color'].default_value=(*c,1); n.inputs['Metallic'].default_value=metal; n.inputs['Roughness'].default_value=rough; return m
steel=mat('Title | weathered graphite',(0.16,0.18,0.19),.88,.31)
accent=mat('Pressure point | restrained copper',(0.47,.24,.095),.83,.24)
paper=mat('Subtitle | silver',(0.59,.64,.61),.73,.32)
stage=mat('Ground',(0.014,.019,.024),.22,.38)
font=bpy.data.fonts.load(str(OUT/'ZillaSlab-Bold.ttf'))
inter=bpy.data.fonts.load(str(ROOT/'game/assets/fonts/Inter-Variable.ttf'))
objects=[]
def make_text(name,text,size,z,material,font_ref,spacing=1.0):
 c=bpy.data.curves.new(name,'FONT'); c.body=text; c.font=font_ref; c.size=size; c.space_character=spacing; c.align_x='CENTER'; c.align_y='CENTER'; c.extrude=.065 if size>1 else .025; c.bevel_depth=.004 if size>1 else .002; c.bevel_resolution=3
 ob=bpy.data.objects.new(name,c); bpy.context.collection.objects.link(ob); ob.rotation_euler=(math.pi/2,0,0); ob.location=(0,0,z); ob.data.materials.append(material)
 bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active=ob; bpy.ops.object.convert(target='MESH'); ob=bpy.context.object; objects.append(ob); return ob
word=make_text('LEVERAGE | machined lettering','LEVERAGE',1.8,3.05,steel,font,1.14)
# The visible pin and slim etched bars suggest a fulcrum without destroying legibility.
# Their location is derived from the advance of LE and half of V.
def measure(txt):
 c=bpy.data.curves.new('measure','FONT'); c.body=txt; c.font=font; c.size=1.8; c.space_character=1.14
 o=bpy.data.objects.new('measure',c); bpy.context.collection.objects.link(o); bpy.context.view_layer.update(); width=o.dimensions.x; bpy.data.objects.remove(o,do_unlink=True); bpy.data.curves.remove(c); return width
full=measure('LEVERAGE'); prefix=measure('LE'); vwidth=measure('V'); vx=-full/2+prefix+vwidth/2+.08
bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=.065,depth=.035,location=(vx,-.095,2.78),rotation=(math.pi/2,0,0)); pin=bpy.context.object; pin.name='V | fulcrum rivet'; pin.data.materials.append(accent); objects.append(pin)
make_text('CINDER CITY | subtitle','C I N D E R   C I T Y',.48,2.08,paper,font)
make_text('Tagline | 3D type','EVERYONE HAS LEVERAGE ON YOU.',.235,1.52,paper,inter,1.10)
# Export selected geometry only; this does not integrate with game scenes.
bpy.ops.object.select_all(action='DESELECT')
for ob in objects: ob.select_set(True)
bpy.context.view_layer.objects.active=word
bpy.ops.export_scene.gltf(filepath=str(OUT/'leverage_title_3d.glb'),export_format='GLB',use_selection=True)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,0)); bpy.context.object.data.materials.append(stage); bpy.context.object.name='Presentation floor'
def light(name,loc,power,color,size,target):
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.color=color;d.shape='DISK';d.size=size;ob=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(ob);ob.location=loc;ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler()
light('Cold key',(-5,-6,7),1300,(.75,.85,1),6,(0,0,3));light('Warm edge',(5,1,4),1300,(1,.48,.22),4,(0,0,2.7));light('Name fill',(0,-5,4),700,(.9,.95,1),5,(0,0,3));light('Copper reflection',(0,3,6),900,(1,.75,.49),5,(0,0,3))
w=bpy.data.worlds[0] if bpy.data.worlds else bpy.data.worlds.new('World');w.use_nodes=True;w.node_tree.nodes['Background'].inputs['Color'].default_value=(.004,.008,.012,1);w.node_tree.nodes['Background'].inputs['Strength'].default_value=.16;s.world=w
cd=bpy.data.cameras.new('Camera');cam=bpy.data.objects.new('Camera',cd);bpy.context.collection.objects.link(cam);s.camera=cam;cd.type='ORTHO'
def render(name,loc,target,scale):
 cam.location=loc;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cd.ortho_scale=scale;s.render.filepath=str(VIEW/name);bpy.ops.render.render(write_still=True)
cam.location=(0,-18,4);cam.rotation_euler=(Vector((0,0,2.6))-cam.location).to_track_quat('-Z','Y').to_euler();cd.ortho_scale=13
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'leverage_title_3d.blend'))
render('leverage_logo_3d_front.png',(0,-18,4),(0,0,2.6),13)
render('leverage_logo_3d_three_quarter.png',(7,-15,4.7),(0,0,2.6),13)
render('leverage_logo_3d_side.png',(16,-.3,3),(0,0,2.6),5.7)
render('leverage_logo_3d_rear.png',(0,18,4),(0,0,2.6),13)
print('3D title scene, model and views written',flush=True)
os._exit(0)
