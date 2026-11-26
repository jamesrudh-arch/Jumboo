import bpy,math,os
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'brand/characters/marcus/marcus_neck_test.blend'));s=bpy.context.scene;head=bpy.data.objects['Marcus head (graft)'];rig=bpy.data.objects['Marcus test skeleton'];assert len([x for x in s.objects if x.type=='ARMATURE'])==1
assert any(m.type=='ARMATURE' and m.object==rig for m in head.modifiers)
for frame in (1,7,13,19,25):
 s.frame_set(frame);o=head.evaluated_get(bpy.context.evaluated_depsgraph_get());m=o.to_mesh();assert all(math.isfinite(c) for v in m.vertices for c in v.co);print('frame',frame,'head vertices',len(m.vertices),'finite',flush=True);o.to_mesh_clear()
print('PASS: one skeleton, head bound, finite evaluated head vertices at five key poses',flush=True);os._exit(0)
