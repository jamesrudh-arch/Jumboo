#!/usr/bin/env python3
"""Ensure the test copy differs only inside skin-weight byte ranges."""
import json,struct,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[1];a=(root/'brand/characters/marcus/marcus_approved_source.glb').read_bytes();b=(root/'brand/characters/marcus/marcus_normalized_test.glb').read_bytes();assert len(a)==len(b)
length,kind=struct.unpack_from('<I4s',a,12);assert kind==b'JSON';j=json.loads(a[20:20+length]);acc=j['accessors'][j['meshes'][0]['primitives'][0]['attributes']['WEIGHTS_0']];view=j['bufferViews'][acc['bufferView']];start=20+length+8+view.get('byteOffset',0)+acc.get('byteOffset',0);stride=view.get('byteStride',16)
assert stride>=16;changed=0
for i in range(acc['count']):
 pos=start+i*stride;assert a[pos+16:pos+stride]==b[pos+16:pos+stride];weights=struct.unpack_from('<4f',b,pos);assert abs(sum(weights)-1)<1e-6 and min(weights)>=0;changed+=a[pos:pos+16]!=b[pos:pos+16]
assert a[:start]==b[:start];last=start+(acc['count']-1)*stride+16;assert a[last:]==b[last:];assert changed
print(f'PASS: {acc["count"]} normalized vertices; {changed} changed weight records; all other bytes unchanged')
