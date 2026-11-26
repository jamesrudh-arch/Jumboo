#!/usr/bin/env python3
"""Check sampled outsole vertices during selected stance frames, not gait QA."""
import bpy,os,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'brand/characters/marcus/marcus_ground_contact.blend'))
s=bpy.context.scene;boots=bpy.data.objects['Cloth_boots'];floor=bpy.data.objects['Plane'].location.z
report={'scope':'Selected rest-pose outsole vertices, two stance intervals only. No full foot collision, loop, garment, export, device or visual quality guarantee.','floor_z':floor,'stance':{}}
for side,start,end,sign in [('r',1,13,-1),('l',13,25,1)]:
 ids=[v.index for v in boots.data.vertices if v.co.x*sign>0 and v.co.z<floor+.025];assert ids
 first=None;max_drift=0;minimum=float('inf');maximum=-float('inf')
 for frame in range(start,end+1):
  s.frame_set(frame);ev=boots.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=ev.to_mesh();points=[ev.matrix_world@mesh.vertices[i].co for i in ids]
  if first is None:first=[p.copy() for p in points]
  max_drift=max(max_drift,max((a-b).length for a,b in zip(points,first)));lowest=min(p.z-floor for p in points);minimum=min(minimum,lowest);maximum=max(maximum,lowest);ev.to_mesh_clear()
 report['stance'][side]={'frames':[start,end],'sampled_outsole_vertices':len(ids),'max_sample_displacement_m':max_drift,'minimum_sample_height_range_above_floor_m':[minimum,maximum]}
 # Explicitly scoped regression tolerance; not a game or production threshold.
 assert max_drift<.001 and minimum>-.001 and maximum<.001, side
out=ROOT/'docs/previews/marcus/ground_contact_measurement.json';out.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2),flush=True);os._exit(0)
