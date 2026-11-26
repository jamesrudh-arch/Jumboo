#!/usr/bin/env python3
"""Create a Blender-only proposed 3D shot. INTRO_ASSET_DIR points to the verified prop files."""
import bpy,os,math
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[1];A=Path(os.environ['INTRO_ASSET_DIR'])
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=32;s.cycles.use_denoising=True;s.render.resolution_x=1280;s.render.resolution_y=720;s.render.resolution_percentage=100;s.world.color=(.012,.015,.02)
s.view_settings.view_transform='AgX'
def mat(name,color,metal=0,rough=.6):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;return m
def noisy(m,scale=5):
 n=m.node_tree.nodes;l=m.node_tree.links;p=n.get('Principled BSDF');t=n.new('ShaderNodeTexNoise');t.inputs['Scale'].default_value=scale;t.inputs['Detail'].default_value=4;b=n.new('ShaderNodeBump');b.inputs['Strength'].default_value=.22;b.inputs['Distance'].default_value=.05;l.new(t.outputs['Fac'],b.inputs['Height']);l.new(b.outputs['Normal'],p.inputs['Normal']);r=n.new('ShaderNodeValToRGB');base=p.inputs['Base Color'].default_value[:];r.color_ramp.elements[0].color=(base[0]*.35,base[1]*.35,base[2]*.35,1);r.color_ramp.elements[1].color=(base[0]*1.3,base[1]*1.3,base[2]*1.3,1);l.new(t.outputs['Fac'],r.inputs[0]);l.new(r.outputs[0],p.inputs['Base Color'])
def box(name,loc,dim,m,bevel=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=dim;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m)
 if bevel:mod=o.modifiers.new('worn edges','BEVEL');mod.width=bevel;mod.segments=2;o.modifiers.new('weighted normals','WEIGHTED_NORMAL')
 return o
def prop(name,loc,rot=0):
 old=set(s.objects);bpy.ops.import_scene.gltf(filepath=str(A/name/(name+'_1k.gltf')));new=set(s.objects)-old;root=bpy.data.objects.new(name+' placement',None);s.collection.objects.link(root)
 for o in new:
  if o.parent not in new:o.parent=root
 root.location=loc;root.rotation_euler.z=rot
concrete=mat('textured concrete',(0.12,.14,.14),0,.66);noisy(concrete,7);floor=mat('damp concrete',(.13,.15,.15),.17,.3);noisy(floor,9);steel=mat('dark steel',(.055,.065,.067),.75,.38);glass=mat('dirty window',(.085,.15,.16),.2,.38);amber=mat('warm glass',(.3,.16,.07),.05,.4)
box('floor',(0,0,-.15),(18,14,.3),floor);box('rear wall',(-4.8,0,2.6),(.25,14,5.2),concrete);box('far end',(0,6.8,2.6),(10,.25,5.2),concrete)
# Window grid, steel pillars and structural details give the image scale and depth.
for y in (-5.3,-3.7,-2.1,-.5,1.1,2.7,4.3,5.9):
 box('window pane',(-4.64,y,3.2),(.05,1.38,2.0),glass)
 for z in (2.2,3.2,4.2):box('window crossbar',(-4.56,y,z),(.12,1.48,.06),steel)
 box('column',(-4.52,y-.75,2.5),(.35,.2,5),steel)
for y in (-4,0,4):box('roof truss',(0,y,4.9),(10,.17,.22),steel)
for y in (-3.9,-1.6,2.4,4.7):prop('steel_frame_shelves_02',(-2.9,y,0),math.pi/2)
# Grounded shipping boxes, no unsupported floating shelving items.
for x,y in ((-1.9,-3.0),(-1.9,-2.45),(-2.1,3.1),(-1.65,3.55)):prop('cardboard_box_01',(x,y,0))
for x,y in ((-2.0,4.7),(-2.15,-4.6)):prop('wooden_crate_01',(x,y,0),.18)
# Intact character: one sampled pose from the source walk, not a new performance.
bpy.ops.import_scene.gltf(filepath=str(R/'brand/characters/marcus/marcus_approved_source.glb'));rig=next(o for o in s.objects if o.type=='ARMATURE');rig.animation_data_clear();rig.animation_data_create();rig.animation_data.action=bpy.data.actions['walk_Armature'];s.frame_set(6)
def area(name,loc,target,power,color,size):
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.color=color;d.shape='DISK';d.size=size;o=bpy.data.objects.new(name,d);s.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
area('cold skylight',(-4,-1,4.5),(0,0,1),900,(.55,.78,1),4);area('soft front',(4,-4,4),(0,0,1.1),520,(.8,.88,1),4);area('warm rim',(-1,4,3.6),(0,0,1.2),1150,(1,.52,.25),2.7);area('warehouse overhead',(0,1,4.7),(0,0,0),250,(.72,.85,1),2)
c=bpy.data.cameras.new('camera');cam=bpy.data.objects.new('camera',c);s.collection.objects.link(cam);s.camera=cam;c.lens=45;cam.location=(4.0,-3.15,1.55);cam.rotation_euler=(Vector((-.2,.25,1.05))-cam.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(R/'brand/intro/cinematic_shot_study.blend'));s.render.filepath=str(R/'docs/previews/intro/cinematic_shot_study.png');bpy.ops.render.render(write_still=True);os._exit(0)
