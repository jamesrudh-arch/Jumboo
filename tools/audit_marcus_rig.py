#!/usr/bin/env python3
"""Reproducible structural audit, not a visual/animation/mobile quality test."""
import bpy, bmesh, json, os, math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
path=ROOT/'brand/characters/marcus/marcus_neck_test.blend'
bpy.ops.wm.open_mainfile(filepath=str(path));s=bpy.context.scene
rigs=[o for o in s.objects if o.type=='ARMATURE']; assert len(rigs)==1
rig=rigs[0];mesh_names=('Marcus body','Marcus head (graft)','Cloth_jacket','Cloth_shirt','Cloth_jeans','Cloth_boots');report={'scope':'Structural baseline; no visual, clipping, runtime, export or device validation.', 'source':str(path.relative_to(ROOT)),'armatures':len(rigs),'bones':len(rig.data.bones),'meshes':{}}
for name in mesh_names:
 o=bpy.data.objects[name];mesh=o.data;bm=bmesh.new();bm.from_mesh(mesh)
 mesh.calc_loop_triangles()
 deform_groups={g.index for g in o.vertex_groups if g.name in rig.data.bones and rig.data.bones[g.name].use_deform}
 counts=[];sums=[]
 for v in mesh.vertices:
  weights=[w.weight for w in v.groups if w.group in deform_groups and w.weight>1e-7]
  counts.append(len(weights));sums.append(sum(weights))
 report['meshes'][name]={'vertices':len(mesh.vertices),'triangles':len(mesh.loop_triangles),'materials':len(mesh.materials),'open_boundary_edges':sum(e.is_boundary for e in bm.edges),'nonmanifold_edges':sum(not e.is_manifold for e in bm.edges),'unweighted_vertices':sum(c==0 for c in counts),'vertices_over_4_influences':sum(c>4 for c in counts),'non_normalized_vertices':sum(c>0 and abs(t-1)>1e-4 for c,t in zip(counts,sums)),'max_influences':max(counts,default=0),'armature_bound':any(m.type=='ARMATURE' and m.object==rig for m in o.modifiers)}
 bm.free()
report['total_triangles']=sum(x['triangles'] for x in report['meshes'].values())
output=ROOT/'docs/previews/marcus/rig_structural_audit.json';output.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2),flush=True);os._exit(0)
