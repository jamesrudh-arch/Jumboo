#!/usr/bin/env python3
"""Create a distinct test GLB with normalized skin weights; source is unchanged.
Narrowly supports the inspected single-buffer float VEC4 WEIGHTS_0 GLB.
"""
import hashlib,json,math,struct
from pathlib import Path
root=Path(__file__).resolve().parents[1];src=root/'brand/characters/marcus/marcus_approved_source.glb';out=root/'brand/characters/marcus/marcus_normalized_test.glb'
data=bytearray(src.read_bytes());magic,version,total=struct.unpack_from('<4sII',data);assert magic==b'glTF' and version==2 and total==len(data)
length,kind=struct.unpack_from('<I4s',data,12);assert kind==b'JSON';j=json.loads(data[20:20+length]);bin_header=20+length;bin_len,bin_kind=struct.unpack_from('<I4s',data,bin_header);assert bin_kind==b'BIN\0';bin_start=bin_header+8
prim=j['meshes'][0]['primitives'][0];assert 'WEIGHTS_1' not in prim['attributes'];a=j['accessors'][prim['attributes']['WEIGHTS_0']];assert a['type']=='VEC4' and a['componentType']==5126 and 'sparse' not in a
view=j['bufferViews'][a['bufferView']];assert view['buffer']==0;stride=view.get('byteStride',16);start=bin_start+view.get('byteOffset',0)+a.get('byteOffset',0);assert start+(a['count']-1)*stride+16<=bin_start+bin_len
adjusted=0;max_err=0.0
for i in range(a['count']):
 pos=start+i*stride;weights=struct.unpack_from('<4f',data,pos);assert all(math.isfinite(w) and w>=0 for w in weights);total=sum(weights);assert total>1e-8
 max_err=max(max_err,abs(total-1));normalized=tuple(w/total for w in weights)
 if abs(total-1)>1e-7:adjusted+=1
 struct.pack_into('<4f',data,pos,*normalized)
out.write_bytes(data);print(json.dumps({'vertices':a['count'],'adjusted_above_1e-7':adjusted,'max_pre_normalization_error':max_err,'source_sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'derived_sha256':hashlib.sha256(data).hexdigest()},indent=2))
