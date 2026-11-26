#!/usr/bin/env python3
"""Build a review-only 3D Marcus candidate from pinned CC0 MakeHuman assets.

Before running, obtain the six output/*.glb files named below from kblood/
CharacterCreator commit 852e48f316b90a0937234886630e4fb4cdfd1f78 into a
local directory. Usage: MARCUS_SOURCE_DIR=/path/to/files python this_script.py
Requires bpy 4.2 and system libraries. The result is a visual study, not a
finished production character, unified rig, animation, or device asset.
"""
from pathlib import Path
import bpy, math, os
from mathutils import Vector
root = Path(__file__).resolve().parents[1]
src = Path(os.environ['MARCUS_SOURCE_DIR'])
out = root/'brand/characters/marcus'
views = root/'docs/previews/marcus'
out.mkdir(parents=True, exist_ok=True); views.mkdir(parents=True, exist_ok=True)
files = ['base_body.glb','clothing_jacket.glb','clothing_jeans.glb','clothing_shirt.glb','clothing_boots.glb','hair_short02.glb']
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for name in files:
    bpy.ops.import_scene.gltf(filepath=str(src/name))
for ob in list(bpy.context.scene.objects):
    if ob.name.startswith('Icosphere'):
        bpy.data.objects.remove(ob, do_unlink=True); continue
    if ob.type == 'MESH' and ob.data.shape_keys:
        for key in ob.data.shape_keys.key_blocks:
            if key.name == 'Basis': continue
            key.value = {'gender_male':1.0,'age_old':0.12,'corr_gender_male__age_old':0.12}.get(key.name,0.0)
# Muted workwear: tint the source textures, retaining their detail.
def tint(object_name, color):
    ob=bpy.data.objects[object_name]
    for slot in ob.material_slots:
        mat=slot.material
        if not mat or not mat.use_nodes: continue
        bsdf=next((n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
        if not bsdf or not bsdf.inputs['Base Color'].is_linked: continue
        links=mat.node_tree.links; link=bsdf.inputs['Base Color'].links[0]
        source=link.from_socket; links.remove(link)
        multiply=mat.node_tree.nodes.new('ShaderNodeMixRGB'); multiply.blend_type='MULTIPLY'; multiply.inputs[0].default_value=1.0
        multiply.inputs[2].default_value=(*color,1.0);links.new(source,multiply.inputs[1]);links.new(multiply.outputs[0],bsdf.inputs['Base Color'])
tint('Cloth_jacket',(0.30,0.37,0.39));tint('Cloth_jeans',(0.34,0.40,0.44));tint('Cloth_shirt',(0.50,0.53,0.51));tint('Hair_short02',(0.30,0.25,0.23))
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=32;s.cycles.use_denoising=True;s.render.resolution_x=800;s.render.resolution_y=1000;s.render.resolution_percentage=100
s.world.color=(.08,.08,.08)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.03));floor=bpy.context.object;floor.name='Review floor'
mat=bpy.data.materials.new('Review floor');mat.diffuse_color=(.055,.065,.075,1);floor.data.materials.append(mat)
def light(name,loc,power,size,color):
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;d.color=color
    o=bpy.data.objects.new(name,d);s.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
light('Key',(3,-4,5),360,4,(.83,.91,1));light('Fill',(-3,-2,3),170,4,(.80,.88,1));light('Rim',(1,3,4),430,3,(1,.72,.46))
c=bpy.data.cameras.new('Review camera');cam=bpy.data.objects.new('Review camera',c);s.collection.objects.link(cam);s.camera=cam;c.type='ORTHO'
def setup(pos,target,scale):
    cam.location=pos;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();c.ortho_scale=scale
setup((2,-5,1.6),(0,0,.86),2.2)
# Pack CC0 textures into the editable scene so it is portable.
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(out/'marcus_character_study.blend'))
def render(name,pos,target,scale):
    setup(pos,target,scale);s.render.filepath=str(views/name);bpy.ops.render.render(write_still=True)
render('front.png',(0,-6,1.1),(0,0,.84),2.2)
render('three_quarter.png',(2.4,-5,1.6),(0,0,.86),2.2)
render('side.png',(6,0,1.1),(0,0,.84),2.2)
render('rear.png',(0,6,1.1),(0,0,.84),2.2)
render('face_closeup.png',(0.3,-4,1.52),(0,0,1.48),.55)
print('Review renders and scene saved',flush=True);os._exit(0)
