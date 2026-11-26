#!/usr/bin/env python3
"""Structural/rest-pose checks only; not a visual or animation-quality test."""
import bpy, os
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
NAMES=('Cloth_jacket','Cloth_shirt','Cloth_jeans','Cloth_boots')
def coords():
 dg=bpy.context.evaluated_depsgraph_get();result={}
 for name in NAMES:
  o=bpy.data.objects[name].evaluated_get(dg);mesh=o.to_mesh()
  result[name]=[o.matrix_world @ v.co for v in mesh.vertices];o.to_mesh_clear()
 return result
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'brand/characters/marcus/marcus_character_study.blend'));original=coords()
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'brand/characters/marcus/marcus_unified_rig_test.blend'));bpy.context.scene.frame_set(1)
rig=bpy.data.objects['Marcus test skeleton'];assert len([o for o in bpy.context.scene.objects if o.type=='ARMATURE'])==1
for name in (*NAMES,'Marcus body','Marcus head (graft)'):
 obj=bpy.data.objects[name];assert any(m.type=='ARMATURE' and m.object==rig for m in obj.modifiers),name
final=coords()
for name in NAMES:
 assert len(original[name])==len(final[name]),name
 error=max((a-b).length for a,b in zip(original[name],final[name]))
 print(name,'maximum rest-position difference:',error,flush=True)
 assert error < 1e-5, name
assert rig.animation_data and rig.animation_data.action
print('PASS: one rig, six bound meshes, animation keys, unchanged clothing rest positions',flush=True)
os._exit(0)
