#!/usr/bin/env python3
"""Build a machined LEVERAGE wordmark from original 3D contours in Blender 4.2."""
from pathlib import Path
import math, os
import bpy
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'brand/leverage'; VIEW=ROOT/'docs/previews'
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=32;s.cycles.use_denoising=True;s.render.resolution_x=1600;s.render.resolution_y=900;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG';s.view_settings.view_transform='AgX'
def mat(name,c,metal,rough):
 m=bpy.data.materials.new(name);m.use_nodes=True;n=m.node_tree.nodes.get('Principled BSDF');n.inputs['Base Color'].default_value=(*c,1);n.inputs['Metallic'].default_value=metal;n.inputs['Roughness'].default_value=rough;return m
steel=mat('Blackened steel',(.12,.15,.17),.83,.30); copper=mat('Copper fulcrum',(.48,.26,.105),.83,.28);white=mat('Secondary type',(.55,.61,.60),.7,.32);floor=mat('Dark ground',(.012,.016,.020),.25,.4)
# Letters are built as overlapping 3D polygonal bars. The counters are real
# open space between solids; no unreliable font-hole or boolean triangulation.
def rect(x1,y1,x2,y2):return [(x1,y1),(x2,y1),(x2,y2),(x1,y2)]
W=.9; H=1.35; T=.22
L=[rect(0,0,T,H),rect(0,0,W,T)]
E=[rect(0,0,T,H),rect(0,H-T,W,H),rect(0,(H-T)/2,.72,(H+T)/2),rect(0,0,W,T)]
V=[[(0,H),(.24,H),(.50,.17),(.39,0),(.27,.06)],[(.76,H),(1.0,H),(.73,.06),(.61,0),(.50,.17)]]
R=[rect(0,0,T,H),rect(0,H-T,.70,H),rect(0,.60,.70,.82),rect(.66,.60,.88,H),[(.46,.64),(.68,.69),(.99,0),(.73,0)]]
A=[[(0,0),(.25,0),(.60,H),(.37,H)],[(.76,0),(1.01,0),(.64,H),(.42,H)],rect(.21,.37,.79,.59)]
G=[rect(0,.13,T,H-.13),rect(.1,H-T,.90,H),rect(.1,0,.90,T),rect(.68,0,.90,.63),rect(.48,.47,.90,.69)]
glyphs=[('L',L,.9),('E',E,.9),('V',V,1.0),('E',E,.9),('R',R,.99),('A',A,1.01),('G',G,.9),('E',E,.9)]
spacing=.12;total=sum(g[2] for g in glyphs)+spacing*7;x=-total/2;objects=[];vcenter=0
# Mesh faces are triangulated by Blender; each part is an extruded solid.
def extrude(name,poly,xpos,depth_offset):
 n=len(poly); depth=.20; zbase=2.92
 verts=[(xpos+px,yy,zbase+pz) for yy in [-depth/2,depth/2] for px,pz in poly]
 faces=[tuple(reversed(range(n))),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
 obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj);obj.location.y=depth_offset;obj.data.materials.append(steel)
 bevel=obj.modifiers.new('Machined edges','BEVEL');bevel.width=.012;bevel.segments=3
 obj.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
 bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
 for mod in list(obj.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
 objects.append(obj)
for index,(name,parts,width) in enumerate(glyphs):
 for part,points in enumerate(parts):extrude('Letter %d %s part %d'%(index+1,name,part+1),points,x,-.004*part)
 if name=='V':vcenter=x+.5
 x+=width+spacing
# Art-directed fulcrum: copper disk under V with a darker pin inset.
bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=.10,depth=.09,location=(vcenter,-.05,2.80),rotation=(math.pi/2,0,0));pin=bpy.context.object;pin.name='V fulcrum | copper';pin.data.materials.append(copper);objects.append(pin)
# Subtitle/tagline remain licensed placeholder typography, separate from title.
font=bpy.data.fonts.load(str(ROOT/'game/assets/fonts/BebasNeue-Regular.ttf'))
def text(name,body,size,z,space):
 c=bpy.data.curves.new(name,'FONT');c.body=body;c.font=font;c.size=size;c.space_character=space;c.align_x='CENTER';c.align_y='CENTER';c.extrude=.016;c.bevel_depth=.002;c.bevel_resolution=2
 ob=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(ob);ob.location=(0,0,z);ob.rotation_euler=(math.pi/2,0,0);ob.data.materials.append(white)
 bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob;bpy.ops.object.convert(target='MESH');objects.append(bpy.context.object)
text('Cinder City','C I N D E R   C I T Y',.43,2.15,1)
text('Tagline','EVERYONE HAS LEVERAGE ON YOU.',.235,1.58,1.08)
bpy.ops.object.select_all(action='DESELECT')
for ob in objects:ob.select_set(True)
bpy.context.view_layer.objects.active=objects[0];bpy.ops.export_scene.gltf(filepath=str(OUT/'leverage_custom_3d.glb'),export_format='GLB',use_selection=True)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,0));bpy.context.object.data.materials.append(floor);bpy.context.object.name='Stage'
def light(name,loc,power,color,size):
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.color=color;d.shape='DISK';d.size=size;o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,3.2))-o.location).to_track_quat('-Z','Y').to_euler()
light('Cold key',(-5,-6,7),1200,(.76,.86,1),6);light('Warm edge',(5,2,5),1200,(1,.54,.28),4);light('Front strip',(0,-5,4),600,(.92,.96,1),5)
w=bpy.data.worlds[0];w.use_nodes=True;w.node_tree.nodes['Background'].inputs['Color'].default_value=(.004,.008,.012,1);w.node_tree.nodes['Background'].inputs['Strength'].default_value=.16;s.world=w
cd=bpy.data.cameras.new('Camera');cam=bpy.data.objects.new('Camera',cd);bpy.context.collection.objects.link(cam);s.camera=cam;cd.type='ORTHO';cd.ortho_scale=12.1
cam.location=(0,-18,4);cam.rotation_euler=(Vector((0,0,2.85))-cam.location).to_track_quat('-Z','Y').to_euler();bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'leverage_custom_3d.blend'))
def render(name,loc,target,scale):
 cam.location=loc;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cd.ortho_scale=scale;s.render.filepath=str(VIEW/name);bpy.ops.render.render(write_still=True)
render('leverage_custom_front.png',(0,-18,4),(0,0,2.85),12.1)
if not os.environ.get('PREVIEW_FRONT_ONLY'):
 render('leverage_custom_three_quarter.png',(7,-15,4.7),(0,0,2.85),12.1)
 render('leverage_custom_side.png',(16,-.3,3),(0,0,2.85),5.7)
 render('leverage_custom_rear.png',(0,18,4),(0,0,2.85),12.1)
print('Custom 3D wordmark complete',flush=True);os._exit(0)
