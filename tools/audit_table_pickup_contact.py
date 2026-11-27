#!/usr/bin/env python3
"""Sample approximate pickup contacts; passing is not collision certification.

Run with Blender 4.2 Python. Tests selected strongly weighted vertices and
triangles at eighth-frame intervals, using simplified phone/table boxes.
"""
from pathlib import Path
import json
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT / 'brand/intro/phone/experiments/table_pickup_contact_study.blend'))
s = bpy.context.scene
character = bpy.data.objects['char1']
phone = bpy.data.objects['phone grip control']
names = {group.index: group.name for group in character.vertex_groups}
head = set()
hand = set()
for i, vertex in enumerate(character.data.vertices):
    if any(g.weight > .5 and names.get(g.group) in ('Head', 'neck', 'head_end', 'headfront') for g in vertex.groups):
        head.add(i)
    if any(g.weight > .5 and names.get(g.group, '').startswith('LeftHand') for g in vertex.groups):
        hand.add(i)
head_faces = [tuple(p.vertices) for p in character.data.polygons if all(i in head for i in p.vertices)]
hand_faces = [tuple(p.vertices) for p in character.data.polygons if all(i in hand for i in p.vertices)]

def inside_phone(v):
    return -.039 < v.x < .039 and -.079 < v.y < .079 and 0 < v.z < .010

result = {}
for k in range(177):
    frame = 1 + k / 8
    s.frame_set(int(frame), subframe=frame % 1)
    bpy.context.view_layer.update()
    evaluated = character.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = evaluated.to_mesh()
    vertices = [evaluated.matrix_world @ vertex.co for vertex in mesh.vertices]
    head_tree = BVHTree.FromPolygons(vertices, head_faces)
    hand_tree = BVHTree.FromPolygons(vertices, hand_faces)
    inverse_phone = phone.matrix_world.inverted()
    corners = [phone.matrix_world @ Vector((x, y, z))
               for x in (-.039, .039) for y in (-.079, .079) for z in (0, .01)]
    entry = {
        'phone_corners_below_table_top': sum(.12 < v.x < .72 and -.675 < v.y < -.25
                                             and v.z < .9449 for v in corners),
        'head_hand_triangles': len(head_tree.overlap(hand_tree)),
        'phone_head_vertices': sum(inside_phone(inverse_phone @ vertices[i]) for i in head),
        'phone_hand_vertices': sum(inside_phone(inverse_phone @ vertices[i]) for i in hand),
        'hand_table_vertices': sum(.12 < vertices[i].x < .72 and -.675 < vertices[i].y < -.25
                                   and .905 < vertices[i].z < .945 for i in hand),
    }
    evaluated.to_mesh_clear()
    result[str(frame)] = entry
    if any(entry.values()):
        print(frame, entry, flush=True)
output = ROOT / 'docs/previews/intro/table_pickup_contact_audit.json'
output.write_text(json.dumps(result, indent=2) + '\n')
print(f'Wrote {output}', flush=True)
