#!/usr/bin/env python3
"""Offline 3D incoming-call prop/shot study, not a working call scene."""
import bpy,math,os
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[1]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False);s=bpy.context.scene
s.render.engine='CYCLES';s.cycles.samples=48;s.cycles.use_denoising=True;s.render.resolution_x=1280;s.render.resolution_y=720;s.world.color=(.003,.004,.005);s.view_settings.view_transform='AgX'
def mat(name,color,metal=0,rough=.5,emission=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
 if emission:p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emission
 return m
def cube(n,loc,dim,material,bev=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=n;o.dimensions=dim;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(material)
 if bev:mod=o.modifiers.new('rounded edges','BEVEL');mod.width=bev;mod.segments=5;o.modifiers.new('corner normals','WEIGHTED_NORMAL')
 return o
def text(label,body,x,y,z,size,material):
 d=bpy.data.curves.new(label,'FONT');d.body=body;d.size=size;d.align_x='CENTER';d.align_y='CENTER';d.extrude=.000015;o=bpy.data.objects.new(label,d);s.collection.objects.link(o);o.location=(x,y,z);o.data.materials.append(material);return o
def light(name,loc,target,power,color,size):
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.color=color;d.shape='DISK';d.size=size;o=bpy.data.objects.new(name,d);s.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
metal=mat('graphite alloy',(.09,.105,.105),.85,.28);edge=mat('case edge',(.013,.017,.018),.25,.33);glass=mat('screen glass',(.008,.016,.019),.12,.2);screen=mat('lit screen',(.012,.031,.034),.0,.5,1.0);white=mat('cool screen type',(.72,.88,.86),0,.6,2);muted=mat('soft screen type',(.2,.39,.38),0,.6,1.4);green=mat('answer',(.06,.45,.30),0,.6,1.3);red=mat('decline',(.6,.12,.10),0,.6,.9)
wood=mat('worn workbench',(.085,.069,.055),.05,.7);p=wood.node_tree.nodes.get('Principled BSDF');nodes=wood.node_tree.nodes;links=wood.node_tree.links;noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=36;noise.inputs['Detail'].default_value=4;bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.22;bump.inputs['Distance'].default_value=.001;links.new(noise.outputs['Fac'],bump.inputs['Height']);links.new(bump.outputs['Normal'],p.inputs['Normal'])
cube('bench',(0,0,-.018),(1.5,1,.035),wood,.001)
cube('machined phone body',(0,0,.004),(.078,.158,.008),metal,.006)
cube('black front bezel',(0,0,.0082),(.076,.156,.0012),edge,.005)
cube('glass panel',(0,0,.009),(.071,.148,.0004),glass,.004)
cube('display surface',(0,-.001,.00925),(.067,.139,.0001),screen,.003)
cube('earpiece',(0,.068,.0095),(.012,.0014,.0003),edge,.0005)
# All lettering is editable Blender text geometry, not generated image text.
text('call state','INCOMING CALL',0,.042,.0095,.0041,muted)
text('caller name','BROTHER',0,.022,.0095,.009,white)
text('caller detail','Mobile',0,.011,.0095,.0036,muted)
text('lower note','Incoming voice call',0,-.038,.0095,.0034,muted)
def button(n,x,y,m):
 bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=.0065,depth=.00025,location=(x,y,.0096));o=bpy.context.object;o.name=n;o.data.materials.append(m)
button('decline button',-.018,-.056,red);button('answer button',.018,-.056,green)
text('decline caption','DECLINE',-.018,-.068,.0095,.0026,white);text('answer caption','ANSWER',.018,-.068,.0095,.0026,white)
for y in (-.05,-.035):cube('side button',(.0395,y,.004),(.001,.012,.002),metal,.0005)
# Warm/cool scene illumination, with a small white pool suggesting screen spill.
light('window',(-.2,.15,.32),(0,0,0),1.0,(.57,.79,1),.24);light('warm lamp',(.15,.13,.22),(0,0,0),.55,(1,.64,.38),.17);light('screen light',(0,0,.035),(0,0,0),.006,(.8,1,1),.06)
c=bpy.data.cameras.new('camera');cam=bpy.data.objects.new('camera',c);s.collection.objects.link(cam);s.camera=cam;c.lens=50;cam.location=(.115,-.21,.33);cam.rotation_euler=(Vector((0,0,0))-cam.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(R/'brand/intro/phone/incoming_call_study.blend'));s.render.filepath=str(R/'docs/previews/intro/incoming_call_study.png');bpy.ops.render.render(write_still=True);os._exit(0)
