#!/usr/bin/env python3
"""Create and render the D'YOUNGS studio symbol as real 3D Blender meshes.
Run with Blender 4.2's Python (bpy); outputs are review assets, not game integration.
"""
from pathlib import Path
import math
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'brand/studio'
PREVIEWS = ROOT / 'docs/previews'
OUT.mkdir(parents=True, exist_ok=True)
PREVIEWS.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene
scene.render.engine='CYCLES'
scene.cycles.samples=40
scene.cycles.use_denoising=True
scene.render.resolution_x=1440
scene.render.resolution_y=1080
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.world.color=(0.025,0.025,0.025)
scene.view_settings.view_transform='AgX'

def material(name,color,metallic,roughness):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    shader=m.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value=(*color,1)
    shader.inputs['Metallic'].default_value=metallic
    shader.inputs['Roughness'].default_value=roughness
    return m
steel=material('Graphite | satin steel',(0.14,0.17,0.18),0.86,0.26)
gold=material('Warm champagne | brushed metal',(0.55,0.36,0.16),0.8,0.24)
letter_mat=material('Name | cool silver',(0.58,0.63,0.60),0.8,0.3)
floor_mat=material('Dark stage',(0.018,0.023,0.026),0.35,0.3)

def mesh_extrude(name,points,depth,mat):
    # Shape defined in x/z; front is toward negative y.
    n=len(points)
    verts=[(x,-depth/2,z) for x,z in points]+[(x,depth/2,z) for x,z in points]
    faces=[tuple(range(n-1,-1,-1)),tuple(range(n,n*2))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    mesh=bpy.data.meshes.new(name); mesh.from_pydata(verts,[],faces); mesh.update()
    obj=bpy.data.objects.new(name,mesh); bpy.context.collection.objects.link(obj); obj.data.materials.append(mat)
    bevel=obj.modifiers.new('Machined edge','BEVEL'); bevel.width=0.035; bevel.segments=3
    normal=obj.modifiers.new('Weighted normals','WEIGHTED_NORMAL'); normal.keep_sharp=True
    return obj

# Proper closed hollow D: 2D contours extruded into a ring, not a flat card.
N=64
outer=[(-1.9,4.7),(0,4.7)] + [(1.72*math.sin(math.pi*i/N), 2.9+1.8*math.cos(math.pi*i/N)) for i in range(1,N+1)] + [(-1.9,1.1)]
inner=[(-1.23,4.03),(0,4.03)] + [(1.05*math.sin(math.pi*i/N), 2.9+1.13*math.cos(math.pi*i/N)) for i in range(1,N+1)] + [(-1.23,1.77)]
count=len(outer); verts=[]
for depth,ring in [(-0.20,outer),(-0.20,inner),(0.20,outer),(0.20,inner)]:
    verts += [(x,depth,z) for x,z in ring]
faces=[]
for i in range(count):
    j=(i+1)%count
    faces.extend([(i,j,count+j,count+i), (2*count+i,3*count+i,3*count+j,2*count+j), (i,2*count+i,2*count+j,j), (count+i,count+j,3*count+j,3*count+i)])
mesh=bpy.data.meshes.new('D frame mesh'); mesh.from_pydata(verts,[],faces); mesh.update()
d=bpy.data.objects.new('DY | D frame',mesh); bpy.context.collection.objects.link(d); d.data.materials.append(steel)
bevel=d.modifiers.new('Machined rim','BEVEL'); bevel.width=0.04; bevel.segments=4
d.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
# Separate, solid Y held within D's opening; bevel catches a warm rim.
ypts=[(-1.06,3.91),(-0.51,3.91),(-0.10,3.45),(0.31,3.91),(0.86,3.91),(0.20,3.17),(0.20,2.07),(-0.10,1.82),(-0.40,2.07),(-0.40,3.17)]
y=mesh_extrude('DY | Y core',ypts,0.54,gold)
y.location.y=-0.06

# Physical extruded name, not rasterized text; stock type is still provisional.
font=bpy.data.fonts.load(str(ROOT/'game/assets/fonts/Inter-Variable.ttf'))
curve=bpy.data.curves.new('Studio name','FONT'); curve.body='D’YOUNGS GAMES'; curve.align_x='CENTER'; curve.align_y='CENTER'; curve.size=0.40; curve.space_character=1.28; curve.extrude=0.018; curve.bevel_depth=0.004; curve.bevel_resolution=3; curve.font=font
text=bpy.data.objects.new('Studio name | 3D typography',curve); bpy.context.collection.objects.link(text); text.rotation_euler=(math.pi/2,0,0); text.location=(0,-0.05,0.52); text.data.materials.append(letter_mat)
bpy.ops.object.select_all(action='DESELECT'); text.select_set(True); bpy.context.view_layer.objects.active=text; bpy.ops.object.convert(target='MESH'); text=bpy.context.object
logo_objects=[d,y,text]
# Apply bevels so the GLB actually carries the finished volumetric geometry.
for obj in [d,y]:
    bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True); bpy.context.view_layer.objects.active=obj
    for mod in list(obj.modifiers): bpy.ops.object.modifier_apply(modifier=mod.name)

