#!/usr/bin/env python3
"""Inspect a motion-capture candidate and Marcus bone-name overlap, not a retarget."""
import bpy,json,hashlib,os,math
from pathlib import Path
R=Path(__file__).resolve().parents[1];source=R/'brand/intro/mocap_research/cmu_80_25.bvh';target=R/'brand/characters/marcus/marcus_approved_source.glb'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_anim.bvh(filepath=str(source),global_scale=.01,axis_forward='-Z',axis_up='Y',update_scene_fps=False);mocap=bpy.context.object
before=set(bpy.context.scene.objects);bpy.ops.import_scene.gltf(filepath=str(target));new=set(bpy.context.scene.objects)-before;marcus=next(o for o in new if o.type=='ARMATURE')
source_bones={b.name for b in mocap.pose.bones};target_bones={b.name for b in marcus.pose.bones};common=sorted(source_bones & target_bones)
s=bpy.context.scene;sample={}
for f in (160,240,320):
 s.frame_set(f);bpy.context.view_layer.update();h=mocap.matrix_world @ mocap.pose.bones['Head'].head;l=mocap.matrix_world @ mocap.pose.bones['LeftHand'].head;hips=mocap.matrix_world @ mocap.pose.bones['Hips'].head
 sample[str(f)]={'left_hand_to_head_over_head_to_hips':round((l-h).length/(h-hips).length,4)}
assert len(common)>=12 and sample['320']['left_hand_to_head_over_head_to_hips']<sample['160']['left_hand_to_head_over_head_to_hips']
text=source.read_text();import re
frame_count=int(re.search(r'Frames:\s*(\d+)',text).group(1));frame_time=float(re.search(r'Frame Time:\s*([0-9.]+)',text).group(1));assert frame_count==1108
out={'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'frames_including_converted_reference_pose':frame_count,'bvh_frame_time_seconds':frame_time,'cmu_catalog_fps':60,'timing_conflict':'BVH conversion declares ~120 fps but CMU catalog lists 60 fps for this trial; actual playback timing requires checking against CMU reference.','mocap_bone_count':len(source_bones),'marcus_bone_count':len(target_bones),'exact_name_overlap':common,'selected_distance_ratios':sample,'scope':'Structural import and sampled relative head/hand distances only; not a retarget, visual motion, finger capture, prop contact, engine or device validation.'}
(R/'docs/previews/intro/cmu_phone_mocap_audit.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2),flush=True);os._exit(0)
