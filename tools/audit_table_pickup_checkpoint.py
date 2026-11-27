"""Approximate half-frame box tests and sampled head/hand surface intersections.

Run with Blender 4.2 Python. Diagnostic only; not a collision certification.
"""
import bpy,math,json
from mathutils.bvhtree import BVHTree
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT / 'brand/intro/phone/experiments/table_pickup_checkpoint.blend'));s=bpy.context.scene;p=bpy.data.objects['phone grip control'];o=bpy.data.objects['char1'];groups={g.index:g.name for g in o.vertex_groups};labels=['LeftHand','LeftHandThumb','LeftHandIndex','LeftHandMiddle','LeftHandRing','LeftHandPinky'];ids={n:[i for i,v in enumerate(o.data.vertices) if any(g.weight>.5 and (groups.get(g.group,'')==n if n=='LeftHand' else groups.get(g.group,'').startswith(n)) for g in v.groups)] for n in labels};res={}
for i in range(45):
 f=1+i/2;s.frame_set(int(f),subframe=f%1);bpy.context.view_layer.update();ev=o.evaluated_get(bpy.context.evaluated_depsgraph_get());em=ev.to_mesh();M=p.matrix_world.inverted()@ev.matrix_world;vals={}
 for n,indices in ids.items():
  inside=0;gap=100;table=0
  for j in indices:
   v=M@em.vertices[j].co;inside+=int(-.039<v.x<.039 and -.079<v.y<.079 and 0<v.z<.010);gap=min(gap,math.sqrt(max(abs(v.x)-.039,0)**2+max(abs(v.y)-.079,0)**2+max(-v.z,0,v.z-.01)**2));w=ev.matrix_world@em.vertices[j].co;table+=int(.12<w.x<.72 and -.675<w.y<-.225 and .905<w.z<.945)
  vals[n]=(inside,round(gap*1000,1),table)
 ev.to_mesh_clear();res[f]=vals
for f in (1,5,10,11,11.5,12,12.5,13,13.5,14,16,20,23):print(f,res[f],flush=True)
# Independent coarse triangle-overlap test. Keep only faces whose vertices are
# strongly weighted to the named regions; mixed-weight boundary faces are omitted.
head = {i for i,v in enumerate(o.data.vertices) if any(g.weight > .5 and groups.get(g.group) == 'Head' for g in v.groups)}
hand = {i for i,v in enumerate(o.data.vertices) if any(g.weight > .5 and groups.get(g.group, '').startswith('LeftHand') for g in v.groups)}
head_faces = [tuple(face.vertices) for face in o.data.polygons if all(i in head for i in face.vertices)]
hand_faces = [tuple(face.vertices) for face in o.data.polygons if all(i in hand for i in face.vertices)]
overlaps = {}
for f in (18, 20, 22, 23):
 s.frame_set(f); bpy.context.view_layer.update()
 ev = o.evaluated_get(bpy.context.evaluated_depsgraph_get()); mesh = ev.to_mesh()
 vertices = [ev.matrix_world @ v.co for v in mesh.vertices]
 a = BVHTree.FromPolygons(vertices, head_faces); b = BVHTree.FromPolygons(vertices, hand_faces)
 overlaps[f] = len(a.overlap(b)); ev.to_mesh_clear()
print('Head/hand triangle overlaps:', overlaps, flush=True)
output = {'approximate_boxes_by_frame': res, 'head_hand_triangle_overlaps': overlaps}
(ROOT / 'docs/previews/intro/table_pickup_checkpoint_audit.json').write_text(json.dumps(output, indent=2) + '\n')

