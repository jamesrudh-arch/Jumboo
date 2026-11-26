#!/usr/bin/env python3
"""Measure sampled stance only; cannot certify the animation or clothing."""
import bpy,os,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'brand/characters/marcus/marcus_contact_study.blend'));s=bpy.context.scene;boots=bpy.data.objects['Cloth_boots'];floor=bpy.data.objects['Plane'].location.z
report={'scope':'Vertices weighted >0.8 to ball bone, two specified stance intervals only; not full shoe, collision, animation or device QA.','floor_z':floor,'stance':{}}
for side,start,end in [('r',1,13),('l',13,25)]:
 gid=boots.vertex_groups['ball_'+side].index;ids=[v.index for v in boots.data.vertices if any(w.group==gid and w.weight>.8 for w in v.groups)];assert ids
 baseline=None;max_drift=0;low=float('inf');high=-float('inf')
 for frame in range(start,end+1):
  s.frame_set(frame);ev=boots.evaluated_get(bpy.context.evaluated_depsgraph_get());m=ev.to_mesh();pts=[ev.matrix_world@m.vertices[i].co for i in ids]
  if baseline is None:baseline=[v.copy() for v in pts]
  max_drift=max(max_drift,max((a-b).length for a,b in zip(pts,baseline)));minimum=min(p.z for p in pts);low=min(low,minimum);high=max(high,minimum);ev.to_mesh_clear()
 report['stance'][side]={'frames':[start,end],'sampled_vertices':len(ids),'max_sample_displacement_m':max_drift,'minimum_sample_height_range_above_floor_m':[low-floor,high-floor]}
out=ROOT/'docs/previews/marcus/contact_measurement.json';out.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2),flush=True);os._exit(0)