bpy.ops.object.select_all(action='DESELECT')
for obj in logo_objects: obj.select_set(True)
bpy.context.view_layer.objects.active=d
bpy.ops.export_scene.gltf(filepath=str(OUT/'dyoungs_studio_mark_3d.glb'),export_format='GLB',use_selection=True)

# Real scene setup for rendered review.
bpy.ops.mesh.primitive_plane_add(size=200, location=(0,0,0))
floor=bpy.context.object; floor.name='Presentation floor'; floor.data.materials.append(floor_mat)
def area(name,location,power,color,scale,target):
    data=bpy.data.lights.new(name,'AREA'); data.energy=power; data.color=color; data.shape='DISK'; data.size=scale
    obj=bpy.data.objects.new(name,data); bpy.context.collection.objects.link(obj); obj.location=location; obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
area('Cool large key',(-4,-5,7),950,(0.75,0.85,1.0),5,(0,0,2.8))
area('Warm metal rim',(4,2,5),1250,(1.0,0.59,0.26),3,(0,0,2.8))
area('Soft frontal strip',(2,-5,3),450,(1.0,0.9,0.75),3,(0,0,2.5))
area('Top edge',(0,0,7),650,(1.0,0.83,0.56),3,(0,0,2.5))
world=bpy.data.worlds.new('Studio black') if not bpy.data.worlds else bpy.data.worlds[0]
world.use_nodes=True; world.node_tree.nodes['Background'].inputs['Color'].default_value=(0.006,0.009,0.012,1); world.node_tree.nodes['Background'].inputs['Strength'].default_value=0.2; scene.world=world
camdata=bpy.data.cameras.new('Studio camera'); camera=bpy.data.objects.new('Studio camera',camdata); bpy.context.collection.objects.link(camera); scene.camera=camera; camdata.type='ORTHO'; camdata.ortho_scale=7.0

def render(name,position,target,scale=7.0):
    camera.location=position; camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler(); camdata.ortho_scale=scale
    scene.render.filepath=str(PREVIEWS/name); bpy.ops.render.render(write_still=True)
# Save an editable scene as well as true 3D exported geometry.
camera.location=(0,-12,3.0); camera.rotation_euler=(Vector((0,0,2.45))-camera.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'dyoungs_studio_ident.blend'))
render('dyoungs_3d_front.png',(0,-12,3.0),(0,0,2.45))
render('dyoungs_3d_three_quarter.png',(6,-10,4.4),(0,0,2.5))
render('dyoungs_3d_side.png',(11,-0.3,3.0),(0,0,2.45),5.7)
render('dyoungs_3d_rear.png',(0,12,3.0),(0,0,2.45))
# The bpy wheel used in this headless sandbox can fault during Python shutdown.
# All outputs above are already written; exit without invoking its shutdown.
import os
os._exit(0)
